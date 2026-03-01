import { create } from 'zustand'
import { dedup, createDedupKey } from './requestDedup'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommunityEvent {
  id: string
  name: string
  description: string | null
  platform: 'twitter' | 'linkedin' | 'reddit'
  target: string | null
  recurrenceRule: string
  recurrenceTimezone: string
  suggestedPostType: string | null
  tags: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface EventSubscription {
  id: string
  eventId: string
  notifyHoursBefore: number
  autoCreateDraft: boolean
  createdAt: string
  event?: CommunityEvent // joined from API
}

interface SubscribeOptions {
  notifyHoursBefore?: number
  autoCreateDraft?: boolean
}

/** Row shape returned by `select('*')` on the `community_events` table */
export interface DbCommunityEvent {
  id: string
  name: string
  description: string | null
  platform: 'twitter' | 'linkedin' | 'reddit'
  target: string | null
  recurrence_rule: string
  recurrence_timezone: string
  suggested_post_type: string | null
  tags: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

/** Row shape returned by `select('*, community_events(*)')` on subscriptions */
export interface DbEventSubscription {
  id: string
  user_id: string
  event_id: string
  notify_hours_before: number
  auto_create_draft: boolean
  created_at: string
  community_events?: DbCommunityEvent | null
}

// ---------------------------------------------------------------------------
// Transforms
// ---------------------------------------------------------------------------

export function transformEventFromDb(row: DbCommunityEvent): CommunityEvent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    platform: row.platform,
    target: row.target,
    recurrenceRule: row.recurrence_rule,
    recurrenceTimezone: row.recurrence_timezone,
    suggestedPostType: row.suggested_post_type,
    tags: row.tags ?? [],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function transformSubscriptionFromDb(row: DbEventSubscription): EventSubscription {
  const sub: EventSubscription = {
    id: row.id,
    eventId: row.event_id,
    notifyHoursBefore: row.notify_hours_before,
    autoCreateDraft: row.auto_create_draft,
    createdAt: row.created_at,
  }
  if (row.community_events) {
    sub.event = transformEventFromDb(row.community_events)
  }
  return sub
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const API_BASE = '/api'

interface CommunityEventsState {
  events: CommunityEvent[]
  subscriptions: EventSubscription[]
  loading: boolean
  error: string | null
  initialized: boolean
}

interface CommunityEventsActions {
  fetchEvents: () => Promise<void>
  fetchSubscriptions: () => Promise<void>
  subscribe: (eventId: string, options?: SubscribeOptions) => Promise<EventSubscription>
  unsubscribe: (subscriptionId: string) => Promise<void>
}

export const useCommunityEventsStore = create<CommunityEventsState & CommunityEventsActions>()(
  (set) => ({
    events: [],
    subscriptions: [],
    loading: false,
    error: null,
    initialized: false,

    fetchEvents: async () => {
      const key = createDedupKey('communityEvents')

      return dedup(key, async () => {
        set({ loading: true, error: null })
        try {
          const res = await fetch(`${API_BASE}/community-events`)
          if (!res.ok) throw new Error('Failed to fetch community events')
          const data = await res.json()
          set({ events: data.events || [], loading: false, initialized: true })
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
        }
      })
    },

    fetchSubscriptions: async () => {
      const key = createDedupKey('eventSubscriptions')

      return dedup(key, async () => {
        set({ loading: true, error: null })
        try {
          const res = await fetch(`${API_BASE}/community-events/subscriptions`)
          if (!res.ok) throw new Error('Failed to fetch subscriptions')
          const data = await res.json()
          set({ subscriptions: data.subscriptions || [], loading: false, initialized: true })
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
        }
      })
    },

    subscribe: async (eventId, options) => {
      set({ loading: true, error: null })
      try {
        const res = await fetch(`${API_BASE}/community-events/subscriptions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId,
            notifyHoursBefore: options?.notifyHoursBefore,
            autoCreateDraft: options?.autoCreateDraft,
          }),
        })
        if (res.status === 409) {
          throw new Error('Already subscribed to this event')
        }
        if (!res.ok) throw new Error('Failed to subscribe')
        const data = await res.json()
        const newSub = data.subscription as EventSubscription
        set((state) => ({
          subscriptions: [newSub, ...state.subscriptions],
          loading: false,
        }))
        return newSub
      } catch (error) {
        set({ error: (error as Error).message, loading: false })
        throw error
      }
    },

    unsubscribe: async (subscriptionId) => {
      set({ loading: true, error: null })
      try {
        const res = await fetch(`${API_BASE}/community-events/subscriptions/${subscriptionId}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('Failed to unsubscribe')
        set((state) => ({
          subscriptions: state.subscriptions.filter((s) => s.id !== subscriptionId),
          loading: false,
        }))
      } catch (error) {
        set({ error: (error as Error).message, loading: false })
        throw error
      }
    },
  })
)
