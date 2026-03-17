import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAuth: () => mockRequireAuth() }))

const mockCookieGet = vi.fn()
const mockCookieSet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: mockCookieGet,
      set: mockCookieSet,
    })
  ),
}))

const mockUpsert = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: vi.fn(() => ({ upsert: mockUpsert })),
    })
  ),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { GET } from './route'

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('/api/social-accounts/linkedin/callback', 'http://localhost:3000')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url)
}

// eslint-disable-next-line max-lines-per-function
describe('GET /api/social-accounts/linkedin/callback', () => {
  const validState = 'test-state-456'
  const validCookie = JSON.stringify({ state: validState })

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockCookieGet.mockReturnValue({ value: validCookie })
    vi.stubEnv('LINKEDIN_CLIENT_ID', 'test-li-id')
    vi.stubEnv('LINKEDIN_CLIENT_SECRET', 'test-li-secret')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  })

  it('redirects with error=unauthorized when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=unauthorized')
  })

  it('redirects with error=invalid_state when cookie missing', async () => {
    mockCookieGet.mockReturnValue(undefined)
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=invalid_state')
  })

  it('redirects with error=invalid_state when state mismatch', async () => {
    const res = await GET(makeRequest({ code: 'abc', state: 'wrong' }))
    expect(res.headers.get('location')).toContain('error=invalid_state')
  })

  it('redirects with error=oauth_denied on OAuth error', async () => {
    const res = await GET(makeRequest({ error: 'user_cancelled_authorize', state: validState }))
    expect(res.headers.get('location')).toContain('error=oauth_denied')
  })

  it('redirects with error=missing_code when no code param', async () => {
    const res = await GET(makeRequest({ state: validState }))
    expect(res.headers.get('location')).toContain('error=missing_code')
  })

  it('redirects with error=not_configured when credentials missing', async () => {
    vi.stubEnv('LINKEDIN_CLIENT_ID', '')
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=not_configured')
  })

  it('redirects with error=token_exchange_failed on token failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'invalid_grant' }),
    })
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=token_exchange_failed')
  })

  it('redirects with error=profile_fetch_failed when profile fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: 'li-tok', refresh_token: 'li-ref', expires_in: 5184000 }),
    })
    mockFetch.mockResolvedValueOnce({ ok: false })
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=profile_fetch_failed')
  })

  it('redirects with error=storage_failed when upsert fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'li-tok', expires_in: 5184000 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          sub: 'li-user-1',
          email: 'user@example.com',
          name: 'Test',
          picture: 'https://pic.jpg',
        }),
    })
    mockUpsert.mockResolvedValue({ error: { message: 'DB error' } })
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=storage_failed')
  })

  it('completes full flow and redirects with connected=linkedin', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: 'li-tok', refresh_token: 'li-ref', expires_in: 5184000 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          sub: 'li-user-1',
          email: 'user@example.com',
          name: 'Test User',
          picture: 'https://pic.jpg',
        }),
    })
    mockUpsert.mockResolvedValue({ error: null })

    const res = await GET(makeRequest({ code: 'auth-code', state: validState }))

    expect(res.headers.get('location')).toContain('connected=linkedin')

    expect(mockFetch.mock.calls[0][0]).toBe('https://www.linkedin.com/oauth/v2/accessToken')
    expect(mockFetch.mock.calls[1][0]).toBe('https://api.linkedin.com/v2/userinfo')

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        provider: 'linkedin',
        provider_account_id: 'li-user-1',
        username: 'user@example.com',
        access_token: 'li-tok',
        status: 'active',
      }),
      expect.objectContaining({ onConflict: 'user_id,provider,provider_account_id' })
    )
  })

  it('clears the oauth cookie after use', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'li-tok', expires_in: 5184000 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sub: 'li-1', email: 'a@b.com', name: 'Test' }),
    })
    mockUpsert.mockResolvedValue({ error: null })

    await GET(makeRequest({ code: 'abc', state: validState }))

    expect(mockCookieSet).toHaveBeenCalledWith(
      'linkedin_oauth_state',
      '',
      expect.objectContaining({ maxAge: 0 })
    )
  })
})
