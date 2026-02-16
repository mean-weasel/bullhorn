import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('./client.js', () => ({
  BullhornClient: class {
    get = mockGet
    post = mockPost
    patch = mockPatch
    delete = mockDelete
  },
}))

import * as storage from './storage.js'
import { _resetClient } from './storage.js'

type ToolResult = {
  content: { type: string; text: string }[]
  isError?: boolean
}

function ok(data: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ success: true, ...data }, null, 2) }] }
}

function err(msg: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
}

// Handler functions extracted from index.ts switch cases
async function handleCreateProject(args: {
  name?: string
  description?: string
  hashtags?: string[]
  brandColors?: Record<string, string>
  logoUrl?: string
}): Promise<ToolResult> {
  const { name, description, hashtags, brandColors, logoUrl } = args

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return err('name is required')
  }

  const result = await storage.createProject({
    name: name.trim(),
    description,
    hashtags,
    brandColors,
    logoUrl,
  })

  return ok({
    project: result.project,
    atLimit: result.atLimit,
    message: result.atLimit
      ? 'Project created. Note: You have reached the soft limit of 3 projects.'
      : 'Project created successfully.',
  })
}

async function handleGetProject(args: { id: string }): Promise<ToolResult> {
  const project = await storage.getProject(args.id)
  if (!project) return err(`Project with ID ${args.id} not found`)
  return ok({ project })
}

async function handleUpdateProject(args: {
  id: string
  [key: string]: unknown
}): Promise<ToolResult> {
  const { id, ...updates } = args as { id: string } & Partial<storage.Project>
  const project = await storage.updateProject(id, updates)
  if (!project) return err(`Project with ID ${id} not found`)
  return ok({ project })
}

async function handleDeleteProject(args: { id: string; confirmed?: boolean }): Promise<ToolResult> {
  if (!args.confirmed) {
    return err('Deletion not confirmed. Please set confirmed=true after confirming with the user.')
  }

  const result = await storage.deleteProject(args.id)

  return ok({
    message: `Project deleted. ${result.campaignsDeleted} campaigns became unassigned.`,
  })
}

async function handleListProjects(args: { limit?: number; offset?: number }): Promise<ToolResult> {
  const result = await storage.listProjects({ limit: args.limit || 50, offset: args.offset })

  return ok({
    ...result,
  })
}

describe('Project Tool Handlers', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPatch.mockReset()
    mockDelete.mockReset()
    _resetClient()
  })

  describe('create_project', () => {
    it('should create a project with valid name', async () => {
      const mockProject = {
        id: 'proj-1',
        name: 'My Project',
        description: null,
        hashtags: [],
        brandColors: {},
      }
      mockPost.mockResolvedValueOnce({ project: mockProject, meta: { atLimit: false } })

      const result = await handleCreateProject({ name: 'My Project' })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.project).toEqual(mockProject)
      expect(response.atLimit).toBe(false)
      expect(response.message).toBe('Project created successfully.')
    })

    it('should create a project with all fields', async () => {
      const mockProject = {
        id: 'proj-2',
        name: 'Full Project',
        description: 'A description',
        hashtags: ['#launch', '#saas'],
        brandColors: { primary: '#ff0000' },
        logoUrl: 'https://example.com/logo.png',
      }
      mockPost.mockResolvedValueOnce({ project: mockProject, meta: { atLimit: false } })

      await handleCreateProject({
        name: 'Full Project',
        description: 'A description',
        hashtags: ['#launch', '#saas'],
        brandColors: { primary: '#ff0000' },
        logoUrl: 'https://example.com/logo.png',
      })

      expect(mockPost).toHaveBeenCalledWith('/projects', {
        name: 'Full Project',
        description: 'A description',
        hashtags: ['#launch', '#saas'],
        brandColors: { primary: '#ff0000' },
        logoUrl: 'https://example.com/logo.png',
      })
    })

    it('should indicate when at limit', async () => {
      const mockProject = { id: 'proj-3', name: 'Third Project' }
      mockPost.mockResolvedValueOnce({ project: mockProject, meta: { atLimit: true } })

      const result = await handleCreateProject({ name: 'Third Project' })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.atLimit).toBe(true)
      expect(response.message).toContain('reached the soft limit')
    })

    it('should return error when name is missing', async () => {
      const result = await handleCreateProject({})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('name is required')
    })

    it('should return error when name is empty', async () => {
      const result = await handleCreateProject({ name: '' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('name is required')
    })

    it('should return error when name is whitespace', async () => {
      const result = await handleCreateProject({ name: '   ' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('name is required')
    })

    it('should trim the name', async () => {
      const mockProject = { id: 'proj-4', name: 'Trimmed' }
      mockPost.mockResolvedValueOnce({ project: mockProject, meta: { atLimit: false } })

      await handleCreateProject({ name: '  Trimmed  ' })
      expect(mockPost).toHaveBeenCalledWith(
        '/projects',
        expect.objectContaining({ name: 'Trimmed' })
      )
    })
  })

  describe('get_project', () => {
    it('should return project when found', async () => {
      const mockProject = {
        id: 'proj-1',
        name: 'My Project',
        hashtags: [],
        brandColors: {},
      }
      mockGet.mockResolvedValueOnce({ project: mockProject })

      const result = await handleGetProject({ id: 'proj-1' })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.project).toEqual(mockProject)
    })

    it('should return error when project not found', async () => {
      mockGet.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleGetProject({ id: 'nonexistent' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Project with ID nonexistent not found')
    })
  })

  describe('update_project', () => {
    it('should update project with valid data', async () => {
      const mockProject = { id: 'proj-1', name: 'Updated Name', hashtags: ['#new'] }
      mockPatch.mockResolvedValueOnce({ project: mockProject })

      const result = await handleUpdateProject({
        id: 'proj-1',
        name: 'Updated Name',
        hashtags: ['#new'],
      })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.project).toEqual(mockProject)
    })

    it('should return error when project not found', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleUpdateProject({ id: 'nonexistent', name: 'New Name' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Project with ID nonexistent not found')
    })

    it('should update brand colors', async () => {
      const mockProject = {
        id: 'proj-1',
        brandColors: { primary: '#00ff00', secondary: '#0000ff' },
      }
      mockPatch.mockResolvedValueOnce({ project: mockProject })

      const result = await handleUpdateProject({
        id: 'proj-1',
        brandColors: { primary: '#00ff00', secondary: '#0000ff' },
      })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.project.brandColors).toEqual({
        primary: '#00ff00',
        secondary: '#0000ff',
      })
    })
  })

  describe('delete_project', () => {
    it('should delete project when confirmed', async () => {
      mockDelete.mockResolvedValueOnce({
        success: true,
        deleted: { campaignsAffected: 2 },
      })

      const result = await handleDeleteProject({ id: 'proj-1', confirmed: true })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.message).toContain('Project deleted')
      expect(response.message).toContain('2 campaigns became unassigned')
    })

    it('should return error when not confirmed', async () => {
      const result = await handleDeleteProject({ id: 'proj-1', confirmed: false })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Deletion not confirmed')
    })

    it('should return error when confirmed is missing', async () => {
      const result = await handleDeleteProject({ id: 'proj-1' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Deletion not confirmed')
    })

    it('should handle delete with zero campaigns affected', async () => {
      mockDelete.mockResolvedValueOnce({
        success: true,
        deleted: { campaignsAffected: 0 },
      })

      const result = await handleDeleteProject({ id: 'proj-1', confirmed: true })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.message).toContain('0 campaigns became unassigned')
    })
  })

  describe('list_projects', () => {
    it('should list projects with no filters', async () => {
      const mockProjects = [
        { id: 'p1', name: 'Project 1' },
        { id: 'p2', name: 'Project 2' },
      ]
      mockGet.mockResolvedValueOnce({
        projects: mockProjects,
        meta: { count: 2, softLimit: 3, atLimit: false },
      })

      const result = await handleListProjects({})
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.projects).toEqual(mockProjects)
      expect(response.total).toBe(2)
      expect(response.softLimit).toBe(3)
      expect(response.atLimit).toBe(false)
    })

    it('should use default limit of 50', async () => {
      mockGet.mockResolvedValueOnce({
        projects: [],
        meta: { count: 0, softLimit: 3, atLimit: false },
      })

      await handleListProjects({})
      expect(mockGet).toHaveBeenCalledWith('/projects', expect.objectContaining({ limit: '50' }))
    })

    it('should pass custom limit and offset', async () => {
      mockGet.mockResolvedValueOnce({
        projects: [],
        meta: { count: 0, softLimit: 3, atLimit: false },
      })

      await handleListProjects({ limit: 10, offset: 5 })
      expect(mockGet).toHaveBeenCalledWith(
        '/projects',
        expect.objectContaining({ limit: '10', offset: '5' })
      )
    })

    it('should indicate when at limit', async () => {
      mockGet.mockResolvedValueOnce({
        projects: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
        meta: { count: 3, softLimit: 3, atLimit: true },
      })

      const result = await handleListProjects({})
      const response = JSON.parse(result.content[0].text)
      expect(response.atLimit).toBe(true)
    })
  })
})
