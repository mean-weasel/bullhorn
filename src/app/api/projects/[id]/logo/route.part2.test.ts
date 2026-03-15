// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  validateScopes: vi.fn(),
}))

// Mock crypto
vi.mock('crypto', () => ({
  default: {
    randomUUID: vi.fn(() => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
  },
}))

// Chainable query builder mocks

// projects ownership check: .select('id, logo_url, user_id').eq('id',x).single()
let mockProjectResult: { data: unknown; error: unknown } = { data: null, error: null }
const mockProjectSingle = vi.fn(() => mockProjectResult)
const mockProjectEq = vi.fn(() => ({ single: mockProjectSingle }))
const mockProjectSelect = vi.fn(() => ({ eq: mockProjectEq }))

// project update: .update({}).eq('id',x)
let mockUpdateResult: { error: unknown } = { error: null }
const mockUpdateEq = vi.fn(() => mockUpdateResult)
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }))

const mockStorageUpload = vi.fn(async () => ({ error: null }))
const mockStorageRemove = vi.fn(async () => ({ error: null }))
const mockStorageGetPublicUrl = vi.fn(() => ({
  data: { publicUrl: 'https://storage.example.com/logos/test.png' },
}))

const mockFrom = vi.fn(() => ({
  select: mockProjectSelect,
  update: mockUpdate,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
        getPublicUrl: mockStorageGetPublicUrl,
      })),
    },
  })),
}))

import { DELETE } from './route'
import { requireAuth } from '@/lib/auth'

const mockRequireAuth = vi.mocked(requireAuth)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createContext(id: string) {
  return { params: Promise.resolve({ id }) }
}

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
  mockProjectResult = { data: null, error: null }
  mockUpdateResult = { error: null }
})

// ---------------------------------------------------------------------------
// POST /api/projects/[id]/logo
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DELETE /api/projects/[id]/logo
// ---------------------------------------------------------------------------

describe('DELETE /api/projects/[id]/logo (1/2)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/projects/proj-1/logo', { method: 'DELETE' })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Forbidden'))
    const req = createRequest('/api/projects/proj-1/logo', { method: 'DELETE' })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 404 when project not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: null, error: { code: 'PGRST116', message: 'Not found' } }
    const req = createRequest('/api/projects/proj-999/logo', { method: 'DELETE' })
    const res = await DELETE(req, createContext('proj-999'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Project not found')
  })

  it('returns 403 when user does not own the project', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = {
      data: { id: 'proj-1', logo_url: '/storage/logos/old.png', user_id: 'user-other' },
      error: null,
    }
    const req = createRequest('/api/projects/proj-1/logo', { method: 'DELETE' })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })
})

describe('DELETE /api/projects/[id]/logo (2/2)', () => {
  it('deletes logo successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = {
      data: { id: 'proj-1', logo_url: '/storage/logos/old.png', user_id: 'user-1' },
      error: null,
    }
    mockUpdateResult = { error: null }
    const req = createRequest('/api/projects/proj-1/logo', { method: 'DELETE' })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('deletes logo when no existing logo_url', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = {
      data: { id: 'proj-1', logo_url: null, user_id: 'user-1' },
      error: null,
    }
    mockUpdateResult = { error: null }
    const req = createRequest('/api/projects/proj-1/logo', { method: 'DELETE' })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 when database update fails on delete', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = {
      data: { id: 'proj-1', logo_url: '/storage/logos/old.png', user_id: 'user-1' },
      error: null,
    }
    mockUpdateResult = { error: { message: 'Update failed' } }
    const req = createRequest('/api/projects/proj-1/logo', { method: 'DELETE' })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to update project')
  })
})
