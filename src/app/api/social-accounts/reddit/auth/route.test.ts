import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  requireAuth: () => mockRequireAuth(),
}))

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

describe('GET /api/social-accounts/reddit/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-123' })
    vi.stubEnv('REDDIT_CLIENT_ID', 'test-client-id')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 500 when REDDIT_CLIENT_ID is not set', async () => {
    vi.stubEnv('REDDIT_CLIENT_ID', '')
    const res = await GET()
    expect(res.status).toBe(500)
  })

  it('returns OAuth URL with correct parameters', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toContain('https://www.reddit.com/api/v1/authorize')
    expect(body.url).toContain('client_id=test-client-id')
    expect(body.url).toContain('response_type=code')
    expect(body.url).toContain('duration=permanent')
  })

  it('sets cookie with state', async () => {
    await GET()
    expect(mockCookieSet).toHaveBeenCalledWith(
      'reddit_oauth_state',
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 300,
        path: '/api/social-accounts/reddit/callback',
      })
    )
  })

  it('includes required scopes', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.url).toContain('submit')
    expect(body.url).toContain('read')
    expect(body.url).toContain('identity')
    expect(body.url).toContain('flair')
  })

  it('includes redirect_uri pointing to callback route', async () => {
    const res = await GET()
    const body = await res.json()
    const url = new URL(body.url)
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/social-accounts/reddit/callback'
    )
  })
})
