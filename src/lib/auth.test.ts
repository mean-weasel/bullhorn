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

import { isTestMode, requireAuth, getOptionalAuth, getApiKeyFromHeaders, hashApiKey } from './auth'

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

  it('returns true when E2E_TEST_MODE and CI are both "true" and not on Vercel', () => {
    vi.stubEnv('E2E_TEST_MODE', 'true')
    vi.stubEnv('CI', 'true')
    vi.stubEnv('VERCEL', '')
    expect(isTestMode()).toBe(true)
  })

  it('returns false on Vercel even if E2E_TEST_MODE and CI are "true"', () => {
    vi.stubEnv('E2E_TEST_MODE', 'true')
    vi.stubEnv('CI', 'true')
    vi.stubEnv('VERCEL', '1')
    expect(isTestMode()).toBe(false)
  })

  it('returns false when CI is not set even if E2E_TEST_MODE is "true"', () => {
    vi.stubEnv('E2E_TEST_MODE', 'true')
    vi.stubEnv('CI', '')
    vi.stubEnv('VERCEL', '')
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
