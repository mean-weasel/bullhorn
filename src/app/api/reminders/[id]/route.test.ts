import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireSessionAuth: vi.fn(),
}))

// PATCH update chain: .from().update().eq().eq().select().single()
const mockUpdateSingle = vi.fn()
const mockUpdateSelect = vi.fn(() => ({ single: mockUpdateSingle }))
const mockUpdateEq2 = vi.fn(() => ({ select: mockUpdateSelect }))
const mockUpdateEq1 = vi.fn(() => ({ eq: mockUpdateEq2 }))
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq1 }))

// DELETE ownership check chain: .from().select().eq().eq().single()
const mockCheckSingle = vi.fn()
const mockCheckEq2 = vi.fn(() => ({ single: mockCheckSingle }))
const mockCheckEq1 = vi.fn(() => ({ eq: mockCheckEq2 }))
const mockSelect = vi.fn(() => ({ eq: mockCheckEq1 }))

// DELETE chain: .from().delete().eq().eq()
const mockDeleteEq2 = vi.fn()
const mockDeleteEq1 = vi.fn(() => ({ eq: mockDeleteEq2 }))
const mockDelete = vi.fn(() => ({ eq: mockDeleteEq1 }))

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
  delete: mockDelete,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}))

import { PATCH, DELETE } from './route'
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

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) }
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
// PATCH /api/reminders/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/reminders/[id] (1/3)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/reminders/rem-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, makeParams('rem-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('updates a reminder successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const updatedReminder = {
      ...sampleDbReminder,
      title: 'Updated title',
      updated_at: '2026-02-17T00:00:00Z',
    }
    mockUpdateSingle.mockResolvedValue({ data: updatedReminder, error: null })
    const req = createRequest('/api/reminders/rem-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated title' }),
    })
    const res = await PATCH(req, makeParams('rem-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reminder.title).toBe('Updated title')
    expect(body.reminder.id).toBe('rem-1')
  })

  it('returns 400 for invalid input', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/reminders/rem-1', {
      method: 'PATCH',
      body: JSON.stringify({ remindAt: 'not-a-date' }),
    })
    const res = await PATCH(req, makeParams('rem-1'))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
  })
})

describe('PATCH /api/reminders/[id] (2/3)', () => {
  it('returns 404 when reminder not found (PGRST116)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockUpdateSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Row not found' },
    })
    const req = createRequest('/api/reminders/nonexistent', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Reminder not found')
  })

  it('returns 500 when update fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockUpdateSingle.mockResolvedValue({
      data: null,
      error: { code: 'OTHER', message: 'Update failed' },
    })
    const req = createRequest('/api/reminders/rem-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Updated' }),
    })
    const res = await PATCH(req, makeParams('rem-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})

describe('PATCH /api/reminders/[id] (3/3)', () => {
  it('updates isCompleted field', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const completedReminder = {
      ...sampleDbReminder,
      is_completed: true,
      updated_at: '2026-02-17T00:00:00Z',
    }
    mockUpdateSingle.mockResolvedValue({ data: completedReminder, error: null })
    const req = createRequest('/api/reminders/rem-1', {
      method: 'PATCH',
      body: JSON.stringify({ isCompleted: true }),
    })
    const res = await PATCH(req, makeParams('rem-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reminder.isCompleted).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/reminders/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/reminders/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/reminders/rem-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('rem-1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('deletes a reminder successfully', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // Ownership check succeeds
    mockCheckSingle.mockResolvedValue({ data: { id: 'rem-1' }, error: null })
    // Delete succeeds
    mockDeleteEq2.mockResolvedValue({ error: null })
    const req = createRequest('/api/reminders/rem-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('rem-1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 404 when reminder not found', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockCheckSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    })
    const req = createRequest('/api/reminders/nonexistent', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('nonexistent'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Reminder not found')
  })

  it('returns 500 when delete fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // Ownership check succeeds
    mockCheckSingle.mockResolvedValue({ data: { id: 'rem-1' }, error: null })
    // Delete fails
    mockDeleteEq2.mockResolvedValue({ error: { message: 'Delete failed' } })
    const req = createRequest('/api/reminders/rem-1', { method: 'DELETE' })
    const res = await DELETE(req, makeParams('rem-1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal server error')
  })
})
