import { describe, it, expect, vi, beforeEach } from 'vitest'

// Because the module caches a `ratelimit` singleton at module scope,
// we must use `vi.resetModules()` + dynamic `await import()` in every
// test so each one starts with a fresh singleton.

const mockLimit = vi.fn()

vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    limit = mockLimit
    static slidingWindow = vi.fn().mockReturnValue('slidingWindow')
  }
  return { Ratelimit: MockRatelimit }
})

vi.mock('@upstash/redis', () => {
  class MockRedis {
    constructor() {
      // no-op
    }
  }
  return { Redis: MockRedis }
})

describe('rateLimit', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    mockLimit.mockReset()
  })

  it('allows requests when Redis is configured', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake-redis.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token')
    vi.stubEnv('NODE_ENV', 'production')

    mockLimit.mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 10_000,
    })

    const { rateLimit } = await import('./rateLimit')
    const result = await rateLimit('user-123')

    expect(result.success).toBe(true)
    expect(result.limit).toBe(10)
    expect(result.remaining).toBe(9)
    expect(mockLimit).toHaveBeenCalledWith('user-123')
  })

  it('uses in-memory fallback when Redis is not configured', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.stubEnv('NODE_ENV', 'production')

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { rateLimit } = await import('./rateLimit')
    const result = await rateLimit('user-456')

    expect(result.success).toBe(true)
    expect(result.limit).toBe(30)
    expect(result.remaining).toBe(29)
    expect(result.reset).toBeGreaterThan(Date.now() - 1000)
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('using in-memory fallback'))

    consoleSpy.mockRestore()
  })

  it('in-memory fallback blocks after exceeding limit', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')
    vi.stubEnv('NODE_ENV', 'test')

    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { rateLimit, _memoryStore } = await import('./rateLimit')
    _memoryStore.clear()

    // Send 30 requests (all should succeed)
    for (let i = 0; i < 30; i++) {
      const result = await rateLimit('flood-user')
      expect(result.success).toBe(true)
    }

    // 31st request should be blocked
    const blocked = await rateLimit('flood-user')
    expect(blocked.success).toBe(false)
    expect(blocked.remaining).toBe(0)

    vi.restoreAllMocks()
  })
})
