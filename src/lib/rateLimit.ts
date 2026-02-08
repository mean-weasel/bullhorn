import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Rate limiter using Upstash Redis with a sliding window algorithm.
 * Allows 10 requests per 10 seconds per identifier.
 *
 * If Upstash environment variables are not set (e.g. local dev),
 * rate limiting is skipped gracefully.
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
    limiter: Ratelimit.slidingWindow(10, '10 s'),
    analytics: true,
    prefix: 'bullhorn:ratelimit',
  })

  return ratelimit
}

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
 * @returns Rate limit result, or a permissive default if Upstash is not configured
 */
export async function rateLimit(identifier: string): Promise<RateLimitResult> {
  const limiter = getRatelimit()

  // Graceful fallback: skip rate limiting if Upstash is not configured
  if (!limiter) {
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
