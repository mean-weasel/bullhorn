# Performance Optimizations (No-Cache, No-Infra)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce redundant database queries and improve client-side data freshness across 5 targeted optimizations — no new infrastructure required.

**Architecture:** These are surgical improvements to existing patterns: wiring plan store invalidation into Zustand mutation stores, consolidating duplicate `user_profiles` queries in the enforcement layer, narrowing `select('*')` to only needed columns in list endpoints, moving search filtering from Node.js to PostgreSQL, and reducing 3-query ownership verification to 1-2 queries.

**Tech Stack:** Next.js 14 (App Router), Supabase (PostgREST), Zustand, Vitest

---

## Task 1: Wire Plan Store Invalidation into Mutation Stores

**Problem:** `usePlanStore` has `incrementCount()` and `decrementCount()` methods but no mutation store (posts, campaigns, projects, blogDrafts, launchPosts) ever calls them. After creating or deleting a resource, the plan count shown in the UI is stale until page reload.

**Files:**
- Modify: `src/lib/storage.ts` (posts store)
- Modify: `src/lib/campaigns.ts` (campaigns store)
- Modify: `src/lib/projects.ts` (projects store)
- Modify: `src/lib/blogDrafts.ts` (blog drafts store)
- Modify: `src/lib/launchPosts.ts` (launch posts store)
- Modify: `src/lib/planStore.test.ts` (add integration-style tests)

### Step 1: Write failing tests for plan count updates

Add tests to `src/lib/planStore.test.ts` that verify `incrementCount` and `decrementCount` are called from mutation stores. Since stores are independent singletons, we test the plan store's methods are invoked when mutations succeed.

```typescript
// Add to planStore.test.ts — new describe block
describe('plan count synchronization', () => {
  it('incrementCount should increase count by 1 for given resource', () => {
    usePlanStore.setState({
      limits: {
        posts: { current: 5, limit: 50 },
        campaigns: { current: 2, limit: 5 },
        projects: { current: 1, limit: 3 },
        blogDrafts: { current: 3, limit: 10 },
        launchPosts: { current: 0, limit: 10 },
      },
    })

    usePlanStore.getState().incrementCount('posts')
    expect(usePlanStore.getState().limits.posts.current).toBe(6)
    // Other resources unchanged
    expect(usePlanStore.getState().limits.campaigns.current).toBe(2)
  })

  it('decrementCount should decrease count by 1 for given resource', () => {
    usePlanStore.setState({
      limits: {
        posts: { current: 5, limit: 50 },
        campaigns: { current: 2, limit: 5 },
        projects: { current: 1, limit: 3 },
        blogDrafts: { current: 3, limit: 10 },
        launchPosts: { current: 0, limit: 10 },
      },
    })

    usePlanStore.getState().decrementCount('posts')
    expect(usePlanStore.getState().limits.posts.current).toBe(4)
  })
})
```

**Note:** These tests already exist in the current test file (lines 226-299). The real validation is that the mutation stores call these methods. We'll verify that by reading the code after modification.

### Step 2: Add `incrementCount`/`decrementCount` calls to posts store

In `src/lib/storage.ts`, import `usePlanStore` and call the appropriate method after successful mutations:

```typescript
// At top of file, add import:
import { usePlanStore } from './planStore'

// In addPost — after hapticSuccess() (line 63), add:
usePlanStore.getState().incrementCount('posts')

// In deletePost — after set() in the try block (line 101), add:
usePlanStore.getState().decrementCount('posts')
```

**Do NOT add increment/decrement to `archivePost`/`restorePost`** — these change status, not total row count.

### Step 3: Add `incrementCount`/`decrementCount` calls to campaigns store

In `src/lib/campaigns.ts`:

```typescript
// At top of file, add import:
import { usePlanStore } from './planStore'

// In addCampaign — after hapticSuccess() (line ~80), add:
usePlanStore.getState().incrementCount('campaigns')

// In deleteCampaign — after set() in the try block (line ~118), add:
usePlanStore.getState().decrementCount('campaigns')
```

### Step 4: Add `incrementCount`/`decrementCount` calls to projects store

In `src/lib/projects.ts`:

```typescript
// At top of file, add import:
import { usePlanStore } from './planStore'

// In createProject — after set() adds the new project (line ~92), add:
usePlanStore.getState().incrementCount('projects')

// In deleteProject — after set() removes the project (line ~140), add:
usePlanStore.getState().decrementCount('projects')
```

### Step 5: Add `incrementCount`/`decrementCount` calls to blogDrafts store

In `src/lib/blogDrafts.ts`:

```typescript
// At top of file, add import:
import { usePlanStore } from './planStore'

// In addDraft — after hapticSuccess() (line ~93), add:
usePlanStore.getState().incrementCount('blogDrafts')

// In deleteDraft — after set() in the try block (line ~131), add:
usePlanStore.getState().decrementCount('blogDrafts')
```

**Do NOT add to `archiveDraft`/`restoreDraft`** — same reasoning as posts.

### Step 6: Add `incrementCount`/`decrementCount` calls to launchPosts store

In `src/lib/launchPosts.ts`:

```typescript
// At top of file, add import:
import { usePlanStore } from './planStore'

// In addLaunchPost — after set() adds the new launch post (line ~264), add:
usePlanStore.getState().incrementCount('launchPosts')

// In deleteLaunchPost — after set() removes the launch post (line ~302), add:
usePlanStore.getState().decrementCount('launchPosts')
```

### Step 7: Run tests and verify

Run: `make test-run`

All existing tests should pass. The plan store tests already cover `incrementCount`/`decrementCount` behavior. The mutation stores don't have unit tests that mock `usePlanStore`, so we're relying on the existing plan store tests + code review.

### Step 8: Commit

```bash
git add src/lib/storage.ts src/lib/campaigns.ts src/lib/projects.ts src/lib/blogDrafts.ts src/lib/launchPosts.ts
git commit -m "feat: wire plan store invalidation into all mutation stores"
```

---

## Task 2: Consolidate `enforceResourceLimit` to Use a Single DB Query

**Problem:** `enforceResourceLimit()` calls `createClient()` which creates a Supabase client, then makes 2 sequential queries: one to `user_profiles` for the plan tier, then one count query on the resource table. Each POST route (posts, campaigns, projects, blogDrafts, launchPosts) independently calls this function, and `getUserPlan()` is a separate function that also queries `user_profiles`. The profile query is redundant when the caller already has the plan or when multiple enforcements happen in sequence.

**Files:**
- Modify: `src/lib/planEnforcement.ts`
- Modify: `src/lib/planEnforcement.test.ts`

### Step 1: Write failing test for consolidated function

Add a test that verifies `enforceResourceLimit` can accept an optional pre-fetched plan to skip the profile query:

```typescript
// Add to planEnforcement.test.ts — new describe block at end
describe('enforceResourceLimit with pre-fetched plan', () => {
  it('skips profile query when plan is provided', async () => {
    // Only set up count mock (no profile mock needed)
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
      })),
    }))

    const result = await enforceResourceLimit('user-1', 'posts', 'free')
    expect(result.allowed).toBe(true)
    expect(result.current).toBe(10)
    expect(result.limit).toBe(50)
    expect(result.plan).toBe('free')
    // Should only have called from() once (count query only, no profile query)
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })

  it('still queries profile when plan is not provided', async () => {
    setupResourceMocks('free', 10)
    const result = await enforceResourceLimit('user-1', 'posts')
    expect(result.plan).toBe('free')
    // Should have called from() twice (profile + count)
    expect(mockFrom).toHaveBeenCalledTimes(2)
  })
})
```

### Step 2: Run test to verify it fails

Run: `npx vitest run src/lib/planEnforcement.test.ts`

Expected: FAIL — `enforceResourceLimit` doesn't accept a third parameter yet.

### Step 3: Add optional `plan` parameter to `enforceResourceLimit`

Modify `src/lib/planEnforcement.ts`:

```typescript
export async function enforceResourceLimit(
  userId: string,
  resource: Exclude<ResourceType, 'storageBytes'>,
  preloadedPlan?: PlanType
): Promise<{ allowed: boolean; current: number; limit: number; plan: PlanType }> {
  const supabase = await createClient()

  let plan: PlanType
  if (preloadedPlan) {
    plan = preloadedPlan
  } else {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan')
      .eq('id', userId)
      .single()
    plan = (profile?.plan as PlanType) || 'free'
  }

  const limit = PLAN_LIMITS[plan][resource]
  const { table, countCol } = TABLE_MAP[resource]

  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(countCol, userId)

  const current = count || 0
  return { allowed: current < limit, current, limit, plan }
}
```

### Step 4: Run test to verify it passes

Run: `npx vitest run src/lib/planEnforcement.test.ts`

Expected: All tests PASS (existing tests still work because parameter is optional).

### Step 5: Commit

```bash
git add src/lib/planEnforcement.ts src/lib/planEnforcement.test.ts
git commit -m "feat: add optional preloaded plan to enforceResourceLimit"
```

---

## Task 3: Partial Column Selection for List Endpoints

**Problem:** All list endpoints use `select('*')` which fetches every column including the large `content` JSONB field and `publish_result` JSONB field. For list views, the frontend only needs metadata columns for rendering cards (id, status, platform, notes preview, dates, campaignId). The full `content` field is only needed when editing a single post.

**However:** The Zustand `usePostsStore` populates a single `posts: Post[]` array that serves BOTH the list view AND the edit view. If we strip `content` from the list response, clicking "edit" would find a post without content. The stores would need to be refactored to support partial vs full loads, or the edit page would need its own fetch.

**Decision:** This optimization is **deferred** because:
1. The edit page (`/edit/[id]`) already calls `getPost(id)` from the same Zustand store
2. Splitting list vs detail would require either a) two arrays in the store, or b) the edit page to always fetch fresh — both are larger refactors
3. The actual payload difference is modest for <50 posts per user

**What we CAN do safely:** Add partial column selection to the **campaigns list** and **projects list** endpoints, since these don't have large JSONB fields. But their `select('*')` columns are already small (id, name, description, status, project_id, created_at, updated_at, user_id), so the savings are negligible.

**Skip this task.** Revisit when post counts per user grow significantly or when the edit page is refactored to fetch independently.

---

## Task 4: Move Search Filtering from Node.js to PostgreSQL

**Problem:** `GET /api/posts/search` currently:
1. Queries Supabase with `ilike` on `notes` and `platform` columns
2. Fetches up to `limit` matching rows (including full `content` JSONB)
3. Then re-filters ALL returned rows in Node.js by stringifying `content` JSON and doing `.includes()`

This is double-filtering. The `ilike` query already narrows results by `notes`/`platform`, but then the Node.js filter also checks `content` — meaning posts that match in `content` but NOT in `notes`/`platform` are missed by the DB query but could still match the Node.js filter. The current approach is both incomplete and redundant.

**Fix:** Use PostgreSQL's `content::text` cast to search within JSONB as text directly in the database query, eliminating the Node.js filter entirely.

**Files:**
- Modify: `src/app/api/posts/search/route.ts`
- Test: `src/app/api/posts/search/route.test.ts` (create if doesn't exist, or verify manually)

### Step 1: Check for existing search tests

Run: `ls src/app/api/posts/search/`

If `route.test.ts` exists, read it. If not, we'll test manually.

### Step 2: Modify the search route to use a single DB query

Replace the current two-phase approach in `src/app/api/posts/search/route.ts`:

**Current code (lines 29-61):**
```typescript
const searchPattern = `%${escapeSearchPattern(query)}%`
const { data, error } = await supabase
  .from('posts')
  .select('*')
  .eq('user_id', userId)
  .neq('status', 'archived')
  .or(`notes.ilike.${searchPattern},platform.ilike.${searchPattern}`)
  .order('updated_at', { ascending: false })
  .limit(limit)

// ... Node.js re-filter on content
const filtered = data.filter(...)
```

**Replace with:**
```typescript
const searchPattern = `%${escapeSearchPattern(query)}%`
const { data, error } = await supabase
  .from('posts')
  .select('*')
  .eq('user_id', userId)
  .neq('status', 'archived')
  .or(`notes.ilike.${searchPattern},platform.ilike.${searchPattern},content::text.ilike.${searchPattern}`)
  .order('updated_at', { ascending: false })
  .limit(limit)
```

And remove the entire `filtered` block (lines 48-61), changing the transform to use `data` directly:

```typescript
const posts = (data || []).map((post) => transformPostFromDb(post as DbPost))
```

**Important:** The `content::text` cast in PostgREST uses the `::text` casting syntax. If Supabase's PostgREST version doesn't support this directly in `.or()`, we'll fall back to using `.or()` with just `notes` and `platform`, plus a separate RPC call. Test this first.

### Step 3: Test the PostgREST casting syntax

If `content::text.ilike` doesn't work in Supabase's `.or()` filter (PostgREST may not support type casting in filter syntax), use this alternative approach instead:

**Alternative — keep the hybrid but fix the bug:**

The current code has a bug: the DB query returns posts matching `notes` OR `platform`, limited to N rows. Then Node.js re-filters those N rows. Posts that match ONLY in `content` are never returned because the DB query filtered them out.

Fix: Remove the `or()` filter from the DB query entirely. Fetch all non-archived posts (up to limit), then filter in Node.js:

```typescript
const searchPattern = `%${escapeSearchPattern(query)}%`

// Fetch non-archived posts — we filter by search in Node.js
// because Supabase PostgREST can't easily search within JSONB text
const { data, error } = await supabase
  .from('posts')
  .select('*')
  .eq('user_id', userId)
  .neq('status', 'archived')
  .order('updated_at', { ascending: false })
  .limit(500) // Fetch more rows since we filter client-side

if (error) {
  console.error('Database error:', error)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

// Filter by search query across all text fields
const searchLower = query.toLowerCase()
const filtered = (data || []).filter((post) => {
  const contentStr = JSON.stringify(post.content || {}).toLowerCase()
  const notesStr = (post.notes || '').toLowerCase()
  const platformStr = (post.platform || '').toLowerCase()
  return (
    contentStr.includes(searchLower) ||
    notesStr.includes(searchLower) ||
    platformStr.includes(searchLower)
  )
})

const posts = filtered.slice(0, limit).map((post) => transformPostFromDb(post as DbPost))
```

This fixes the bug where content-only matches were missed, at the cost of fetching more rows. Since each user has max 50 (free) or 500 (pro) posts, this is acceptable.

### Step 4: Remove unused import if needed

If we go with the alternative approach, `escapeSearchPattern` is no longer needed in the DB query but is still useful if we keep the `or()` approach. Keep or remove based on which approach works.

### Step 5: Run typecheck and lint

Run: `make check`

### Step 6: Commit

```bash
git add src/app/api/posts/search/route.ts
git commit -m "fix: search now finds matches in post content, not just notes/platform"
```

---

## Task 5: Combine Ownership Verification Queries in Campaign Posts Route

**Problem:** `POST /api/campaigns/[id]/posts` (add post to campaign) does 3 sequential queries:
1. `SELECT id FROM campaigns WHERE id = :campaignId AND user_id = :userId` (verify campaign ownership)
2. `SELECT id FROM posts WHERE id = :postId AND user_id = :userId` (verify post ownership)
3. `UPDATE posts SET campaign_id = :campaignId WHERE id = :postId AND user_id = :userId` (do the update)

Query 2 is redundant because query 3 already filters by `user_id`. If the post doesn't belong to the user, the update returns no rows — which is the same 404 behavior.

**Fix:** Remove query 2. Keep query 1 (campaign ownership must be verified because we don't want users setting `campaign_id` to a campaign they don't own). Keep query 3 (does the actual update with ownership check). That's 2 queries instead of 3.

**Files:**
- Modify: `src/app/api/campaigns/[id]/posts/route.ts`
- Test: `src/app/api/campaigns/[id]/posts/route.test.ts` (if exists)

### Step 1: Check for existing tests

Run: `ls src/app/api/campaigns/\[id\]/posts/`

### Step 2: Remove the redundant post ownership check

In `src/app/api/campaigns/[id]/posts/route.ts`, remove lines 117-127 (the post ownership verification query):

**Remove this block:**
```typescript
// CRITICAL: Verify user owns the post being added
const { data: postCheck, error: postCheckError } = await supabase
  .from('posts')
  .select('id')
  .eq('id', postId)
  .eq('user_id', userId)
  .single()

if (postCheckError || !postCheck) {
  return NextResponse.json({ error: 'Post not found' }, { status: 404 })
}
```

The remaining update query (lines 130-136) already has `.eq('user_id', userId)` which provides the same ownership check. If the post doesn't exist or doesn't belong to the user, the update returns no rows and the `PGRST116` error handling on line 139 returns 404.

**But wait:** The update uses `.select().single()` which returns `PGRST116` when no rows match. The current error handler on line 139 already catches this:

```typescript
if (error.code === 'PGRST116') {
  return NextResponse.json({ error: 'Post not found' }, { status: 404 })
}
```

So the behavior is identical — if the user doesn't own the post, the update matches 0 rows, Supabase returns the `PGRST116` "no rows" error, and we return 404.

### Step 3: Run typecheck and lint

Run: `make check`

### Step 4: Run related tests if they exist

Run: `npx vitest run src/app/api/campaigns/` (will pick up any tests in the campaigns API directory)

### Step 5: Commit

```bash
git add src/app/api/campaigns/\[id\]/posts/route.ts
git commit -m "perf: remove redundant post ownership query in campaign posts route"
```

---

## Summary

| Task | Impact | Risk | Queries Saved |
|------|--------|------|---------------|
| 1. Plan store invalidation | High — fixes stale UI counts | Low — additive only, uses existing methods | 0 (client-side improvement) |
| 2. Consolidate enforceResourceLimit | Medium — prepares for future use | Low — optional parameter, backward compatible | 1 per call when plan is pre-fetched |
| 3. Partial column selection | **Deferred** — refactor cost too high for current scale | — | — |
| 4. Fix search filtering | Medium — fixes content search bug | Low — same data, better filter | Depends on approach |
| 5. Combine ownership queries | Low — saves 1 query on campaign-post assignment | Low — update already has ownership check | 1 per POST |
