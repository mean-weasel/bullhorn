import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  validateScopes: vi.fn(),
}))

// Track call sequence for different .from() invocations
let fromCallIndex = 0
let fromCallResults: Array<{
  singleData?: { data: unknown; error: unknown }
  updateSingleData?: { data: unknown; error: unknown }
}> = []

function buildChain(callIndex: number) {
  const result = fromCallResults[callIndex] || {}

  const single = vi.fn(() => ({
    then: (resolve: (v: unknown) => void) =>
      resolve(result.singleData || { data: null, error: null }),
  }))

  const updateSingle = vi.fn(() => ({
    then: (resolve: (v: unknown) => void) =>
      resolve(result.updateSingleData || { data: null, error: null }),
  }))

  const updateSelect = vi.fn(() => ({ single: updateSingle }))

  const eq: ReturnType<typeof vi.fn> = vi.fn(() => ({
    eq,
    single,
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

import { DELETE } from './route'
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

function makeParams(id: string, postId: string) {
  return { params: Promise.resolve({ id, postId }) }
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
// DELETE /api/campaigns/[id]/posts/[postId]
// ---------------------------------------------------------------------------

describe('DELETE /api/campaigns/[id]/posts/[postId]', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/campaigns/camp-1/posts/post-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('camp-1', 'post-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Forbidden'))
    const req = createRequest('/api/campaigns/camp-1/posts/post-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('camp-1', 'post-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 404 when campaign not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // Campaign ownership check fails
    fromCallResults = [
      { singleData: { data: null, error: { code: 'PGRST116', message: 'not found' } } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts/post-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('camp-1', 'post-1'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Campaign not found')
  })

  it('returns 404 when post not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // Campaign check passes, post fetch fails with PGRST116
    fromCallResults = [
      { singleData: { data: { id: 'camp-1' }, error: null } },
      { singleData: { data: null, error: { code: 'PGRST116', message: 'not found' } } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts/post-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('camp-1', 'post-1'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Post not found')
  })

  it('returns 400 when post does not belong to this campaign', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // Campaign check passes, post found but belongs to different campaign
    fromCallResults = [
      { singleData: { data: { id: 'camp-1' }, error: null } },
      { singleData: { data: { campaign_id: 'camp-other' }, error: null } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts/post-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('camp-1', 'post-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Post does not belong to this campaign')
  })

  it('removes post from campaign successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const updatedPost = {
      id: 'post-1',
      content: 'Hello',
      campaign_id: null,
      status: 'draft',
      platform: 'twitter',
    }
    // Campaign check passes, post belongs to campaign, update succeeds
    fromCallResults = [
      { singleData: { data: { id: 'camp-1' }, error: null } },
      { singleData: { data: { campaign_id: 'camp-1' }, error: null } },
      { updateSingleData: { data: updatedPost, error: null } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts/post-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('camp-1', 'post-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('post-1')
    expect(body.campaign_id).toBeNull()
  })

  it('returns 500 when post fetch fails with non-PGRST116 error', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    fromCallResults = [
      { singleData: { data: { id: 'camp-1' }, error: null } },
      { singleData: { data: null, error: { code: 'OTHER', message: 'DB error' } } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts/post-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('camp-1', 'post-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })

  it('returns 500 when update fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    fromCallResults = [
      { singleData: { data: { id: 'camp-1' }, error: null } },
      { singleData: { data: { campaign_id: 'camp-1' }, error: null } },
      { updateSingleData: { data: null, error: { message: 'Update failed' } } },
    ]

    const req = createRequest('/api/campaigns/camp-1/posts/post-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('camp-1', 'post-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
