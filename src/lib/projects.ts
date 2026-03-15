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

type ProjectsSetFn = (
  partial: Partial<ProjectsState> | ((s: ProjectsState) => Partial<ProjectsState>)
) => void
type ProjectsGetFn = () => ProjectsState & ProjectsActions

async function fetchProjectsAction(set: ProjectsSetFn) {
  return dedup('projects', async () => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`${API_BASE}/projects`)
      if (!res.ok) throw new Error('Failed to fetch projects')
      const data = await res.json()
      set({ projects: data.projects || [], loading: false, initialized: true })
    } catch (error) {
      set({ error: (error as Error).message, loading: false })
    }
  })
}

async function createProjectAction(
  projectData: Parameters<ProjectsActions['createProject']>[0],
  set: ProjectsSetFn,
  get: ProjectsGetFn
): Promise<Project> {
  const previous = get().projects
  const tempProject: Project = {
    id: 'temp-' + Date.now(),
    name: projectData.name,
    description: projectData.description,
    hashtags: projectData.hashtags || [],
    brandColors: projectData.brandColors || {},
    logoUrl: projectData.logoUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  set({ projects: [tempProject, ...previous], loading: true, error: null })
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
    set({ projects: [newProject, ...previous], loading: false })
    usePlanStore.getState().incrementCount('projects')
    return newProject
  } catch (error) {
    set({ projects: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function updateProjectAction(
  id: string,
  updates: Partial<Project>,
  set: ProjectsSetFn,
  get: ProjectsGetFn
) {
  const previous = get().projects
  set({
    projects: previous.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    loading: true,
    error: null,
  })
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
    set({
      projects: previous.map((p) => (p.id === id ? (data.project as Project) : p)),
      loading: false,
    })
  } catch (error) {
    set({ projects: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function deleteProjectAction(
  id: string,
  set: ProjectsSetFn,
  get: ProjectsGetFn
): Promise<{ campaignsAffected: number }> {
  const previous = get().projects
  set({ projects: previous.filter((p) => p.id !== id), loading: true, error: null })
  try {
    const res = await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const errorData = await res.json()
      throw new Error(errorData.error || 'Failed to delete project')
    }
    const data = await res.json()
    set({ loading: false })
    usePlanStore.getState().decrementCount('projects')
    return { campaignsAffected: data.deleted?.campaignsAffected || 0 }
  } catch (error) {
    set({ projects: previous, error: (error as Error).message, loading: false })
    throw error
  }
}

async function fetchProjectWithCampaignsAction(
  id: string,
  get: ProjectsGetFn
): Promise<{ project: Project; campaigns: Campaign[] } | undefined> {
  try {
    const res = await fetch(`${API_BASE}/projects/${id}/campaigns`)
    if (!res.ok) return undefined
    const campaignsData = await res.json()
    const project = get().getProject(id)
    if (!project) {
      const projectRes = await fetch(`${API_BASE}/projects/${id}`)
      if (!projectRes.ok) return undefined
      const projectData = await projectRes.json()
      return {
        project: projectData.project as Project,
        campaigns: campaignsData.campaigns as Campaign[],
      }
    }
    return { project, campaigns: campaignsData.campaigns as Campaign[] }
  } catch {
    return undefined
  }
}

export const useProjectsStore = create<ProjectsState & ProjectsActions>()((set, get) => ({
  ...initialState,
  fetchProjects: () => fetchProjectsAction(set),
  createProject: (data) => createProjectAction(data, set, get),
  updateProject: (id, updates) => updateProjectAction(id, updates, set, get),
  deleteProject: (id) => deleteProjectAction(id, set, get),
  getProject: (id) => get().projects.find((p) => p.id === id),
  getProjectCount: () => get().projects.length,
  fetchProjectWithCampaigns: (id) => fetchProjectWithCampaignsAction(id, get),
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
  reset: () => set(initialState),
}))

// Selector hooks for common queries
export const useProjects = () => useProjectsStore((state) => state.projects)
export const useProjectsLoading = () => useProjectsStore((state) => state.loading)
export const useProjectsError = () => useProjectsStore((state) => state.error)
export const useProjectsInitialized = () => useProjectsStore((state) => state.initialized)
