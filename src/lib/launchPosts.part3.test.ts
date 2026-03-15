/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
// @ts-nocheck — split test file with shared mock setup
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useLaunchPostsStore } from './launchPosts'
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
const _makeDbLaunchPost = (overrides: Record<string, unknown> = {}) => ({
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
