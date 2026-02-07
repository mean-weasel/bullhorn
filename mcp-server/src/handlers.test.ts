import { describe, it, expect, vi, beforeEach } from 'vitest'

// Shared mock client methods — these persist across tests
const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

// Mock the client module — storage functions call through to BullhornClient
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

// Helper to simulate tool handler logic
// We extract the handler logic here to test it independently of the MCP server

type ToolResult = {
  content: { type: string; text: string }[]
  isError?: boolean
}

// Campaign tool handlers
async function handleCreateCampaign(args: {
  name: string
  description?: string
  status?: storage.CampaignStatus
}): Promise<ToolResult> {
  if (!args.name || args.name.trim() === '') {
    return {
      content: [{ type: 'text', text: 'Error: Campaign name is required' }],
      isError: true,
    }
  }

  const campaign = await storage.createCampaign({
    name: args.name.trim(),
    description: args.description,
    status: args.status || 'draft',
  })

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, campaign }, null, 2),
      },
    ],
  }
}

async function handleListCampaigns(args: {
  status?: storage.CampaignStatus | 'all'
  limit?: number
}): Promise<ToolResult> {
  const campaigns = await storage.listCampaigns({
    status: args.status,
    limit: args.limit || 50,
  })

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, count: campaigns.length, campaigns }, null, 2),
      },
    ],
  }
}

async function handleGetCampaign(args: { id: string }): Promise<ToolResult> {
  const result = await storage.getCampaign(args.id)

  if (!result) {
    return {
      content: [{ type: 'text', text: `Error: Campaign with ID ${args.id} not found` }],
      isError: true,
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, ...result }, null, 2),
      },
    ],
  }
}

async function handleDeleteCampaign(args: { id: string }): Promise<ToolResult> {
  const success = await storage.deleteCampaign(args.id)

  if (!success) {
    return {
      content: [{ type: 'text', text: `Error: Campaign with ID ${args.id} not found` }],
      isError: true,
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, message: `Campaign ${args.id} deleted` }, null, 2),
      },
    ],
  }
}

async function handleAddPostToCampaign(args: {
  campaignId: string
  postId: string
}): Promise<ToolResult> {
  const post = await storage.addPostToCampaign(args.campaignId, args.postId)

  if (!post) {
    return {
      content: [{ type: 'text', text: 'Error: Campaign or post not found' }],
      isError: true,
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, post }, null, 2),
      },
    ],
  }
}

async function handleRemovePostFromCampaign(args: {
  campaignId: string
  postId: string
}): Promise<ToolResult> {
  const post = await storage.removePostFromCampaign(args.campaignId, args.postId)

  if (!post) {
    return {
      content: [{ type: 'text', text: 'Error: Post not found' }],
      isError: true,
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ success: true, post }, null, 2),
      },
    ],
  }
}

// Reddit cross-post handler
async function handleCreateRedditCrossposts(args: {
  subreddits: Array<{
    subreddit: string
    title: string
    body?: string
    url?: string
    flairText?: string
    scheduledAt?: string
  }>
  defaultScheduledAt?: string
  status?: 'draft' | 'scheduled'
  notes?: string
  campaignId?: string
}): Promise<ToolResult> {
  if (!args.subreddits || args.subreddits.length === 0) {
    return {
      content: [{ type: 'text', text: 'Error: At least one subreddit is required' }],
      isError: true,
    }
  }

  // Validate all subreddits have titles
  for (const sub of args.subreddits) {
    if (!sub.subreddit || !sub.title) {
      return {
        content: [
          { type: 'text', text: 'Error: Each subreddit entry requires subreddit and title' },
        ],
        isError: true,
      }
    }
  }

  // Generate a shared groupId for all posts
  const groupId = 'test-group-id' // In real code this would be crypto.randomUUID()
  const createdPosts: storage.Post[] = []

  for (const sub of args.subreddits) {
    const post = await storage.createPost({
      platform: 'reddit' as storage.Platform,
      content: {
        subreddit: sub.subreddit,
        title: sub.title,
        body: sub.body,
        url: sub.url,
        flairText: sub.flairText,
      },
      scheduledAt: sub.scheduledAt || args.defaultScheduledAt || null,
      status: args.status || 'draft',
      notes: args.notes,
      campaignId: args.campaignId,
      groupId,
      groupType: 'reddit-crosspost',
    })
    createdPosts.push(post)
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            groupId,
            count: createdPosts.length,
            posts: createdPosts,
          },
          null,
          2
        ),
      },
    ],
  }
}

describe('Tool Handlers', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPatch.mockReset()
    mockDelete.mockReset()
    _resetClient()
  })

  describe('Campaign Tools', () => {
    describe('create_campaign', () => {
      it('should return error when name is empty', async () => {
        const result = await handleCreateCampaign({ name: '' })
        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('Campaign name is required')
      })

      it('should return error when name is whitespace only', async () => {
        const result = await handleCreateCampaign({ name: '   ' })
        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('Campaign name is required')
      })

      it('should create campaign with trimmed name', async () => {
        const mockCampaign = { id: 'campaign-1', name: 'Test', status: 'draft' }
        mockPost.mockResolvedValueOnce({ campaign: mockCampaign })

        const result = await handleCreateCampaign({ name: '  Test  ' })
        expect(result.isError).toBeUndefined()

        const response = JSON.parse(result.content[0].text)
        expect(response.success).toBe(true)
        expect(response.campaign).toEqual(mockCampaign)

        expect(mockPost).toHaveBeenCalledWith('/campaigns', {
          name: 'Test',
          description: null,
          status: 'draft',
        })
      })

      it('should pass description and status when provided', async () => {
        const mockCampaign = {
          id: 'campaign-1',
          name: 'Test',
          description: 'Desc',
          status: 'active',
        }
        mockPost.mockResolvedValueOnce({ campaign: mockCampaign })

        await handleCreateCampaign({
          name: 'Test',
          description: 'Desc',
          status: 'active',
        })

        expect(mockPost).toHaveBeenCalledWith('/campaigns', {
          name: 'Test',
          description: 'Desc',
          status: 'active',
        })
      })
    })

    describe('list_campaigns', () => {
      it('should return campaigns list', async () => {
        const mockCampaigns = [{ id: 'c1' }, { id: 'c2' }]
        mockGet.mockResolvedValueOnce({ campaigns: mockCampaigns })

        const result = await handleListCampaigns({})
        const response = JSON.parse(result.content[0].text)

        expect(response.success).toBe(true)
        expect(response.count).toBe(2)
        expect(response.campaigns).toEqual(mockCampaigns)
      })

      it('should use default limit of 50', async () => {
        mockGet.mockResolvedValueOnce({ campaigns: [] })

        await handleListCampaigns({})

        expect(mockGet).toHaveBeenCalledWith('/campaigns', { limit: '50' })
      })

      it('should pass custom limit', async () => {
        mockGet.mockResolvedValueOnce({ campaigns: [] })

        await handleListCampaigns({ limit: 10 })

        expect(mockGet).toHaveBeenCalledWith('/campaigns', { limit: '10' })
      })
    })

    describe('get_campaign', () => {
      it('should return error when campaign not found', async () => {
        mockGet.mockRejectedValueOnce(new Error('Not found'))

        const result = await handleGetCampaign({ id: 'nonexistent' })
        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('Campaign with ID nonexistent not found')
      })

      it('should return campaign with posts when found', async () => {
        const mockResult = {
          campaign: { id: 'c1', name: 'Test' },
          posts: [{ id: 'p1' }],
        }
        mockGet.mockResolvedValueOnce(mockResult)

        const result = await handleGetCampaign({ id: 'c1' })
        const response = JSON.parse(result.content[0].text)

        expect(response.success).toBe(true)
        expect(response.campaign).toEqual(mockResult.campaign)
        expect(response.posts).toEqual(mockResult.posts)
      })
    })

    describe('delete_campaign', () => {
      it('should return error when campaign not found', async () => {
        mockDelete.mockRejectedValueOnce(new Error('Not found'))

        const result = await handleDeleteCampaign({ id: 'nonexistent' })
        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('Campaign with ID nonexistent not found')
      })

      it('should return success message when deleted', async () => {
        mockDelete.mockResolvedValueOnce({})

        const result = await handleDeleteCampaign({ id: 'c1' })
        const response = JSON.parse(result.content[0].text)

        expect(response.success).toBe(true)
        expect(response.message).toContain('Campaign c1 deleted')
      })
    })

    describe('add_post_to_campaign', () => {
      it('should return error when campaign or post not found', async () => {
        // addPostToCampaign calls updatePost which calls client.patch
        mockPatch.mockRejectedValueOnce(new Error('Not found'))

        const result = await handleAddPostToCampaign({
          campaignId: 'c1',
          postId: 'p1',
        })
        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('Campaign or post not found')
      })

      it('should return updated post when successful', async () => {
        const mockPostData = { id: 'p1', campaignId: 'c1' }
        mockPatch.mockResolvedValueOnce({ post: mockPostData })

        const result = await handleAddPostToCampaign({
          campaignId: 'c1',
          postId: 'p1',
        })
        const response = JSON.parse(result.content[0].text)

        expect(response.success).toBe(true)
        expect(response.post).toEqual(mockPostData)
      })
    })

    describe('remove_post_from_campaign', () => {
      it('should return error when post not found', async () => {
        mockPatch.mockRejectedValueOnce(new Error('Not found'))

        const result = await handleRemovePostFromCampaign({
          campaignId: 'c1',
          postId: 'p1',
        })
        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('Post not found')
      })

      it('should return updated post when successful', async () => {
        const mockPostData = { id: 'p1', campaignId: undefined }
        mockPatch.mockResolvedValueOnce({ post: mockPostData })

        const result = await handleRemovePostFromCampaign({
          campaignId: 'c1',
          postId: 'p1',
        })
        const response = JSON.parse(result.content[0].text)

        expect(response.success).toBe(true)
        expect(response.post).toEqual(mockPostData)
      })
    })
  })

  describe('Reddit Cross-Post Tool', () => {
    describe('create_reddit_crossposts', () => {
      it('should return error when subreddits array is empty', async () => {
        const result = await handleCreateRedditCrossposts({ subreddits: [] })
        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('At least one subreddit is required')
      })

      it('should return error when subreddits is undefined', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await handleCreateRedditCrossposts({
          subreddits: undefined as unknown as any[],
        })
        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain('At least one subreddit is required')
      })

      it('should return error when subreddit entry missing subreddit name', async () => {
        const result = await handleCreateRedditCrossposts({
          subreddits: [{ subreddit: '', title: 'Test' }],
        })
        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain(
          'Each subreddit entry requires subreddit and title'
        )
      })

      it('should return error when subreddit entry missing title', async () => {
        const result = await handleCreateRedditCrossposts({
          subreddits: [{ subreddit: 'test', title: '' }],
        })
        expect(result.isError).toBe(true)
        expect(result.content[0].text).toContain(
          'Each subreddit entry requires subreddit and title'
        )
      })

      it('should create posts for each subreddit with shared groupId', async () => {
        const mockPosts = [
          { id: 'p1', platform: 'reddit', content: { subreddit: 'startups', title: 'Test' } },
          { id: 'p2', platform: 'reddit', content: { subreddit: 'SaaS', title: 'Test' } },
        ]
        mockPost
          .mockResolvedValueOnce({ post: mockPosts[0] })
          .mockResolvedValueOnce({ post: mockPosts[1] })

        const result = await handleCreateRedditCrossposts({
          subreddits: [
            { subreddit: 'startups', title: 'Test' },
            { subreddit: 'SaaS', title: 'Test' },
          ],
        })

        const response = JSON.parse(result.content[0].text)
        expect(response.success).toBe(true)
        expect(response.count).toBe(2)
        expect(response.groupId).toBe('test-group-id')
        expect(response.posts).toHaveLength(2)

        // Verify both posts were created with the same groupId
        expect(mockPost).toHaveBeenCalledTimes(2)

        const firstCall = mockPost.mock.calls[0]
        const secondCall = mockPost.mock.calls[1]

        // client.post is called with (path, body)
        expect(firstCall[1].groupId).toBe('test-group-id')
        expect(secondCall[1].groupId).toBe('test-group-id')
        expect(firstCall[1].groupType).toBe('reddit-crosspost')
        expect(secondCall[1].groupType).toBe('reddit-crosspost')
      })

      it('should use per-subreddit scheduledAt when provided', async () => {
        mockPost.mockResolvedValue({ post: { id: 'p1' } })

        await handleCreateRedditCrossposts({
          subreddits: [
            { subreddit: 'sub1', title: 'T1', scheduledAt: '2024-01-01T10:00:00Z' },
            { subreddit: 'sub2', title: 'T2', scheduledAt: '2024-01-01T12:00:00Z' },
          ],
          defaultScheduledAt: '2024-01-01T08:00:00Z',
        })

        const calls = mockPost.mock.calls
        expect(calls[0][1].scheduledAt).toBe('2024-01-01T10:00:00Z')
        expect(calls[1][1].scheduledAt).toBe('2024-01-01T12:00:00Z')
      })

      it('should use defaultScheduledAt when subreddit has no scheduledAt', async () => {
        mockPost.mockResolvedValue({ post: { id: 'p1' } })

        await handleCreateRedditCrossposts({
          subreddits: [{ subreddit: 'sub1', title: 'T1' }],
          defaultScheduledAt: '2024-01-01T08:00:00Z',
        })

        const call = mockPost.mock.calls[0]
        expect(call[1].scheduledAt).toBe('2024-01-01T08:00:00Z')
      })

      it('should pass campaignId to all posts', async () => {
        mockPost.mockResolvedValue({ post: { id: 'p1' } })

        await handleCreateRedditCrossposts({
          subreddits: [
            { subreddit: 'sub1', title: 'T1' },
            { subreddit: 'sub2', title: 'T2' },
          ],
          campaignId: 'campaign-123',
        })

        const calls = mockPost.mock.calls
        expect(calls[0][1].campaignId).toBe('campaign-123')
        expect(calls[1][1].campaignId).toBe('campaign-123')
      })

      it('should include body, url, and flairText when provided', async () => {
        mockPost.mockResolvedValue({ post: { id: 'p1' } })

        await handleCreateRedditCrossposts({
          subreddits: [
            {
              subreddit: 'test',
              title: 'My Post',
              body: 'Post body',
              url: 'https://example.com',
              flairText: 'Discussion',
            },
          ],
        })

        const call = mockPost.mock.calls[0]
        const content = call[1].content as { body?: string; url?: string; flairText?: string }
        expect(content.body).toBe('Post body')
        expect(content.url).toBe('https://example.com')
        expect(content.flairText).toBe('Discussion')
      })
    })
  })
})
