import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Shared mock client methods — these persist across tests
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

// Mock the HTTP client before importing storage
vi.mock('./client.js', () => ({
  BullhornClient: class {
    get = mockGet
    post = mockPost
    patch = mockPatch
    delete = mockDelete
  },
}))

import {
  createPost,
  getPost,
  updatePost,
  archivePost,
  restorePost,
  createCampaign,
  createBlogDraft,
  getBlogDraft,
  updateBlogDraft,
  _resetClient,
} from './storage.js'

describe('Storage Layer (HTTP Client)', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPatch.mockReset()
    mockDelete.mockReset()
    _resetClient()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Post Operations', () => {
    it('should create a post via HTTP POST', async () => {
      const mockPostData = {
        id: 'post-123',
        platform: 'twitter',
        content: { text: 'Hello world' },
        status: 'draft',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        scheduledAt: null,
      }

      mockPost.mockResolvedValueOnce({ post: mockPostData })

      const result = await createPost({
        platform: 'twitter',
        content: { text: 'Hello world' },
      })

      expect(result.id).toBe('post-123')
      expect(result.createdAt).toBe('2024-01-01T00:00:00Z')
      expect(result.scheduledAt).toBeNull()
      expect(mockPost).toHaveBeenCalledWith('/posts', {
        platform: 'twitter',
        content: { text: 'Hello world' },
        scheduledAt: null,
        status: 'draft',
        notes: null,
        campaignId: null,
        groupId: null,
        groupType: null,
      })
    })

    it('should throw error on create failure', async () => {
      mockPost.mockRejectedValueOnce(new Error('Bad Request'))

      await expect(createPost({ platform: 'twitter', content: { text: '' } })).rejects.toThrow(
        'Bad Request'
      )
    })

    it('should return undefined when post not found', async () => {
      mockGet.mockRejectedValueOnce(new Error('HTTP 404'))

      const result = await getPost('nonexistent')
      expect(result).toBeUndefined()
    })

    it('should update post via HTTP PATCH', async () => {
      const mockPostData = {
        id: 'post-123',
        platform: 'twitter',
        content: { text: 'Updated' },
        status: 'scheduled',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        scheduledAt: '2024-02-01T00:00:00Z',
      }

      mockPatch.mockResolvedValueOnce({ post: mockPostData })

      const result = await updatePost('post-123', { status: 'scheduled' })
      expect(result?.status).toBe('scheduled')
      expect(result?.scheduledAt).toBe('2024-02-01T00:00:00Z')
    })

    it('should archive post by setting status to archived', async () => {
      const mockPostData = {
        id: 'post-123',
        platform: 'twitter',
        content: { text: 'test' },
        status: 'archived',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        scheduledAt: null,
      }

      mockPatch.mockResolvedValueOnce({ post: mockPostData })

      const result = await archivePost('post-123')
      expect(result?.status).toBe('archived')
    })

    it('should restore post by setting status to draft', async () => {
      const mockPostData = {
        id: 'post-123',
        platform: 'twitter',
        content: { text: 'test' },
        status: 'draft',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        scheduledAt: null,
      }

      mockPatch.mockResolvedValueOnce({ post: mockPostData })

      const result = await restorePost('post-123')
      expect(result?.status).toBe('draft')
    })
  })

  describe('Campaign Operations', () => {
    it('should create a campaign via HTTP POST', async () => {
      const mockCampaign = {
        id: 'campaign-123',
        name: 'Test Campaign',
        description: null,
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      mockPost.mockResolvedValueOnce({ campaign: mockCampaign })

      const result = await createCampaign({ name: 'Test Campaign' })
      expect(result.id).toBe('campaign-123')
      expect(result.createdAt).toBe('2024-01-01T00:00:00Z')
      expect(result.updatedAt).toBe('2024-01-01T00:00:00Z')
    })
  })

  describe('Blog Draft Operations', () => {
    it('should create a blog draft via HTTP POST', async () => {
      const mockDraft = {
        id: 'draft-123',
        title: 'Test Blog Post',
        content: '# Hello World\n\nThis is a test.',
        status: 'draft',
        wordCount: 6,
        images: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        scheduledAt: null,
        date: null,
        notes: null,
        campaignId: null,
      }

      mockPost.mockResolvedValueOnce({ draft: mockDraft })

      const result = await createBlogDraft({
        title: 'Test Blog Post',
        content: '# Hello World\n\nThis is a test.',
      })

      expect(result.id).toBe('draft-123')
      expect(result.title).toBe('Test Blog Post')
      expect(result.wordCount).toBe(6)
      expect(result.createdAt).toBe('2024-01-01T00:00:00Z')
    })

    it('should return undefined when blog draft not found', async () => {
      mockGet.mockRejectedValueOnce(new Error('HTTP 404'))

      const result = await getBlogDraft('nonexistent')
      expect(result).toBeUndefined()
    })

    it('should update blog draft via HTTP PATCH', async () => {
      const mockDraft = {
        id: 'draft-123',
        title: 'Updated Title',
        content: 'New content here with more words',
        status: 'draft',
        wordCount: 6,
        images: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        scheduledAt: null,
        date: null,
        notes: null,
        campaignId: null,
      }

      mockPatch.mockResolvedValueOnce({ draft: mockDraft })

      const result = await updateBlogDraft('draft-123', {
        title: 'Updated Title',
        content: 'New content here with more words',
      })

      expect(result?.title).toBe('Updated Title')
      expect(result?.wordCount).toBe(6)
    })
  })
})
