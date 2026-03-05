import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireSessionAuth: vi.fn(),
  ALL_SCOPES: [
    'posts:read',
    'posts:write',
    'campaigns:read',
    'campaigns:write',
    'projects:read',
    'projects:write',
    'blog:read',
    'blog:write',
    'launches:read',
    'launches:write',
    'media:write',
    'analytics:read',
  ],
}))

const mockLimit = vi.fn()
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockSelectEq = vi.fn(() => ({ order: mockOrder }))
const mockSelect = vi.fn(() => ({ eq: mockSelectEq }))
const mockInsertSingle = vi.fn()
const mockInsertSelect = vi.fn(() => ({ single: mockInsertSingle }))
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }))
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import { GET, POST } from './route'
import { requireSessionAuth } from '@/lib/auth'

const mockRequireAuth = vi.mocked(requireSessionAuth)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
})

// ---------------------------------------------------------------------------
// GET /api/api-keys
// ---------------------------------------------------------------------------

describe('GET /api/api-keys', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns api keys for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const dbKeys = [
      {
        id: 'key-1',
        name: 'My API Key',
        key_prefix: 'bh_a1b2c3d4',
        scopes: ['posts:read'],
        expires_at: null,
        last_used_at: '2024-06-01T00:00:00Z',
        revoked_at: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]
    mockLimit.mockResolvedValue({ data: dbKeys, error: null })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.apiKeys).toHaveLength(1)
    expect(body.apiKeys[0].id).toBe('key-1')
    expect(body.apiKeys[0].name).toBe('My API Key')
    expect(body.apiKeys[0].keyPrefix).toBe('bh_a1b2c3d4')
  })

  it('returns empty array when user has no keys', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: [], error: null })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.apiKeys).toEqual([])
  })

  it('returns 500 when database query fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: null, error: { message: 'DB error' } })
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/api-keys
// ---------------------------------------------------------------------------

describe('POST /api/api-keys', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = new Request('http://localhost:3000/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Key' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid input (missing name)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = new Request('http://localhost:3000/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })

  it('returns 400 for empty name', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = new Request('http://localhost:3000/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: '' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('creates API key successfully and returns 201 with raw key', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const insertedRow = {
      id: 'key-new',
      name: 'Production Key',
      key_prefix: 'bh_a1b2c3d4',
      scopes: [],
      expires_at: null,
      last_used_at: null,
      revoked_at: null,
      created_at: '2024-06-01T00:00:00Z',
      updated_at: '2024-06-01T00:00:00Z',
    }
    mockInsertSingle.mockResolvedValue({ data: insertedRow, error: null })
    const req = new Request('http://localhost:3000/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Production Key' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.apiKey.id).toBe('key-new')
    expect(body.apiKey.name).toBe('Production Key')
    // rawKey should be present (only returned once)
    expect(body.apiKey.rawKey).toBeDefined()
    expect(body.apiKey.rawKey).toContain('bh_')
  })

  it('returns 500 when insert fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockInsertSingle.mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
    const req = new Request('http://localhost:3000/api/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Key' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
