import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ requireAuth: () => mockRequireAuth() }))

const mockIsSelfHosted = vi.fn()
vi.mock('@/lib/selfHosted', () => ({ isSelfHosted: () => mockIsSelfHosted() }))

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

import { POST } from './route'

describe('POST /api/social-accounts/reddit/connect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsSelfHosted.mockReturnValue(true)
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    vi.stubEnv('REDDIT_CLIENT_ID', 'test-client-id')
    vi.stubEnv('REDDIT_CLIENT_SECRET', 'test-client-secret')
    vi.stubEnv('REDDIT_USERNAME', 'testuser')
    vi.stubEnv('REDDIT_PASSWORD', 'testpass')
  })

  it('returns 403 when not in self-hosted mode', async () => {
    mockIsSelfHosted.mockReturnValue(false)
    const res = await POST()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('self-hosted')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await POST()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 500 when Reddit credentials are missing', async () => {
    vi.stubEnv('REDDIT_CLIENT_ID', '')
    const res = await POST()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Reddit credentials not configured')
  })

  it('returns 500 when REDDIT_USERNAME is missing', async () => {
    vi.stubEnv('REDDIT_USERNAME', '')
    const res = await POST()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Reddit credentials not configured')
  })

  it('returns 502 when Reddit password grant fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: 'invalid_grant' }),
    })
    const res = await POST()
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe('Reddit authentication failed')
  })

  it('returns 502 when token response has no access_token', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    })
    const res = await POST()
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toContain('No access token')
  })

  it('returns 502 when Reddit profile fetch fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600 }),
    })
    mockFetch.mockResolvedValueOnce({ ok: false })
    const res = await POST()
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toContain('Reddit profile')
  })

  it('returns 500 when DB upsert fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'rd-1', name: 'testuser', icon_img: 'https://pic.jpg' }),
    })
    mockUpsert.mockResolvedValue({ error: { message: 'DB error' } })
    const res = await POST()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('store connection')
  })

  it('completes full flow and returns connected=true with username', async () => {
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

    const res = await POST()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.connected).toBe(true)
    expect(body.username).toBe('coolredditor')
  })

  it('uses grant_type=password in the token request', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'rd-1', name: 'testuser', icon_img: null }),
    })
    mockUpsert.mockResolvedValue({ error: null })

    await POST()

    const tokenCall = mockFetch.mock.calls[0]
    expect(tokenCall[0]).toBe('https://www.reddit.com/api/v1/access_token')
    const body = tokenCall[1].body as URLSearchParams
    expect(body.get('grant_type')).toBe('password')
    expect(body.get('username')).toBe('testuser')
    expect(body.get('password')).toBe('testpass')
  })

  it('stores the connection with correct shape', async () => {
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
          icon_img: 'https://pic.jpg?v=1',
        }),
    })
    mockUpsert.mockResolvedValue({ error: null })

    await POST()

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

  it('handles null icon_img gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ access_token: 'tok', expires_in: 3600 }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'rd-1', name: 'testuser', icon_img: null }),
    })
    mockUpsert.mockResolvedValue({ error: null })

    const res = await POST()
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ avatar_url: null }),
      expect.anything()
    )
  })
})
