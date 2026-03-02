import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL('/api/cron/retry-failed', 'http://localhost:3000'), { headers })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', 'test-secret')
})

describe('GET /api/cron/retry-failed (no-op)', () => {
  it('returns 401 when cron secret does not match', async () => {
    const req = createRequest({ authorization: 'Bearer wrong-secret' })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 500 when no CRON_SECRET is configured', async () => {
    vi.stubEnv('CRON_SECRET', '')
    const req = createRequest({ authorization: 'Bearer anything' })
    const res = await GET(req)
    expect(res.status).toBe(500)
  })

  it('returns no-op response with valid auth', async () => {
    const req = createRequest({ authorization: 'Bearer test-secret' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('no-op')
  })
})
