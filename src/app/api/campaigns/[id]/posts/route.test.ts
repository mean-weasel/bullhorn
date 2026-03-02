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

// Track call sequence to return different data for different .from() calls
let fromCallIndex = 0
let fromCallResults: Array<{
  selectData?: { data: unknown; error: unknown }
  singleData?: { data: unknown; error: unknown }
  updateSingleData?: { data: unknown; error: unknown }
  orderData?: { data: unknown; error: unknown }
}> = []

function buildChain(callIndex: number) {
  const result = fromCallResults[callIndex] || {}

  const single = vi.fn(() => ({
    then: (resolve: (v: unknown) => void) =>
      resolve(result.singleData || { data: null, error: null }),
  }))

  const limit = vi.fn(() => ({
    then: (resolve: (v: unknown) => void) => resolve(result.orderData || { data: [], error: null }),
  }))

  const order = vi.fn(() => ({
    limit,
    then: (resolve: (v: unknown) => void) => resolve(result.orderData || { data: [], error: null }),
  }))

  const updateSingle = vi.fn(() => ({
    then: (resolve: (v: unknown) => void) =>
      resolve(result.updateSingleData || { data: null, error: null }),
  }))

  const updateSelect = vi.fn(() => ({ single: updateSingle }))

  const eq: ReturnType<typeof vi.fn> = vi.fn(() => ({
    eq,
    single,
    order,
    select: updateSelect,
  }))

  const select = vi.fn(() => ({ eq }))
  const update = vi.fn(() => ({ eq }))

  return { select, update }
}

const mockFrom = vi.fn(() => {
  const idx = fromCallIndex++
  return buildChain(idx)
})

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

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

const dbPost = {
  id: 'post-1',
  content: 'Hello world',
  status: 'draft',
  platform: 'twitter',
  campaign_id: 'camp-1',
  group_id: null,
  group_type: null,
  notes: null,
  publish_result: null,
  scheduled_at: null,
  created_at: '2024-05-02T00:00:00Z',
  updated_at: '2024-05-02T00:00:00Z',
  user_id: 'user-1',
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  fromCallIndex = 0
  fromCallResults = []
})

// ---------------------------------------------------------------------------
// GET /api/campaigns/[id]/posts
// ---------------------------------------------------------------------------

describe('GET /api/campaigns/[id]/posts', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/campaigns/camp-1/posts')
    const res = await GET(req, makeParams('camp-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Forbidden'))
    const req = createRequest('/api/campaigns/camp-1/posts')
    const res = await GET(req, makeParams('camp-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 404 when campaign not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // First from() call: campaign ownership check -> not found
    fromCallResults = [
      { singleData: { data: null, error: { code: 'PGRST116', message: 'not found' } } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts')
    const res = await GET(req, makeParams('camp-1'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Campaign not found')
  })

  it('returns posts for campaign', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // First from() call: campaign ownership check -> found
    // Second from() call: posts query -> returns posts
    fromCallResults = [
      { singleData: { data: { id: 'camp-1' }, error: null } },
      { orderData: { data: [dbPost], error: null } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts')
    const res = await GET(req, makeParams('camp-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.posts).toHaveLength(1)
    expect(body.posts[0].id).toBe('post-1')
    expect(body.posts[0].campaignId).toBe('camp-1')
  })

  it('returns empty array when campaign has no posts', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    fromCallResults = [
      { singleData: { data: { id: 'camp-1' }, error: null } },
      { orderData: { data: [], error: null } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts')
    const res = await GET(req, makeParams('camp-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.posts).toEqual([])
  })

  it('returns 500 when posts query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    fromCallResults = [
      { singleData: { data: { id: 'camp-1' }, error: null } },
      { orderData: { data: null, error: { message: 'DB error' } } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts')
    const res = await GET(req, makeParams('camp-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/campaigns/[id]/posts - Add post to campaign
// ---------------------------------------------------------------------------

describe('POST /api/campaigns/[id]/posts', () => {
  const validPostId = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5'

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/campaigns/camp-1/posts', {
      method: 'POST',
      body: JSON.stringify({ postId: validPostId }),
    })
    const res = await POST(req, makeParams('camp-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Forbidden'))
    const req = createRequest('/api/campaigns/camp-1/posts', {
      method: 'POST',
      body: JSON.stringify({ postId: validPostId }),
    })
    const res = await POST(req, makeParams('camp-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 400 for invalid input (non-uuid postId)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/campaigns/camp-1/posts', {
      method: 'POST',
      body: JSON.stringify({ postId: 'not-a-uuid' }),
    })
    const res = await POST(req, makeParams('camp-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })

  it('returns 400 when postId is missing', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/campaigns/camp-1/posts', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req, makeParams('camp-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('postId is required')
  })

  it('returns 404 when campaign not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // Campaign ownership check fails
    fromCallResults = [
      { singleData: { data: null, error: { code: 'PGRST116', message: 'not found' } } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts', {
      method: 'POST',
      body: JSON.stringify({ postId: validPostId }),
    })
    const res = await POST(req, makeParams('camp-1'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Campaign not found')
  })

  it('returns 404 when post not found (update matches 0 rows)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // Campaign check passes, update returns PGRST116 (post not found or not owned)
    fromCallResults = [
      { singleData: { data: { id: 'camp-1' }, error: null } },
      { updateSingleData: { data: null, error: { code: 'PGRST116', message: 'not found' } } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts', {
      method: 'POST',
      body: JSON.stringify({ postId: validPostId }),
    })
    const res = await POST(req, makeParams('camp-1'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Post not found')
  })

  it('adds post to campaign successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const updatedPost = { ...dbPost, id: validPostId, campaign_id: 'camp-1' }
    // Campaign check passes, update succeeds
    fromCallResults = [
      { singleData: { data: { id: 'camp-1' }, error: null } },
      { updateSingleData: { data: updatedPost, error: null } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts', {
      method: 'POST',
      body: JSON.stringify({ postId: validPostId }),
    })
    const res = await POST(req, makeParams('camp-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(validPostId)
    expect(body.campaignId).toBe('camp-1')
  })

  it('accepts post_id (snake_case) as well as postId', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const updatedPost = { ...dbPost, id: validPostId, campaign_id: 'camp-1' }
    // Campaign check passes, update succeeds
    fromCallResults = [
      { singleData: { data: { id: 'camp-1' }, error: null } },
      { updateSingleData: { data: updatedPost, error: null } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts', {
      method: 'POST',
      body: JSON.stringify({ post_id: validPostId }),
    })
    const res = await POST(req, makeParams('camp-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(validPostId)
  })

  it('returns 500 when update fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // Campaign check passes, update fails with non-PGRST116 error
    fromCallResults = [
      { singleData: { data: { id: 'camp-1' }, error: null } },
      { updateSingleData: { data: null, error: { code: 'OTHER', message: 'DB error' } } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts', {
      method: 'POST',
      body: JSON.stringify({ postId: validPostId }),
    })
    const res = await POST(req, makeParams('camp-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
