import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAuth: () => mockRequireAuth() }))

const mockEnforceSocialAccountLimit = vi.fn()
vi.mock('@/lib/planEnforcement', () => ({
  enforceSocialAccountLimit: (...args: unknown[]) => mockEnforceSocialAccountLimit(...args),
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

// eslint-disable-next-line max-lines-per-function
describe('GET /api/social-accounts/linkedin/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-123' })
    mockEnforceSocialAccountLimit.mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 1,
      plan: 'free',
    })
    vi.stubEnv('LINKEDIN_CLIENT_ID', 'test-client-id')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when social account limit reached', async () => {
    mockEnforceSocialAccountLimit.mockResolvedValue({
      allowed: false,
      current: 1,
      limit: 1,
      plan: 'free',
    })
    const res = await GET()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('LinkedIn account limit reached')
    expect(body.plan).toBe('free')
  })

  it('returns 500 when LINKEDIN_CLIENT_ID is not set', async () => {
    vi.stubEnv('LINKEDIN_CLIENT_ID', '')
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('LinkedIn integration not configured')
  })

  it('returns OAuth URL with correct parameters', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toContain('https://www.linkedin.com/oauth/v2/authorization')
    expect(body.url).toContain('client_id=test-client-id')
    expect(body.url).toContain('response_type=code')
    expect(body.url).toContain('scope=')
  })

  it('sets linkedin_oauth_state cookie with state', async () => {
    await GET()
    expect(mockCookieSet).toHaveBeenCalledWith(
      'linkedin_oauth_state',
      expect.stringContaining('"state"'),
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 300,
        path: '/api/social-accounts/linkedin/callback',
      })
    )
    const cookieValue = mockCookieSet.mock.calls[0][1]
    const parsed = JSON.parse(cookieValue)
    expect(parsed).toHaveProperty('state')
    expect(typeof parsed.state).toBe('string')
  })

  it('includes w_member_social in requested scopes', async () => {
    const res = await GET()
    const body = await res.json()
    expect(body.url).toContain('w_member_social')
  })

  it('includes redirect_uri pointing to callback route', async () => {
    const res = await GET()
    const body = await res.json()
    const url = new URL(body.url)
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/social-accounts/linkedin/callback'
    )
  })
})
