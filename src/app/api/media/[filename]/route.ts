import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Content type mapping
const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { userId } = await requireAuth()
    const { filename } = await params

    // Path traversal protection
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('\0')
    ) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const supabase = await createClient()
    const storagePath = `${userId}/${filename}`

    const { data, error } = await supabase.storage.from('media').download(storagePath)

    if (error || !data) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Get content type from extension
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase()
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream'

    const buffer = Buffer.from(await data.arrayBuffer())

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=31536000',
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error serving file:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { userId } = await requireAuth()
    const { filename } = await params

    // Path traversal protection
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\') ||
      filename.includes('\0')
    ) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const supabase = await createClient()
    const storagePath = `${userId}/${filename}`

    // Get file size before deleting for storage tracking
    const { data: files } = await supabase.storage.from('media').list(userId, {
      search: filename,
    })
    const fileEntry = files?.find((f) => f.name === filename)
    const fileSize = fileEntry?.metadata?.size ?? 0

    // Delete from Supabase Storage
    const { error } = await supabase.storage.from('media').remove([storagePath])

    if (error) {
      console.error('Supabase storage delete error:', error)
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
    }

    // Decrement storage usage
    if (fileSize > 0) {
      await supabase.rpc('decrement_storage_used', {
        user_id_param: userId,
        bytes_param: fileSize,
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error deleting file:', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
