import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { uploadTwitterMedia } from './twitterMedia'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('uploadTwitterMedia', () => {
  it('uploads an image in 3 steps: INIT, APPEND, FINALIZE', async () => {
    const imageBuffer = Buffer.alloc(1024, 'x')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'media-123', expires_after_secs: 86400 }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'media-123' }),
    })

    const mediaId = await uploadTwitterMedia('token-1', imageBuffer, 'image/jpeg', 'tweet_image')
    expect(mediaId).toBe('media-123')
    expect(mockFetch).toHaveBeenCalledTimes(3)

    expect(mockFetch.mock.calls[0][0]).toBe('https://upload.x.com/2/media/upload/initialize')
    expect(mockFetch.mock.calls[1][0]).toBe('https://upload.x.com/2/media/upload/media-123/append')
    expect(mockFetch.mock.calls[2][0]).toBe(
      'https://upload.x.com/2/media/upload/media-123/finalize'
    )
  })

  it('polls for async processing (video/gif)', async () => {
    const videoBuffer = Buffer.alloc(1024, 'v')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'media-456' }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'media-456',
          processing_info: { state: 'pending', check_after_secs: 1 },
        }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'media-456',
          processing_info: { state: 'in_progress', check_after_secs: 1 },
        }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'media-456',
          processing_info: { state: 'succeeded' },
        }),
    })

    const uploadPromise = uploadTwitterMedia('token-1', videoBuffer, 'video/mp4', 'tweet_video')

    await vi.advanceTimersByTimeAsync(1000)
    await vi.advanceTimersByTimeAsync(1000)

    const mediaId = await uploadPromise
    expect(mediaId).toBe('media-456')
    expect(mockFetch).toHaveBeenCalledTimes(5)
  })

  it('throws when processing fails', async () => {
    const gifBuffer = Buffer.alloc(512, 'g')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'media-789' }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: 'media-789',
          processing_info: { state: 'failed', error: { message: 'Invalid format' } },
        }),
    })

    await expect(
      uploadTwitterMedia('token-1', gifBuffer, 'image/gif', 'tweet_gif')
    ).rejects.toThrow('Twitter media processing failed: Invalid format')
  })

  it('throws when INIT fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: 'Bad request' }),
    })

    await expect(
      uploadTwitterMedia('token-1', Buffer.alloc(10), 'image/jpeg', 'tweet_image')
    ).rejects.toThrow()
  })
})
