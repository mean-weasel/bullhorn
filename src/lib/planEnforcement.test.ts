import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

const mockSingle = vi.fn()
const mockSelectEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockSelectEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}))

import { getUserPlan, enforceResourceLimit } from './planEnforcement'
import { PLAN_LIMITS } from './limits'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

/**
 * Configure the mock so that:
 *  - supabase.from('user_profiles').select('plan').eq('id', userId).single()
 *    returns { data: { plan }, error: null }
 *  - supabase.from(table).select('*', { count: 'exact', head: true }).eq(col, userId)
 *    returns { count }
 *
 * Because planEnforcement calls `createClient()` twice (once for profile, once for count),
 * we need the mock chain to handle both calls. We track call order via mockFrom.
 */
function setupResourceMocks(plan: string, count: number) {
  // The module calls createClient() which returns { from }
  // First call: from('user_profiles').select('plan').eq('id', userId).single()
  // Second call: from(table).select('*', opts).eq(col, userId) -> returns { count }
  let fromCallIndex = 0
  mockFrom.mockImplementation(() => {
    fromCallIndex++
    if (fromCallIndex === 1) {
      // Profile lookup
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { plan }, error: null }),
          })),
        })),
      }
    } else {
      // Count query
      return {
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ count, error: null }),
        })),
      }
    }
  })
}

function setupProfileMock(plan: string | null) {
  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: plan !== null ? { plan } : null,
          error: plan !== null ? null : { message: 'Not found' },
        }),
      })),
    })),
  }))
}

// ---------------------------------------------------------------------------
// getUserPlan
// ---------------------------------------------------------------------------

describe('getUserPlan', () => {
  it('returns the plan from user profile', async () => {
    setupProfileMock('pro')
    const plan = await getUserPlan('user-1')
    expect(plan).toBe('pro')
  })

  it('defaults to "free" when profile has no plan field', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        })),
      })),
    }))
    const plan = await getUserPlan('user-1')
    expect(plan).toBe('free')
  })

  it('defaults to "free" when profile lookup fails', async () => {
    setupProfileMock(null)
    const plan = await getUserPlan('user-1')
    expect(plan).toBe('free')
  })
})

describe('enforceResourceLimit', () => {
  const resources = ['posts', 'campaigns', 'projects', 'blogDrafts', 'launchPosts'] as const

  describe('allows creation when under limit', () => {
    for (const resource of resources) {
      it(`allows ${resource} when count is under free limit`, async () => {
        const freeLimit = PLAN_LIMITS.free[resource]
        setupResourceMocks('free', freeLimit - 1)
        const result = await enforceResourceLimit('user-1', resource)
        expect(result.allowed).toBe(true)
        expect(result.current).toBe(freeLimit - 1)
        expect(result.limit).toBe(freeLimit)
        expect(result.plan).toBe('free')
      })
    }
  })

  describe('blocks creation when at limit', () => {
    for (const resource of resources) {
      it(`blocks ${resource} when count equals free limit`, async () => {
        const freeLimit = PLAN_LIMITS.free[resource]
        setupResourceMocks('free', freeLimit)
        const result = await enforceResourceLimit('user-1', resource)
        expect(result.allowed).toBe(false)
        expect(result.current).toBe(freeLimit)
        expect(result.limit).toBe(freeLimit)
        expect(result.plan).toBe('free')
      })
    }
  })

  describe('blocks creation when over limit', () => {
    for (const resource of resources) {
      it(`blocks ${resource} when count exceeds free limit`, async () => {
        const freeLimit = PLAN_LIMITS.free[resource]
        setupResourceMocks('free', freeLimit + 5)
        const result = await enforceResourceLimit('user-1', resource)
        expect(result.allowed).toBe(false)
        expect(result.current).toBe(freeLimit + 5)
        expect(result.limit).toBe(freeLimit)
      })
    }
  })

  describe('uses correct limits for Free plan', () => {
    it('posts limit is 50', async () => {
      setupResourceMocks('free', 0)
      const result = await enforceResourceLimit('user-1', 'posts')
      expect(result.limit).toBe(50)
    })

    it('campaigns limit is 5', async () => {
      setupResourceMocks('free', 0)
      const result = await enforceResourceLimit('user-1', 'campaigns')
      expect(result.limit).toBe(5)
    })

    it('projects limit is 3', async () => {
      setupResourceMocks('free', 0)
      const result = await enforceResourceLimit('user-1', 'projects')
      expect(result.limit).toBe(3)
    })

    it('blogDrafts limit is 10', async () => {
      setupResourceMocks('free', 0)
      const result = await enforceResourceLimit('user-1', 'blogDrafts')
      expect(result.limit).toBe(10)
    })

    it('launchPosts limit is 10', async () => {
      setupResourceMocks('free', 0)
      const result = await enforceResourceLimit('user-1', 'launchPosts')
      expect(result.limit).toBe(10)
    })
  })

  describe('uses correct limits for Pro plan', () => {
    it('posts limit is 500', async () => {
      setupResourceMocks('pro', 0)
      const result = await enforceResourceLimit('user-1', 'posts')
      expect(result.limit).toBe(500)
    })

    it('campaigns limit is 50', async () => {
      setupResourceMocks('pro', 0)
      const result = await enforceResourceLimit('user-1', 'campaigns')
      expect(result.limit).toBe(50)
    })

    it('projects limit is 20', async () => {
      setupResourceMocks('pro', 0)
      const result = await enforceResourceLimit('user-1', 'projects')
      expect(result.limit).toBe(20)
    })

    it('blogDrafts limit is 100', async () => {
      setupResourceMocks('pro', 0)
      const result = await enforceResourceLimit('user-1', 'blogDrafts')
      expect(result.limit).toBe(100)
    })

    it('launchPosts limit is 100', async () => {
      setupResourceMocks('pro', 0)
      const result = await enforceResourceLimit('user-1', 'launchPosts')
      expect(result.limit).toBe(100)
    })
  })

  it('returns current count and limit in the result', async () => {
    setupResourceMocks('free', 42)
    const result = await enforceResourceLimit('user-1', 'posts')
    expect(result.current).toBe(42)
    expect(result.limit).toBe(50)
    expect(result.plan).toBe('free')
  })

  it('allows pro user even when past free limit', async () => {
    setupResourceMocks('pro', 49)
    const result = await enforceResourceLimit('user-1', 'posts')
    expect(result.allowed).toBe(true)
    expect(result.current).toBe(49)
    expect(result.limit).toBe(500)
    expect(result.plan).toBe('pro')
  })

  it('defaults to free plan when profile has no plan', async () => {
    // Simulate profile returning null plan
    let fromCallIndex = 0
    mockFrom.mockImplementation(() => {
      fromCallIndex++
      if (fromCallIndex === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        }
      } else {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
          })),
        }
      }
    })
    const result = await enforceResourceLimit('user-1', 'posts')
    expect(result.plan).toBe('free')
    expect(result.limit).toBe(50)
  })

  it('treats null count as 0', async () => {
    let fromCallIndex = 0
    mockFrom.mockImplementation(() => {
      fromCallIndex++
      if (fromCallIndex === 1) {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: { plan: 'free' }, error: null }),
            })),
          })),
        }
      } else {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ count: null, error: null }),
          })),
        }
      }
    })
    const result = await enforceResourceLimit('user-1', 'posts')
    expect(result.current).toBe(0)
    expect(result.allowed).toBe(true)
  })
})
