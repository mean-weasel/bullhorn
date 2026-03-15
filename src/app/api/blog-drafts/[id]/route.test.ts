import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireAuth: vi.fn(),
  validateScopes: vi.fn(),
}))

// GET/PATCH fetch chain: .from().select().eq().eq().single()
const mockFetchSingle = vi.fn()
const mockSelectEq2 = vi.fn(() => ({ single: mockFetchSingle }))
const mockSelectEq1 = vi.fn(() => ({ eq: mockSelectEq2 }))
const mockSelect = vi.fn(() => ({ eq: mockSelectEq1 }))

// PATCH update chain: .from().update().eq().eq().select().single()
const mockUpdateSingle = vi.fn()
const mockUpdateSelect = vi.fn(() => ({ single: mockUpdateSingle }))
const mockUpdateEq2 = vi.fn(() => ({ select: mockUpdateSelect }))
const mockUpdateEq1 = vi.fn(() => ({ eq: mockUpdateEq2 }))
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq1 }))

// DELETE chain: .from().delete().eq().eq()
const mockDeleteEq2 = vi.fn()
const mockDeleteEq1 = vi.fn(() => ({ eq: mockDeleteEq2 }))
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq1 }))

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
// GET /api/blog-drafts/[id]
// ---------------------------------------------------------------------------

describe('GET /api/blog-drafts/[id] (1/2)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/blog-drafts/draft-1')
    const res = await GET(req, makeParams('draft-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns draft for authenticated owner', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbDraft = {
      id: 'draft-1',
      created_at: '2024-05-01T00:00:00Z',
      updated_at: '2024-05-15T00:00:00Z',
      scheduled_at: null,
      status: 'draft',
      title: 'My Post',
      date: null,
      content: 'Hello',
      notes: null,
      word_count: 1,
      campaign_id: null,
      images: [],
      tags: [],
      user_id: 'user-1',
    }
    mockFetchSingle.mockResolvedValue({ data: dbDraft, error: null })
    const req = createRequest('/api/blog-drafts/draft-1')
    const res = await GET(req, makeParams('draft-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.draft.id).toBe('draft-1')
    expect(body.draft.title).toBe('My Post')
  })
})

describe('GET /api/blog-drafts/[id] (2/2)', () => {
  it('returns 404 when draft not found (PGRST116)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' },
    })
    const req = createRequest('/api/blog-drafts/nonexistent')
    const res = await GET(req, makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Blog draft not found')
  })

  it('returns 500 for other database errors', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: null,
      error: { code: 'OTHER', message: 'Connection error' },
    })
    const req = createRequest('/api/blog-drafts/draft-1')
    const res = await GET(req, makeParams('draft-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/blog-drafts/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/blog-drafts/[id] (1/4)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/blog-drafts/draft-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, makeParams('draft-1'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid input (bad status)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/blog-drafts/draft-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'invalid_status' }),
    })
    const res = await PATCH(req, makeParams('draft-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })

  it('returns 404 when draft not found for status check', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    })
    const req = createRequest('/api/blog-drafts/draft-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, makeParams('draft-1'))
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/blog-drafts/[id] (2/4)', () => {
  it('returns 400 for invalid status transition', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // Current status is 'draft', trying to go to 'published' (not allowed)
    mockFetchSingle.mockResolvedValue({
      data: { status: 'draft' },
      error: null,
    })
    const req = createRequest('/api/blog-drafts/draft-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'published' }),
    })
    const res = await PATCH(req, makeParams('draft-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Cannot transition from draft to published')
  })
})

describe('PATCH /api/blog-drafts/[id] (3/4)', () => {
  it('updates draft successfully with valid status transition', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // Current status is 'draft', going to 'scheduled' (allowed)
    mockFetchSingle.mockResolvedValue({
      data: { status: 'draft' },
      error: null,
    })
    const updatedDraft = {
      id: 'draft-1',
      created_at: '2024-05-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
      scheduled_at: '2024-07-01T00:00:00Z',
      status: 'scheduled',
      title: 'My Post',
      date: null,
      content: 'Hello',
      notes: null,
      word_count: 1,
      campaign_id: null,
      images: [],
      tags: [],
      user_id: 'user-1',
    }
    mockUpdateSingle.mockResolvedValue({ data: updatedDraft, error: null })
    const req = createRequest('/api/blog-drafts/draft-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'scheduled' }),
    })
    const res = await PATCH(req, makeParams('draft-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.draft.status).toBe('scheduled')
  })
})

describe('PATCH /api/blog-drafts/[id] (4/4)', () => {
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
    const req = createRequest('/api/blog-drafts/draft-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, makeParams('draft-1'))
    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/blog-drafts/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/blog-drafts/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/blog-drafts/draft-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('draft-1'))
    expect(res.status).toBe(401)
  })

  it('deletes draft successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockDeleteEq2.mockResolvedValue({ error: null })
    const req = createRequest('/api/blog-drafts/draft-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('draft-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 when delete fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockDeleteEq2.mockResolvedValue({ error: { message: 'Delete failed' } })
    const req = createRequest('/api/blog-drafts/draft-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('draft-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
