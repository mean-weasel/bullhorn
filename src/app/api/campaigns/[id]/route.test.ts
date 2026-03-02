import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireAuth: vi.fn(),
  validateScopes: vi.fn(),
}))

// We need separate result holders for different .from() tables and different
// query sequences. The route calls supabase.from('campaigns')...single() and
// then supabase.from('posts')...order().  We track the "current table" so
// mock chains can return the right data.

let currentTable = ''

// Per-table mock data
let campaignSingleData: { data: unknown; error: unknown } = { data: null, error: null }
let postQueryData: { data: unknown; error: unknown } = { data: [], error: null }
let updateSingleData: { data: unknown; error: unknown } = { data: null, error: null }
let deleteCampaignData: { error: unknown } = { error: null }
let updatePostsData: { data: unknown; error: unknown } = { data: null, error: null }

// Terminal calls return thenables
const makeSingle = (getData: () => { data: unknown; error: unknown }) =>
  vi.fn(() => ({
    then: (resolve: (v: unknown) => void) => resolve(getData()),
  }))

const makeOrder = (getData: () => { data: unknown; error: unknown }) =>
  vi.fn(() => ({
    then: (resolve: (v: unknown) => void) => resolve(getData()),
  }))

// Chainable builder for SELECT queries
const mockCampaignSingle = makeSingle(() => campaignSingleData)
const mockPostOrder = makeOrder(() => postQueryData)

// For update chain: .update().eq().eq().select().single()
const mockUpdateSingle = makeSingle(() => updateSingleData)
const mockUpdateSelect = vi.fn(() => ({ single: mockUpdateSingle }))

// For delete chain: .delete().eq().eq() -> thenable
const mockDeleteEq2 = vi.fn(() => ({
  then: (resolve: (v: unknown) => void) => resolve(deleteCampaignData),
}))
const mockDeleteEq1 = vi.fn(() => ({ eq: mockDeleteEq2 }))
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq1 }))

// For update posts (nullify campaign_id): .update().eq().eq() -> thenable
const mockUpdatePostsEq2 = vi.fn(() => ({
  then: (resolve: (v: unknown) => void) => resolve(updatePostsData),
}))
const mockUpdatePostsEq1 = vi.fn(() => ({ eq: mockUpdatePostsEq2 }))

// Build per-table chains
const campaignEq = vi.fn(
  (..._args: unknown[]): Record<string, unknown> => ({
    eq: campaignEq,
    single: mockCampaignSingle,
  })
)

const postEq = vi.fn(
  (..._args: unknown[]): Record<string, unknown> => ({
    eq: postEq,
    order: mockPostOrder,
  })
)

const updateEq = vi.fn(
  (..._args: unknown[]): Record<string, unknown> => ({
    eq: updateEq,
    select: mockUpdateSelect,
  })
)

const mockSelect = vi.fn(() => {
  if (currentTable === 'campaigns') {
    return { eq: campaignEq }
  }
  return { eq: postEq }
})

const mockUpdate = vi.fn(() => {
  if (currentTable === 'posts') {
    return { eq: mockUpdatePostsEq1 }
  }
  return { eq: updateEq }
})

const mockFrom = vi.fn((table: string) => {
  currentTable = table
  return {
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
  }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}))

import { GET, PATCH, DELETE } from './route'
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

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

const dbCampaign = {
  id: 'camp-1',
  name: 'Summer Launch',
  description: 'Launch campaign',
  status: 'active',
  project_id: 'proj-1',
  created_at: '2024-05-01T00:00:00Z',
  updated_at: '2024-05-15T00:00:00Z',
  user_id: 'user-1',
}

const dbPost = {
  id: 'post-1',
  content: 'Hello world',
  status: 'draft',
  platform: 'twitter',
  campaign_id: 'camp-1',
  group_id: null,
  group_type: null,
  notes: null,
  publish_result: null,
  scheduled_at: null,
  created_at: '2024-05-02T00:00:00Z',
  updated_at: '2024-05-02T00:00:00Z',
  user_id: 'user-1',
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  currentTable = ''
  campaignSingleData = { data: null, error: null }
  postQueryData = { data: [], error: null }
  updateSingleData = { data: null, error: null }
  deleteCampaignData = { error: null }
  updatePostsData = { data: null, error: null }
})

// ---------------------------------------------------------------------------
// GET /api/campaigns/[id]
// ---------------------------------------------------------------------------

describe('GET /api/campaigns/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/campaigns/camp-1')
    const res = await GET(req, makeParams('camp-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Forbidden'))
    const req = createRequest('/api/campaigns/camp-1')
    const res = await GET(req, makeParams('camp-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns campaign with posts for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    campaignSingleData = { data: dbCampaign, error: null }
    postQueryData = { data: [dbPost], error: null }

    const req = createRequest('/api/campaigns/camp-1')
    const res = await GET(req, makeParams('camp-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.campaign.id).toBe('camp-1')
    expect(body.campaign.name).toBe('Summer Launch')
    expect(body.campaign.projectId).toBe('proj-1')
    expect(body.posts).toHaveLength(1)
    expect(body.posts[0].id).toBe('post-1')
    expect(body.posts[0].campaignId).toBe('camp-1')
  })

  it('returns 404 when campaign not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    campaignSingleData = { data: null, error: { code: 'PGRST116', message: 'not found' } }

    const req = createRequest('/api/campaigns/nonexistent')
    const res = await GET(req, makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Campaign not found')
  })

  it('returns 500 when campaign query fails with non-PGRST116 error', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    campaignSingleData = { data: null, error: { code: 'OTHER', message: 'DB error' } }

    const req = createRequest('/api/campaigns/camp-1')
    const res = await GET(req, makeParams('camp-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })

  it('returns 500 when posts query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    campaignSingleData = { data: dbCampaign, error: null }
    postQueryData = { data: null, error: { message: 'Posts query failed' } }

    const req = createRequest('/api/campaigns/camp-1')
    const res = await GET(req, makeParams('camp-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })

  it('returns campaign with empty posts array when no posts exist', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    campaignSingleData = { data: dbCampaign, error: null }
    postQueryData = { data: [], error: null }

    const req = createRequest('/api/campaigns/camp-1')
    const res = await GET(req, makeParams('camp-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.campaign.id).toBe('camp-1')
    expect(body.posts).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/campaigns/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/campaigns/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/campaigns/camp-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req, makeParams('camp-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Forbidden'))
    const req = createRequest('/api/campaigns/camp-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req, makeParams('camp-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 400 for invalid input', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/campaigns/camp-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'invalid-status' }),
    })
    const res = await PATCH(req, makeParams('camp-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
    expect(body.details).toBeDefined()
  })

  it('returns 400 when name is whitespace-only', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/campaigns/camp-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: '   ' }),
    })
    const res = await PATCH(req, makeParams('camp-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Name cannot be empty')
  })

  it('updates campaign successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const updatedCampaign = {
      ...dbCampaign,
      name: 'Updated Name',
      updated_at: '2024-06-01T00:00:00Z',
    }
    updateSingleData = { data: updatedCampaign, error: null }

    const req = createRequest('/api/campaigns/camp-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Name' }),
    })
    const res = await PATCH(req, makeParams('camp-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.campaign.name).toBe('Updated Name')
    expect(body.campaign.projectId).toBe('proj-1')
  })

  it('updates campaign with all optional fields', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const projectUuid = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5'
    const updatedCampaign = {
      ...dbCampaign,
      name: 'Full Update',
      description: 'New description',
      status: 'paused',
      project_id: projectUuid,
    }
    updateSingleData = { data: updatedCampaign, error: null }

    const req = createRequest('/api/campaigns/camp-1', {
      method: 'PATCH',
      body: JSON.stringify({
        name: 'Full Update',
        description: 'New description',
        status: 'paused',
        projectId: projectUuid,
      }),
    })
    const res = await PATCH(req, makeParams('camp-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.campaign.name).toBe('Full Update')
    expect(body.campaign.description).toBe('New description')
    expect(body.campaign.status).toBe('paused')
    expect(body.campaign.projectId).toBe(projectUuid)
  })

  it('returns 404 when campaign not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    updateSingleData = { data: null, error: { code: 'PGRST116', message: 'not found' } }

    const req = createRequest('/api/campaigns/nonexistent', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test' }),
    })
    const res = await PATCH(req, makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Campaign not found')
  })

  it('returns 500 when update fails with non-PGRST116 error', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    updateSingleData = { data: null, error: { code: 'OTHER', message: 'DB error' } }

    const req = createRequest('/api/campaigns/camp-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Test' }),
    })
    const res = await PATCH(req, makeParams('camp-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/campaigns/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/campaigns/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/campaigns/camp-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('camp-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Forbidden'))
    const req = createRequest('/api/campaigns/camp-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('camp-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 404 when campaign not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    campaignSingleData = { data: null, error: { code: 'PGRST116', message: 'not found' } }

    const req = createRequest('/api/campaigns/nonexistent', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Campaign not found')
  })

  it('deletes campaign successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    campaignSingleData = { data: { id: 'camp-1' }, error: null }
    deleteCampaignData = { error: null }

    const req = createRequest('/api/campaigns/camp-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('camp-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('nullifies campaign_id on associated posts before deleting', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    campaignSingleData = { data: { id: 'camp-1' }, error: null }
    deleteCampaignData = { error: null }

    const req = createRequest('/api/campaigns/camp-1', { method: 'DELETE' })
    await DELETE(req, makeParams('camp-1'))

    // Verify update was called on posts table to nullify campaign_id
    expect(mockFrom).toHaveBeenCalledWith('posts')
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('returns 500 when delete fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    campaignSingleData = { data: { id: 'camp-1' }, error: null }
    deleteCampaignData = { error: { message: 'Delete failed' } }

    const req = createRequest('/api/campaigns/camp-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('camp-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
