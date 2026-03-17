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
  const url = new URL('/api/social-accounts/twitter/callback', 'http://localhost:3000')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url)
}

describe('GET /api/social-accounts/twitter/callback', () => {
  const validState = 'test-state-123'
  const validCookie = JSON.stringify({ state: validState, codeVerifier: 'test-verifier' })

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockCookieGet.mockReturnValue({ value: validCookie })
    vi.stubEnv('TWITTER_CLIENT_ID', 'test-client-id')
    vi.stubEnv('TWITTER_CLIENT_SECRET', 'test-client-secret')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  })

  it('redirects to settings with error=unauthorized when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('error=unauthorized')
  })

  it('redirects with error=invalid_state when cookie is missing', async () => {
    mockCookieGet.mockReturnValue(undefined)
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=invalid_state')
  })

  it('redirects with error=invalid_state when state does not match', async () => {
    const res = await GET(makeRequest({ code: 'abc', state: 'wrong-state' }))
    expect(res.headers.get('location')).toContain('error=invalid_state')
  })

  it('redirects with error=oauth_denied when error param present', async () => {
    const res = await GET(makeRequest({ error: 'access_denied', state: validState }))
    expect(res.headers.get('location')).toContain('error=oauth_denied')
  })

  it('redirects with error=missing_code when code param absent', async () => {
    const res = await GET(makeRequest({ state: validState }))
    expect(res.headers.get('location')).toContain('error=missing_code')
  })

  it('redirects with error=not_configured when client credentials missing', async () => {
    vi.stubEnv('TWITTER_CLIENT_ID', '')
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=not_configured')
  })

  it('redirects with error=token_exchange_failed when token exchange fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'invalid_grant' }),
    })
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=token_exchange_failed')
  })

  it('redirects with error=profile_fetch_failed when user profile fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: 'tok-1', refresh_token: 'ref-1', expires_in: 7200 }),
    })
    mockFetch.mockResolvedValueOnce({ ok: false })
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=profile_fetch_failed')
  })

  it('redirects with error=storage_failed when DB upsert fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: 'tok-1', refresh_token: 'ref-1', expires_in: 7200 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'tw-123', username: 'testuser', name: 'Test' } }),
    })
    mockUpsert.mockResolvedValue({ error: { message: 'DB error' } })
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=storage_failed')
  })

  it('exchanges code, fetches profile, upserts, and redirects to settings on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: 'tok-1', refresh_token: 'ref-1', expires_in: 7200 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: 'tw-123',
            username: 'testuser',
            name: 'Test User',
            profile_image_url: 'https://img.x.com/pic.jpg',
          },
        }),
    })
    mockUpsert.mockResolvedValue({ error: null })

    const res = await GET(makeRequest({ code: 'auth-code', state: validState }))

    expect(res.headers.get('location')).toContain('connected=twitter')

    // Verify token exchange call
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.x.com/2/oauth2/token')

    // Verify profile fetch call
    expect(mockFetch.mock.calls[1][0]).toContain('https://api.x.com/2/users/me')

    // Verify upsert was called with correct data
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        provider: 'twitter',
        provider_account_id: 'tw-123',
        username: 'testuser',
        access_token: 'tok-1',
        refresh_token: 'ref-1',
        status: 'active',
      }),
      expect.objectContaining({ onConflict: 'user_id,provider,provider_account_id' })
    )
  })

  it('clears the oauth cookie after use', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok-1', expires_in: 7200 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'tw-123', username: 'testuser', name: 'Test' } }),
    })
    mockUpsert.mockResolvedValue({ error: null })

    await GET(makeRequest({ code: 'abc', state: validState }))

    expect(mockCookieSet).toHaveBeenCalledWith(
      'twitter_oauth_state',
      '',
      expect.objectContaining({ maxAge: 0 })
    )
  })
})
