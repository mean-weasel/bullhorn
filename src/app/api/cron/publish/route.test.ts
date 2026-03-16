import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/rrule', () => ({
  getNextOccurrence: vi.fn(),
}))

const mockCreateClient = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('@/lib/publishers', () => ({
  publishPost: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  transformPostFromDb: vi.fn((p) => ({
    id: p.id,
    platform: p.platform,
    content: p.content,
    status: p.status,
    socialAccountId: p.social_account_id,
    scheduledAt: p.scheduled_at,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    publishResult: p.publish_result,
  })),
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
    scheduled_at: new Date(Date.now() - 60_000).toISOString(),
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
    recurrence_rule: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let GET: typeof import('./route').GET

beforeEach(async () => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()

  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://localhost:54321')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')

  // Re-import to pick up fresh mocks
  vi.resetModules()
  const mod = await import('./route')
  GET = mod.GET
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/cron/publish (notify-due-posts) (1/5)', () => {
  it('returns 401 when CRON_SECRET is set and header does not match', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')
    mockCreateClient.mockReturnValue({ from: vi.fn() })

    const req = makeRequest({ authorization: 'Bearer wrong-secret' })
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 500 when no CRON_SECRET is configured', async () => {
    // No CRON_SECRET — fail closed with 500
    const req = makeRequest()
    const res = await GET(req)

    expect(res.status).toBe(500)
  })
})

describe('GET /api/cron/publish (notify-due-posts) (2/5)', () => {
  it('transitions scheduled posts to ready status', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')

    const post = makeDbPost()

    const matchFn = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const updateFn = vi.fn(() => ({ match: matchFn }))
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
            update: updateFn,
          }
        }
        if (table === 'user_profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: { plan: 'free' }, error: null })),
              })),
            })),
          }
        }
        return { select: vi.fn(() => ({ eq: vi.fn() })) }
      }),
    })

    const req = makeRequest({ authorization: 'Bearer my-secret' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.processed).toBe(1)
    expect(body.notified).toBe(1)

    // Verify update was called with ready status
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }))
  })
})

describe('GET /api/cron/publish (notify-due-posts) (3/5)', () => {
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
    expect(body.notified).toBe(0)
  })
})

describe('GET /api/cron/publish (notify-due-posts) (4/5)', () => {
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

describe('GET /api/cron/publish (notify-due-posts) (5/5)', () => {
  it('continues processing when individual post update fails', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')

    const post1 = makeDbPost({ id: 'post-1' })
    const post2 = makeDbPost({ id: 'post-2' })

    let callCount = 0
    const matchFn = vi.fn(() => {
      callCount++
      // First update fails, second succeeds
      if (callCount === 1) {
        return Promise.resolve({ data: null, error: { message: 'Conflict' } })
      }
      return Promise.resolve({ data: null, error: null })
    })
    const updateFn = vi.fn(() => ({ match: matchFn }))
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
            update: updateFn,
          }
        }
        if (table === 'user_profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: { plan: 'free' }, error: null })),
              })),
            })),
          }
        }
        return { select: vi.fn(() => ({ eq: vi.fn() })) }
      }),
    })

    const req = makeRequest({ authorization: 'Bearer my-secret' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    // First post failed to update, second succeeded
    expect(body.processed).toBe(1)
    expect(body.notified).toBe(1)
  })
})

describe('GET /api/cron/publish — auto-publish for pro (6/8)', () => {
  it('auto-publishes posts with social_account_id when user is pro', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')

    const { publishPost } = await import('@/lib/publishers')

    const post = makeDbPost({
      id: 'post-auto',
      social_account_id: 'acc-1',
      user_id: 'pro-user',
      platform: 'twitter',
    })

    const postsLimit = vi.fn(() => Promise.resolve({ data: [post], error: null }))

    const selectAfterMatch = vi.fn(() =>
      Promise.resolve({ data: [{ id: 'post-auto' }], error: null })
    )
    const matchFn = vi.fn(() => ({ select: selectAfterMatch }))
    const updateFn = vi.fn(() => ({ match: matchFn }))

    const profileSingle = vi.fn(() => Promise.resolve({ data: { plan: 'pro' }, error: null }))

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
            update: updateFn,
          }
        }
        if (table === 'user_profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({ single: profileSingle })),
            })),
          }
        }
        return { select: vi.fn(() => ({ eq: vi.fn() })) }
      }),
    })

    vi.mocked(publishPost).mockResolvedValue({ success: true })

    const req = makeRequest({ authorization: 'Bearer my-secret' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.autoPublished).toBe(1)

    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ status: 'publishing' }))
    expect(publishPost).toHaveBeenCalled()
  })
})

describe('GET /api/cron/publish — free user notify-only (7/8)', () => {
  it('sends notification instead of auto-publishing for free users', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')

    const { publishPost } = await import('@/lib/publishers')

    const post = makeDbPost({
      social_account_id: 'acc-1',
      user_id: 'free-user',
    })

    const postsLimit = vi.fn(() => Promise.resolve({ data: [post], error: null }))
    const matchFn = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const updateFn = vi.fn(() => ({ match: matchFn }))

    const profileSingle = vi.fn(() => Promise.resolve({ data: { plan: 'free' }, error: null }))

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
            update: updateFn,
          }
        }
        if (table === 'user_profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({ single: profileSingle })),
            })),
          }
        }
        return { select: vi.fn(() => ({ eq: vi.fn() })) }
      }),
    })

    const req = makeRequest({ authorization: 'Bearer my-secret' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }))
    expect(publishPost).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/publish — Reddit skip (8/8)', () => {
  it('routes Reddit posts to notify-only even with social_account_id on pro', async () => {
    vi.stubEnv('CRON_SECRET', 'my-secret')

    const { publishPost } = await import('@/lib/publishers')

    const post = makeDbPost({
      social_account_id: 'acc-reddit',
      user_id: 'pro-user',
      platform: 'reddit',
    })

    const postsLimit = vi.fn(() => Promise.resolve({ data: [post], error: null }))
    const matchFn = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const updateFn = vi.fn(() => ({ match: matchFn }))

    const profileSingle = vi.fn(() => Promise.resolve({ data: { plan: 'pro' }, error: null }))

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
            update: updateFn,
          }
        }
        if (table === 'user_profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({ single: profileSingle })),
            })),
          }
        }
        return { select: vi.fn(() => ({ eq: vi.fn() })) }
      }),
    })

    const req = makeRequest({ authorization: 'Bearer my-secret' })
    const res = await GET(req)

    expect(res.status).toBe(200)
    expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }))
    expect(publishPost).not.toHaveBeenCalled()
  })
})
