import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the module under test
// ---------------------------------------------------------------------------

const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ eq: mockEq, single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect, update: mockUpdate }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: mockFrom })),
}))

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

import {
  isTokenExpiringSoon,
  refreshTokenIfNeeded,
  getValidAccessToken,
  TokenRefreshError,
} from './tokenRefresh'
import type { SocialAccountWithTokens } from './tokenRefresh'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()

function makeAccount(overrides: Partial<SocialAccountWithTokens> = {}): SocialAccountWithTokens {
  return {
    id: 'acct-1',
    provider: 'twitter',
    access_token: 'old-access-token',
    refresh_token: 'old-refresh-token',
    token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    ...overrides,
  }
}

function expiredAccount(provider: SocialAccountWithTokens['provider']): SocialAccountWithTokens {
  return makeAccount({
    provider,
    token_expires_at: new Date(Date.now() - 60_000).toISOString(),
  })
}

function mockSuccessfulRefresh(body: Record<string, unknown>) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body,
  })
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', mockFetch)
  vi.stubEnv('TWITTER_CLIENT_ID', 'tw-id')
  vi.stubEnv('TWITTER_CLIENT_SECRET', 'tw-secret')
  vi.stubEnv('LINKEDIN_CLIENT_ID', 'li-id')
  vi.stubEnv('LINKEDIN_CLIENT_SECRET', 'li-secret')
  vi.stubEnv('REDDIT_CLIENT_ID', 'rd-id')
  vi.stubEnv('REDDIT_CLIENT_SECRET', 'rd-secret')
  // Reset mock chains
  mockEq.mockReturnValue({ eq: mockEq, single: mockSingle })
})

// ---------------------------------------------------------------------------
// isTokenExpiringSoon
// ---------------------------------------------------------------------------

describe('isTokenExpiringSoon', () => {
  it('returns true when expiresAt is null', () => {
    expect(isTokenExpiringSoon(null)).toBe(true)
  })

  it('returns true when token is already expired', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isTokenExpiringSoon(past)).toBe(true)
  })

  it('returns true when token expires within 5 minutes', () => {
    const soonMs = Date.now() + 4 * 60 * 1000 // 4 minutes from now
    expect(isTokenExpiringSoon(new Date(soonMs).toISOString())).toBe(true)
  })

  it('returns false when token is far from expiry', () => {
    const future = new Date(Date.now() + 3600_000).toISOString() // 1 hour
    expect(isTokenExpiringSoon(future)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// refreshTokenIfNeeded — token still fresh
// ---------------------------------------------------------------------------

describe('refreshTokenIfNeeded (1/3)', () => {
  it('returns current tokens when token is not expiring', async () => {
    const account = makeAccount()
    const result = await refreshTokenIfNeeded(account)

    expect(result.accessToken).toBe('old-access-token')
    expect(result.refreshToken).toBe('old-refresh-token')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('refreshes Twitter token when expired', async () => {
    const account = expiredAccount('twitter')
    mockSuccessfulRefresh({
      access_token: 'new-tw-access',
      refresh_token: 'new-tw-refresh',
      expires_in: 7200,
    })

    const result = await refreshTokenIfNeeded(account)

    expect(result.accessToken).toBe('new-tw-access')
    expect(result.refreshToken).toBe('new-tw-refresh')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.x.com/2/oauth2/token',
      expect.objectContaining({ method: 'POST' })
    )
    expect(mockFrom).toHaveBeenCalledWith('social_accounts')
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        access_token: 'new-tw-access',
        refresh_token: 'new-tw-refresh',
        status: 'active',
        status_error: null,
      })
    )
  })
})

describe('refreshTokenIfNeeded (2/3)', () => {
  it('refreshes LinkedIn token when expired', async () => {
    const account = expiredAccount('linkedin')
    mockSuccessfulRefresh({
      access_token: 'new-li-access',
      refresh_token: 'new-li-refresh',
      expires_in: 5184000,
    })

    const result = await refreshTokenIfNeeded(account)

    expect(result.accessToken).toBe('new-li-access')
    expect(result.refreshToken).toBe('new-li-refresh')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.linkedin.com/oauth/v2/accessToken',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('refreshes Reddit token when expired', async () => {
    const account = expiredAccount('reddit')
    mockSuccessfulRefresh({
      access_token: 'new-rd-access',
      refresh_token: 'new-rd-refresh',
      expires_in: 3600,
    })

    const result = await refreshTokenIfNeeded(account)

    expect(result.accessToken).toBe('new-rd-access')
    expect(result.refreshToken).toBe('new-rd-refresh')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://www.reddit.com/api/v1/access_token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'User-Agent': 'web:bullhorn-scheduler:v1.0.0 (by /u/unknown)',
        }),
      })
    )
  })
})

describe('refreshTokenIfNeeded (3/3)', () => {
  it('marks account as expired on 401 response', async () => {
    const account = expiredAccount('twitter')
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'invalid_grant', error_description: 'Token revoked' }),
    })

    await expect(refreshTokenIfNeeded(account)).rejects.toThrow(TokenRefreshError)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'expired',
        status_error: 'Token expired, please reconnect',
      })
    )
  })

  it('marks account as error on non-401 failure', async () => {
    const account = expiredAccount('linkedin')
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'server_error', error_description: 'Internal error' }),
    })

    await expect(refreshTokenIfNeeded(account)).rejects.toThrow(TokenRefreshError)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        status_error: 'Internal error',
      })
    )
  })

  it('throws when no refresh token is available', async () => {
    const account = makeAccount({
      refresh_token: null,
      token_expires_at: new Date(Date.now() - 60_000).toISOString(),
    })

    await expect(refreshTokenIfNeeded(account)).rejects.toThrow('No refresh token')
  })
})

// ---------------------------------------------------------------------------
// getValidAccessToken
// ---------------------------------------------------------------------------

describe('getValidAccessToken', () => {
  it('fetches account and returns valid token when fresh', async () => {
    const futureExpiry = new Date(Date.now() + 3600_000).toISOString()
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'acct-1',
        provider: 'twitter',
        access_token: 'current-token',
        refresh_token: 'current-refresh',
        token_expires_at: futureExpiry,
      },
      error: null,
    })

    const token = await getValidAccessToken('acct-1')
    expect(token).toBe('current-token')
    expect(mockFrom).toHaveBeenCalledWith('social_accounts')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('throws when account is not found', async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found' },
    })

    await expect(getValidAccessToken('nonexistent')).rejects.toThrow('Social account not found')
  })

  it('refreshes and returns new token when expired', async () => {
    const pastExpiry = new Date(Date.now() - 60_000).toISOString()
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'acct-2',
        provider: 'reddit',
        access_token: 'stale-token',
        refresh_token: 'refresh-tok',
        token_expires_at: pastExpiry,
      },
      error: null,
    })

    mockSuccessfulRefresh({
      access_token: 'fresh-token',
      refresh_token: 'new-refresh',
      expires_in: 3600,
    })

    const token = await getValidAccessToken('acct-2')
    expect(token).toBe('fresh-token')
  })
})
