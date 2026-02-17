# Beta Readiness Remediation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address all security, testing, MCP, and infrastructure findings from the beta readiness audit.

**Architecture:** 12 independent tasks across 4 groups, designed for maximum parallelism. Groups A (security), B (MCP), C (CI) have zero dependencies between them. Group D (tests) is independent of all other groups and internally parallelizable.

**Tech Stack:** Next.js 14, Vitest, Playwright, Supabase, MCP SDK, TypeScript

---

## Parallelization Map

```
Groups A + B + C can all run simultaneously (6 tasks, 0 dependencies)
Group D can run simultaneously with A/B/C (6 tasks, 0 internal dependencies)

Total: 12 tasks, all independently executable
```

---

## Group A — Security Fixes

### Task 1: Fix CSP — Remove `unsafe-eval` in Production

**Files:**
- Modify: `next.config.js:50-60`

**Step 1: Update CSP to be environment-conditional**

Replace the hardcoded CSP block with a conditional one. The key change is removing `unsafe-eval` and `unsafe-inline` from `script-src` in production. `style-src 'unsafe-inline'` must stay because Next.js injects inline styles.

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
      },
    ],
  },

  async headers() {
    const isDev = process.env.NODE_ENV === 'development'

    // In dev, Next.js needs unsafe-eval for hot reload and unsafe-inline for HMR scripts
    // In production, lock down to self only
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self'"

    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "font-src 'self' https://fonts.gstatic.com",
      "frame-ancestors 'none'",
    ].join('; ')

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
```

Note: The old config had a duplicate CSP header (one with just `frame-ancestors 'none'` and another with the full policy). This consolidates into a single header.

**Step 2: Test the production build**

Run: `make build`
Expected: Build succeeds with no CSP-related errors.

**Step 3: Commit**

```bash
git add next.config.js
git commit -m "security: remove unsafe-eval from production CSP"
```

---

### Task 2: Fix Rate Limiting — Fail Closed in Production

**Files:**
- Modify: `src/lib/rateLimit.ts:49-62`
- Create: `src/lib/rateLimit.test.ts`

**Step 1: Write failing tests for the new behavior**

Create `src/lib/rateLimit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Upstash modules before importing
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: vi.fn().mockImplementation(() => ({
    limit: vi.fn().mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 10000,
    }),
  })),
}))

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(),
}))

describe('rateLimit', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  it('allows requests when Redis is configured', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.com')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
    vi.stubEnv('NODE_ENV', 'production')
    const { rateLimit } = await import('./rateLimit')
    const result = await rateLimit('test-user')
    expect(result.success).toBe(true)
  })

  it('denies requests in production when Redis is not configured', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.stubEnv('NODE_ENV', 'production')
    const { rateLimit } = await import('./rateLimit')
    const result = await rateLimit('test-user')
    expect(result.success).toBe(false)
  })

  it('allows requests in development when Redis is not configured', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.stubEnv('NODE_ENV', 'development')
    const { rateLimit } = await import('./rateLimit')
    const result = await rateLimit('test-user')
    expect(result.success).toBe(true)
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/rateLimit.test.ts`
Expected: "denies requests in production" test FAILS (currently returns `success: true`).

**Step 3: Fix the rateLimit function**

In `src/lib/rateLimit.ts`, change lines 52-61 to fail closed in production:

```typescript
export async function rateLimit(identifier: string): Promise<RateLimitResult> {
  const limiter = getRatelimit()

  if (!limiter) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        `[rateLimit] CRITICAL: Upstash Redis is not configured in production. Blocking request for identifier: ${identifier}`
      )
      return { success: false, limit: 0, remaining: 0, reset: 0 }
    }
    // In development, allow through with a warning
    console.warn('[rateLimit] Upstash Redis is not configured — rate limiting is disabled')
    return { success: true, limit: 10, remaining: 10, reset: 0 }
  }

  const result = await limiter.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/rateLimit.test.ts`
Expected: All 3 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/rateLimit.ts src/lib/rateLimit.test.ts
git commit -m "security: fail closed on rate limiting in production when Redis unavailable"
```

---

### Task 3: Add `force-dynamic` to All GET API Routes

**Files to modify** (29 routes — add `export const dynamic = 'force-dynamic'` after imports):

```
src/app/api/posts/route.ts
src/app/api/posts/[id]/route.ts
src/app/api/posts/search/route.ts
src/app/api/campaigns/route.ts
src/app/api/campaigns/[id]/route.ts
src/app/api/campaigns/[id]/posts/route.ts
src/app/api/projects/route.ts
src/app/api/projects/[id]/route.ts
src/app/api/projects/[id]/accounts/route.ts
src/app/api/projects/[id]/analytics/route.ts
src/app/api/projects/[id]/campaigns/route.ts
src/app/api/blog-drafts/route.ts
src/app/api/blog-drafts/[id]/route.ts
src/app/api/blog-drafts/search/route.ts
src/app/api/blog-drafts/[id]/images/route.ts
src/app/api/launch-posts/route.ts
src/app/api/launch-posts/[id]/route.ts
src/app/api/media/[filename]/route.ts
src/app/api/api-keys/route.ts
src/app/api/export/route.ts
src/app/api/reminders/route.ts
src/app/api/notification-preferences/route.ts
src/app/api/analytics/connections/route.ts
src/app/api/analytics/connections/[id]/route.ts
src/app/api/analytics/connections/[id]/report/route.ts
src/app/api/analytics/properties/route.ts
src/app/api/analytics/auth/url/route.ts
src/app/api/analytics/auth/callback/route.ts
src/app/api/health/route.ts
```

Already have it (skip): `src/app/api/media/route.ts`, `src/app/api/plan/route.ts`

**Step 1: Add the export to each file**

For each file above, add after the last import statement:

```typescript
export const dynamic = 'force-dynamic'
```

**Step 2: Verify build**

Run: `make build`
Expected: Build succeeds.

**Step 3: Verify typecheck**

Run: `make typecheck`
Expected: No type errors.

**Step 4: Commit**

```bash
git add src/app/api/
git commit -m "fix: add force-dynamic to all GET API routes to prevent stale cached data"
```

---

## Group B — MCP Improvements

### Task 4: Add Platform-Specific Content Validation to MCP

**Files:**
- Modify: `mcp-server/src/index.ts` (create_post handler ~line 1033, update_post handler)
- Create: `mcp-server/src/handlers-validation.test.ts`

**Step 1: Write failing tests**

Create `mcp-server/src/handlers-validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validatePostContent } from './validation'

describe('validatePostContent', () => {
  describe('twitter', () => {
    it('accepts valid twitter content', () => {
      const result = validatePostContent('twitter', { text: 'Hello world' })
      expect(result).toBeNull()
    })

    it('rejects twitter content without text', () => {
      const result = validatePostContent('twitter', { mediaUrls: ['url'] })
      expect(result).toContain('text')
    })

    it('rejects empty twitter text', () => {
      const result = validatePostContent('twitter', { text: '' })
      expect(result).toContain('text')
    })
  })

  describe('linkedin', () => {
    it('accepts valid linkedin content', () => {
      const result = validatePostContent('linkedin', { text: 'Hello', visibility: 'public' })
      expect(result).toBeNull()
    })

    it('rejects linkedin content without text', () => {
      const result = validatePostContent('linkedin', { visibility: 'public' })
      expect(result).toContain('text')
    })

    it('rejects invalid visibility value', () => {
      const result = validatePostContent('linkedin', { text: 'Hi', visibility: 'private' })
      expect(result).toContain('visibility')
    })

    it('accepts linkedin content without visibility (defaults server-side)', () => {
      const result = validatePostContent('linkedin', { text: 'Hello' })
      expect(result).toBeNull()
    })
  })

  describe('reddit', () => {
    it('accepts valid reddit content', () => {
      const result = validatePostContent('reddit', { subreddit: 'test', title: 'Hello' })
      expect(result).toBeNull()
    })

    it('rejects reddit content without subreddit', () => {
      const result = validatePostContent('reddit', { title: 'Hello' })
      expect(result).toContain('subreddit')
    })

    it('rejects reddit content without title', () => {
      const result = validatePostContent('reddit', { subreddit: 'test' })
      expect(result).toContain('title')
    })
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd mcp-server && npx vitest run src/handlers-validation.test.ts`
Expected: FAIL — module `./validation` doesn't exist.

**Step 3: Create validation module**

Create `mcp-server/src/validation.ts`:

```typescript
type Platform = 'twitter' | 'linkedin' | 'reddit'

/**
 * Validate platform-specific content shape.
 * Returns null if valid, or an error message string if invalid.
 */
export function validatePostContent(
  platform: Platform,
  content: Record<string, unknown>
): string | null {
  switch (platform) {
    case 'twitter': {
      if (!content.text || typeof content.text !== 'string' || content.text.trim() === '') {
        return 'Twitter content requires a non-empty "text" field. Expected: { text: string, mediaUrls?: string[] }'
      }
      return null
    }
    case 'linkedin': {
      if (!content.text || typeof content.text !== 'string' || content.text.trim() === '') {
        return 'LinkedIn content requires a non-empty "text" field. Expected: { text: string, visibility?: "public" | "connections", mediaUrl?: string }'
      }
      if (
        content.visibility !== undefined &&
        content.visibility !== 'public' &&
        content.visibility !== 'connections'
      ) {
        return 'LinkedIn visibility must be "public" or "connections". Expected: { text: string, visibility?: "public" | "connections" }'
      }
      return null
    }
    case 'reddit': {
      const missing: string[] = []
      if (!content.subreddit || typeof content.subreddit !== 'string') missing.push('subreddit')
      if (!content.title || typeof content.title !== 'string') missing.push('title')
      if (missing.length > 0) {
        return `Reddit content requires: ${missing.join(', ')}. Expected: { subreddit: string, title: string, body?: string, url?: string }`
      }
      return null
    }
    default:
      return `Unknown platform: ${platform}`
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npx vitest run src/handlers-validation.test.ts`
Expected: All tests PASS.

**Step 5: Integrate validation into create_post handler**

In `mcp-server/src/index.ts`, after the existing content validation (~line 1050), add:

```typescript
import { validatePostContent } from './validation'

// Inside create_post handler, after the `if (!content || typeof content !== 'object')` check:
const contentError = validatePostContent(platform, content as Record<string, unknown>)
if (contentError) {
  return {
    content: [{ type: 'text', text: `Error: ${contentError}` }],
    isError: true,
  }
}
```

Also add the same validation to the `update_post` handler when both `platform` and `content` are provided.

**Step 6: Run full MCP test suite**

Run: `cd mcp-server && npx vitest run`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add mcp-server/src/validation.ts mcp-server/src/handlers-validation.test.ts mcp-server/src/index.ts
git commit -m "feat: add platform-specific content validation to MCP post tools"
```

---

### Task 5: Update MCP Documentation

**Files:**
- Modify: `mcp-server/README.md`
- Modify: `src/app/docs/mcp/page.tsx`

**Step 1: Add rate limits, plan limits, and examples to README**

Add after the existing "Environment Variables" section in `mcp-server/README.md`:

```markdown
## Rate Limits

API requests are rate-limited to **10 requests per 10 seconds** per API key using a sliding window algorithm. If exceeded, requests return HTTP 429 with a `Retry-After` header.

## Plan Limits

Resource creation is subject to plan limits:

| Resource | Free Plan | Pro Plan |
|----------|-----------|----------|
| Posts | 50 | 500 |
| Campaigns | 5 | 50 |
| Projects | 3 | 20 |
| Blog Drafts | 10 | 100 |
| Launch Posts | 10 | 100 |
| Storage | 50 MB | 2 GB |

When a limit is reached, creation tools return an error with the current usage.

## Tool Examples

### Create a Twitter Post

```json
{
  "tool": "create_post",
  "arguments": {
    "platform": "twitter",
    "content": { "text": "Launching our new feature today!" },
    "status": "draft"
  }
}
```

### Create a LinkedIn Post

```json
{
  "tool": "create_post",
  "arguments": {
    "platform": "linkedin",
    "content": {
      "text": "Excited to announce our Series A funding!",
      "visibility": "public"
    },
    "status": "scheduled",
    "scheduledAt": "2026-03-01T09:00:00Z"
  }
}
```

### Create a Reddit Post

```json
{
  "tool": "create_post",
  "arguments": {
    "platform": "reddit",
    "content": {
      "subreddit": "SideProject",
      "title": "Show r/SideProject: I built a social media scheduler",
      "body": "After 6 months of development..."
    },
    "status": "draft"
  }
}
```

### Create Reddit Crossposts

```json
{
  "tool": "create_reddit_crossposts",
  "arguments": {
    "subreddits": ["SideProject", "startups", "webdev"],
    "title": "Show: I built Bullhorn",
    "body": "A social media post scheduler...",
    "status": "draft"
  }
}
```
```

**Step 2: Update the /docs/mcp page**

In `src/app/docs/mcp/page.tsx`, add a "Rate Limits & Plan Limits" section and a "Tool Examples" section to match the README content. Add these as new sections after the existing tool tables.

**Step 3: Commit**

```bash
git add mcp-server/README.md src/app/docs/mcp/page.tsx
git commit -m "docs: add rate limits, plan limits, and tool examples to MCP docs"
```

---

## Group C — CI Fix

### Task 6: Remove `--passWithNoTests` Flag

**Files:**
- Modify: `.github/workflows/ci.yml:87`
- Modify: `Makefile:217,229`

**Step 1: Remove the flag from CI**

In `.github/workflows/ci.yml`, change line 87:
```yaml
# Before:
run: npx vitest run --passWithNoTests
# After:
run: npx vitest run
```

**Step 2: Remove the flag from Makefile**

In `Makefile`, change line 217:
```makefile
# Before:
	npx vitest run --passWithNoTests
# After:
	npx vitest run
```

And line 229:
```makefile
# Before:
	npx vitest run --coverage --passWithNoTests
# After:
	npx vitest run --coverage
```

**Step 3: Verify tests still pass**

Run: `make test-run`
Expected: All existing tests pass (there ARE tests, so removing the flag won't break anything).

**Step 4: Commit**

```bash
git add .github/workflows/ci.yml Makefile
git commit -m "chore: remove --passWithNoTests from CI and Makefile"
```

---

## Group D — Tests

### Task 7: Security-Critical Unit Tests

**Files:**
- Create: `src/lib/planEnforcement.test.ts`
- Already created in Task 2: `src/lib/rateLimit.test.ts`
- Create: `src/app/api/media/upload/route.test.ts`

**Step 1: Write planEnforcement tests**

Read `src/lib/planEnforcement.ts` to understand the exports, then write tests covering:

```typescript
// src/lib/planEnforcement.test.ts
// Test cases to cover:
// 1. checkPostLimit — allows when under limit, blocks when at limit
// 2. checkCampaignLimit — allows when under limit, blocks when at limit
// 3. checkProjectLimit — allows when under limit, blocks when at limit
// 4. checkBlogDraftLimit — allows when under limit, blocks when at limit
// 5. checkLaunchPostLimit — allows when under limit, blocks when at limit
// 6. checkStorageLimit — allows when under limit, blocks when at limit
// 7. Free plan limits are correctly defined
// 8. Pro plan limits are correctly defined
// 9. Returns correct error message with current count and limit
```

Follow the API route test pattern: mock `requireAuth`, mock `createClient` with chained selectors, verify response structure.

**Step 2: Write media upload validation tests**

```typescript
// src/app/api/media/upload/route.test.ts
// Test cases to cover:
// 1. Rejects files with invalid MIME types (e.g., .exe, .pdf)
// 2. Accepts valid image types (jpg, png, gif, webp)
// 3. Accepts valid video types (mp4, mov, webm)
// 4. Rejects images over 10MB
// 5. Rejects videos over 100MB
// 6. Rejects when storage quota exceeded
// 7. Returns 401 for unauthenticated requests
// 8. Returns correct file metadata on success
```

**Step 3: Run all security tests**

Run: `npx vitest run src/lib/planEnforcement.test.ts src/lib/rateLimit.test.ts src/app/api/media/upload/route.test.ts`
Expected: All pass.

**Step 4: Commit**

```bash
git add src/lib/planEnforcement.test.ts src/app/api/media/upload/route.test.ts
git commit -m "test: add security-critical unit tests for plan enforcement and media upload"
```

---

### Task 8: API Route Unit Tests

**Files to create** (one test file per untested route group):

```
src/app/api/blog-drafts/route.test.ts
src/app/api/blog-drafts/[id]/route.test.ts
src/app/api/blog-drafts/search/route.test.ts
src/app/api/blog-drafts/[id]/images/route.test.ts
src/app/api/blog-drafts/[id]/archive/route.test.ts
src/app/api/blog-drafts/[id]/restore/route.test.ts
src/app/api/launch-posts/route.test.ts
src/app/api/launch-posts/[id]/route.test.ts
src/app/api/projects/route.test.ts
src/app/api/projects/[id]/route.test.ts
src/app/api/projects/[id]/accounts/route.test.ts
src/app/api/projects/[id]/analytics/route.test.ts
src/app/api/projects/[id]/campaigns/route.test.ts
src/app/api/campaigns/[id]/route.test.ts
src/app/api/campaigns/[id]/posts/route.test.ts
src/app/api/media/route.test.ts
src/app/api/media/[filename]/route.test.ts
src/app/api/posts/search/route.test.ts
src/app/api/posts/[id]/archive/route.test.ts
src/app/api/posts/[id]/restore/route.test.ts
src/app/api/analytics/connections/route.test.ts
src/app/api/analytics/connections/[id]/route.test.ts
src/app/api/analytics/connections/[id]/report/route.test.ts
src/app/api/analytics/properties/route.test.ts
src/app/api/analytics/auth/url/route.test.ts
src/app/api/analytics/auth/callback/route.test.ts
src/app/api/reminders/route.test.ts
src/app/api/notification-preferences/route.test.ts
src/app/api/push-tokens/route.test.ts
src/app/api/plan/route.test.ts
src/app/api/health/route.test.ts
```

**Pattern to follow** (from `src/app/api/posts/route.test.ts`):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 1. Mock requireAuth
const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAuth: () => mockRequireAuth() }))

// 2. Mock planEnforcement (for POST routes that create resources)
vi.mock('@/lib/planEnforcement', () => ({
  checkXLimit: vi.fn().mockResolvedValue(undefined),
}))

// 3. Mock Supabase client with chained query methods
const mockLimit = vi.fn()
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockQueryEq = vi.fn(() => ({ order: mockOrder, limit: mockLimit }))
const mockSelect = vi.fn(() => ({ eq: mockQueryEq, order: mockOrder }))
const mockInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn() })) }))
const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn() })) }))
const mockDelete = vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn() })) }))
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({ from: mockFrom })),
}))

// 4. Import route handlers AFTER mocks
import { GET, POST } from './route'

describe('API Route: /api/x', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-123' })
  })

  describe('GET', () => {
    it('returns 401 when not authenticated', async () => {
      mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
      const res = await GET(new Request('http://localhost/api/x'))
      expect(res.status).toBe(401)
    })

    it('returns items for authenticated user', async () => {
      mockLimit.mockResolvedValue({ data: [{ id: '1' }], error: null })
      const res = await GET(new Request('http://localhost/api/x'))
      expect(res.status).toBe(200)
    })

    it('returns 500 on database error', async () => {
      mockLimit.mockResolvedValue({ data: null, error: new Error('DB error') })
      const res = await GET(new Request('http://localhost/api/x'))
      expect(res.status).toBe(500)
    })
  })

  describe('POST', () => {
    it('returns 401 when not authenticated', async () => { ... })
    it('returns 400 for invalid body', async () => { ... })
    it('creates item successfully', async () => { ... })
  })
})
```

**Each test file must test:**
1. 401 for unauthenticated requests (all methods)
2. 400 for invalid request body (POST/PATCH)
3. 404 for missing resources (GET/PATCH/DELETE by ID)
4. 500 for database errors
5. 200/201 for successful operations
6. Correct response shape (verify transformed data)
7. Query parameter handling (filters, search)

**Step: Write tests in batches, run after each batch**

Run after each batch: `npx vitest run src/app/api/<domain>/`
Expected: All pass.

**Commit after each batch:**
```bash
git commit -m "test: add unit tests for <domain> API routes"
```

Suggested batches:
1. Blog drafts (6 files)
2. Launch posts + projects (5 files)
3. Campaigns detail + media (4 files)
4. Analytics (6 files)
5. Post actions + reminders + notifications + plan + health (7 files)

---

### Task 9: Zustand Store Tests

**Files:**
- Create: `src/lib/analyticsStore.test.ts`
- Create: `src/lib/planStore.test.ts`

**Pattern to follow** (from `src/lib/campaigns.test.ts`):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

import { useXStore } from './xStore'

// Helper factory
function makeItem(overrides = {}) {
  return { id: 'item-1', name: 'Test', ...overrides }
}

describe('useXStore', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    useXStore.setState({
      items: [],
      loading: false,
      error: null,
      initialized: false,
    })
  })

  describe('fetchItems', () => {
    it('fetches and sets items', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [makeItem()] }),
      })
      await useXStore.getState().fetchItems()
      expect(useXStore.getState().items).toHaveLength(1)
      expect(useXStore.getState().initialized).toBe(true)
    })

    it('sets error on fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })
      await useXStore.getState().fetchItems()
      expect(useXStore.getState().error).toBeTruthy()
    })
  })
})
```

**analyticsStore test cases:**
1. fetchConnections — success and failure
2. createConnection — adds to state
3. updateConnection — updates in state
4. deleteConnection — removes from state
5. fetchReport — success with date range
6. getConnectionsByProject — filters correctly

**planStore test cases:**
1. fetchPlan — success and failure
2. refresh — re-fetches plan data
3. Returns correct plan tier info
4. Returns correct resource counts

**Step: Run tests**

Run: `npx vitest run src/lib/analyticsStore.test.ts src/lib/planStore.test.ts`
Expected: All pass.

**Commit:**
```bash
git add src/lib/analyticsStore.test.ts src/lib/planStore.test.ts
git commit -m "test: add unit tests for analyticsStore and planStore"
```

---

### Task 10: Hook Tests

**Files:**
- Create: `src/hooks/useAutoSave.test.ts`
- Create: `src/hooks/useKeyboardShortcuts.test.ts`
- Create: `src/hooks/usePushNotifications.test.ts`

**Pattern to follow** (from `src/hooks/useUnsavedChanges.test.ts`): Test the underlying logic directly rather than rendering hooks (no @testing-library/react-hooks).

**useAutoSave test cases:**
1. Calls save function after debounce period
2. Does not call save when content hasn't changed
3. Cancels pending save on unmount
4. Resets timer on new changes
5. Shows correct save status (saving, saved, error)

**useKeyboardShortcuts test cases:**
1. Registers event listeners on mount
2. Calls handler for registered shortcut
3. Ignores shortcuts when input is focused
4. Removes listeners on cleanup

**usePushNotifications test cases:**
1. Checks notification permission on mount
2. Handles permission denied gracefully
3. Registers push token on permission granted

**Step: Run tests**

Run: `npx vitest run src/hooks/`
Expected: All pass.

**Commit:**
```bash
git add src/hooks/useAutoSave.test.ts src/hooks/useKeyboardShortcuts.test.ts src/hooks/usePushNotifications.test.ts
git commit -m "test: add unit tests for useAutoSave, useKeyboardShortcuts, usePushNotifications hooks"
```

---

### Task 11: Component Unit Tests

**Files to create:**
```
src/components/ui/MediaUpload.test.tsx
src/components/ui/ApiKeyManager.test.tsx
src/components/ui/IOSDateTimePicker.test.tsx
src/components/ui/IOSActionSheet.test.tsx
src/components/ui/MarkdownEditor.test.tsx
src/components/ui/ResponsiveDialog.test.tsx
```

**Pattern:** Use `@testing-library/react` (already in test setup via `@testing-library/jest-dom`). Mock child components and event handlers.

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ComponentName } from './ComponentName'

describe('ComponentName', () => {
  it('renders without crashing', () => {
    render(<ComponentName {...requiredProps} />)
    expect(screen.getByText('expected text')).toBeInTheDocument()
  })

  it('calls handler on user interaction', () => {
    const handler = vi.fn()
    render(<ComponentName onAction={handler} {...requiredProps} />)
    fireEvent.click(screen.getByRole('button'))
    expect(handler).toHaveBeenCalledOnce()
  })
})
```

**MediaUpload test cases:**
1. Renders upload area
2. Accepts valid file types (images, videos)
3. Rejects invalid file types
4. Shows preview after file selection
5. Calls onUpload handler with file data
6. Shows progress during upload
7. Handles upload errors

**ApiKeyManager test cases:**
1. Renders empty state
2. Lists existing API keys
3. Creates new key and shows it once
4. Revokes key with confirmation
5. Shows scope selection

**IOSDateTimePicker test cases:**
1. Renders date and time inputs
2. Calls onChange with ISO datetime
3. Handles min/max date constraints

**IOSActionSheet test cases:**
1. Shows options when opened
2. Calls onSelect with chosen option
3. Closes on cancel

**MarkdownEditor test cases:**
1. Renders textarea
2. Shows preview toggle
3. Renders markdown in preview mode

**ResponsiveDialog test cases:**
1. Renders as modal on desktop
2. Renders as sheet on mobile
3. Closes on backdrop click
4. Calls onClose handler

**Step: Run tests**

Run: `npx vitest run src/components/`
Expected: All pass.

**Commit:**
```bash
git add src/components/
git commit -m "test: add unit tests for critical interactive UI components"
```

---

### Task 12: MCP Tool Unit Tests

**Files to create:**
```
mcp-server/src/handlers-posts.test.ts
mcp-server/src/handlers-blog-drafts.test.ts
mcp-server/src/handlers-projects.test.ts
mcp-server/src/handlers-launch-posts.test.ts
mcp-server/src/handlers-media.test.ts
```

**Pattern to follow** (from `mcp-server/src/handlers-campaign.test.ts`):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock BullhornClient methods
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('./client', () => ({
  BullhornClient: vi.fn().mockImplementation(() => ({
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
    delete: mockDelete,
  })),
}))

// Import handler functions after mocks
import { handleToolCall } from './index' // or specific handler

describe('Post MCP Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create_post', () => {
    it('creates a post with valid content', async () => {
      mockPost.mockResolvedValue({ id: '1', platform: 'twitter', content: { text: 'hi' } })
      const result = await handleCreatePost({ platform: 'twitter', content: { text: 'hi' } })
      expect(result.isError).toBeFalsy()
      expect(mockPost).toHaveBeenCalledOnce()
    })

    it('rejects invalid platform', async () => {
      const result = await handleCreatePost({ platform: 'tiktok', content: {} })
      expect(result.isError).toBe(true)
    })

    it('rejects missing content', async () => {
      const result = await handleCreatePost({ platform: 'twitter' })
      expect(result.isError).toBe(true)
    })
  })
})
```

**Test coverage per file:**

**handlers-posts.test.ts** (9 tools):
- create_post: valid content, invalid platform, missing content, content validation per platform
- get_post: found, not found
- update_post: valid update, not found, content validation when content+platform provided
- delete_post: with confirmation, without confirmation, not found
- archive_post, restore_post: success, not found
- list_posts: no filters, with status filter, with platform filter
- search_posts: with results, no results
- create_reddit_crossposts: (already tested, verify coverage)

**handlers-blog-drafts.test.ts** (10 tools):
- create_blog_draft: valid, missing title
- get_blog_draft, update_blog_draft, delete_blog_draft: success, not found
- archive_blog_draft, restore_blog_draft: success, not found, without confirmation
- list_blog_drafts: no filter, with status filter
- search_blog_drafts: with results, no results
- add_image_to_draft: valid file, invalid file
- get_draft_images: success

**handlers-projects.test.ts** (12 tools):
- create_project: valid, missing name
- get_project, update_project, delete_project: success, not found
- list_projects: success
- get_project_campaigns, get_project_analytics: success
- add/remove_account_to_project: success
- get_project_accounts: success
- move_campaign_to_project: success, with null (unassign)
- list_campaigns_by_project: success, "unassigned" keyword

**handlers-launch-posts.test.ts** (5 tools):
- create_launch_post: valid, missing platform, missing title, invalid platform
- get_launch_post, update_launch_post, delete_launch_post: success, not found
- list_launch_posts: no filter, with platform filter

**handlers-media.test.ts** (3 tools):
- upload_media: valid file, invalid type, too large
- list_media: success
- delete_media: success, not found

**Step: Run all MCP tests**

Run: `cd mcp-server && npx vitest run`
Expected: All pass.

**Commit after each file:**
```bash
git commit -m "test: add MCP unit tests for <domain> tools"
```

---

## Verification

After all tasks are complete:

**Step 1: Run full CI locally**

Run: `make ci`
Expected: All lint, typecheck, and test checks pass.

**Step 2: Run production build**

Run: `make build`
Expected: Build succeeds with no errors.

**Step 3: Final commit summary**

Expected commits (12 total):
1. `security: remove unsafe-eval from production CSP`
2. `security: fail closed on rate limiting in production when Redis unavailable`
3. `fix: add force-dynamic to all GET API routes to prevent stale cached data`
4. `feat: add platform-specific content validation to MCP post tools`
5. `docs: add rate limits, plan limits, and tool examples to MCP docs`
6. `chore: remove --passWithNoTests from CI and Makefile`
7. `test: add security-critical unit tests for plan enforcement and media upload`
8. `test: add unit tests for <domain> API routes` (5 commits, one per batch)
9. `test: add unit tests for analyticsStore and planStore`
10. `test: add unit tests for hooks`
11. `test: add unit tests for critical interactive UI components`
12. `test: add MCP unit tests for <domain> tools` (5 commits, one per file)
