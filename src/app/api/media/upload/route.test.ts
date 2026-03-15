import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the route
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
  validateScopes: vi.fn(),
}))

const mockEnforceStorageLimit = vi.fn()
vi.mock('@/lib/planEnforcement', () => ({
  enforceStorageLimit: (...args: unknown[]) => mockEnforceStorageLimit(...args),
}))

const mockUpload = vi.fn()
const mockRpc = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
      })),
    },
    rpc: mockRpc,
  })),
}))

import { POST } from './route'
import { requireAuth, validateScopes } from '@/lib/auth'

const mockRequireAuth = vi.mocked(requireAuth)
const mockValidateScopes = vi.mocked(validateScopes)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  // Default: authenticated user, storage allowed, upload succeeds
  mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
  mockEnforceStorageLimit.mockResolvedValue({
    allowed: true,
    currentBytes: 0,
    limitBytes: 50 * 1024 * 1024,
    plan: 'free',
  })
  mockUpload.mockResolvedValue({ error: null })
  mockRpc.mockResolvedValue({ error: null })
})

/**
 * Create a mock File object with a configurable size without allocating
 * large buffers. We override `size` and `arrayBuffer()` so the route's
 * validation and upload logic work correctly.
 */
function createMockFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob([new ArrayBuffer(1)], { type })
  const file = new File([blob], name, { type })
  Object.defineProperty(file, 'size', { value: sizeBytes, writable: false })
  // Mock arrayBuffer to return a tiny buffer (upload mock doesn't care about content)
  file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(1))
  return file
}

/**
 * Build a NextRequest whose `.formData()` is stubbed to return a FormData
 * containing the given file (or empty if null). This avoids jsdom's broken
 * streaming FormData parsing in NextRequest.
 */
function createRequest(file: File | null): NextRequest {
  const req = new NextRequest(new URL('/api/media/upload', 'http://localhost:3000'), {
    method: 'POST',
  })
  const fd = new FormData()
  if (file) {
    fd.append('file', file)
  }
  req.formData = vi.fn().mockResolvedValue(fd)
  return req
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/media/upload (1/6)', () => {
  it('returns 401 when not authenticated', async () => {
    mockRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const req = createRequest(createMockFile('photo.jpg', 'image/jpeg', 100))
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 403 when scope is insufficient', async () => {
    mockRequireAuth.mockResolvedValue({ userId: 'user-1', scopes: ['posts:read'] })
    mockValidateScopes.mockImplementation(() => {
      throw new Error('Forbidden')
    })
    const req = createRequest(createMockFile('photo.jpg', 'image/jpeg', 100))
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('returns 400 when no file is provided', async () => {
    const req = createRequest(null)
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No file provided')
  })
})

// eslint-disable-next-line max-lines-per-function -- data-driven loop tests for all MIME types
describe('POST /api/media/upload (2/6)', () => {
  describe('file type validation', () => {
    const validImageTypes = [
      { ext: 'jpg', mime: 'image/jpeg' },
      { ext: 'png', mime: 'image/png' },
      { ext: 'gif', mime: 'image/gif' },
      { ext: 'webp', mime: 'image/webp' },
    ]

    const validVideoTypes = [
      { ext: 'mp4', mime: 'video/mp4' },
      { ext: 'mov', mime: 'video/quicktime' },
      { ext: 'webm', mime: 'video/webm' },
    ]

    for (const { ext, mime } of validImageTypes) {
      it(`accepts valid image type: ${mime} (.${ext})`, async () => {
        const req = createRequest(createMockFile(`photo.${ext}`, mime, 100))
        const res = await POST(req)
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.success).toBe(true)
      })
    }

    for (const { ext, mime } of validVideoTypes) {
      it(`accepts valid video type: ${mime} (.${ext})`, async () => {
        const req = createRequest(createMockFile(`video.${ext}`, mime, 100))
        const res = await POST(req)
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.success).toBe(true)
      })
    }

    const invalidTypes = [
      'application/pdf',
      'text/html',
      'application/javascript',
      'image/svg+xml',
      'image/bmp',
      'video/avi',
      'audio/mpeg',
    ]

    for (const mime of invalidTypes) {
      it(`rejects invalid MIME type: ${mime}`, async () => {
        const req = createRequest(createMockFile('file.bin', mime, 100))
        const res = await POST(req)
        expect(res.status).toBe(400)
        const body = await res.json()
        expect(body.success).toBe(false)
        expect(body.error).toContain('Unsupported file type')
      })
    }
  })
})

describe('POST /api/media/upload (3/6)', () => {
  describe('file size validation', () => {
    it('rejects images over 10MB', async () => {
      const overLimit = 10 * 1024 * 1024 + 1 // 10 MB + 1 byte
      const req = createRequest(createMockFile('big.jpg', 'image/jpeg', overLimit))
      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('File too large')
      expect(body.error).toContain('10MB')
    })

    it('accepts images at exactly 10MB', async () => {
      const exactLimit = 10 * 1024 * 1024
      const req = createRequest(createMockFile('exact.png', 'image/png', exactLimit))
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('rejects videos over 100MB', async () => {
      const overLimit = 100 * 1024 * 1024 + 1 // 100 MB + 1 byte
      const req = createRequest(createMockFile('big.mp4', 'video/mp4', overLimit))
      const res = await POST(req)
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('File too large')
      expect(body.error).toContain('100MB')
    })

    it('accepts videos at exactly 100MB', async () => {
      const exactLimit = 100 * 1024 * 1024
      const req = createRequest(createMockFile('exact.mp4', 'video/mp4', exactLimit))
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('accepts a small image well under the limit', async () => {
      const req = createRequest(createMockFile('tiny.jpg', 'image/jpeg', 512))
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })
  })
})
