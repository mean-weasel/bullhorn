import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireSessionAuth: vi.fn(),
}))

// GET chain: .from().select().eq().order().limit()
const mockLimit = vi.fn()
const mockOrder = vi.fn(() => ({ limit: mockLimit }))
const mockQueryEq = vi.fn(() => ({ order: mockOrder }))
const mockSelect = vi.fn(() => ({ eq: mockQueryEq }))

// POST chain: .from().insert().select().single()
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
import { requireSessionAuth } from '@/lib/auth'

const mockRequireAuth = vi.mocked(requireSessionAuth)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(
    new URL(url, 'http://localhost:3000'),
    init as ConstructorParameters<typeof NextRequest>[1]
  )
}

const sampleDbReminder = {
  id: 'rem-1',
  user_id: 'user-1',
  title: 'Ship feature',
  description: 'Deploy the new dashboard',
  remind_at: '2026-03-01T09:00:00+00:00',
  post_id: null,
  campaign_id: null,
  is_completed: false,
  created_at: '2026-02-16T00:00:00Z',
  updated_at: '2026-02-16T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// GET /api/reminders
// ---------------------------------------------------------------------------

describe('GET /api/reminders', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns reminders for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: [sampleDbReminder], error: null })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reminders).toHaveLength(1)
    expect(body.reminders[0].id).toBe('rem-1')
    expect(body.reminders[0].title).toBe('Ship feature')
    expect(body.reminders[0].remindAt).toBe('2026-03-01T09:00:00+00:00')
  })

  it('returns empty array when user has no reminders', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockLimit.mockResolvedValue({ data: [], error: null })
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reminders).toHaveLength(0)
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
// POST /api/reminders
// ---------------------------------------------------------------------------

describe('POST /api/reminders', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/reminders', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test',
        remindAt: '2026-03-01T09:00:00+00:00',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('creates a reminder with valid data', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockInsertSingle.mockResolvedValue({ data: sampleDbReminder, error: null })
    const req = createRequest('/api/reminders', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Ship feature',
        description: 'Deploy the new dashboard',
        remindAt: '2026-03-01T09:00:00+00:00',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.reminder.id).toBe('rem-1')
    expect(body.reminder.title).toBe('Ship feature')
    expect(body.reminder.description).toBe('Deploy the new dashboard')
  })

  it('validates required fields — missing title', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/reminders', {
      method: 'POST',
      body: JSON.stringify({
        remindAt: '2026-03-01T09:00:00+00:00',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
    expect(body.details).toBeDefined()
  })

  it('validates required fields — missing remindAt', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/reminders', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Ship feature',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })

  it('validates remindAt must be a valid datetime', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/reminders', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Ship feature',
        remindAt: 'not-a-date',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })

  it('returns 500 when insert fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { message: 'Insert failed' },
    })
    const req = createRequest('/api/reminders', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Ship feature',
        remindAt: '2026-03-01T09:00:00+00:00',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
