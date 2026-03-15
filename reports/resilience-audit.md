# Resilience Audit Report — Bullhorn

**Date:** 2026-03-14
**Scope:** Full audit (all 8 categories)
**App:** Bullhorn — Social media post scheduler
**Stack:** Next.js 15 (App Router), Supabase, Zustand, Tailwind CSS, Vercel

---

## Executive Summary

**28 findings** across 8 categories: **3 Critical, 7 High, 10 Medium, 5 Low, 3 Info**

The three critical findings all relate to **data loss under realistic conditions**: new post content lost on tab close (no draft persistence), plan limits bypassable via double-click (TOCTOU race), and session expiry mid-form destroying unsaved work. These affect common user flows and have no recovery path.

The app has solid foundations — RLS enforcement, Zod validation on API routes, request deduplication, and `useUnsavedChanges` warnings. The main gaps are in **state persistence** (no localStorage drafts), **optimistic update rollback**, and **loading/error boundary coverage**.

---

## Top 3 Findings

1. **[RF-3-001] CRITICAL — New post form has no draft persistence.** User composes a post on `/new`, closes tab or session expires — all content lost. No localStorage backup, no auto-save for new posts.

2. **[RF-2-001] CRITICAL — Plan limit TOCTOU race condition.** Two concurrent create requests (double-click or multi-tab) both pass the count check and succeed, exceeding the user's plan quota.

3. **[RF-6-001] CRITICAL — Session expiry mid-form loses all data.** Session expires while editing — auto-save fails with 401 — form data exists only in React state — navigation or refresh loses everything.

---

## Category 1: Navigation & Flow Dead Ends

### [RF-1-001] Deleted resource URL renders blank page

**Severity:** High
**User Type:** Confused User

**Scenario:**
1. User bookmarks `/edit/abc123` for a post they're working on
2. Post gets deleted (by user or via archive cleanup)
3. User opens bookmark — posts store fetches, post not found
4. Editor renders with a completely blank form — no error, no 404, no guidance
5. Same behavior on `/campaigns/[id]` and `/projects/[id]`

**Code Location:**
- `src/app/(dashboard)/edit/[id]/page.tsx` — component renders without checking if post exists after fetch
- `src/app/(dashboard)/campaigns/[id]/page.tsx` — same pattern
- `src/app/(dashboard)/projects/[id]/page.tsx` — same pattern

**Recommended Fix:**
After store initialization, check if the resource exists. If not, show a helpful message: "This post was deleted or doesn't exist. [Go to Posts] [Create New Post]". Consider redirecting to the list page with a toast.

---

### [RF-1-002] OAuth denial returns silently to settings

**Severity:** Medium
**User Type:** Confused User

**Scenario:**
1. User clicks "Connect Twitter" on `/settings`
2. Redirects to Twitter OAuth consent screen
3. User clicks "Cancel" or "Deny" on Twitter
4. Browser returns to `/settings` with no query params, no toast, no indication anything happened
5. User is confused — did it work? Did it fail?

**Code Location:**
- `src/app/api/social-accounts/twitter/callback/route.ts` — handles success and error codes but not the "user denied" case specifically
- `/settings` page — no handling for returning without `?connected=` or `?error=` params

**Recommended Fix:**
Detect the denial case (Twitter returns `error=access_denied` param) and redirect to `/settings?error=denied` with a toast: "Connection cancelled. You can try again anytime."

---

### [RF-1-003] 404 page redirects to dashboard

**Severity:** Low
**User Type:** Confused User

**Scenario:**
User visits a mistyped URL like `/campaings` (typo). Instead of a helpful 404 page suggesting the correct URL, they're silently redirected to `/dashboard`.

**Code Location:**
- `src/app/not-found.tsx` — redirects to `/dashboard`

**Recommended Fix:**
Show a proper 404 page with: "Page not found. Did you mean [campaigns]? [Go to Dashboard]"

---

### [RF-1-004] No breadcrumbs in nested views

**Severity:** Low
**User Type:** Power User

**Scenario:**
User navigates to `/campaigns/[id]` — the only way back to `/campaigns` is the browser Back button or manually editing the URL. No visual breadcrumb trail exists.

**Recommended Fix:**
Add breadcrumb navigation to detail pages: `Dashboard > Campaigns > [Campaign Name]`. Low priority but improves navigation confidence.

---

## Category 2: Race Conditions & Double Actions

### [RF-2-001] Plan limit TOCTOU race condition

**Severity:** Critical
**User Type:** Confused User (double-click) / Power User (multi-tab)

**Scenario:**
1. Free-tier user has 49/50 posts (1 remaining)
2. User double-clicks "Save" on a new post, or has two tabs open creating posts
3. Both requests hit `POST /api/posts` simultaneously
4. Both call `enforceResourceLimit()` — both read count as 49
5. Both pass the `49 < 50` check
6. Both INSERT succeeds — user now has 51 posts, exceeding the 50-post limit

**Code Location:**
- `src/lib/planEnforcement.ts` — `enforceResourceLimit()` does SELECT count then returns; not atomic with INSERT
- `src/app/api/posts/route.ts` — calls `enforceResourceLimit()` before `supabase.from('posts').insert()`
- Same pattern in campaigns, projects, blog-drafts, launch-posts routes

**Recommended Fix:**
1. **Immediate**: Disable submit buttons on click with `setIsSubmitting(true)` before the API call
2. **Server-side**: Make the count check atomic with the insert using a Postgres function:
   ```sql
   CREATE FUNCTION create_post_with_limit_check(...)
   RETURNS posts AS $$
     INSERT INTO posts (...) SELECT ... WHERE (SELECT count(*) FROM posts WHERE user_id = $1) < $2
     RETURNING *;
   $$ LANGUAGE sql;
   ```
3. **Alternative**: Add a unique constraint or advisory lock on (user_id, resource_type) during creation

---

### [RF-2-002] Optimistic updates not rolled back on server rejection

**Severity:** High
**User Type:** Any User

**Scenario:**
1. User creates a campaign — store optimistically adds it to the list
2. Server rejects (e.g., name too long, plan limit hit, network error)
3. Campaign appears in the UI despite not existing on server
4. User sees it in their campaign list, tries to add posts to it
5. Any operation on the phantom campaign fails with confusing errors
6. Only a page refresh corrects the state

**Code Location:**
- `src/lib/campaigns.ts` — `addCampaign()` does `set({ campaigns: [...get().campaigns, newCampaign] })` before server response
- Same pattern in `src/lib/projects.ts`, `src/lib/blogDrafts.ts`, `src/lib/launchPosts.ts`
- Exception: `src/lib/socialAccounts.ts` — has explicit rollback on delete failure

**Recommended Fix:**
Add rollback logic to all optimistic updates:
```typescript
const previousCampaigns = get().campaigns
set({ campaigns: [...previousCampaigns, optimisticCampaign] })
try {
  const serverCampaign = await fetch(...)
  // Replace optimistic with server version
} catch {
  set({ campaigns: previousCampaigns }) // Rollback
}
```

---

### [RF-2-003] Concurrent tab edits — silent last-write-wins

**Severity:** Medium
**User Type:** Power User

**Scenario:**
1. User opens `/edit/abc123` in two tabs
2. Tab A: changes title to "Morning Post"
3. Tab B: changes content to "Hello world" (still has old title)
4. Tab A auto-saves — server has new title + old content
5. Tab B auto-saves — server now has old title + new content (overwrites Tab A's title change)
6. Neither tab knows about the conflict

**Code Location:**
- `src/hooks/useAutoSave.ts` — saves full form state, no version/ETag checking
- `src/app/api/posts/[id]/route.ts` PATCH handler — no `If-Match` or `updated_at` conflict detection

**Recommended Fix:**
Add an `updated_at` check: include the last-known `updated_at` in PATCH requests. Server compares and returns 409 Conflict if stale. Client shows: "This post was modified in another tab. [Reload] [Overwrite]".

---

### [RF-2-004] No submit button disabling on create modals

**Severity:** Medium
**User Type:** Confused User

**Scenario:**
User double-clicks "Create" on the New Campaign or New Project modal → two POST requests fire → two resources created.

**Code Location:**
- `src/components/projects/CreateProjectModal.tsx` — submit handler
- Campaign create modal — similar pattern

**Recommended Fix:**
Set `isSubmitting` state to `true` on first click, disable the button, show a spinner. Re-enable on success or error.

---

## Category 3: Interrupted Operations

### [RF-3-001] New post form has no draft persistence

**Severity:** Critical
**User Type:** Any User

**Scenario:**
1. User navigates to `/new` and spends 5-10 minutes composing a detailed post
2. User accidentally closes the tab, browser crashes, or phone runs out of battery
3. All content is permanently lost — no localStorage draft, no auto-save for new (unsaved) posts
4. `useAutoSave` is explicitly disabled for new posts (`enabled: !isNew`)
5. `useUnsavedChanges` only warns on navigation — doesn't help with tab close/crash

**Code Location:**
- `src/app/(dashboard)/new/page.tsx` — form state is React useState only
- `src/hooks/useAutoSave.ts` — `enabled: !isNew` skips auto-save for new posts

**Recommended Fix:**
1. Save draft to localStorage on every content change (debounced 1s):
   ```typescript
   useEffect(() => {
     localStorage.setItem('bullhorn-draft-new-post', JSON.stringify(formData))
   }, [formData])
   ```
2. On `/new` mount, check for existing draft and offer to restore: "You have an unsaved draft from [time]. [Restore] [Discard]"
3. Clear the draft after successful save/publish

---

### [RF-3-002] Auto-save has no retry on failure

**Severity:** High
**User Type:** Any User (mobile especially)

**Scenario:**
1. User is editing a post on mobile
2. Network briefly drops (entering elevator, WiFi handoff)
3. Auto-save fires during the dropout → request fails
4. `useAutoSave` sets `status: 'error'` — no retry, no recovery
5. User keeps editing, unaware the last save failed
6. Next auto-save trigger may or may not succeed (depends on network recovery timing)

**Code Location:**
- `src/hooks/useAutoSave.ts` — catch block sets `status: 'error'`, no retry logic

**Recommended Fix:**
Add exponential backoff retry (3 attempts: 2s, 4s, 8s). If all retries fail, show a persistent banner: "Auto-save failed. Your changes are preserved locally. [Retry Now]". Consider saving to localStorage as a fallback.

---

### [RF-3-003] Auto-save debounce window loses data on tab close

**Severity:** Medium
**User Type:** Any User

**Scenario:**
1. User makes a change to a post
2. Auto-save debounce starts (3s timer)
3. User closes tab within 3 seconds
4. `beforeunload` fires — shows browser warning — but cannot force the save
5. If user confirms close, the debounced save never fires
6. Last 3 seconds of changes are lost

**Code Location:**
- `src/hooks/useAutoSave.ts` — debounce delay of 3000ms
- `src/hooks/useUnsavedChanges.ts` — `beforeunload` handler warns but can't save

**Recommended Fix:**
Flush the debounce on `beforeunload` using `navigator.sendBeacon()` or a synchronous XHR to save the pending changes before the page unloads.

---

### [RF-3-004] Orphaned media files from deleted posts

**Severity:** Medium
**User Type:** N/A (system issue)

**Scenario:**
1. User uploads images to a post (stored in Supabase Storage at `{userId}/{uuid}.jpg`)
2. User deletes the post
3. Media files remain in storage — never cleaned up
4. Over time, storage usage grows with orphaned files
5. User's storage quota fills with files they can't see or manage

**Code Location:**
- `src/app/api/posts/[id]/route.ts` DELETE handler — deletes the post record but not associated media
- `src/lib/storage.ts` — no cleanup function for post media

**Recommended Fix:**
On post deletion, query the post's media URLs and delete them from Supabase Storage. Or implement a periodic cleanup cron that finds storage files not referenced by any post.

---

## Category 4: Cross-Device & Cross-Session

### [RF-4-001] No cross-tab auth sync

**Severity:** High
**User Type:** Power User

**Scenario:**
1. User has Bullhorn open in tabs A and B
2. User logs out in tab A
3. Tab B still shows full authenticated UI
4. User clicks "Create Post" in tab B → API call returns 401
5. Error message says "Unauthorized" — user is confused, they're looking at the app

**Code Location:**
- No `storage` event listener or `BroadcastChannel` for auth state sync
- `src/lib/supabase/middleware.ts` — session check only runs on server requests

**Recommended Fix:**
Listen for Supabase `onAuthStateChange` events with `SIGNED_OUT` and redirect to `/login`. Or use `BroadcastChannel` to notify other tabs on logout.

---

### [RF-4-002] iOS WKWebView session persistence broken

**Severity:** High
**User Type:** iOS App User

**Scenario:**
1. User logs into Bullhorn iOS app (Capacitor, remote URL mode)
2. User force-quits the app
3. WKWebView cookies are lost (iOS doesn't persist cookies in remote URL mode)
4. User reopens app — must log in again every time

**Code Location:**
- `src/lib/sessionBridge.ts` — keychain save/restore attempted but not fully integrated
- Known issue documented in CLAUDE.md

**Recommended Fix:**
Complete the `sessionBridge.ts` integration: save tokens to iOS Keychain on auth callback, restore on app launch before loading the web view. This is a known issue already tracked.

---

### [RF-4-003] No real-time sync between sessions

**Severity:** Medium
**User Type:** Power User

**Scenario:**
1. User has Bullhorn open on desktop and phone
2. Creates a campaign on desktop
3. Phone still shows old campaign list indefinitely
4. No polling, no WebSocket, no SSE to push updates

**Code Location:**
- All Zustand stores — fetch-once pattern with `initialized` flag, no refresh mechanism

**Recommended Fix:**
Add optional polling for active stores (e.g., every 60s when tab is focused). Or implement Supabase Realtime subscriptions for high-value data (posts, campaigns). Lower priority — most users work in one session.

---

## Category 5: Input & Data Edge Cases

### [RF-5-001] No hard character limit enforcement on post content

**Severity:** High
**User Type:** Any User

**Scenario:**
1. User composes a Twitter post, types 350 characters
2. Character counter shows "350 / 280" (over limit) but doesn't prevent saving
3. User clicks "Publish Now"
4. Post is sent to Twitter API → rejected for exceeding character limit
5. Post status changes to `failed` — user must go back and trim content

**Code Location:**
- Content editor component — displays character count but no hard limit enforcement
- `src/app/api/posts/[id]/publish/route.ts` — no content length validation before publishing

**Recommended Fix:**
1. Disable the Publish/Schedule buttons when content exceeds platform limit
2. Add server-side validation before publish: check `content.length <= PLATFORM_LIMITS[platform]`
3. Show inline error on the content field when over limit

---

### [RF-5-002] Launch post platformFields accepts arbitrary JSON

**Severity:** High
**User Type:** API User / Power User

**Scenario:**
1. User creates a launch post via API with `platformFields: { "anything": "goes" }`
2. Server accepts it — Zod schema is `z.record(z.string(), z.unknown())`
3. Arbitrary data stored in database
4. When rendered, unexpected field shapes could cause UI errors

**Code Location:**
- `src/app/api/launch-posts/route.ts` — `platformFields: z.record(z.string(), z.unknown())`
- `src/components/launch-posts/LaunchPostForm.tsx` — reads platformFields for display

**Recommended Fix:**
Define per-platform Zod schemas:
```typescript
const platformFieldSchemas = {
  product_hunt: z.object({ tagline: z.string().max(60), topics: z.array(z.string()).max(3) }),
  hacker_news: z.object({ showHn: z.boolean().optional() }),
  // ...
}
```

---

### [RF-5-003] Project hashtags array unbounded

**Severity:** Medium
**User Type:** API User

**Scenario:**
User submits a project with 10,000 hashtags via API. Server accepts — no `.max()` on the array schema. Could cause performance issues on rendering.

**Code Location:**
- `src/app/api/projects/route.ts` — `hashtags: z.array(z.string()).optional()`

**Recommended Fix:**
Add `.max(20)` (or appropriate limit) to the hashtags array schema.

---

### [RF-5-004] Display name has zero validation

**Severity:** Medium
**User Type:** Any User

**Scenario:**
User sets display name to an empty string, a 10,000-character string, or unicode control characters. No validation at any level — client, server, or database.

**Code Location:**
- `src/app/(dashboard)/profile/page.tsx` — no validation on display name input
- Profile API route — no Zod schema for display name

**Recommended Fix:**
Add validation: `z.string().min(1).max(100).trim()` on the server, with matching client-side feedback.

---

### [RF-5-005] Blog content allows 100k characters

**Severity:** Low
**User Type:** Power User

**Scenario:**
User pastes a 100,000-character document into the blog editor. Markdown parsing and rendering may become slow. No warning or performance guard.

**Code Location:**
- `src/app/api/blog-drafts/route.ts` — `content: z.string().max(100000)`
- Blog editor component — no performance warning

**Recommended Fix:**
Show a warning above 50k characters: "Very long content may slow down the editor." Consider lazy rendering for extremely long drafts.

---

## Category 6: State & Timing

### [RF-6-001] Session expiry mid-form loses all data

**Severity:** Critical
**User Type:** Any User

**Scenario:**
1. User opens `/edit/abc123` and starts editing a post
2. User gets distracted — leaves tab open for 1+ hours
3. Session expires (access token ~1hr, refresh token ~7 days)
4. User returns, makes more edits
5. Auto-save fires → 401 Unauthorized → `status: 'error'`
6. User sees error toast but form data is still in React state
7. User refreshes page to "fix" the error → all unsaved changes gone
8. Form reloads from server (which has the old version)

**Code Location:**
- `src/hooks/useAutoSave.ts` — no session validation before save attempt
- `src/lib/supabase/middleware.ts` — session refresh only on server request, not proactively
- No localStorage backup for form state

**Recommended Fix:**
1. Persist form state to localStorage on every change (debounced)
2. On auto-save 401, show: "Your session expired. [Log in again] — your changes are saved locally."
3. After re-login, detect localStorage draft and offer to restore
4. Add a session keepalive ping (every 15 min while tab is focused)

---

### [RF-6-002] No TTL on Zustand stores

**Severity:** Medium
**User Type:** Power User

**Scenario:**
1. User opens dashboard at 9am — all stores fetched and `initialized: true`
2. User leaves tab open all day
3. Collaborator (or user on another device) creates campaigns, modifies posts
4. At 5pm, user's tab still shows 9am data
5. User makes decisions based on stale information

**Code Location:**
- All Zustand stores — `initialized` flag set once, never reset
- No TTL, no periodic refresh, no visibility-change refresh

**Recommended Fix:**
Add a `lastFetchedAt` timestamp to each store. On tab focus (`visibilitychange` event), refetch if data is older than 5 minutes. Use `dedup()` to prevent duplicate refetches.

---

### [RF-6-003] Plan store count divergence

**Severity:** Low
**User Type:** Multi-session User

**Scenario:**
User creates posts from two devices. Each client increments its local plan count optimistically. Plan store shows 52/50 on one device and 51/50 on another, while actual DB count is 50. Client may block creation that the server would allow.

**Code Location:**
- `src/lib/planStore.ts` — `incrementCount()` / `decrementCount()` are local only

**Recommended Fix:**
Re-fetch plan counts from server after any create/delete operation, or at least on tab focus. Server enforcement is the source of truth — client display is advisory.

---

## Category 7: Error Recovery & Empty States

### [RF-7-001] No Suspense loading boundaries

**Severity:** High
**User Type:** Any User (slow connections especially)

**Scenario:**
1. User on slow 3G connection navigates to `/posts`
2. No `loading.tsx` exists — no server-side streaming or Suspense fallback
3. Page shows blank content area while Zustand store fetches data client-side
4. If JavaScript is slow to load/execute, user sees blank page for several seconds
5. User is unsure if the page is loading or broken

**Code Location:**
- No `loading.tsx` files exist anywhere in `src/app/`
- All data loading is client-side via Zustand stores

**Recommended Fix:**
Add `loading.tsx` files to key routes (`/posts`, `/campaigns`, `/projects`, `/blog`, `/dashboard`) with skeleton UI matching the page layout. This provides instant visual feedback via Next.js streaming.

---

### [RF-7-002] Auto-save error has no recovery action

**Severity:** Medium
**User Type:** Any User

**Scenario:**
1. Auto-save fails (network error, 500, etc.)
2. `useAutoSave` sets `status: 'error'`
3. UI shows a small "error" indicator but no retry button
4. User has no clear action — must guess to click "Save" manually

**Code Location:**
- `src/hooks/useAutoSave.ts` — error state with no retry mechanism

**Recommended Fix:**
Show a persistent banner on auto-save error: "Changes couldn't be saved. [Retry] [Save Manually]". Add automatic retry with backoff (3 attempts).

---

### [RF-7-003] Only 2 error boundaries for the entire app

**Severity:** Info
**User Type:** Any User

**Scenario:**
A runtime error in the campaign detail page (`/campaigns/[id]`) bubbles up to the dashboard-level `error.tsx`. User loses all dashboard context — the error page replaces the entire dashboard layout.

**Code Location:**
- `src/app/error.tsx` — root error boundary
- `src/app/(dashboard)/error.tsx` — dashboard group error boundary
- No per-route error boundaries

**Recommended Fix:**
Add `error.tsx` to high-value routes: `/posts`, `/campaigns/[id]`, `/edit/[id]`, `/blog/[id]`. Each should offer: "[Try Again] [Go to Dashboard]" with the error message.

---

## Category 8: Unintended Usage Patterns

### [RF-8-001] API key scopes accept arbitrary strings

**Severity:** Info
**User Type:** API Developer

**Scenario:**
Developer creates an API key with scopes `["postz:readd", "typo:scope"]`. Server accepts and stores them. The key will never match any real scope check, effectively having no permissions — but no error tells the developer.

**Code Location:**
- `src/app/api/api-keys/route.ts` — `scopes: z.array(z.string())`

**Recommended Fix:**
Validate scopes against an enum of allowed values:
```typescript
scopes: z.array(z.enum(['posts:read', 'posts:write', 'campaigns:read', ...]))
```

---

### [RF-8-002] URL params can pre-fill post content

**Severity:** Info
**User Type:** External Attacker (social engineering)

**Scenario:**
An attacker crafts a link: `https://bullhorn.to/new?text=Buy+crypto+at+scam.com&url=https://scam.com`. If shared with a Bullhorn user, the post editor opens pre-filled with the attacker's content. A careless user might publish without reviewing.

**Code Location:**
- `src/app/(dashboard)/new/page.tsx` — reads `text` and `url` from `useSearchParams()` to pre-fill form

**Recommended Fix:**
This is designed behavior (iOS share extension uses it). Consider adding a visual indicator when content was pre-filled from URL params: "Content was pre-filled from a shared link. Please review before publishing." Low risk — user must still actively click Publish.

---

## Recommendations Summary

### Immediate Fixes (Critical + High)

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| 1 | RF-3-001: Add localStorage draft for new posts | Small | Prevents most common data loss |
| 2 | RF-6-001: Persist form state to localStorage on edit pages | Small | Prevents session-expiry data loss |
| 3 | RF-2-001: Disable submit buttons on click + atomic limit check | Medium | Prevents plan limit bypass |
| 4 | RF-2-002: Add optimistic update rollback to all stores | Medium | Prevents phantom data in UI |
| 5 | RF-5-001: Enforce hard character limits on publish | Small | Prevents failed publishes |
| 6 | RF-3-002: Add retry logic to auto-save | Small | Prevents data loss on network blips |
| 7 | RF-4-001: Add cross-tab auth sync | Small | Prevents confusing 401 errors |
| 8 | RF-7-001: Add loading.tsx to key routes | Small | Improves perceived performance |
| 9 | RF-1-001: Add "not found" handling for detail pages | Small | Eliminates blank page confusion |
| 10 | RF-5-002: Define per-platform launch post schemas | Medium | Validates platform-specific data |

### UX Improvements (Medium)

- RF-2-003: Add conflict detection for concurrent edits
- RF-3-003: Flush auto-save debounce on beforeunload
- RF-3-004: Clean up orphaned media on post deletion
- RF-4-003: Add visibility-change refetch for stale stores
- RF-5-003: Bound hashtags array
- RF-5-004: Validate display name
- RF-6-002: Add TTL/staleness detection to Zustand stores
- RF-7-002: Add retry UI for auto-save errors
- RF-1-002: Handle OAuth denial case

### Defense-in-Depth (Low + Info)

- RF-1-003: Improve 404 page
- RF-1-004: Add breadcrumbs
- RF-5-005: Performance guard for very long blog content
- RF-6-003: Re-fetch plan counts after mutations
- RF-7-003: Add per-route error boundaries
- RF-8-001: Enum-validate API key scopes
- RF-8-002: Add pre-filled content indicator

---

## Flow Coverage

- **Multi-step flows audited:** 8 (signup email, signup OAuth, password reset, post create, post edit, campaign create, project create, social account OAuth)
- **State dependencies mapped:** 12 Zustand stores + localStorage + cookies + Supabase session
- **Input surfaces checked:** 35+ form fields across 10 page types
- **Categories covered:** 8/8
- **Interactive verification:** No (code-level analysis only)
