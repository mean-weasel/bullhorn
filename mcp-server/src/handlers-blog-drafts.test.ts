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
async function handleCreateBlogDraft(args: {
  title?: string
  content?: string
  date?: string
  scheduledAt?: string
  status?: string
  notes?: string
  campaignId?: string
}): Promise<ToolResult> {
  if (!args.title || args.title.trim() === '') {
    return err('title is required')
  }
  const draft = await storage.createBlogDraft({
    title: args.title.trim(),
    content: args.content || '',
    date: args.date || null,
    scheduledAt: args.scheduledAt || null,
    status: (args.status as storage.BlogDraftStatus) || 'draft',
    notes: args.notes,
    campaignId: args.campaignId,
  })
  return ok({ draft })
}

async function handleGetBlogDraft(args: { id: string }): Promise<ToolResult> {
  const draft = await storage.getBlogDraft(args.id)
  if (!draft) return err(`Blog draft with ID ${args.id} not found`)
  return ok({ draft })
}

async function handleUpdateBlogDraft(args: {
  id: string
  [key: string]: unknown
}): Promise<ToolResult> {
  const { id, ...updates } = args as { id: string } & Partial<storage.BlogDraft>
  const draft = await storage.updateBlogDraft(id, updates)
  if (!draft) return err(`Blog draft with ID ${id} not found`)
  return ok({ draft })
}

async function handleDeleteBlogDraft(args: {
  id: string
  confirmed?: boolean
}): Promise<ToolResult> {
  if (!args.confirmed) {
    return err('Deletion not confirmed. Please set confirmed=true after confirming with the user.')
  }
  const success = await storage.deleteBlogDraft(args.id)
  if (!success) return err(`Blog draft with ID ${args.id} not found`)
  return ok({ message: `Blog draft ${args.id} permanently deleted` })
}

async function handleArchiveBlogDraft(args: {
  id: string
  confirmed?: boolean
}): Promise<ToolResult> {
  if (!args.confirmed) {
    return err('Archive not confirmed. Please set confirmed=true after confirming with the user.')
  }
  const draft = await storage.archiveBlogDraft(args.id)
  if (!draft) return err(`Blog draft with ID ${args.id} not found`)
  return ok({ draft })
}

async function handleRestoreBlogDraft(args: { id: string }): Promise<ToolResult> {
  const draft = await storage.restoreBlogDraft(args.id)
  if (!draft) return err(`Blog draft with ID ${args.id} not found`)
  return ok({ draft })
}

async function handleListBlogDrafts(args: {
  status?: string
  campaignId?: string
  limit?: number
}): Promise<ToolResult> {
  const drafts = await storage.listBlogDrafts({
    status: args.status as storage.BlogDraftStatus | 'all',
    campaignId: args.campaignId,
    limit: args.limit || 50,
  })
  // The actual handler returns simplified drafts, but we test the storage call
  const simplifiedDrafts = drafts.map((d: storage.BlogDraft) => ({
    id: d.id,
    title: d.title,
    status: d.status,
    date: d.date,
    wordCount: d.wordCount,
    updatedAt: d.updatedAt,
  }))
  return ok({ count: drafts.length, drafts: simplifiedDrafts })
}

async function handleSearchBlogDrafts(args: {
  query?: string
  limit?: number
}): Promise<ToolResult> {
  if (!args.query || args.query.trim() === '') {
    return err('search query is required')
  }
  const drafts = await storage.searchBlogDrafts(args.query, { limit: args.limit || 50 })
  return ok({ count: drafts.length, drafts })
}

describe('Blog Draft Tool Handlers', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPatch.mockReset()
    mockDelete.mockReset()
    _resetClient()
  })

  describe('create_blog_draft', () => {
    it('should create a blog draft with valid title', async () => {
      const mockDraft = { id: 'draft-1', title: 'My Post', status: 'draft', content: '' }
      mockPost.mockResolvedValueOnce({ draft: mockDraft })

      const result = await handleCreateBlogDraft({ title: 'My Post' })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.draft).toEqual(mockDraft)
    })

    it('should create a blog draft with all fields', async () => {
      const mockDraft = { id: 'draft-2', title: 'Full Post', status: 'draft' }
      mockPost.mockResolvedValueOnce({ draft: mockDraft })

      await handleCreateBlogDraft({
        title: 'Full Post',
        content: '# Hello',
        date: '2026-03-01',
        scheduledAt: '2026-03-01T10:00:00Z',
        status: 'draft',
        notes: 'Some notes',
        campaignId: 'c1',
      })

      expect(mockPost).toHaveBeenCalledWith('/blog-drafts', {
        title: 'Full Post',
        content: '# Hello',
        date: '2026-03-01',
        scheduledAt: '2026-03-01T10:00:00Z',
        status: 'draft',
        notes: 'Some notes',
        campaignId: 'c1',
      })
    })

    it('should return error when title is missing', async () => {
      const result = await handleCreateBlogDraft({})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('title is required')
    })

    it('should return error when title is empty', async () => {
      const result = await handleCreateBlogDraft({ title: '' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('title is required')
    })

    it('should return error when title is whitespace', async () => {
      const result = await handleCreateBlogDraft({ title: '   ' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('title is required')
    })

    it('should trim the title', async () => {
      const mockDraft = { id: 'draft-3', title: 'Trimmed', status: 'draft' }
      mockPost.mockResolvedValueOnce({ draft: mockDraft })

      await handleCreateBlogDraft({ title: '  Trimmed  ' })
      expect(mockPost).toHaveBeenCalledWith(
        '/blog-drafts',
        expect.objectContaining({ title: 'Trimmed' })
      )
    })
  })

  describe('get_blog_draft', () => {
    it('should return draft when found', async () => {
      const mockDraft = { id: 'draft-1', title: 'My Post', content: '# Hello' }
      mockGet.mockResolvedValueOnce({ draft: mockDraft })

      const result = await handleGetBlogDraft({ id: 'draft-1' })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.draft).toEqual(mockDraft)
    })

    it('should return error when draft not found', async () => {
      mockGet.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleGetBlogDraft({ id: 'nonexistent' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Blog draft with ID nonexistent not found')
    })
  })

  describe('update_blog_draft', () => {
    it('should update draft with valid data', async () => {
      const mockDraft = { id: 'draft-1', title: 'Updated Title' }
      mockPatch.mockResolvedValueOnce({ draft: mockDraft })

      const result = await handleUpdateBlogDraft({ id: 'draft-1', title: 'Updated Title' })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.draft).toEqual(mockDraft)
    })

    it('should return error when draft not found', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleUpdateBlogDraft({ id: 'nonexistent', title: 'New' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Blog draft with ID nonexistent not found')
    })
  })

  describe('delete_blog_draft', () => {
    it('should delete draft when confirmed', async () => {
      mockDelete.mockResolvedValueOnce({})

      const result = await handleDeleteBlogDraft({ id: 'draft-1', confirmed: true })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.message).toContain('Blog draft draft-1 permanently deleted')
    })

    it('should return error when not confirmed', async () => {
      const result = await handleDeleteBlogDraft({ id: 'draft-1', confirmed: false })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Deletion not confirmed')
    })

    it('should return error when draft not found', async () => {
      mockDelete.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleDeleteBlogDraft({ id: 'nonexistent', confirmed: true })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Blog draft with ID nonexistent not found')
    })
  })

  describe('archive_blog_draft', () => {
    it('should archive draft when confirmed', async () => {
      const mockDraft = { id: 'draft-1', status: 'archived' }
      mockPatch.mockResolvedValueOnce({ draft: mockDraft })

      const result = await handleArchiveBlogDraft({ id: 'draft-1', confirmed: true })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.draft.status).toBe('archived')
    })

    it('should return error when not confirmed', async () => {
      const result = await handleArchiveBlogDraft({ id: 'draft-1', confirmed: false })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Archive not confirmed')
    })

    it('should return error when draft not found', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleArchiveBlogDraft({ id: 'nonexistent', confirmed: true })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Blog draft with ID nonexistent not found')
    })
  })

  describe('restore_blog_draft', () => {
    it('should restore archived draft', async () => {
      const mockDraft = { id: 'draft-1', status: 'draft' }
      mockPatch.mockResolvedValueOnce({ draft: mockDraft })

      const result = await handleRestoreBlogDraft({ id: 'draft-1' })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.draft.status).toBe('draft')
    })

    it('should return error when draft not found', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleRestoreBlogDraft({ id: 'nonexistent' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Blog draft with ID nonexistent not found')
    })
  })

  describe('list_blog_drafts', () => {
    it('should list drafts with no filter', async () => {
      const mockDrafts = [
        {
          id: 'd1',
          title: 'Draft 1',
          status: 'draft',
          date: null,
          wordCount: 100,
          updatedAt: '2026-02-01',
        },
        {
          id: 'd2',
          title: 'Draft 2',
          status: 'published',
          date: '2026-01-15',
          wordCount: 200,
          updatedAt: '2026-02-02',
        },
      ]
      mockGet.mockResolvedValueOnce({ drafts: mockDrafts })

      const result = await handleListBlogDrafts({})
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.count).toBe(2)
    })

    it('should pass status filter', async () => {
      mockGet.mockResolvedValueOnce({ drafts: [] })

      await handleListBlogDrafts({ status: 'draft' })
      expect(mockGet).toHaveBeenCalledWith(
        '/blog-drafts',
        expect.objectContaining({ status: 'draft' })
      )
    })

    it('should use default limit of 50', async () => {
      mockGet.mockResolvedValueOnce({ drafts: [] })

      await handleListBlogDrafts({})
      expect(mockGet).toHaveBeenCalledWith('/blog-drafts', expect.objectContaining({ limit: '50' }))
    })
  })

  describe('search_blog_drafts', () => {
    it('should return matching drafts', async () => {
      const mockDrafts = [{ id: 'd1', title: 'React Guide' }]
      mockGet.mockResolvedValueOnce({ drafts: mockDrafts })

      const result = await handleSearchBlogDrafts({ query: 'react' })
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.count).toBe(1)
      expect(response.drafts).toEqual(mockDrafts)
    })

    it('should return empty results', async () => {
      mockGet.mockResolvedValueOnce({ drafts: [] })

      const result = await handleSearchBlogDrafts({ query: 'nonexistent' })
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.count).toBe(0)
      expect(response.drafts).toEqual([])
    })

    it('should return error when query is empty', async () => {
      const result = await handleSearchBlogDrafts({ query: '' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('search query is required')
    })
  })
})
