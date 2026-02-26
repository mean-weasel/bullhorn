import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  validateScopes: vi.fn(),
}))

const mockPublishPost = vi.fn()
vi.mock('@/lib/publishers', () => ({
  publishPost: (...args: unknown[]) => mockPublishPost(...args),
}))

// We need to handle multiple .from() calls to different tables:
//   1. posts  -> select (fetch post)
//   2. social_accounts -> select (find account)
//   3. posts  -> update (set publishing)
//   4. posts  -> update (set final status)
//
// We track call order via mockFrom and return the right chain.

// --- Posts fetch chain: .from('posts').select('*').eq(id).eq(user_id).single()
const mockPostFetchSingle = vi.fn()
const mockPostFetchEq2 = vi.fn(() => ({ single: mockPostFetchSingle }))
const mockPostFetchEq1 = vi.fn(() => ({ eq: mockPostFetchEq2 }))
const mockPostFetchSelect = vi.fn(() => ({ eq: mockPostFetchEq1 }))

// --- Account fetch chain: .from('social_accounts').select('id')
//       .eq(user_id).eq(provider).eq(status).limit(1).single()
const mockAccountSingle = vi.fn()
const mockAccountLimit = vi.fn(() => ({ single: mockAccountSingle }))
const mockAccountEq3 = vi.fn(() => ({ limit: mockAccountLimit }))
const mockAccountEq2 = vi.fn(() => ({ eq: mockAccountEq3 }))
const mockAccountEq1 = vi.fn(() => ({ eq: mockAccountEq2 }))
const mockAccountSelect = vi.fn(() => ({ eq: mockAccountEq1 }))

// --- Posts lock update: .from('posts').update({status:'publishing'}).eq(id).eq(user_id)
const mockLockEq2 = vi.fn()
const mockLockEq1 = vi.fn(() => ({ eq: mockLockEq2 }))
const mockLockUpdate = vi.fn(() => ({ eq: mockLockEq1 }))

// --- Posts final update: .from('posts').update({status,publish_result})
//       .eq(id).eq(user_id).select().single()
const mockFinalSingle = vi.fn()
const mockFinalSelect = vi.fn(() => ({ single: mockFinalSingle }))
const mockFinalEq2 = vi.fn(() => ({ select: mockFinalSelect }))
const mockFinalEq1 = vi.fn(() => ({ eq: mockFinalEq2 }))
const mockFinalUpdate = vi.fn(() => ({ eq: mockFinalEq1 }))

// Track .from() call index to return the right chain
let fromCallIndex = 0
const mockFrom = vi.fn((table: string) => {
  if (table === 'social_accounts') {
    return { select: mockAccountSelect }
  }
  // For 'posts' table, order matters
  const idx = fromCallIndex++
  if (idx === 0) {
    // First posts call: fetch post
    return { select: mockPostFetchSelect }
  }
  if (idx === 1) {
    // Second posts call: set publishing status
    return { update: mockLockUpdate }
  }
  // Third posts call: set final status
  return { update: mockFinalUpdate }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}))

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils')
  return { ...actual }
})

import { POST } from './route'
import { requireAuth } from '@/lib/auth'

const mockRequireAuth = vi.mocked(requireAuth)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'POST',
  } as ConstructorParameters<typeof NextRequest>[1])
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
}

const DRAFT_POST_ROW = {
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
  content: { text: 'Hello world' },
  publish_result: null,
  user_id: 'user-1',
}

function publishedRow(overrides = {}) {
  return {
    ...DRAFT_POST_ROW,
    status: 'published',
    publish_result: {
      success: true,
      postId: 'tw-123',
      postUrl: 'https://x.com/user/status/123',
      publishedAt: '2024-01-02T12:00:00Z',
    },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  fromCallIndex = 0
})

describe('POST /api/posts/[id]/publish', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await POST(createRequest('/api/posts/post-1/publish'), makeParams('post-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 404 when post not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockPostFetchSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' },
    })
    const res = await POST(createRequest('/api/posts/nope/publish'), makeParams('nope'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Post not found')
  })

  it('returns 400 when post status is published', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockPostFetchSingle.mockResolvedValue({
      data: { ...DRAFT_POST_ROW, status: 'published' },
      error: null,
    })
    const res = await POST(createRequest('/api/posts/post-1/publish'), makeParams('post-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Post cannot be published in its current status')
  })

  it('returns 400 when post status is archived', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockPostFetchSingle.mockResolvedValue({
      data: { ...DRAFT_POST_ROW, status: 'archived' },
      error: null,
    })
    const res = await POST(createRequest('/api/posts/post-1/publish'), makeParams('post-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Post cannot be published in its current status')
  })

  it('returns 400 when no active social account connected', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockPostFetchSingle.mockResolvedValue({
      data: DRAFT_POST_ROW,
      error: null,
    })
    mockAccountSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' },
    })
    const res = await POST(createRequest('/api/posts/post-1/publish'), makeParams('post-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No twitter account connected')
  })

  it('successfully publishes a draft post', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockPostFetchSingle.mockResolvedValue({
      data: DRAFT_POST_ROW,
      error: null,
    })
    mockAccountSingle.mockResolvedValue({
      data: { id: 'account-1' },
      error: null,
    })
    mockLockEq2.mockResolvedValue({ error: null })
    mockPublishPost.mockResolvedValue({
      success: true,
      publishResult: {
        success: true,
        postId: 'tw-123',
        postUrl: 'https://x.com/user/status/123',
        publishedAt: '2024-01-02T12:00:00Z',
      },
    })
    mockFinalSingle.mockResolvedValue({
      data: publishedRow(),
      error: null,
    })

    const res = await POST(createRequest('/api/posts/post-1/publish'), makeParams('post-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.post.status).toBe('published')
    expect(body.publishResult.postUrl).toBe('https://x.com/user/status/123')
    expect(mockPublishPost).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'post-1', platform: 'twitter' }),
      'account-1'
    )
  })

  it('successfully publishes a failed post (retry)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const failedRow = { ...DRAFT_POST_ROW, status: 'failed' }
    mockPostFetchSingle.mockResolvedValue({
      data: failedRow,
      error: null,
    })
    mockAccountSingle.mockResolvedValue({
      data: { id: 'account-1' },
      error: null,
    })
    mockLockEq2.mockResolvedValue({ error: null })
    mockPublishPost.mockResolvedValue({
      success: true,
      publishResult: {
        success: true,
        postId: 'tw-456',
        postUrl: 'https://x.com/user/status/456',
        publishedAt: '2024-01-03T12:00:00Z',
      },
    })
    mockFinalSingle.mockResolvedValue({
      data: publishedRow({ id: 'post-1' }),
      error: null,
    })

    const res = await POST(createRequest('/api/posts/post-1/publish'), makeParams('post-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.post.status).toBe('published')
  })

  it('sets post status to publishing before calling publisher', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockPostFetchSingle.mockResolvedValue({
      data: DRAFT_POST_ROW,
      error: null,
    })
    mockAccountSingle.mockResolvedValue({
      data: { id: 'account-1' },
      error: null,
    })
    mockLockEq2.mockResolvedValue({ error: null })
    mockPublishPost.mockResolvedValue({
      success: true,
      publishResult: { success: true, postId: 'tw-789' },
    })
    mockFinalSingle.mockResolvedValue({
      data: publishedRow(),
      error: null,
    })

    await POST(createRequest('/api/posts/post-1/publish'), makeParams('post-1'))

    // Verify the lock update was called with 'publishing'
    expect(mockLockUpdate).toHaveBeenCalledWith({ status: 'publishing' })
    expect(mockLockEq1).toHaveBeenCalledWith('id', 'post-1')
    expect(mockLockEq2).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('returns 422 when publisher fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockPostFetchSingle.mockResolvedValue({
      data: DRAFT_POST_ROW,
      error: null,
    })
    mockAccountSingle.mockResolvedValue({
      data: { id: 'account-1' },
      error: null,
    })
    mockLockEq2.mockResolvedValue({ error: null })
    mockPublishPost.mockResolvedValue({
      success: false,
      error: 'Rate limit exceeded',
      retryable: true,
    })
    mockFinalSingle.mockResolvedValue({
      data: { ...DRAFT_POST_ROW, status: 'failed' },
      error: null,
    })

    const res = await POST(createRequest('/api/posts/post-1/publish'), makeParams('post-1'))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Rate limit exceeded')
  })

  it('returns 500 when lock update fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockPostFetchSingle.mockResolvedValue({
      data: DRAFT_POST_ROW,
      error: null,
    })
    mockAccountSingle.mockResolvedValue({
      data: { id: 'account-1' },
      error: null,
    })
    mockLockEq2.mockResolvedValue({
      error: { code: 'OTHER', message: 'Connection lost' },
    })

    const res = await POST(createRequest('/api/posts/post-1/publish'), makeParams('post-1'))
    expect(res.status).toBe(500)
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', scopes: ['posts:read'] })
    const { validateScopes } = await import('@/lib/auth')
    vi.mocked(validateScopes).mockImplementation(() => {
      throw new Error('Forbidden')
    })
    const res = await POST(createRequest('/api/posts/post-1/publish'), makeParams('post-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })
})
