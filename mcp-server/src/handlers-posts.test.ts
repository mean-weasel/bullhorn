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
import { validatePostContent } from './validation.js'

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
async function handleCreatePost(args: {
  platform?: string
  content?: unknown
  scheduledAt?: string
  status?: string
  notes?: string
  campaignId?: string
  groupId?: string
  groupType?: string
}): Promise<ToolResult> {
  const { platform, content, scheduledAt, status, notes, campaignId, groupId, groupType } =
    args as {
      platform: storage.Platform
      content: storage.Post['content']
      scheduledAt?: string
      status?: 'draft' | 'scheduled'
      notes?: string
      campaignId?: string
      groupId?: string
      groupType?: storage.GroupType
    }

  const validPlatforms = ['twitter', 'linkedin', 'reddit']
  if (!platform || !validPlatforms.includes(platform)) {
    return err('platform is required and must be one of: twitter, linkedin, reddit')
  }

  if (!content || typeof content !== 'object') {
    return err('content is required')
  }

  const contentError = validatePostContent(platform, content as unknown as Record<string, unknown>)
  if (contentError) {
    return err(contentError)
  }

  const post = await storage.createPost({
    platform,
    content,
    scheduledAt: scheduledAt || null,
    status: (status as storage.PostStatus) || 'draft',
    notes,
    campaignId,
    groupId,
    groupType,
  })

  return ok({ post })
}

async function handleGetPost(args: { id: string }): Promise<ToolResult> {
  const post = await storage.getPost(args.id)
  if (!post) return err(`Post with ID ${args.id} not found`)
  return ok({ post })
}

async function handleUpdatePost(args: { id: string; [key: string]: unknown }): Promise<ToolResult> {
  const { id, ...updates } = args as { id: string } & Partial<storage.Post>

  if (updates.platform && updates.content) {
    const contentError = validatePostContent(
      updates.platform,
      updates.content as unknown as Record<string, unknown>
    )
    if (contentError) return err(contentError)
  }

  const post = await storage.updatePost(id, updates)
  if (!post) return err(`Post with ID ${id} not found`)
  return ok({ post })
}

async function handleDeletePost(args: { id: string; confirmed?: boolean }): Promise<ToolResult> {
  if (!args.confirmed) {
    return err('Deletion not confirmed. Please set confirmed=true after confirming with the user.')
  }
  const success = await storage.deletePost(args.id)
  if (!success) return err(`Post with ID ${args.id} not found`)
  return ok({ message: `Post ${args.id} permanently deleted` })
}

async function handleArchivePost(args: { id: string; confirmed?: boolean }): Promise<ToolResult> {
  if (!args.confirmed) {
    return err('Archive not confirmed. Please set confirmed=true after confirming with the user.')
  }
  const post = await storage.archivePost(args.id)
  if (!post) return err(`Post with ID ${args.id} not found`)
  return ok({ post })
}

async function handleRestorePost(args: { id: string }): Promise<ToolResult> {
  const post = await storage.restorePost(args.id)
  if (!post) return err(`Post with ID ${args.id} not found`)
  return ok({ post })
}

async function handleListPosts(args: {
  status?: string
  platform?: string
  campaignId?: string
  groupId?: string
  limit?: number
}): Promise<ToolResult> {
  const posts = await storage.listPosts({
    status: args.status as storage.PostStatus | 'all',
    platform: args.platform as storage.Platform,
    campaignId: args.campaignId,
    groupId: args.groupId,
    limit: args.limit || 50,
  })
  return ok({ count: posts.length, posts })
}

async function handleSearchPosts(args: { query?: string; limit?: number }): Promise<ToolResult> {
  if (!args.query || args.query.trim() === '') {
    return err('search query is required')
  }
  const posts = await storage.searchPosts(args.query, { limit: args.limit || 50 })
  return ok({ count: posts.length, posts })
}

describe('Post Tool Handlers', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPatch.mockReset()
    mockDelete.mockReset()
    _resetClient()
  })

  describe('create_post', () => {
    it('should create a twitter post with valid content', async () => {
      const mockPostData = {
        id: 'post-1',
        platform: 'twitter',
        content: { text: 'Hello world' },
        status: 'draft',
      }
      mockPost.mockResolvedValueOnce({ post: mockPostData })

      const result = await handleCreatePost({
        platform: 'twitter',
        content: { text: 'Hello world' },
      })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.post).toEqual(mockPostData)
    })

    it('should create a linkedin post with valid content', async () => {
      const mockPostData = {
        id: 'post-2',
        platform: 'linkedin',
        content: { text: 'Professional update', visibility: 'public' },
        status: 'draft',
      }
      mockPost.mockResolvedValueOnce({ post: mockPostData })

      const result = await handleCreatePost({
        platform: 'linkedin',
        content: { text: 'Professional update', visibility: 'public' },
      })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.post).toEqual(mockPostData)
    })

    it('should create a reddit post with valid content', async () => {
      const mockPostData = {
        id: 'post-3',
        platform: 'reddit',
        content: { subreddit: 'test', title: 'Test Post' },
        status: 'draft',
      }
      mockPost.mockResolvedValueOnce({ post: mockPostData })

      const result = await handleCreatePost({
        platform: 'reddit',
        content: { subreddit: 'test', title: 'Test Post' },
      })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.post).toEqual(mockPostData)
    })

    it('should return error for invalid platform', async () => {
      const result = await handleCreatePost({
        platform: 'instagram',
        content: { text: 'hello' },
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain(
        'platform is required and must be one of: twitter, linkedin, reddit'
      )
    })

    it('should return error for missing platform', async () => {
      const result = await handleCreatePost({
        content: { text: 'hello' },
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('platform is required')
    })

    it('should return error for missing content', async () => {
      const result = await handleCreatePost({
        platform: 'twitter',
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('content is required')
    })

    it('should return error for twitter content without text', async () => {
      const result = await handleCreatePost({
        platform: 'twitter',
        content: { mediaUrls: ['url'] },
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Twitter content requires a non-empty "text" field')
    })

    it('should return error for reddit content without subreddit', async () => {
      const result = await handleCreatePost({
        platform: 'reddit',
        content: { title: 'Test' },
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Reddit content requires: subreddit')
    })

    it('should return error for reddit content without title', async () => {
      const result = await handleCreatePost({
        platform: 'reddit',
        content: { subreddit: 'test' },
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Reddit content requires: title')
    })

    it('should return error for linkedin content with invalid visibility', async () => {
      const result = await handleCreatePost({
        platform: 'linkedin',
        content: { text: 'test', visibility: 'private' },
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('LinkedIn visibility must be')
    })

    it('should pass scheduledAt, status, notes, and campaignId', async () => {
      const mockPostData = { id: 'post-4', platform: 'twitter', status: 'scheduled' }
      mockPost.mockResolvedValueOnce({ post: mockPostData })

      await handleCreatePost({
        platform: 'twitter',
        content: { text: 'Scheduled post' },
        scheduledAt: '2026-03-01T10:00:00Z',
        status: 'scheduled',
        notes: 'A note',
        campaignId: 'campaign-1',
      })

      expect(mockPost).toHaveBeenCalledWith('/posts', {
        platform: 'twitter',
        content: { text: 'Scheduled post' },
        scheduledAt: '2026-03-01T10:00:00Z',
        status: 'scheduled',
        notes: 'A note',
        campaignId: 'campaign-1',
        groupId: null,
        groupType: null,
      })
    })
  })

  describe('get_post', () => {
    it('should return post when found', async () => {
      const mockPostData = { id: 'post-1', platform: 'twitter', content: { text: 'Hello' } }
      mockGet.mockResolvedValueOnce({ post: mockPostData })

      const result = await handleGetPost({ id: 'post-1' })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.post).toEqual(mockPostData)
    })

    it('should return error when post not found', async () => {
      mockGet.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleGetPost({ id: 'nonexistent' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Post with ID nonexistent not found')
    })
  })

  describe('update_post', () => {
    it('should update post with valid data', async () => {
      const mockPostData = { id: 'post-1', platform: 'twitter', status: 'scheduled' }
      mockPatch.mockResolvedValueOnce({ post: mockPostData })

      const result = await handleUpdatePost({ id: 'post-1', status: 'scheduled' })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.post).toEqual(mockPostData)
    })

    it('should return error when post not found', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleUpdatePost({ id: 'nonexistent', status: 'draft' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Post with ID nonexistent not found')
    })

    it('should validate content when both platform and content are provided', async () => {
      const result = await handleUpdatePost({
        id: 'post-1',
        platform: 'twitter',
        content: { mediaUrls: [] },
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Twitter content requires a non-empty "text" field')
    })

    it('should skip validation when only content is provided without platform', async () => {
      const mockPostData = { id: 'post-1', content: { text: 'Updated' } }
      mockPatch.mockResolvedValueOnce({ post: mockPostData })

      const result = await handleUpdatePost({ id: 'post-1', content: { text: 'Updated' } })
      expect(result.isError).toBeUndefined()
    })
  })

  describe('delete_post', () => {
    it('should delete post when confirmed', async () => {
      mockDelete.mockResolvedValueOnce({})

      const result = await handleDeletePost({ id: 'post-1', confirmed: true })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.message).toContain('Post post-1 permanently deleted')
    })

    it('should return error when not confirmed', async () => {
      const result = await handleDeletePost({ id: 'post-1', confirmed: false })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Deletion not confirmed')
    })

    it('should return error when post not found', async () => {
      mockDelete.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleDeletePost({ id: 'nonexistent', confirmed: true })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Post with ID nonexistent not found')
    })
  })

  describe('archive_post', () => {
    it('should archive post when confirmed', async () => {
      const mockPostData = { id: 'post-1', status: 'archived' }
      mockPatch.mockResolvedValueOnce({ post: mockPostData })

      const result = await handleArchivePost({ id: 'post-1', confirmed: true })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.post.status).toBe('archived')
    })

    it('should return error when not confirmed', async () => {
      const result = await handleArchivePost({ id: 'post-1', confirmed: false })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Archive not confirmed')
    })

    it('should return error when post not found', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleArchivePost({ id: 'nonexistent', confirmed: true })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Post with ID nonexistent not found')
    })
  })

  describe('restore_post', () => {
    it('should restore archived post', async () => {
      const mockPostData = { id: 'post-1', status: 'draft' }
      mockPatch.mockResolvedValueOnce({ post: mockPostData })

      const result = await handleRestorePost({ id: 'post-1' })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.post.status).toBe('draft')
    })

    it('should return error when post not found', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleRestorePost({ id: 'nonexistent' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Post with ID nonexistent not found')
    })
  })

  describe('list_posts', () => {
    it('should list posts with no filters', async () => {
      const mockPosts = [{ id: 'p1' }, { id: 'p2' }]
      mockGet.mockResolvedValueOnce({ posts: mockPosts })

      const result = await handleListPosts({})
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.count).toBe(2)
      expect(response.posts).toEqual(mockPosts)
    })

    it('should pass status filter', async () => {
      mockGet.mockResolvedValueOnce({ posts: [] })

      await handleListPosts({ status: 'draft' })
      expect(mockGet).toHaveBeenCalledWith('/posts', expect.objectContaining({ status: 'draft' }))
    })

    it('should pass platform filter', async () => {
      mockGet.mockResolvedValueOnce({ posts: [] })

      await handleListPosts({ platform: 'twitter' })
      expect(mockGet).toHaveBeenCalledWith(
        '/posts',
        expect.objectContaining({ platform: 'twitter' })
      )
    })

    it('should use default limit of 50', async () => {
      mockGet.mockResolvedValueOnce({ posts: [] })

      await handleListPosts({})
      expect(mockGet).toHaveBeenCalledWith('/posts', expect.objectContaining({ limit: '50' }))
    })
  })

  describe('search_posts', () => {
    it('should return matching posts', async () => {
      const mockPosts = [{ id: 'p1', content: { text: 'hello world' } }]
      mockGet.mockResolvedValueOnce({ posts: mockPosts })

      const result = await handleSearchPosts({ query: 'hello' })
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.count).toBe(1)
      expect(response.posts).toEqual(mockPosts)
    })

    it('should return empty results', async () => {
      mockGet.mockResolvedValueOnce({ posts: [] })

      const result = await handleSearchPosts({ query: 'nonexistent' })
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.count).toBe(0)
      expect(response.posts).toEqual([])
    })

    it('should return error when query is empty', async () => {
      const result = await handleSearchPosts({ query: '' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('search query is required')
    })

    it('should return error when query is whitespace', async () => {
      const result = await handleSearchPosts({ query: '   ' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('search query is required')
    })
  })
})
