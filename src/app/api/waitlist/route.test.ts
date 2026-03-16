import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/emailSender', () => ({
  sendWaitlistConfirmation: vi.fn().mockResolvedValue(true),
}))

import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { sendWaitlistConfirmation } from '@/lib/emailSender'

let POST: typeof import('./route').POST

beforeEach(async () => {
  vi.clearAllMocks()
  vi.resetModules()
  const mod = await import('./route')
  POST = mod.POST
})

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL('/api/waitlist', 'http://localhost:3000'), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/waitlist', () => {
  it('returns 401 when not authenticated', async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error('Unauthorized'))

    const res = await POST(makeRequest({ feature: 'auto_publish' }))
    expect(res.status).toBe(401)
  })

  it('joins waitlist and sends confirmation email', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'user-1' })

    const upsertFn = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const getUserById = vi.fn(() =>
      Promise.resolve({ data: { user: { email: 'test@example.com' } }, error: null })
    )

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({
        upsert: upsertFn,
      })),
      auth: { admin: { getUserById } },
    } as never)

    const res = await POST(makeRequest({ feature: 'auto_publish' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.joined).toBe(true)

    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', feature: 'auto_publish' }),
      expect.anything()
    )
    expect(sendWaitlistConfirmation).toHaveBeenCalledWith('test@example.com', 'auto_publish')
  })

  it('defaults feature to auto_publish when not provided', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: 'user-1' })

    const upsertFn = vi.fn(() => Promise.resolve({ data: null, error: null }))
    const getUserById = vi.fn(() =>
      Promise.resolve({ data: { user: { email: 'test@example.com' } }, error: null })
    )

    vi.mocked(createClient).mockResolvedValue({
      from: vi.fn(() => ({
        upsert: upsertFn,
      })),
      auth: { admin: { getUserById } },
    } as never)

    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)

    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({ feature: 'auto_publish' }),
      expect.anything()
    )
  })
})
