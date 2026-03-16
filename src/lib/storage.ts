import { create } from 'zustand'
import { Post, PostStatus } from './posts'
import { dedup, createDedupKey } from './requestDedup'
import { hapticSuccess } from './haptics'
import { usePlanStore } from './planStore'
import { captureEvent } from './posthog'

// API URL - use relative path for Next.js API routes
const API_BASE = '/api'

interface PostsState {
  posts: Post[]
  loading: boolean
  error: string | null
  initialized: boolean
}

interface PostsActions {
  fetchPosts: () => Promise<void>
  addPost: (post: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Post>
  updatePost: (id: string, updates: Partial<Post>) => Promise<void>
  deletePost: (id: string) => Promise<void>
  archivePost: (id: string) => Promise<void>
  restorePost: (id: string) => Promise<void>
  getPost: (id: string) => Post | undefined
  getPostsByStatus: (status?: PostStatus) => Post[]
}

// eslint-disable-next-line max-lines-per-function
export const usePostsStore = create<PostsState & PostsActions>()((set, get) => ({
  posts: [],
  loading: false,
  error: null,
  initialized: false,

  fetchPosts: async () => {
    const key = createDedupKey('fetchPosts')
    return dedup(key, async () => {
      set({ loading: true, error: null })
      try {
        const res = await fetch(`${API_BASE}/posts`)
        if (!res.ok) throw new Error('Failed to fetch posts')
        const data = await res.json()
        set({ posts: data.posts || [], loading: false, initialized: true })
      } catch (error) {
        set({ error: (error as Error).message, loading: false })
      }
    })
  },

  addPost: async (postData) => {
    const previous = get().posts
    const tempPost = {
      ...postData,
      id: 'temp-' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Post
    set({ posts: [tempPost, ...previous], loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      })
      if (!res.ok) throw new Error('Failed to create post')
      const data = await res.json()
      const newPost = data.post as Post
      set({ posts: [newPost, ...previous], loading: false })
      hapticSuccess()
      captureEvent('post_created', { postId: newPost.id })
      usePlanStore.getState().incrementCount('posts')
      return newPost
    } catch (error) {
      set({ posts: previous, error: (error as Error).message, loading: false })
      throw error
    }
  },

  updatePost: async (id, updates) => {
    const previous = get().posts
    set({
      posts: previous.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      loading: true,
      error: null,
    })
    try {
      const res = await fetch(`${API_BASE}/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update post')
      const data = await res.json()
      const updatedPost = data.post as Post
      set({
        posts: previous.map((p) => (p.id === id ? updatedPost : p)),
        loading: false,
      })
      if (updates.status === 'scheduled') {
        captureEvent('post_scheduled', { postId: id })
      }
    } catch (error) {
      set({ posts: previous, error: (error as Error).message, loading: false })
      throw error
    }
  },

  deletePost: async (id) => {
    const previous = get().posts
    set({
      posts: previous.filter((p) => p.id !== id),
      loading: true,
      error: null,
    })
    try {
      const res = await fetch(`${API_BASE}/posts/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete post')
      set({ loading: false })
      usePlanStore.getState().decrementCount('posts')
    } catch (error) {
      set({ posts: previous, error: (error as Error).message, loading: false })
      throw error
    }
  },

  archivePost: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/posts/${id}/archive`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to archive post')
      const data = await res.json()
      const archivedPost = data.post as Post
      set((state) => ({
        posts: state.posts.map((p) => (p.id === id ? archivedPost : p)),
        loading: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  restorePost: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/posts/${id}/restore`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to restore post')
      const data = await res.json()
      const restoredPost = data.post as Post
      set((state) => ({
        posts: state.posts.map((p) => (p.id === id ? restoredPost : p)),
        loading: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  getPost: (id) => get().posts.find((p) => p.id === id),

  getPostsByStatus: (status) => {
    const posts = get().posts
    if (!status) return posts
    return posts.filter((p) => p.status === status)
  },
}))
