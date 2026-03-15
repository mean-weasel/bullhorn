import { create } from 'zustand'
import { Campaign, CampaignStatus, Post } from './posts'
import { dedup, createDedupKey } from './requestDedup'
import { hapticSuccess } from './haptics'
import { usePlanStore } from './planStore'

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

type CampaignsSetFn = (
  partial: Partial<CampaignsState> | ((s: CampaignsState) => Partial<CampaignsState>)
) => void
type CampaignsGetFn = () => CampaignsState & CampaignsActions

async function fetchCampaignsAction(
  options: { projectId?: string | 'unassigned' } | undefined,
  set: CampaignsSetFn
) {
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
}

async function addCampaignAction(
  campaignData: { name: string; description?: string; status?: CampaignStatus; projectId?: string },
  set: CampaignsSetFn,
  get: CampaignsGetFn
): Promise<Campaign> {
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
    usePlanStore.getState().incrementCount('campaigns')
    return newCampaign
  } catch (error) {
    set({ campaigns: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function updateCampaignAction(
  id: string,
  updates: Partial<Campaign>,
  set: CampaignsSetFn,
  get: CampaignsGetFn
) {
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
    set({ campaigns: previous.map((c) => (c.id === id ? updatedCampaign : c)), loading: false })
  } catch (error) {
    set({ campaigns: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function deleteCampaignAction(id: string, set: CampaignsSetFn, get: CampaignsGetFn) {
  const previous = get().campaigns
  set({ campaigns: previous.filter((c) => c.id !== id), loading: true, error: null })
  try {
    const res = await fetch(`${API_BASE}/campaigns/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete campaign')
    set({ loading: false })
    usePlanStore.getState().decrementCount('campaigns')
  } catch (error) {
    set({ campaigns: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function moveCampaignAction(
  campaignId: string,
  projectId: string | null,
  set: CampaignsSetFn,
  get: CampaignsGetFn
) {
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
    const updated = data.campaign as Campaign
    set({ campaigns: previous.map((c) => (c.id === campaignId ? updated : c)), loading: false })
  } catch (error) {
    set({ campaigns: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function addPostToCampaignAction(campaignId: string, postId: string, set: CampaignsSetFn) {
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
}

async function removePostFromCampaignAction(
  campaignId: string,
  postId: string,
  set: CampaignsSetFn
) {
  try {
    const res = await fetch(`${API_BASE}/campaigns/${campaignId}/posts/${postId}`, {
      method: 'DELETE',
    })
    if (!res.ok) throw new Error('Failed to remove post from campaign')
  } catch (error) {
    set({ error: (error as Error).message })
    throw error
  }
}

export const useCampaignsStore = create<CampaignsState & CampaignsActions>()((set, get) => ({
  campaigns: [],
  loading: false,
  error: null,
  initialized: false,

  fetchCampaigns: (options) => fetchCampaignsAction(options, set),
  addCampaign: (data) => addCampaignAction(data, set, get),
  updateCampaign: (id, updates) => updateCampaignAction(id, updates, set, get),
  deleteCampaign: (id) => deleteCampaignAction(id, set, get),
  getCampaign: (id) => get().campaigns.find((c) => c.id === id),
  getCampaignsByStatus: (status) => {
    if (!status) return get().campaigns
    return get().campaigns.filter((c) => c.status === status)
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
  addPostToCampaign: (campaignId, postId) => addPostToCampaignAction(campaignId, postId, set),
  removePostFromCampaign: (cid, pid) => removePostFromCampaignAction(cid, pid, set),
  getCampaignsByProject: (projectId) => {
    if (projectId === null) return get().campaigns.filter((c) => !c.projectId)
    return get().campaigns.filter((c) => c.projectId === projectId)
  },
  moveCampaignToProject: (cid, pid) => moveCampaignAction(cid, pid, set, get),
}))
