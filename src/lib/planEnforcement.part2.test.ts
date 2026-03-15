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

import { enforceResourceLimit, enforceStorageLimit } from './planEnforcement'
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

// ---------------------------------------------------------------------------
// getUserPlan
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
})

describe('enforceStorageLimit - continued', () => {
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
