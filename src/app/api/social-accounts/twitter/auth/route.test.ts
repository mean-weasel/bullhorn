import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAuth: () => mockRequireAuth() }))

const mockCookieSet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      set: mockCookieSet,
      get: vi.fn(),
    })
  ),
}))

import { GET } from './route'

describe('GET /api/social-accounts/twitter/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-123' })
    vi.stubEnv('TWITTER_CLIENT_ID', 'test-client-id')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 500 when TWITTER_CLIENT_ID is not set', async () => {
    vi.stubEnv('TWITTER_CLIENT_ID', '')
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Twitter integration not configured')
  })

  it('returns OAuth URL with correct parameters', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toContain('https://x.com/i/oauth2/authorize')
    expect(body.url).toContain('client_id=test-client-id')
    expect(body.url).toContain('response_type=code')
    expect(body.url).toContain('scope=')
    expect(body.url).toContain('code_challenge=')
    expect(body.url).toContain('code_challenge_method=S256')
  })

  it('sets twitter_oauth_state cookie with state and codeVerifier', async () => {
    await GET()
    expect(mockCookieSet).toHaveBeenCalledWith(
      'twitter_oauth_state',
      expect.stringContaining('"state"'),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 300,
        path: '/api/social-accounts/twitter/callback',
      })
    )
    // Verify the cookie value is valid JSON with both state and codeVerifier
    const cookieValue = mockCookieSet.mock.calls[0][1]
    const parsed = JSON.parse(cookieValue)
    expect(parsed).toHaveProperty('state')
    expect(parsed).toHaveProperty('codeVerifier')
    expect(typeof parsed.state).toBe('string')
    expect(typeof parsed.codeVerifier).toBe('string')
  })

  it('includes offline.access in requested scopes', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.url).toContain('offline.access')
  })

  it('includes redirect_uri pointing to callback route', async () => {
    const res = await GET()
    const body = await res.json()
    const url = new URL(body.url)
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/social-accounts/twitter/callback'
    )
  })
})
