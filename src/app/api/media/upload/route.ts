import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { requireAuth, validateScopes } from '@/lib/auth'
import { enforceStorageLimit } from '@/lib/planEnforcement'
import { createClient } from '@/lib/supabase/server'

// Media upload directory (in public folder for easy serving)
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

// Allowed file types (MIME types)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]

// File size limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB

// Generate a unique ID using crypto (built-in Node.js module)
function generateId(): string {
  return crypto.randomUUID()
}

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch {
    // Directory might already exist
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication for media uploads
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['media:write'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await ensureUploadDir()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Server-side file type validation
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unsupported file type. Allowed: JPG, PNG, GIF, WebP, MP4, MOV, WebM',
        },
        { status: 400 }
      )
    }

    // Server-side file size validation
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type)
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024)
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size: ${maxSizeMB}MB` },
        { status: 400 }
      )
    }

    // Enforce storage limit
    const storageCheck = await enforceStorageLimit(userId, file.size)
    if (!storageCheck.allowed) {
      const limitMB = Math.round(storageCheck.limitBytes / (1024 * 1024))
      return NextResponse.json(
        { success: false, error: `Storage limit reached (${limitMB} MB)` },
        { status: 403 }
      )
    }

    // Generate unique filename
    const ext = path.extname(file.name).toLowerCase()
    const filename = `${generateId()}${ext}`
    const filepath = path.join(UPLOAD_DIR, filename)

    // Convert file to buffer and write
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    // Track storage usage
    const supabase = await createClient()
    await supabase.rpc('increment_storage_used', {
      user_id_param: userId,
      bytes_param: file.size,
    })

    return NextResponse.json({
      success: true,
      filename,
      url: `/uploads/${filename}`,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}
