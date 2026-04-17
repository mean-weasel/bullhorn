/* eslint-disable max-lines */
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

const mockIsSelfHosted = vi.fn(() => false)
vi.mock('@/lib/selfHosted', () => ({
  isSelfHosted: () => mockIsSelfHosted(),
}))

import {
  getUserPlan,
  enforceResourceLimit,
  enforceStorageLimit,
  hasFeature,
} from './planEnforcement'
import { PLAN_LIMITS } from './limits'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockIsSelfHosted.mockReturnValue(false)
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

function setupStorageMocks(plan: string, storageUsedBytes: number) {
  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { plan, storage_used_bytes: storageUsedBytes },
          error: null,
        }),
      })),
    })),
  }))
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
  it('returns selfHosted when isSelfHosted() is true', async () => {
    mockIsSelfHosted.mockReturnValue(true)
    const plan = await getUserPlan('user-1')
    expect(plan).toBe('selfHosted')
    // Should not have queried the database
    expect(mockFrom).not.toHaveBeenCalled()
  })

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

// ---------------------------------------------------------------------------
// enforceResourceLimit
// ---------------------------------------------------------------------------

// eslint-disable-next-line max-lines-per-function
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

// ---------------------------------------------------------------------------
// enforceResourceLimit with pre-fetched plan
// ---------------------------------------------------------------------------

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

  it('uses pro limits when pro plan is provided', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ count: 100, error: null }),
      })),
    }))

    const result = await enforceResourceLimit('user-1', 'posts', 'pro')
    expect(result.allowed).toBe(true)
    expect(result.current).toBe(100)
    expect(result.limit).toBe(500)
    expect(result.plan).toBe('pro')
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

// ---------------------------------------------------------------------------
// enforceStorageLimit
// ---------------------------------------------------------------------------

// eslint-disable-next-line max-lines-per-function
describe('enforceStorageLimit', () => {
  it('allows upload when under storage limit', async () => {
    const usedBytes = 10 * 1024 * 1024 // 10 MB used
    const additionalBytes = 5 * 1024 * 1024 // 5 MB upload
    setupStorageMocks('free', usedBytes)
    const result = await enforceStorageLimit('user-1', additionalBytes)
    expect(result.allowed).toBe(true)
    expect(result.currentBytes).toBe(usedBytes)
    expect(result.limitBytes).toBe(PLAN_LIMITS.free.storageBytes)
    expect(result.plan).toBe('free')
  })

  it('blocks upload when storage would exceed limit', async () => {
    const usedBytes = 49 * 1024 * 1024 // 49 MB used
    const additionalBytes = 2 * 1024 * 1024 // 2 MB upload -> 51 MB > 50 MB
    setupStorageMocks('free', usedBytes)
    const result = await enforceStorageLimit('user-1', additionalBytes)
    expect(result.allowed).toBe(false)
    expect(result.currentBytes).toBe(usedBytes)
    expect(result.limitBytes).toBe(PLAN_LIMITS.free.storageBytes)
  })

  it('allows upload when exactly at the limit (used + additional == limit)', async () => {
    const limitBytes = PLAN_LIMITS.free.storageBytes
    const usedBytes = limitBytes - 1024
    const additionalBytes = 1024 // Exactly fills the remaining space
    setupStorageMocks('free', usedBytes)
    const result = await enforceStorageLimit('user-1', additionalBytes)
    expect(result.allowed).toBe(true)
  })

  it('blocks upload when already at limit', async () => {
    const limitBytes = PLAN_LIMITS.free.storageBytes
    setupStorageMocks('free', limitBytes)
    const result = await enforceStorageLimit('user-1', 1)
    expect(result.allowed).toBe(false)
  })

  it('uses correct free plan storage limit (50 MB)', async () => {
    setupStorageMocks('free', 0)
    const result = await enforceStorageLimit('user-1', 0)
    expect(result.limitBytes).toBe(50 * 1024 * 1024)
  })

  it('uses correct pro plan storage limit (2 GB)', async () => {
    setupStorageMocks('pro', 0)
    const result = await enforceStorageLimit('user-1', 0)
    expect(result.limitBytes).toBe(2 * 1024 * 1024 * 1024)
  })

  it('pro user can upload more than free limit', async () => {
    const usedBytes = 100 * 1024 * 1024 // 100 MB (exceeds 50 MB free limit)
    const additionalBytes = 50 * 1024 * 1024
    setupStorageMocks('pro', usedBytes)
    const result = await enforceStorageLimit('user-1', additionalBytes)
    expect(result.allowed).toBe(true)
    expect(result.plan).toBe('pro')
  })

  it('defaults to free plan when profile has no plan', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    }))
    const result = await enforceStorageLimit('user-1', 1024)
    expect(result.plan).toBe('free')
    expect(result.limitBytes).toBe(PLAN_LIMITS.free.storageBytes)
  })

  it('treats null storage_used_bytes as 0', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { plan: 'free', storage_used_bytes: null },
            error: null,
          }),
        })),
      })),
    }))
    const result = await enforceStorageLimit('user-1', 1024)
    expect(result.currentBytes).toBe(0)
    expect(result.allowed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// hasFeature
// ---------------------------------------------------------------------------

describe('hasFeature', () => {
  it('returns false for autoPublish on free plan', async () => {
    setupProfileMock('free')
    const result = await hasFeature('user-1', 'autoPublish')
    expect(result).toBe(false)
  })

  it('returns true for autoPublish on pro plan', async () => {
    setupProfileMock('pro')
    const result = await hasFeature('user-1', 'autoPublish')
    expect(result).toBe(true)
  })

  it('defaults to free plan when profile not found', async () => {
    setupProfileMock(null)
    const result = await hasFeature('user-1', 'autoPublish')
    expect(result).toBe(false)
  })

  it('accepts a preloaded plan to avoid DB lookup', async () => {
    const result = await hasFeature('user-1', 'autoPublish', 'pro')
    expect(result).toBe(true)
  })
})
