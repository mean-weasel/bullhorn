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

vi.mock('@/lib/planEnforcement', () => ({
  enforceResourceLimit: vi.fn(async () => ({
    allowed: true,
    current: 0,
    limit: 10,
    plan: 'free',
  })),
}))

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils')
  return {
    ...actual,
    escapeSearchPattern: vi.fn((s: string) => s),
  }
})

// The GET query chain: .from().select().eq().order() then optional .eq()/.or()/.limit()
// Final await returns { data, error }
let mockQueryData: { data: unknown; error: unknown } = { data: [], error: null }

const chainable = (): Record<string, unknown> => ({
  eq: mockChainEq,
  order: mockOrder,
  or: mockOr,
  limit: mockQueryLimit,
  then: (resolve: (val: unknown) => void) => resolve(mockQueryData),
})
const mockQueryLimit = vi.fn(chainable)
const mockOr = vi.fn(chainable)
const mockOrder = vi.fn(chainable)
const mockChainEq = vi.fn(chainable)
const mockSelect = vi.fn(() => ({ eq: mockChainEq }))

// POST insert chain: .from().insert().select().single()
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
import { enforceResourceLimit } from '@/lib/planEnforcement'

const mockRequireAuth = vi.mocked(requireAuth)
const mockEnforceResourceLimit = vi.mocked(enforceResourceLimit)

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
  mockQueryData = { data: [], error: null }
})

// ---------------------------------------------------------------------------
// GET /api/blog-drafts
// ---------------------------------------------------------------------------

describe('GET /api/blog-drafts', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/blog-drafts')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns drafts for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbDrafts = [
      {
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
        tags: ['tech'],
        user_id: 'user-1',
      },
    ]
    mockQueryData = { data: dbDrafts, error: null }
    const req = createRequest('/api/blog-drafts')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.drafts).toHaveLength(1)
    expect(body.drafts[0].id).toBe('draft-1')
    expect(body.drafts[0].title).toBe('My Blog Post')
    expect(body.drafts[0].tags).toEqual(['tech'])
  })

  it('returns empty array when user has no drafts', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockQueryData = { data: [], error: null }
    const req = createRequest('/api/blog-drafts')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.drafts).toEqual([])
  })

  it('returns 500 when database query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockQueryData = { data: null, error: { message: 'DB error' } }
    const req = createRequest('/api/blog-drafts')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })

  it('filters by status query param', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockQueryData = { data: [], error: null }
    const req = createRequest('/api/blog-drafts?status=published')
    await GET(req)
    expect(mockChainEq).toHaveBeenCalled()
  })

  it('filters by campaignId query param', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockQueryData = { data: [], error: null }
    const req = createRequest('/api/blog-drafts?campaignId=camp-1')
    await GET(req)
    expect(mockChainEq).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// POST /api/blog-drafts
// ---------------------------------------------------------------------------

describe('POST /api/blog-drafts', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/blog-drafts', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Draft' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 when plan limit reached', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockEnforceResourceLimit.mockResolvedValue({
      allowed: false,
      current: 10,
      limit: 10,
      plan: 'free',
    })
    const req = createRequest('/api/blog-drafts', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Draft' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Blog draft limit reached')
  })

  it('creates draft successfully and returns 201', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockEnforceResourceLimit.mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 10,
      plan: 'free',
    })
    const createdDraft = {
      id: 'draft-new',
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
      scheduled_at: null,
      status: 'draft',
      title: 'New Draft',
      date: null,
      content: 'Some content here',
      notes: null,
      word_count: 3,
      campaign_id: null,
      images: [],
      tags: [],
      user_id: 'user-1',
    }
    mockInsertSingle.mockResolvedValue({ data: createdDraft, error: null })
    const req = createRequest('/api/blog-drafts', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Draft', content: 'Some content here' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.draft.id).toBe('draft-new')
    expect(body.draft.title).toBe('New Draft')
  })

  it('returns 400 for invalid input (bad status)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockEnforceResourceLimit.mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 10,
      plan: 'free',
    })
    const req = createRequest('/api/blog-drafts', {
      method: 'POST',
      body: JSON.stringify({ status: 'invalid_status' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
    expect(body.details).toBeDefined()
  })

  it('returns 500 when insert fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockEnforceResourceLimit.mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 10,
      plan: 'free',
    })
    mockInsertSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
    const req = createRequest('/api/blog-drafts', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Draft' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
