import { create } from 'zustand'
import { dedup } from './requestDedup'
import { usePlanStore } from './planStore'

// API URL - use relative path for Next.js API routes
const API_BASE = '/api'

// Launch platform types
export type LaunchPlatform =
  | 'hacker_news_show'
  | 'hacker_news_ask'
  | 'hacker_news_link'
  | 'product_hunt'
  | 'dev_hunt'
  | 'beta_list'
  | 'indie_hackers'

export type LaunchPostStatus = 'draft' | 'scheduled' | 'posted'

// Platform-specific field interfaces (internal - exported when forms are built)
interface HackerNewsFields {
  // For Ask HN - the question body text
  text?: string
}

interface ProductHuntFields {
  tagline?: string // 60 char max
  thumbnail?: string // 240x240 image URL
  gallery?: string[] // Image URLs
  pricing?: 'free' | 'paid' | 'freemium'
  productStatus?: 'available' | 'beta' | 'coming_soon'
  makers?: string[] // PH usernames
  twitterHandle?: string
  promoCode?: string
  promoDescription?: string
  promoExpiry?: string // ISO date
  firstComment?: string // Critical maker comment
  interactiveDemo?: string // Demo URL
  appStoreUrl?: string
  playStoreUrl?: string
}

interface DevHuntFields {
  logo?: string
  screenshots?: string[]
  githubUrl?: string
  category?: string
  founderStory?: string
}

interface BetaListFields {
  oneSentencePitch?: string // ~140 chars, used on Twitter
  logo?: string
  screenshots?: string[]
  category?: string
}

interface IndieHackersFields {
  shortDescription?: string
  longDescription?: string
  revenue?: string
  affiliateUrl?: string
}

// Union type for platform-specific fields
export type PlatformFields =
  | HackerNewsFields
  | ProductHuntFields
  | DevHuntFields
  | BetaListFields
  | IndieHackersFields

// Main launch post interface
export interface LaunchPost {
  id: string
  createdAt: string
  updatedAt: string
  platform: LaunchPlatform
  status: LaunchPostStatus
  scheduledAt: string | null
  postedAt: string | null
  title: string
  url: string | null
  description: string | null
  platformFields: PlatformFields
  campaignId: string | null
  notes: string | null
}

// Character limits per platform
export const LAUNCH_CHAR_LIMITS: Partial<Record<LaunchPlatform, Record<string, number>>> = {
  hacker_news_show: { title: 80 },
  hacker_news_ask: { title: 80 },
  hacker_news_link: { title: 80 },
  product_hunt: { tagline: 60, description: 260 },
  beta_list: { oneSentencePitch: 140 },
}

// Platform display info
export const LAUNCH_PLATFORM_INFO: Record<
  LaunchPlatform,
  { name: string; label: string; color: string; bgColor: string; icon: string }
> = {
  hacker_news_show: {
    name: 'Show HN',
    label: 'Show HN',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: 'Y',
  },
  hacker_news_ask: {
    name: 'Ask HN',
    label: 'Ask HN',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: 'Y',
  },
  hacker_news_link: {
    name: 'Hacker News',
    label: 'HN Link',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: 'Y',
  },
  product_hunt: {
    name: 'Product Hunt',
    label: 'Product Hunt',
    color: 'text-[#DA552F]',
    bgColor: 'bg-orange-100',
    icon: 'P',
  },
  dev_hunt: {
    name: 'Dev Hunt',
    label: 'Dev Hunt',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    icon: 'D',
  },
  beta_list: {
    name: 'BetaList',
    label: 'BetaList',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: 'B',
  },
  indie_hackers: {
    name: 'Indie Hackers',
    label: 'Indie Hackers',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    icon: 'IH',
  },
}

// Platform submission URLs
export const LAUNCH_PLATFORM_URLS: Record<LaunchPlatform, string> = {
  hacker_news_show: 'https://news.ycombinator.com/submit',
  hacker_news_ask: 'https://news.ycombinator.com/submit',
  hacker_news_link: 'https://news.ycombinator.com/submit',
  product_hunt: 'https://www.producthunt.com/posts/new',
  dev_hunt: 'https://devhunt.org',
  beta_list: 'https://betalist.com/submit',
  indie_hackers: 'https://www.indiehackers.com/products',
}

// Transform from snake_case DB response to camelCase
function transformLaunchPostFromDb(data: Record<string, unknown>): LaunchPost {
  return {
    id: data.id as string,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    platform: data.platform as LaunchPlatform,
    status: data.status as LaunchPostStatus,
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

// Zustand store
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
  getLaunchPostsByStatus: (status?: LaunchPostStatus) => LaunchPost[]
}

export const useLaunchPostsStore = create<LaunchPostsState & LaunchPostsActions>()((set, get) => ({
  launchPosts: [],
  loading: false,
  error: null,
  initialized: false,

  fetchLaunchPosts: async (options) => {
    const key = `launchPosts-${options?.campaignId || 'all'}-${options?.platform || 'all'}`

    return dedup(key, async () => {
      set({ loading: true, error: null })
      try {
        const params = new URLSearchParams()
        if (options?.campaignId) params.set('campaignId', options.campaignId)
        if (options?.platform) params.set('platform', options.platform)

        const url = params.toString()
          ? `${API_BASE}/launch-posts?${params}`
          : `${API_BASE}/launch-posts`

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
  },

  addLaunchPost: async (postData) => {
    const previous = get().launchPosts
    const tempPost: LaunchPost = {
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
    set({ launchPosts: [tempPost, ...previous], loading: true, error: null })
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
  },

  updateLaunchPost: async (id, updates) => {
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
      set({
        launchPosts: previous.map((p) => (p.id === id ? updatedPost : p)),
        loading: false,
      })
    } catch (error) {
      set({ launchPosts: previous, error: (error as Error).message, loading: false })
      throw error
    }
  },

  deleteLaunchPost: async (id) => {
    const previous = get().launchPosts
    set({
      launchPosts: previous.filter((p) => p.id !== id),
      loading: true,
      error: null,
    })
    try {
      const res = await fetch(`${API_BASE}/launch-posts/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete launch post')
      set({ loading: false })
      usePlanStore.getState().decrementCount('launchPosts')
    } catch (error) {
      set({ launchPosts: previous, error: (error as Error).message, loading: false })
      throw error
    }
  },

  getLaunchPost: (id) => get().launchPosts.find((p) => p.id === id),

  getLaunchPostsByPlatform: (platform) => {
    const posts = get().launchPosts
    if (!platform) return posts
    return posts.filter((p) => p.platform === platform)
  },

  getLaunchPostsByCampaign: (campaignId) => {
    const posts = get().launchPosts
    if (campaignId === null) {
      return posts.filter((p) => !p.campaignId)
    }
    return posts.filter((p) => p.campaignId === campaignId)
  },

  getLaunchPostsByStatus: (status) => {
    const posts = get().launchPosts
    if (!status) return posts
    return posts.filter((p) => p.status === status)
  },
}))

// Selector hooks for common queries
export const useLaunchPosts = () => useLaunchPostsStore((state) => state.launchPosts)
export const useLaunchPostsLoading = () => useLaunchPostsStore((state) => state.loading)
export const useLaunchPostsError = () => useLaunchPostsStore((state) => state.error)
export const useLaunchPostsInitialized = () => useLaunchPostsStore((state) => state.initialized)

// Helper to get platform-specific fields with proper typing
export function getHackerNewsFields(post: LaunchPost): HackerNewsFields {
  return (post.platformFields || {}) as HackerNewsFields
}

export function getProductHuntFields(post: LaunchPost): ProductHuntFields {
  return (post.platformFields || {}) as ProductHuntFields
}

export function getDevHuntFields(post: LaunchPost): DevHuntFields {
  return (post.platformFields || {}) as DevHuntFields
}

export function getBetaListFields(post: LaunchPost): BetaListFields {
  return (post.platformFields || {}) as BetaListFields
}

export function getIndieHackersFields(post: LaunchPost): IndieHackersFields {
  return (post.platformFields || {}) as IndieHackersFields
}

// Helper to create default platform fields
export function getDefaultPlatformFields(platform: LaunchPlatform): PlatformFields {
  switch (platform) {
    case 'hacker_news_show':
    case 'hacker_news_ask':
    case 'hacker_news_link':
      return {}
    case 'product_hunt':
      return { pricing: 'free', productStatus: 'available' }
    case 'dev_hunt':
      return {}
    case 'beta_list':
      return {}
    case 'indie_hackers':
      return {}
  }
}
