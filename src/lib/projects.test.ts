import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useProjectsStore } from './projects'
import { clearInFlightRequests } from './requestDedup'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
  clearInFlightRequests()
  useProjectsStore.getState().reset()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeProject = (overrides: Record<string, unknown> = {}) => ({
  id: 'proj-1',
  name: 'Test Project',
  description: 'A test project',
  hashtags: ['#test'],
  brandColors: { primary: '#000' },
  logoUrl: 'https://example.com/logo.png',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

// ---------------------------------------------------------------------------
// fetchProjects
// ---------------------------------------------------------------------------

describe('useProjectsStore', () => {
  describe('fetchProjects', () => {
    it('should set loading true while fetching', async () => {
      let capturedLoading = false
      mockFetch.mockImplementation(() => {
        capturedLoading = useProjectsStore.getState().loading
        return Promise.resolve({
          ok: true,
          json: async () => ({ projects: [] }),
        })
      })

      await useProjectsStore.getState().fetchProjects()
      expect(capturedLoading).toBe(true)
    })

    it('should populate projects on success', async () => {
      const projects = [makeProject(), makeProject({ id: 'proj-2', name: 'Second' })]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects }),
      })

      await useProjectsStore.getState().fetchProjects()

      const state = useProjectsStore.getState()
      expect(state.projects).toEqual(projects)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should set initialized after first fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ projects: [] }),
      })

      expect(useProjectsStore.getState().initialized).toBe(false)
      await useProjectsStore.getState().fetchProjects()
      expect(useProjectsStore.getState().initialized).toBe(true)
    })

    it('should set error on failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })

      await useProjectsStore.getState().fetchProjects()

      const state = useProjectsStore.getState()
      expect(state.error).toBe('Failed to fetch projects')
      expect(state.loading).toBe(false)
    })

    it('should default to empty array when response has no projects key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await useProjectsStore.getState().fetchProjects()
      expect(useProjectsStore.getState().projects).toEqual([])
    })

    it('should deduplicate concurrent calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ projects: [] }),
      })

      await Promise.all([
        useProjectsStore.getState().fetchProjects(),
        useProjectsStore.getState().fetchProjects(),
      ])

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // createProject
  // ---------------------------------------------------------------------------

  describe('createProject', () => {
    it('should POST to /api/projects and add to items', async () => {
      const newProject = makeProject()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ project: newProject }),
      })

      const result = await useProjectsStore.getState().createProject({
        name: 'Test Project',
        description: 'A test project',
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Project', description: 'A test project' }),
      })
      expect(result).toEqual(newProject)
      expect(useProjectsStore.getState().projects).toHaveLength(1)
    })

    it('should prepend new project to existing list', async () => {
      useProjectsStore.setState({ projects: [makeProject({ id: 'existing' })] })

      const newProject = makeProject({ id: 'new-1' })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ project: newProject }),
      })

      await useProjectsStore.getState().createProject({ name: 'New' })

      const projects = useProjectsStore.getState().projects
      expect(projects).toHaveLength(2)
      expect(projects[0].id).toBe('new-1')
    })

    it('should set error and throw on failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Project limit reached' }),
      })

      await expect(useProjectsStore.getState().createProject({ name: 'Fail' })).rejects.toThrow(
        'Project limit reached'
      )

      expect(useProjectsStore.getState().error).toBe('Project limit reached')
      expect(useProjectsStore.getState().loading).toBe(false)
    })

    it('should fall back to generic error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

      await expect(useProjectsStore.getState().createProject({ name: 'Fail' })).rejects.toThrow(
        'Failed to create project'
      )
    })
  })

  // ---------------------------------------------------------------------------
  // updateProject
  // ---------------------------------------------------------------------------

  describe('updateProject', () => {
    it('should PATCH and update the project in state', async () => {
      useCampaignsStore_setState([makeProject()])

      const updated = makeProject({ name: 'Updated Name' })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ project: updated }),
      })

      await useProjectsStore.getState().updateProject('proj-1', { name: 'Updated Name' })

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/proj-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Name' }),
      })
      expect(useProjectsStore.getState().projects[0].name).toBe('Updated Name')
    })

    it('should set error and throw on failure', async () => {
      useProjectsStore.setState({ projects: [makeProject()] })
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Not found' }),
      })

      await expect(
        useProjectsStore.getState().updateProject('proj-1', { name: 'Fail' })
      ).rejects.toThrow('Not found')

      expect(useProjectsStore.getState().error).toBe('Not found')
    })
  })

  // ---------------------------------------------------------------------------
  // deleteProject
  // ---------------------------------------------------------------------------

  describe('deleteProject', () => {
    it('should DELETE and remove the project from state', async () => {
      useProjectsStore.setState({
        projects: [makeProject({ id: 'proj-1' }), makeProject({ id: 'proj-2' })],
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ deleted: { campaignsAffected: 2 } }),
      })

      const result = await useProjectsStore.getState().deleteProject('proj-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/proj-1', { method: 'DELETE' })
      expect(result).toEqual({ campaignsAffected: 2 })
      expect(useProjectsStore.getState().projects).toHaveLength(1)
      expect(useProjectsStore.getState().projects[0].id).toBe('proj-2')
    })

    it('should default campaignsAffected to 0', async () => {
      useProjectsStore.setState({ projects: [makeProject()] })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      const result = await useProjectsStore.getState().deleteProject('proj-1')
      expect(result).toEqual({ campaignsAffected: 0 })
    })

    it('should set error and throw on failure', async () => {
      useProjectsStore.setState({ projects: [makeProject()] })
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Cannot delete' }),
      })

      await expect(useProjectsStore.getState().deleteProject('proj-1')).rejects.toThrow(
        'Cannot delete'
      )
    })
  })

  // ---------------------------------------------------------------------------
  // getProject / getProjectCount
  // ---------------------------------------------------------------------------

  describe('getProject', () => {
    it('should return a project by id', () => {
      useProjectsStore.setState({ projects: [makeProject()] })
      expect(useProjectsStore.getState().getProject('proj-1')).toEqual(makeProject())
    })

    it('should return undefined for unknown id', () => {
      useProjectsStore.setState({ projects: [makeProject()] })
      expect(useProjectsStore.getState().getProject('nonexistent')).toBeUndefined()
    })
  })

  describe('getProjectCount', () => {
    it('should return the number of projects', () => {
      useProjectsStore.setState({
        projects: [makeProject({ id: 'p1' }), makeProject({ id: 'p2' })],
      })
      expect(useProjectsStore.getState().getProjectCount()).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // fetchProjectWithCampaigns
  // ---------------------------------------------------------------------------

  describe('fetchProjectWithCampaigns', () => {
    it('should return project from store with campaigns from API', async () => {
      const project = makeProject()
      useProjectsStore.setState({ projects: [project] })

      const campaigns = [{ id: 'camp-1', name: 'Campaign 1' }]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ campaigns }),
      })

      const result = await useProjectsStore.getState().fetchProjectWithCampaigns('proj-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/proj-1/campaigns')
      expect(result).toEqual({ project, campaigns })
    })

    it('should fetch project from API when not in store', async () => {
      const campaigns = [{ id: 'camp-1' }]
      const project = makeProject()

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ campaigns }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ project }),
        })

      const result = await useProjectsStore.getState().fetchProjectWithCampaigns('proj-1')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ project, campaigns })
    })

    it('should return undefined on failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })

      const result = await useProjectsStore.getState().fetchProjectWithCampaigns('proj-1')
      expect(result).toBeUndefined()
    })

    it('should return undefined on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await useProjectsStore.getState().fetchProjectWithCampaigns('proj-1')
      expect(result).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // fetchProjectAnalytics
  // ---------------------------------------------------------------------------

  describe('fetchProjectAnalytics', () => {
    it('should return analytics from API', async () => {
      const analytics = { totalCampaigns: 3, totalPosts: 10, scheduledPosts: 2, publishedPosts: 8 }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ analytics }),
      })

      const result = await useProjectsStore.getState().fetchProjectAnalytics('proj-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/projects/proj-1/analytics')
      expect(result).toEqual(analytics)
    })

    it('should return undefined on failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })

      const result = await useProjectsStore.getState().fetchProjectAnalytics('proj-1')
      expect(result).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('should reset all state to initial values', () => {
      useProjectsStore.setState({
        projects: [makeProject()],
        loading: true,
        error: 'some error',
        initialized: true,
      })

      useProjectsStore.getState().reset()

      const state = useProjectsStore.getState()
      expect(state.projects).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.initialized).toBe(false)
    })
  })
})

// Helper used in updateProject test — alias for clarity
function useCampaignsStore_setState(projects: ReturnType<typeof makeProject>[]) {
  useProjectsStore.setState({ projects })
}
