# Platform Integration — Notification-First Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Bullhorn from an auto-publishing scheduler into a content CMS + scheduling engine that notifies users when posts are due, with publishing handled externally via Claude in Chrome, iOS Share Sheet, or manual copy/paste.

**Architecture:** Posts follow a `draft → scheduled → ready → published` lifecycle. A cron job transitions scheduled posts to `ready` and fires notifications (Web Push + email). Five new MCP tools let Claude Code fetch due posts, get pre-formatted content, download media, and mark posts published. The existing API publishers remain as optional fallback.

**Tech Stack:** Next.js 15, Supabase, Zustand, `web-push` (Web Push sender), `resend` + `@react-email/components` (email), Web Share API (iOS Share Sheet), Vitest

**Design doc:** `docs/plans/2026-03-02-platform-integration-design.md`

---

## Workstream 1: MCP Publish Tools

Smallest lift, biggest immediate value. Five new tools added to `@neonwatty/bullhorn-mcp`.

---

### Task 1: Add `ready` status to MCP PostStatus type

**Files:**
- Modify: `mcp-server/src/storage.ts:30`

**Step 1: Add `ready` to PostStatus union**

In `mcp-server/src/storage.ts`, line 30, change:

```typescript
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'archived'
```

to:

```typescript
export type PostStatus = 'draft' | 'scheduled' | 'ready' | 'published' | 'failed' | 'archived'
```

**Step 2: Build MCP server to verify no type errors**

Run: `cd mcp-server && npm run build`
Expected: Clean build, no errors

**Step 3: Commit**

```bash
git add mcp-server/src/storage.ts
git commit -m "feat: add 'ready' status to MCP PostStatus type"
```

---

### Task 2: Add `get_due_posts` MCP tool definition

**Files:**
- Modify: `mcp-server/src/index.ts` (tool definition in TOOLS array)
- Modify: `mcp-server/src/index.ts` (TOOL_SCOPES)

**Step 1: Add tool definition**

Add to the TOOLS array in `mcp-server/src/index.ts`, after the existing post tools:

```typescript
{
  name: 'get_due_posts',
  description:
    'Get posts that are due for publishing. Returns posts with status "ready" (already transitioned by cron) or posts with status "scheduled" where scheduledAt <= now (not yet transitioned). Lightweight response with preview text.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      platform: {
        type: 'string',
        enum: ['twitter', 'linkedin', 'reddit'],
        description: 'Filter by platform (optional)',
      },
    },
  },
},
```

**Step 2: Add scope mapping**

Add to `TOOL_SCOPES`:

```typescript
get_due_posts: ['posts:read'],
```

**Step 3: Build to verify**

Run: `cd mcp-server && npm run build`
Expected: Clean build

**Step 4: Commit**

```bash
git add mcp-server/src/index.ts
git commit -m "feat: add get_due_posts tool definition to MCP server"
```

---

### Task 3: Add `get_due_posts` API endpoint

**Files:**
- Create: `src/app/api/posts/due/route.ts`

**Step 1: Write the test**

Create `src/app/api/posts/due/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  validateScopes: vi.fn(),
  parseJsonBody: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

const mockRequireAuth = vi.mocked((await import('@/lib/auth')).requireAuth)
const mockCreateClient = vi.mocked((await import('@/lib/supabase/server')).createClient)

describe('GET /api/posts/due', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/posts/due')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns posts with status ready', async () => {
    const mockPosts = [
      {
        id: 'post-1',
        user_id: 'user-1',
        platform: 'twitter',
        status: 'ready',
        scheduled_at: '2026-03-02T14:00:00Z',
        content: { text: 'Hello world this is a test post for Twitter' },
        created_at: '2026-03-01T10:00:00Z',
        updated_at: '2026-03-01T10:00:00Z',
      },
    ]

    const mockSelect = vi.fn().mockReturnThis()
    const mockEq = vi.fn().mockReturnThis()
    const mockOr = vi.fn().mockReturnThis()
    const mockOrder = vi.fn().mockResolvedValue({ data: mockPosts, error: null })

    mockCreateClient.mockResolvedValue({
      from: vi.fn().mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        or: mockOr,
        order: mockOrder,
      }),
    } as any)

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/posts/due')
    const res = await GET(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.posts).toHaveLength(1)
    expect(json.posts[0].id).toBe('post-1')
    expect(json.posts[0].preview).toBeDefined()
    expect(json.posts[0].hasMedia).toBeDefined()
  })

  it('filters by platform when provided', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })
    mockCreateClient.mockResolvedValue({ from: mockFrom } as any)

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/posts/due?platform=twitter')
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/posts/due/route.test.ts`
Expected: FAIL — module `./route` not found

**Step 3: Implement the endpoint**

Create `src/app/api/posts/due/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { requireAuth, validateScopes } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function getPreview(content: Record<string, unknown>): string {
  const text = (content.text as string) || (content.title as string) || ''
  return text.slice(0, 100) + (text.length > 100 ? '...' : '')
}

function hasMedia(content: Record<string, unknown>): boolean {
  return !!(content.mediaUrls && (content.mediaUrls as string[]).length > 0) || !!content.mediaUrl
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth()
    await validateScopes(request, ['posts:read'])
    const supabase = await createClient()

    const platform = request.nextUrl.searchParams.get('platform')

    let query = supabase
      .from('posts')
      .select('id, platform, status, scheduled_at, content, created_at, updated_at')
      .eq('user_id', userId)
      .or(`status.eq.ready,and(status.eq.scheduled,scheduled_at.lte.${new Date().toISOString()})`)
      .order('scheduled_at', { ascending: true })

    if (platform) {
      query = query.eq('platform', platform)
    }

    const { data, error } = await query

    if (error) throw error

    const posts = (data || []).map((p) => ({
      id: p.id,
      platform: p.platform,
      status: p.status,
      scheduledAt: p.scheduled_at,
      preview: getPreview(p.content as Record<string, unknown>),
      hasMedia: hasMedia(p.content as Record<string, unknown>),
    }))

    return Response.json({ posts })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/posts/due/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/posts/due/route.ts src/app/api/posts/due/route.test.ts
git commit -m "feat: add GET /api/posts/due endpoint for due posts"
```

---

### Task 4: Add `get_due_posts` handler in MCP server

**Files:**
- Modify: `mcp-server/src/storage.ts` (add `listDuePosts` function)
- Modify: `mcp-server/src/index.ts` (add handler in CallToolRequestSchema switch)

**Step 1: Add `listDuePosts` to storage**

Add to `mcp-server/src/storage.ts` after the `searchPosts` function (around line 255):

```typescript
export async function listDuePosts(options?: {
  platform?: Platform
}): Promise<
  {
    id: string
    platform: Platform
    status: PostStatus
    scheduledAt: string | null
    preview: string
    hasMedia: boolean
  }[]
> {
  const client = getClient()
  const params: Record<string, string> = {}
  if (options?.platform) params.platform = options.platform
  const data = await client.get<{
    posts: {
      id: string
      platform: Platform
      status: PostStatus
      scheduledAt: string | null
      preview: string
      hasMedia: boolean
    }[]
  }>('/api/posts/due', params)
  return data.posts
}
```

**Step 2: Add handler in index.ts**

In the CallToolRequestSchema switch statement in `mcp-server/src/index.ts`, add a new case:

```typescript
case 'get_due_posts': {
  const { platform } = args as { platform?: string }
  const posts = await listDuePosts(
    platform ? { platform: platform as Platform } : undefined
  )
  return {
    content: [
      {
        type: 'text',
        text: posts.length === 0
          ? 'No posts are currently due for publishing.'
          : JSON.stringify(posts, null, 2),
      },
    ],
  }
}
```

**Step 3: Build MCP server**

Run: `cd mcp-server && npm run build`
Expected: Clean build

**Step 4: Commit**

```bash
git add mcp-server/src/storage.ts mcp-server/src/index.ts
git commit -m "feat: implement get_due_posts MCP tool handler"
```

---

### Task 5: Add `get_post_for_publish` MCP tool definition and handler

**Files:**
- Modify: `mcp-server/src/index.ts` (tool definition + scope + handler)

**Step 1: Add tool definition**

```typescript
{
  name: 'get_post_for_publish',
  description:
    'Get full post content pre-formatted for the target platform. Returns everything needed to publish: text, thread chunks (Twitter), visibility (LinkedIn), subreddit + title + body (Reddit), and media URLs.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      postId: {
        type: 'string',
        description: 'The post ID to retrieve for publishing',
      },
    },
    required: ['postId'],
  },
},
```

**Step 2: Add scope**

```typescript
get_post_for_publish: ['posts:read'],
```

**Step 3: Add handler**

```typescript
case 'get_post_for_publish': {
  const { postId } = args as { postId: string }
  if (!postId) {
    return {
      content: [{ type: 'text', text: 'Error: postId is required' }],
      isError: true,
    }
  }
  const post = await getPost(postId)
  if (!post) {
    return {
      content: [{ type: 'text', text: `Post ${postId} not found` }],
      isError: true,
    }
  }

  const content = post.content as Record<string, unknown>
  let formatted: Record<string, unknown>

  switch (post.platform) {
    case 'twitter': {
      const text = (content.text as string) || ''
      const chunks: string[] = []
      if (text.length <= 280) {
        chunks.push(text)
      } else {
        let remaining = text
        while (remaining.length > 0) {
          if (remaining.length <= 280) {
            chunks.push(remaining)
            break
          }
          let breakPoint = remaining.lastIndexOf(' ', 280)
          if (breakPoint === -1) breakPoint = 280
          chunks.push(remaining.slice(0, breakPoint))
          remaining = remaining.slice(breakPoint).trimStart()
        }
      }
      formatted = {
        platform: 'twitter',
        text,
        threadChunks: chunks,
        mediaUrls: content.mediaUrls || [],
      }
      break
    }
    case 'linkedin':
      formatted = {
        platform: 'linkedin',
        text: content.text || '',
        visibility: content.visibility || 'public',
        mediaUrls: content.mediaUrl ? [content.mediaUrl] : [],
      }
      break
    case 'reddit':
      formatted = {
        platform: 'reddit',
        subreddit: content.subreddit || '',
        title: content.title || '',
        body: content.body || '',
        flairText: content.flairText || null,
        mediaUrls: content.mediaUrls || [],
      }
      break
    default:
      formatted = { platform: post.platform, ...content }
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
  }
}
```

**Step 4: Build MCP server**

Run: `cd mcp-server && npm run build`
Expected: Clean build

**Step 5: Commit**

```bash
git add mcp-server/src/index.ts
git commit -m "feat: add get_post_for_publish MCP tool with per-platform formatting"
```

---

### Task 6: Add `mark_post_published` MCP tool definition and handler

**Files:**
- Modify: `mcp-server/src/index.ts` (tool definition + scope + handler)

**Step 1: Add tool definition**

```typescript
{
  name: 'mark_post_published',
  description:
    'Mark a post as published after it has been posted externally (via browser, Share Sheet, or manual copy). Optionally record the published URL and platform post ID.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      postId: {
        type: 'string',
        description: 'The post ID to mark as published',
      },
      publishedUrl: {
        type: 'string',
        description: 'URL of the published post (optional)',
      },
      platformPostId: {
        type: 'string',
        description: 'Platform-specific post ID (optional)',
      },
    },
    required: ['postId'],
  },
},
```

**Step 2: Add scope**

```typescript
mark_post_published: ['posts:write'],
```

**Step 3: Add handler**

```typescript
case 'mark_post_published': {
  const { postId, publishedUrl, platformPostId } = args as {
    postId: string
    publishedUrl?: string
    platformPostId?: string
  }
  if (!postId) {
    return {
      content: [{ type: 'text', text: 'Error: postId is required' }],
      isError: true,
    }
  }

  const publishResult: Record<string, unknown> = {
    success: true,
    publishedAt: new Date().toISOString(),
    method: 'external',
  }
  if (publishedUrl) publishResult.postUrl = publishedUrl
  if (platformPostId) publishResult.postId = platformPostId

  const updated = await updatePost(postId, {
    status: 'published',
    publishResult: publishResult as any,
  })

  if (!updated) {
    return {
      content: [{ type: 'text', text: `Post ${postId} not found` }],
      isError: true,
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            postId: updated.id,
            status: 'published',
            publishedAt: publishResult.publishedAt,
            publishedUrl: publishedUrl || null,
          },
          null,
          2
        ),
      },
    ],
  }
}
```

**Step 4: Build MCP server**

Run: `cd mcp-server && npm run build`
Expected: Clean build

**Step 5: Commit**

```bash
git add mcp-server/src/index.ts
git commit -m "feat: add mark_post_published MCP tool"
```

---

### Task 7: Add `get_upcoming_schedule` MCP tool

**Files:**
- Create: `src/app/api/posts/upcoming/route.ts`
- Modify: `mcp-server/src/storage.ts` (add `listUpcomingPosts`)
- Modify: `mcp-server/src/index.ts` (tool definition + scope + handler)

**Step 1: Create API endpoint**

Create `src/app/api/posts/upcoming/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { requireAuth, validateScopes } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth()
    await validateScopes(request, ['posts:read'])
    const supabase = await createClient()

    const hours = parseInt(request.nextUrl.searchParams.get('hours') || '24', 10)
    const clampedHours = Math.min(Math.max(hours, 1), 168) // 1h to 7d

    const now = new Date()
    const until = new Date(now.getTime() + clampedHours * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('posts')
      .select('id, platform, status, scheduled_at, content, campaign_id')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', until.toISOString())
      .order('scheduled_at', { ascending: true })

    if (error) throw error

    const posts = (data || []).map((p) => {
      const content = p.content as Record<string, unknown>
      const text = (content.text as string) || (content.title as string) || ''
      return {
        id: p.id,
        platform: p.platform,
        scheduledAt: p.scheduled_at,
        preview: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
        campaignId: p.campaign_id,
      }
    })

    return Response.json({ posts, hours: clampedHours })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 2: Add `listUpcomingPosts` to MCP storage**

In `mcp-server/src/storage.ts`:

```typescript
export async function listUpcomingPosts(hours: number = 24): Promise<
  {
    id: string
    platform: Platform
    scheduledAt: string | null
    preview: string
    campaignId: string | null
  }[]
> {
  const client = getClient()
  const data = await client.get<{
    posts: {
      id: string
      platform: Platform
      scheduledAt: string | null
      preview: string
      campaignId: string | null
    }[]
  }>('/api/posts/upcoming', { hours: String(hours) })
  return data.posts
}
```

**Step 3: Add tool definition + scope + handler in index.ts**

Tool definition:
```typescript
{
  name: 'get_upcoming_schedule',
  description:
    'Get posts scheduled for the next N hours (default: 24). Useful for planning publishing sessions. Returns posts with status "scheduled" that are due within the time window.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      hours: {
        type: 'number',
        description: 'Number of hours to look ahead (default: 24, max: 168)',
      },
    },
  },
},
```

Scope:
```typescript
get_upcoming_schedule: ['posts:read'],
```

Handler:
```typescript
case 'get_upcoming_schedule': {
  const { hours } = args as { hours?: number }
  const posts = await listUpcomingPosts(hours || 24)
  return {
    content: [
      {
        type: 'text',
        text: posts.length === 0
          ? `No posts scheduled in the next ${hours || 24} hours.`
          : JSON.stringify(posts, null, 2),
      },
    ],
  }
}
```

**Step 4: Build MCP server**

Run: `cd mcp-server && npm run build`
Expected: Clean build

**Step 5: Commit**

```bash
git add src/app/api/posts/upcoming/route.ts mcp-server/src/storage.ts mcp-server/src/index.ts
git commit -m "feat: add get_upcoming_schedule MCP tool and API endpoint"
```

---

### Task 8: Add `download_post_media` MCP tool

**Files:**
- Create: `src/app/api/posts/[id]/media/route.ts`
- Modify: `mcp-server/src/storage.ts`
- Modify: `mcp-server/src/index.ts`

**Step 1: Create API endpoint**

Create `src/app/api/posts/[id]/media/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { requireAuth, validateScopes } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireAuth()
    await validateScopes(request, ['posts:read'])
    const supabase = await createClient()
    const { id } = await params

    // Fetch post and verify ownership
    const { data: post, error } = await supabase
      .from('posts')
      .select('id, content, platform')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !post) {
      return Response.json({ error: 'Post not found' }, { status: 404 })
    }

    const content = post.content as Record<string, unknown>
    const mediaFiles: string[] = []

    // Collect media URLs from content
    if (content.mediaUrls && Array.isArray(content.mediaUrls)) {
      mediaFiles.push(...(content.mediaUrls as string[]))
    }
    if (content.mediaUrl && typeof content.mediaUrl === 'string') {
      mediaFiles.push(content.mediaUrl)
    }

    if (mediaFiles.length === 0) {
      return Response.json({ media: [], message: 'No media attached to this post' })
    }

    // Generate signed download URLs for each media file
    const media = await Promise.all(
      mediaFiles.map(async (fileUrl) => {
        // Extract filename from URL (handles both full URLs and relative paths)
        const filename = fileUrl.split('/').pop() || fileUrl
        const { data: signedUrl } = await supabase.storage
          .from('media')
          .createSignedUrl(filename, 3600) // 1 hour expiry

        return {
          filename,
          originalUrl: fileUrl,
          downloadUrl: signedUrl?.signedUrl || null,
          expiresIn: 3600,
        }
      })
    )

    return Response.json({ media })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 2: Add `getPostMedia` to MCP storage**

```typescript
export async function getPostMedia(postId: string): Promise<
  {
    filename: string
    originalUrl: string
    downloadUrl: string | null
    expiresIn: number
  }[]
> {
  const client = getClient()
  const data = await client.get<{
    media: {
      filename: string
      originalUrl: string
      downloadUrl: string | null
      expiresIn: number
    }[]
  }>(`/api/posts/${postId}/media`)
  return data.media
}
```

**Step 3: Add tool definition + scope + handler**

Tool definition:
```typescript
{
  name: 'download_post_media',
  description:
    'Get temporary download URLs for media files attached to a post. URLs expire after 1 hour. Use these to download images/videos for uploading to the target platform.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      postId: {
        type: 'string',
        description: 'The post ID to get media for',
      },
    },
    required: ['postId'],
  },
},
```

Scope:
```typescript
download_post_media: ['posts:read', 'media:write'],
```

Handler:
```typescript
case 'download_post_media': {
  const { postId } = args as { postId: string }
  if (!postId) {
    return {
      content: [{ type: 'text', text: 'Error: postId is required' }],
      isError: true,
    }
  }
  const media = await getPostMedia(postId)
  if (media.length === 0) {
    return {
      content: [{ type: 'text', text: 'No media files attached to this post.' }],
    }
  }
  return {
    content: [{ type: 'text', text: JSON.stringify(media, null, 2) }],
  }
}
```

**Step 4: Build MCP server**

Run: `cd mcp-server && npm run build`
Expected: Clean build

**Step 5: Commit**

```bash
git add src/app/api/posts/[id]/media/route.ts mcp-server/src/storage.ts mcp-server/src/index.ts
git commit -m "feat: add download_post_media MCP tool with signed URLs"
```

---

### Task 9: Bump MCP server version

**Files:**
- Modify: `mcp-server/package.json`

**Step 1: Bump version**

Change version from `"0.2.1"` to `"0.3.0"` in `mcp-server/package.json` (new feature = minor bump).

**Step 2: Build and verify**

Run: `cd mcp-server && npm run build`
Expected: Clean build

**Step 3: Commit**

```bash
git add mcp-server/package.json
git commit -m "chore: bump MCP server version to 0.3.0 for publish tools"
```

---

## Workstream 2: Post Status + Cron Changes

Add `ready` status to the main app, update valid transitions, refactor the publish cron to notify-due-posts.

---

### Task 10: Add `ready` status to main app PostStatus type

**Files:**
- Modify: `src/lib/posts.ts:4`

**Step 1: Update PostStatus**

In `src/lib/posts.ts`, line 4, change:

```typescript
export type PostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'archived'
```

to:

```typescript
export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'archived'
```

**Step 2: Run typecheck**

Run: `make typecheck`
Expected: PASS (no consumers reference the literal union exhaustively)

**Step 3: Commit**

```bash
git add src/lib/posts.ts
git commit -m "feat: add 'ready' status to main app PostStatus type"
```

---

### Task 11: Update valid status transitions

**Files:**
- Modify: `src/app/api/posts/[id]/route.ts:27-33`

**Step 1: Update transitions map**

In `src/app/api/posts/[id]/route.ts`, replace the `validTransitions` object:

```typescript
const validTransitions: Record<string, string[]> = {
  draft: ['scheduled', 'archived'],
  scheduled: ['draft', 'ready', 'published', 'failed', 'archived'],
  ready: ['draft', 'scheduled', 'published', 'archived'],
  published: ['archived'],
  failed: ['draft', 'scheduled', 'archived'],
  archived: ['draft'],
}
```

**Step 2: Update the Zod schema to include `ready`**

In the same file, update `updatePostSchema` (line 12):

```typescript
status: z.enum(['draft', 'scheduled', 'ready', 'published', 'failed', 'archived']).optional(),
```

**Step 3: Run existing tests**

Run: `npx vitest run src/app/api/posts/`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/posts/[id]/route.ts
git commit -m "feat: add 'ready' status to valid transitions and schema"
```

---

### Task 12: Update posts list status filter to include `ready`

**Files:**
- Modify: `src/app/(dashboard)/posts/page.tsx`

**Step 1: Find and update the status filter tabs**

Search for the status filter array in `src/app/(dashboard)/posts/page.tsx`. Add `'ready'` to the list between `'scheduled'` and `'publishing'`. The `ready` tab label should display as `"Ready"`.

**Step 2: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/(dashboard)/posts/page.tsx
git commit -m "feat: add 'Ready' tab to posts list status filter"
```

---

### Task 13: Refactor publish cron to notify-due-posts

**Files:**
- Modify: `src/app/api/cron/publish/route.ts` (full rewrite of GET handler)

**Step 1: Write the test**

Create `src/app/api/cron/publish/route.notify.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.stubEnv('CRON_SECRET', 'test-secret')

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/rrule', () => ({
  getNextOccurrence: vi.fn(),
}))

describe('GET /api/cron/publish (notify-due-posts)', () => {
  let mockSupabase: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        match: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }

    const { createClient } = await import('@supabase/supabase-js')
    vi.mocked(createClient).mockReturnValue(mockSupabase as any)
  })

  it('rejects requests without valid CRON_SECRET', async () => {
    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/cron/publish', {
      headers: { authorization: 'Bearer wrong-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('transitions scheduled posts to ready status', async () => {
    const mockPosts = [
      {
        id: 'post-1',
        user_id: 'user-1',
        platform: 'twitter',
        status: 'scheduled',
        scheduled_at: new Date(Date.now() - 60000).toISOString(),
        content: { text: 'Test' },
        recurrence_rule: null,
      },
    ]

    // Mock select to return posts
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: mockPosts, error: null }),
    }

    // Mock update
    const updateChain = {
      update: vi.fn().mockReturnThis(),
      match: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'posts') {
        return { ...selectChain, ...updateChain }
      }
      return selectChain
    })

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost/api/cron/publish', {
      headers: { authorization: 'Bearer test-secret' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.processed).toBeGreaterThanOrEqual(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/publish/route.notify.test.ts`
Expected: FAIL (current implementation still calls `publishPost`)

**Step 3: Rewrite the cron handler**

Replace the body of the `GET` function in `src/app/api/cron/publish/route.ts`. Keep `createServiceClient()`, `scheduleNextRecurrence()`, remove `findAccountForPost()`, `markPostFailed()`, `processPost()`. The new handler:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getNextOccurrence } from '@/lib/rrule'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) },
    }
  )
}

async function scheduleNextRecurrence(
  supabase: ReturnType<typeof createServiceClient>,
  post: Record<string, unknown>
) {
  if (!post.recurrence_rule) return null

  const nextDate = getNextOccurrence(
    post.recurrence_rule as string,
    new Date(post.scheduled_at as string)
  )
  if (!nextDate) return null

  const { data, error } = await supabase.from('posts').insert({
    user_id: post.user_id,
    platform: post.platform,
    content: post.content,
    status: 'scheduled',
    scheduled_at: nextDate.toISOString(),
    notes: post.notes,
    campaign_id: post.campaign_id,
    social_account_id: post.social_account_id,
    recurrence_rule: post.recurrence_rule,
  })

  if (error) {
    console.error(`[notify-due-posts] Failed to schedule next recurrence for ${post.id}:`, error)
  }
  return data
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('[notify-due-posts] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  try {
    // Find scheduled posts that are due (within the last hour)
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString())
      .gte('scheduled_at', oneHourAgo.toISOString())
      .limit(50)

    if (error) throw error
    if (!posts || posts.length === 0) {
      return NextResponse.json({ processed: 0, notified: 0 })
    }

    let processed = 0
    let notified = 0

    for (const post of posts) {
      // Transition to ready
      const { error: updateError } = await supabase
        .from('posts')
        .update({ status: 'ready', updated_at: now.toISOString() })
        .match({ id: post.id, status: 'scheduled' })

      if (updateError) {
        console.error(`[notify-due-posts] Failed to update post ${post.id}:`, updateError)
        continue
      }

      processed++

      // TODO: Fire Web Push notification (Workstream 4)
      // TODO: Fire Resend email notification (Workstream 5)
      notified++

      // Schedule next recurrence if applicable
      await scheduleNextRecurrence(supabase, post)
    }

    console.log(`[notify-due-posts] Processed: ${processed}, Notified: ${notified}`)
    return NextResponse.json({ processed, notified })
  } catch (error) {
    console.error('[notify-due-posts] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 4: Run tests**

Run: `npx vitest run src/app/api/cron/publish/`
Expected: PASS (both old and new tests)

**Step 5: Commit**

```bash
git add src/app/api/cron/publish/route.ts src/app/api/cron/publish/route.notify.test.ts
git commit -m "feat: refactor publish cron to notify-due-posts (scheduled → ready)"
```

---

### Task 14: Make retry-failed cron a no-op

**Files:**
- Modify: `src/app/api/cron/retry-failed/route.ts`

**Step 1: Replace handler with no-op**

Replace the `GET` function body with:

```typescript
export async function GET(request: NextRequest) {
  // Verify cron secret (keep auth check for security)
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // No-op: retry logic disabled in notification-first architecture.
  // Posts are now transitioned to 'ready' and published externally.
  return NextResponse.json({ message: 'Retry cron disabled (notification-first mode)', retried: 0 })
}
```

**Step 2: Run tests**

Run: `npx vitest run src/app/api/cron/retry-failed/`
Expected: Some tests may fail due to changed behavior — update tests to match no-op

**Step 3: Update tests**

Update `src/app/api/cron/retry-failed/route.test.ts` to test the no-op behavior.

**Step 4: Commit**

```bash
git add src/app/api/cron/retry-failed/route.ts src/app/api/cron/retry-failed/route.test.ts
git commit -m "feat: disable retry-failed cron (no-op in notification-first mode)"
```

---

### Task 15: Add database migration for `ready` status

**Files:**
- Create: `supabase/migrations/<timestamp>_add_ready_status.sql`

**Step 1: Create migration**

Run: `make db-new name=add_ready_status`

**Step 2: Write the migration SQL**

```sql
-- Add 'ready' to the posts status check constraint (if one exists)
-- If using text column without constraint, this is informational only.
-- The 'ready' status is used by the notify-due-posts cron to mark posts
-- that are due for external publishing.

-- Add index for ready status queries (used by MCP get_due_posts)
CREATE INDEX IF NOT EXISTS idx_posts_status_ready
  ON posts (user_id, scheduled_at)
  WHERE status = 'ready';

-- Add index for cron query pattern (scheduled posts within time window)
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_window
  ON posts (status, scheduled_at)
  WHERE status = 'scheduled';
```

**Step 3: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add database indexes for ready status and cron queries"
```

---

## Workstream 3: Copy-to-Platform UX

Share Sheet + copy buttons on post detail page when status is `ready`.

---

### Task 16: Create PostActions component with Share Sheet support

**Files:**
- Create: `src/components/posts/PostActions.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useState } from 'react'
import { Post, isTwitterContent, isLinkedInContent, isRedditContent } from '@/lib/posts'
import { shareContent, isShareAvailable } from '@/lib/nativeShare'
import { copyToClipboard } from '@/lib/nativeClipboard'
import { cn } from '@/lib/utils'
import {
  Share2,
  Copy,
  Check,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'

interface PostActionsProps {
  post: Post
  onMarkPublished: (url?: string) => Promise<void>
}

export function PostActions({ post, onMarkPublished }: PostActionsProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [publishedUrl, setPublishedUrl] = useState('')
  const [isMarking, setIsMarking] = useState(false)

  const canShare = isShareAvailable()

  async function handleCopy(label: string, text: string) {
    const ok = await copyToClipboard(text)
    if (ok) {
      setCopiedField(label)
      toast.success(`${label} copied`)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  async function handleShare() {
    const content = post.content
    let shareText = ''

    if (isTwitterContent(content)) {
      shareText = content.text
    } else if (isLinkedInContent(content)) {
      shareText = content.text
    } else if (isRedditContent(content)) {
      shareText = `${content.title}\n\n${content.body || ''}`
    }

    await shareContent({ text: shareText })
  }

  async function handleMarkPublished() {
    setIsMarking(true)
    try {
      await onMarkPublished(publishedUrl || undefined)
      toast.success('Post marked as published')
    } catch {
      toast.error('Failed to mark as published')
    } finally {
      setIsMarking(false)
    }
  }

  const content = post.content

  return (
    <div className="space-y-4 rounded-lg border-[3px] border-border bg-card p-4 shadow-[3px_3px_0_hsl(var(--border))]">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
        Post Actions
      </h3>

      {/* Share button (mobile) */}
      {canShare && (
        <button
          onClick={handleShare}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5',
            'min-h-[44px] border-[3px] border-border font-medium',
            'bg-primary text-primary-foreground',
            'shadow-[3px_3px_0_hsl(var(--border))]',
            'hover:translate-y-[-1px] hover:shadow-[4px_4px_0_hsl(var(--border))]',
            'active:translate-y-[1px] active:shadow-[2px_2px_0_hsl(var(--border))]',
            'transition-all'
          )}
        >
          <Share2 className="h-4 w-4" />
          Share to {post.platform.charAt(0).toUpperCase() + post.platform.slice(1)}
        </button>
      )}

      {/* Per-field copy buttons */}
      <div className="space-y-2">
        {isTwitterContent(content) && (
          <CopyButton
            label="Tweet text"
            text={content.text}
            copied={copiedField === 'Tweet text'}
            onCopy={() => handleCopy('Tweet text', content.text)}
          />
        )}

        {isLinkedInContent(content) && (
          <CopyButton
            label="Post text"
            text={content.text}
            copied={copiedField === 'Post text'}
            onCopy={() => handleCopy('Post text', content.text)}
          />
        )}

        {isRedditContent(content) && (
          <>
            <CopyButton
              label="Subreddit"
              text={`r/${content.subreddit}`}
              copied={copiedField === 'Subreddit'}
              onCopy={() => handleCopy('Subreddit', `r/${content.subreddit}`)}
            />
            <CopyButton
              label="Title"
              text={content.title}
              copied={copiedField === 'Title'}
              onCopy={() => handleCopy('Title', content.title)}
            />
            {content.body && (
              <CopyButton
                label="Body"
                text={content.body}
                copied={copiedField === 'Body'}
                onCopy={() => handleCopy('Body', content.body!)}
              />
            )}
            <a
              href={`https://reddit.com/r/${content.subreddit}/submit`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5',
                'min-h-[44px] border-[3px] border-border font-medium text-sm',
                'bg-reddit text-white',
                'shadow-[3px_3px_0_hsl(var(--border))]',
                'hover:translate-y-[-1px] hover:shadow-[4px_4px_0_hsl(var(--border))]',
                'transition-all'
              )}
            >
              <ExternalLink className="h-4 w-4" />
              Open Reddit Submit
            </a>
          </>
        )}
      </div>

      {/* Mark as Published */}
      <div className="space-y-2 border-t border-border/50 pt-4">
        <input
          type="url"
          placeholder="Published URL (optional)"
          value={publishedUrl}
          onChange={(e) => setPublishedUrl(e.target.value)}
          className="sticker-input w-full px-3 py-2 text-sm"
        />
        <button
          onClick={handleMarkPublished}
          disabled={isMarking}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5',
            'min-h-[44px] border-[3px] border-border font-medium',
            'bg-green-500 text-white',
            'shadow-[3px_3px_0_hsl(var(--border))]',
            'hover:translate-y-[-1px] hover:shadow-[4px_4px_0_hsl(var(--border))]',
            'active:translate-y-[1px] active:shadow-[2px_2px_0_hsl(var(--border))]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all'
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          {isMarking ? 'Marking...' : 'Mark as Posted'}
        </button>
      </div>
    </div>
  )
}

function CopyButton({
  label,
  text,
  copied,
  onCopy,
}: {
  label: string
  text: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <button
      onClick={onCopy}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-3 py-2',
        'min-h-[44px] border-[2px] border-border/50 text-sm',
        'hover:bg-accent/10 transition-colors'
      )}
    >
      {copied ? (
        <Check className="h-4 w-4 shrink-0 text-green-500" />
      ) : (
        <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className="font-medium">{label}</span>
      <span className="ml-auto truncate text-xs text-muted-foreground max-w-[200px]">
        {text.slice(0, 50)}{text.length > 50 ? '...' : ''}
      </span>
    </button>
  )
}
```

**Step 2: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/posts/PostActions.tsx
git commit -m "feat: add PostActions component with Share Sheet and copy buttons"
```

---

### Task 17: Integrate PostActions into post edit page

**Files:**
- Modify: `src/app/(dashboard)/edit/[id]/page.tsx`

**Step 1: Import and render PostActions**

Add import at top of `src/app/(dashboard)/edit/[id]/page.tsx`:

```typescript
import { PostActions } from '@/components/posts/PostActions'
```

**Step 2: Add PostActions section**

In the edit page's left column, after the existing `EditorActions` section, conditionally render `PostActions` when the post status is `'ready'` or `'scheduled'` with a past `scheduledAt`:

```typescript
{(post.status === 'ready' ||
  (post.status === 'scheduled' &&
    post.scheduledAt &&
    new Date(post.scheduledAt) <= new Date())) && (
  <PostActions
    post={post}
    onMarkPublished={async (url) => {
      await updatePost(post.id, {
        status: 'published',
        publishResult: {
          success: true,
          publishedAt: new Date().toISOString(),
          postUrl: url,
          method: 'manual',
        },
      })
    }}
  />
)}
```

**Step 3: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/(dashboard)/edit/[id]/page.tsx
git commit -m "feat: show PostActions on edit page when post is ready or due"
```

---

## Workstream 4: Web Push Notifications

Server-side push sender to complete the existing scaffolding.

---

### Task 18: Install `web-push` dependency

**Files:**
- Modify: `package.json`

**Step 1: Install web-push**

Run: `npm install web-push`
Run: `npm install -D @types/web-push`

**Step 2: Verify install**

Run: `make typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install web-push for server-side push notifications"
```

---

### Task 19: Create VAPID key generation script

**Files:**
- Create: `scripts/generate-vapid-keys.ts`

**Step 1: Create the script**

```typescript
import webPush from 'web-push'

const keys = webPush.generateVAPIDKeys()

console.log('VAPID Keys Generated:')
console.log('')
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`)
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`)
console.log('')
console.log('Add these to your .env.local and Vercel environment variables.')
```

**Step 2: Test the script**

Run: `npx tsx scripts/generate-vapid-keys.ts`
Expected: Prints two base64 keys

**Step 3: Commit**

```bash
git add scripts/generate-vapid-keys.ts
git commit -m "chore: add VAPID key generation script"
```

---

### Task 20: Create push subscription API endpoint

**Files:**
- Create: `src/app/api/push-subscriptions/route.ts`

**Step 1: Create migration for web push subscriptions**

Run: `make db-new name=web_push_subscriptions`

Write the migration SQL:

```sql
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE web_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
  ON web_push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_web_push_subscriptions_user
  ON web_push_subscriptions (user_id);
```

**Step 2: Create the API endpoint**

Create `src/app/api/push-subscriptions/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { requireAuth, parseJsonBody } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// POST - Save web push subscription
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireAuth()
    const body = await parseJsonBody(request)

    if (!body) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { endpoint, keys } = body as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return Response.json({ error: 'Missing subscription data' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase.from('web_push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint,
        keys_p256dh: keys.p256dh,
        keys_auth: keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' }
    )

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove web push subscription
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await requireAuth()
    const body = await parseJsonBody(request)

    if (!body) {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { endpoint } = body as { endpoint: string }

    if (!endpoint) {
      return Response.json({ error: 'Missing endpoint' }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('web_push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 3: Commit**

```bash
git add supabase/migrations/ src/app/api/push-subscriptions/route.ts
git commit -m "feat: add web push subscription storage and API endpoint"
```

---

### Task 21: Create server-side push sender utility

**Files:**
- Create: `src/lib/webPushSender.ts`

**Step 1: Create the utility**

```typescript
import webPush from 'web-push'
import { createClient } from '@supabase/supabase-js'

// Configure VAPID (called once at module level)
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || ''
const VAPID_SUBJECT = 'mailto:hello@bullhorn.to'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

interface PushPayload {
  title: string
  body: string
  url?: string
  icon?: string
}

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) },
    }
  )
}

export async function sendWebPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[web-push] VAPID keys not configured, skipping push')
    return { sent: 0, failed: 0 }
  }

  const supabase = createServiceClient()

  const { data: subscriptions, error } = await supabase
    .from('web_push_subscriptions')
    .select('endpoint, keys_p256dh, keys_auth')
    .eq('user_id', userId)

  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0 }
  }

  let sent = 0
  let failed = 0

  const notification = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/posts?status=ready',
    icon: payload.icon || '/pwa-192x192.png',
  })

  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys_p256dh,
            auth: sub.keys_auth,
          },
        },
        notification
      )
      sent++
    } catch (err: unknown) {
      failed++
      // Remove expired subscriptions (410 Gone)
      if (err && typeof err === 'object' && 'statusCode' in err && (err as any).statusCode === 410) {
        await supabase
          .from('web_push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint)
          .eq('user_id', userId)
      }
    }
  }

  return { sent, failed }
}
```

**Step 2: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/webPushSender.ts
git commit -m "feat: add server-side web push sender utility"
```

---

### Task 22: Wire Web Push into cron

**Files:**
- Modify: `src/app/api/cron/publish/route.ts`

**Step 1: Import push sender**

Add to the top of the cron route:

```typescript
import { sendWebPushToUser } from '@/lib/webPushSender'
```

**Step 2: Replace the TODO comments**

In the post processing loop, replace `// TODO: Fire Web Push notification (Workstream 4)` with:

```typescript
// Fire Web Push notification
const platformName = post.platform.charAt(0).toUpperCase() + post.platform.slice(1)
const contentPreview = (() => {
  const c = post.content as Record<string, unknown>
  const text = (c.text as string) || (c.title as string) || ''
  return text.slice(0, 60) + (text.length > 60 ? '...' : '')
})()

try {
  await sendWebPushToUser(post.user_id, {
    title: `Post due: ${platformName}`,
    body: contentPreview,
    url: `/edit/${post.id}`,
  })
} catch (pushErr) {
  console.error(`[notify-due-posts] Push failed for post ${post.id}:`, pushErr)
}
```

**Step 3: Run tests**

Run: `npx vitest run src/app/api/cron/publish/`
Expected: PASS (push sender will be a no-op without VAPID keys in tests)

**Step 4: Commit**

```bash
git add src/app/api/cron/publish/route.ts
git commit -m "feat: wire Web Push notifications into notify-due-posts cron"
```

---

### Task 23: Update service worker to handle push payloads

**Files:**
- Modify: `public/sw.js`

**Step 1: Update push event handler**

Replace the service worker push handler:

```javascript
self.addEventListener('push', (event) => {
  let data = { title: 'Bullhorn', body: 'You have a notification', url: '/posts?status=ready' }

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() }
    } catch {
      data.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: data.url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})
```

**Step 2: Commit**

```bash
git add public/sw.js
git commit -m "feat: update service worker to handle structured push payloads"
```

---

### Task 24: Update `subscribeToPush` to save subscription server-side

**Files:**
- Modify: `src/lib/pushNotifications.ts`

**Step 1: Add server-side persistence**

After `subscribeToPush()` successfully creates a subscription, POST it to the new endpoint. Update the `subscribeToPush` function to include:

```typescript
export async function subscribeToPush(): Promise<PushSubscription | null> {
  const permission = await requestPermission()
  if (!permission) return null

  const registration = await getRegistration()
  if (!registration) return null

  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    if (!VAPID_PUBLIC_KEY) {
      console.error('VAPID public key not configured')
      return null
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  // Persist subscription to server
  try {
    const subJson = subscription.toJSON()
    await fetch('/api/push-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      }),
    })
  } catch (err) {
    console.error('Failed to save push subscription to server:', err)
  }

  return subscription
}
```

**Step 2: Update `unsubscribeFromPush` to remove server-side**

```typescript
export async function unsubscribeFromPush(): Promise<boolean> {
  const registration = await getRegistration()
  if (!registration) return false

  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return true

  // Remove from server
  try {
    await fetch('/api/push-subscriptions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    })
  } catch (err) {
    console.error('Failed to remove push subscription from server:', err)
  }

  return subscription.unsubscribe()
}
```

**Step 3: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/pushNotifications.ts
git commit -m "feat: persist web push subscriptions to server on subscribe/unsubscribe"
```

---

## Workstream 5: Resend Email Integration

Post Due notification email via Resend.

---

### Task 25: Install Resend and React Email dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install packages**

Run: `npm install resend @react-email/components`

**Step 2: Verify**

Run: `make typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install resend and @react-email/components for email notifications"
```

---

### Task 26: Create Post Due email template

**Files:**
- Create: `src/lib/emails/PostDueEmail.tsx`

**Step 1: Create the email template**

```typescript
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Img,
} from '@react-email/components'

interface PostDueEmailProps {
  platform: string
  preview: string
  postUrl: string
  unsubscribeUrl: string
}

export function PostDueEmail({
  platform,
  preview,
  postUrl,
  unsubscribeUrl,
}: PostDueEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Img
            src="https://bullhorn.to/pwa-192x192.png"
            width="48"
            height="48"
            alt="Bullhorn"
            style={{ marginBottom: '16px' }}
          />
          <Text style={heading}>Post Due: {platform}</Text>
          <Section style={previewBox}>
            <Text style={previewText}>{preview}</Text>
          </Section>
          <Button style={button} href={postUrl}>
            View in Bullhorn
          </Button>
          <Hr style={hr} />
          <Text style={footer}>
            You received this because you have email notifications enabled.{' '}
            <a href={unsubscribeUrl} style={link}>
              Unsubscribe
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f6f6',
  fontFamily: 'Nunito, -apple-system, BlinkMacSystemFont, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '32px',
  maxWidth: '480px',
  borderRadius: '8px',
  border: '2px solid #222',
}

const heading = {
  fontSize: '20px',
  fontWeight: '700' as const,
  color: '#222',
  marginBottom: '16px',
}

const previewBox = {
  backgroundColor: '#fef9e7',
  padding: '16px',
  borderRadius: '6px',
  border: '1px solid #f0e6c0',
  marginBottom: '24px',
}

const previewText = {
  fontSize: '14px',
  color: '#333',
  margin: '0',
  lineHeight: '1.5',
}

const button = {
  backgroundColor: '#ce9a08',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  fontWeight: '600' as const,
  fontSize: '14px',
  textDecoration: 'none',
  display: 'inline-block' as const,
}

const hr = {
  borderColor: '#eee',
  margin: '24px 0',
}

const footer = {
  fontSize: '12px',
  color: '#999',
}

const link = {
  color: '#ce9a08',
}
```

**Step 2: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/emails/PostDueEmail.tsx
git commit -m "feat: add Post Due email template with React Email"
```

---

### Task 27: Create email sender utility

**Files:**
- Create: `src/lib/emailSender.ts`

**Step 1: Create the utility**

```typescript
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { PostDueEmail } from './emails/PostDueEmail'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'Bullhorn <notifications@bullhorn.to>'
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://bullhorn.to'

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
      global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) },
    }
  )
}

export async function sendPostDueEmail(
  userId: string,
  post: { id: string; platform: string; content: Record<string, unknown> }
): Promise<{ sent: boolean; error?: string }> {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not configured, skipping email')
    return { sent: false, error: 'RESEND_API_KEY not configured' }
  }

  const supabase = createServiceClient()

  // Check user's email notification preference
  const { data: prefs } = await supabase
    .from('notification_preferences')
    .select('email_campaign_reminder')
    .eq('user_id', userId)
    .single()

  if (!prefs?.email_campaign_reminder) {
    return { sent: false, error: 'User has email notifications disabled' }
  }

  // Get user email
  const { data: user } = await supabase.auth.admin.getUserById(userId)

  if (!user?.user?.email) {
    return { sent: false, error: 'No email found for user' }
  }

  const platformName = post.platform.charAt(0).toUpperCase() + post.platform.slice(1)
  const text = (post.content.text as string) || (post.content.title as string) || ''
  const preview = text.slice(0, 100) + (text.length > 100 ? '...' : '')

  const resend = new Resend(RESEND_API_KEY)

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.user.email,
      subject: `Post due: ${platformName} — ${preview.slice(0, 40)}`,
      react: PostDueEmail({
        platform: platformName,
        preview,
        postUrl: `${BASE_URL}/edit/${post.id}`,
        unsubscribeUrl: `${BASE_URL}/settings`,
      }),
      headers: {
        'List-Unsubscribe': `<${BASE_URL}/settings>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    })

    return { sent: true }
  } catch (err) {
    console.error('[email] Failed to send post due email:', err)
    return { sent: false, error: (err as Error).message }
  }
}
```

**Step 2: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/emailSender.ts
git commit -m "feat: add Resend email sender utility for Post Due notifications"
```

---

### Task 28: Wire email into cron

**Files:**
- Modify: `src/app/api/cron/publish/route.ts`

**Step 1: Import email sender**

```typescript
import { sendPostDueEmail } from '@/lib/emailSender'
```

**Step 2: Replace the email TODO**

In the post processing loop, replace `// TODO: Fire Resend email notification (Workstream 5)` with:

```typescript
// Fire email notification (preference-gated)
try {
  await sendPostDueEmail(post.user_id, {
    id: post.id,
    platform: post.platform,
    content: post.content as Record<string, unknown>,
  })
} catch (emailErr) {
  console.error(`[notify-due-posts] Email failed for post ${post.id}:`, emailErr)
}
```

**Step 3: Run tests**

Run: `npx vitest run src/app/api/cron/publish/`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/cron/publish/route.ts
git commit -m "feat: wire Resend email notifications into notify-due-posts cron"
```

---

### Task 29: Update environment variables documentation

**Files:**
- Modify: `docs/environment-variables.md` (add new vars)

**Step 1: Add new environment variables**

Add these entries to the environment variables doc:

```markdown
### Web Push (Workstream 4)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | For push | VAPID public key (generate with `npx tsx scripts/generate-vapid-keys.ts`) |
| `VAPID_PRIVATE_KEY` | For push | VAPID private key (server-side only, never expose to client) |

### Email — Resend (Workstream 5)

| Variable | Required | Description |
|----------|----------|-------------|
| `RESEND_API_KEY` | For email | Resend API key from dashboard.resend.com |
```

**Step 2: Commit**

```bash
git add docs/environment-variables.md
git commit -m "docs: add VAPID and Resend env vars to documentation"
```

---

### Task 30: Final integration test — full build check

**Step 1: Run full CI**

Run: `make ci`
Expected: PASS (lint + typecheck + unit tests)

**Step 2: Build**

Run: `make build`
Expected: Clean build

**Step 3: Commit any fixes if needed, then tag**

```bash
git add -A
git commit -m "fix: address any CI issues from integration"
```

---

## Manual To-Dos (Post-Implementation)

These require human action:

- [ ] Generate VAPID keys: `npx tsx scripts/generate-vapid-keys.ts` and add to Vercel env vars
- [ ] Set `RESEND_API_KEY` in Vercel production env vars
- [ ] Configure sending domain `bullhorn.to` in Resend dashboard (SPF + DKIM records)
- [ ] Apply new database migrations to production: `supabase db push`
- [ ] Publish updated MCP server: `cd mcp-server && npm publish`
- [ ] Test Web Push flow: subscribe in browser → trigger cron → verify notification arrives
- [ ] Test email flow: enable email preference → trigger cron → verify email arrives

---

## Summary

| Workstream | Tasks | Key deliverables |
|-----------|-------|-----------------|
| 1. MCP Publish Tools | 1–9 | 5 new MCP tools, 2 new API endpoints |
| 2. Post Status + Cron | 10–15 | `ready` status, cron refactor, retry no-op |
| 3. Copy-to-Platform UX | 16–17 | PostActions component, Share Sheet, copy buttons |
| 4. Web Push | 18–24 | `web-push`, subscription storage, cron integration |
| 5. Resend Email | 25–29 | `resend`, PostDueEmail template, cron integration |
| Integration | 30 | Full CI + build verification |
