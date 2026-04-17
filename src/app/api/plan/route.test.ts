import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/planEnforcement', () => ({
  getUserPlan: vi.fn(),
}))

const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ eq: mockEq, single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}))

import { GET } from './route'
import { requireAuth } from '@/lib/auth'
import { PLAN_LIMITS, type PlanType } from '@/lib/limits'
import { getUserPlan } from '@/lib/planEnforcement'

const mockRequireAuth = vi.mocked(requireAuth)
const mockGetUserPlan = vi.mocked(getUserPlan)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up mock responses for the plan route.
 *
 * The route calls `supabase.from(table)` for 7 tables in order:
 *   1. user_profiles  -> .select().eq().single()
 *   2. posts          -> .select().eq()
 *   3. campaigns      -> .select().eq()
 *   4. projects       -> .select().eq()
 *   5. blog_drafts    -> .select().eq()
 *   6. launch_posts   -> .select().eq()
 *   7. api_keys       -> .select().eq().is()
 *
 * Because .eq() returns { eq, single }, the resource-count calls
 * resolve from the final .eq() call (not .single()).
 *
 * The call sequence on mockEq is:
 *   call 1: user_profiles .eq('id', userId)   -> returns { eq, single }
 *   call 2: posts .eq('user_id', userId)       -> resolves as data
 *   call 3: campaigns .eq('user_id', userId)
 *   call 4: projects .eq('user_id', userId)
 *   call 5: blog_drafts .eq('user_id', userId)
 *   call 6: launch_posts .eq('user_id', userId)
 *   call 7: api_keys .eq('user_id', userId)    -> returns { is } for .is() chaining
 */
function setupMocks(opts: {
  profile?: { plan: string; storage_used_bytes: number } | null
  profileError?: { message: string } | null
  postCount?: number
  campaignCount?: number
  projectCount?: number
  blogDraftCount?: number
  launchPostCount?: number
  apiKeyCount?: number
}) {
  // getUserPlan is mocked — return the plan from the profile (or 'free' as fallback)
  const profilePlan = (opts.profile?.plan || 'free') as PlanType
  mockGetUserPlan.mockResolvedValue(profilePlan)
  // Reset mock implementations for each call
  // mockSingle is called once for the user_profiles query
  mockSingle.mockResolvedValue({
    data: opts.profile ?? null,
    error: opts.profileError ?? null,
  })

  // mockEq is called for every .eq() in the chain.
  // For resource count queries (using head: true), the result contains
  // { count: N, data: null, error: null } instead of row arrays.
  const resourceResults = [
    { count: opts.postCount ?? 0, data: null, error: null },
    { count: opts.campaignCount ?? 0, data: null, error: null },
    { count: opts.projectCount ?? 0, data: null, error: null },
    { count: opts.blogDraftCount ?? 0, data: null, error: null },
    { count: opts.launchPostCount ?? 0, data: null, error: null },
  ]

  const apiKeyResult = { count: opts.apiKeyCount ?? 0, data: null, error: null }

  // The first .eq() call is for user_profiles (returns { eq, single })
  // Then 5 resource-count .eq() calls each need to resolve with count.
  // The 7th .eq() call is for api_keys which chains .is('revoked_at', null).
  // The supabase client returns a thenable from .eq() — it's a
  // PostgrestFilterBuilder which is both chainable AND thenable. We need our
  // mock .eq() to behave the same way for the resource queries.
  //
  // Strategy: track call index. For the profile .eq() (1st call), return
  // the chainable object. For resource .eq() calls (2nd-6th), return the
  // count result directly. For api_keys .eq() (7th), return { is } so
  // .is('revoked_at', null) can resolve with the api key count.

  let eqCallIndex = 0
  // @ts-expect-error -- mock returns different shapes for profile vs resource queries
  mockEq.mockImplementation(() => {
    eqCallIndex++
    if (eqCallIndex === 1) {
      // user_profiles .eq('id', userId) — needs .single() chaining
      return { eq: mockEq, single: mockSingle }
    }
    if (eqCallIndex === 7) {
      // api_keys .eq('user_id', userId) — needs .is() chaining
      return { is: vi.fn(() => apiKeyResult) }
    }
    // Resource count queries — return result with count field
    const result = resourceResults[eqCallIndex - 2]
    return result ?? { count: 0, data: null, error: null }
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// GET /api/plan
// ---------------------------------------------------------------------------

describe('GET /api/plan (1/5)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns plan info and resource counts for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    setupMocks({
      profile: { plan: 'free', storage_used_bytes: 1024 },
      postCount: 5,
      campaignCount: 2,
      projectCount: 1,
      blogDraftCount: 3,
      launchPostCount: 0,
      apiKeyCount: 1,
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.plan).toBe('free')
    expect(body.limits.posts).toEqual({ current: 5, limit: PLAN_LIMITS.free.posts })
    expect(body.limits.campaigns).toEqual({ current: 2, limit: PLAN_LIMITS.free.campaigns })
    expect(body.limits.projects).toEqual({ current: 1, limit: PLAN_LIMITS.free.projects })
    expect(body.limits.blogDrafts).toEqual({ current: 3, limit: PLAN_LIMITS.free.blogDrafts })
    expect(body.limits.launchPosts).toEqual({ current: 0, limit: PLAN_LIMITS.free.launchPosts })
    expect(body.limits.apiKeys).toEqual({ current: 1, limit: PLAN_LIMITS.free.apiKeys })
    expect(body.storage).toEqual({
      usedBytes: 1024,
      limitBytes: PLAN_LIMITS.free.storageBytes,
    })
  })
})

describe('GET /api/plan (2/5)', () => {
  it('returns correct limits for pro plan', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    setupMocks({
      profile: { plan: 'pro', storage_used_bytes: 500000 },
      postCount: 100,
      campaignCount: 10,
      projectCount: 5,
      blogDraftCount: 20,
      launchPostCount: 15,
      apiKeyCount: 5,
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.plan).toBe('pro')
    expect(body.limits.posts.limit).toBe(PLAN_LIMITS.pro.posts)
    expect(body.limits.campaigns.limit).toBe(PLAN_LIMITS.pro.campaigns)
    expect(body.limits.projects.limit).toBe(PLAN_LIMITS.pro.projects)
    expect(body.limits.blogDrafts.limit).toBe(PLAN_LIMITS.pro.blogDrafts)
    expect(body.limits.launchPosts.limit).toBe(PLAN_LIMITS.pro.launchPosts)
    expect(body.limits.apiKeys.limit).toBe(PLAN_LIMITS.pro.apiKeys)
    expect(body.storage.limitBytes).toBe(PLAN_LIMITS.pro.storageBytes)
  })
})

describe('GET /api/plan (3/5)', () => {
  it('returns correct response structure with all expected fields', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    setupMocks({
      profile: { plan: 'free', storage_used_bytes: 0 },
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    // Top-level keys
    expect(body).toHaveProperty('plan')
    expect(body).toHaveProperty('limits')
    expect(body).toHaveProperty('storage')

    // Limits sub-keys
    expect(body.limits).toHaveProperty('posts')
    expect(body.limits).toHaveProperty('campaigns')
    expect(body.limits).toHaveProperty('projects')
    expect(body.limits).toHaveProperty('blogDrafts')
    expect(body.limits).toHaveProperty('launchPosts')
    expect(body.limits).toHaveProperty('apiKeys')

    // Each limit has current and limit
    for (const key of ['posts', 'campaigns', 'projects', 'blogDrafts', 'launchPosts', 'apiKeys']) {
      expect(body.limits[key]).toHaveProperty('current')
      expect(body.limits[key]).toHaveProperty('limit')
      expect(typeof body.limits[key].current).toBe('number')
      expect(typeof body.limits[key].limit).toBe('number')
    }

    // Storage has usedBytes and limitBytes
    expect(body.storage).toHaveProperty('usedBytes')
    expect(body.storage).toHaveProperty('limitBytes')
    expect(typeof body.storage.usedBytes).toBe('number')
    expect(typeof body.storage.limitBytes).toBe('number')
  })
})

describe('GET /api/plan (4/5)', () => {
  it('defaults to free plan when profile has no plan field', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    setupMocks({
      profile: { plan: '', storage_used_bytes: 0 },
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.plan).toBe('free')
    expect(body.limits.posts.limit).toBe(PLAN_LIMITS.free.posts)
  })

  it('defaults to free plan when profile is null', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    setupMocks({
      profile: null,
    })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.plan).toBe('free')
    expect(body.storage.usedBytes).toBe(0)
  })

  it('handles database errors gracefully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })

    // Make the supabase client throw an error
    mockSelect.mockImplementationOnce(() => {
      throw new Error('Connection refused')
    })

    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

describe('GET /api/plan (5/5)', () => {
  it('queries the correct tables with user_id filter', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-42' })
    setupMocks({
      profile: { plan: 'free', storage_used_bytes: 0 },
    })

    await GET()

    // Verify from() was called with each expected table
    const fromCalls = mockFrom.mock.calls.map((c: string[]) => c[0])
    expect(fromCalls).toContain('user_profiles')
    expect(fromCalls).toContain('posts')
    expect(fromCalls).toContain('campaigns')
    expect(fromCalls).toContain('projects')
    expect(fromCalls).toContain('blog_drafts')
    expect(fromCalls).toContain('launch_posts')
    expect(fromCalls).toContain('api_keys')
  })
})

describe('GET /api/plan — features (6/5)', () => {
  it('returns features.autoPublish=false for free plan', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    setupMocks({ profile: { plan: 'free', storage_used_bytes: 0 } })

    const res = await GET()
    const body = await res.json()

    expect(body.features).toBeDefined()
    expect(body.features.autoPublish).toBe(false)
  })

  it('returns features.autoPublish=true for pro plan', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    setupMocks({ profile: { plan: 'pro', storage_used_bytes: 0 } })

    const res = await GET()
    const body = await res.json()

    expect(body.features).toBeDefined()
    expect(body.features.autoPublish).toBe(true)
  })
})
