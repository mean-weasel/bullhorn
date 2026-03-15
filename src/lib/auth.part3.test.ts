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
  resolveApiKey,
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

// ---------------------------------------------------------------------------
// resolveApiKey
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// hashApiKey
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// resolveApiKey
// ---------------------------------------------------------------------------

describe('resolveApiKey (1/2)', () => {
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
})

describe('resolveApiKey (2/2)', () => {
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
