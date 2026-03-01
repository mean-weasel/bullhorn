import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPublishPost = vi.fn()
vi.mock('@/lib/publishers', () => ({
  publishPost: (...args: unknown[]) => mockPublishPost(...args),
}))

vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils')
  return { ...actual }
})

const mockCreateClient = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest(new URL('/api/cron/publish', 'http://localhost:3000'), {
    headers: headers ? new Headers(headers) : undefined,
  })
}

function makeDbPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    scheduled_at: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
    status: 'scheduled',
    platform: 'twitter',
    notes: null,
    campaign_id: null,
    group_id: null,
    group_type: null,
    content: { text: 'Hello world' },
    publish_result: null,
    user_id: 'user-1',
    social_account_id: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// Import route handler (after mocks are registered)
let GET: typeof import('./route').GET

beforeEach(async () => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()

  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')

  // Re-import to pick up fresh mocks
  const mod = await import('./route')
  GET = mod.GET
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cron/publish', () => {
  it('returns 401 when CRON_SECRET is set and header does not match', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')
    mockCreateClient.mockReturnValue({ from: vi.fn() })

    const req = makeRequest({ authorization: 'Bearer wrong-secret' })
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('rejects request when no CRON_SECRET is set', async () => {
    // No CRON_SECRET in env — should fail closed
    const req = makeRequest() // no auth header
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it('processes scheduled posts that are due', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')

    const post = makeDbPost()
    const accountData = [{ id: 'acct-1' }]

    mockPublishPost.mockResolvedValue({
      success: true,
      postId: 'ext-123',
      postUrl: 'https://twitter.com/status/123',
    })

    // Build a mock supabase that tracks .from() calls
    const updateEq = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const accountLimit = vi.fn(() => Promise.resolve({ data: accountData, error: null }))
    const postsLimit = vi.fn(() => Promise.resolve({ data: [post], error: null }))

    mockCreateClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                lte: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    order: vi.fn(() => ({ limit: postsLimit })),
                  })),
                })),
              })),
            })),
            update: vi.fn(() => ({ eq: updateEq })),
          }
        }
        if (table === 'social_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({ limit: accountLimit })),
                })),
              })),
            })),
          }
        }
        return {}
      }),
    })

    const req = makeRequest({ authorization: 'Bearer my-secret' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(1)
    expect(body.published).toBe(1)
    expect(body.failed).toBe(0)
    expect(mockPublishPost).toHaveBeenCalledTimes(1)
  })

  it('returns zero counts when no posts are due', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')

    const postsLimit = vi.fn(() => Promise.resolve({ data: [], error: null }))

    mockCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            lte: vi.fn(() => ({
              gte: vi.fn(() => ({
                order: vi.fn(() => ({ limit: postsLimit })),
              })),
            })),
          })),
        })),
      })),
    })

    const req = makeRequest({ authorization: 'Bearer my-secret' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(0)
    expect(body.published).toBe(0)
    expect(body.failed).toBe(0)
  })

  it('sets post to failed when no social account is connected', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')

    const post = makeDbPost()

    const updateEq = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const accountLimit = vi.fn(() => Promise.resolve({ data: [], error: null }))
    const postsLimit = vi.fn(() => Promise.resolve({ data: [post], error: null }))

    mockCreateClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                lte: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    order: vi.fn(() => ({ limit: postsLimit })),
                  })),
                })),
              })),
            })),
            update: vi.fn(() => ({ eq: updateEq })),
          }
        }
        if (table === 'social_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({ limit: accountLimit })),
                })),
              })),
            })),
          }
        }
        return {}
      }),
    })

    const req = makeRequest({ authorization: 'Bearer my-secret' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(1)
    expect(body.published).toBe(0)
    expect(body.failed).toBe(1)
    expect(mockPublishPost).not.toHaveBeenCalled()
  })

  it('returns correct counts with mixed success and failure', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')

    const post1 = makeDbPost({ id: 'post-1' })
    const post2 = makeDbPost({ id: 'post-2', platform: 'linkedin' })
    const accountData = [{ id: 'acct-1' }]

    mockPublishPost
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({ success: false, error: 'Rate limited' })

    const updateEq = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const accountLimit = vi.fn(() => Promise.resolve({ data: accountData, error: null }))
    const postsLimit = vi.fn(() => Promise.resolve({ data: [post1, post2], error: null }))

    mockCreateClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                lte: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    order: vi.fn(() => ({ limit: postsLimit })),
                  })),
                })),
              })),
            })),
            update: vi.fn(() => ({ eq: updateEq })),
          }
        }
        if (table === 'social_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({ limit: accountLimit })),
                })),
              })),
            })),
          }
        }
        return {}
      }),
    })

    const req = makeRequest({ authorization: 'Bearer my-secret' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(2)
    expect(body.published).toBe(1)
    expect(body.failed).toBe(1)
  })

  it('individual post failures do not block other posts', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')

    const post1 = makeDbPost({ id: 'post-1' })
    const post2 = makeDbPost({ id: 'post-2' })
    const accountData = [{ id: 'acct-1' }]

    // First call throws, second succeeds
    mockPublishPost
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce({ success: true })

    const updateEq = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const accountLimit = vi.fn(() => Promise.resolve({ data: accountData, error: null }))
    const postsLimit = vi.fn(() => Promise.resolve({ data: [post1, post2], error: null }))

    mockCreateClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'posts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                lte: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    order: vi.fn(() => ({ limit: postsLimit })),
                  })),
                })),
              })),
            })),
            update: vi.fn(() => ({ eq: updateEq })),
          }
        }
        if (table === 'social_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({ limit: accountLimit })),
                })),
              })),
            })),
          }
        }
        return {}
      }),
    })

    const req = makeRequest({ authorization: 'Bearer my-secret' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(2)
    expect(body.published).toBe(1)
    expect(body.failed).toBe(1)
    // Both posts were attempted
    expect(mockPublishPost).toHaveBeenCalledTimes(2)
  })

  it('returns 500 when database query fails', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')

    const postsLimit = vi.fn(() =>
      Promise.resolve({ data: null, error: { message: 'Connection refused' } })
    )

    mockCreateClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            lte: vi.fn(() => ({
              gte: vi.fn(() => ({
                order: vi.fn(() => ({ limit: postsLimit })),
              })),
            })),
          })),
        })),
      })),
    })

    const req = makeRequest({ authorization: 'Bearer my-secret' })
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Database query failed')
  })
})
