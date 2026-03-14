# Adversarial Audit Report

**App:** Bullhorn — Social media post scheduler
**Date:** 2026-03-14
**Scope:** Full audit (all 7 categories)
**Base URL:** N/A — static analysis only

## Executive Summary

**Total findings:** 14

| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 3 |
| Medium | 6 |
| Low | 4 |
| Info | 0 |

**Top 3 findings:**
1. [AC-1-001] Recurring posts bypass plan limits — Cron job creates unlimited posts without quota checks
2. [AC-4-001] Storage counter drift on RPC failure — Failed RPC leaves storage under-reported, allowing limit bypass
3. [AC-5-001] No resource purge on plan downgrade — Pro resources retained indefinitely after downgrade to Free

**Interactive verification:** Not performed

## Economic Surface Map

### Cost-Bearing Resources

| Resource | Trigger | Est. Unit Cost | Volume Limit | Enforcement |
|----------|---------|---------------|--------------|-------------|
| Twitter/X API | Post publish | Free tier (450K/mo) | Plan post limits | API route check |
| LinkedIn API | Post publish | Free (rate-limited) | Plan post limits | API route check |
| Reddit API | Post publish | Free (rate-limited) | Plan post limits | API route check |
| Google Analytics API | Report request | Free (25/day/property), then ~$0.25/1K | None | None |
| Resend Email | Post reaches "ready" | ~$0.10/email | None per-user | Cron processes up to 50/run |
| Web Push (VAPID) | Post reaches "ready" | Free (self-hosted) | None per-user | None |
| Apple APNs | Post reaches "ready" | Free (included in $99/yr dev program) | None per-user | None |
| Supabase Storage | Media upload | ~$1/GB/mo | Plan storage cap (Free=50MB, Pro=2GB) | Pre-upload check + RPC increment |
| Supabase PostgreSQL | All CRUD operations | $25/mo + $0.25/M over quota | Plan resource limits | Count-based check (non-atomic) |
| Vercel Functions | Cron jobs (4 crons) | $20/mo base + $0.50/100K invocations | ~9,600 invocations/mo | None |
| Upstash Redis | Rate limit checks | Free (10K req/day) | 30 req/10s per IP | Sliding window |
| Sentry | Error capture | Free (5K events/mo) | 10% perf sampling | Config-based |

### Unmetered Resources

- **Google Analytics queries** — No per-user or per-day limit enforced by the app. Relies solely on Google's free tier (25 queries/day/property).
- **Notification sends** — No per-user cap on email, web push, or APNs notifications triggered by scheduled posts.
- **Recurring post generation** — Cron job creates new posts from recurrence rules with no plan limit check.

## Findings by Category

### 1. Quota & Limit Bypass

---

### [AC-1-001] Recurring posts bypass plan limits

**Severity:** Critical
**Category:** Quota & Limit Bypass
**Actor:** Power User / Bad Actor
**Verification:** Not Tested

**Scenario:**
1. Free user creates a post with a `recurrence_rule` (e.g., daily repeat)
2. The cron job `notify-due-posts` runs every 5 minutes
3. When a recurring post becomes due, `scheduleNextRecurrence()` creates a new post via service role client
4. This insert does **not** call `enforceResourceLimit()` — no plan limit check occurs
5. The new post is scheduled for the next occurrence, and the cycle repeats
6. Over days/weeks, the user accumulates posts far beyond their plan limit (Free=50)

**Impact:**
Unbounded post creation. A free user can have hundreds of posts over time. Each recurring post also triggers email + push + APNs notifications, amplifying notification costs. When billing is introduced, this undermines the tier model entirely.

**Current Protection:**
None. The `scheduleNextRecurrence` function performs a direct insert with no quota check.

**Code Location:**
- `src/app/api/cron/publish/route.ts:46-73` — `scheduleNextRecurrence()` inserts without limit check
- `src/app/api/cron/publish/route.ts:168` — Called after every recurring post is processed
- `src/lib/planEnforcement.ts:28-57` — `enforceResourceLimit()` exists but is not called here

**Recommended Fix:**
Add a plan limit check inside `scheduleNextRecurrence` before inserting. If the user is at their limit, skip the insert and log a warning. Consider also adding a `max_recurrences` field to cap total recurrences per post.

```typescript
// Before inserting the next recurrence:
const limitCheck = await enforceResourceLimit(post.user_id, 'posts')
if (!limitCheck.allowed) {
  console.warn(`[recurrence] Skipping: user ${post.user_id} at post limit`)
  return
}
```

---

### [AC-1-002] TOCTOU race condition on all resource creation

**Severity:** High
**Category:** Quota & Limit Bypass
**Actor:** Bad Actor
**Verification:** Not Tested

**Scenario:**
1. Free user has 49/50 posts
2. User sends 5 parallel POST requests to `/api/posts`
3. All 5 requests call `enforceResourceLimit()` → all see count=49 < limit=50 → all return `allowed: true`
4. All 5 requests proceed to insert
5. User now has 54 posts (4 over limit)

**Impact:**
Users can exceed plan limits by sending concurrent requests. Affects all resources: posts, campaigns, projects, blog drafts, launch posts, API keys, social accounts, and storage. The overflow is bounded by the number of concurrent requests a user can send before any insert completes.

**Current Protection:**
Limits are checked, but the check-then-insert pattern is not atomic. No database-level constraint prevents exceeding the limit.

**Code Location:**
- `src/lib/planEnforcement.ts:50-56` — COUNT query returns current count
- `src/app/api/posts/route.ts:117-128` — Check passes, then INSERT happens separately
- Same pattern in: `campaigns/route.ts`, `projects/route.ts`, `blog-drafts/route.ts`, `launch-posts/route.ts`, `api-keys/route.ts`

**Recommended Fix:**
Use a PostgreSQL function that atomically checks the count and inserts in a single transaction:

```sql
CREATE OR REPLACE FUNCTION insert_if_under_limit(
  p_user_id uuid, p_table text, p_limit int, p_data jsonb
) RETURNS boolean AS $$
DECLARE current_count int;
BEGIN
  EXECUTE format('SELECT count(*) FROM %I WHERE user_id = $1', p_table)
    INTO current_count USING p_user_id;
  IF current_count >= p_limit THEN RETURN false; END IF;
  EXECUTE format('INSERT INTO %I SELECT * FROM jsonb_populate_record(null::%I, $1)', p_table, p_table)
    USING p_data;
  RETURN true;
END;
$$ LANGUAGE plpgsql;
```

Alternatively, add a PostgreSQL trigger that checks the count before insert and raises an exception if the limit is exceeded.

---

### [AC-1-003] In-memory rate limit not distributed across instances

**Severity:** Medium
**Category:** Quota & Limit Bypass
**Actor:** Bad Actor
**Verification:** Not Tested

**Scenario:**
1. Upstash Redis is not configured (or temporarily unavailable)
2. Rate limiter falls back to in-memory fixed-window per Vercel function instance
3. Vercel routes requests across multiple function instances
4. Each instance has its own independent rate limit counter
5. User sends 30 requests → instance A counts 30 (blocked) → next requests hit instance B (fresh counter) → effectively 60+ requests in 10 seconds

**Impact:**
Rate limiting is degraded from 30 req/10s to (30 * N instances) req/10s. In practice, Vercel uses cold starts and instance reuse, so the actual bypass factor depends on traffic patterns.

**Current Protection:**
In-memory fallback exists (not fail-open), but state is not shared. Warning logged in production.

**Code Location:**
- `src/lib/rateLimit.ts:57-83` — `memoryRateLimit()` function with per-instance `Map`
- `src/lib/rateLimit.ts:105-113` — Fallback when `getRatelimit()` returns null

**Recommended Fix:**
Ensure Upstash Redis is always configured in production. Add a health check that alerts if Redis is unavailable. Consider failing closed (rejecting all requests) if Redis is down in production rather than falling back to per-instance memory.

---

### [AC-1-004] Email allowlist not enforced on API routes

**Severity:** Medium
**Category:** Quota & Limit Bypass
**Actor:** Bad Actor
**Verification:** Not Tested

**Scenario:**
1. Admin configures `ALLOWED_EMAILS=admin@company.com` to restrict access during beta
2. Unauthorized user signs up with `attacker@gmail.com` via Google OAuth
3. Middleware redirects them to `/access-denied` on page routes
4. User uses curl/Postman with their session cookie to call `/api/posts`, `/api/campaigns`, etc.
5. API routes call `requireAuth()` which validates the session but does NOT check the email allowlist
6. Unauthorized user has full API access

**Impact:**
The email allowlist is a UI-only restriction, not a security boundary. Any user with a valid Supabase session can access all API routes regardless of the allowlist.

**Current Protection:**
Middleware checks allowlist for page routes only. API routes skip the check entirely (lines 59-61 in middleware.ts).

**Code Location:**
- `src/lib/supabase/middleware.ts:59-61` — API routes skip `getUser()` and allowlist check
- `src/lib/supabase/middleware.ts:100-107` — Allowlist check only runs for non-API paths
- `src/lib/auth.ts:246-273` — `requireAuth()` validates session but not email

**Recommended Fix:**
Add the email allowlist check to `requireAuth()` in `src/lib/auth.ts`. After resolving the user, check their email against the allowlist:

```typescript
if (allowedEmails && !allowedEmails.includes(user.email?.toLowerCase())) {
  throw new Error('Unauthorized')
}
```

---

### 2. Cost Amplification

---

### [AC-2-001] Notification flooding via batch scheduling

**Severity:** Medium
**Category:** Cost Amplification
**Actor:** Power User
**Verification:** Not Tested

**Scenario:**
1. User schedules 50 posts all with the same `scheduled_at` timestamp (or within the same 5-minute cron window)
2. Cron job `notify-due-posts` runs and finds all 50 posts due
3. For each post: transitions to "ready", sends web push, sends APNs, fetches user email, sends email
4. Result: 50 emails ($5 at $0.10/email), 50 web push notifications, 50 APNs notifications — all within one cron run

**Impact:**
A single user can trigger ~150 outbound notifications in one 5-minute window. At scale, this amplifies email costs (Resend) and could hit provider rate limits. The cron processes up to 50 posts per run, so this is bounded but still costly for free users.

**Current Protection:**
Cron limits to 50 posts per run. No per-user notification throttle.

**Code Location:**
- `src/app/api/cron/publish/route.ts:107-169` — Loop processes all due posts with notifications
- `src/lib/emailSender.ts` — Resend email sender (no per-user rate limit)

**Recommended Fix:**
Add per-user notification batching: group all due posts for a user into a single notification (e.g., "3 posts are ready to publish") instead of sending one notification per post. Cap email sends per user per cron run (e.g., max 3 emails/run).

---

### [AC-2-002] Google Analytics queries unmetered

**Severity:** Low
**Category:** Cost Amplification
**Actor:** Power User
**Verification:** Not Tested

**Scenario:**
1. User connects multiple Google Analytics properties
2. User repeatedly requests reports for each property
3. Each request triggers a Google Analytics Data API call
4. Free tier allows 25 queries/day/property — app doesn't track or limit this
5. If app grows, operator may exceed free tier and incur charges (~$0.25 per 1K queries)

**Impact:**
Low immediate impact (free tier is generous). Risk grows with user base. No metering means the operator has no visibility into query volume.

**Current Protection:**
None application-side. Relies on Google's free tier quota.

**Code Location:**
- `src/app/api/analytics/connections/[id]/report/route.ts` — Calls Google Analytics Data API per request

**Recommended Fix:**
Add a daily query counter per user (stored in Redis or DB). Limit to 25 queries/day/user to stay within Google's free tier. Display remaining queries in the UI.

---

### 3. Account & Identity Abuse

---

### [AC-3-001] Unlimited free accounts via multiple OAuth identities

**Severity:** Medium
**Category:** Account & Identity Abuse
**Actor:** Bad Actor
**Verification:** Not Tested

**Scenario:**
1. User creates account with `user1@gmail.com` via Google OAuth
2. Gets full free tier: 50 posts, 5 campaigns, 3 projects, 50 MB storage
3. Creates another account with `user2@gmail.com` (different Google account)
4. Gets another full free tier allocation
5. Repeats with as many Gmail accounts as desired
6. No device fingerprinting, IP throttling, or cross-account detection

**Impact:**
Unlimited free-tier resources. A determined user can create 10+ accounts and manage them with separate browser sessions. Each account gets 50 posts, 50 MB storage, etc.

**Current Protection:**
Google OAuth requires a real Google account. No disposable email addresses accepted via OAuth. But users can have unlimited Gmail accounts.

**Code Location:**
- `src/app/(auth)/auth/callback/route.ts` — OAuth callback, no multi-account detection
- `src/app/(auth)/signup/page.tsx` — Email signup, no IP throttling
- Supabase Auth config — No blocked domains or signup rate limits

**Recommended Fix:**
This is partially mitigated by Google OAuth requiring real accounts. For stronger protection: add IP-based signup throttling (max 2 accounts per IP per 24 hours via Redis). Consider device fingerprinting for high-value features. Monitor for users with identical browser fingerprints across accounts.

---

### [AC-3-002] Delete-and-recreate resets all limits

**Severity:** Medium
**Category:** Account & Identity Abuse
**Actor:** Power User
**Verification:** Not Tested

**Scenario:**
1. Free user fills up all resources: 50 posts, 5 campaigns, 3 projects
2. Exports/downloads any data they want to keep
3. Calls `POST /api/account/delete` — all data cascade-deleted
4. Signs up again with the same email
5. Gets a fresh free tier allocation
6. Re-imports data via `/api/import` (up to limit)

**Impact:**
Users can cycle through free accounts to reset limits. The import endpoint accepts up to 500 posts per batch, so re-importing is straightforward. This is mostly a nuisance rather than a major cost issue since the user loses their social account connections on delete.

**Current Protection:**
Account deletion is irreversible (cascade FK). Social account OAuth tokens are lost. Re-connecting social accounts requires re-authorization.

**Code Location:**
- `src/app/api/account/delete/route.ts` — Full cascade delete
- `src/app/api/import/route.ts` — Batch import up to 500 posts

**Recommended Fix:**
Track email addresses of deleted accounts. Apply a cooldown period (e.g., 30 days) before the same email can re-register with full free-tier limits. Alternatively, grant reduced limits to re-registering users.

---

### 4. State Corruption

---

### [AC-4-001] Storage counter drift on RPC failure

**Severity:** High
**Category:** State Corruption
**Actor:** Confused User
**Verification:** Not Tested

**Scenario:**
1. User uploads a 5 MB file
2. `enforceStorageLimit()` checks: 45 MB used + 5 MB = 50 MB ≤ 50 MB limit → allowed
3. File uploads successfully to Supabase Storage
4. `increment_storage_used` RPC call fails (network timeout, DB error)
5. File exists in storage, but `storage_used_bytes` still shows 45 MB (should be 50 MB)
6. User uploads another 5 MB file — check sees 45 + 5 = 50 ≤ 50 → allowed
7. User now has 55 MB of actual storage, but counter shows 50 MB
8. Over time, drift accumulates

**Impact:**
Storage counter becomes unreliable. Users can exceed storage limits without detection. The operator pays for actual storage consumed, not what the counter reports. Drift is one-directional (always under-reports) since the RPC failure only skips increments.

**Current Protection:**
The RPC call is awaited but its result is not checked. No reconciliation job exists.

**Code Location:**
- `src/app/api/media/upload/route.ts:101-104` — RPC called without error handling
- `supabase/migrations/20260212162934_add_plan_and_storage_columns.sql` — `increment_storage_used` function

**Recommended Fix:**
1. Check the RPC result and roll back the upload if it fails:
```typescript
const { error: rpcError } = await supabase.rpc('increment_storage_used', { ... })
if (rpcError) {
  // Roll back: delete the uploaded file
  await supabase.storage.from('media').remove([storagePath])
  return NextResponse.json({ error: 'Storage tracking failed' }, { status: 500 })
}
```
2. Add a periodic reconciliation cron that recalculates `storage_used_bytes` from actual storage bucket contents.

---

### [AC-4-002] Orphaned storage files not cleaned up

**Severity:** Low
**Category:** State Corruption
**Actor:** Confused User
**Verification:** Not Tested

**Scenario:**
1. User uploads media and attaches it to a post
2. User edits the post and replaces the media with a different file
3. The old file remains in Supabase Storage but is no longer referenced by any post
4. Storage counter may or may not have been decremented (depends on whether the edit route handles this)
5. Orphaned files accumulate over time

**Impact:**
Storage bloat. Operator pays for files that are no longer used. The `storage_used_bytes` counter may become inaccurate relative to actual storage consumed.

**Current Protection:**
Account deletion cleans up `media` and `logos` buckets. No periodic cleanup for orphaned files within active accounts.

**Code Location:**
- `src/app/api/account/delete/route.ts:31-42` — Cleanup on account deletion only
- No orphan cleanup cron exists

**Recommended Fix:**
Add a weekly cron job that lists all files in each user's storage path and cross-references with media URLs in posts, projects, and blog drafts. Remove orphaned files and adjust the storage counter. Alternatively, track media references in a `media_files` table for easier reconciliation.

---

### 5. Subscription & Billing Gaps

---

### [AC-5-001] No resource purge on plan downgrade

**Severity:** High
**Category:** Subscription & Billing Gaps
**Actor:** Power User
**Verification:** Not Tested

**Scenario:**
1. User subscribes to Pro (when billing is implemented): 500 posts, 50 campaigns, 2 GB storage
2. User creates 300 posts, 30 campaigns, uploads 1.5 GB of media
3. User downgrades to Free: limits become 50 posts, 5 campaigns, 50 MB storage
4. No trigger or webhook checks whether resources exceed new limits
5. User retains all 300 posts, 30 campaigns, and 1.5 GB of storage
6. User cannot create new resources but keeps full access to existing ones

**Impact:**
Users can subscribe for one month, fill up Pro-tier resources, downgrade, and retain everything indefinitely. The operator loses the ongoing subscription revenue but the user keeps the resources. When billing launches, this is a direct revenue leak.

**Current Protection:**
None. Plan changes are manual DB updates with no cascading logic. The `enforceResourceLimit` function only blocks new creation — it doesn't purge existing resources.

**Code Location:**
- `supabase/migrations/20260212162934_add_plan_and_storage_columns.sql` — Plan column, no triggers
- `src/lib/planEnforcement.ts:28-57` — Only checks `current < limit` on creation
- No downgrade webhook or trigger exists

**Recommended Fix:**
When implementing Stripe webhooks for plan changes, add a downgrade handler that:
1. Marks excess resources as "archived" (soft delete, not hard delete)
2. Notifies the user which resources were archived and why
3. Gives the user a 7-day grace period to choose which resources to keep
4. After grace period, auto-archive oldest resources above the limit

---

### [AC-5-002] No plan change audit trail

**Severity:** Low
**Category:** Subscription & Billing Gaps
**Actor:** N/A (Operational risk)
**Verification:** Not Tested

**Scenario:**
1. Admin manually updates `user_profiles.plan` from 'free' to 'pro'
2. No record of when the change was made, by whom, or why
3. If a billing dispute arises, there's no audit trail to reference
4. If a plan change is made in error, there's no way to detect it

**Impact:**
Operational risk. No visibility into plan change history for billing disputes, compliance, or debugging.

**Current Protection:**
Supabase audit log may capture the raw SQL update, but there's no application-level audit trail.

**Code Location:**
- `supabase/migrations/20260212162934_add_plan_and_storage_columns.sql` — `plan` column with no trigger

**Recommended Fix:**
Create a `plan_changes` audit table:
```sql
CREATE TABLE plan_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  old_plan text NOT NULL,
  new_plan text NOT NULL,
  reason text,
  changed_by text, -- 'stripe_webhook', 'admin', 'system'
  created_at timestamptz DEFAULT now()
);
```
Add a PostgreSQL trigger on `user_profiles` that logs every plan change.

---

### 6. Resource Exhaustion

---

### [AC-6-001] No media retention or cleanup policy

**Severity:** Medium
**Category:** Resource Exhaustion
**Actor:** Power User
**Verification:** Not Tested

**Scenario:**
1. Free user uploads media files up to 50 MB limit
2. Attaches media to posts, then deletes the posts
3. Media files remain in Supabase Storage (no cleanup on post delete)
4. Storage counter may or may not be decremented
5. If counter is decremented: user can upload more files, delete posts, repeat — cycling through storage
6. Operator pays for peak storage, even if posts are deleted

**Impact:**
Storage costs grow monotonically. Without cleanup, the operator's Supabase storage bill increases even as users delete posts. The 50 MB free limit bounds individual user impact, but across many users, orphaned media accumulates.

**Current Protection:**
Storage limit caps individual user uploads. Account deletion cleans up files. No periodic orphan cleanup.

**Code Location:**
- `src/app/api/media/upload/route.ts` — Upload without lifecycle management
- `src/app/api/account/delete/route.ts:31-42` — Only cleanup on full account deletion

**Recommended Fix:**
Track media files in a `media_files` table with `post_id` references. When a post is deleted, check if its media is referenced by other posts. If not, delete the file from storage and decrement the counter. Add a weekly reconciliation cron.

---

### 7. Unprotected Edge Cases

---

### [AC-7-001] Arbitrary JSON in content field with no size cap

**Severity:** Low
**Category:** Unprotected Edge Cases
**Actor:** Bad Actor
**Verification:** Not Tested

**Scenario:**
1. The `content` field in post creation accepts `z.record(z.string(), z.unknown())`
2. No size limit on the JSON payload beyond Next.js body parser limits (~4.5 MB default)
3. User sends a POST to `/api/posts` with a 4 MB `content` field containing deeply nested JSON
4. This is stored in PostgreSQL as a JSONB column
5. Repeat 50 times (free tier limit) → 200 MB of JSONB data in the `posts` table
6. Query performance degrades as the table grows with large JSONB values

**Impact:**
Database bloat and potential query slowdowns. Each post could contain megabytes of arbitrary JSON. At scale, this increases database storage costs and slows SELECT queries that return `content`.

**Current Protection:**
Zod validates the structure (must be `Record<string, unknown>`) but does not limit the size. Next.js body parser has a default limit (~4.5 MB) that provides a soft cap.

**Code Location:**
- `src/app/api/posts/route.ts:12` — `content: z.record(z.string(), z.unknown())` with no `.max()`
- Same pattern in `src/app/api/import/route.ts:10`

**Recommended Fix:**
Add a content size check after parsing:
```typescript
const contentStr = JSON.stringify(parsed.data.content)
if (contentStr.length > 50_000) { // 50 KB max
  return NextResponse.json({ error: 'Content too large (max 50 KB)' }, { status: 400 })
}
```

---

## Recommendations Summary

### Immediate (Critical + High)

1. **[AC-1-001]** Add `enforceResourceLimit()` check inside `scheduleNextRecurrence()` before inserting recurring posts
2. **[AC-1-002]** Replace check-then-insert with an atomic PostgreSQL function or trigger that enforces limits within a transaction
3. **[AC-4-001]** Handle `increment_storage_used` RPC errors — roll back the upload if storage tracking fails
4. **[AC-5-001]** Implement downgrade resource handling when Stripe integration is built — archive excess resources with a grace period

### Short-term (Medium)

5. **[AC-1-003]** Ensure Upstash Redis is always configured in production; add monitoring for fallback activation
6. **[AC-1-004]** Add email allowlist check to `requireAuth()` so API routes respect the allowlist
7. **[AC-2-001]** Batch notifications per user — send one summary email instead of per-post notifications
8. **[AC-3-001]** Add IP-based signup throttling (max 2 accounts per IP per 24 hours)
9. **[AC-3-002]** Track deleted account emails; apply cooldown before re-registration with full limits
10. **[AC-6-001]** Track media references in a table; add cleanup when posts are deleted

### Defense-in-Depth (Low)

11. **[AC-2-002]** Add per-user daily query limits for Google Analytics API
12. **[AC-4-002]** Add periodic storage reconciliation cron to detect and clean orphaned files
13. **[AC-5-002]** Create `plan_changes` audit table with PostgreSQL trigger
14. **[AC-7-001]** Add content size validation (max 50 KB) to post creation and import endpoints
