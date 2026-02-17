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
async function handleCreateLaunchPost(args: {
  platform?: string
  title?: string
  url?: string
  description?: string
  platformFields?: Record<string, unknown>
  campaignId?: string
  scheduledAt?: string
  notes?: string
  status?: string
}): Promise<ToolResult> {
  const {
    platform,
    title,
    url,
    description,
    platformFields,
    campaignId,
    scheduledAt,
    notes,
    status,
  } = args

  if (!platform || !title) {
    return err('platform and title are required')
  }

  const launchPost = await storage.createLaunchPost({
    platform: platform as storage.LaunchPlatform,
    title,
    url,
    description,
    platformFields,
    campaignId,
    scheduledAt,
    notes,
    status,
  })

  return ok({ launchPost })
}

async function handleGetLaunchPost(args: { id: string }): Promise<ToolResult> {
  const launchPost = await storage.getLaunchPost(args.id)
  if (!launchPost) return err(`Launch post with ID ${args.id} not found`)
  return ok({ launchPost })
}

async function handleUpdateLaunchPost(args: {
  id: string
  [key: string]: unknown
}): Promise<ToolResult> {
  const { id, ...updates } = args as { id: string } & Partial<storage.LaunchPost>
  const launchPost = await storage.updateLaunchPost(id, updates)
  if (!launchPost) return err(`Launch post with ID ${id} not found`)
  return ok({ launchPost })
}

async function handleDeleteLaunchPost(args: {
  id: string
  confirmed?: boolean
}): Promise<ToolResult> {
  if (!args.confirmed) {
    return err('Deletion not confirmed. Please set confirmed=true after confirming with the user.')
  }

  const success = await storage.deleteLaunchPost(args.id)

  if (!success) return err(`Launch post with ID ${args.id} not found`)

  return ok({ message: `Launch post ${args.id} deleted` })
}

async function handleListLaunchPosts(args: {
  platform?: string
  status?: string
  campaignId?: string
  limit?: number
}): Promise<ToolResult> {
  const launchPosts = await storage.listLaunchPosts({
    platform: args.platform as storage.LaunchPlatform,
    status: args.status,
    campaignId: args.campaignId,
    limit: args.limit || 50,
  })

  return ok({ count: launchPosts.length, launchPosts })
}

describe('Launch Post Tool Handlers', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPatch.mockReset()
    mockDelete.mockReset()
    _resetClient()
  })

  describe('create_launch_post', () => {
    it('should create a launch post with valid platform and title', async () => {
      const mockLaunchPost = {
        id: 'lp-1',
        platform: 'product_hunt',
        title: 'Launch Bullhorn',
        status: 'draft',
      }
      mockPost.mockResolvedValueOnce({ launchPost: mockLaunchPost })

      const result = await handleCreateLaunchPost({
        platform: 'product_hunt',
        title: 'Launch Bullhorn',
      })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.launchPost).toEqual(mockLaunchPost)
    })

    it('should create a launch post with all fields', async () => {
      const mockLaunchPost = {
        id: 'lp-2',
        platform: 'hacker_news_show',
        title: 'Show HN: Bullhorn',
        status: 'scheduled',
      }
      mockPost.mockResolvedValueOnce({ launchPost: mockLaunchPost })

      await handleCreateLaunchPost({
        platform: 'hacker_news_show',
        title: 'Show HN: Bullhorn',
        url: 'https://bullhorn.to',
        description: 'A social media scheduler',
        platformFields: { tags: ['social', 'productivity'] },
        campaignId: 'camp-1',
        scheduledAt: '2026-03-01T10:00:00Z',
        notes: 'Launch day!',
        status: 'scheduled',
      })

      expect(mockPost).toHaveBeenCalledWith('/launch-posts', {
        platform: 'hacker_news_show',
        title: 'Show HN: Bullhorn',
        url: 'https://bullhorn.to',
        description: 'A social media scheduler',
        platformFields: { tags: ['social', 'productivity'] },
        campaignId: 'camp-1',
        scheduledAt: '2026-03-01T10:00:00Z',
        notes: 'Launch day!',
        status: 'scheduled',
      })
    })

    it('should return error when platform is missing', async () => {
      const result = await handleCreateLaunchPost({ title: 'My Launch' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('platform and title are required')
    })

    it('should return error when title is missing', async () => {
      const result = await handleCreateLaunchPost({ platform: 'product_hunt' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('platform and title are required')
    })

    it('should return error when both platform and title are missing', async () => {
      const result = await handleCreateLaunchPost({})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('platform and title are required')
    })

    it('should create launch posts for different platforms', async () => {
      const platforms = [
        'hacker_news_show',
        'hacker_news_ask',
        'hacker_news_link',
        'product_hunt',
        'dev_hunt',
        'beta_list',
        'indie_hackers',
      ]

      for (const platform of platforms) {
        mockPost.mockResolvedValueOnce({
          launchPost: { id: `lp-${platform}`, platform, title: 'Test', status: 'draft' },
        })

        const result = await handleCreateLaunchPost({ platform, title: 'Test' })
        expect(result.isError).toBeUndefined()
        const response = JSON.parse(result.content[0].text)
        expect(response.success).toBe(true)
        expect(response.launchPost.platform).toBe(platform)
      }
    })
  })

  describe('get_launch_post', () => {
    it('should return launch post when found', async () => {
      const mockLaunchPost = {
        id: 'lp-1',
        platform: 'product_hunt',
        title: 'My Launch',
        status: 'draft',
      }
      mockGet.mockResolvedValueOnce({ launchPost: mockLaunchPost })

      const result = await handleGetLaunchPost({ id: 'lp-1' })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.launchPost).toEqual(mockLaunchPost)
    })

    it('should return error when launch post not found', async () => {
      mockGet.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleGetLaunchPost({ id: 'nonexistent' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Launch post with ID nonexistent not found')
    })
  })

  describe('update_launch_post', () => {
    it('should update launch post with valid data', async () => {
      const mockLaunchPost = {
        id: 'lp-1',
        platform: 'product_hunt',
        title: 'Updated Title',
        status: 'scheduled',
      }
      mockPatch.mockResolvedValueOnce({ launchPost: mockLaunchPost })

      const result = await handleUpdateLaunchPost({
        id: 'lp-1',
        title: 'Updated Title',
        status: 'scheduled',
      })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.launchPost).toEqual(mockLaunchPost)
    })

    it('should return error when launch post not found', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleUpdateLaunchPost({ id: 'nonexistent', title: 'New Title' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Launch post with ID nonexistent not found')
    })

    it('should update platform fields', async () => {
      const mockLaunchPost = {
        id: 'lp-1',
        platform: 'product_hunt',
        platformFields: { tagline: 'New tagline' },
      }
      mockPatch.mockResolvedValueOnce({ launchPost: mockLaunchPost })

      const result = await handleUpdateLaunchPost({
        id: 'lp-1',
        platformFields: { tagline: 'New tagline' },
      })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.launchPost.platformFields).toEqual({ tagline: 'New tagline' })
    })

    it('should update url and description', async () => {
      const mockLaunchPost = {
        id: 'lp-1',
        url: 'https://newurl.com',
        description: 'New description',
      }
      mockPatch.mockResolvedValueOnce({ launchPost: mockLaunchPost })

      const result = await handleUpdateLaunchPost({
        id: 'lp-1',
        url: 'https://newurl.com',
        description: 'New description',
      })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.launchPost.url).toBe('https://newurl.com')
      expect(response.launchPost.description).toBe('New description')
    })
  })

  describe('delete_launch_post', () => {
    it('should delete launch post when confirmed', async () => {
      mockDelete.mockResolvedValueOnce({})

      const result = await handleDeleteLaunchPost({ id: 'lp-1', confirmed: true })
      expect(result.isError).toBeUndefined()
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.message).toContain('Launch post lp-1 deleted')
    })

    it('should return error when not confirmed', async () => {
      const result = await handleDeleteLaunchPost({ id: 'lp-1', confirmed: false })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Deletion not confirmed')
    })

    it('should return error when confirmed is missing', async () => {
      const result = await handleDeleteLaunchPost({ id: 'lp-1' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Deletion not confirmed')
    })

    it('should return error when launch post not found', async () => {
      mockDelete.mockRejectedValueOnce(new Error('Not found'))

      const result = await handleDeleteLaunchPost({ id: 'nonexistent', confirmed: true })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Launch post with ID nonexistent not found')
    })
  })

  describe('list_launch_posts', () => {
    it('should list launch posts with no filters', async () => {
      const mockLaunchPosts = [
        { id: 'lp1', platform: 'product_hunt', title: 'Launch 1' },
        { id: 'lp2', platform: 'hacker_news_show', title: 'Launch 2' },
      ]
      mockGet.mockResolvedValueOnce({ launchPosts: mockLaunchPosts })

      const result = await handleListLaunchPosts({})
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.count).toBe(2)
      expect(response.launchPosts).toEqual(mockLaunchPosts)
    })

    it('should pass platform filter', async () => {
      mockGet.mockResolvedValueOnce({ launchPosts: [] })

      await handleListLaunchPosts({ platform: 'product_hunt' })
      expect(mockGet).toHaveBeenCalledWith(
        '/launch-posts',
        expect.objectContaining({ platform: 'product_hunt' })
      )
    })

    it('should pass status filter', async () => {
      mockGet.mockResolvedValueOnce({ launchPosts: [] })

      await handleListLaunchPosts({ status: 'draft' })
      expect(mockGet).toHaveBeenCalledWith(
        '/launch-posts',
        expect.objectContaining({ status: 'draft' })
      )
    })

    it('should pass campaignId filter', async () => {
      mockGet.mockResolvedValueOnce({ launchPosts: [] })

      await handleListLaunchPosts({ campaignId: 'camp-1' })
      expect(mockGet).toHaveBeenCalledWith(
        '/launch-posts',
        expect.objectContaining({ campaignId: 'camp-1' })
      )
    })

    it('should use default limit of 50', async () => {
      mockGet.mockResolvedValueOnce({ launchPosts: [] })

      await handleListLaunchPosts({})
      expect(mockGet).toHaveBeenCalledWith(
        '/launch-posts',
        expect.objectContaining({ limit: '50' })
      )
    })

    it('should pass custom limit', async () => {
      mockGet.mockResolvedValueOnce({ launchPosts: [] })

      await handleListLaunchPosts({ limit: 10 })
      expect(mockGet).toHaveBeenCalledWith(
        '/launch-posts',
        expect.objectContaining({ limit: '10' })
      )
    })

    it('should return empty results', async () => {
      mockGet.mockResolvedValueOnce({ launchPosts: [] })

      const result = await handleListLaunchPosts({})
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.count).toBe(0)
      expect(response.launchPosts).toEqual([])
    })
  })
})
