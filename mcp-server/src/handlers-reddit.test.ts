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
import { handleCreateRedditCrossposts } from './test-helpers.js'

const s = storage

// eslint-disable-next-line max-lines-per-function
describe('Reddit Cross-Post Tool Handlers', () => {
   
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPatch.mockReset()
    mockDelete.mockReset()
    _resetClient()
  })

  // eslint-disable-next-line max-lines-per-function
  describe('create_reddit_crossposts', () => {
     
    it('should return error when subreddits array is empty', async () => {
      const result = await handleCreateRedditCrossposts(s, { subreddits: [] })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('At least one subreddit is required')
    })

     
    it('should return error when subreddits is undefined', async () => {
      const result = await handleCreateRedditCrossposts(s, {
        subreddits: undefined as unknown as { subreddit: string; title: string }[],
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('At least one subreddit is required')
    })

     
    it('should return error when subreddit entry missing subreddit name', async () => {
      const result = await handleCreateRedditCrossposts(s, {
        subreddits: [{ subreddit: '', title: 'Test' }],
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Each subreddit entry requires subreddit and title')
    })

     
    it('should return error when subreddit entry missing title', async () => {
      const result = await handleCreateRedditCrossposts(s, {
        subreddits: [{ subreddit: 'test', title: '' }],
      })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Each subreddit entry requires subreddit and title')
    })

     
    it('should create posts for each subreddit with shared groupId', async () => {
      const mockPosts = [
        { id: 'p1', platform: 'reddit', content: { subreddit: 'startups', title: 'Test' } },
        { id: 'p2', platform: 'reddit', content: { subreddit: 'SaaS', title: 'Test' } },
      ]
      mockPost
        .mockResolvedValueOnce({ post: mockPosts[0] })
        .mockResolvedValueOnce({ post: mockPosts[1] })

      const result = await handleCreateRedditCrossposts(s, {
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
      expect(mockPost).toHaveBeenCalledTimes(2)

      const firstCall = mockPost.mock.calls[0]
      const secondCall = mockPost.mock.calls[1]
      expect(firstCall[1].groupId).toBe('test-group-id')
      expect(secondCall[1].groupId).toBe('test-group-id')
      expect(firstCall[1].groupType).toBe('reddit-crosspost')
      expect(secondCall[1].groupType).toBe('reddit-crosspost')
    })

     
    it('should use per-subreddit scheduledAt when provided', async () => {
      mockPost.mockResolvedValue({ post: { id: 'p1' } })
      await handleCreateRedditCrossposts(s, {
        subreddits: [
          { subreddit: 'sub1', title: 'T1', scheduledAt: '2024-01-01T10:00:00Z' },
          { subreddit: 'sub2', title: 'T2', scheduledAt: '2024-01-01T12:00:00Z' },
        ],
        defaultScheduledAt: '2024-01-01T08:00:00Z',
      })
      expect(mockPost.mock.calls[0][1].scheduledAt).toBe('2024-01-01T10:00:00Z')
      expect(mockPost.mock.calls[1][1].scheduledAt).toBe('2024-01-01T12:00:00Z')
    })

     
    it('should use defaultScheduledAt when subreddit has no scheduledAt', async () => {
      mockPost.mockResolvedValue({ post: { id: 'p1' } })
      await handleCreateRedditCrossposts(s, {
        subreddits: [{ subreddit: 'sub1', title: 'T1' }],
        defaultScheduledAt: '2024-01-01T08:00:00Z',
      })
      expect(mockPost.mock.calls[0][1].scheduledAt).toBe('2024-01-01T08:00:00Z')
    })

     
    it('should pass campaignId to all posts', async () => {
      mockPost.mockResolvedValue({ post: { id: 'p1' } })
      await handleCreateRedditCrossposts(s, {
        subreddits: [
          { subreddit: 'sub1', title: 'T1' },
          { subreddit: 'sub2', title: 'T2' },
        ],
        campaignId: 'campaign-123',
      })
      expect(mockPost.mock.calls[0][1].campaignId).toBe('campaign-123')
      expect(mockPost.mock.calls[1][1].campaignId).toBe('campaign-123')
    })

     
    it('should include body, url, and flairText when provided', async () => {
      mockPost.mockResolvedValue({ post: { id: 'p1' } })
      await handleCreateRedditCrossposts(s, {
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
      const content = mockPost.mock.calls[0][1].content as Record<string, string>
      expect(content.body).toBe('Post body')
      expect(content.url).toBe('https://example.com')
      expect(content.flairText).toBe('Discussion')
    })
  })
})
