import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  validateScopes: vi.fn(),
}))

// Search chain: .from().select().eq().neq().or().order().limit()
const mockLimit = vi.fn()
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockOr = vi.fn(() => ({ order: mockOrder }))
const mockNeq = vi.fn(() => ({ or: mockOr }))
const mockSelectEq1 = vi.fn(() => ({ neq: mockNeq }))
const mockSelect = vi.fn(() => ({ eq: mockSelectEq1 }))

const mockFrom = vi.fn(() => ({
  select: mockSelect,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}))

import { GET } from './route'
import { requireAuth } from '@/lib/auth'

const mockRequireAuth = vi.mocked(requireAuth)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/blog-drafts/search (1/5)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/blog-drafts/search?q=hello')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', scopes: ['blog:write'] })
    const { validateScopes } = await import('@/lib/auth')
    vi.mocked(validateScopes).mockImplementation(() => {
      throw new Error('Forbidden')
    })
    const req = createRequest('/api/blog-drafts/search?q=hello')
    const res = await GET(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 400 when search query is missing', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/blog-drafts/search')
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Search query is required')
  })

  it('returns 400 when query param is empty string', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/blog-drafts/search?q=')
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Search query is required')
  })
})

describe('GET /api/blog-drafts/search (2/5)', () => {
  it('returns matching drafts using q param', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbDrafts = [
      {
        id: 'draft-1',
        created_at: '2024-05-01T00:00:00Z',
        updated_at: '2024-05-15T00:00:00Z',
        scheduled_at: null,
        status: 'draft',
        title: 'Hello World Blog',
        date: null,
        content: 'Some content here',
        notes: null,
        word_count: 3,
        campaign_id: null,
        images: [],
        user_id: 'user-1',
      },
    ]
    mockLimit.mockResolvedValue({ data: dbDrafts, error: null })
    const req = createRequest('/api/blog-drafts/search?q=hello')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.drafts).toHaveLength(1)
    expect(body.drafts[0].id).toBe('draft-1')
    // Verify camelCase transform
    expect(body.drafts[0].createdAt).toBe('2024-05-01T00:00:00Z')
    expect(body.drafts[0].wordCount).toBe(3)
  })
})

describe('GET /api/blog-drafts/search (3/5)', () => {
  it('returns matching drafts using query param', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbDrafts = [
      {
        id: 'draft-2',
        created_at: '2024-06-01T00:00:00Z',
        updated_at: '2024-06-15T00:00:00Z',
        scheduled_at: null,
        status: 'draft',
        title: 'Search Term Blog',
        date: null,
        content: 'Content with search term',
        notes: null,
        word_count: 4,
        campaign_id: null,
        images: [],
        user_id: 'user-1',
      },
    ]
    mockLimit.mockResolvedValue({ data: dbDrafts, error: null })
    const req = createRequest('/api/blog-drafts/search?query=search')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.drafts).toHaveLength(1)
    expect(body.drafts[0].id).toBe('draft-2')
  })

  it('returns empty array when no drafts match', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: [], error: null })
    const req = createRequest('/api/blog-drafts/search?q=nonexistent')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.drafts).toEqual([])
  })

  it('handles null data from database', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: null, error: null })
    const req = createRequest('/api/blog-drafts/search?q=hello')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.drafts).toEqual([])
  })
})

describe('GET /api/blog-drafts/search (4/5)', () => {
  it('returns 500 when database query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({
      data: null,
      error: { code: 'OTHER', message: 'Connection error' },
    })
    const req = createRequest('/api/blog-drafts/search?q=hello')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })

  it('excludes archived drafts via neq filter', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: [], error: null })
    const req = createRequest('/api/blog-drafts/search?q=hello')
    await GET(req)
    expect(mockNeq).toHaveBeenCalledWith('status', 'archived')
  })

  it('respects custom limit parameter', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: [], error: null })
    const req = createRequest('/api/blog-drafts/search?q=hello&limit=10')
    await GET(req)
    expect(mockLimit).toHaveBeenCalledWith(10)
  })

  it('uses default limit of 50 when not specified', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: [], error: null })
    const req = createRequest('/api/blog-drafts/search?q=hello')
    await GET(req)
    expect(mockLimit).toHaveBeenCalledWith(50)
  })
})

describe('GET /api/blog-drafts/search (5/5)', () => {
  it('transforms images field correctly with default empty array', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbDrafts = [
      {
        id: 'draft-3',
        created_at: '2024-07-01T00:00:00Z',
        updated_at: '2024-07-15T00:00:00Z',
        scheduled_at: null,
        status: 'draft',
        title: 'No Images Blog',
        date: null,
        content: 'Content without images',
        notes: null,
        word_count: 3,
        campaign_id: null,
        // images is undefined/null — should default to []
        user_id: 'user-1',
      },
    ]
    mockLimit.mockResolvedValue({ data: dbDrafts, error: null })
    const req = createRequest('/api/blog-drafts/search?q=images')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.drafts[0].images).toEqual([])
  })
})
