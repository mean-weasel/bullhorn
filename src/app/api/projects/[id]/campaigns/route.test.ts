import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  validateScopes: vi.fn(),
}))

vi.mock('@/lib/utils', () => ({
  transformCampaignFromDb: vi.fn((c: Record<string, unknown>) => ({
    id: c.id,
    name: c.name,
    description: c.description ?? undefined,
    status: c.status,
    projectId: c.project_id ?? undefined,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  })),
}))

// Chainable query builder mocks
// projects ownership check: .select('id').eq('id',x).eq('user_id',y).single()
let mockProjectResult: { data: unknown; error: unknown } = { data: { id: 'proj-1' }, error: null }
const mockProjectSingle = vi.fn(() => mockProjectResult)
const mockProjectEqUserId = vi.fn(() => ({ single: mockProjectSingle }))
const mockProjectEqId = vi.fn(() => ({ eq: mockProjectEqUserId }))
const mockProjectSelect = vi.fn(() => ({ eq: mockProjectEqId }))

// campaigns query: .select('*').eq('project_id',x).eq('user_id',y).order(...).limit(...)
let mockCampaignsData: { data: unknown; error: unknown } = { data: [], error: null }
const mockCampaignsLimit = vi.fn(() => mockCampaignsData)
const mockCampaignsOrder = vi.fn(() => ({ limit: mockCampaignsLimit }))
const mockCampaignsEqUserId = vi.fn(() => ({ order: mockCampaignsOrder }))
const mockCampaignsEqProjectId = vi.fn(() => ({ eq: mockCampaignsEqUserId }))
const mockCampaignsSelect = vi.fn(() => ({ eq: mockCampaignsEqProjectId }))

const mockFrom = vi.fn((table: string) => {
  if (table === 'projects') {
    return { select: mockProjectSelect }
  }
  if (table === 'campaigns') {
    return { select: mockCampaignsSelect }
  }
  return {}
})

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

function createContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockProjectResult = { data: { id: 'proj-1' }, error: null }
  mockCampaignsData = { data: [], error: null }
})

describe('GET /api/projects/[id]/campaigns', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/projects/proj-1/campaigns')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Forbidden'))
    const req = createRequest('/api/projects/proj-1/campaigns')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 404 when project not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: null, error: { code: 'PGRST116', message: 'Not found' } }
    const req = createRequest('/api/projects/proj-999/campaigns')
    const res = await GET(req, createContext('proj-999'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Project not found')
  })

  it('returns campaigns for a project', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockCampaignsData = {
      data: [
        {
          id: 'camp-1',
          name: 'Launch Campaign',
          description: 'First campaign',
          status: 'active',
          project_id: 'proj-1',
          created_at: '2024-05-01T00:00:00Z',
          updated_at: '2024-05-15T00:00:00Z',
          user_id: 'user-1',
        },
        {
          id: 'camp-2',
          name: 'Second Campaign',
          description: null,
          status: 'draft',
          project_id: 'proj-1',
          created_at: '2024-06-01T00:00:00Z',
          updated_at: '2024-06-10T00:00:00Z',
          user_id: 'user-1',
        },
      ],
      error: null,
    }
    const req = createRequest('/api/projects/proj-1/campaigns')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.campaigns).toHaveLength(2)
    expect(body.campaigns[0].id).toBe('camp-1')
    expect(body.campaigns[0].name).toBe('Launch Campaign')
    expect(body.campaigns[1].id).toBe('camp-2')
  })

  it('returns empty array when project has no campaigns', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockCampaignsData = { data: [], error: null }
    const req = createRequest('/api/projects/proj-1/campaigns')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.campaigns).toEqual([])
  })

  it('returns 500 when campaigns database query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockCampaignsData = { data: null, error: { message: 'DB error' } }
    const req = createRequest('/api/projects/proj-1/campaigns')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
