# Auto-Publishing for Twitter & LinkedIn

**Date**: 2026-03-12
**Status**: Draft
**Scope**: Enable automatic publishing of scheduled posts to Twitter and LinkedIn, including media upload support.

## Context

Bullhorn is a social media post scheduler. Currently, when a post's scheduled time arrives, a cron job (`/api/cron/publish`) transitions the post from `scheduled` to `ready` and sends push/email notifications. The user then publishes manually (via Claude in Chrome, Share Sheet, or copy/paste).

This design adds automatic publishing: scheduled posts with a linked social account are published directly to the platform API when they become due.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Auto-publish scope | All scheduled posts with a `social_account_id` | Scheduling IS intent to publish. No per-post or per-account toggle needed. |
| Supabase client | Inject into `publishPost()` | Cron uses service role client; manual publish uses session client. One function, two callers. |
| Concurrency | `Promise.allSettled` with limit of 8 posts per cron run | Conservative limit for Vercel timeout safety. Worst case: 8 posts with media at ~6s each = 48s, leaving headroom for DB queries. The 5-min cron interval handles overflow. |
| Media upload | Included in this work | Twitter chunked upload + LinkedIn Images API. Both platforms. |
| Reddit | Deferred | Reddit API requires pre-approval since Nov 2025. Will revisit later. |

## Architecture

### Publish Flow (New)

```
Cron runs every 5 min
  |
  |--> Query: status=scheduled, scheduled_at <= now, scheduled_at >= 1hr ago, LIMIT 8
  |
  |--> Split posts:
  |      |
  |      |--> HAS social_account_id:
  |      |      |
  |      |      |--> Atomic status transition: UPDATE status=publishing WHERE status=scheduled
  |      |      |    (check affected rows > 0 to prevent duplicate processing by concurrent crons)
  |      |      |
  |      |      |--> publishPost() concurrently via Promise.allSettled
  |      |      |      |
  |      |      |      |--> getValidAccessToken (refresh if needed)
  |      |      |      |--> Download media from Supabase storage (if any)
  |      |      |      |--> Upload media to platform (if any)
  |      |      |      |--> Create post via platform API
  |      |      |      |--> Update status: published or failed
  |      |      |
  |      |      |--> On failure: publishPost sets status=failed + send push/email notification
  |      |
  |      |--> NO social_account_id --> Set status=ready --> Send notifications (current behavior)
  |
  |--> Schedule next recurrence for recurring posts
```

### Retry Flow (Reactivated)

```
Retry cron runs every hour
  |
  |--> Query: status=failed, publish_result.retryable=true, retryCount < 3
  |--> publishPost() concurrently (same as above)
  |--> After 3 retries: leave as failed for manual intervention
```

## Detailed Design

### 1. Cron Rewrite: `src/app/api/cron/publish/route.ts`

**Current behavior**: Find due posts -> transition to `ready` -> send notifications.

**New behavior**: Find due posts -> split into auto-publish vs notify-only -> process each group.

Key changes:
- Reduce limit from 50 to 8 (timeout safety with media uploads)
- Posts with `social_account_id`: atomically set `status=publishing` (check affected rows to prevent duplicate processing by concurrent crons), call `publishPost()`, on failure send notification
- Posts without `social_account_id`: keep current behavior (set `status=ready`, send notification)
- Use `Promise.allSettled()` for concurrent publishing — if one post fails, others still publish
- Import `publishPost` from `@/lib/publishers`
- On publish failure: `publishPost()` already sets status to `failed`, cron additionally sends push/email notification so user knows
- Batch-fetch social accounts for all auto-publish posts in one query (reduces N+1 DB calls)

### 2. Publisher Refactor: `src/lib/publishers/index.ts`

**Current signature**:
```typescript
publishPost(post: Post, accountId: string): Promise<PublishOutput>
```

**New signature**:
```typescript
publishPost(
  post: Post,
  accountId: string,
  options?: { supabaseClient?: SupabaseClient; userId?: string }
): Promise<PublishOutput>
```

Changes:
- Accept optional `options` object with `supabaseClient` and `userId`
- If `supabaseClient` provided, use it for all DB operations; otherwise fall back to `await createClient()`
- `userId` is needed for media storage path (`{userId}/{filename}`). The cron has this from the DB row. Manual publish can look it up from the session.
- Pass the client down to `getValidAccessToken()` as well
- Pass both client and userId into platform publishers via `PublishInput`

### 3. Token Refresh Refactor: `src/lib/tokenRefresh.ts`

**Current signature**:
```typescript
getValidAccessToken(accountId: string): Promise<string>
```

**New signature**:
```typescript
getValidAccessToken(accountId: string, supabaseClient?: SupabaseClient): Promise<string>
```

Changes:
- Accept optional `supabaseClient` parameter
- If provided, use it instead of `await createClient()`. Resolve client at top of each function: `const supabase = supabaseClient || await createClient()`
- Same change for `refreshTokenIfNeeded()` which also needs a client for DB writes (currently creates its own client on line 178, which must use the injected one instead)

### 4. Twitter Media Upload: `src/lib/publishers/twitterMedia.ts` (New)

Implements Twitter/X API v2 chunked media upload. Note: v2 uses separate RESTful endpoints (not v1.1's `command=` parameter pattern).

```
INITIALIZE (POST https://upload.x.com/2/media/upload/initialize)
  - Body (JSON): { total_bytes, media_type, media_category }
  - Returns: { id: "media_id", expires_after_secs }

APPEND (POST https://upload.x.com/2/media/upload/{media_id}/append)
  - Body (multipart/form-data): segment_index, media_data (binary chunk)
  - For images: 1 chunk. For video: 5MB chunks.
  - Returns: 2xx on success

FINALIZE (POST https://upload.x.com/2/media/upload/{media_id}/finalize)
  - No body required
  - Returns: { id, processing_info? } — processing_info present for async media

STATUS (GET https://upload.x.com/2/media/upload/{media_id}) [async media only]
  - Poll until processing_info.state=succeeded or state=failed
  - Respect processing_info.check_after_secs from response
```

Exports:
```typescript
uploadTwitterMedia(
  accessToken: string,
  mediaBuffer: Buffer,
  contentType: string,
  category: 'tweet_image' | 'tweet_video' | 'tweet_gif'
): Promise<string> // Returns media_id
```

Platform limits:
- Images: 5MB, formats: JPEG, PNG, GIF, WEBP
- Videos: 512MB, formats: MP4. Async processing required.
- GIFs: 15MB. Async processing required.
- Max 4 images per tweet, or 1 video/GIF

### 5. LinkedIn Media Upload: `src/lib/publishers/linkedinMedia.ts` (New)

Implements LinkedIn Images API:

```
Initialize Upload (POST /rest/images?action=initializeUpload)
  - Body: { initializeUploadRequest: { owner: "urn:li:person:xxx" } }
  - Returns: uploadUrl, image URN

Upload Binary (PUT {uploadUrl})
  - Raw image bytes with Content-Type header

Reference in Post
  - Add content.media.id = image URN to post body
```

Exports:
```typescript
uploadLinkedInImage(
  accessToken: string,
  providerAccountId: string,
  imageBuffer: Buffer,
  contentType: string
): Promise<string> // Returns image URN
```

Platform limits:
- Images: 10MB, formats: JPEG, PNG, GIF
- Video support deferred (uses separate Videos API with more complex flow)

### 6. Shared Media Download: `src/lib/publishers/mediaDownload.ts` (New)

Downloads media files from Supabase Storage for re-upload to platforms.

```typescript
downloadMediaFromStorage(
  supabase: SupabaseClient,
  userId: string,
  fileUrl: string
): Promise<{ buffer: Buffer; contentType: string; filename: string }>
```

Flow:
1. Extract filename from the URL/path. The media system stores paths in 3 formats that must all be handled:
   - Bare filename: `abc123.jpg` → use directly
   - API path: `/api/media/abc123.jpg` → extract last segment
   - Full URL: `https://...supabase.co/.../abc123.jpg` → extract last segment
2. Generate signed URL from Supabase storage (`media` bucket, path `{userId}/{filename}`, expiry: 300 seconds — long enough for large video uploads)
3. Fetch the binary data
4. Return buffer + content type

Error handling:
- If the file doesn't exist in storage (deleted by user, storage cleanup, etc.), throw a descriptive error: `Media file not found: {filename}`
- The caller (`publishToTwitter`/`publishToLinkedIn`) catches this and can choose to publish text-only or fail the entire publish. Default behavior: fail with `retryable: false` and a clear error message.

### 7. Publisher Changes: `src/lib/publishers/twitter.ts`

Before creating the tweet, check for media:

```typescript
// In publishToTwitter():
const content = input.post.content as TwitterContent
let mediaIds: string[] | undefined

if (content.mediaUrls?.length && input.supabase && input.userId) {
  mediaIds = []
  for (const mediaUrl of content.mediaUrls) {
    const { buffer, contentType } = await downloadMediaFromStorage(
      input.supabase, input.userId, mediaUrl
    )
    const category = inferMediaCategory(contentType)
    const mediaId = await uploadTwitterMedia(input.accessToken, buffer, contentType, category)
    mediaIds.push(mediaId)
  }
}

// In tweet body:
const body: Record<string, unknown> = { text: tweetText }
if (mediaIds?.length) body.media = { media_ids: mediaIds }
// Note: media only attached to first tweet in a thread
```

`PublishInput` interface updated to include optional `supabase` client and `userId`.

### 8. Publisher Changes: `src/lib/publishers/linkedin.ts`

Before creating the post, check for media:

```typescript
// In publishToLinkedIn():
const content = input.post.content as LinkedInContent
let imageUrn: string | undefined

if (content.mediaUrl && input.supabase && input.userId) {
  const { buffer, contentType } = await downloadMediaFromStorage(
    input.supabase, input.userId, content.mediaUrl
  )
  imageUrn = await uploadLinkedInImage(
    input.accessToken, input.providerAccountId, buffer, contentType
  )
}

// In post body, add media content if image was uploaded:
if (imageUrn) {
  postBody.content = {
    media: { title: '', id: imageUrn }
  }
}
```

### 9. Retry-Failed Reactivation: `src/app/api/cron/retry-failed/route.ts`

Convert from no-op stub to active retry:

- Query posts with `status=failed`
- Filter in application code: `publish_result->retryable = true` AND `publish_result->retryCount < 3`
- Use same `publishPost()` with service role client
- Limit to 5 posts per run
- Leave posts as `failed` after 3 retries

### 10. PublishInput Interface Update: `src/lib/publishers/index.ts`

```typescript
export interface PublishInput {
  post: Post
  accessToken: string
  providerAccountId: string
  supabase?: SupabaseClient  // For media download
  userId?: string             // For media storage path
}
```

### 11. LinkedIn Token Refresh (Awareness Only)

LinkedIn 60-day tokens may not support programmatic refresh unless the app has been granted that by LinkedIn. The existing `tokenRefresh.ts` already handles this correctly:

- `handleRefreshResponse()` catches `invalid_grant` errors
- `markAccountError()` sets account status to `expired` with message "Token expired, please reconnect"
- The publish flow skips expired accounts naturally

No code change needed. Users will need to manually reconnect LinkedIn every 60 days if programmatic refresh is not available.

## External Setup Steps (No Code)

1. **Twitter API**: Subscribe to at least the Free tier at `developer.x.com`. Verify the app has "Read and Write" permissions. Free tier allows ~500 posts/month with media uploads (~17/day).

2. **LinkedIn Developer Portal**: Enable the "Share on LinkedIn" product. Self-serve, instant approval. This grants the `w_member_social` scope needed for posting.

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/cron/publish/route.ts` | Modify | Add auto-publishing for posts with social accounts |
| `src/lib/publishers/index.ts` | Modify | Inject Supabase client, update `PublishInput` interface |
| `src/lib/tokenRefresh.ts` | Modify | Accept optional Supabase client |
| `src/lib/publishers/twitter.ts` | Modify | Add media attachment to tweets |
| `src/lib/publishers/linkedin.ts` | Modify | Add media attachment to posts |
| `src/lib/publishers/twitterMedia.ts` | Create | Twitter v2 chunked media upload |
| `src/lib/publishers/linkedinMedia.ts` | Create | LinkedIn Images API upload |
| `src/lib/publishers/mediaDownload.ts` | Create | Download media from Supabase storage |
| `src/app/api/cron/retry-failed/route.ts` | Modify | Reactivate failed post retry |

## Test Plan

Each new/modified file gets a corresponding `.test.ts`:

1. **twitterMedia.test.ts** - Mock fetch calls for INIT/APPEND/FINALIZE/STATUS flow, test chunking for large files, test error handling
2. **linkedinMedia.test.ts** - Mock initializeUpload and PUT upload, test error handling
3. **mediaDownload.test.ts** - Mock Supabase storage signed URL + fetch, test content type detection
4. **twitter.test.ts** (update) - Add test cases for tweets with media, verify media_ids in request body
5. **linkedin.test.ts** (update) - Add test cases for posts with media, verify image URN in post body
6. **publishers/index.test.ts** (update) - Test client injection, test with and without supabaseClient parameter
7. **cron/publish/route.test.ts** (update) - Test auto-publish branch, test notify-only branch, test parallel execution
8. **cron/retry-failed/route.test.ts** (update) - Test retry logic, test max retry count
9. **tokenRefresh.test.ts** (update) - Test with injected client

## Risks

| Risk | Mitigation |
|------|------------|
| Vercel function timeout (10s hobby, 60s pro) | Limit to 8 posts/run, concurrent publishing, 5-min cron interval |
| Twitter rate limits (Free: ~500 posts/mo) | Track rate limit headers, respect 429 responses, retryable flag |
| LinkedIn token expiry (60 days) | Existing error handling marks account as expired with reconnect message |
| Media download from Supabase adds latency | Signed URLs are fast; media is typically small (< 10MB). 300s signed URL expiry provides headroom. |
| Twitter media processing (async for video) | Poll with backoff; timeout after 60s and mark as failed+retryable |
| Concurrent cron runs processing same post | Atomic status transition: `UPDATE ... WHERE status=scheduled` + check affected rows. If 0 rows affected, another cron already grabbed it. |
| Deleted media files causing publish failure | `downloadMediaFromStorage` throws descriptive error; publish fails with `retryable: false` and clear message |
| Supabase signed URL expiry during upload | 300s expiry (5 min) provides ample headroom for even large video uploads |
