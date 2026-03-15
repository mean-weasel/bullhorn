import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock requireAuth
const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireAuth: () => mockRequireAuth(),
  validateScopes: vi.fn(),
}))

vi.mock('@/lib/rateLimit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: 0 }),
}))

vi.mock('@/lib/planEnforcement', () => ({
  enforceResourceLimit: vi
    .fn()
    .mockResolvedValue({ allowed: true, current: 0, limit: 500, plan: 'free' }),
  isPlanLimitError: vi.fn(() => false),
}))

// Mock Supabase
const mockInsert = vi.fn()

function buildSelectChain(data: unknown[] = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn(),
  }
  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: { data: unknown[]; error: null }) => void) => {
      resolve({ data, error: null })
    },
  })
  return chain
}

function buildInsertChain(error: unknown = null) {
  return {
    then: (resolve: (val: { error: unknown }) => void) => {
      resolve({ error })
    },
  }
}

let fromCallbacks: Record<
  string,
  {
    selectCb: () => ReturnType<typeof buildSelectChain>
    insertCb: () => ReturnType<typeof buildInsertChain>
  }
>

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (table: string) => ({
      select: (...args: unknown[]) => {
        const chain = fromCallbacks[table]?.selectCb()
        if (chain && args.length) chain.select(...args)
        return chain
      },
      insert: (...args: unknown[]) => {
        mockInsert(...args)
        return fromCallbacks[table]?.insertCb() || buildInsertChain(null)
      },
    }),
  }),
}))

// eslint-disable-next-line max-lines-per-function
describe('POST /api/import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fromCallbacks = {
      campaigns: {
        selectCb: () => buildSelectChain([]),
        insertCb: () => buildInsertChain(null),
      },
      posts: {
        selectCb: () => buildSelectChain([]),
        insertCb: () => buildInsertChain(null),
      },
    }
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))

    const { POST } = await import('./route')
    const request = new Request('http://localhost/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts: [], campaigns: [] }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 for invalid import data', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })

    const { POST } = await import('./route')
    const request = new Request('http://localhost/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        posts: [{ platform: 'invalid_platform', content: {} }],
      }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid import data')
  })

  it('imports valid posts and campaigns', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })

    const { POST } = await import('./route')
    const request = new Request('http://localhost/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        posts: [
          {
            platform: 'twitter',
            content: { text: 'Hello world' },
            status: 'draft',
          },
        ],
        campaigns: [
          {
            name: 'Test Campaign',
            status: 'active',
          },
        ],
        version: '1.0',
      }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.imported.posts).toBe(1)
    expect(body.imported.campaigns).toBe(1)
    expect(body.skipped.posts).toBe(0)
    expect(body.skipped.campaigns).toBe(0)
  })

  it('skips duplicate campaigns by name', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })

    fromCallbacks.campaigns.selectCb = () =>
      buildSelectChain([{ id: 'existing-campaign', name: 'Existing Campaign' }])

    const { POST } = await import('./route')
    const request = new Request('http://localhost/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaigns: [
          {
            name: 'Existing Campaign',
            status: 'active',
          },
        ],
      }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.skipped.campaigns).toBe(1)
    expect(body.imported.campaigns).toBe(0)
  })

  it('handles import errors gracefully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })

    fromCallbacks.posts.insertCb = () => buildInsertChain({ message: 'DB error' })

    const { POST } = await import('./route')
    const request = new Request('http://localhost/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        posts: [
          {
            platform: 'twitter',
            content: { text: 'Will fail' },
          },
        ],
      }),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.skipped.posts).toBe(1)
    expect(body.imported.posts).toBe(0)
  })

  it('accepts empty import', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })

    const { POST } = await import('./route')
    const request = new Request('http://localhost/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const response = await POST(request as never)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.imported.posts).toBe(0)
    expect(body.imported.campaigns).toBe(0)
  })
})
