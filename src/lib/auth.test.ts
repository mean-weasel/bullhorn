import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks – must be declared before importing the module under test
// ---------------------------------------------------------------------------

// Mock next/headers
const mockHeadersGet = vi.fn()
vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({
    get: mockHeadersGet,
  })),
}))

// Mock Supabase server client
const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ eq: mockEq, single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    auth: { getUser: mockGetUser },
  })),
}))

// Mock @supabase/supabase-js for resolveApiKey (service client)
const mockServiceSingle = vi.fn()
const mockServiceEq = vi.fn(() => ({ eq: mockServiceEq, single: mockServiceSingle }))
const mockServiceSelect = vi.fn(() => ({ eq: mockServiceEq }))
const mockServiceUpdate = vi.fn(() => ({
  eq: vi.fn(() => Promise.resolve({ error: null })),
}))
const mockServiceFrom = vi.fn(() => ({
  select: mockServiceSelect,
  update: mockServiceUpdate,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockServiceFrom,
  })),
}))

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

import {
  isTestMode,
  requireAuth,
  getOptionalAuth,
  getApiKeyFromHeaders,
  resolveApiKey,
  hashApiKey,
  validatePostOwnership,
  validateCampaignOwnership,
  validateProjectOwnership,
  validateBlogDraftOwnership,
} from './auth'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  // Reset env vars
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('E2E_TEST_MODE', '')
  vi.stubEnv('CI', '')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
})

// ---------------------------------------------------------------------------
// isTestMode
// ---------------------------------------------------------------------------

describe('isTestMode', () => {
  it('returns false when E2E_TEST_MODE is not set', () => {
    vi.stubEnv('E2E_TEST_MODE', '')
    vi.stubEnv('CI', 'true')
    expect(isTestMode()).toBe(false)
  })

  it('returns true when E2E_TEST_MODE and CI are both "true" and not production', () => {
    vi.stubEnv('E2E_TEST_MODE', 'true')
    vi.stubEnv('CI', 'true')
    vi.stubEnv('NODE_ENV', 'test')
    expect(isTestMode()).toBe(true)
  })

  it('returns false in production even if E2E_TEST_MODE and CI are "true"', () => {
    vi.stubEnv('E2E_TEST_MODE', 'true')
    vi.stubEnv('CI', 'true')
    vi.stubEnv('NODE_ENV', 'production')
    expect(isTestMode()).toBe(false)
  })

  it('returns false when CI is not set even if E2E_TEST_MODE is "true"', () => {
    vi.stubEnv('E2E_TEST_MODE', 'true')
    vi.stubEnv('CI', '')
    vi.stubEnv('NODE_ENV', 'test')
    expect(isTestMode()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getApiKeyFromHeaders
// ---------------------------------------------------------------------------

describe('getApiKeyFromHeaders', () => {
  it('returns the API key when Authorization header has Bearer bh_ prefix', async () => {
    mockHeadersGet.mockReturnValue('Bearer bh_abc123def456ghi789')
    const key = await getApiKeyFromHeaders()
    expect(key).toBe('bh_abc123def456ghi789')
  })

  it('returns null when Authorization header is missing', async () => {
    mockHeadersGet.mockReturnValue(null)
    const key = await getApiKeyFromHeaders()
    expect(key).toBeNull()
  })

  it('returns null when Authorization header does not have bh_ prefix', async () => {
    mockHeadersGet.mockReturnValue('Bearer sk_regular_token')
    const key = await getApiKeyFromHeaders()
    expect(key).toBeNull()
  })

  it('returns null for a plain Bearer token without bh_ prefix', async () => {
    mockHeadersGet.mockReturnValue('Bearer some-jwt-token')
    const key = await getApiKeyFromHeaders()
    expect(key).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// requireAuth
// ---------------------------------------------------------------------------

describe('requireAuth', () => {
  it('returns test user ID in test mode', async () => {
    vi.stubEnv('E2E_TEST_MODE', 'true')
    vi.stubEnv('CI', 'true')
    vi.stubEnv('NODE_ENV', 'test')
    const result = await requireAuth()
    expect(result).toEqual({ userId: '00000000-0000-0000-0000-000000000001' })
  })

  it('returns userId when Supabase session exists', async () => {
    mockHeadersGet.mockReturnValue(null) // no API key
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-abc-123' } },
      error: null,
    })
    const result = await requireAuth()
    expect(result).toEqual({ userId: 'user-abc-123' })
  })

  it('throws Unauthorized when no session and no API key', async () => {
    mockHeadersGet.mockReturnValue(null)
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'No session' },
    })
    await expect(requireAuth()).rejects.toThrow('Unauthorized')
  })

  it('throws Unauthorized when getUser returns error', async () => {
    mockHeadersGet.mockReturnValue(null)
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Token expired' },
    })
    await expect(requireAuth()).rejects.toThrow('Unauthorized')
  })
})

// ---------------------------------------------------------------------------
// getOptionalAuth
// ---------------------------------------------------------------------------

describe('getOptionalAuth', () => {
  it('returns test user ID in test mode', async () => {
    vi.stubEnv('E2E_TEST_MODE', 'true')
    vi.stubEnv('CI', 'true')
    vi.stubEnv('NODE_ENV', 'test')
    const result = await getOptionalAuth()
    expect(result).toEqual({ userId: '00000000-0000-0000-0000-000000000001' })
  })

  it('returns userId when session exists', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-xyz-789' } },
    })
    const result = await getOptionalAuth()
    expect(result).toEqual({ userId: 'user-xyz-789' })
  })

  it('returns null userId when no session', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    })
    const result = await getOptionalAuth()
    expect(result).toEqual({ userId: null })
  })
})

// ---------------------------------------------------------------------------
// resolveApiKey
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// hashApiKey
// ---------------------------------------------------------------------------

describe('hashApiKey', () => {
  it('returns SHA-256 hash when no HMAC secret is provided', () => {
    vi.stubEnv('API_KEY_HMAC_SECRET', '')
    const hash = hashApiKey('bh_testkey1234567890ab')
    // Should be a 64-char hex string (SHA-256)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns HMAC-SHA256 hash when secret is provided', () => {
    const hash = hashApiKey('bh_testkey1234567890ab', 'my-secret')
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('HMAC hash differs from plain SHA-256 hash for same input', () => {
    vi.stubEnv('API_KEY_HMAC_SECRET', '')
    const plainHash = hashApiKey('bh_testkey1234567890ab')
    const hmacHash = hashApiKey('bh_testkey1234567890ab', 'my-secret')
    expect(plainHash).not.toBe(hmacHash)
  })

  it('uses API_KEY_HMAC_SECRET env var when no explicit secret', () => {
    vi.stubEnv('API_KEY_HMAC_SECRET', 'env-secret')
    const envHash = hashApiKey('bh_testkey1234567890ab')
    const explicitHash = hashApiKey('bh_testkey1234567890ab', 'env-secret')
    expect(envHash).toBe(explicitHash)
  })

  it('produces deterministic results', () => {
    const hash1 = hashApiKey('bh_testkey1234567890ab', 'secret')
    const hash2 = hashApiKey('bh_testkey1234567890ab', 'secret')
    expect(hash1).toBe(hash2)
  })
})

// ---------------------------------------------------------------------------
// resolveApiKey
// ---------------------------------------------------------------------------

describe('resolveApiKey', () => {
  it('throws Unauthorized for keys that do not start with bh_', async () => {
    await expect(resolveApiKey('sk_invalidkeyformat12345')).rejects.toThrow('Unauthorized')
  })

  it('throws Unauthorized for keys shorter than 20 characters', async () => {
    await expect(resolveApiKey('bh_short')).rejects.toThrow('Unauthorized')
  })

  it('throws Unauthorized when Supabase env vars are missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    await expect(resolveApiKey('bh_a1b2c3d4e5f6g7h8i9j0')).rejects.toThrow('Unauthorized')
  })

  it('throws Unauthorized when key hash is not found in database', async () => {
    mockServiceSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })
    await expect(resolveApiKey('bh_a1b2c3d4e5f6g7h8i9j0')).rejects.toThrow('Unauthorized')
  })

  it('throws Unauthorized when key is revoked', async () => {
    mockServiceSingle.mockResolvedValue({
      data: {
        id: 'key-1',
        user_id: 'user-1',
        expires_at: null,
        revoked_at: '2024-01-01T00:00:00Z',
      },
      error: null,
    })
    await expect(resolveApiKey('bh_a1b2c3d4e5f6g7h8i9j0')).rejects.toThrow('Unauthorized')
  })

  it('throws Unauthorized when key is expired', async () => {
    mockServiceSingle.mockResolvedValue({
      data: {
        id: 'key-1',
        user_id: 'user-1',
        expires_at: '2020-01-01T00:00:00Z', // past date
        revoked_at: null,
      },
      error: null,
    })
    await expect(resolveApiKey('bh_a1b2c3d4e5f6g7h8i9j0')).rejects.toThrow('Unauthorized')
  })

  it('returns userId for a valid, non-expired, non-revoked key', async () => {
    mockServiceSingle.mockResolvedValue({
      data: {
        id: 'key-1',
        user_id: 'user-abc',
        expires_at: '2099-12-31T23:59:59Z',
        revoked_at: null,
      },
      error: null,
    })
    const result = await resolveApiKey('bh_a1b2c3d4e5f6g7h8i9j0')
    expect(result).toEqual({ userId: 'user-abc', scopes: [] })
  })

  it('returns userId when expires_at is null (never expires)', async () => {
    mockServiceSingle.mockResolvedValue({
      data: {
        id: 'key-2',
        user_id: 'user-def',
        expires_at: null,
        revoked_at: null,
      },
      error: null,
    })
    const result = await resolveApiKey('bh_a1b2c3d4e5f6g7h8i9j0')
    expect(result).toEqual({ userId: 'user-def', scopes: [] })
  })
})

// ---------------------------------------------------------------------------
// Ownership validators
// ---------------------------------------------------------------------------

describe('validatePostOwnership', () => {
  it('returns post data when user owns the post', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'post-1', campaign_id: 'camp-1' },
      error: null,
    })
    const result = await validatePostOwnership('post-1', 'user-abc')
    expect(result).toEqual({ id: 'post-1', campaignId: 'camp-1' })
    expect(mockFrom).toHaveBeenCalledWith('posts')
  })

  it('throws "Post not found" when post does not exist', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })
    await expect(validatePostOwnership('nonexistent', 'user-abc')).rejects.toThrow('Post not found')
  })

  it('throws "Post not found" when user does not own the post', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    await expect(validatePostOwnership('post-1', 'wrong-user')).rejects.toThrow('Post not found')
  })
})

describe('validateCampaignOwnership', () => {
  it('returns campaign data when user owns the campaign', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'camp-1', name: 'My Campaign', project_id: 'proj-1' },
      error: null,
    })
    const result = await validateCampaignOwnership('camp-1', 'user-abc')
    expect(result).toEqual({ id: 'camp-1', name: 'My Campaign', projectId: 'proj-1' })
    expect(mockFrom).toHaveBeenCalledWith('campaigns')
  })

  it('throws "Campaign not found" when campaign does not exist', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })
    await expect(validateCampaignOwnership('nonexistent', 'user-abc')).rejects.toThrow(
      'Campaign not found'
    )
  })
})

describe('validateProjectOwnership', () => {
  it('returns project data when user owns the project', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'proj-1', name: 'My Project' },
      error: null,
    })
    const result = await validateProjectOwnership('proj-1', 'user-abc')
    expect(result).toEqual({ id: 'proj-1', name: 'My Project' })
    expect(mockFrom).toHaveBeenCalledWith('projects')
  })

  it('throws "Project not found" when project does not exist', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })
    await expect(validateProjectOwnership('nonexistent', 'user-abc')).rejects.toThrow(
      'Project not found'
    )
  })
})

describe('validateBlogDraftOwnership', () => {
  it('returns draft data when user owns the draft', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'draft-1', title: 'My Draft' },
      error: null,
    })
    const result = await validateBlogDraftOwnership('draft-1', 'user-abc')
    expect(result).toEqual({ id: 'draft-1', title: 'My Draft' })
    expect(mockFrom).toHaveBeenCalledWith('blog_drafts')
  })

  it('throws "Blog draft not found" when draft does not exist', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })
    await expect(validateBlogDraftOwnership('nonexistent', 'user-abc')).rejects.toThrow(
      'Blog draft not found'
    )
  })
})
