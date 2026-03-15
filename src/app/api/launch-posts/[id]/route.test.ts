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

// GET chain: .from().select().eq().eq().single()
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
// GET /api/launch-posts/[id]
// ---------------------------------------------------------------------------

describe('GET /api/launch-posts/[id] (1/2)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/launch-posts/lp-1')
    const res = await GET(req, makeParams('lp-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns launch post for authenticated owner', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbPost = {
      id: 'lp-1',
      created_at: '2024-05-01T00:00:00Z',
      updated_at: '2024-05-15T00:00:00Z',
      platform: 'product_hunt',
      status: 'draft',
      scheduled_at: null,
      posted_at: null,
      title: 'My Launch',
      url: 'https://example.com',
      description: 'A great launch',
      platform_fields: { tagline: 'Best app ever' },
      campaign_id: null,
      notes: null,
      user_id: 'user-1',
    }
    mockFetchSingle.mockResolvedValue({ data: dbPost, error: null })
    const req = createRequest('/api/launch-posts/lp-1')
    const res = await GET(req, makeParams('lp-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.launchPost.id).toBe('lp-1')
    expect(body.launchPost.platform).toBe('product_hunt')
    expect(body.launchPost.platformFields).toEqual({ tagline: 'Best app ever' })
  })
})

describe('GET /api/launch-posts/[id] (2/2)', () => {
  it('returns 404 when launch post not found (PGRST116)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' },
    })
    const req = createRequest('/api/launch-posts/nonexistent')
    const res = await GET(req, makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Launch post not found')
  })

  it('returns 500 for other database errors', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockFetchSingle.mockResolvedValue({
      data: null,
      error: { code: 'OTHER', message: 'Connection error' },
    })
    const req = createRequest('/api/launch-posts/lp-1')
    const res = await GET(req, makeParams('lp-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/launch-posts/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/launch-posts/[id] (1/3)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/launch-posts/lp-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, makeParams('lp-1'))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid input (bad platform)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/launch-posts/lp-1', {
      method: 'PATCH',
      body: JSON.stringify({ platform: 'invalid_platform' }),
    })
    const res = await PATCH(req, makeParams('lp-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })
})

describe('PATCH /api/launch-posts/[id] (2/3)', () => {
  it('updates launch post successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const updatedPost = {
      id: 'lp-1',
      created_at: '2024-05-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
      platform: 'product_hunt',
      status: 'scheduled',
      scheduled_at: '2024-07-01T00:00:00Z',
      posted_at: null,
      title: 'Updated Launch',
      url: 'https://example.com',
      description: 'Updated description',
      platform_fields: {},
      campaign_id: null,
      notes: null,
      user_id: 'user-1',
    }
    mockUpdateSingle.mockResolvedValue({ data: updatedPost, error: null })
    const req = createRequest('/api/launch-posts/lp-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated Launch', status: 'scheduled' }),
    })
    const res = await PATCH(req, makeParams('lp-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.launchPost.title).toBe('Updated Launch')
    expect(body.launchPost.status).toBe('scheduled')
  })

  it('returns 404 when launch post not found on update', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockUpdateSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    })
    const req = createRequest('/api/launch-posts/lp-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, makeParams('lp-1'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Launch post not found')
  })
})

describe('PATCH /api/launch-posts/[id] (3/3)', () => {
  it('returns 500 when update fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockUpdateSingle.mockResolvedValue({
      data: null,
      error: { code: 'OTHER', message: 'Update failed' },
    })
    const req = createRequest('/api/launch-posts/lp-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, makeParams('lp-1'))
    expect(res.status).toBe(500)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/launch-posts/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/launch-posts/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/launch-posts/lp-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('lp-1'))
    expect(res.status).toBe(401)
  })

  it('deletes launch post successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockDeleteEq2.mockResolvedValue({ error: null })
    const req = createRequest('/api/launch-posts/lp-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('lp-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 when delete fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockDeleteEq2.mockResolvedValue({ error: { message: 'Delete failed' } })
    const req = createRequest('/api/launch-posts/lp-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('lp-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
