import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireAuth: vi.fn(),
}))

const mockDeleteEq2 = vi.fn()
const mockDeleteEq1 = vi.fn(() => ({ eq: mockDeleteEq2 }))
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq1 }))

const mockUpdateSingle = vi.fn()
const mockUpdateSelect = vi.fn(() => ({ single: mockUpdateSingle }))
const mockUpdateEq2 = vi.fn(() => ({ select: mockUpdateSelect }))
const mockUpdateEq1 = vi.fn(() => ({ eq: mockUpdateEq2 }))
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq1 }))

const mockFetchSingle = vi.fn()
const mockSelectEq2 = vi.fn(() => ({ single: mockFetchSingle }))
const mockSelectEq1 = vi.fn(() => ({ eq: mockSelectEq2 }))
const mockSelect = vi.fn(() => ({ eq: mockSelectEq1 }))

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
  delete: mockDelete,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}))

import { GET, PATCH, DELETE } from './route'
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

// ---------------------------------------------------------------------------
// GET /api/posts/[id]
// ---------------------------------------------------------------------------

describe('GET /api/posts/[id] (1/2)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/posts/post-1')
    const res = await GET(req, makeParams('post-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns post for authenticated owner', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbPost = {
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
    }
    mockFetchSingle.mockResolvedValue({ data: dbPost, error: null })
    const req = createRequest('/api/posts/post-1')
    const res = await GET(req, makeParams('post-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.post.id).toBe('post-1')
  })

  it('returns 404 when post not found (PGRST116)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' },
    })
    const req = createRequest('/api/posts/nonexistent')
    const res = await GET(req, makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Post not found')
  })
})

describe('GET /api/posts/[id] (2/2)', () => {
  it('returns 500 for other database errors', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: null,
      error: { code: 'OTHER', message: 'Connection error' },
    })
    const req = createRequest('/api/posts/post-1')
    const res = await GET(req, makeParams('post-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/posts/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/posts/[id] (1/4)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/posts/post-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'scheduled' }),
    })
    const res = await PATCH(req, makeParams('post-1'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid input', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/posts/post-1', {
      method: 'PATCH',
      body: JSON.stringify({ platform: 'invalid_platform' }),
    })
    const res = await PATCH(req, makeParams('post-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })

  it('returns 404 when post not found for status check', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // First .from().select().eq().eq().single() call returns not found
    mockFetchSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    })
    const req = createRequest('/api/posts/post-1', {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'updated' }),
    })
    const res = await PATCH(req, makeParams('post-1'))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/posts/[id] (2/4)', () => {
  it('returns 400 for invalid status transition', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // Current post status is 'draft'
    mockFetchSingle.mockResolvedValue({
      data: { status: 'draft' },
      error: null,
    })
    const req = createRequest('/api/posts/post-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'published' }),
    })
    const res = await PATCH(req, makeParams('post-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Cannot transition from draft to published')
  })
})

describe('PATCH /api/posts/[id] (3/4)', () => {
  it('updates post successfully with valid status transition', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // First call: get current post status
    mockFetchSingle.mockResolvedValue({
      data: { status: 'draft' },
      error: null,
    })
    const updatedPost = {
      id: 'post-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
      scheduled_at: '2024-06-05T15:00:00Z',
      status: 'scheduled',
      platform: 'twitter',
      notes: null,
      campaign_id: null,
      group_id: null,
      group_type: null,
      content: { text: 'Hello' },
      publish_result: null,
      user_id: 'user-1',
    }
    mockUpdateSingle.mockResolvedValue({ data: updatedPost, error: null })
    const req = createRequest('/api/posts/post-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'scheduled' }),
    })
    const res = await PATCH(req, makeParams('post-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.post.status).toBe('scheduled')
  })
})

describe('PATCH /api/posts/[id] (4/4)', () => {
  it('returns 500 when update fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: { status: 'draft' },
      error: null,
    })
    mockUpdateSingle.mockResolvedValue({
      data: null,
      error: { code: 'OTHER', message: 'Update failed' },
    })
    const req = createRequest('/api/posts/post-1', {
      method: 'PATCH',
      body: JSON.stringify({ notes: 'updated note' }),
    })
    const res = await PATCH(req, makeParams('post-1'))
    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/posts/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/posts/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/posts/post-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('post-1'))
    expect(res.status).toBe(401)
  })

  it('deletes post successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockDeleteEq2.mockResolvedValue({ error: null })
    const req = createRequest('/api/posts/post-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('post-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 when delete fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockDeleteEq2.mockResolvedValue({ error: { message: 'Delete failed' } })
    const req = createRequest('/api/posts/post-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('post-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
