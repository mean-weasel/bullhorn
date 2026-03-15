import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  requireSessionAuth: vi.fn(),
}))

// Supabase query chain mocks
// GET chain:  from().select().eq().single()
// PATCH chain (update): from().update().eq().select().single()
// PATCH chain (insert): from().insert().select().single()
const mockSingle = vi.fn()
const mockSelectAfterEq = vi.fn(() => ({ single: mockSingle }))
const mockEq = vi.fn(() => ({ single: mockSingle, select: mockSelectAfterEq }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockUpdate = vi.fn(() => ({ eq: mockEq }))

const mockInsertSingle = vi.fn()
const mockInsertSelect = vi.fn(() => ({ single: mockInsertSingle }))
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }))

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: mockFrom,
  })),
}))

import { GET, PATCH } from './route'
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

const defaultDbRow = {
  id: 'pref-1',
  user_id: 'user-1',
  email_post_published: true,
  email_post_failed: true,
  email_weekly_digest: false,
  email_campaign_reminder: true,
  push_enabled: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// GET /api/notification-preferences
// ---------------------------------------------------------------------------

describe('GET /api/notification-preferences (1/3)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns notification preferences for authenticated user', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockSingle.mockResolvedValue({ data: defaultDbRow, error: null })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.preferences).toEqual({
      id: 'pref-1',
      emailPostPublished: true,
      emailPostFailed: true,
      emailWeeklyDigest: false,
      emailCampaignReminder: true,
      pushEnabled: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
    })

    // Verify query was scoped to user
    expect(mockFrom).toHaveBeenCalledWith('notification_preferences')
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
  })
})

describe('GET /api/notification-preferences (2/3)', () => {
  it('handles no existing preferences by creating defaults', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // First query returns PGRST116 (no rows)
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    })

    const insertedRow = {
      ...defaultDbRow,
      id: 'pref-new',
      email_post_published: true,
      email_post_failed: true,
      email_weekly_digest: false,
      email_campaign_reminder: false,
      push_enabled: false,
    }
    mockInsertSingle.mockResolvedValue({ data: insertedRow, error: null })

    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.preferences.id).toBe('pref-new')
    // Verify insert was called with user_id
    expect(mockInsert).toHaveBeenCalledWith({ user_id: 'user-1' })
  })

  it('returns 500 when insert for defaults fails', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    // First query returns PGRST116
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: 'PGRST116', message: 'No rows found' },
    })
    // Insert fails
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { message: 'Insert failed' },
    })

    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to create preferences')
  })
})

describe('GET /api/notification-preferences (3/3)', () => {
  it('returns 500 when database query fails with non-PGRST116 error', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockSingle.mockResolvedValue({
      data: null,
      error: { code: 'UNEXPECTED', message: 'DB error' },
    })

    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Failed to fetch preferences')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/notification-preferences
// ---------------------------------------------------------------------------

describe('PATCH /api/notification-preferences (1/4)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest('/api/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({ emailPostPublished: false }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('updates notification preferences', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })

    const updatedRow = {
      ...defaultDbRow,
      email_post_published: false,
      push_enabled: true,
      updated_at: '2024-02-01T00:00:00Z',
    }
    mockSingle.mockResolvedValue({ data: updatedRow, error: null })

    const req = createRequest('/api/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({ emailPostPublished: false, pushEnabled: true }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.preferences.emailPostPublished).toBe(false)
    expect(body.preferences.pushEnabled).toBe(true)

    // Verify update was called with snake_case fields
    expect(mockUpdate).toHaveBeenCalledWith({
      email_post_published: false,
      push_enabled: true,
    })
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-1')
  })
})

describe('PATCH /api/notification-preferences (2/4)', () => {
  it('returns 400 for invalid input (wrong type)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({ emailPostPublished: 'yes' }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Invalid input')
    expect(body.details).toBeDefined()
  })

  it('returns 400 when no valid fields are provided', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No fields to update')
  })

  it('returns 400 for unknown fields (stripped by schema, treated as empty)', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    const req = createRequest('/api/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify({ unknownField: true }),
    })
    const res = await PATCH(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No fields to update')
  })
})
