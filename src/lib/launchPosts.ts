import { create } from 'zustand'
import { dedup } from './requestDedup'
import { usePlanStore } from './planStore'

// Re-export types and constants from the types module
export type {
  LaunchPlatform,
  LaunchPostStatus,
  PlatformFields,
  LaunchPost,
} from './launchPostTypes'
export {
  LAUNCH_CHAR_LIMITS,
  LAUNCH_PLATFORM_INFO,
  LAUNCH_PLATFORM_URLS,
  getDefaultPlatformFields,
  getHackerNewsFields,
  getProductHuntFields,
  getDevHuntFields,
  getBetaListFields,
  getIndieHackersFields,
} from './launchPostTypes'

import type { LaunchPlatform, LaunchPost, PlatformFields } from './launchPostTypes'

const API_BASE = '/api'

function transformLaunchPostFromDb(data: Record<string, unknown>): LaunchPost {
  return {
    id: data.id as string,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    platform: data.platform as LaunchPlatform,
    status: data.status as 'draft' | 'scheduled' | 'posted',
    scheduledAt: data.scheduled_at as string | null,
    postedAt: data.posted_at as string | null,
    title: data.title as string,
    url: data.url as string | null,
    description: data.description as string | null,
    platformFields: (data.platform_fields || {}) as PlatformFields,
    campaignId: data.campaign_id as string | null,
    notes: data.notes as string | null,
  }
}

interface LaunchPostsState {
  launchPosts: LaunchPost[]
  loading: boolean
  error: string | null
  initialized: boolean
}

interface LaunchPostsActions {
  fetchLaunchPosts: (options?: { campaignId?: string; platform?: LaunchPlatform }) => Promise<void>
  addLaunchPost: (post: {
    platform: LaunchPlatform
    title: string
    url?: string
    description?: string
    platformFields?: PlatformFields
    campaignId?: string
    scheduledAt?: string
    notes?: string
  }) => Promise<LaunchPost>
  updateLaunchPost: (id: string, updates: Partial<LaunchPost>) => Promise<void>
  deleteLaunchPost: (id: string) => Promise<void>
  getLaunchPost: (id: string) => LaunchPost | undefined
  getLaunchPostsByPlatform: (platform?: LaunchPlatform) => LaunchPost[]
  getLaunchPostsByCampaign: (campaignId: string | null) => LaunchPost[]
  getLaunchPostsByStatus: (status?: 'draft' | 'scheduled' | 'posted') => LaunchPost[]
}

type LaunchSetFn = (
  partial: Partial<LaunchPostsState> | ((s: LaunchPostsState) => Partial<LaunchPostsState>)
) => void
type LaunchGetFn = () => LaunchPostsState & LaunchPostsActions

async function fetchLaunchPostsAction(
  options: { campaignId?: string; platform?: LaunchPlatform } | undefined,
  set: LaunchSetFn
) {
  const key = `launchPosts-${options?.campaignId || 'all'}-${options?.platform || 'all'}`
  return dedup(key, async () => {
    set({ loading: true, error: null })
    try {
      const params = new URLSearchParams()
      if (options?.campaignId) params.set('campaignId', options.campaignId)
      if (options?.platform) params.set('platform', options.platform)
      const qs = params.toString()
      const url = qs ? `${API_BASE}/launch-posts?${qs}` : `${API_BASE}/launch-posts`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch launch posts')
      const data = await res.json()
      set({
        launchPosts: (data.launchPosts || []).map(transformLaunchPostFromDb),
        loading: false,
        initialized: true,
      })
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
    }
  })
}

function buildTempLaunchPost(
  postData: Parameters<LaunchPostsActions['addLaunchPost']>[0]
): LaunchPost {
  return {
    id: 'temp-' + Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    platform: postData.platform,
    status: 'draft',
    scheduledAt: postData.scheduledAt || null,
    postedAt: null,
    title: postData.title,
    url: postData.url || null,
    description: postData.description || null,
    platformFields: postData.platformFields || {},
    campaignId: postData.campaignId || null,
    notes: postData.notes || null,
  }
}

async function addLaunchPostAction(
  postData: Parameters<LaunchPostsActions['addLaunchPost']>[0],
  set: LaunchSetFn,
  get: LaunchGetFn
): Promise<LaunchPost> {
  const previous = get().launchPosts
  set({ launchPosts: [buildTempLaunchPost(postData), ...previous], loading: true, error: null })
  try {
    const res = await fetch(`${API_BASE}/launch-posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postData),
    })
    if (!res.ok) throw new Error('Failed to create launch post')
    const data = await res.json()
    const newPost = transformLaunchPostFromDb(data.launchPost)
    set({ launchPosts: [newPost, ...previous], loading: false })
    usePlanStore.getState().incrementCount('launchPosts')
    return newPost
  } catch (error) {
    set({ launchPosts: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function updateLaunchPostAction(
  id: string,
  updates: Partial<LaunchPost>,
  set: LaunchSetFn,
  get: LaunchGetFn
) {
  const previous = get().launchPosts
  set({
    launchPosts: previous.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    loading: true,
    error: null,
  })
  try {
    const res = await fetch(`${API_BASE}/launch-posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Failed to update launch post')
    const data = await res.json()
    const updatedPost = transformLaunchPostFromDb(data.launchPost)
    set({ launchPosts: previous.map((p) => (p.id === id ? updatedPost : p)), loading: false })
  } catch (error) {
    set({ launchPosts: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function deleteLaunchPostAction(id: string, set: LaunchSetFn, get: LaunchGetFn) {
  const previous = get().launchPosts
  set({ launchPosts: previous.filter((p) => p.id !== id), loading: true, error: null })
  try {
    const res = await fetch(`${API_BASE}/launch-posts/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete launch post')
    set({ loading: false })
    usePlanStore.getState().decrementCount('launchPosts')
  } catch (error) {
    set({ launchPosts: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

export const useLaunchPostsStore = create<LaunchPostsState & LaunchPostsActions>()((set, get) => ({
  launchPosts: [],
  loading: false,
  error: null,
  initialized: false,

  fetchLaunchPosts: (options) => fetchLaunchPostsAction(options, set),
  addLaunchPost: (data) => addLaunchPostAction(data, set, get),
  updateLaunchPost: (id, updates) => updateLaunchPostAction(id, updates, set, get),
  deleteLaunchPost: (id) => deleteLaunchPostAction(id, set, get),
  getLaunchPost: (id) => get().launchPosts.find((p) => p.id === id),

  getLaunchPostsByPlatform: (platform) => {
    if (!platform) return get().launchPosts
    return get().launchPosts.filter((p) => p.platform === platform)
  },

  getLaunchPostsByCampaign: (campaignId) => {
    if (campaignId === null) return get().launchPosts.filter((p) => !p.campaignId)
    return get().launchPosts.filter((p) => p.campaignId === campaignId)
  },

  getLaunchPostsByStatus: (status) => {
    if (!status) return get().launchPosts
    return get().launchPosts.filter((p) => p.status === status)
  },
}))

// Selector hooks for common queries
export const useLaunchPosts = () => useLaunchPostsStore((state) => state.launchPosts)
export const useLaunchPostsLoading = () => useLaunchPostsStore((state) => state.loading)
export const useLaunchPostsError = () => useLaunchPostsStore((state) => state.error)
export const useLaunchPostsInitialized = () => useLaunchPostsStore((state) => state.initialized)
