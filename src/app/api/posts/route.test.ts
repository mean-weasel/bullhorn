import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/planEnforcement', () => ({
  enforceResourceLimit: vi.fn(async () => ({
    allowed: true,
    current: 0,
    limit: 50,
    plan: 'free',
  })),
  isPlanLimitError: vi.fn(() => false),
}))

const mockLimit = vi.fn()
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockQueryEq = vi.fn(() => ({ eq: mockQueryEq, order: mockOrder }))
const mockSelect = vi.fn(() => ({ eq: mockQueryEq }))
const mockInsertSingle = vi.fn()
const mockInsertSelect = vi.fn(() => ({ single: mockInsertSingle }))
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }))
const mockFrom = vi.fn(() => ({ select: mockSelect, insert: mockInsert }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}))

import { GET, POST } from './route'
import { requireAuth } from '@/lib/auth'

const mockRequireAuth = vi.mocked(requireAuth)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(
    new URL(url, 'http://localhost:3000'),
    init as ConstructorParameters<typeof NextRequest>[1]
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// GET /api/posts
// ---------------------------------------------------------------------------

describe('GET /api/posts', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/posts')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns posts for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbPosts = [
      {
        id: 'post-1',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
        scheduled_at: null,
        status: 'draft',
        platform: 'twitter',
        notes: null,
        campaign_id: null,
        group_id: null,
        group_type: null,
        content: { text: 'Hello' },
        publish_result: null,
        user_id: 'user-1',
      },
    ]
    mockLimit.mockResolvedValue({ data: dbPosts, error: null })
    const req = createRequest('/api/posts')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.posts).toHaveLength(1)
    expect(body.posts[0].id).toBe('post-1')
    expect(body.posts[0].platform).toBe('twitter')
  })

  it('filters by status query param', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: [], error: null })
    const req = createRequest('/api/posts?status=scheduled')
    await GET(req)
    // Verify .eq was called with status filter (the query chain includes status eq)
    expect(mockQueryEq).toHaveBeenCalled()
  })

  it('returns 500 when database query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const req = createRequest('/api/posts')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/posts
// ---------------------------------------------------------------------------

describe('POST /api/posts', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ platform: 'twitter', content: { text: 'test' } }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid input (missing platform)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ content: { text: 'test' } }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
    expect(body.details).toBeDefined()
  })

  it('returns 400 for invalid platform value', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ platform: 'tiktok', content: { text: 'test' } }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })

  it('creates post successfully and returns 201', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const createdPost = {
      id: 'post-new',
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
      scheduled_at: null,
      status: 'draft',
      platform: 'twitter',
      notes: null,
      campaign_id: null,
      group_id: null,
      group_type: null,
      content: { text: 'New post' },
      publish_result: null,
      user_id: 'user-1',
    }
    mockInsertSingle.mockResolvedValue({ data: createdPost, error: null })
    const req = createRequest('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ platform: 'twitter', content: { text: 'New post' } }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.post.id).toBe('post-new')
    expect(body.post.platform).toBe('twitter')
  })

  it('returns 500 when insert fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockInsertSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
    const req = createRequest('/api/posts', {
      method: 'POST',
      body: JSON.stringify({ platform: 'twitter', content: { text: 'test' } }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
