import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireAuth: vi.fn(),
}))

// Build a chainable mock — every method returns the chain, final await resolves data
function createChainMock(resolvedValue: { data: unknown; error: unknown }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: Record<string, unknown> = {} as any
  const methods = ['select', 'eq', 'or', 'order', 'limit', 'gte', 'lte']
  for (const m of methods) {
    chain[m] = vi.fn(() => chain)
  }
  // Make it thenable so `await query` resolves
  chain.then = (resolve: (v: unknown) => void) => resolve(resolvedValue)
  return chain
}

let chainMock: ReturnType<typeof createChainMock>
const mockFrom = vi.fn(() => chainMock)

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}))

import { GET } from './route'
import { requireAuth } from '@/lib/auth'

const mockRequireAuth = vi.mocked(requireAuth)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/posts/due', () => {
  it('returns 401 when not authenticated', async () => {
    chainMock = createChainMock({ data: [], error: null })
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET(createRequest('/api/posts/due'))
    expect(res.status).toBe(401)
  })

  it('returns due posts with preview and hasMedia', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })

    const mockPosts = [
      {
        id: 'post-1',
        platform: 'twitter',
        status: 'ready',
        scheduled_at: '2026-03-02T14:00:00Z',
        content: { text: 'Hello world' },
        created_at: '2026-03-01T10:00:00Z',
        updated_at: '2026-03-01T10:00:00Z',
      },
    ]

    chainMock = createChainMock({ data: mockPosts, error: null })

    const res = await GET(createRequest('/api/posts/due'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.posts).toHaveLength(1)
    expect(json.posts[0].id).toBe('post-1')
    expect(json.posts[0].preview).toBe('Hello world')
    expect(json.posts[0].hasMedia).toBe(false)
  })

  it('returns empty array when no posts are due', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    chainMock = createChainMock({ data: [], error: null })

    const res = await GET(createRequest('/api/posts/due'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.posts).toHaveLength(0)
  })

  it('returns 500 on database error', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    chainMock = createChainMock({ data: null, error: { message: 'DB error' } })

    const res = await GET(createRequest('/api/posts/due'))
    expect(res.status).toBe(500)
  })
})
