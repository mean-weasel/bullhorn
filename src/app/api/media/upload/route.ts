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

// eslint-disable-next-line max-lines-per-function -- API handler requires auth+db in single try/catch
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

    // Generate unique filename and storage path
    const ext = path.extname(file.name).toLowerCase()
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm']
    if (!allowedExtensions.includes(ext)) {
      return NextResponse.json({ success: false, error: 'Invalid file extension' }, { status: 400 })
    }
    const filename = `${crypto.randomUUID()}${ext}`
    const storagePath = `${userId}/${filename}`

    // Convert file to buffer and upload to Supabase Storage
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const supabase = await createClient()

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(storagePath, buffer, { contentType: file.type })

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError)
      return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
    }

    // Track storage usage — roll back upload if tracking fails
    const { error: rpcError } = await supabase.rpc('increment_storage_used', {
      user_id_param: userId,
      bytes_param: file.size,
    })

    if (rpcError) {
      console.error('Storage tracking failed, rolling back upload:', rpcError)
      await supabase.storage.from('media').remove([storagePath])
      return NextResponse.json(
        { success: false, error: 'Storage tracking failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      filename,
      url: `/api/media/${filename}`,
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ success: false, error: 'Upload failed' }, { status: 500 })
  }
}
