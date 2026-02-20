import { create } from 'zustand'
import { Post, PostStatus } from './posts'
import { dedup, createDedupKey } from './requestDedup'
import { hapticSuccess } from './haptics'
import { usePlanStore } from './planStore'

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
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData),
      })
      if (!res.ok) throw new Error('Failed to create post')
      const data = await res.json()
      const newPost = data.post as Post
      set((state) => ({
        posts: [newPost, ...state.posts],
        loading: false,
      }))
      hapticSuccess()
      usePlanStore.getState().incrementCount('posts')
      return newPost
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  updatePost: async (id, updates) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update post')
      const data = await res.json()
      const updatedPost = data.post as Post
      set((state) => ({
        posts: state.posts.map((p) => (p.id === id ? updatedPost : p)),
        loading: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  deletePost: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/posts/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete post')
      set((state) => ({
        posts: state.posts.filter((p) => p.id !== id),
        loading: false,
      }))
      usePlanStore.getState().decrementCount('posts')
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
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
