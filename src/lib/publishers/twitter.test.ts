import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Post } from '@/lib/posts'

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

describe('publishToTwitter with media', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('attaches media_ids to first tweet when mediaUrls present', async () => {
    vi.doMock('./mediaDownload', () => ({
      downloadMediaFromStorage: vi.fn().mockResolvedValue({
        buffer: Buffer.alloc(100),
        contentType: 'image/jpeg',
        filename: 'photo.jpg',
      }),
    }))

    vi.doMock('./twitterMedia', () => ({
      uploadTwitterMedia: vi.fn().mockResolvedValue('media-id-1'),
    }))

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'tweet-1' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { publishToTwitter } = await import('./twitter')

    const result = await publishToTwitter({
      post: makePost({
        content: { text: 'Check this out', mediaUrls: ['photo.jpg'] },
      }),
      accessToken: 'token-1',
      providerAccountId: 'ext-1',
      supabase: {} as never,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)

    const tweetBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(tweetBody.media).toBeDefined()
    expect(tweetBody.media.media_ids).toEqual(['media-id-1'])

    vi.unstubAllGlobals()
  })

  it('publishes text-only when no supabase client provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'tweet-2' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { publishToTwitter } = await import('./twitter')

    const result = await publishToTwitter({
      post: makePost({
        content: { text: 'Just text', mediaUrls: ['photo.jpg'] },
      }),
      accessToken: 'token-1',
      providerAccountId: 'ext-1',
    })

    expect(result.success).toBe(true)
    const tweetBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(tweetBody.media).toBeUndefined()

    vi.unstubAllGlobals()
  })
})
