import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  validateScopes: vi.fn(),
}))

// Search chain: .from().select().eq().neq().order().limit()
const mockLimit = vi.fn()
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockNeq = vi.fn(() => ({ order: mockOrder }))
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

describe('GET /api/posts/search (1/6)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/posts/search?q=hello')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', scopes: ['posts:write'] })
    const { validateScopes } = await import('@/lib/auth')
    vi.mocked(validateScopes).mockImplementation(() => {
      throw new Error('Forbidden')
    })
    const req = createRequest('/api/posts/search?q=hello')
    const res = await GET(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 400 when search query is missing', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/posts/search')
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Search query is required')
  })

  it('returns 400 when query param is empty string', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/posts/search?q=')
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Search query is required')
  })
})

describe('GET /api/posts/search (2/6)', () => {
  it('returns matching posts using q param', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbPosts = [
      {
        id: 'post-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        scheduled_at: null,
        status: 'draft',
        platform: 'twitter',
        notes: 'hello world',
        campaign_id: null,
        group_id: null,
        group_type: null,
        content: { text: 'Hello there' },
        publish_result: null,
        user_id: 'user-1',
      },
    ]
    mockLimit.mockResolvedValue({ data: dbPosts, error: null })
    const req = createRequest('/api/posts/search?q=hello')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.posts).toHaveLength(1)
    expect(body.posts[0].id).toBe('post-1')
    // Verify camelCase transform
    expect(body.posts[0].createdAt).toBe('2024-01-01T00:00:00Z')
  })
})

describe('GET /api/posts/search (3/6)', () => {
  it('returns matching posts using query param', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbPosts = [
      {
        id: 'post-2',
        created_at: '2024-02-01T00:00:00Z',
        updated_at: '2024-02-02T00:00:00Z',
        scheduled_at: null,
        status: 'draft',
        platform: 'linkedin',
        notes: 'search term',
        campaign_id: null,
        group_id: null,
        group_type: null,
        content: { text: 'Some content' },
        publish_result: null,
        user_id: 'user-1',
      },
    ]
    mockLimit.mockResolvedValue({ data: dbPosts, error: null })
    const req = createRequest('/api/posts/search?query=search')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.posts).toHaveLength(1)
    expect(body.posts[0].id).toBe('post-2')
  })
})

describe('GET /api/posts/search (4/6)', () => {
  it('filters results client-side by content JSON', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbPosts = [
      {
        id: 'post-match',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        scheduled_at: null,
        status: 'draft',
        platform: 'twitter',
        notes: null,
        campaign_id: null,
        group_id: null,
        group_type: null,
        content: { text: 'This contains findme keyword' },
        publish_result: null,
        user_id: 'user-1',
      },
      {
        id: 'post-nomatch',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        scheduled_at: null,
        status: 'draft',
        platform: 'twitter',
        notes: null,
        campaign_id: null,
        group_id: null,
        group_type: null,
        content: { text: 'No match here' },
        publish_result: null,
        user_id: 'user-1',
      },
    ]
    mockLimit.mockResolvedValue({ data: dbPosts, error: null })
    const req = createRequest('/api/posts/search?q=findme')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.posts).toHaveLength(1)
    expect(body.posts[0].id).toBe('post-match')
  })
})

describe('GET /api/posts/search (5/6)', () => {
  it('returns empty array when no posts match', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: [], error: null })
    const req = createRequest('/api/posts/search?q=nonexistent')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.posts).toEqual([])
  })

  it('returns 500 when database query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({
      data: null,
      error: { code: 'OTHER', message: 'Connection error' },
    })
    const req = createRequest('/api/posts/search?q=hello')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })

  it('excludes archived posts via neq filter', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: [], error: null })
    const req = createRequest('/api/posts/search?q=hello')
    await GET(req)
    expect(mockNeq).toHaveBeenCalledWith('status', 'archived')
  })
})

describe('GET /api/posts/search (6/6)', () => {
  it('respects custom limit parameter via client-side slice', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbPosts = Array.from({ length: 5 }, (_, i) => ({
      id: `post-${i}`,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      scheduled_at: null,
      status: 'draft',
      platform: 'twitter',
      notes: 'match',
      campaign_id: null,
      group_id: null,
      group_type: null,
      content: { text: 'match' },
      publish_result: null,
      user_id: 'user-1',
    }))
    mockLimit.mockResolvedValue({ data: dbPosts, error: null })
    const req = createRequest('/api/posts/search?q=match&limit=2')
    const res = await GET(req)
    const body = await res.json()
    expect(body.posts).toHaveLength(2)
    // DB always fetches buffer of 500
    expect(mockLimit).toHaveBeenCalledWith(500)
  })

  it('fetches 500-row buffer from DB regardless of requested limit', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: [], error: null })
    const req = createRequest('/api/posts/search?q=hello')
    await GET(req)
    expect(mockLimit).toHaveBeenCalledWith(500)
  })
})
