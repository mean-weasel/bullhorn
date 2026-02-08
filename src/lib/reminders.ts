import { create } from 'zustand'
import { dedup, createDedupKey } from './requestDedup'

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
  createdAt: string
  updatedAt: string
}

export interface CreateReminderInput {
  title: string
  description?: string
  remindAt: string
  postId?: string
  campaignId?: string
}

export interface UpdateReminderInput {
  title?: string
  description?: string | null
  remindAt?: string
  postId?: string | null
  campaignId?: string | null
  isCompleted?: boolean
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
  created_at: string
  updated_at: string
}

/** Partial snake_case shape used when inserting / updating a reminder */
export interface DbReminderInsert {
  title?: string
  description?: string | null
  remind_at?: string
  post_id?: string | null
  campaign_id?: string | null
  is_completed?: boolean
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
  return result
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
  },

  getUpcomingReminders: (limit = 5) => {
    const reminders = get().reminders
    return reminders
      .filter((r) => !r.isCompleted && new Date(r.remindAt) > new Date())
      .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime())
      .slice(0, limit)
  },
}))
