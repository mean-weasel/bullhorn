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

describe('POST /api/blog-drafts/[id]/restore (1/4)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/blog-drafts/draft-1/restore', { method: 'POST' })
    const res = await POST(req, makeParams('draft-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', scopes: ['blog:read'] })
    const { validateScopes } = await import('@/lib/auth')
    vi.mocked(validateScopes).mockImplementation(() => {
      throw new Error('Forbidden')
    })
    const req = createRequest('/api/blog-drafts/draft-1/restore', { method: 'POST' })
    const res = await POST(req, makeParams('draft-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 404 when blog draft not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' },
    })
    const req = createRequest('/api/blog-drafts/nonexistent/restore', { method: 'POST' })
    const res = await POST(req, makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Blog draft not found')
  })

  it('returns 400 when blog draft is not archived', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: { status: 'draft' },
      error: null,
    })
    const req = createRequest('/api/blog-drafts/draft-1/restore', { method: 'POST' })
    const res = await POST(req, makeParams('draft-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Blog draft is not archived')
  })
})

describe('POST /api/blog-drafts/[id]/restore (2/4)', () => {
  it('returns 400 when blog draft is scheduled (not archived)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: { status: 'scheduled' },
      error: null,
    })
    const req = createRequest('/api/blog-drafts/draft-1/restore', { method: 'POST' })
    const res = await POST(req, makeParams('draft-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Blog draft is not archived')
  })

  it('restores an archived blog draft successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: { status: 'archived' },
      error: null,
    })
    const restoredDraft = {
      id: 'draft-1',
      created_at: '2024-05-01T00:00:00Z',
      updated_at: '2024-05-15T00:00:00Z',
      scheduled_at: null,
      status: 'draft',
      title: 'My Blog Post',
      date: '2024-06-01',
      content: 'Hello world',
      notes: 'some notes',
      word_count: 2,
      campaign_id: 'camp-1',
      images: [],
      user_id: 'user-1',
    }
    mockUpdateSingle.mockResolvedValue({ data: restoredDraft, error: null })
    const req = createRequest('/api/blog-drafts/draft-1/restore', { method: 'POST' })
    const res = await POST(req, makeParams('draft-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.draft.id).toBe('draft-1')
    expect(body.draft.status).toBe('draft')
    // Verify camelCase transform
    expect(body.draft.createdAt).toBe('2024-05-01T00:00:00Z')
    expect(body.draft.wordCount).toBe(2)
    expect(body.draft.campaignId).toBe('camp-1')
  })
})

describe('POST /api/blog-drafts/[id]/restore (3/4)', () => {
  it('returns 500 when fetch query fails with non-PGRST116 error', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: null,
      error: { code: 'OTHER', message: 'Connection error' },
    })
    const req = createRequest('/api/blog-drafts/draft-1/restore', { method: 'POST' })
    const res = await POST(req, makeParams('draft-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })

  it('returns 500 when update query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: { status: 'archived' },
      error: null,
    })
    mockUpdateSingle.mockResolvedValue({
      data: null,
      error: { code: 'OTHER', message: 'Update failed' },
    })
    const req = createRequest('/api/blog-drafts/draft-1/restore', { method: 'POST' })
    const res = await POST(req, makeParams('draft-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

describe('POST /api/blog-drafts/[id]/restore (4/4)', () => {
  it('sets status to draft when restoring', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: { status: 'archived' },
      error: null,
    })
    const restoredDraft = {
      id: 'draft-1',
      created_at: '2024-05-01T00:00:00Z',
      updated_at: '2024-05-15T00:00:00Z',
      scheduled_at: null,
      status: 'draft',
      title: 'My Blog Post',
      date: null,
      content: 'Hello world',
      notes: null,
      word_count: 2,
      campaign_id: null,
      images: [],
      user_id: 'user-1',
    }
    mockUpdateSingle.mockResolvedValue({ data: restoredDraft, error: null })
    const req = createRequest('/api/blog-drafts/draft-1/restore', { method: 'POST' })
    await POST(req, makeParams('draft-1'))
    // Verify update was called with status: 'draft'
    expect(mockUpdate).toHaveBeenCalledWith({ status: 'draft' })
  })
})
