/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/ban-ts-comment */
// @ts-nocheck — split test file with shared mock setup
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
const _mockValidateScopes = vi.mocked(validateScopes)

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

describe('POST /api/media/upload (4/6)', () => {
  describe('storage quota enforcement', () => {
    it('returns 403 when storage limit is exceeded', async () => {
      mockEnforceStorageLimit.mockResolvedValue({
        allowed: false,
        currentBytes: 50 * 1024 * 1024,
        limitBytes: 50 * 1024 * 1024,
        plan: 'free',
      })
      const req = createRequest(createMockFile('photo.jpg', 'image/jpeg', 100))
      const res = await POST(req)
      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error).toContain('Storage limit reached')
      expect(body.error).toContain('50 MB')
    })

    it('passes userId and file size to enforceStorageLimit', async () => {
      const fileSize = 5000
      const req = createRequest(createMockFile('photo.jpg', 'image/jpeg', fileSize))
      await POST(req)
      expect(mockEnforceStorageLimit).toHaveBeenCalledWith('user-1', fileSize)
    })
  })
})

describe('POST /api/media/upload (5/6)', () => {
  describe('successful upload', () => {
    it('returns filename and url on success', async () => {
      const req = createRequest(createMockFile('photo.jpg', 'image/jpeg', 100))
      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.filename).toBeDefined()
      expect(body.filename).toMatch(/\.jpg$/)
      expect(body.url).toMatch(/^\/api\/media\//)
    })

    it('generates a UUID-based filename', async () => {
      const req = createRequest(createMockFile('my-photo.png', 'image/png', 100))
      const res = await POST(req)
      const body = await res.json()
      // Filename should be a UUID + extension, not the original name
      expect(body.filename).not.toContain('my-photo')
      expect(body.filename).toMatch(/\.png$/)
      // UUID pattern: 8-4-4-4-12
      const uuidPart = body.filename.replace('.png', '')
      expect(uuidPart).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    it('calls supabase storage upload with correct path', async () => {
      const req = createRequest(createMockFile('photo.jpg', 'image/jpeg', 100))
      await POST(req)
      expect(mockUpload).toHaveBeenCalledTimes(1)
      const [storagePath, buffer, options] = mockUpload.mock.calls[0]
      expect(storagePath).toMatch(/^user-1\//)
      expect(storagePath).toMatch(/\.jpg$/)
      expect(buffer).toBeInstanceOf(Buffer)
      expect(options.contentType).toBe('image/jpeg')
    })

    it('calls increment_storage_used rpc after upload', async () => {
      const fileSize = 2048
      const req = createRequest(createMockFile('photo.jpg', 'image/jpeg', fileSize))
      await POST(req)
      expect(mockRpc).toHaveBeenCalledWith('increment_storage_used', {
        user_id_param: 'user-1',
        bytes_param: fileSize,
      })
    })
  })
})

describe('POST /api/media/upload (6/6)', () => {
  describe('upload failure', () => {
    it('returns 500 when supabase storage upload fails', async () => {
      mockUpload.mockResolvedValue({ error: { message: 'Storage error' } })
      const req = createRequest(createMockFile('photo.jpg', 'image/jpeg', 100))
      const res = await POST(req)
      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error).toBe('Upload failed')
    })
  })
})
