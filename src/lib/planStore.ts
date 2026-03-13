import { create } from 'zustand'
import { dedup } from './requestDedup'
import { type PlanType, PLAN_LIMITS } from './limits'
import { type GenericResource } from './planEnforcement'

interface LimitInfo {
  current: number
  limit: number
}

/** Resources tracked in the plan store (generic + apiKeys) */
type TrackedResource = GenericResource | 'apiKeys'

interface PlanState {
  plan: PlanType
  limits: Record<TrackedResource, LimitInfo>
  storage: { usedBytes: number; limitBytes: number }
  loading: boolean
  error: string | null
  initialized: boolean
}

interface PlanActions {
  fetchPlan: () => Promise<void>
  isAtLimit: (resource: TrackedResource) => boolean
  isNearAnyLimit: () => { resource: string; current: number; limit: number } | null
  incrementCount: (resource: TrackedResource) => void
  decrementCount: (resource: TrackedResource) => void
  reset: () => void
}

const defaultLimits: PlanState['limits'] = {
  posts: { current: 0, limit: PLAN_LIMITS.free.posts },
  campaigns: { current: 0, limit: PLAN_LIMITS.free.campaigns },
  projects: { current: 0, limit: PLAN_LIMITS.free.projects },
  blogDrafts: { current: 0, limit: PLAN_LIMITS.free.blogDrafts },
  launchPosts: { current: 0, limit: PLAN_LIMITS.free.launchPosts },
  apiKeys: { current: 0, limit: PLAN_LIMITS.free.apiKeys },
}

const initialState: PlanState = {
  plan: 'free',
  limits: defaultLimits,
  storage: { usedBytes: 0, limitBytes: PLAN_LIMITS.free.storageBytes },
  loading: false,
  error: null,
  initialized: false,
}

export const usePlanStore = create<PlanState & PlanActions>()((set, get) => ({
  ...initialState,

  fetchPlan: async () => {
    return dedup('fetchPlan', async () => {
      set({ loading: true, error: null })
      try {
        const res = await fetch('/api/plan')
        if (!res.ok) throw new Error('Failed to fetch plan')
        const data = await res.json()
        set({
          plan: data.plan,
          limits: data.limits,
          storage: data.storage,
          loading: false,
          initialized: true,
        })
      } catch (error) {
        set({ error: (error as Error).message, loading: false })
      }
    })
  },

  isAtLimit: (resource) => {
    const info = get().limits[resource]
    return info.current >= info.limit
  },

  isNearAnyLimit: () => {
    const state = get()
    const resources = Object.entries(state.limits) as [string, LimitInfo][]
    for (const [resource, info] of resources) {
      if (info.limit > 0 && info.current / info.limit >= 0.8) {
        return { resource, current: info.current, limit: info.limit }
      }
    }
    return null
  },

  incrementCount: (resource) => {
    set((state) => ({
      limits: {
        ...state.limits,
        [resource]: {
          ...state.limits[resource],
          current: state.limits[resource].current + 1,
        },
      },
    }))
  },

  decrementCount: (resource) => {
    set((state) => ({
      limits: {
        ...state.limits,
        [resource]: {
          ...state.limits[resource],
          current: Math.max(0, state.limits[resource].current - 1),
        },
      },
    }))
  },

  reset: () => set(initialState),
}))
