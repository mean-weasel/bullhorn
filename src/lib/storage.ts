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

type PostsSetFn = (partial: Partial<PostsState> | ((s: PostsState) => Partial<PostsState>)) => void
type PostsGetFn = () => PostsState & PostsActions

async function addPostAction(
  postData: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>,
  set: PostsSetFn,
  get: PostsGetFn
): Promise<Post> {
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
    usePlanStore.getState().incrementCount('posts')
    return newPost
  } catch (error) {
    set({ posts: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function updatePostAction(
  id: string,
  updates: Partial<Post>,
  set: PostsSetFn,
  get: PostsGetFn
) {
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
    set({ posts: previous.map((p) => (p.id === id ? (data.post as Post) : p)), loading: false })
  } catch (error) {
    set({ posts: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function deletePostAction(id: string, set: PostsSetFn, get: PostsGetFn) {
  const previous = get().posts
  set({ posts: previous.filter((p) => p.id !== id), loading: true, error: null })
  try {
    const res = await fetch(`${API_BASE}/posts/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Failed to delete post')
    set({ loading: false })
    usePlanStore.getState().decrementCount('posts')
  } catch (error) {
    set({ posts: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function postStatusAction(id: string, action: 'archive' | 'restore', set: PostsSetFn) {
  set({ loading: true, error: null })
  try {
    const res = await fetch(`${API_BASE}/posts/${id}/${action}`, { method: 'POST' })
    if (!res.ok) throw new Error(`Failed to ${action} post`)
    const data = await res.json()
    const post = data.post as Post
    set((state) => ({
      posts: state.posts.map((p) => (p.id === id ? post : p)),
      loading: false,
    }))
  } catch (error) {
    set({ error: (error as Error).message, loading: false })
    throw error
  }
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

  addPost: (postData) => addPostAction(postData, set, get),
  updatePost: (id, updates) => updatePostAction(id, updates, set, get),
  deletePost: (id) => deletePostAction(id, set, get),
  archivePost: (id) => postStatusAction(id, 'archive', set),
  restorePost: (id) => postStatusAction(id, 'restore', set),
  getPost: (id) => get().posts.find((p) => p.id === id),

  getPostsByStatus: (status) => {
    if (!status) return get().posts
    return get().posts.filter((p) => p.status === status)
  },
}))
