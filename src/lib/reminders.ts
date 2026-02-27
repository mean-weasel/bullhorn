import { create } from 'zustand'
import { dedup, createDedupKey } from './requestDedup'
import { scheduleLocalNotification, cancelLocalNotification } from './localNotifications'
import { getOccurrencesInRange } from './rrule'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Reminder {
  id: string
  title: string
  description?: string
  remindAt: string
  postId?: string
  campaignId?: string
  isCompleted: boolean
  recurrenceRule?: string | null
  sourceEventId?: string | null
  createdAt: string
  updatedAt: string
}

interface CreateReminderInput {
  title: string
  description?: string
  remindAt: string
  postId?: string
  campaignId?: string
  recurrenceRule?: string
  sourceEventId?: string
}

interface UpdateReminderInput {
  title?: string
  description?: string | null
  remindAt?: string
  postId?: string | null
  campaignId?: string | null
  isCompleted?: boolean
  recurrenceRule?: string | null
  sourceEventId?: string | null
}

/** Row shape returned by `select('*')` on the `reminders` table */
export interface DbReminder {
  id: string
  user_id: string
  title: string
  description: string | null
  remind_at: string
  post_id: string | null
  campaign_id: string | null
  is_completed: boolean
  recurrence_rule: string | null
  source_event_id: string | null
  created_at: string
  updated_at: string
}

/** Partial snake_case shape used when inserting / updating a reminder */
interface DbReminderInsert {
  title?: string
  description?: string | null
  remind_at?: string
  post_id?: string | null
  campaign_id?: string | null
  is_completed?: boolean
  recurrence_rule?: string | null
  source_event_id?: string | null
}

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

export function transformReminderFromDb(dbReminder: DbReminder): Reminder {
  return {
    id: dbReminder.id,
    title: dbReminder.title,
    description: dbReminder.description ?? undefined,
    remindAt: dbReminder.remind_at,
    postId: dbReminder.post_id ?? undefined,
    campaignId: dbReminder.campaign_id ?? undefined,
    isCompleted: dbReminder.is_completed,
    recurrenceRule: dbReminder.recurrence_rule,
    sourceEventId: dbReminder.source_event_id,
    createdAt: dbReminder.created_at,
    updatedAt: dbReminder.updated_at,
  }
}

export function transformReminderToDb(reminder: UpdateReminderInput): DbReminderInsert {
  const result: DbReminderInsert = {}
  if (reminder.title !== undefined) result.title = reminder.title
  if (reminder.description !== undefined) result.description = reminder.description
  if (reminder.remindAt !== undefined) result.remind_at = reminder.remindAt
  if (reminder.postId !== undefined) result.post_id = reminder.postId
  if (reminder.campaignId !== undefined) result.campaign_id = reminder.campaignId
  if (reminder.isCompleted !== undefined) result.is_completed = reminder.isCompleted
  if (reminder.recurrenceRule !== undefined) result.recurrence_rule = reminder.recurrenceRule
  if (reminder.sourceEventId !== undefined) result.source_event_id = reminder.sourceEventId
  return result
}

// ---------------------------------------------------------------------------
// Recurrence expansion (pure function, exported for testability)
// ---------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Expand recurring reminders into virtual instances and merge with one-time
 * reminders.  Only uncompleted, future reminders are included.
 *
 * @param reminders  All reminders from the store
 * @param now        Current timestamp (injectable for testing)
 * @param limit      Maximum number of results
 */
export function expandUpcomingReminders(
  reminders: Reminder[],
  now: Date = new Date(),
  limit = 5
): Reminder[] {
  const rangeEnd = new Date(now.getTime() + THIRTY_DAYS_MS)
  const result: Reminder[] = []

  for (const reminder of reminders) {
    // Skip completed reminders entirely
    if (reminder.isCompleted) continue

    if (reminder.recurrenceRule) {
      // Expand the recurrence rule into concrete dates within the window
      const occurrences = getOccurrencesInRange(reminder.recurrenceRule, now, rangeEnd)

      for (const date of occurrences) {
        result.push({
          ...reminder,
          id: `${reminder.id}-${date.toISOString()}`,
          remindAt: date.toISOString(),
        })
      }
    } else {
      // One-time reminder — include only if in the future
      if (new Date(reminder.remindAt) > now) {
        result.push(reminder)
      }
    }
  }

  // Sort by remindAt ascending, then apply limit
  result.sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime())

  return result.slice(0, limit)
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const API_BASE = '/api'

interface RemindersState {
  reminders: Reminder[]
  loading: boolean
  error: string | null
  initialized: boolean
}

interface RemindersActions {
  fetchReminders: () => Promise<void>
  addReminder: (data: CreateReminderInput) => Promise<Reminder>
  updateReminder: (id: string, updates: UpdateReminderInput) => Promise<void>
  deleteReminder: (id: string) => Promise<void>
  completeReminder: (id: string) => Promise<void>
  getUpcomingReminders: (limit?: number) => Reminder[]
}

export const useRemindersStore = create<RemindersState & RemindersActions>()((set, get) => ({
  reminders: [],
  loading: false,
  error: null,
  initialized: false,

  fetchReminders: async () => {
    const key = createDedupKey('reminders')

    return dedup(key, async () => {
      set({ loading: true, error: null })
      try {
        const res = await fetch(`${API_BASE}/reminders`)
        if (!res.ok) throw new Error('Failed to fetch reminders')
        const data = await res.json()
        set({ reminders: data.reminders || [], loading: false, initialized: true })
      } catch (error) {
        set({ error: (error as Error).message, loading: false })
      }
    })
  },

  addReminder: async (reminderData) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reminderData),
      })
      if (!res.ok) throw new Error('Failed to create reminder')
      const data = await res.json()
      const newReminder = data.reminder as Reminder
      set((state) => ({
        reminders: [newReminder, ...state.reminders],
        loading: false,
      }))
      // Schedule native local notification
      scheduleLocalNotification(
        newReminder.id,
        newReminder.title,
        newReminder.description || 'Reminder is due!',
        new Date(newReminder.remindAt),
        { url: '/dashboard' }
      )
      return newReminder
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  updateReminder: async (id, updates) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update reminder')
      const data = await res.json()
      const updatedReminder = data.reminder as Reminder
      set((state) => ({
        reminders: state.reminders.map((r) => (r.id === id ? updatedReminder : r)),
        loading: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  deleteReminder: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/reminders/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete reminder')
      cancelLocalNotification(id)
      set((state) => ({
        reminders: state.reminders.filter((r) => r.id !== id),
        loading: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  completeReminder: async (id) => {
    await get().updateReminder(id, { isCompleted: true })
    cancelLocalNotification(id)
  },

  getUpcomingReminders: (limit = 5) => {
    return expandUpcomingReminders(get().reminders, new Date(), limit)
  },
}))
