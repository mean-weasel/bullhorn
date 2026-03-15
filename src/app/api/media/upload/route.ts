import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import path from 'path'
import { requireAuth, validateScopes } from '@/lib/auth'
import { enforceStorageLimit } from '@/lib/planEnforcement'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Allowed file types (MIME types)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]

// File size limits
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm']

function validateMediaFile(file: File | null) {
  if (!file) return 'No file provided'
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Unsupported file type. Allowed: JPG, PNG, GIF, WebP, MP4, MOV, WebM'
  }
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type)
  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE
  if (file.size > maxSize) {
    return `File too large. Maximum size: ${maxSize / (1024 * 1024)}MB`
  }
  const ext = path.extname(file.name).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) return 'Invalid file extension'
  return null
}

export async function POST(request: NextRequest) {
  try {
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

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const validationError = validateMediaFile(file)
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 })
    }

    const storageCheck = await enforceStorageLimit(userId, file!.size)
    if (!storageCheck.allowed) {
      const limitMB = Math.round(storageCheck.limitBytes / (1024 * 1024))
      return NextResponse.json(
        { success: false, error: `Storage limit reached (${limitMB} MB)` },
        { status: 403 }
      )
    }

    const ext = path.extname(file!.name).toLowerCase()
    const filename = `${crypto.randomUUID()}${ext}`
    const storagePath = `${userId}/${filename}`
    const buffer = Buffer.from(await file!.arrayBuffer())

    const supabase = await createClient()
    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, buffer, { contentType: file!.type })

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError)
      return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
    }

    const { error: rpcError } = await supabase.rpc('increment_storage_used', {
      user_id_param: userId,
      bytes_param: file!.size,
    })

    if (rpcError) {
      console.error('Storage tracking failed, rolling back upload:', rpcError)
      await supabase.storage.from('media').remove([storagePath])
      return NextResponse.json(
        { success: false, error: 'Storage tracking failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, filename, url: `/api/media/${filename}` })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}
