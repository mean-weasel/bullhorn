import { describe, it, expect, vi } from 'vitest'
import type { Post } from '@/lib/posts'
import { splitIntoThread } from './twitter'

// --- Mocks ---

vi.mock('@/lib/tokenRefresh', () => ({
  getValidAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
}))

const mockEq = vi.fn().mockResolvedValue({})
const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
const mockSingle = vi.fn().mockResolvedValue({
  data: { provider_account_id: 'account-123' },
})
const mockSelectEq = vi.fn().mockReturnValue({ single: mockSingle })
const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq })

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === 'social_accounts') {
        return { select: mockSelect, update: mockUpdate }
      }
      return { update: mockUpdate }
    }),
  }),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// --- Helpers ---

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    scheduledAt: '2026-01-01T12:00:00Z',
    status: 'scheduled',
    platform: 'twitter',
    content: { text: 'Hello world' },
    ...overrides,
  }
}

function mockFetchSuccess(data: unknown, headers?: Record<string, string>) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
    headers: new Headers(headers || {}),
  })
}

function mockFetchError(status: number, body: unknown = {}) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  })
}

// --- Tests ---

describe('splitIntoThread', () => {
  it('returns single item for short text', () => {
    const result = splitIntoThread('Hello world')
    expect(result).toEqual(['Hello world'])
  })

  it('returns single item for exactly 280 chars', () => {
    const text = 'a'.repeat(280)
    const result = splitIntoThread(text)
    expect(result).toEqual([text])
  })

  it('splits long text at word boundaries', () => {
    // Create text that's >280 chars with words
    const words = 'hello world '.repeat(30).trim() // ~359 chars
    const result = splitIntoThread(words)
    expect(result.length).toBeGreaterThan(1)
    result.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(280)
    })
  })

  it('handles text with no spaces by hard-splitting', () => {
    const text = 'a'.repeat(600)
    const result = splitIntoThread(text)
    expect(result.length).toBeGreaterThan(1)
    expect(result[0].length).toBe(280)
    expect(result.join('')).toBe(text)
  })

  it('preserves all content when splitting', () => {
    const words = 'hello world '.repeat(30).trim()
    const result = splitIntoThread(words)
    const joined = result.join(' ')
    // All words should be present
    expect(joined).toContain('hello')
    expect(joined).toContain('world')
  })

  it('respects custom maxLength', () => {
    const result = splitIntoThread('hello world foo bar', 10)
    expect(result.length).toBeGreaterThan(1)
    result.forEach((chunk) => {
      expect(chunk.length).toBeLessThanOrEqual(10)
    })
  })
})

describe('publishPost (1/3)', () => {
  it('calls correct publisher for twitter', async () => {
    const { publishPost } = await import('./index')
    mockFetchSuccess({ data: { id: 'tweet-123', text: 'Hello' } })

    const post = makePost({ platform: 'twitter' })
    const result = await publishPost(post, 'account-1')

    expect(result.success).toBe(true)
    expect(result.publishResult?.platform).toBe('twitter')
    expect(result.publishResult?.postId).toBe('tweet-123')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.x.com/2/tweets',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('calls correct publisher for linkedin', async () => {
    const { publishPost } = await import('./index')
    const responseHeaders = new Headers({
      'x-restli-id': 'urn:li:share:12345',
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: () => Promise.resolve({}),
      headers: responseHeaders,
    })

    const post = makePost({
      platform: 'linkedin',
      content: { text: 'LinkedIn post', visibility: 'public' as const },
    })
    const result = await publishPost(post, 'account-1')

    expect(result.success).toBe(true)
    expect(result.publishResult?.platform).toBe('linkedin')
    expect(result.publishResult?.postUrn).toBe('urn:li:share:12345')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.linkedin.com/rest/posts',
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('publishPost (2/3)', () => {
  it('calls correct publisher for reddit', async () => {
    const { publishPost } = await import('./index')
    mockFetchSuccess({
      json: {
        errors: [],
        data: { id: 'abc123', name: 't3_abc123', url: 'https://reddit.com/r/test/abc' },
      },
    })

    const post = makePost({
      platform: 'reddit',
      content: { subreddit: 'test', title: 'Test post', body: 'Body text' },
    })
    const result = await publishPost(post, 'account-1')

    expect(result.success).toBe(true)
    expect(result.publishResult?.platform).toBe('reddit')
    expect(result.publishResult?.subreddit).toBe('test')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://oauth.reddit.com/api/submit',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('updates post status to published on success', async () => {
    const { publishPost } = await import('./index')
    mockFetchSuccess({ data: { id: 'tweet-123', text: 'Hello' } })

    const post = makePost({ platform: 'twitter' })
    await publishPost(post, 'account-1')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'published',
        publish_result: expect.objectContaining({ success: true }),
      })
    )
  })
})

describe('publishPost (3/3)', () => {
  it('updates post status to failed on failure', async () => {
    const { publishPost } = await import('./index')
    mockFetchError(403, { detail: 'Forbidden' })

    const post = makePost({ platform: 'twitter' })
    const result = await publishPost(post, 'account-1')

    expect(result.success).toBe(false)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        publish_result: expect.objectContaining({ success: false }),
      })
    )
  })

  it('returns error for unsupported platform', async () => {
    const { publishPost } = await import('./index')
    const post = makePost({ platform: 'mastodon' as never })
    const result = await publishPost(post, 'account-1')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unsupported platform')
    expect(result.retryable).toBe(false)
  })

  it('returns error when social account not found', async () => {
    const { publishPost } = await import('./index')
    mockSingle.mockResolvedValueOnce({ data: null })

    const post = makePost({ platform: 'twitter' })
    const result = await publishPost(post, 'account-1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Social account not found')
    expect(result.retryable).toBe(false)
  })

  it('marks rate-limit errors as retryable', async () => {
    const { publishPost } = await import('./index')
    mockFetchError(429, { detail: 'Too Many Requests' })

    const post = makePost({ platform: 'twitter' })
    const result = await publishPost(post, 'account-1')

    expect(result.success).toBe(false)
    expect(result.retryable).toBe(true)
  })
})
