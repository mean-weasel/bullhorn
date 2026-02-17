import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  useLaunchPostsStore,
  getHackerNewsFields,
  getProductHuntFields,
  getDevHuntFields,
  getBetaListFields,
  getIndieHackersFields,
  getDefaultPlatformFields,
} from './launchPosts'
import type { LaunchPost } from './launchPosts'
import { clearInFlightRequests } from './requestDedup'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
  clearInFlightRequests()
  useLaunchPostsStore.setState({
    launchPosts: [],
    loading: false,
    error: null,
    initialized: false,
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a camelCase LaunchPost (frontend shape) */
const makeLaunchPost = (overrides: Partial<LaunchPost> = {}): LaunchPost => ({
  id: 'lp-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  platform: 'product_hunt',
  status: 'draft',
  scheduledAt: null,
  postedAt: null,
  title: 'Launch Post Title',
  url: 'https://example.com',
  description: 'A description',
  platformFields: {},
  campaignId: null,
  notes: null,
  ...overrides,
})

/** Creates a snake_case DB row (what the API returns) */
const makeDbLaunchPost = (overrides: Record<string, unknown> = {}) => ({
  id: 'lp-1',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  platform: 'product_hunt',
  status: 'draft',
  scheduled_at: null,
  posted_at: null,
  title: 'Launch Post Title',
  url: 'https://example.com',
  description: 'A description',
  platform_fields: {},
  campaign_id: null,
  notes: null,
  ...overrides,
})

// ---------------------------------------------------------------------------
// fetchLaunchPosts
// ---------------------------------------------------------------------------

describe('useLaunchPostsStore', () => {
  describe('fetchLaunchPosts', () => {
    it('should set loading true while fetching', async () => {
      let capturedLoading = false
      mockFetch.mockImplementation(() => {
        capturedLoading = useLaunchPostsStore.getState().loading
        return Promise.resolve({
          ok: true,
          json: async () => ({ launchPosts: [] }),
        })
      })

      await useLaunchPostsStore.getState().fetchLaunchPosts()
      expect(capturedLoading).toBe(true)
    })

    it('should populate launch posts on success and transform from DB format', async () => {
      const dbPosts = [makeDbLaunchPost(), makeDbLaunchPost({ id: 'lp-2', title: 'Second' })]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ launchPosts: dbPosts }),
      })

      await useLaunchPostsStore.getState().fetchLaunchPosts()

      const state = useLaunchPostsStore.getState()
      expect(state.launchPosts).toHaveLength(2)
      expect(state.launchPosts[0].id).toBe('lp-1')
      expect(state.launchPosts[0].createdAt).toBe('2024-01-01T00:00:00Z')
      expect(state.launchPosts[0].platformFields).toEqual({})
      expect(state.launchPosts[1].title).toBe('Second')
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should set initialized after first fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ launchPosts: [] }),
      })

      expect(useLaunchPostsStore.getState().initialized).toBe(false)
      await useLaunchPostsStore.getState().fetchLaunchPosts()
      expect(useLaunchPostsStore.getState().initialized).toBe(true)
    })

    it('should set error on failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })

      await useLaunchPostsStore.getState().fetchLaunchPosts()

      const state = useLaunchPostsStore.getState()
      expect(state.error).toBe('Failed to fetch launch posts')
      expect(state.loading).toBe(false)
    })

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await useLaunchPostsStore.getState().fetchLaunchPosts()
      expect(useLaunchPostsStore.getState().error).toBe('Network error')
    })

    it('should default to empty array when response has no launchPosts key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await useLaunchPostsStore.getState().fetchLaunchPosts()
      expect(useLaunchPostsStore.getState().launchPosts).toEqual([])
    })

    it('should pass campaignId and platform as query params', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ launchPosts: [] }),
      })

      await useLaunchPostsStore
        .getState()
        .fetchLaunchPosts({ campaignId: 'camp-1', platform: 'product_hunt' })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('campaignId=camp-1')
      expect(calledUrl).toContain('platform=product_hunt')
    })

    it('should call base URL when no options provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ launchPosts: [] }),
      })

      await useLaunchPostsStore.getState().fetchLaunchPosts()
      expect(mockFetch).toHaveBeenCalledWith('/api/launch-posts')
    })

    it('should deduplicate concurrent calls with same params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ launchPosts: [] }),
      })

      await Promise.all([
        useLaunchPostsStore.getState().fetchLaunchPosts(),
        useLaunchPostsStore.getState().fetchLaunchPosts(),
      ])

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // addLaunchPost
  // ---------------------------------------------------------------------------

  describe('addLaunchPost', () => {
    it('should POST to /api/launch-posts and add transformed post to items', async () => {
      const dbPost = makeDbLaunchPost()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ launchPost: dbPost }),
      })

      const result = await useLaunchPostsStore.getState().addLaunchPost({
        platform: 'product_hunt',
        title: 'Launch Post Title',
        url: 'https://example.com',
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/launch-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.any(String),
      })
      expect(result.id).toBe('lp-1')
      expect(result.createdAt).toBe('2024-01-01T00:00:00Z')
      expect(useLaunchPostsStore.getState().launchPosts).toHaveLength(1)
    })

    it('should prepend new post to existing list', async () => {
      useLaunchPostsStore.setState({ launchPosts: [makeLaunchPost({ id: 'existing' })] })

      const dbPost = makeDbLaunchPost({ id: 'new-1' })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ launchPost: dbPost }),
      })

      await useLaunchPostsStore.getState().addLaunchPost({
        platform: 'product_hunt',
        title: 'New',
      })

      const posts = useLaunchPostsStore.getState().launchPosts
      expect(posts).toHaveLength(2)
      expect(posts[0].id).toBe('new-1')
      expect(posts[1].id).toBe('existing')
    })

    it('should set error and throw on failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })

      await expect(
        useLaunchPostsStore.getState().addLaunchPost({
          platform: 'product_hunt',
          title: 'Fail',
        })
      ).rejects.toThrow('Failed to create launch post')

      expect(useLaunchPostsStore.getState().error).toBe('Failed to create launch post')
      expect(useLaunchPostsStore.getState().loading).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // updateLaunchPost
  // ---------------------------------------------------------------------------

  describe('updateLaunchPost', () => {
    it('should PATCH and update the launch post in state', async () => {
      useLaunchPostsStore.setState({ launchPosts: [makeLaunchPost()] })

      const dbUpdated = makeDbLaunchPost({ title: 'Updated Title' })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ launchPost: dbUpdated }),
      })

      await useLaunchPostsStore.getState().updateLaunchPost('lp-1', { title: 'Updated Title' })

      expect(mockFetch).toHaveBeenCalledWith('/api/launch-posts/lp-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated Title' }),
      })
      expect(useLaunchPostsStore.getState().launchPosts[0].title).toBe('Updated Title')
    })

    it('should set error and throw on failure', async () => {
      useLaunchPostsStore.setState({ launchPosts: [makeLaunchPost()] })
      mockFetch.mockResolvedValueOnce({ ok: false })

      await expect(
        useLaunchPostsStore.getState().updateLaunchPost('lp-1', { title: 'Fail' })
      ).rejects.toThrow('Failed to update launch post')

      expect(useLaunchPostsStore.getState().error).toBe('Failed to update launch post')
    })
  })

  // ---------------------------------------------------------------------------
  // deleteLaunchPost
  // ---------------------------------------------------------------------------

  describe('deleteLaunchPost', () => {
    it('should DELETE and remove the launch post from state', async () => {
      useLaunchPostsStore.setState({
        launchPosts: [makeLaunchPost({ id: 'lp-1' }), makeLaunchPost({ id: 'lp-2' })],
      })

      mockFetch.mockResolvedValueOnce({ ok: true })

      await useLaunchPostsStore.getState().deleteLaunchPost('lp-1')

      expect(mockFetch).toHaveBeenCalledWith('/api/launch-posts/lp-1', { method: 'DELETE' })
      const posts = useLaunchPostsStore.getState().launchPosts
      expect(posts).toHaveLength(1)
      expect(posts[0].id).toBe('lp-2')
    })

    it('should set error and throw on failure', async () => {
      useLaunchPostsStore.setState({ launchPosts: [makeLaunchPost()] })
      mockFetch.mockResolvedValueOnce({ ok: false })

      await expect(useLaunchPostsStore.getState().deleteLaunchPost('lp-1')).rejects.toThrow(
        'Failed to delete launch post'
      )

      expect(useLaunchPostsStore.getState().error).toBe('Failed to delete launch post')
    })
  })

  // ---------------------------------------------------------------------------
  // getLaunchPost
  // ---------------------------------------------------------------------------

  describe('getLaunchPost', () => {
    it('should return a launch post by id', () => {
      const post = makeLaunchPost()
      useLaunchPostsStore.setState({ launchPosts: [post] })
      expect(useLaunchPostsStore.getState().getLaunchPost('lp-1')).toEqual(post)
    })

    it('should return undefined for unknown id', () => {
      useLaunchPostsStore.setState({ launchPosts: [makeLaunchPost()] })
      expect(useLaunchPostsStore.getState().getLaunchPost('nonexistent')).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // getLaunchPostsByPlatform
  // ---------------------------------------------------------------------------

  describe('getLaunchPostsByPlatform', () => {
    it('should filter by platform', () => {
      useLaunchPostsStore.setState({
        launchPosts: [
          makeLaunchPost({ id: '1', platform: 'product_hunt' }),
          makeLaunchPost({ id: '2', platform: 'hacker_news_show' }),
          makeLaunchPost({ id: '3', platform: 'product_hunt' }),
        ],
      })

      const result = useLaunchPostsStore.getState().getLaunchPostsByPlatform('product_hunt')
      expect(result).toHaveLength(2)
      expect(result.map((p) => p.id)).toEqual(['1', '3'])
    })

    it('should return all posts when no platform provided', () => {
      useLaunchPostsStore.setState({
        launchPosts: [makeLaunchPost({ id: '1' }), makeLaunchPost({ id: '2' })],
      })

      expect(useLaunchPostsStore.getState().getLaunchPostsByPlatform()).toHaveLength(2)
    })
  })

  // ---------------------------------------------------------------------------
  // getLaunchPostsByCampaign
  // ---------------------------------------------------------------------------

  describe('getLaunchPostsByCampaign', () => {
    it('should filter by campaignId', () => {
      useLaunchPostsStore.setState({
        launchPosts: [
          makeLaunchPost({ id: '1', campaignId: 'camp-1' }),
          makeLaunchPost({ id: '2', campaignId: 'camp-2' }),
          makeLaunchPost({ id: '3', campaignId: 'camp-1' }),
        ],
      })

      const result = useLaunchPostsStore.getState().getLaunchPostsByCampaign('camp-1')
      expect(result).toHaveLength(2)
      expect(result.map((p) => p.id)).toEqual(['1', '3'])
    })

    it('should return unassigned posts when campaignId is null', () => {
      useLaunchPostsStore.setState({
        launchPosts: [
          makeLaunchPost({ id: '1', campaignId: 'camp-1' }),
          makeLaunchPost({ id: '2', campaignId: null }),
        ],
      })

      const result = useLaunchPostsStore.getState().getLaunchPostsByCampaign(null)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('2')
    })
  })

  // ---------------------------------------------------------------------------
  // getLaunchPostsByStatus
  // ---------------------------------------------------------------------------

  describe('getLaunchPostsByStatus', () => {
    it('should filter by status', () => {
      useLaunchPostsStore.setState({
        launchPosts: [
          makeLaunchPost({ id: '1', status: 'draft' }),
          makeLaunchPost({ id: '2', status: 'posted' }),
          makeLaunchPost({ id: '3', status: 'draft' }),
        ],
      })

      const result = useLaunchPostsStore.getState().getLaunchPostsByStatus('draft')
      expect(result).toHaveLength(2)
      expect(result.map((p) => p.id)).toEqual(['1', '3'])
    })

    it('should return all posts when no status provided', () => {
      useLaunchPostsStore.setState({
        launchPosts: [makeLaunchPost({ id: '1' }), makeLaunchPost({ id: '2' })],
      })

      expect(useLaunchPostsStore.getState().getLaunchPostsByStatus()).toHaveLength(2)
    })
  })
})

// ---------------------------------------------------------------------------
// Platform field helper functions
// ---------------------------------------------------------------------------

describe('getHackerNewsFields', () => {
  it('should return platformFields as HackerNewsFields', () => {
    const post = makeLaunchPost({
      platform: 'hacker_news_ask',
      platformFields: { text: 'How do you deploy?' },
    })
    const fields = getHackerNewsFields(post)
    expect(fields).toEqual({ text: 'How do you deploy?' })
  })

  it('should return empty object when platformFields is undefined', () => {
    const post = makeLaunchPost({
      platform: 'hacker_news_show',
      platformFields: undefined as never,
    })
    const fields = getHackerNewsFields(post)
    expect(fields).toEqual({})
  })
})

describe('getProductHuntFields', () => {
  it('should return platformFields as ProductHuntFields', () => {
    const post = makeLaunchPost({
      platform: 'product_hunt',
      platformFields: {
        tagline: 'The best tool',
        pricing: 'free',
        productStatus: 'available',
        firstComment: 'Hey everyone!',
      },
    })
    const fields = getProductHuntFields(post)
    expect(fields).toEqual({
      tagline: 'The best tool',
      pricing: 'free',
      productStatus: 'available',
      firstComment: 'Hey everyone!',
    })
  })

  it('should return empty object when platformFields is undefined', () => {
    const post = makeLaunchPost({
      platform: 'product_hunt',
      platformFields: undefined as never,
    })
    const fields = getProductHuntFields(post)
    expect(fields).toEqual({})
  })
})

describe('getDevHuntFields', () => {
  it('should return platformFields as DevHuntFields', () => {
    const post = makeLaunchPost({
      platform: 'dev_hunt',
      platformFields: {
        githubUrl: 'https://github.com/test/repo',
        category: 'developer-tools',
        founderStory: 'Built this in a weekend',
      },
    })
    const fields = getDevHuntFields(post)
    expect(fields).toEqual({
      githubUrl: 'https://github.com/test/repo',
      category: 'developer-tools',
      founderStory: 'Built this in a weekend',
    })
  })

  it('should return empty object when platformFields is undefined', () => {
    const post = makeLaunchPost({
      platform: 'dev_hunt',
      platformFields: undefined as never,
    })
    const fields = getDevHuntFields(post)
    expect(fields).toEqual({})
  })
})

describe('getBetaListFields', () => {
  it('should return platformFields as BetaListFields', () => {
    const post = makeLaunchPost({
      platform: 'beta_list',
      platformFields: {
        oneSentencePitch: 'Schedule social media posts easily',
        category: 'productivity',
      },
    })
    const fields = getBetaListFields(post)
    expect(fields).toEqual({
      oneSentencePitch: 'Schedule social media posts easily',
      category: 'productivity',
    })
  })

  it('should return empty object when platformFields is undefined', () => {
    const post = makeLaunchPost({
      platform: 'beta_list',
      platformFields: undefined as never,
    })
    const fields = getBetaListFields(post)
    expect(fields).toEqual({})
  })
})

describe('getIndieHackersFields', () => {
  it('should return platformFields as IndieHackersFields', () => {
    const post = makeLaunchPost({
      platform: 'indie_hackers',
      platformFields: {
        shortDescription: 'A social scheduler',
        revenue: '$500 MRR',
        affiliateUrl: 'https://example.com/ref',
      },
    })
    const fields = getIndieHackersFields(post)
    expect(fields).toEqual({
      shortDescription: 'A social scheduler',
      revenue: '$500 MRR',
      affiliateUrl: 'https://example.com/ref',
    })
  })

  it('should return empty object when platformFields is undefined', () => {
    const post = makeLaunchPost({
      platform: 'indie_hackers',
      platformFields: undefined as never,
    })
    const fields = getIndieHackersFields(post)
    expect(fields).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// getDefaultPlatformFields
// ---------------------------------------------------------------------------

describe('getDefaultPlatformFields', () => {
  it('should return empty object for hacker_news_show', () => {
    expect(getDefaultPlatformFields('hacker_news_show')).toEqual({})
  })

  it('should return empty object for hacker_news_ask', () => {
    expect(getDefaultPlatformFields('hacker_news_ask')).toEqual({})
  })

  it('should return empty object for hacker_news_link', () => {
    expect(getDefaultPlatformFields('hacker_news_link')).toEqual({})
  })

  it('should return pricing and productStatus defaults for product_hunt', () => {
    expect(getDefaultPlatformFields('product_hunt')).toEqual({
      pricing: 'free',
      productStatus: 'available',
    })
  })

  it('should return empty object for dev_hunt', () => {
    expect(getDefaultPlatformFields('dev_hunt')).toEqual({})
  })

  it('should return empty object for beta_list', () => {
    expect(getDefaultPlatformFields('beta_list')).toEqual({})
  })

  it('should return empty object for indie_hackers', () => {
    expect(getDefaultPlatformFields('indie_hackers')).toEqual({})
  })
})
