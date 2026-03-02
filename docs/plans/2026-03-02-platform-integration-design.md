# Platform Integration Design — Notification-First Architecture

**Date**: 2026-03-02
**Status**: Approved

---

## Overview

Bullhorn shifts from an auto-publishing scheduler to a **content CMS + scheduling engine** that notifies users when posts are due. Actual publishing happens externally via Claude in Chrome (interactive browser automation), iOS Share Sheet, or manual copy/paste. The existing API publishers remain as an optional fallback.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  BULLHORN (Web App + MCP)                           │
│                                                     │
│  1. Content repository (posts, campaigns, projects) │
│  2. Media storage (Supabase)                        │
│  3. Scheduling + status transitions                 │
│  4. Notifications when content is due               │
└─────────────┬───────────────────────┬───────────────┘
              │                       │
              ▼                       ▼
   ┌──────────────────┐   ┌──────────────────────┐
   │  Bullhorn MCP    │   │  Notification System  │
   │  (content CRUD + │   │  (Web Push + Resend)  │
   │   publish tools) │   │                       │
   └────────┬─────────┘   └───────────┬───────────┘
            │                         │
            ▼                         ▼
   ┌──────────────────────────────────────────────┐
   │  Publishing (external to Bullhorn)           │
   │                                              │
   │  • Claude in Chrome (desktop, interactive)   │
   │  • iOS Share Sheet (mobile)                  │
   │  • Manual copy/paste                         │
   │  • API publishers (optional fallback)        │
   └──────────────────────────────────────────────┘
```

---

## Workstream 1: Post Status + Cron Changes

### New post status lifecycle

```
draft → scheduled → ready → published
```

- **`ready`**: New status. Means "this post is due and waiting for someone to post it."
- Cron `publish` job becomes `notify-due-posts`. It transitions `scheduled → ready` and fires notifications.
- `publishing` and `failed` statuses remain in the schema for backward compatibility but are not used in the new flow.
- `retry-failed` cron becomes a no-op (can be removed or kept dormant).
- `refresh-tokens` cron stays (useful if API publishers are used as fallback).

### Cron `notify-due-posts` behavior

1. Query posts where `status = 'scheduled'` AND `scheduled_at <= now` AND `scheduled_at >= now - 1h`
2. For each post:
   - Set `status = 'ready'`
   - Fire Web Push notification
   - Fire Resend email (if preference enabled)
3. If post has `recurrence_rule`, create next scheduled copy
4. Return `{ processed, notified }` counts

---

## Workstream 2: MCP Publish Tools

Five new tools added to `@neonwatty/bullhorn-mcp`:

### `get_due_posts`

Returns posts where `status = 'ready'` (or `status = 'scheduled'` and `scheduled_at <= now`).

Response (lightweight):
```json
[{
  "id": "uuid",
  "platform": "twitter",
  "scheduledAt": "2026-03-02T14:00:00Z",
  "preview": "First 100 chars of content...",
  "hasMedia": true
}]
```

### `get_post_for_publish`

Input: `postId`

Returns full content pre-formatted for the target platform:

**Twitter**:
```json
{
  "platform": "twitter",
  "text": "Full text",
  "threadChunks": ["Chunk 1 (280 chars)", "Chunk 2..."],
  "mediaUrls": ["/api/media/uuid1.jpg", "/api/media/uuid2.mp4"]
}
```

**LinkedIn**:
```json
{
  "platform": "linkedin",
  "text": "Full text",
  "visibility": "public",
  "mediaUrls": ["/api/media/uuid1.jpg"]
}
```

**Reddit**:
```json
{
  "platform": "reddit",
  "subreddit": "machinelearning",
  "title": "Post title",
  "body": "Post body text",
  "flairText": "Discussion",
  "mediaUrls": ["/api/media/uuid1.png"]
}
```

### `download_post_media`

Input: `postId` or `mediaFilename`

Returns a temporary download URL (or base64-encoded file data) for media files associated with the post. Claude in Chrome uses this to download images/videos and upload them to the platform's native form.

### `mark_post_published`

Input: `postId`, `publishedUrl` (optional), `platformPostId` (optional)

Sets `status = 'published'`, stores URL in `publish_result`, sets `publishedAt` timestamp.

### `get_upcoming_schedule`

Input: `hours` (default: 24)

Returns posts with `status = 'scheduled'` due within the next N hours. For planning sessions.

---

## Workstream 3: Notification Channels

### Web Push (real-time)

**Existing scaffolding**:
- `src/lib/pushNotifications.ts` — subscription management, VAPID key handling
- Service worker registration at `/sw.js`
- `push_device_tokens` table for storing subscriptions
- `AppDelegate.swift` — native notification center setup

**To build**:
- Server-side push sender using `web-push` npm package
- VAPID key pair generation + storage in env vars (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)
- Push subscription storage (extend `push_device_tokens` or new `push_subscriptions` table for Web Push)
- Notification payload: `{ title: "Post due: r/machinelearning", body: "Discussion: Your ML post title...", url: "/posts?status=ready" }`

**Coverage**: Browser (desktop + mobile) + iOS app (WKWebView with Safari Web Push support)

### Resend Email (fallback)

**Setup**:
- `resend` npm package
- Sending domain: `bullhorn.to` (SPF + DKIM DNS records via Resend dashboard)
- Env var: `RESEND_API_KEY`

**Single email type — Post Due**:
- Trigger: Cron `notify-due-posts` fires when a scheduled post becomes due
- Content: Platform icon, content preview (first 100 chars), "View in Bullhorn" link
- Template: Minimal HTML via `@react-email/components` (type-safe, in-codebase)
- Preference-gated: Only sent if `notification_preferences.email_campaign_reminder = true`
- Unsubscribe: One-click unsubscribe header + link (CAN-SPAM compliance)

### Channel comparison (for reference)

| Channel | Real-time | Works offline | Reliability | Effort | Cost |
|---------|-----------|---------------|-------------|--------|------|
| Web Push | Yes | Yes (if SW registered) | Good | Medium | Free |
| APNs | Yes | Yes | Excellent | High | Free (needs Apple cert) |
| Resend email | No (delayed) | Yes | Excellent | Low | Included in Pro |
| Local notifications | Only when app open | No | Good | Already built | Free |

APNs was evaluated but deferred — Web Push covers iOS via WKWebView, and APNs requires additional Apple certificate setup and a dedicated sending service. Can be added later if Web Push proves insufficient on iOS.

---

## Workstream 4: Copy-to-Platform UX

### Mobile (iOS app + mobile web)

**Primary**: Web Share API (`navigator.share()`) triggers the native iOS Share Sheet.

Per-platform share payloads:
- **Twitter**: `{ text: "post text here" }` → opens Twitter compose with text pre-filled
- **LinkedIn**: `{ text: "post text", url: "optional link" }` → opens LinkedIn new post
- **Reddit**: Limited Share Sheet support. Fallback to per-field copy buttons:
  - "Copy subreddit" → `r/machinelearning`
  - "Copy title" → post title
  - "Copy body" → post body
  - "Open Reddit" → deep link to `reddit.com/r/{subreddit}/submit`

**UI**: New "Post Actions" section on the post detail page (visible when `status = 'ready'`):
- "Share to [Platform]" button (triggers Share Sheet)
- Per-field copy buttons (always visible for Reddit, hidden behind "Copy fields" toggle for Twitter/LinkedIn)
- "Mark as Posted" button (updates status to `published`)
- Optional: "Posted URL" text input to record where it was published

### Desktop (web browser)

Web Share API has limited desktop support. Desktop UX shows:
- Per-field copy buttons for all platforms
- "Mark as Posted" button with optional URL input
- Desktop workflow is primarily Claude in Chrome anyway

---

## What's NOT Changing

- **Existing API publishers** (`src/lib/publishers/twitter.ts`, `linkedin.ts`, `reddit.ts`) stay in the codebase as optional fallback. Not removed.
- **Reminders system** stays independent. Post-due notifications are a separate channel.
- **Media upload to Supabase Storage** stays the same. Media is stored in Bullhorn, downloaded by the publishing agent.
- **OAuth connections** stay. Token refresh cron stays. Useful for MCP direct API fallback.
- **Post data model** unchanged (content JSONB structure stays the same). Only `status` values expand.

---

## Implementation Order

1. **MCP publish tools** — Smallest lift, biggest immediate value for Claude Code workflow
2. **Post status + cron changes** — `ready` status, cron refactor
3. **Copy-to-platform UX** — Share Sheet + copy buttons on post detail pages
4. **Web Push notifications** — Server-side sender, complete the existing scaffolding
5. **Resend email integration** — Post Due email, domain setup, preference checking

Each workstream can be implemented, PR'd, and merged independently.
