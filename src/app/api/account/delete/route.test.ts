import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ requireSessionAuth: () => mockRequireAuth() }))

const mockDeleteUser = vi.fn().mockResolvedValue({ error: null })

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: { admin: { deleteUser: mockDeleteUser } },
  })),
}))

import { POST } from './route'

describe('POST /api/account/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ userId: 'user-123' })
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
  })

  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await POST(new Request('http://localhost/api/account/delete', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('deletes user data and auth, returns success', async () => {
    const res = await POST(new Request('http://localhost/api/account/delete', { method: 'POST' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(mockDeleteUser).toHaveBeenCalledWith('user-123')
  })
})
