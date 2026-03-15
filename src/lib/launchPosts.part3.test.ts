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
// ---------------------------------------------------------------------------
// fetchLaunchPosts
// ---------------------------------------------------------------------------

describe('useLaunchPostsStore - getLaunchPostsByStatus', () => {
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
