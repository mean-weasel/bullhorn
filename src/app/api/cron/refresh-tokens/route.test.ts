import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRefreshTokenIfNeeded = vi.fn()
vi.mock('@/lib/tokenRefresh', () => ({
  refreshTokenIfNeeded: (...args: unknown[]) => mockRefreshTokenIfNeeded(...args),
}))

const mockSelect = vi.fn()
const mockEq = vi.fn(() => ({ not: vi.fn(() => ({ limit: mockSelect })) }))
const mockFrom = vi.fn(() => ({
  select: vi.fn(() => ({ eq: mockEq })),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

import { GET } from './route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(url: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), { headers })
}

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acct-1',
    provider: 'twitter',
    access_token: 'tok',
    refresh_token: 'ref',
    token_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'test-secret')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
})

describe('GET /api/cron/refresh-tokens (1/5)', () => {
  it('returns 401 when cron secret does not match', async () => {
    mockSelect.mockResolvedValue({ data: [], error: null })
    const req = createRequest('/api/cron/refresh-tokens', {
      authorization: 'Bearer wrong-secret',
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('refreshes a Twitter token expiring within 1 hour', async () => {
    const account = makeAccount({
      provider: 'twitter',
      token_expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    mockSelect.mockResolvedValue({ data: [account], error: null })
    mockRefreshTokenIfNeeded.mockResolvedValue({
      accessToken: 'new-tok',
      refreshToken: 'new-ref',
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })

    const req = createRequest('/api/cron/refresh-tokens', {
      authorization: 'Bearer test-secret',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.refreshed).toBe(1)
    expect(body.failed).toBe(0)
    expect(body.skipped).toBe(0)
    expect(mockRefreshTokenIfNeeded).toHaveBeenCalledWith(account)
  })
})

describe('GET /api/cron/refresh-tokens (2/5)', () => {
  it('refreshes a Reddit token expiring within 30 minutes', async () => {
    const account = makeAccount({
      id: 'reddit-1',
      provider: 'reddit',
      token_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    mockSelect.mockResolvedValue({ data: [account], error: null })
    mockRefreshTokenIfNeeded.mockResolvedValue({
      accessToken: 'new',
      refreshToken: 'new-ref',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })

    const req = createRequest('/api/cron/refresh-tokens', {
      authorization: 'Bearer test-secret',
    })
    const res = await GET(req)
    const body = await res.json()
    expect(body.refreshed).toBe(1)
    expect(body.skipped).toBe(0)
    expect(mockRefreshTokenIfNeeded).toHaveBeenCalledWith(account)
  })

  it('skips a LinkedIn token not expiring within 7 days', async () => {
    const account = makeAccount({
      id: 'li-1',
      provider: 'linkedin',
      token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    mockSelect.mockResolvedValue({ data: [account], error: null })

    const req = createRequest('/api/cron/refresh-tokens', {
      authorization: 'Bearer test-secret',
    })
    const res = await GET(req)
    const body = await res.json()
    expect(body.skipped).toBe(1)
    expect(body.refreshed).toBe(0)
    expect(mockRefreshTokenIfNeeded).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/refresh-tokens (3/5)', () => {
  it('handles refresh failure gracefully without blocking others', async () => {
    const failing = makeAccount({
      id: 'fail-1',
      provider: 'twitter',
      token_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    const succeeding = makeAccount({
      id: 'ok-1',
      provider: 'twitter',
      token_expires_at: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    })
    mockSelect.mockResolvedValue({
      data: [failing, succeeding],
      error: null,
    })
    mockRefreshTokenIfNeeded.mockRejectedValueOnce(new Error('API error')).mockResolvedValueOnce({
      accessToken: 'new',
      refreshToken: 'ref',
      expiresAt: new Date().toISOString(),
    })

    const req = createRequest('/api/cron/refresh-tokens', {
      authorization: 'Bearer test-secret',
    })
    const res = await GET(req)
    const body = await res.json()
    expect(body.processed).toBe(2)
    expect(body.refreshed).toBe(1)
    expect(body.failed).toBe(1)
    expect(body.skipped).toBe(0)
  })
})

describe('GET /api/cron/refresh-tokens (4/5)', () => {
  it('returns correct counts with mixed outcomes', async () => {
    const twitterSoon = makeAccount({
      id: 'tw-1',
      provider: 'twitter',
      token_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })
    const linkedinFar = makeAccount({
      id: 'li-1',
      provider: 'linkedin',
      token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    const redditSoon = makeAccount({
      id: 'rd-1',
      provider: 'reddit',
      token_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })
    mockSelect.mockResolvedValue({
      data: [twitterSoon, linkedinFar, redditSoon],
      error: null,
    })
    mockRefreshTokenIfNeeded.mockResolvedValue({
      accessToken: 'new',
      refreshToken: 'ref',
      expiresAt: new Date().toISOString(),
    })

    const req = createRequest('/api/cron/refresh-tokens', {
      authorization: 'Bearer test-secret',
    })
    const res = await GET(req)
    const body = await res.json()
    expect(body.processed).toBe(3)
    expect(body.refreshed).toBe(2)
    expect(body.skipped).toBe(1)
    expect(body.failed).toBe(0)
  })
})

describe('GET /api/cron/refresh-tokens (5/5)', () => {
  it('skips accounts without refresh_token (filtered by DB)', async () => {
    // DB query filters out null refresh_tokens, so empty result
    mockSelect.mockResolvedValue({ data: [], error: null })

    const req = createRequest('/api/cron/refresh-tokens', {
      authorization: 'Bearer test-secret',
    })
    const res = await GET(req)
    const body = await res.json()
    expect(body.processed).toBe(0)
    expect(body.refreshed).toBe(0)
    expect(body.failed).toBe(0)
    expect(body.skipped).toBe(0)
  })
})
