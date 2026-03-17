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
  const url = new URL('/api/social-accounts/reddit/callback', 'http://localhost:3000')
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return new NextRequest(url)
}

describe('GET /api/social-accounts/reddit/callback', () => {
  const validState = 'test-state-789'

  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockCookieGet.mockReturnValue({ value: validState })
    vi.stubEnv('REDDIT_CLIENT_ID', 'test-reddit-id')
    vi.stubEnv('REDDIT_CLIENT_SECRET', 'test-reddit-secret')
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
    const res = await GET(makeRequest({ error: 'access_denied', state: validState }))
    expect(res.headers.get('location')).toContain('error=oauth_denied')
  })

  it('redirects with error=missing_code when no code', async () => {
    const res = await GET(makeRequest({ state: validState }))
    expect(res.headers.get('location')).toContain('error=missing_code')
  })

  it('redirects with error=token_exchange_failed when exchange fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'invalid_grant' }),
    })
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=token_exchange_failed')
  })

  it('redirects with error=token_exchange_failed when credentials missing', async () => {
    vi.stubEnv('REDDIT_CLIENT_ID', '')
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=token_exchange_failed')
  })

  it('redirects with error=profile_fetch_failed when profile fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: 'rd-tok', refresh_token: 'rd-ref', expires_in: 3600 }),
    })
    mockFetch.mockResolvedValueOnce({ ok: false })
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=profile_fetch_failed')
  })

  it('redirects with error=storage_failed when DB upsert fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: 'rd-tok', refresh_token: 'rd-ref', expires_in: 3600 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ id: 'rd-user-1', name: 'redditor', icon_img: 'https://pic.jpg?v=1' }),
    })
    mockUpsert.mockResolvedValue({ error: { message: 'DB error' } })
    const res = await GET(makeRequest({ code: 'abc', state: validState }))
    expect(res.headers.get('location')).toContain('error=storage_failed')
  })

  it('completes full flow and redirects with connected=reddit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ access_token: 'rd-tok', refresh_token: 'rd-ref', expires_in: 3600 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'rd-user-1',
          name: 'coolredditor',
          icon_img: 'https://pic.jpg?size=large',
        }),
    })
    mockUpsert.mockResolvedValue({ error: null })

    const res = await GET(makeRequest({ code: 'auth-code', state: validState }))

    expect(res.headers.get('location')).toContain('connected=reddit')

    expect(mockFetch.mock.calls[0][0]).toBe('https://www.reddit.com/api/v1/access_token')
    expect(mockFetch.mock.calls[1][0]).toBe('https://oauth.reddit.com/api/v1/me')

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        provider: 'reddit',
        provider_account_id: 'rd-user-1',
        username: 'coolredditor',
        access_token: 'rd-tok',
        refresh_token: 'rd-ref',
        status: 'active',
        avatar_url: 'https://pic.jpg',
      }),
      expect.objectContaining({ onConflict: 'user_id,provider,provider_account_id' })
    )
  })

  it('strips query params from Reddit avatar URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'rd-tok', expires_in: 3600 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ id: 'rd-1', name: 'user', icon_img: 'https://pic.jpg?size=large&v=2' }),
    })
    mockUpsert.mockResolvedValue({ error: null })

    await GET(makeRequest({ code: 'abc', state: validState }))

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: 'https://pic.jpg' }),
      expect.anything()
    )
  })

  it('clears the oauth cookie after use', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'rd-tok', expires_in: 3600 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'rd-1', name: 'user', icon_img: 'https://pic.jpg' }),
    })
    mockUpsert.mockResolvedValue({ error: null })

    await GET(makeRequest({ code: 'abc', state: validState }))

    expect(mockCookieSet).toHaveBeenCalledWith(
      'reddit_oauth_state',
      '',
      expect.objectContaining({ maxAge: 0 })
    )
  })
})
