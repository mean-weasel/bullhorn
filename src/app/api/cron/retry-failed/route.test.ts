import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSingle = vi.fn()
const mockAccountLimit = vi.fn(() => ({ single: mockSingle }))
const mockAccountEq2 = vi.fn(() => ({ limit: mockAccountLimit }))
const mockAccountEq1 = vi.fn(() => ({ eq: mockAccountEq2 }))
const mockAccountSelect = vi.fn(() => ({ eq: mockAccountEq1 }))

const mockPostsLimit = vi.fn()
const mockPostsOrder = vi.fn(() => ({ limit: mockPostsLimit }))
const mockPostsGte = vi.fn(() => ({ order: mockPostsOrder }))
const mockPostsEq = vi.fn(() => ({ gte: mockPostsGte }))
const mockPostsSelect = vi.fn(() => ({ eq: mockPostsEq }))

const mockUpdateEq = vi.fn()
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }))

const mockFrom = vi.fn((table: string) => {
  if (table === 'social_accounts') {
    return { select: mockAccountSelect }
  }
  return {
    select: mockPostsSelect,
    update: mockUpdate,
  }
})

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}))

const mockPublishPost = vi.fn()
vi.mock('@/lib/publishers', () => ({
  publishPost: mockPublishPost,
}))

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils')
  return { ...actual }
})

import { GET } from './route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL('/api/cron/retry-failed', 'http://localhost:3000'), { headers })
}

function makeDbPost(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString()
  return {
    id: 'post-1',
    created_at: now,
    updated_at: now,
    scheduled_at: null,
    status: 'failed',
    platform: 'twitter',
    notes: null,
    campaign_id: null,
    group_id: null,
    group_type: null,
    content: { text: 'Hello world' },
    publish_result: {
      success: false,
      retryable: true,
      retryCount: 0,
      error: 'Rate limited',
    },
    user_id: 'user-1',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('CRON_SECRET', 'test-secret')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key')
  mockUpdateEq.mockResolvedValue({ error: null })
})

describe('GET /api/cron/retry-failed', () => {
  it('returns 401 when cron secret does not match', async () => {
    const req = createRequest({
      authorization: 'Bearer wrong-secret',
    })
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('retries a failed post with retryable=true and retryCount < 3', async () => {
    const dbPost = makeDbPost()
    mockPostsLimit.mockResolvedValue({
      data: [dbPost],
      error: null,
    })
    mockSingle.mockResolvedValue({
      data: { id: 'account-1' },
      error: null,
    })
    mockPublishPost.mockResolvedValue({
      success: true,
      postId: 'new-id',
      postUrl: 'https://twitter.com/status/new-id',
      publishedAt: new Date().toISOString(),
    })

    const req = createRequest({
      authorization: 'Bearer test-secret',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.retried).toBe(1)
    expect(body.processed).toBe(1)
    expect(mockPublishPost).toHaveBeenCalledOnce()
  })

  it('skips posts with retryable=false', async () => {
    const dbPost = makeDbPost({
      publish_result: {
        success: false,
        retryable: false,
        retryCount: 1,
        error: 'Permanent error',
      },
    })
    mockPostsLimit.mockResolvedValue({
      data: [dbPost],
      error: null,
    })

    const req = createRequest({
      authorization: 'Bearer test-secret',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
    expect(mockPublishPost).not.toHaveBeenCalled()
  })

  it('skips posts with retryCount >= 3', async () => {
    const dbPost = makeDbPost({
      publish_result: {
        success: false,
        retryable: true,
        retryCount: 3,
        error: 'Rate limited',
      },
    })
    mockPostsLimit.mockResolvedValue({
      data: [dbPost],
      error: null,
    })

    const req = createRequest({
      authorization: 'Bearer test-secret',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
    expect(mockPublishPost).not.toHaveBeenCalled()
  })

  it('skips posts older than 24 hours (filtered by query)', async () => {
    // The Supabase query uses .gte('updated_at', cutoff) so old
    // posts are excluded at the DB level. Verify the filter is called.
    mockPostsLimit.mockResolvedValue({ data: [], error: null })

    const req = createRequest({
      authorization: 'Bearer test-secret',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(mockPostsGte).toHaveBeenCalledWith('updated_at', expect.any(String))
    const body = await res.json()
    expect(body.processed).toBe(0)
  })

  it('returns correct counts for mixed outcomes', async () => {
    const retryablePost = makeDbPost({ id: 'post-retry' })
    const failPost = makeDbPost({
      id: 'post-fail',
      user_id: 'user-2',
      publish_result: {
        success: false,
        retryable: true,
        retryCount: 1,
        error: 'Timeout',
      },
    })
    mockPostsLimit.mockResolvedValue({
      data: [retryablePost, failPost],
      error: null,
    })

    // First post: account found, publish succeeds
    // Second post: account found, publish fails
    mockSingle
      .mockResolvedValueOnce({
        data: { id: 'account-1' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'account-2' },
        error: null,
      })
    mockPublishPost
      .mockResolvedValueOnce({
        success: true,
        postId: 'new-1',
        publishedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'API error',
      })

    const req = createRequest({
      authorization: 'Bearer test-secret',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(2)
    expect(body.retried).toBe(1)
    expect(body.failed).toBe(1)
  })

  it('individual failures do not block other posts', async () => {
    const post1 = makeDbPost({ id: 'post-1', user_id: 'user-1' })
    const post2 = makeDbPost({ id: 'post-2', user_id: 'user-2' })
    mockPostsLimit.mockResolvedValue({
      data: [post1, post2],
      error: null,
    })

    // First post: publish throws an exception
    // Second post: publish succeeds
    mockSingle
      .mockResolvedValueOnce({
        data: { id: 'account-1' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'account-2' },
        error: null,
      })
    mockPublishPost.mockRejectedValueOnce(new Error('Network timeout')).mockResolvedValueOnce({
      success: true,
      postId: 'new-2',
      publishedAt: new Date().toISOString(),
    })

    const req = createRequest({
      authorization: 'Bearer test-secret',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(2)
    expect(body.failed).toBe(1)
    expect(body.retried).toBe(1)
    // Both posts were attempted — the first error didn't stop the second
    expect(mockPublishPost).toHaveBeenCalledTimes(2)
  })
})
