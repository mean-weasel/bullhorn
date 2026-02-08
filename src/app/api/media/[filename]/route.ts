import { NextRequest, NextResponse } from 'next/server'
import { readFile, unlink, stat } from 'fs/promises'
import path from 'path'
import { requireAuth } from '@/lib/auth'

// Media upload directory (in public folder)
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

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
    // Require authentication to serve uploaded media
    try {
      await requireAuth()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { filename } = await params

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = path.basename(filename)
    const filepath = path.join(UPLOAD_DIR, sanitizedFilename)

    // Check if file exists
    try {
      await stat(filepath)
    } catch {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Read file
    const buffer = await readFile(filepath)

    // Get content type
    const ext = path.extname(sanitizedFilename).toLowerCase()
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    })
  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    // Require authentication to delete files
    await requireAuth()
    const { filename } = await params

    // Sanitize filename to prevent path traversal
    const sanitizedFilename = path.basename(filename)
    const filepath = path.join(UPLOAD_DIR, sanitizedFilename)

    // Try to delete file
    try {
      await unlink(filepath)
    } catch {
      // File might not exist, that's ok
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
