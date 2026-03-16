import { create } from 'zustand'
import { Campaign, CampaignStatus, Post } from './posts'
import { dedup, createDedupKey } from './requestDedup'
import { hapticSuccess } from './haptics'
import { usePlanStore } from './planStore'
import { captureEvent } from './posthog'

// API URL - use relative path for Next.js API routes
const API_BASE = '/api'

interface CampaignsState {
  campaigns: Campaign[]
  loading: boolean
  error: string | null
  initialized: boolean
}

interface CampaignsActions {
  fetchCampaigns: (options?: { projectId?: string | 'unassigned' }) => Promise<void>
  addCampaign: (campaign: {
    name: string
    description?: string
    status?: CampaignStatus
    projectId?: string
  }) => Promise<Campaign>
  updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>
  deleteCampaign: (id: string) => Promise<void>
  getCampaign: (id: string) => Campaign | undefined
  getCampaignsByStatus: (status?: CampaignStatus) => Campaign[]
  getCampaignsByProject: (projectId: string | null) => Campaign[]
  getCampaignWithPosts: (id: string) => Promise<{ campaign: Campaign; posts: Post[] } | undefined>
  addPostToCampaign: (campaignId: string, postId: string) => Promise<void>
  removePostFromCampaign: (campaignId: string, postId: string) => Promise<void>
  moveCampaignToProject: (campaignId: string, projectId: string | null) => Promise<void>
}

// eslint-disable-next-line max-lines-per-function
export const useCampaignsStore = create<CampaignsState & CampaignsActions>()((set, get) => ({
  campaigns: [],
  loading: false,
  error: null,
  initialized: false,

  fetchCampaigns: async (options) => {
    const key = createDedupKey('campaigns', { projectId: options?.projectId })

    return dedup(key, async () => {
      set({ loading: true, error: null })
      try {
        let url = `${API_BASE}/campaigns`
        if (options?.projectId) {
          url += `?projectId=${encodeURIComponent(options.projectId)}`
        }
        const res = await fetch(url)
        if (!res.ok) throw new Error('Failed to fetch campaigns')
        const data = await res.json()
        set({ campaigns: data.campaigns || [], loading: false, initialized: true })
      } catch (error) {
        set({ error: (error as Error).message, loading: false })
      }
    })
  },

  addCampaign: async (campaignData) => {
    const previous = get().campaigns
    const tempCampaign: Campaign = {
      id: 'temp-' + Date.now(),
      name: campaignData.name,
      description: campaignData.description,
      status: campaignData.status || 'active',
      projectId: campaignData.projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set({ campaigns: [tempCampaign, ...previous], loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData),
      })
      if (!res.ok) throw new Error('Failed to create campaign')
      const data = await res.json()
      const newCampaign = data.campaign as Campaign
      set({ campaigns: [newCampaign, ...previous], loading: false })
      hapticSuccess()
      captureEvent('campaign_created', { campaignId: newCampaign.id })
      usePlanStore.getState().incrementCount('campaigns')
      return newCampaign
    } catch (error) {
      set({ campaigns: previous, error: (error as Error).message, loading: false })
      throw error
    }
  },

  updateCampaign: async (id, updates) => {
    const previous = get().campaigns
    set({
      campaigns: previous.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      loading: true,
      error: null,
    })
    try {
      const res = await fetch(`${API_BASE}/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update campaign')
      const data = await res.json()
      const updatedCampaign = data.campaign as Campaign
      set({
        campaigns: previous.map((c) => (c.id === id ? updatedCampaign : c)),
        loading: false,
      })
    } catch (error) {
      set({ campaigns: previous, error: (error as Error).message, loading: false })
      throw error
    }
  },

  deleteCampaign: async (id) => {
    const previous = get().campaigns
    set({
      campaigns: previous.filter((c) => c.id !== id),
      loading: true,
      error: null,
    })
    try {
      const res = await fetch(`${API_BASE}/campaigns/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete campaign')
      set({ loading: false })
      usePlanStore.getState().decrementCount('campaigns')
    } catch (error) {
      set({ campaigns: previous, error: (error as Error).message, loading: false })
      throw error
    }
  },

  getCampaign: (id) => get().campaigns.find((c) => c.id === id),

  getCampaignsByStatus: (status) => {
    const campaigns = get().campaigns
    if (!status) return campaigns
    return campaigns.filter((c) => c.status === status)
  },

  getCampaignWithPosts: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${id}`)
      if (!res.ok) return undefined
      const data = await res.json()
      return { campaign: data.campaign as Campaign, posts: data.posts as Post[] }
    } catch {
      return undefined
    }
  },

  addPostToCampaign: async (campaignId, postId) => {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${campaignId}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      if (!res.ok) throw new Error('Failed to add post to campaign')
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  removePostFromCampaign: async (campaignId, postId) => {
    try {
      const res = await fetch(`${API_BASE}/campaigns/${campaignId}/posts/${postId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to remove post from campaign')
    } catch (error) {
      set({ error: (error as Error).message })
      throw error
    }
  },

  getCampaignsByProject: (projectId) => {
    const campaigns = get().campaigns
    if (projectId === null) {
      // Return campaigns without a project (unassigned)
      return campaigns.filter((c) => !c.projectId)
    }
    return campaigns.filter((c) => c.projectId === projectId)
  },

  moveCampaignToProject: async (campaignId, projectId) => {
    const previous = get().campaigns
    set({
      campaigns: previous.map((c) =>
        c.id === campaignId ? { ...c, projectId: projectId ?? undefined } : c
      ),
      loading: true,
      error: null,
    })
    try {
      const res = await fetch(`${API_BASE}/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (!res.ok) throw new Error('Failed to move campaign to project')
      const data = await res.json()
      const updatedCampaign = data.campaign as Campaign
      set({
        campaigns: previous.map((c) => (c.id === campaignId ? updatedCampaign : c)),
        loading: false,
      })
    } catch (error) {
      set({ campaigns: previous, error: (error as Error).message, loading: false })
      throw error
    }
  },
}))
