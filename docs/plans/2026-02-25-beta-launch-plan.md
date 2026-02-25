# Beta Launch Plan — Production Readiness (No Platform Publishing)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship Bullhorn to closed beta testers as a post drafting/scheduling/organizing tool. Fix legal compliance, security vulnerabilities, monitoring gaps, and onboarding UX. Prepare the repo for open-sourcing under AGPL-3.0. Platform publishing (Twitter/LinkedIn/Reddit) deferred to post-beta.

**Architecture:** 6 independent worktrees executed in parallel via Agent Teams. Each teammate gets an isolated git worktree with zero file overlap. All 6 can run simultaneously.

**Tech Stack:** Next.js 15, Supabase, Sentry, Zod, Tailwind CSS

---

## Team Execution Map

```
ALL 6 TEAMMATES START SIMULTANEOUSLY — zero dependencies between them

Teammate 1 (legal):             Terms + Privacy + Cookie Consent + legal links
Teammate 2 (security):          Pre-launch security fixes (OAuth CSRF, ownership, logo, force-dynamic)
Teammate 3 (account-deletion):  Server-side account deletion endpoint (GDPR)
Teammate 4 (monitoring):        Sentry tracing + error context + About section fix
Teammate 5 (onboarding):        Welcome modal + empty states + usage limit banner
Teammate 6 (open-source-prep):  AGPL-3.0 license, redact identifiers, .gitignore, README, CONTRIBUTING

FILE OWNERSHIP (no overlap):
  Teammate 1: src/app/terms/*, src/app/privacy/*, src/components/ui/CookieConsent.tsx, src/app/layout.tsx, src/app/(auth)/login/page.tsx
  Teammate 2: src/app/api/ routes (analytics, projects, import, blog-drafts, posts, launch-posts, media, etc.), src/lib/supabase/server.ts, src/app/api/projects/[id]/logo/route.ts
  Teammate 3: src/app/api/account/*, src/app/(dashboard)/profile/page.tsx, src/app/(dashboard)/profile/ProfileSections.tsx
  Teammate 4: sentry.client.config.ts, sentry.server.config.ts, src/lib/auth.ts, src/app/(dashboard)/settings/SettingsSections.tsx
  Teammate 5: src/components/ui/WelcomeModal.tsx, src/components/ui/UsageBanner.tsx, src/app/(dashboard)/dashboard/page.tsx, src/lib/planStore.ts, src/app/(dashboard)/components/AppHeader.tsx
  Teammate 6: LICENSE, README.md, CONTRIBUTING.md, DEPLOY.md, CLAUDE.md, .gitignore, .mcp.json, capacitor.config.ts, .claude/skills/audit-rls/SKILL.md, mcp-server/src/api-key-lifecycle.e2e.test.ts, docs/plans/ (stale file cleanup)
```

---

## Teammate 1: Legal Pages

**Branch:** `feat/legal-pages`
**Worktree:** Yes

### Task 1.1: Create Terms of Service Page

**Files:**
- Create: `src/app/terms/page.tsx`

**Step 1: Create the Terms page as a server component**

Create `src/app/terms/page.tsx` with these sections. Use plain semantic HTML styled with Tailwind — no sticker components needed for legal pages. Add `export const metadata` for SEO.

```typescript
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Bullhorn Terms of Service',
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: February 25, 2026</p>
      {/* Sections below */}
    </div>
  )
}
```

Required sections (each as an `<h2>` with `<p>` content):

1. **Acceptance of Terms** — By using Bullhorn you agree to these terms
2. **Description of Service** — Bullhorn is a social media post scheduling and organization tool. Currently in beta. Service provided "as is."
3. **User Accounts** — Users are responsible for maintaining account security. One account per person.
4. **User Content** — Users retain full ownership of content they create. Bullhorn stores content solely to provide the service. Users are responsible for content they publish via the platform.
5. **Acceptable Use** — No spam, no illegal content, no automated abuse, no circumventing rate limits.
6. **Free and Pro Plans** — Free tier subject to resource limits (50 posts, 5 campaigns, 3 projects). Pro tier subject to payment terms (to be announced).
7. **Service Availability** — Beta service. No uptime guarantees. We may modify or discontinue features with notice.
8. **Data and Privacy** — See our Privacy Policy at /privacy for data handling details.
9. **Limitation of Liability** — Service provided "as is" without warranties. Not liable for damages arising from use.
10. **Termination** — Either party may terminate. User can delete account at any time via Profile settings. We may suspend accounts that violate these terms.
11. **Changes to Terms** — We may update these terms. Continued use constitutes acceptance.
12. **Contact** — support@bullhorn.to

Style: `prose` classes for readability, `text-foreground` for headings, `text-muted-foreground` for body, consistent spacing.

**Step 2: Commit**

```bash
git add src/app/terms/page.tsx
git commit -m "$(cat <<'EOF'
feat: add Terms of Service page
EOF
)"
```

---

### Task 1.2: Create Privacy Policy Page

**Files:**
- Create: `src/app/privacy/page.tsx`

**Step 1: Create the Privacy page as a server component**

Same structure as Terms. Required sections:

1. **Information We Collect**
   - Account data: email address, display name (via Google OAuth or email signup)
   - Content data: posts, campaigns, projects, blog drafts, launch posts, media uploads
   - Usage data: Vercel Analytics (page views, web vitals — anonymous)
   - Error data: Sentry captures JavaScript errors with stack traces (no PII)
2. **How We Use Your Data** — Solely to provide and improve the service. We do not sell user data. We do not use data for advertising.
3. **Third-Party Services**
   - Supabase (database, auth, storage) — US region
   - Vercel (hosting, analytics) — global CDN
   - Sentry (error monitoring) — US region
   - Google (OAuth authentication only)
4. **Cookies** — Authentication cookies (Supabase session), analytics cookies (Vercel). No third-party tracking cookies.
5. **Data Retention** — Data retained while account is active. Deleted data is permanently removed within 30 days. Backups purged within 90 days.
6. **Your Rights**
   - Access: View all your data in the app
   - Export: Download all data via Settings > Data Management (JSON/CSV)
   - Deletion: Delete your account via Profile > Danger Zone (cascades to all data)
   - Correction: Edit your profile and content at any time
7. **Data Security** — All data encrypted in transit (TLS). Row-level security on all database tables. OAuth tokens stored server-side.
8. **Children** — Service not intended for users under 13.
9. **Changes** — We may update this policy. Will notify via email for material changes.
10. **Contact** — privacy@bullhorn.to

**Step 2: Commit**

```bash
git add src/app/privacy/page.tsx
git commit -m "$(cat <<'EOF'
feat: add Privacy Policy page
EOF
)"
```

---

### Task 1.3: Add Cookie Consent Banner

**Files:**
- Create: `src/components/ui/CookieConsent.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Create CookieConsent component**

Create `src/components/ui/CookieConsent.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Only show if user hasn't accepted yet
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) {
      setVisible(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[100]',
        'bg-card border-t-[3px] border-border',
        'shadow-[0_-4px_0_hsl(var(--border))]',
        'p-4 md:px-8 animate-slide-up'
      )}
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">
          We use cookies for authentication and anonymous analytics.{' '}
          <Link href="/privacy" className="text-primary font-bold hover:underline">
            Privacy Policy
          </Link>
        </p>
        <button
          onClick={handleAccept}
          className={cn(
            'px-6 py-2 rounded-md font-bold text-sm whitespace-nowrap',
            'bg-primary text-primary-foreground',
            'border-[3px] border-border',
            'shadow-[3px_3px_0_hsl(var(--border))]',
            'hover:translate-y-[-1px] hover:shadow-[4px_4px_0_hsl(var(--border))]',
            'transition-all'
          )}
        >
          Accept
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Add CookieConsent to root layout**

In `src/app/layout.tsx`, add the import and render the component. Current layout (line 50-51):

```tsx
<body className="font-sans">
  <Providers>{children}</Providers>
```

Change to:

```tsx
<body className="font-sans">
  <Providers>{children}</Providers>
  <CookieConsent />
```

Add import at top:
```typescript
import { CookieConsent } from '@/components/ui/CookieConsent'
```

**Step 3: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/ui/CookieConsent.tsx src/app/layout.tsx
git commit -m "$(cat <<'EOF'
feat: add cookie consent banner with privacy policy link
EOF
)"
```

---

### Task 1.4: Add Legal Links to Login and Settings

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`

**Step 1: Add legal links below the login form**

At the bottom of the login page JSX (after the sign-up link), add:

```tsx
<p className="text-xs text-center text-muted-foreground mt-6">
  By signing in, you agree to our{' '}
  <Link href="/terms" className="text-primary font-bold hover:underline">
    Terms of Service
  </Link>{' '}
  and{' '}
  <Link href="/privacy" className="text-primary font-bold hover:underline">
    Privacy Policy
  </Link>
</p>
```

**Step 2: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/(auth)/login/page.tsx
git commit -m "$(cat <<'EOF'
feat: add Terms and Privacy links to login page
EOF
)"
```

---

## Teammate 2: Security Fixes

**Branch:** `fix/security-hardening`
**Worktree:** Yes

This teammate applies the security tasks from `docs/plans/2026-02-21-pre-launch-fixes.md`. The full implementation code is already in that plan document. Execute Tasks A1 through A7 exactly as written.

### Task 2.1: Fix OAuth CSRF Vulnerability

Follow Task A1 from `docs/plans/2026-02-21-pre-launch-fixes.md` exactly.

**Files:**
- Modify: `src/app/api/analytics/auth/url/route.ts`
- Modify: `src/app/api/analytics/auth/callback/route.ts`

**Summary:** Add HTTP-only cookie for OAuth state, validate state in callback. Full replacement code is in the plan.

**Commit:** `security: validate OAuth state parameter to prevent CSRF`

---

### Task 2.2: Fix Missing userId Ownership Check in Project Accounts

Follow Task A2 from `docs/plans/2026-02-21-pre-launch-fixes.md` exactly.

**Files:**
- Modify: `src/app/api/projects/[id]/accounts/route.ts`

**Summary:** Extract `userId` from auth in POST and DELETE handlers, add `.eq('user_id', userId)` to project verification queries.

**Commit:** `security: add user_id ownership check to project accounts POST/DELETE`

---

### Task 2.3: Fix Logo Route — Supabase Storage Migration

Follow Task A3 from `docs/plans/2026-02-21-pre-launch-fixes.md` exactly.

**Files:**
- Modify: `src/app/api/projects/[id]/logo/route.ts`

**Summary:** Rewrite logo route to use Supabase Storage instead of local filesystem. Remove SVG support (XSS vector). Add path traversal protection. Full replacement code is in the plan.

**Commit:** `security: migrate logos to Supabase Storage, remove SVG, fix path traversal`

---

### Task 2.4: Add Import Body Size Limits

Follow Task A4 from `docs/plans/2026-02-21-pre-launch-fixes.md` exactly.

**Files:**
- Modify: `src/app/api/import/route.ts`

**Summary:** Add `.max(500)` and `.max(100)` to Zod import schema arrays. Add `force-dynamic`.

**Commit:** `security: add max array size limits to import endpoint`

---

### Task 2.5: Clamp Limit Query Parameters

Follow Task A5 from `docs/plans/2026-02-21-pre-launch-fixes.md` exactly.

**Files:**
- Modify: `src/app/api/posts/route.ts`
- Modify: `src/app/api/blog-drafts/route.ts`
- Modify: `src/app/api/launch-posts/route.ts`
- Modify: `src/app/api/posts/search/route.ts`
- Modify: `src/app/api/blog-drafts/search/route.ts`

**Summary:** Replace `parseInt(searchParams.get('limit') || '50')` with clamped version: `Math.min(Math.max(parseInt(...) || 50, 1), 200)`

**Commit:** `security: clamp limit query params to max 200`

---

### Task 2.6: Gate Service Role Key Log Behind Development

Follow Task A6 from `docs/plans/2026-02-21-pre-launch-fixes.md` exactly.

**Files:**
- Modify: `src/lib/supabase/server.ts`

**Summary:** Wrap the `console.log` for API key prefix in `if (process.env.NODE_ENV === 'development')` and truncate prefix to 6 chars.

**Commit:** `fix: gate API key log behind development, reduce prefix length`

---

### Task 2.7: Add force-dynamic to Missing API Routes

Follow Task A7 from `docs/plans/2026-02-21-pre-launch-fixes.md` exactly.

**Files (add `export const dynamic = 'force-dynamic'` after imports):**
1. `src/app/api/api-keys/[id]/route.ts`
2. `src/app/api/push-tokens/route.ts`
3. `src/app/api/media/upload/route.ts`
4. `src/app/api/posts/[id]/archive/route.ts`
5. `src/app/api/posts/[id]/restore/route.ts`
6. `src/app/api/blog-drafts/[id]/archive/route.ts`
7. `src/app/api/blog-drafts/[id]/restore/route.ts`
8. `src/app/api/campaigns/[id]/posts/[postId]/route.ts`
9. `src/app/api/reminders/[id]/route.ts`
10. `src/app/api/blog-drafts/[id]/images/[filename]/route.ts`
11. `src/app/api/posts/reset/route.ts`

**Commit:** `fix: add force-dynamic to 11 API routes to prevent stale caching`

---

### Task 2.8: Run full validation

**Step 1:** Run `make check` (lint + typecheck)
**Step 2:** Run `make test-run` (unit tests)
**Step 3:** Fix any issues introduced by the changes

---

## Teammate 3: Account Deletion API

**Branch:** `feat/account-deletion-api`
**Worktree:** Yes

### Task 3.1: Create Server-Side Account Deletion Endpoint

**Files:**
- Create: `src/app/api/account/delete/route.ts`
- Create: `src/app/api/account/delete/route.test.ts`

**Step 1: Write failing test**

Create `src/app/api/account/delete/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAuth: () => mockRequireAuth() }))

const mockEq = vi.fn(() => ({ error: null }))
const mockDelete = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ delete: mockDelete }))
const mockDeleteUser = vi.fn().mockResolvedValue({ error: null })

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    auth: { admin: { deleteUser: mockDeleteUser } },
  })),
}))

import { POST } from './route'

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-123' })
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await POST(
      new Request('http://localhost/api/account/delete', { method: 'POST' })
    )
    expect(res.status).toBe(401)
  })

  it('deletes user data and auth, returns success', async () => {
    const res = await POST(
      new Request('http://localhost/api/account/delete', { method: 'POST' })
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockDeleteUser).toHaveBeenCalledWith('user-123')
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/account/delete/route.test.ts`
Expected: FAIL — route file doesn't exist.

**Step 3: Create the endpoint**

Create `src/app/api/account/delete/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/account/delete
 * Permanently deletes the authenticated user's account and all data.
 * Uses service role to delete from auth.users (cascades via FK).
 */
export async function POST() {
  try {
    const { userId } = await requireAuth()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    const adminClient = createSupabaseJsClient(supabaseUrl, serviceKey, {
      global: {
        fetch: (url: string | URL | Request, options?: RequestInit) =>
          fetch(url, { ...options, cache: 'no-store' }),
      },
    })

    // Delete user profile (cascades to posts, campaigns, projects, etc. via FK)
    const { error: profileError } = await adminClient
      .from('user_profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('Failed to delete user profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to delete account data' },
        { status: 500 }
      )
    }

    // Delete the auth user last
    const { error: authError } = await adminClient.auth.admin.deleteUser(userId)

    if (authError) {
      console.error('Failed to delete auth user:', authError)
      return NextResponse.json(
        {
          success: true,
          warning: 'Account data deleted but auth cleanup incomplete',
        },
        { status: 200 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Account deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/account/delete/route.test.ts`
Expected: All PASS.

**Step 5: Commit**

```bash
git add src/app/api/account/delete/route.ts src/app/api/account/delete/route.test.ts
git commit -m "$(cat <<'EOF'
feat: add server-side account deletion endpoint (GDPR right to erasure)
EOF
)"
```

---

### Task 3.2: Update Profile Page to Use the API Endpoint

**Files:**
- Modify: `src/app/(dashboard)/profile/page.tsx`

**Step 1: Replace client-side deletion with API call**

In `src/app/(dashboard)/profile/page.tsx`, replace the `handleDeleteAccount` function (lines 145-177). Currently it does client-side Supabase deletion. Replace with:

```typescript
const handleDeleteAccount = async () => {
  setDeleting(true)
  setError(null)

  // E2E Test Mode - simulate deletion and redirect
  if (process.env.NEXT_PUBLIC_E2E_TEST_MODE === 'true') {
    await new Promise((resolve) => setTimeout(resolve, 500))
    setShowDeleteDialog(false)
    router.push('/login')
    return
  }

  try {
    const res = await fetch('/api/account/delete', { method: 'POST' })
    const data = await res.json()

    if (!res.ok) {
      throw new Error(data.error || 'Failed to delete account')
    }

    // Sign out locally and redirect
    await supabase.auth.signOut()
    router.push('/login')
  } catch (err) {
    console.error('Error deleting account:', err)
    setError((err as Error).message || 'Failed to delete account. Please contact support.')
    setDeleting(false)
    setShowDeleteDialog(false)
  }
}
```

**Step 2: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/(dashboard)/profile/page.tsx
git commit -m "$(cat <<'EOF'
refactor: use server-side API for account deletion instead of client-side
EOF
)"
```

---

## Teammate 4: Monitoring

**Branch:** `fix/monitoring`
**Worktree:** Yes

### Task 4.1: Enable Sentry Tracing and Error Replays

**Files:**
- Modify: `sentry.client.config.ts`
- Modify: `sentry.server.config.ts`

**Step 1: Update client config**

In `sentry.client.config.ts`, change three values:

```
tracesSampleRate: 0          →  tracesSampleRate: 0.1
replaysSessionSampleRate: 0  →  replaysSessionSampleRate: 0
replaysOnErrorSampleRate: 0  →  replaysOnErrorSampleRate: 0.5
```

This captures 10% of transactions for performance monitoring and replays 50% of error sessions for debugging.

**Step 2: Update server config**

In `sentry.server.config.ts`, add `tracesSampleRate: 0.1` to the `Sentry.init()` call.

**Step 3: Commit**

```bash
git add sentry.client.config.ts sentry.server.config.ts
git commit -m "$(cat <<'EOF'
fix: enable Sentry tracing at 10% and error replays at 50%
EOF
)"
```

---

### Task 4.2: Add Sentry User Context on Authentication

**Files:**
- Modify: `src/lib/auth.ts`

**Step 1: Set Sentry user context after successful auth**

In `src/lib/auth.ts`, add import at top:

```typescript
import * as Sentry from '@sentry/nextjs'
```

In `requireAuth()`, after the successful cookie-based auth return (line 189), add Sentry context before returning:

Replace:
```typescript
  return { userId: user.id }
```

With:
```typescript
  Sentry.setUser({ id: user.id })
  return { userId: user.id }
```

Also add it after the API key resolution (after line 175):

Replace:
```typescript
    return resolveApiKey(apiKey)
```

With:
```typescript
    const resolved = await resolveApiKey(apiKey)
    Sentry.setUser({ id: resolved.userId })
    return resolved
```

**Step 2: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/lib/auth.ts
git commit -m "$(cat <<'EOF'
fix: set Sentry user context on authentication for better error tracking
EOF
)"
```

---

### Task 4.3: Fix About Section — Remove Stale Copy

**Files:**
- Modify: `src/app/(dashboard)/settings/SettingsSections.tsx`

**Step 1: Update the AboutSection component**

The current About section (lines 163-191) has stale copy: "All data is stored locally in your browser" (step 3) — this is wrong, data is in Supabase. Replace the `AboutSection` function:

```typescript
export function AboutSection() {
  return (
    <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-[4px_4px_0_hsl(var(--border))]">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
        ℹ️ About
      </h2>
      <ul className="space-y-3 text-sm text-muted-foreground">
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 border border-primary/30">
            1
          </span>
          <span>Create and organize your social media post ideas.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 border border-primary/30">
            2
          </span>
          <span>Schedule posts and get reminded when they&apos;re due.</span>
        </li>
        <li className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 border border-primary/30">
            3
          </span>
          <span>Your data is securely stored and encrypted in the cloud.</span>
        </li>
      </ul>
      <div className="mt-4 pt-4 border-t border-border flex gap-4 text-xs text-muted-foreground">
        <a href="/terms" className="hover:text-primary font-bold">
          Terms of Service
        </a>
        <a href="/privacy" className="hover:text-primary font-bold">
          Privacy Policy
        </a>
      </div>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/app/(dashboard)/settings/SettingsSections.tsx
git commit -m "$(cat <<'EOF'
fix: update About section copy and add legal links
EOF
)"
```

---

## Teammate 5: Onboarding + UX Polish

**Branch:** `feat/onboarding`
**Worktree:** Yes

### Task 5.1: Add Usage Limit Warning to Plan Store

**Files:**
- Modify: `src/lib/planStore.ts`

**Step 1: Add `isNearLimit` computed property**

In `src/lib/planStore.ts`, add a new action to the `PlanActions` interface (after line 22):

```typescript
isNearAnyLimit: () => { resource: string; current: number; limit: number } | null
```

Add the implementation (after the `reset` function, before the closing `})`):

```typescript
isNearAnyLimit: () => {
  const state = get()
  const resources = Object.entries(state.limits) as [string, LimitInfo][]
  for (const [resource, info] of resources) {
    if (info.limit > 0 && info.current / info.limit >= 0.8) {
      return { resource, current: info.current, limit: info.limit }
    }
  }
  return null
},
```

**Step 2: Commit**

```bash
git add src/lib/planStore.ts
git commit -m "$(cat <<'EOF'
feat: add isNearAnyLimit to plan store for usage warnings
EOF
)"
```

---

### Task 5.2: Create Usage Warning Banner

**Files:**
- Create: `src/components/ui/UsageBanner.tsx`

**Step 1: Create the component**

Create `src/components/ui/UsageBanner.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, X } from 'lucide-react'
import { usePlanStore } from '@/lib/planStore'
import { RESOURCE_LABELS } from '@/lib/limits'
import { cn } from '@/lib/utils'

export function UsageBanner() {
  const { fetchPlan, initialized, isNearAnyLimit } = usePlanStore()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!initialized) fetchPlan()
  }, [initialized, fetchPlan])

  const nearLimit = isNearAnyLimit()

  if (!nearLimit || dismissed) return null

  const label =
    RESOURCE_LABELS[nearLimit.resource as keyof typeof RESOURCE_LABELS] || nearLimit.resource

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5',
        'bg-sticker-orange/10 border-b-2 border-sticker-orange/30',
        'text-sm'
      )}
    >
      <AlertTriangle className="w-4 h-4 text-sticker-orange flex-shrink-0" />
      <p className="flex-1 text-foreground">
        <span className="font-bold">{label}:</span> {nearLimit.current} of{' '}
        {nearLimit.limit} used.{' '}
        <Link href="/settings" className="text-primary font-bold hover:underline">
          View plan details
        </Link>
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="p-1 rounded hover:bg-sticker-orange/20 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add src/components/ui/UsageBanner.tsx
git commit -m "$(cat <<'EOF'
feat: add usage warning banner for plan limits
EOF
)"
```

---

### Task 5.3: Add Usage Banner to App Header

**Files:**
- Modify: `src/app/(dashboard)/components/AppHeader.tsx`

**Step 1: Add UsageBanner below the header**

In `src/app/(dashboard)/components/AppHeader.tsx`, import and render the banner. At the top of the file add:

```typescript
import { UsageBanner } from '@/components/ui/UsageBanner'
```

In the `AppHeader` component, wrap the return in a fragment and add `<UsageBanner />` after the `</header>` closing tag:

```tsx
return (
  <>
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b-[3px] border-border">
      {/* ... existing header content ... */}
    </header>
    <UsageBanner />
  </>
)
```

**Step 2: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/(dashboard)/components/AppHeader.tsx
git commit -m "$(cat <<'EOF'
feat: show usage limit banner below app header
EOF
)"
```

---

### Task 5.4: Create Welcome Modal for New Users

**Files:**
- Create: `src/components/ui/WelcomeModal.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Step 1: Create WelcomeModal component**

Create `src/components/ui/WelcomeModal.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, FileText, FolderOpen, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export function WelcomeModal() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const completed = localStorage.getItem('onboarding_complete')
    if (!completed) {
      setVisible(true)
    }
  }, [])

  const handleDismiss = () => {
    localStorage.setItem('onboarding_complete', 'true')
    setVisible(false)
  }

  if (!visible) return null

  const steps = [
    {
      icon: FileText,
      title: 'Draft your posts',
      description: 'Write content for Twitter, LinkedIn, and Reddit with platform-specific formatting.',
    },
    {
      icon: FolderOpen,
      title: 'Organize with campaigns',
      description: 'Group related posts into campaigns and projects for easy management.',
    },
    {
      icon: Calendar,
      title: 'Schedule & track',
      description: 'Set publish dates and track your content pipeline from draft to published.',
    },
  ]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div
        className={cn(
          'w-full max-w-md',
          'bg-card rounded-lg',
          'border-[3px] border-border',
          'shadow-[6px_6px_0_hsl(var(--border))]',
          'p-6 relative'
        )}
      >
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 rounded hover:bg-secondary transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="text-center mb-6">
          <div className="text-4xl mb-3">📢</div>
          <h2 className="text-xl font-extrabold">Welcome to Bullhorn</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your social media command center
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className={cn(
                  'w-8 h-8 rounded-md flex-shrink-0',
                  'bg-primary/10 flex items-center justify-center',
                  'border-2 border-primary/30'
                )}
              >
                <step.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Link
          href="/new"
          onClick={handleDismiss}
          className={cn(
            'block w-full text-center px-4 py-3 rounded-md',
            'bg-primary text-primary-foreground font-bold',
            'border-[3px] border-border',
            'shadow-[3px_3px_0_hsl(var(--border))]',
            'hover:translate-y-[-1px] hover:shadow-[4px_4px_0_hsl(var(--border))]',
            'transition-all'
          )}
        >
          Create Your First Post
        </Link>

        <button
          onClick={handleDismiss}
          className="w-full text-center text-sm text-muted-foreground font-medium mt-3 hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Add WelcomeModal to dashboard page**

In `src/app/(dashboard)/dashboard/page.tsx`, add import at top:

```typescript
import { WelcomeModal } from '@/components/ui/WelcomeModal'
```

Add `<WelcomeModal />` at the very beginning of the returned JSX (line 178), before the outer `<div>`:

```tsx
return (
  <>
    <WelcomeModal />
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-6 max-w-5xl mx-auto">
```

And close the fragment at the end:

```tsx
    </div>
  </>
)
```

**Step 3: Run typecheck**

Run: `make typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/ui/WelcomeModal.tsx src/app/(dashboard)/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat: add welcome modal onboarding for new users
EOF
)"
```

---

## Teammate 6: Open Source Prep

**Branch:** `chore/open-source-prep`
**Worktree:** Yes

### Task 6.1: Add AGPL-3.0 License

**Files:**
- Create: `LICENSE`

**Step 1: Create the LICENSE file**

Create `LICENSE` with the full text of the GNU Affero General Public License v3.0. Use the exact text from https://www.gnu.org/licenses/agpl-3.0.txt. Set the copyright line to:

```
Copyright (C) 2026 Mean Weasel LLC
```

**Step 2: Commit**

```bash
git add LICENSE
git commit -m "$(cat <<'EOF'
chore: add AGPL-3.0 license
EOF
)"
```

---

### Task 6.2: Harden .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Add missing entries to .gitignore**

Append these entries to the end of `.gitignore`:

```gitignore
# Apple signing keys and certificates
*.p8
*.pem
*.p12
*.cer
*.mobileprovision

# iOS build artifacts
*.ipa
*.dSYM.zip
ios/App/build/

# App Store Connect config
.asc/

# Screenshots (debug/temp)
screenshots/

# Deployment config (private)
DEPLOY.md
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "$(cat <<'EOF'
chore: harden .gitignore for open-source (signing keys, build artifacts, deploy config)
EOF
)"
```

---

### Task 6.3: Redact Supabase Project Ref from Tracked Files

The Supabase project ref `jvoppjybagyeffklbohr` is hardcoded in 4 files. Replace with a placeholder so contributors know to set their own.

**Files:**
- Modify: `.mcp.json`
- Modify: `CLAUDE.md`
- Modify: `.claude/skills/audit-rls/SKILL.md`
- Modify: `mcp-server/src/api-key-lifecycle.e2e.test.ts`

**Step 1: Replace in `.mcp.json`**

Replace:
```json
"SUPABASE_PROJECT_REF": "jvoppjybagyeffklbohr"
```

With:
```json
"SUPABASE_PROJECT_REF": "<your-supabase-project-ref>"
```

**Step 2: Replace in `CLAUDE.md`**

Find `jvoppjybagyeffklbohr` and replace with `<your-supabase-project-ref>`.

**Step 3: Replace in `.claude/skills/audit-rls/SKILL.md`**

Find `jvoppjybagyeffklbohr` and replace with `<your-supabase-project-ref>`.

**Step 4: Replace in `mcp-server/src/api-key-lifecycle.e2e.test.ts`**

Find `jvoppjybagyeffklbohr` and replace with `<your-supabase-project-ref>`.

**Step 5: Commit**

```bash
git add .mcp.json CLAUDE.md .claude/skills/audit-rls/SKILL.md mcp-server/src/api-key-lifecycle.e2e.test.ts
git commit -m "$(cat <<'EOF'
chore: replace hardcoded Supabase project ref with placeholder
EOF
)"
```

---

### Task 6.4: Move Google OAuth Client IDs to Env Vars in capacitor.config.ts

Google OAuth client IDs are public (embedded in every app bundle), but using env vars makes it cleaner for contributors to set up their own.

**Files:**
- Modify: `capacitor.config.ts`

**Step 1: Replace hardcoded IDs with env var references**

Current (lines 37-38):
```typescript
google: {
  iOSClientId: '95354811469-3hvu64aje2dnp1oj3fiv4cqd2ajcr0qc.apps.googleusercontent.com',
  webClientId: '95354811469-6dk6cb54kuee0t91dtsiu9mndumk14jv.apps.googleusercontent.com',
},
```

Replace with:
```typescript
google: {
  iOSClientId: process.env.GOOGLE_IOS_CLIENT_ID || '',
  webClientId: process.env.GOOGLE_WEB_CLIENT_ID || '',
},
```

**Note:** The `ios/App/App/Info.plist` also contains the reversed iOS client ID in `CFBundleURLSchemes`. This is generated by `npx cap sync` and is fine to leave as-is — it's build-time config that each contributor will have their own copy of. Document this in CONTRIBUTING.md.

**Step 2: Commit**

```bash
git add capacitor.config.ts
git commit -m "$(cat <<'EOF'
chore: move Google OAuth client IDs to env vars in capacitor config
EOF
)"
```

---

### Task 6.5: Split Deploy/Signing Sections from CLAUDE.md to DEPLOY.md

Move the private deployment instructions (App Store Connect keys, signing prerequisites, TestFlight upload commands) out of the public `CLAUDE.md` into a gitignored `DEPLOY.md`.

**Files:**
- Create: `DEPLOY.md`
- Modify: `CLAUDE.md`

**Step 1: Create DEPLOY.md**

Create `DEPLOY.md` with the following content extracted from `CLAUDE.md`:

1. The **iOS Build & TestFlight** section (from "### Prerequisites" through the `xcrun altool --upload-app` command) — contains ASC API key ID `X9Z3DHN64Y` and issuer ID `36da0220-c107-4a01-aa33-63ff5f110172`
2. The **Versioning** subsection
3. The **TestFlight** subsection
4. The **App Store Connect CLI (`asc`)** section
5. The **Signing Prerequisites** subsection
6. The **iOS Build & Deploy** code block (the second one under "## iOS App (Capacitor)")

Add a header:
```markdown
# Bullhorn Deploy Guide (Private)

> This file is gitignored. It contains deployment secrets and signing config.
> See CLAUDE.md for public development instructions.
```

**Step 2: Replace removed sections in CLAUDE.md**

In `CLAUDE.md`, replace the extracted sections with:

```markdown
### iOS Build & Deploy

See `DEPLOY.md` (gitignored) for build commands, TestFlight upload, and signing configuration.

Contributors: You will need your own Apple Developer account and App Store Connect API key. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions.
```

Keep the following in CLAUDE.md (they're not sensitive):
- The `## iOS App (Capacitor)` header and the bullet points about mode, platform detection, bundle ID, team ID, Apple App ID
- The **Local iOS Testing** section (uses localhost, no secrets)

**Step 3: Commit**

```bash
git add DEPLOY.md CLAUDE.md
git commit -m "$(cat <<'EOF'
chore: split private deploy/signing config from CLAUDE.md to DEPLOY.md (gitignored)
EOF
)"
```

---

### Task 6.6: Delete Stale Plan Docs

**Files:**
- Delete: `docs/plans/2026-02-16-beta-readiness-remediation-design.md` (superseded by this plan)
- Delete: `docs/plans/2026-02-16-beta-readiness-remediation.md` (superseded by this plan)
- Delete: `docs/plans/2026-02-17-ios-app-store-design.md` (completed — TestFlight Build 2 uploaded)
- Delete: `docs/plans/2026-02-17-ios-app-store-plan.md` (completed — TestFlight Build 2 uploaded)
- Delete: `docs/plans/2026-02-19-asc-internal-groups-pr.md` (external PR for asc CLI, not Bullhorn)
- Delete: `docs/plans/cross-repo-setup.md` (lists private repos — must not be public)

Keep:
- `2026-02-20-performance-optimizations.md` (not yet applied)
- `2026-02-21-dependency-vulnerability-fixes.md` (partially applied, still useful)
- `2026-02-21-pre-launch-fixes.md` (referenced by Teammate 2)
- `2026-02-25-beta-launch-plan.md` (this plan)
- `semantic-release-setup.md` (general guide, useful for contributors)

**Step 1: Delete the stale files**

```bash
git rm docs/plans/2026-02-16-beta-readiness-remediation-design.md
git rm docs/plans/2026-02-16-beta-readiness-remediation.md
git rm docs/plans/2026-02-17-ios-app-store-design.md
git rm docs/plans/2026-02-17-ios-app-store-plan.md
git rm docs/plans/2026-02-19-asc-internal-groups-pr.md
git rm docs/plans/cross-repo-setup.md
```

**Step 2: Commit**

```bash
git commit -m "$(cat <<'EOF'
chore: remove stale and completed plan docs before open-sourcing
EOF
)"
```

---

### Task 6.7: Create CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

**Step 1: Create CONTRIBUTING.md**

```markdown
# Contributing to Bullhorn

Thanks for your interest in contributing to Bullhorn! This guide will help you get set up.

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Vercel](https://vercel.com) account (for deployment, optional for local dev)

## Local Development Setup

1. **Fork and clone** the repository

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env.local
   ```
   Fill in your Supabase URL, anon key, and service role key. See `docs/environment-variables.md` for all options.

4. **Start the dev server:**
   ```bash
   make dev
   ```

5. **Run checks before committing:**
   ```bash
   make ci    # lint + typecheck + tests
   ```

## Code Style

- **Prettier** handles formatting (runs automatically via pre-commit hook)
- **ESLint** enforces code quality rules
- **TypeScript** strict mode — no `any` types
- Run `make fix` to auto-fix lint and formatting issues

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/). A commitlint hook validates your messages.

| Prefix | When to use |
|--------|-------------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `chore:` | Maintenance, deps |
| `refactor:` | Code restructure |
| `docs:` | Documentation |
| `test:` | Tests |

## Testing

```bash
make test          # Unit tests (watch mode)
make test-run      # Unit tests (single run)
make test-e2e      # E2E tests (Playwright)
```

## Project Structure

See `CLAUDE.md` for a detailed architecture overview including:
- App Router structure
- API route patterns
- Zustand store patterns
- Design system (sticker bomb aesthetic)

## iOS Development (Optional)

The iOS app is a Capacitor 8 wrapper. To work on it:
1. Set `GOOGLE_IOS_CLIENT_ID` and `GOOGLE_WEB_CLIENT_ID` in your environment
2. Run `npx cap sync ios` to generate the Xcode project
3. You'll need your own Apple Developer account for signing

## Pull Requests

1. Create a feature branch from `main`
2. Make your changes with tests
3. Run `make ci` to verify everything passes
4. Open a PR with a clear description
5. PRs require passing CI before merge

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
```

**Step 2: Create `.env.example`**

Create `.env.example` with placeholder values for all required env vars:

```bash
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Sentry (recommended)
SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# Upstash Redis — rate limiting (recommended, optional)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Google OAuth — iOS Capacitor (optional, for iOS dev only)
GOOGLE_IOS_CLIENT_ID=
GOOGLE_WEB_CLIENT_ID=
```

**Step 3: Commit**

```bash
git add CONTRIBUTING.md .env.example
git commit -m "$(cat <<'EOF'
docs: add CONTRIBUTING.md and .env.example for open-source contributors
EOF
)"
```

---

### Task 6.8: Create README.md

**Files:**
- Create: `README.md`

**Step 1: Create README.md**

```markdown
# Bullhorn

> Social media post scheduler for Twitter, LinkedIn, and Reddit.

Bullhorn helps builders, indie hackers, and product engineers plan, draft, and schedule their social media content. Organize posts into campaigns and projects, schedule publish dates, and manage your content pipeline from idea to published.

**Live at [bullhorn.to](https://bullhorn.to)**

## Features

- **Multi-platform drafting** — Write posts for Twitter, LinkedIn, and Reddit with platform-specific formatting and character limits
- **Campaigns & projects** — Organize posts into campaigns, group campaigns into projects
- **Scheduling** — Set publish dates and track your content pipeline
- **Blog drafts** — Write long-form content with Markdown support
- **Launch posts** — Dedicated workspace for product launch announcements
- **Media uploads** — Attach images to posts with Supabase Storage
- **API & MCP** — Programmatic access via API keys, plus an MCP server for AI-native workflows
- **iOS app** — Native iOS app via Capacitor (TestFlight)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| State | Zustand |
| Styling | Tailwind CSS |
| Hosting | Vercel |
| iOS | Capacitor 8 |
| Monitoring | Sentry |

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in your Supabase credentials

# Start dev server
make dev
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed setup instructions.

## Development

```bash
make dev          # Start dev server
make check        # Lint + typecheck
make test         # Unit tests (watch)
make test-e2e     # E2E tests
make ci           # Full CI checks
```

Run `make help` to see all available commands.

## Architecture

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation including app structure, API patterns, store patterns, and design system.

## License

[AGPL-3.0](LICENSE)

Copyright (C) 2026 Mean Weasel LLC
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: add README.md for open-source repository
EOF
)"
```

---

### Task 6.9: Run Validation

**Step 1:** Run `make check` (lint + typecheck)
**Step 2:** Run `make test-run` (unit tests)
**Step 3:** Verify no Supabase project ref `jvoppjybagyeffklbohr` remains in tracked files:

```bash
git grep 'jvoppjybagyeffklbohr' -- ':!DEPLOY.md'
```

Expected: No matches (DEPLOY.md is gitignored and excluded).

**Step 4:** Verify no ASC key IDs remain in public files:

```bash
git grep 'X9Z3DHN64Y\|36da0220' -- ':!DEPLOY.md'
```

Expected: No matches.

---

## Final Verification (Lead — after all worktrees merge)

### Step 1: Merge all branches into main working branch

```bash
git merge feat/legal-pages
git merge fix/security-hardening
git merge feat/account-deletion-api
git merge fix/monitoring
git merge feat/onboarding
git merge chore/open-source-prep
```

### Step 2: Run full CI

```bash
make ci
```

Expected: All lint, typecheck, and test checks pass.

### Step 3: Run production build

```bash
make build
```

Expected: Build succeeds.

### Step 4: Apply any pending database migrations

```bash
doppler run -- supabase db push
```

### Step 5: Deploy and smoke test

1. Deploy to Vercel preview
2. Visit /terms — renders Terms of Service
3. Visit /privacy — renders Privacy Policy
4. Cookie consent banner appears on first visit
5. Login page shows legal links
6. Settings About section has correct copy and legal links
7. Profile > Delete Account calls API endpoint
8. Dashboard shows welcome modal on first visit
9. Usage banner appears when near plan limits
10. Sentry receives test errors (check sentry.io dashboard)

### Step 6: Open-source verification

1. `LICENSE` file exists at repo root with AGPL-3.0 text
2. `README.md` renders correctly on GitHub with features, tech stack, and setup instructions
3. `CONTRIBUTING.md` has clear setup guide with `.env.example` reference
4. `DEPLOY.md` is gitignored (not visible on GitHub)
5. No Supabase project refs in public files: `git grep 'jvoppjybagyeffklbohr' -- ':!DEPLOY.md'` returns nothing
6. No ASC key IDs in public files: `git grep 'X9Z3DHN64Y\|36da0220' -- ':!DEPLOY.md'` returns nothing
7. Stale plan docs removed (only 4 active plans + semantic-release guide remain)
8. `capacitor.config.ts` uses env vars for Google Client IDs

### Step 7: Beta tester invitation

Once smoke test passes, invite beta testers via email whitelist (`ALLOWED_EMAILS` env var in Vercel).

### Step 8: Make repository public

Once beta is stable and all verification passes, flip the GitHub repo to public.
