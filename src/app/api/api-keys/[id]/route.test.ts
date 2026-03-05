import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  requireSessionAuth: vi.fn(),
}))

const mockUpdateSingle = vi.fn()
const mockUpdateSelect = vi.fn(() => ({ single: mockUpdateSingle }))
const mockUpdateEq2 = vi.fn(() => ({ select: mockUpdateSelect }))
const mockUpdateEq1 = vi.fn(() => ({ eq: mockUpdateEq2 }))
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq1 }))
const mockFrom = vi.fn(() => ({ update: mockUpdate }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

import { DELETE } from './route'
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
// DELETE /api/api-keys/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/api-keys/[id]', () => {
  function makeParams(id: string): { params: Promise<{ id: string }> } {
    return { params: Promise.resolve({ id }) }
  }

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = new Request('http://localhost:3000/api/api-keys/key-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('key-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('revokes (soft-deletes) an API key successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockUpdateSingle.mockResolvedValue({ data: { id: 'key-1' }, error: null })
    const req = new Request('http://localhost:3000/api/api-keys/key-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('key-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    // Verify it used .update() with revoked_at
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('returns 404 when key not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockUpdateSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } })
    const req = new Request('http://localhost:3000/api/api-keys/nonexistent', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('API key not found')
  })

  it('returns 404 when key belongs to another user', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // Returns no data because user_id filter doesn't match
    mockUpdateSingle.mockResolvedValue({ data: null, error: null })
    const req = new Request('http://localhost:3000/api/api-keys/other-key', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('other-key'))
    expect(res.status).toBe(404)
  })
})
