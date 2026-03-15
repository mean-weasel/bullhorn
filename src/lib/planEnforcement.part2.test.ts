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

// ---------------------------------------------------------------------------
// enforceResourceLimit
// ---------------------------------------------------------------------------

describe('enforceResourceLimit (4/5)', () => {
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
})

describe('enforceResourceLimit (5/5)', () => {
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
