import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/planEnforcement', () => ({
  enforceResourceLimit: vi.fn(async () => ({
    allowed: true,
    current: 0,
    limit: 5,
    plan: 'free',
  })),
  isPlanLimitError: vi.fn(() => false),
}))

// mockQueryData holds { data, error } for the final await
let mockQueryData: { data: unknown; error: unknown } = { data: [], error: null }
// .limit() is the terminal call before await, so it returns a thenable
const mockLimit = vi.fn(() => ({
  then: (resolve: (val: unknown) => void) => resolve(mockQueryData),
}))
// .order() now chains to limit
const mockOrder = vi.fn(() => ({
  eq: mockQueryEq,
  is: mockIs,
  limit: mockLimit,
}))
// Each chained method returns an object with all chainable methods
const chainable = (): Record<string, unknown> => ({
  eq: mockQueryEq,
  order: mockOrder,
  is: mockIs,
  limit: mockLimit,
})
const mockIs = vi.fn(chainable)
const mockQueryEq = vi.fn(chainable)
const mockSelect = vi.fn(() => ({ eq: mockQueryEq }))
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// GET /api/campaigns
// ---------------------------------------------------------------------------

describe('GET /api/campaigns', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/campaigns')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns campaigns for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbCampaigns = [
      {
        id: 'camp-1',
        name: 'Summer Launch',
        description: 'Launch campaign',
        status: 'active',
        project_id: 'proj-1',
        created_at: '2024-05-01T00:00:00Z',
        updated_at: '2024-05-15T00:00:00Z',
        user_id: 'user-1',
      },
    ]
    mockQueryData = { data: dbCampaigns, error: null }
    const req = createRequest('/api/campaigns')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.campaigns).toHaveLength(1)
    expect(body.campaigns[0].id).toBe('camp-1')
    expect(body.campaigns[0].name).toBe('Summer Launch')
    expect(body.campaigns[0].projectId).toBe('proj-1')
  })

  it('returns empty array when user has no campaigns', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockQueryData = { data: [], error: null }
    const req = createRequest('/api/campaigns')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.campaigns).toEqual([])
  })

  it('returns 500 when database query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockQueryData = { data: null, error: { message: 'DB error' } }
    const req = createRequest('/api/campaigns')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })

  it('filters by status query param', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockQueryData = { data: [], error: null }
    const req = createRequest('/api/campaigns?status=active')
    await GET(req)
    // The eq chain should be called for status filtering
    expect(mockQueryEq).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// POST /api/campaigns
// ---------------------------------------------------------------------------

describe('POST /api/campaigns', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Campaign' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid input (missing name)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
    expect(body.details).toBeDefined()
  })

  it('returns 400 for empty name', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates campaign successfully and returns 201', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const createdCampaign = {
      id: 'camp-new',
      name: 'Winter Campaign',
      description: null,
      status: 'active',
      project_id: null,
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
      user_id: 'user-1',
    }
    mockInsertSingle.mockResolvedValue({ data: createdCampaign, error: null })
    const req = createRequest('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name: 'Winter Campaign' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.campaign.id).toBe('camp-new')
    expect(body.campaign.name).toBe('Winter Campaign')
    expect(body.campaign.status).toBe('active')
  })

  it('creates campaign with optional fields', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const projectUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5'
    const createdCampaign = {
      id: 'camp-new-2',
      name: 'Full Campaign',
      description: 'A detailed campaign',
      status: 'paused',
      project_id: projectUuid,
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
      user_id: 'user-1',
    }
    mockInsertSingle.mockResolvedValue({ data: createdCampaign, error: null })
    const req = createRequest('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Full Campaign',
        description: 'A detailed campaign',
        status: 'paused',
        projectId: projectUuid,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.campaign.description).toBe('A detailed campaign')
    expect(body.campaign.status).toBe('paused')
    expect(body.campaign.projectId).toBe(projectUuid)
  })

  it('returns 500 when insert fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockInsertSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
    const req = createRequest('/api/campaigns', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Campaign' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
