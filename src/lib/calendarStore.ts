import { create } from 'zustand'
import { dedup, createDedupKey } from './requestDedup'
import { Post } from './posts'
import { Reminder } from './reminders'

// Alias for calendar-specific usage
type CalendarReminder = Reminder

const API_BASE = '/api'

interface CalendarState {
  posts: Post[]
  reminders: CalendarReminder[]
  loading: boolean
  error: string | null
  rangeStart: string | null
  rangeEnd: string | null
}

interface CalendarActions {
  fetchCalendarData: (start: string, end: string) => Promise<void>
}

export const useCalendarStore = create<CalendarState & CalendarActions>()((set) => ({
  posts: [],
  reminders: [],
  loading: false,
  error: null,
  rangeStart: null,
  rangeEnd: null,

  fetchCalendarData: async (start: string, end: string) => {
    const key = createDedupKey('calendar', { start, end })

    return dedup(key, async () => {
      set({ loading: true, error: null })
      try {
        const url = `${API_BASE}/calendar?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch calendar data')
        const data = await res.json()
        set({
          posts: data.posts || [],
          reminders: data.reminders || [],
          loading: false,
          rangeStart: start,
          rangeEnd: end,
        })
      } catch (error) {
        set({ error: (error as Error).message, loading: false })
      }
    })
  },
}))
