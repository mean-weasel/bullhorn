import { create } from 'zustand'
import { Project, ProjectAnalytics, Campaign } from './posts'
import { dedup } from './requestDedup'
import { usePlanStore } from './planStore'

// API URL - use relative path for Next.js API routes
const API_BASE = '/api'

interface ProjectsState {
  projects: Project[]
  loading: boolean
  error: string | null
  initialized: boolean
}

interface ProjectsActions {
  // CRUD operations
  fetchProjects: () => Promise<void>
  createProject: (project: {
    name: string
    description?: string
    hashtags?: string[]
    brandColors?: { primary?: string; secondary?: string; accent?: string }
    logoUrl?: string
  }) => Promise<Project>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<{ campaignsAffected: number }>

  // Getters
  getProject: (id: string) => Project | undefined
  getProjectCount: () => number

  // Project details
  fetchProjectWithCampaigns: (
    id: string
  ) => Promise<{ project: Project; campaigns: Campaign[] } | undefined>
  fetchProjectAnalytics: (id: string) => Promise<ProjectAnalytics | undefined>

  // Reset
  reset: () => void
}

const initialState: ProjectsState = {
  projects: [],
  loading: false,
  error: null,
  initialized: false,
}

export const useProjectsStore = create<ProjectsState & ProjectsActions>()((set, get) => ({
  ...initialState,

  fetchProjects: async () => {
    return dedup('projects', async () => {
      set({ loading: true, error: null })
      try {
        const res = await fetch(`${API_BASE}/projects`)
        if (!res.ok) throw new Error('Failed to fetch projects')
        const data = await res.json()
        const projects = data.projects || []
        set({
          projects,
          loading: false,
          initialized: true,
        })
      } catch (error) {
        set({ error: (error as Error).message, loading: false })
      }
    })
  },

  createProject: async (projectData) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to create project')
      }
      const data = await res.json()
      const newProject = data.project as Project

      set((state) => ({
        projects: [newProject, ...state.projects],
        loading: false,
      }))
      usePlanStore.getState().incrementCount('projects')

      return newProject
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  updateProject: async (id, updates) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update project')
      }
      const data = await res.json()
      const updatedProject = data.project as Project

      set((state) => ({
        projects: state.projects.map((p) => (p.id === id ? updatedProject : p)),
        loading: false,
      }))
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  deleteProject: async (id) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/projects/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to delete project')
      }
      const data = await res.json()

      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        loading: false,
      }))
      usePlanStore.getState().decrementCount('projects')

      return { campaignsAffected: data.deleted?.campaignsAffected || 0 }
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
      throw error
    }
  },

  getProject: (id) => get().projects.find((p) => p.id === id),

  getProjectCount: () => get().projects.length,

  fetchProjectWithCampaigns: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${id}/campaigns`)
      if (!res.ok) return undefined

      const campaignsData = await res.json()
      const project = get().getProject(id)

      if (!project) {
        // Fetch project if not in store
        const projectRes = await fetch(`${API_BASE}/projects/${id}`)
        if (!projectRes.ok) return undefined
        const projectData = await projectRes.json()
        return {
          project: projectData.project as Project,
          campaigns: campaignsData.campaigns as Campaign[],
        }
      }

      return {
        project,
        campaigns: campaignsData.campaigns as Campaign[],
      }
    } catch {
      return undefined
    }
  },

  fetchProjectAnalytics: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/projects/${id}/analytics`)
      if (!res.ok) return undefined
      const data = await res.json()
      return data.analytics as ProjectAnalytics
    } catch {
      return undefined
    }
  },

  reset: () => {
    set(initialState)
  },
}))

// Selector hooks for common queries
export const useProjects = () => useProjectsStore((state) => state.projects)
export const useProjectsLoading = () => useProjectsStore((state) => state.loading)
export const useProjectsError = () => useProjectsStore((state) => state.error)
export const useProjectsInitialized = () => useProjectsStore((state) => state.initialized)
