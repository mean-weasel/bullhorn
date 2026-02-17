import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  validateScopes: vi.fn(),
}))

// Chainable query builder mocks

// projects ownership check: .select('id').eq('id',x).eq('user_id',y).single()
let mockProjectResult: { data: unknown; error: unknown } = { data: { id: 'proj-1' }, error: null }
const mockProjectSingle = vi.fn(() => mockProjectResult)
const mockProjectEqUserId = vi.fn(() => ({ single: mockProjectSingle }))
const mockProjectEqId = vi.fn(() => ({ eq: mockProjectEqUserId }))
const mockProjectSelect = vi.fn(() => ({ eq: mockProjectEqId }))

// campaigns query: .select('id').eq('project_id',x).eq('user_id',y)
let mockCampaignsResult: { data: unknown; error: unknown } = { data: [], error: null }
const mockCampaignsEqUserId = vi.fn(() => mockCampaignsResult)
const mockCampaignsEqProjectId = vi.fn(() => ({ eq: mockCampaignsEqUserId }))
const mockCampaignsSelect = vi.fn(() => ({ eq: mockCampaignsEqProjectId }))

// posts query: .select('status').eq('user_id',y).in('campaign_id',ids)
let mockPostsResult: { data: unknown; error: unknown } = { data: [], error: null }
const mockPostsIn = vi.fn(() => mockPostsResult)
const mockPostsEqUserId = vi.fn(() => ({ in: mockPostsIn }))
const mockPostsSelect = vi.fn(() => ({ eq: mockPostsEqUserId }))

const mockFrom = vi.fn((table: string) => {
  if (table === 'projects') {
    return { select: mockProjectSelect }
  }
  if (table === 'campaigns') {
    return { select: mockCampaignsSelect }
  }
  if (table === 'posts') {
    return { select: mockPostsSelect }
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
  mockCampaignsResult = { data: [], error: null }
  mockPostsResult = { data: [], error: null }
})

describe('GET /api/projects/[id]/analytics', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/projects/proj-1/analytics')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Forbidden'))
    const req = createRequest('/api/projects/proj-1/analytics')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 404 when project not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: null, error: { code: 'PGRST116', message: 'Not found' } }
    const req = createRequest('/api/projects/proj-999/analytics')
    const res = await GET(req, createContext('proj-999'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Project not found')
  })

  it('returns zero counts when project has no campaigns', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockCampaignsResult = { data: [], error: null }
    const req = createRequest('/api/projects/proj-1/analytics')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.analytics).toEqual({
      totalCampaigns: 0,
      totalPosts: 0,
      scheduledPosts: 0,
      publishedPosts: 0,
      draftPosts: 0,
      failedPosts: 0,
    })
  })

  it('returns rolled-up analytics with post status counts', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockCampaignsResult = {
      data: [{ id: 'camp-1' }, { id: 'camp-2' }],
      error: null,
    }
    mockPostsResult = {
      data: [
        { status: 'scheduled' },
        { status: 'scheduled' },
        { status: 'published' },
        { status: 'published' },
        { status: 'published' },
        { status: 'draft' },
        { status: 'failed' },
      ],
      error: null,
    }
    const req = createRequest('/api/projects/proj-1/analytics')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.analytics).toEqual({
      totalCampaigns: 2,
      totalPosts: 7,
      scheduledPosts: 2,
      publishedPosts: 3,
      draftPosts: 1,
      failedPosts: 1,
    })
  })

  it('returns 500 when campaigns query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockCampaignsResult = { data: null, error: { message: 'DB error' } }
    const req = createRequest('/api/projects/proj-1/analytics')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })

  it('returns 500 when posts query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockCampaignsResult = {
      data: [{ id: 'camp-1' }],
      error: null,
    }
    mockPostsResult = { data: null, error: { message: 'DB error' } }
    const req = createRequest('/api/projects/proj-1/analytics')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })

  it('handles campaigns with no posts', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockCampaignsResult = {
      data: [{ id: 'camp-1' }, { id: 'camp-2' }, { id: 'camp-3' }],
      error: null,
    }
    mockPostsResult = { data: [], error: null }
    const req = createRequest('/api/projects/proj-1/analytics')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.analytics.totalCampaigns).toBe(3)
    expect(body.analytics.totalPosts).toBe(0)
  })
})
