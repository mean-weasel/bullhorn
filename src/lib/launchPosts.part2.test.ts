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

describe('fetchLaunchPosts (1/3)', () => {
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
})

describe('fetchLaunchPosts (2/3)', () => {
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
})

describe('fetchLaunchPosts (3/3)', () => {
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
