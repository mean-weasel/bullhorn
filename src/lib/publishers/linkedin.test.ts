import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Post } from '@/lib/posts'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    scheduledAt: '2026-01-01T12:00:00Z',
    status: 'scheduled',
    platform: 'linkedin',
    content: { text: 'Hello world', visibility: 'public' as const },
    ...overrides,
  }
}

describe('publishToLinkedIn with media', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('attaches image URN to post when mediaUrl present', async () => {
    vi.doMock('./mediaDownload', () => ({
      downloadMediaFromStorage: vi.fn().mockResolvedValue({
        buffer: Buffer.alloc(100),
        contentType: 'image/png',
        filename: 'banner.png',
      }),
    }))

    vi.doMock('./linkedinMedia', () => ({
      uploadLinkedInImage: vi.fn().mockResolvedValue('urn:li:image:img-1'),
    }))

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'x-restli-id': 'urn:li:share:share-1' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { publishToLinkedIn } = await import('./linkedin')

    const result = await publishToLinkedIn({
      post: makePost({
        content: { text: 'Big news!', visibility: 'public' as const, mediaUrl: 'banner.png' },
      }),
      accessToken: 'token-1',
      providerAccountId: 'person-1',
      supabase: {} as never,
      userId: 'user-1',
    })

    expect(result.success).toBe(true)
    const postBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(postBody.content).toBeDefined()
    expect(postBody.content.media.id).toBe('urn:li:image:img-1')

    vi.unstubAllGlobals()
  })
})
