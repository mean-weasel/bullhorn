import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useRemindersStore, transformReminderFromDb, transformReminderToDb } from './reminders'
import type { Reminder, DbReminder } from './reminders'
import { clearInFlightRequests } from './requestDedup'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
  clearInFlightRequests()
  useRemindersStore.setState({
    reminders: [],
    loading: false,
    error: null,
    initialized: false,
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeReminder = (overrides: Partial<Reminder> = {}): Reminder => ({
  id: 'rem-1',
  title: 'Test Reminder',
  description: 'A test reminder',
  remindAt: '2026-03-01T10:00:00Z',
  postId: 'post-1',
  campaignId: 'camp-1',
  isCompleted: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

const makeDbReminder = (overrides: Partial<DbReminder> = {}): DbReminder => ({
  id: 'rem-1',
  user_id: 'user-1',
  title: 'Test Reminder',
  description: 'A test reminder',
  remind_at: '2026-03-01T10:00:00Z',
  post_id: 'post-1',
  campaign_id: 'camp-1',
  is_completed: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides,
})

// ---------------------------------------------------------------------------
// transformReminderFromDb
// ---------------------------------------------------------------------------

describe('transformReminderFromDb', () => {
  it('should transform all snake_case fields to camelCase', () => {
    const db = makeDbReminder()
    const result = transformReminderFromDb(db)

    expect(result).toEqual({
      id: 'rem-1',
      title: 'Test Reminder',
      description: 'A test reminder',
      remindAt: '2026-03-01T10:00:00Z',
      postId: 'post-1',
      campaignId: 'camp-1',
      isCompleted: false,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    })
  })

  it('should convert null description to undefined', () => {
    const db = makeDbReminder({ description: null })
    const result = transformReminderFromDb(db)
    expect(result.description).toBeUndefined()
  })

  it('should convert null post_id to undefined', () => {
    const db = makeDbReminder({ post_id: null })
    const result = transformReminderFromDb(db)
    expect(result.postId).toBeUndefined()
  })

  it('should convert null campaign_id to undefined', () => {
    const db = makeDbReminder({ campaign_id: null })
    const result = transformReminderFromDb(db)
    expect(result.campaignId).toBeUndefined()
  })

  it('should preserve non-null optional fields', () => {
    const db = makeDbReminder({
      description: 'Important',
      post_id: 'post-42',
      campaign_id: 'camp-42',
    })
    const result = transformReminderFromDb(db)
    expect(result.description).toBe('Important')
    expect(result.postId).toBe('post-42')
    expect(result.campaignId).toBe('camp-42')
  })
})

// ---------------------------------------------------------------------------
// transformReminderToDb
// ---------------------------------------------------------------------------

describe('transformReminderToDb', () => {
  it('should only include defined fields', () => {
    const result = transformReminderToDb({ title: 'Updated Title' })
    expect(result).toEqual({ title: 'Updated Title' })
  })

  it('should transform remindAt to remind_at', () => {
    const result = transformReminderToDb({ remindAt: '2026-04-01T10:00:00Z' })
    expect(result).toEqual({ remind_at: '2026-04-01T10:00:00Z' })
  })

  it('should transform isCompleted to is_completed', () => {
    const result = transformReminderToDb({ isCompleted: true })
    expect(result).toEqual({ is_completed: true })
  })

  it('should transform postId to post_id', () => {
    const result = transformReminderToDb({ postId: 'post-99' })
    expect(result).toEqual({ post_id: 'post-99' })
  })

  it('should transform campaignId to campaign_id', () => {
    const result = transformReminderToDb({ campaignId: 'camp-99' })
    expect(result).toEqual({ campaign_id: 'camp-99' })
  })

  it('should handle null values for nullable fields', () => {
    const result = transformReminderToDb({
      description: null,
      postId: null,
      campaignId: null,
    })
    expect(result).toEqual({
      description: null,
      post_id: null,
      campaign_id: null,
    })
  })

  it('should return empty object when no fields provided', () => {
    const result = transformReminderToDb({})
    expect(result).toEqual({})
  })

  it('should transform all fields when all are provided', () => {
    const result = transformReminderToDb({
      title: 'Full Update',
      description: 'Desc',
      remindAt: '2026-05-01T12:00:00Z',
      postId: 'p-1',
      campaignId: 'c-1',
      isCompleted: false,
    })
    expect(result).toEqual({
      title: 'Full Update',
      description: 'Desc',
      remind_at: '2026-05-01T12:00:00Z',
      post_id: 'p-1',
      campaign_id: 'c-1',
      is_completed: false,
    })
  })
})

// ---------------------------------------------------------------------------
// useRemindersStore
// ---------------------------------------------------------------------------

describe('useRemindersStore', () => {
  // -------------------------------------------------------------------------
  // fetchReminders
  // -------------------------------------------------------------------------

  describe('fetchReminders', () => {
    it('should set loading true while fetching', async () => {
      let capturedLoading = false
      mockFetch.mockImplementation(() => {
        capturedLoading = useRemindersStore.getState().loading
        return Promise.resolve({
          ok: true,
          json: async () => ({ reminders: [] }),
        })
      })

      await useRemindersStore.getState().fetchReminders()
      expect(capturedLoading).toBe(true)
    })

    it('should populate reminders on success', async () => {
      const reminders = [makeReminder(), makeReminder({ id: 'rem-2', title: 'Second' })]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reminders }),
      })

      await useRemindersStore.getState().fetchReminders()

      const state = useRemindersStore.getState()
      expect(state.reminders).toEqual(reminders)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should set initialized after first fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reminders: [] }),
      })

      expect(useRemindersStore.getState().initialized).toBe(false)
      await useRemindersStore.getState().fetchReminders()
      expect(useRemindersStore.getState().initialized).toBe(true)
    })

    it('should set error on HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })

      await useRemindersStore.getState().fetchReminders()

      const state = useRemindersStore.getState()
      expect(state.error).toBe('Failed to fetch reminders')
      expect(state.loading).toBe(false)
    })

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await useRemindersStore.getState().fetchReminders()

      expect(useRemindersStore.getState().error).toBe('Network error')
      expect(useRemindersStore.getState().loading).toBe(false)
    })

    it('should default to empty array when response has no reminders key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await useRemindersStore.getState().fetchReminders()
      expect(useRemindersStore.getState().reminders).toEqual([])
    })

    it('should call correct API endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reminders: [] }),
      })

      await useRemindersStore.getState().fetchReminders()

      expect(mockFetch).toHaveBeenCalledWith('/api/reminders')
    })

    it('should deduplicate concurrent calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ reminders: [] }),
      })

      await Promise.all([
        useRemindersStore.getState().fetchReminders(),
        useRemindersStore.getState().fetchReminders(),
      ])

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should clear error on new fetch attempt', async () => {
      useRemindersStore.setState({ error: 'Previous error' })

      let capturedError: string | null = null
      mockFetch.mockImplementation(() => {
        capturedError = useRemindersStore.getState().error
        return Promise.resolve({
          ok: true,
          json: async () => ({ reminders: [] }),
        })
      })

      await useRemindersStore.getState().fetchReminders()
      expect(capturedError).toBeNull()
    })
  })

  // -------------------------------------------------------------------------
  // addReminder
  // -------------------------------------------------------------------------

  describe('addReminder', () => {
    it('should POST to /api/reminders and add to items', async () => {
      const newReminder = makeReminder()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reminder: newReminder }),
      })

      const result = await useRemindersStore.getState().addReminder({
        title: 'Test Reminder',
        remindAt: '2026-03-01T10:00:00Z',
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Test Reminder',
          remindAt: '2026-03-01T10:00:00Z',
        }),
      })
      expect(result).toEqual(newReminder)
      expect(useRemindersStore.getState().reminders).toHaveLength(1)
      expect(useRemindersStore.getState().reminders[0]).toEqual(newReminder)
    })

    it('should prepend new reminder to existing list', async () => {
      const existing = makeReminder({ id: 'existing-1' })
      useRemindersStore.setState({ reminders: [existing] })

      const newReminder = makeReminder({ id: 'new-1' })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reminder: newReminder }),
      })

      await useRemindersStore.getState().addReminder({
        title: 'New',
        remindAt: '2026-03-01T10:00:00Z',
      })

      const reminders = useRemindersStore.getState().reminders
      expect(reminders).toHaveLength(2)
      expect(reminders[0].id).toBe('new-1')
      expect(reminders[1].id).toBe('existing-1')
    })

    it('should set loading true while adding', async () => {
      let capturedLoading = false
      mockFetch.mockImplementation(() => {
        capturedLoading = useRemindersStore.getState().loading
        return Promise.resolve({
          ok: true,
          json: async () => ({ reminder: makeReminder() }),
        })
      })

      await useRemindersStore.getState().addReminder({
        title: 'Test',
        remindAt: '2026-03-01T10:00:00Z',
      })
      expect(capturedLoading).toBe(true)
    })

    it('should set loading false after success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reminder: makeReminder() }),
      })

      await useRemindersStore.getState().addReminder({
        title: 'Test',
        remindAt: '2026-03-01T10:00:00Z',
      })
      expect(useRemindersStore.getState().loading).toBe(false)
    })

    it('should set error and throw on HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })

      await expect(
        useRemindersStore.getState().addReminder({
          title: 'Fail',
          remindAt: '2026-03-01T10:00:00Z',
        })
      ).rejects.toThrow('Failed to create reminder')

      expect(useRemindersStore.getState().error).toBe('Failed to create reminder')
      expect(useRemindersStore.getState().loading).toBe(false)
    })

    it('should set error and throw on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        useRemindersStore.getState().addReminder({
          title: 'Fail',
          remindAt: '2026-03-01T10:00:00Z',
        })
      ).rejects.toThrow('Network error')

      expect(useRemindersStore.getState().error).toBe('Network error')
      expect(useRemindersStore.getState().loading).toBe(false)
    })

    it('should include optional fields in POST body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reminder: makeReminder() }),
      })

      await useRemindersStore.getState().addReminder({
        title: 'With Optionals',
        description: 'A description',
        remindAt: '2026-03-01T10:00:00Z',
        postId: 'post-1',
        campaignId: 'camp-1',
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'With Optionals',
          description: 'A description',
          remindAt: '2026-03-01T10:00:00Z',
          postId: 'post-1',
          campaignId: 'camp-1',
        }),
      })
    })
  })

  // -------------------------------------------------------------------------
  // updateReminder
  // -------------------------------------------------------------------------

  describe('updateReminder', () => {
    it('should PATCH and update the reminder in state', async () => {
      const original = makeReminder()
      useRemindersStore.setState({ reminders: [original] })

      const updated = { ...original, title: 'Updated Title' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reminder: updated }),
      })

      await useRemindersStore.getState().updateReminder('rem-1', { title: 'Updated Title' })

      expect(mockFetch).toHaveBeenCalledWith('/api/reminders/rem-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated Title' }),
      })
      expect(useRemindersStore.getState().reminders[0].title).toBe('Updated Title')
    })

    it('should only update the matching reminder', async () => {
      const rem1 = makeReminder({ id: 'rem-1', title: 'First' })
      const rem2 = makeReminder({ id: 'rem-2', title: 'Second' })
      useRemindersStore.setState({ reminders: [rem1, rem2] })

      const updatedRem1 = { ...rem1, title: 'Updated First' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reminder: updatedRem1 }),
      })

      await useRemindersStore.getState().updateReminder('rem-1', { title: 'Updated First' })

      const reminders = useRemindersStore.getState().reminders
      expect(reminders[0].title).toBe('Updated First')
      expect(reminders[1].title).toBe('Second')
    })

    it('should set loading true while updating', async () => {
      useRemindersStore.setState({ reminders: [makeReminder()] })

      let capturedLoading = false
      mockFetch.mockImplementation(() => {
        capturedLoading = useRemindersStore.getState().loading
        return Promise.resolve({
          ok: true,
          json: async () => ({ reminder: makeReminder() }),
        })
      })

      await useRemindersStore.getState().updateReminder('rem-1', { title: 'Updated' })
      expect(capturedLoading).toBe(true)
    })

    it('should set loading false after success', async () => {
      useRemindersStore.setState({ reminders: [makeReminder()] })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reminder: makeReminder() }),
      })

      await useRemindersStore.getState().updateReminder('rem-1', { title: 'Updated' })
      expect(useRemindersStore.getState().loading).toBe(false)
    })

    it('should set error and throw on HTTP failure', async () => {
      useRemindersStore.setState({ reminders: [makeReminder()] })
      mockFetch.mockResolvedValueOnce({ ok: false })

      await expect(
        useRemindersStore.getState().updateReminder('rem-1', { title: 'Fail' })
      ).rejects.toThrow('Failed to update reminder')

      expect(useRemindersStore.getState().error).toBe('Failed to update reminder')
      expect(useRemindersStore.getState().loading).toBe(false)
    })

    it('should set error and throw on network failure', async () => {
      useRemindersStore.setState({ reminders: [makeReminder()] })
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        useRemindersStore.getState().updateReminder('rem-1', { title: 'Fail' })
      ).rejects.toThrow('Network error')

      expect(useRemindersStore.getState().error).toBe('Network error')
    })
  })

  // -------------------------------------------------------------------------
  // deleteReminder
  // -------------------------------------------------------------------------

  describe('deleteReminder', () => {
    it('should DELETE and remove the reminder from state', async () => {
      useRemindersStore.setState({
        reminders: [makeReminder({ id: 'rem-1' }), makeReminder({ id: 'rem-2' })],
      })

      mockFetch.mockResolvedValueOnce({ ok: true })

      await useRemindersStore.getState().deleteReminder('rem-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/reminders/rem-1', { method: 'DELETE' })
      const reminders = useRemindersStore.getState().reminders
      expect(reminders).toHaveLength(1)
      expect(reminders[0].id).toBe('rem-2')
    })

    it('should set loading true while deleting', async () => {
      useRemindersStore.setState({ reminders: [makeReminder()] })

      let capturedLoading = false
      mockFetch.mockImplementation(() => {
        capturedLoading = useRemindersStore.getState().loading
        return Promise.resolve({ ok: true })
      })

      await useRemindersStore.getState().deleteReminder('rem-1')
      expect(capturedLoading).toBe(true)
    })

    it('should set loading false after success', async () => {
      useRemindersStore.setState({ reminders: [makeReminder()] })
      mockFetch.mockResolvedValueOnce({ ok: true })

      await useRemindersStore.getState().deleteReminder('rem-1')
      expect(useRemindersStore.getState().loading).toBe(false)
    })

    it('should set error and throw on HTTP failure', async () => {
      useRemindersStore.setState({ reminders: [makeReminder()] })
      mockFetch.mockResolvedValueOnce({ ok: false })

      await expect(useRemindersStore.getState().deleteReminder('rem-1')).rejects.toThrow(
        'Failed to delete reminder'
      )

      expect(useRemindersStore.getState().error).toBe('Failed to delete reminder')
      expect(useRemindersStore.getState().loading).toBe(false)
    })

    it('should set error and throw on network failure', async () => {
      useRemindersStore.setState({ reminders: [makeReminder()] })
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(useRemindersStore.getState().deleteReminder('rem-1')).rejects.toThrow(
        'Network error'
      )

      expect(useRemindersStore.getState().error).toBe('Network error')
    })

    it('should not modify other reminders when deleting', async () => {
      const rem1 = makeReminder({ id: 'rem-1' })
      const rem2 = makeReminder({ id: 'rem-2' })
      const rem3 = makeReminder({ id: 'rem-3' })
      useRemindersStore.setState({ reminders: [rem1, rem2, rem3] })

      mockFetch.mockResolvedValueOnce({ ok: true })

      await useRemindersStore.getState().deleteReminder('rem-2')

      const reminders = useRemindersStore.getState().reminders
      expect(reminders).toHaveLength(2)
      expect(reminders[0].id).toBe('rem-1')
      expect(reminders[1].id).toBe('rem-3')
    })
  })

  // -------------------------------------------------------------------------
  // completeReminder
  // -------------------------------------------------------------------------

  describe('completeReminder', () => {
    it('should call updateReminder with isCompleted: true', async () => {
      const original = makeReminder({ id: 'rem-1', isCompleted: false })
      useRemindersStore.setState({ reminders: [original] })

      const completed = { ...original, isCompleted: true }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ reminder: completed }),
      })

      await useRemindersStore.getState().completeReminder('rem-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/reminders/rem-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: true }),
      })
      expect(useRemindersStore.getState().reminders[0].isCompleted).toBe(true)
    })

    it('should propagate errors from updateReminder', async () => {
      useRemindersStore.setState({ reminders: [makeReminder()] })
      mockFetch.mockResolvedValueOnce({ ok: false })

      await expect(useRemindersStore.getState().completeReminder('rem-1')).rejects.toThrow(
        'Failed to update reminder'
      )
    })
  })

  // -------------------------------------------------------------------------
  // getUpcomingReminders
  // -------------------------------------------------------------------------

  describe('getUpcomingReminders', () => {
    it('should return only incomplete reminders in the future', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString() // +1 day
      const pastDate = new Date(Date.now() - 86400000).toISOString() // -1 day

      useRemindersStore.setState({
        reminders: [
          makeReminder({ id: 'future-incomplete', remindAt: futureDate, isCompleted: false }),
          makeReminder({ id: 'future-complete', remindAt: futureDate, isCompleted: true }),
          makeReminder({ id: 'past-incomplete', remindAt: pastDate, isCompleted: false }),
          makeReminder({ id: 'past-complete', remindAt: pastDate, isCompleted: true }),
        ],
      })

      const upcoming = useRemindersStore.getState().getUpcomingReminders()
      expect(upcoming).toHaveLength(1)
      expect(upcoming[0].id).toBe('future-incomplete')
    })

    it('should sort by remindAt ascending (soonest first)', () => {
      const soon = new Date(Date.now() + 3600000).toISOString() // +1 hour
      const later = new Date(Date.now() + 86400000).toISOString() // +1 day
      const latest = new Date(Date.now() + 172800000).toISOString() // +2 days

      useRemindersStore.setState({
        reminders: [
          makeReminder({ id: 'latest', remindAt: latest, isCompleted: false }),
          makeReminder({ id: 'soon', remindAt: soon, isCompleted: false }),
          makeReminder({ id: 'later', remindAt: later, isCompleted: false }),
        ],
      })

      const upcoming = useRemindersStore.getState().getUpcomingReminders()
      expect(upcoming.map((r) => r.id)).toEqual(['soon', 'later', 'latest'])
    })

    it('should default to limit of 5', () => {
      const reminders = Array.from({ length: 10 }, (_, i) =>
        makeReminder({
          id: `rem-${i}`,
          remindAt: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
          isCompleted: false,
        })
      )
      useRemindersStore.setState({ reminders })

      const upcoming = useRemindersStore.getState().getUpcomingReminders()
      expect(upcoming).toHaveLength(5)
    })

    it('should respect custom limit', () => {
      const reminders = Array.from({ length: 10 }, (_, i) =>
        makeReminder({
          id: `rem-${i}`,
          remindAt: new Date(Date.now() + (i + 1) * 3600000).toISOString(),
          isCompleted: false,
        })
      )
      useRemindersStore.setState({ reminders })

      const upcoming = useRemindersStore.getState().getUpcomingReminders(3)
      expect(upcoming).toHaveLength(3)
    })

    it('should return empty array when no reminders exist', () => {
      const upcoming = useRemindersStore.getState().getUpcomingReminders()
      expect(upcoming).toEqual([])
    })

    it('should return empty array when all reminders are completed', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      useRemindersStore.setState({
        reminders: [
          makeReminder({ id: 'rem-1', remindAt: futureDate, isCompleted: true }),
          makeReminder({ id: 'rem-2', remindAt: futureDate, isCompleted: true }),
        ],
      })

      const upcoming = useRemindersStore.getState().getUpcomingReminders()
      expect(upcoming).toEqual([])
    })

    it('should return empty array when all reminders are in the past', () => {
      const pastDate = new Date(Date.now() - 86400000).toISOString()
      useRemindersStore.setState({
        reminders: [
          makeReminder({ id: 'rem-1', remindAt: pastDate, isCompleted: false }),
          makeReminder({ id: 'rem-2', remindAt: pastDate, isCompleted: false }),
        ],
      })

      const upcoming = useRemindersStore.getState().getUpcomingReminders()
      expect(upcoming).toEqual([])
    })

    it('should return fewer items when less than limit available', () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString()
      useRemindersStore.setState({
        reminders: [makeReminder({ id: 'rem-1', remindAt: futureDate, isCompleted: false })],
      })

      const upcoming = useRemindersStore.getState().getUpcomingReminders(5)
      expect(upcoming).toHaveLength(1)
    })
  })

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('should start with empty reminders', () => {
      expect(useRemindersStore.getState().reminders).toEqual([])
    })

    it('should start with loading false', () => {
      expect(useRemindersStore.getState().loading).toBe(false)
    })

    it('should start with error null', () => {
      expect(useRemindersStore.getState().error).toBeNull()
    })

    it('should start with initialized false', () => {
      expect(useRemindersStore.getState().initialized).toBe(false)
    })
  })
})
