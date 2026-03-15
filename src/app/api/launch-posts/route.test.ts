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
  isPlanLimitError: vi.fn(() => false),
}))

// GET query chain: .from().select().eq().order() then optional .eq()/.limit()
let mockQueryData: { data: unknown; error: unknown } = { data: [], error: null }

const chainable = (): Record<string, unknown> => ({
  eq: mockChainEq,
  order: mockOrder,
  limit: mockQueryLimit,
  then: (resolve: (val: unknown) => void) => resolve(mockQueryData),
})
const mockQueryLimit = vi.fn(chainable)
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
// GET /api/launch-posts
// ---------------------------------------------------------------------------

describe('GET /api/launch-posts (1/2)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/launch-posts')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns launch posts for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbPosts = [
      {
        id: 'lp-1',
        created_at: '2024-05-01T00:00:00Z',
        updated_at: '2024-05-15T00:00:00Z',
        platform: 'product_hunt',
        status: 'draft',
        scheduled_at: null,
        posted_at: null,
        title: 'Launch my app',
        url: 'https://example.com',
        description: 'A great app',
        platform_fields: {},
        campaign_id: null,
        notes: null,
        user_id: 'user-1',
      },
    ]
    mockQueryData = { data: dbPosts, error: null }
    const req = createRequest('/api/launch-posts')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.launchPosts).toHaveLength(1)
    expect(body.launchPosts[0].id).toBe('lp-1')
    expect(body.launchPosts[0].platform).toBe('product_hunt')
    expect(body.launchPosts[0].title).toBe('Launch my app')
  })
})

describe('GET /api/launch-posts (2/2)', () => {
  it('returns empty array when user has no launch posts', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockQueryData = { data: [], error: null }
    const req = createRequest('/api/launch-posts')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.launchPosts).toEqual([])
  })

  it('returns 500 when database query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockQueryData = { data: null, error: { message: 'DB error' } }
    const req = createRequest('/api/launch-posts')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })

  it('filters by platform query param', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockQueryData = { data: [], error: null }
    const req = createRequest('/api/launch-posts?platform=product_hunt')
    await GET(req)
    expect(mockChainEq).toHaveBeenCalled()
  })

  it('filters by status query param', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockQueryData = { data: [], error: null }
    const req = createRequest('/api/launch-posts?status=draft')
    await GET(req)
    expect(mockChainEq).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// POST /api/launch-posts
// ---------------------------------------------------------------------------

describe('POST /api/launch-posts (1/4)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/launch-posts', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'product_hunt',
        title: 'Test Launch',
      }),
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
    const req = createRequest('/api/launch-posts', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'product_hunt',
        title: 'Test Launch',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Launch post limit reached')
  })
})

describe('POST /api/launch-posts (2/4)', () => {
  it('returns 400 for invalid input (missing title)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockEnforceResourceLimit.mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 10,
      plan: 'free',
    })
    const req = createRequest('/api/launch-posts', {
      method: 'POST',
      body: JSON.stringify({ platform: 'product_hunt' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })

  it('returns 400 for invalid platform', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockEnforceResourceLimit.mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 10,
      plan: 'free',
    })
    const req = createRequest('/api/launch-posts', {
      method: 'POST',
      body: JSON.stringify({ platform: 'invalid_platform', title: 'Test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })
})
