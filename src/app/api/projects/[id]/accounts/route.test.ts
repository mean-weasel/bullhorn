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

// Chainable query builder mocks
// We need different chains for different .from() calls:
//   - 'projects' for ownership verification: .select('id').eq('id',x).eq('user_id',y).single()
//   - 'project_accounts' for GET: .select('*').eq('project_id',x).order(...)
//   - 'project_accounts' for POST insert: .insert({}).select().single()
//   - 'project_accounts' for DELETE: .delete().eq('project_id',x).eq('account_id',y)

// --- projects ownership check chain ---
// GET uses .select('id').eq('id',x).eq('user_id',y).single()
// POST uses .select('id').eq('id',x).single()
// Both must work, so .eq() returns { eq, single }
let mockProjectResult: { data: unknown; error: unknown } = { data: { id: 'proj-1' }, error: null }
const mockProjectSingle = vi.fn(() => mockProjectResult)
const mockProjectEqUserId = vi.fn(() => ({ single: mockProjectSingle }))
const mockProjectEqId = vi.fn(() => ({ eq: mockProjectEqUserId, single: mockProjectSingle }))
const mockProjectSelect = vi.fn(() => ({ eq: mockProjectEqId }))

// --- project_accounts GET chain ---
let mockAccountsData: { data: unknown; error: unknown } = { data: [], error: null }
const mockAccountsLimit = vi.fn(() => mockAccountsData)
const mockAccountsOrder = vi.fn(() => ({ limit: mockAccountsLimit }))
const mockAccountsEqProjectId = vi.fn(() => ({ order: mockAccountsOrder }))
const mockAccountsSelect = vi.fn(() => ({ eq: mockAccountsEqProjectId }))

// --- project_accounts POST insert chain ---
let mockInsertResult: { data: unknown; error: unknown } = { data: null, error: null }
const mockInsertSingle = vi.fn(() => mockInsertResult)
const mockInsertSelect = vi.fn(() => ({ single: mockInsertSingle }))
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }))

// --- project_accounts DELETE chain ---
let mockDeleteResult: { error: unknown } = { error: null }
const mockDeleteEqAccountId = vi.fn(() => mockDeleteResult)
const mockDeleteEqProjectId = vi.fn(() => ({ eq: mockDeleteEqAccountId }))
const mockAccountsDelete = vi.fn(() => ({ eq: mockDeleteEqProjectId }))

const mockFrom = vi.fn((table: string) => {
  if (table === 'projects') {
    return { select: mockProjectSelect }
  }
  if (table === 'project_accounts') {
    return {
      select: mockAccountsSelect,
      insert: mockInsert,
      delete: mockAccountsDelete,
    }
  }
  return {}
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}))

import { GET, POST, DELETE } from './route'
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockProjectResult = { data: { id: 'proj-1' }, error: null }
  mockAccountsData = { data: [], error: null }
  mockInsertResult = { data: null, error: null }
  mockDeleteResult = { error: null }
})

// ---------------------------------------------------------------------------
// GET /api/projects/[id]/accounts
// ---------------------------------------------------------------------------

describe('GET /api/projects/[id]/accounts', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/projects/proj-1/accounts')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scopes are insufficient', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Forbidden'))
    const req = createRequest('/api/projects/proj-1/accounts')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 404 when project not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: null, error: { code: 'PGRST116', message: 'Not found' } }
    const req = createRequest('/api/projects/proj-999/accounts')
    const res = await GET(req, createContext('proj-999'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Project not found')
  })

  it('returns accounts for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockAccountsData = {
      data: [
        {
          id: 'pa-1',
          project_id: 'proj-1',
          account_id: 'acc-1',
          created_at: '2024-05-01T00:00:00Z',
        },
      ],
      error: null,
    }
    const req = createRequest('/api/projects/proj-1/accounts')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accounts).toHaveLength(1)
    expect(body.accounts[0].accountId).toBe('acc-1')
    expect(body.accounts[0].projectId).toBe('proj-1')
  })

  it('returns empty array when no accounts', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockAccountsData = { data: [], error: null }
    const req = createRequest('/api/projects/proj-1/accounts')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accounts).toEqual([])
  })

  it('returns 500 when database query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockAccountsData = { data: null, error: { message: 'DB error' } }
    const req = createRequest('/api/projects/proj-1/accounts')
    const res = await GET(req, createContext('proj-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/projects/[id]/accounts
// ---------------------------------------------------------------------------

describe('POST /api/projects/[id]/accounts', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/projects/proj-1/accounts', {
      method: 'POST',
      body: JSON.stringify({ accountId: 'acc-1' }),
    })
    const res = await POST(req, createContext('proj-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 for invalid input (missing accountId)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/projects/proj-1/accounts', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req, createContext('proj-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })

  it('returns 404 when project not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: null, error: { code: 'PGRST116', message: 'Not found' } }
    const req = createRequest('/api/projects/proj-999/accounts', {
      method: 'POST',
      body: JSON.stringify({ accountId: 'acc-1' }),
    })
    const res = await POST(req, createContext('proj-999'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Project not found')
  })

  it('creates account association successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockInsertResult = {
      data: {
        id: 'pa-new',
        project_id: 'proj-1',
        account_id: 'acc-1',
        created_at: '2024-06-01T00:00:00Z',
      },
      error: null,
    }
    const req = createRequest('/api/projects/proj-1/accounts', {
      method: 'POST',
      body: JSON.stringify({ accountId: 'acc-1' }),
    })
    const res = await POST(req, createContext('proj-1'))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.account.id).toBe('pa-new')
    expect(body.account.accountId).toBe('acc-1')
  })

  it('returns 409 when account already associated', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockInsertResult = { data: null, error: { code: '23505', message: 'Unique violation' } }
    const req = createRequest('/api/projects/proj-1/accounts', {
      method: 'POST',
      body: JSON.stringify({ accountId: 'acc-1' }),
    })
    const res = await POST(req, createContext('proj-1'))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Account already associated with project')
  })

  it('returns 500 when database insert fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockProjectResult = { data: { id: 'proj-1' }, error: null }
    mockInsertResult = { data: null, error: { code: 'XXXXX', message: 'DB error' } }
    const req = createRequest('/api/projects/proj-1/accounts', {
      method: 'POST',
      body: JSON.stringify({ accountId: 'acc-1' }),
    })
    const res = await POST(req, createContext('proj-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/projects/[id]/accounts
// ---------------------------------------------------------------------------

describe('DELETE /api/projects/[id]/accounts', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/projects/proj-1/accounts?accountId=acc-1', {
      method: 'DELETE',
    })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 when accountId query param missing', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/projects/proj-1/accounts', {
      method: 'DELETE',
    })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('accountId query parameter is required')
  })

  it('deletes account association successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockDeleteResult = { error: null }
    const req = createRequest('/api/projects/proj-1/accounts?accountId=acc-1', {
      method: 'DELETE',
    })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 when database delete fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockDeleteResult = { error: { message: 'DB error' } }
    const req = createRequest('/api/projects/proj-1/accounts?accountId=acc-1', {
      method: 'DELETE',
    })
    const res = await DELETE(req, createContext('proj-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
