import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadLinkedInImage } from './linkedinMedia'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('uploadLinkedInImage', () => {
  it('initializes upload then PUTs binary data', async () => {
    const imageBuffer = Buffer.alloc(1024, 'x')

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          value: {
            uploadUrl: 'https://api.linkedin.com/mediaUpload/xyz',
            image: 'urn:li:image:abc123',
          },
        }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true })

    const imageUrn = await uploadLinkedInImage('token-1', 'person-123', imageBuffer, 'image/jpeg')
    expect(imageUrn).toBe('urn:li:image:abc123')
    expect(mockFetch).toHaveBeenCalledTimes(2)

    const initCall = mockFetch.mock.calls[0]
    expect(initCall[0]).toBe('https://api.linkedin.com/rest/images?action=initializeUpload')
    const initBody = JSON.parse(initCall[1].body)
    expect(initBody.initializeUploadRequest.owner).toBe('urn:li:person:person-123')

    const putCall = mockFetch.mock.calls[1]
    expect(putCall[0]).toBe('https://api.linkedin.com/mediaUpload/xyz')
    expect(putCall[1].method).toBe('PUT')
  })

  it('throws when initializeUpload fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ message: 'Forbidden' }),
    })

    await expect(
      uploadLinkedInImage('token-1', 'person-123', Buffer.alloc(10), 'image/jpeg')
    ).rejects.toThrow()
  })

  it('throws when PUT upload fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          value: {
            uploadUrl: 'https://api.linkedin.com/mediaUpload/xyz',
            image: 'urn:li:image:abc123',
          },
        }),
    })
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    await expect(
      uploadLinkedInImage('token-1', 'person-123', Buffer.alloc(10), 'image/jpeg')
    ).rejects.toThrow()
  })
})
