import { create } from 'zustand'
import { dedup } from './requestDedup'
import { hapticSuccess } from './haptics'
import { usePlanStore } from './planStore'

// API URL - use relative path for Next.js API routes
const API_BASE = '/api'

// Types
export type BlogDraftStatus = 'draft' | 'scheduled' | 'published' | 'archived'

type BlogDraftTag = 'Blog Post' | 'Twitter Article'

export const BLOG_DRAFT_TAGS: BlogDraftTag[] = ['Blog Post', 'Twitter Article']

export interface BlogDraft {
  id: string
  createdAt: string
  updatedAt: string
  scheduledAt: string | null
  status: BlogDraftStatus
  title: string
  date: string | null
  content: string
  notes?: string
  wordCount: number
  campaignId?: string
  images: string[]
  tags: string[]
}

interface BlogDraftsState {
  drafts: BlogDraft[]
  loading: boolean
  error: string | null
  initialized: boolean
}

interface BlogDraftsActions {
  fetchDrafts: () => Promise<void>
  addDraft: (
    draft: Omit<BlogDraft, 'id' | 'createdAt' | 'updatedAt' | 'wordCount' | 'images' | 'tags'> & {
      tags?: string[]
    }
  ) => Promise<BlogDraft>
  updateDraft: (id: string, updates: Partial<BlogDraft>) => Promise<void>
  deleteDraft: (id: string) => Promise<void>
  archiveDraft: (id: string) => Promise<void>
  restoreDraft: (id: string) => Promise<void>
  getDraft: (id: string) => BlogDraft | undefined
  getDraftsByStatus: (status?: BlogDraftStatus) => BlogDraft[]
  searchDrafts: (query: string) => Promise<BlogDraft[]>
}

type DraftsSetFn = (
  partial: Partial<BlogDraftsState> | ((s: BlogDraftsState) => Partial<BlogDraftsState>)
) => void
type DraftsGetFn = () => BlogDraftsState & BlogDraftsActions

async function addDraftAction(
  draftData: Parameters<BlogDraftsActions['addDraft']>[0],
  set: DraftsSetFn,
  get: DraftsGetFn
): Promise<BlogDraft> {
  const previous = get().drafts
  const tempDraft: BlogDraft = {
    id: 'temp-' + Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scheduledAt: draftData.scheduledAt,
    status: draftData.status,
    title: draftData.title,
    date: draftData.date,
    content: draftData.content,
    notes: draftData.notes,
    wordCount: 0,
    campaignId: draftData.campaignId,
    images: [],
    tags: draftData.tags || [],
  }
  set({ drafts: [tempDraft, ...previous], loading: true, error: null })
  try {
    const res = await fetch(`${API_BASE}/blog-drafts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draftData),
    })
    if (!res.ok) throw new Error('Failed to create blog draft')
    const data = await res.json()
    const newDraft = data.draft as BlogDraft
    set({ drafts: [newDraft, ...previous], loading: false })
    hapticSuccess()
    usePlanStore.getState().incrementCount('blogDrafts')
    return newDraft
  } catch (error) {
    set({ drafts: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function updateDraftAction(
  id: string,
  updates: Partial<BlogDraft>,
  set: DraftsSetFn,
  get: DraftsGetFn
) {
  const previous = get().drafts
  set({
    drafts: previous.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    loading: true,
    error: null,
  })
  try {
    const res = await fetch(`${API_BASE}/blog-drafts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    if (!res.ok) throw new Error('Failed to update blog draft')
    const data = await res.json()
    set({
      drafts: previous.map((d) => (d.id === id ? (data.draft as BlogDraft) : d)),
      loading: false,
    })
  } catch (error) {
    set({ drafts: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function deleteDraftAction(id: string, set: DraftsSetFn, get: DraftsGetFn) {
  const previous = get().drafts
  set({ drafts: previous.filter((d) => d.id !== id), loading: true, error: null })
  try {
    const res = await fetch(`${API_BASE}/blog-drafts/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete blog draft')
    set({ loading: false })
    usePlanStore.getState().decrementCount('blogDrafts')
  } catch (error) {
    set({ drafts: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function draftStatusAction(id: string, action: 'archive' | 'restore', set: DraftsSetFn) {
  set({ loading: true, error: null })
  try {
    const res = await fetch(`${API_BASE}/blog-drafts/${id}/${action}`, { method: 'POST' })
    if (!res.ok) throw new Error(`Failed to ${action} blog draft`)
    const data = await res.json()
    const draft = data.draft as BlogDraft
    set((state) => ({
      drafts: state.drafts.map((d) => (d.id === id ? draft : d)),
      loading: false,
    }))
  } catch (error) {
    set({ error: (error as Error).message, loading: false })
    throw error
  }
}

export const useBlogDraftsStore = create<BlogDraftsState & BlogDraftsActions>()((set, get) => ({
  drafts: [],
  loading: false,
  error: null,
  initialized: false,

  fetchDrafts: async () => {
    return dedup('blogDrafts', async () => {
      set({ loading: true, error: null })
      try {
        const res = await fetch(`${API_BASE}/blog-drafts`)
        if (!res.ok) throw new Error('Failed to fetch blog drafts')
        const data = await res.json()
        set({ drafts: data.drafts || [], loading: false, initialized: true })
      } catch (error) {
        set({ error: (error as Error).message, loading: false })
      }
    })
  },

  addDraft: (data) => addDraftAction(data, set, get),
  updateDraft: (id, updates) => updateDraftAction(id, updates, set, get),
  deleteDraft: (id) => deleteDraftAction(id, set, get),
  archiveDraft: (id) => draftStatusAction(id, 'archive', set),
  restoreDraft: (id) => draftStatusAction(id, 'restore', set),
  getDraft: (id) => get().drafts.find((d) => d.id === id),

  getDraftsByStatus: (status) => {
    if (!status) return get().drafts
    return get().drafts.filter((d) => d.status === status)
  },

  searchDrafts: async (query) => {
    return dedup(`searchDrafts:${query}`, async () => {
      try {
        const res = await fetch(`${API_BASE}/blog-drafts/search?q=${encodeURIComponent(query)}`)
        if (!res.ok) throw new Error('Failed to search blog drafts')
        const data = await res.json()
        return data.drafts || []
      } catch (error) {
        console.error('Search error:', error)
        return []
      }
    })
  },
}))
