import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockCreateClient = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('@/lib/publishers', () => ({
  publishPost: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  transformPostFromDb: vi.fn((p) => ({ ...p, id: p.id })),
}))

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest(new URL('/api/cron/retry-failed', 'http://localhost:3000'), {
    headers: headers ? new Headers(headers) : undefined,
  })
}

let GET: typeof import('./route').GET

beforeEach(async () => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
  vi.stubEnv('CRON_SECRET', 'my-secret')
  vi.resetModules()
  const mod = await import('./route')
  GET = mod.GET
})

describe('GET /api/cron/retry-failed (1/3)', () => {
  it('retries failed posts that are retryable with retryCount < 3', async () => {
    const failedPost = {
      id: 'post-fail',
      user_id: 'user-1',
      platform: 'twitter',
      social_account_id: 'acc-1',
      content: { text: 'retry me' },
      publish_result: { retryable: true, retryCount: 1 },
      status: 'failed',
    }

    const limitFn = vi.fn(() => Promise.resolve({ data: [failedPost], error: null }))
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ limit: limitFn })),
        })),
      })),
    })

    const { publishPost } = await import('@/lib/publishers')
    vi.mocked(publishPost).mockResolvedValue({ success: true })

    const req = makeRequest({ authorization: 'Bearer my-secret' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.retried).toBe(1)
    expect(publishPost).toHaveBeenCalled()
  })
})

describe('GET /api/cron/retry-failed (2/3)', () => {
  it('skips posts with retryCount >= 3', async () => {
    const exhaustedPost = {
      id: 'post-exhausted',
      user_id: 'user-1',
      platform: 'twitter',
      social_account_id: 'acc-1',
      content: { text: 'no more retries' },
      publish_result: { retryable: true, retryCount: 3 },
      status: 'failed',
    }

    const limitFn = vi.fn(() => Promise.resolve({ data: [exhaustedPost], error: null }))
    mockCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ limit: limitFn })),
        })),
      })),
    })

    const { publishPost } = await import('@/lib/publishers')

    const req = makeRequest({ authorization: 'Bearer my-secret' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.retried).toBe(0)
    expect(publishPost).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/retry-failed (3/3)', () => {
  it('returns 401 with invalid cron secret', async () => {
    const req = makeRequest({ authorization: 'Bearer wrong' })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })
})
