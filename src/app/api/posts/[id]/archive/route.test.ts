import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  validateScopes: vi.fn(),
}))

// Fetch chain: .from().select().eq().eq().single()
const mockFetchSingle = vi.fn()
const mockSelectEq2 = vi.fn(() => ({ single: mockFetchSingle }))
const mockSelectEq1 = vi.fn(() => ({ eq: mockSelectEq2 }))
const mockSelect = vi.fn(() => ({ eq: mockSelectEq1 }))

// Update chain: .from().update().eq().eq().select().single()
const mockUpdateSingle = vi.fn()
const mockUpdateSelect = vi.fn(() => ({ single: mockUpdateSingle }))
const mockUpdateEq2 = vi.fn(() => ({ select: mockUpdateSelect }))
const mockUpdateEq1 = vi.fn(() => ({ eq: mockUpdateEq2 }))
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq1 }))

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}))

import { POST } from './route'
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

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/posts/[id]/archive (1/4)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/posts/post-1/archive', { method: 'POST' })
    const res = await POST(req, makeParams('post-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', scopes: ['posts:read'] })
    const { validateScopes } = await import('@/lib/auth')
    vi.mocked(validateScopes).mockImplementation(() => {
      throw new Error('Forbidden')
    })
    const req = createRequest('/api/posts/post-1/archive', { method: 'POST' })
    const res = await POST(req, makeParams('post-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 404 when post not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' },
    })
    const req = createRequest('/api/posts/nonexistent/archive', { method: 'POST' })
    const res = await POST(req, makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Post not found')
  })

  it('returns 400 when post is already archived', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: { status: 'archived' },
      error: null,
    })
    const req = createRequest('/api/posts/post-1/archive', { method: 'POST' })
    const res = await POST(req, makeParams('post-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Post is already archived')
  })
})

describe('POST /api/posts/[id]/archive (2/4)', () => {
  it('archives a draft post successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: { status: 'draft' },
      error: null,
    })
    const archivedPost = {
      id: 'post-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      scheduled_at: null,
      status: 'archived',
      platform: 'twitter',
      notes: null,
      campaign_id: null,
      group_id: null,
      group_type: null,
      content: { text: 'Hello' },
      publish_result: null,
      user_id: 'user-1',
    }
    mockUpdateSingle.mockResolvedValue({ data: archivedPost, error: null })
    const req = createRequest('/api/posts/post-1/archive', { method: 'POST' })
    const res = await POST(req, makeParams('post-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.post.id).toBe('post-1')
    expect(body.post.status).toBe('archived')
  })

  it('returns 500 when fetch query fails with non-PGRST116 error', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: null,
      error: { code: 'OTHER', message: 'Connection error' },
    })
    const req = createRequest('/api/posts/post-1/archive', { method: 'POST' })
    const res = await POST(req, makeParams('post-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

describe('POST /api/posts/[id]/archive (3/4)', () => {
  it('returns 500 when update query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: { status: 'draft' },
      error: null,
    })
    mockUpdateSingle.mockResolvedValue({
      data: null,
      error: { code: 'OTHER', message: 'Update failed' },
    })
    const req = createRequest('/api/posts/post-1/archive', { method: 'POST' })
    const res = await POST(req, makeParams('post-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

describe('POST /api/posts/[id]/archive (4/4)', () => {
  it('filters by user_id when querying', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: { status: 'draft' },
      error: null,
    })
    const archivedPost = {
      id: 'post-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      scheduled_at: null,
      status: 'archived',
      platform: 'twitter',
      notes: null,
      campaign_id: null,
      group_id: null,
      group_type: null,
      content: { text: 'Hello' },
      publish_result: null,
      user_id: 'user-1',
    }
    mockUpdateSingle.mockResolvedValue({ data: archivedPost, error: null })
    const req = createRequest('/api/posts/post-1/archive', { method: 'POST' })
    await POST(req, makeParams('post-1'))
    // Verify user_id is passed to both select and update eq chains
    expect(mockSelectEq1).toHaveBeenCalledWith('id', 'post-1')
    expect(mockSelectEq2).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mockUpdateEq1).toHaveBeenCalledWith('id', 'post-1')
    expect(mockUpdateEq2).toHaveBeenCalledWith('user_id', 'user-1')
  })
})
