// API URL - use relative path for Next.js API routes
const API_BASE = '/api'

// File type and size limits (must match backend)
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm']
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
export const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB

// Accept string for file inputs
export const ACCEPT_MEDIA =
  'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm'

export interface UploadResult {
  success: boolean
  filename?: string
  url?: string
  error?: string
}

export interface UploadProgress {
  loaded: number
  total: number
  percentage: number
}

/**
 * Get the file extension from a filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return ''
  return filename.slice(lastDot).toLowerCase()
}

/**
 * Validate a file before upload
 * @returns An object with valid boolean and optional error message
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  const ext = getFileExtension(file.name)
  const isImage = ALLOWED_IMAGE_EXTENSIONS.includes(ext)
  const isVideo = ALLOWED_VIDEO_EXTENSIONS.includes(ext)

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: `File type not supported. Allowed: ${[...ALLOWED_IMAGE_EXTENSIONS, ...ALLOWED_VIDEO_EXTENSIONS].join(', ')}`,
    }
  }

  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE
  if (file.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024)
    const fileMB = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `File too large (${fileMB}MB). Maximum size for ${isImage ? 'images' : 'videos'} is ${maxMB}MB`,
    }
  }

  return { valid: true }
}

/**
 * Upload a media file to the server
 * @param file The file to upload
 * @param onProgress Optional callback for upload progress
 * @returns Upload result with filename and URL on success
 */
export async function uploadMedia(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadResult> {
  // Validate file first
  const validation = validateFile(file)
  if (!validation.valid) {
    return { success: false, error: validation.error }
  }

  const formData = new FormData()
  formData.append('file', file)

  try {
    // Use XMLHttpRequest for progress tracking
    if (onProgress) {
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100),
            })
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText)
              resolve(result)
            } catch {
              resolve({ success: false, error: 'Invalid server response' })
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText)
              resolve({ success: false, error: error.error || 'Upload failed' })
            } catch {
              resolve({ success: false, error: `Upload failed (${xhr.status})` })
            }
          }
        })

        xhr.addEventListener('error', () => {
          resolve({ success: false, error: 'Network error during upload' })
        })

        xhr.open('POST', `${API_BASE}/media/upload`)
        xhr.send(formData)
      })
    }

    // Simple fetch for non-progress uploads
    const response = await fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error || 'Upload failed' }
    }

    return response.json()
  } catch (error) {
    return { success: false, error: (error as Error).message || 'Upload failed' }
  }
}

/**
 * Delete a media file from the server
 * @param filename The filename to delete
 * @returns true if deleted successfully
 */
export async function deleteMedia(filename: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/media/${filename}`, {
      method: 'DELETE',
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get the full URL for a media file
 * @param urlOrFilename The URL or filename (as stored in post data)
 * @returns The full URL to access the media
 */
export function getMediaUrl(urlOrFilename: string): string {
  // Already a full URL or API path — return as-is
  if (urlOrFilename.startsWith('http') || urlOrFilename.startsWith('/api/')) {
    return urlOrFilename
  }
  // Legacy relative paths (e.g. "/uploads/file.jpg") — return as-is
  if (urlOrFilename.startsWith('/')) return urlOrFilename
  // Bare filename — route through auth-gated proxy
  return `/api/media/${urlOrFilename}`
}
