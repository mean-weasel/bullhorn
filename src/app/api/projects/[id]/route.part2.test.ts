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

vi.mock('@/lib/utils', () => ({
  transformProjectFromDb: vi.fn((p: Record<string, unknown>) => ({
    id: p.id,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    name: p.name,
    description: p.description,
    hashtags: p.hashtags || [],
    brandColors: p.brand_colors || {},
    logoUrl: p.logo_url,
  })),
  transformProjectToDb: vi.fn((p: Record<string, unknown>) => {
    const result: Record<string, unknown> = {}
    if (p.name !== undefined) result.name = p.name
    if (p.description !== undefined) result.description = p.description
    if (p.hashtags !== undefined) result.hashtags = p.hashtags
    if (p.brandColors !== undefined) result.brand_colors = p.brandColors
    if (p.logoUrl !== undefined) result.logo_url = p.logoUrl
    return result
  }),
}))

// Chainable query builder mocks

// GET chain: .from('projects').select('*').eq('id', id).eq('user_id', userId).single()
let mockGetSingleResult: { data: unknown; error: unknown } = { data: null, error: null }
const mockGetSingle = vi.fn(() => mockGetSingleResult)
const mockGetEqUserId = vi.fn(() => ({ single: mockGetSingle }))
const mockGetEqId = vi.fn(() => ({ eq: mockGetEqUserId }))
const mockGetSelect = vi.fn(() => ({ eq: mockGetEqId }))

// PATCH chain: .from('projects').update(data).eq('id',id).eq('user_id',userId).select().single()
let mockPatchSingleResult: { data: unknown; error: unknown } = { data: null, error: null }
const mockPatchSingle = vi.fn(() => mockPatchSingleResult)
const mockPatchSelect = vi.fn(() => ({ single: mockPatchSingle }))
const mockPatchEqUserId = vi.fn(() => ({ select: mockPatchSelect }))
const mockPatchEqId = vi.fn(() => ({ eq: mockPatchEqUserId }))
const mockUpdate = vi.fn(() => ({ eq: mockPatchEqId }))

// DELETE chain:
// 1. count query: .from('campaigns').select('*',{count:'exact',head:true}).eq('project_id',id).eq('user_id',userId)
let mockCountResult: { count: number | null } = { count: 0 }
const mockCountEq2 = vi.fn(() => mockCountResult)
const mockCountEq = vi.fn(() => ({ eq: mockCountEq2 }))
const mockCountSelect = vi.fn(() => ({ eq: mockCountEq }))

// 2. delete query: .from('projects').delete().eq('id',id).eq('user_id',userId)
let mockDeleteResult: { error: unknown } = { error: null }
const mockDeleteEqUserId = vi.fn(() => mockDeleteResult)
const mockDeleteEqId = vi.fn(() => ({ eq: mockDeleteEqUserId }))
const mockDelete = vi.fn(() => ({ eq: mockDeleteEqId }))

const mockFrom = vi.fn((table: string) => {
  if (table === 'campaigns') {
    return { select: mockCountSelect }
  }
  return {
    select: mockGetSelect,
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

function createContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

const sampleDbProject = {
  id: 'proj-1',
  created_at: '2024-05-01T00:00:00Z',
  updated_at: '2024-05-15T00:00:00Z',
  name: 'My Project',
  description: 'A project',
  hashtags: ['launch'],
  brand_colors: { primary: '#ff0000' },
  logo_url: null,
  user_id: 'user-1',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSingleResult = { data: null, error: null }
  mockPatchSingleResult = { data: null, error: null }
  mockDeleteResult = { error: null }
  mockCountResult = { count: 0 }
})

// ---------------------------------------------------------------------------
// GET /api/projects/[id]
// ---------------------------------------------------------------------------

describe('GET /api/projects/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/projects/proj-1')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Forbidden'))
    const req = createRequest('/api/projects/proj-1')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns project for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockGetSingleResult = { data: sampleDbProject, error: null }
    const req = createRequest('/api/projects/proj-1')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.project.id).toBe('proj-1')
    expect(body.project.name).toBe('My Project')
  })

  it('returns 404 when project not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockGetSingleResult = { data: null, error: { code: 'PGRST116', message: 'Not found' } }
    const req = createRequest('/api/projects/proj-999')
    const res = await GET(req, createContext('proj-999'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Project not found')
  })

  it('returns 500 when database query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockGetSingleResult = { data: null, error: { code: 'XXXXX', message: 'DB error' } }
    const req = createRequest('/api/projects/proj-1')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/projects/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/projects/[id] (2/2)', () => {
  it('updates project successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const updatedProject = { ...sampleDbProject, name: 'Updated Name' }
    mockPatchSingleResult = { data: updatedProject, error: null }
    const req = createRequest('/api/projects/proj-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated Name' }),
    })
    const res = await PATCH(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.project.name).toBe('Updated Name')
  })

  it('returns 404 when project not found on update', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockPatchSingleResult = { data: null, error: { code: 'PGRST116', message: 'Not found' } }
    const req = createRequest('/api/projects/proj-999', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req, createContext('proj-999'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Project not found')
  })

  it('returns 500 when database update fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockPatchSingleResult = { data: null, error: { code: 'XXXXX', message: 'DB error' } }
    const req = createRequest('/api/projects/proj-1', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
    })
    const res = await PATCH(req, createContext('proj-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/projects/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/projects/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/projects/proj-1', { method: 'DELETE' })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Forbidden'))
    const req = createRequest('/api/projects/proj-1', { method: 'DELETE' })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('deletes project successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockCountResult = { count: 2 }
    mockDeleteResult = { error: null }
    const req = createRequest('/api/projects/proj-1', { method: 'DELETE' })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.deleted.campaignsAffected).toBe(2)
  })

  it('deletes project with zero campaigns', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockCountResult = { count: null }
    mockDeleteResult = { error: null }
    const req = createRequest('/api/projects/proj-1', { method: 'DELETE' })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.deleted.campaignsAffected).toBe(0)
  })

  it('returns 500 when database delete fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockCountResult = { count: 0 }
    mockDeleteResult = { error: { message: 'DB error' } }
    const req = createRequest('/api/projects/proj-1', { method: 'DELETE' })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
