import { describe, it, expect, vi, beforeEach } from 'vitest'
import { downloadMediaFromStorage } from './mediaDownload'

beforeEach(() => {
  vi.clearAllMocks()
})

function makeMockSupabase(signedUrl: string | null, signedUrlError?: string) {
  return {
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn(() =>
          Promise.resolve(
            signedUrl
              ? { data: { signedUrl }, error: null }
              : { data: null, error: { message: signedUrlError || 'Not found' } }
          )
        ),
      })),
    },
  }
}

describe('downloadMediaFromStorage', () => {
  it('extracts filename from bare filename', async () => {
    const supabase = makeMockSupabase('https://storage.example.com/signed/abc123.jpg')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
        headers: new Headers({ 'content-type': 'image/jpeg' }),
      })
    )

    const result = await downloadMediaFromStorage(supabase as never, 'user-1', 'abc123.jpg')
    expect(result.filename).toBe('abc123.jpg')
    expect(result.contentType).toBe('image/jpeg')
    expect(supabase.storage.from).toHaveBeenCalledWith('media')
    vi.unstubAllGlobals()
  })

  it('extracts filename from /api/media/ path', async () => {
    const supabase = makeMockSupabase('https://storage.example.com/signed/photo.png')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
        headers: new Headers({ 'content-type': 'image/png' }),
      })
    )

    const result = await downloadMediaFromStorage(
      supabase as never,
      'user-1',
      '/api/media/photo.png'
    )
    expect(result.filename).toBe('photo.png')
    vi.unstubAllGlobals()
  })

  it('extracts filename from full URL', async () => {
    const supabase = makeMockSupabase('https://storage.example.com/signed/vid.mp4')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(10)),
        headers: new Headers({ 'content-type': 'video/mp4' }),
      })
    )

    const result = await downloadMediaFromStorage(
      supabase as never,
      'user-1',
      'https://xyz.supabase.co/storage/v1/object/public/media/user-1/vid.mp4'
    )
    expect(result.filename).toBe('vid.mp4')
    vi.unstubAllGlobals()
  })

  it('throws when file not found in storage', async () => {
    const supabase = makeMockSupabase(null, 'Object not found')
    await expect(
      downloadMediaFromStorage(supabase as never, 'user-1', 'missing.jpg')
    ).rejects.toThrow('Media file not found: missing.jpg')
  })
})
