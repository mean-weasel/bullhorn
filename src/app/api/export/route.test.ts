import { describe, it, expect, vi } from 'vitest'

// Mock requireAuth
const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  requireAuth: () => mockRequireAuth(),
}))

// Mock Supabase
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}))

// Build a chainable query mock
function buildChainableMock(resolvedData: unknown[] = []) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: vi.fn(),
  }
  // When awaited, return data
  Object.defineProperty(chain, 'then', {
    value: (resolve: (val: { data: unknown[]; error: null }) => void) => {
      resolve({ data: resolvedData, error: null })
    },
  })
  return chain
}

describe('GET /api/export (1/4)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))

    const { GET } = await import('./route')
    const request = new Request('http://localhost/api/export')
    const response = await GET(request as never)

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 for invalid format', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })

    const { GET } = await import('./route')
    const request = new Request('http://localhost/api/export?format=xml')
    const response = await GET(request as never)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid format')
  })

  it('returns 400 for invalid type', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })

    const { GET } = await import('./route')
    const request = new Request('http://localhost/api/export?type=invalid')
    const response = await GET(request as never)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toContain('Invalid type')
  })
})

describe('GET /api/export (2/4)', () => {
  it('returns JSON export with posts and campaigns', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })

    const mockPostChain = buildChainableMock([
      {
        id: 'p1',
        platform: 'twitter',
        content: { text: 'Hello world' },
        status: 'draft',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        scheduled_at: null,
        user_id: 'user-1',
      },
    ])

    const mockCampaignChain = buildChainableMock([
      {
        id: 'c1',
        name: 'Campaign 1',
        description: 'Test campaign',
        status: 'active',
        project_id: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        user_id: 'user-1',
      },
    ])

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      return callCount === 1 ? mockPostChain : mockCampaignChain
    })

    const { GET } = await import('./route')
    const request = new Request('http://localhost/api/export?format=json&type=all')
    const response = await GET(request as never)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.posts).toHaveLength(1)
    expect(body.campaigns).toHaveLength(1)
    expect(body.version).toBe('1.0')
    expect(body.exportedAt).toBeDefined()
    expect(response.headers.get('X-Export-Count')).toBe('2')
  })
})

describe('GET /api/export (3/4)', () => {
  it('returns CSV format with Content-Disposition header', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })

    const mockPostChain = buildChainableMock([
      {
        id: 'p1',
        platform: 'twitter',
        content: { text: 'Hello world' },
        status: 'draft',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        scheduled_at: null,
        user_id: 'user-1',
      },
    ])

    const mockCampaignChain = buildChainableMock([])

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      return callCount === 1 ? mockPostChain : mockCampaignChain
    })

    const { GET } = await import('./route')
    const request = new Request('http://localhost/api/export?format=csv&type=all')
    const response = await GET(request as never)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/csv')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain('.csv')

    const text = await response.text()
    expect(text).toContain('# Posts')
    expect(text).toContain('id,title,content,platform')
  })
})

describe('GET /api/export (4/4)', () => {
  it('filters by campaignId when provided', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })

    const mockPostChain = buildChainableMock([])
    const mockCampaignChain = buildChainableMock([])

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      return callCount === 1 ? mockPostChain : mockCampaignChain
    })

    const { GET } = await import('./route')
    const request = new Request('http://localhost/api/export?type=posts&campaignId=camp-1')
    const response = await GET(request as never)

    expect(response.status).toBe(200)
    // The query chain was called with eq for campaign_id
    expect(mockPostChain.eq).toHaveBeenCalled()
  })
})
