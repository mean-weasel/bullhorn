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

vi.mock('@/lib/planEnforcement', () => ({
  enforceResourceLimit: vi.fn(async () => ({
    allowed: true,
    current: 0,
    limit: 3,
    plan: 'free',
  })),
  isPlanLimitError: vi.fn(() => false),
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
}))

// GET query chain: .from().select().eq().order().limit() returns { data, error }
let mockQueryData: { data: unknown; error: unknown } = { data: [], error: null }
const mockLimit = vi.fn(() => ({
  then: (resolve: (val: unknown) => void) => resolve(mockQueryData),
}))
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockChainEq = vi.fn(() => ({ order: mockOrder }))
const mockSelect = vi.fn(() => ({ eq: mockChainEq }))

// POST insert chain: .from().insert().select().single()
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
import { enforceResourceLimit } from '@/lib/planEnforcement'

const mockRequireAuth = vi.mocked(requireAuth)
const mockEnforceResourceLimit = vi.mocked(enforceResourceLimit)

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
  mockQueryData = { data: [], error: null }
})

// ---------------------------------------------------------------------------
// GET /api/projects
// ---------------------------------------------------------------------------

describe('GET /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns projects for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbProjects = [
      {
        id: 'proj-1',
        created_at: '2024-05-01T00:00:00Z',
        updated_at: '2024-05-15T00:00:00Z',
        name: 'My Project',
        description: 'A project',
        hashtags: ['launch'],
        brand_colors: { primary: '#ff0000' },
        logo_url: null,
        user_id: 'user-1',
      },
    ]
    mockQueryData = { data: dbProjects, error: null }
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.projects).toHaveLength(1)
    expect(body.projects[0].id).toBe('proj-1')
    expect(body.projects[0].name).toBe('My Project')
  })

  it('returns empty array when user has no projects', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockQueryData = { data: [], error: null }
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.projects).toEqual([])
  })

  it('returns 500 when database query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockQueryData = { data: null, error: { message: 'DB error' } }
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/projects
// ---------------------------------------------------------------------------

describe('POST /api/projects', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Project' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 403 when plan limit reached', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockEnforceResourceLimit.mockResolvedValue({
      allowed: false,
      current: 3,
      limit: 3,
      plan: 'free',
    })
    const req = createRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Project' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Project limit reached')
  })

  it('returns 400 for invalid input (missing name)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockEnforceResourceLimit.mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 3,
      plan: 'free',
    })
    const req = createRequest('/api/projects', {
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
    mockEnforceResourceLimit.mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 3,
      plan: 'free',
    })
    const req = createRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates project successfully and returns 201', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockEnforceResourceLimit.mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 3,
      plan: 'free',
    })
    const createdProject = {
      id: 'proj-new',
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
      name: 'New Project',
      description: 'A new project',
      hashtags: [],
      brand_colors: {},
      logo_url: null,
      user_id: 'user-1',
    }
    mockInsertSingle.mockResolvedValue({ data: createdProject, error: null })
    const req = createRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Project', description: 'A new project' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.project.id).toBe('proj-new')
    expect(body.project.name).toBe('New Project')
  })

  it('returns 500 when insert fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockEnforceResourceLimit.mockResolvedValue({
      allowed: true,
      current: 0,
      limit: 3,
      plan: 'free',
    })
    mockInsertSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
    const req = createRequest('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Project' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
