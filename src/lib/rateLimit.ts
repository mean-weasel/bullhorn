import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const WINDOW_MS = 10_000
const MAX_REQUESTS = 30

/**
 * Rate limiter using Upstash Redis with a sliding window algorithm.
 * Allows 30 requests per 10 seconds per identifier.
 *
 * If Upstash environment variables are not set, falls back to an
 * in-memory fixed-window limiter so rate limiting is never disabled.
 */

let ratelimit: Ratelimit | null = null

function getRatelimit(): Ratelimit | null {
  if (ratelimit) return ratelimit

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    return null
  }

  ratelimit = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(MAX_REQUESTS, '10 s'),
    analytics: true,
    prefix: 'bullhorn:ratelimit',
  })

  return ratelimit
}

// ---------------------------------------------------------------------------
// In-memory fallback rate limiter
// ---------------------------------------------------------------------------

interface MemoryBucket {
  count: number
  resetAt: number
}

const memoryStore = new Map<string, MemoryBucket>()
let lastCleanup = Date.now()

/**
 * Simple in-memory fixed-window rate limiter used as fallback when
 * Upstash Redis is not configured. Provides basic protection per
 * serverless function instance.
 *
 * Note: State is not shared across Vercel function instances, so this
 * is a best-effort fallback — Upstash Redis is recommended for production.
 */
function memoryRateLimit(identifier: string): RateLimitResult {
  const now = Date.now()

  // Periodic cleanup of stale entries (every 60 seconds)
  if (now - lastCleanup > 60_000) {
    for (const [key, bucket] of memoryStore) {
      if (bucket.resetAt <= now) memoryStore.delete(key)
    }
    lastCleanup = now
  }

  let bucket = memoryStore.get(identifier)

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS }
    memoryStore.set(identifier, bucket)
  }

  bucket.count++

  return {
    success: bucket.count <= MAX_REQUESTS,
    limit: MAX_REQUESTS,
    remaining: Math.max(0, MAX_REQUESTS - bucket.count),
    reset: bucket.resetAt,
  }
}

// Exported for testing only
export { memoryStore as _memoryStore }

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Check the rate limit for a given identifier.
 *
 * @param identifier - Unique key for the rate limit bucket (user ID or IP)
 * @returns Rate limit result. Uses Upstash Redis when configured, otherwise
 *   falls back to an in-memory limiter.
 */
export async function rateLimit(identifier: string): Promise<RateLimitResult> {
  const limiter = getRatelimit()

  if (!limiter) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[rateLimit] Upstash Redis not configured — using in-memory fallback. ' +
          'Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for distributed rate limiting.'
      )
    }
    return memoryRateLimit(identifier)
  }

  const result = await limiter.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}
