import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, validateScopes } from '@/lib/auth'

// Logo upload directory
const LOGO_DIR = path.join(process.cwd(), 'public', 'uploads', 'logos')

// Allowed file types for logos
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

interface RouteContext {
  params: Promise<{ id: string }>
}

// Ensure directory exists
async function ensureLogoDir() {
  try {
    await mkdir(LOGO_DIR, { recursive: true })
  } catch {
    // Directory might already exist
  }
}

// POST /api/projects/[id]/logo - Upload project logo
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Require authentication
    const auth = await requireAuth()
    if (auth.scopes) {
      validateScopes(auth.scopes, ['projects:write'])
    }
    const { id: projectId } = await context.params
    const supabase = await createClient()

    // Verify project exists and user owns it
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, logo_url, user_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Defense in depth: verify ownership even though RLS should handle it
    if (project.user_id !== auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    await ensureLogoDir()

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: JPG, PNG, SVG, WebP' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size: 5MB' }, { status: 400 })
    }

    // Delete old logo if exists
    if (project.logo_url) {
      try {
        const oldPath = path.join(process.cwd(), 'public', project.logo_url)
        await unlink(oldPath)
      } catch {
        // Old file might not exist, that's okay
      }
    }

    // Generate unique filename
    const ext = path.extname(file.name).toLowerCase() || '.png'
    const filename = `${projectId}-${crypto.randomUUID().slice(0, 8)}${ext}`
    const filepath = path.join(LOGO_DIR, filename)

    // Write file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filepath, buffer)

    const logoUrl = `/uploads/logos/${filename}`

    // Update project with new logo URL
    const { error: updateError } = await supabase
      .from('projects')
      .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
      .eq('id', projectId)

    if (updateError) {
      // Try to clean up uploaded file
      try {
        await unlink(filepath)
      } catch {
        // Ignore cleanup errors
      }
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      logoUrl,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error uploading logo:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

// DELETE /api/projects/[id]/logo - Remove project logo
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    // Require authentication
    const auth = await requireAuth()
    if (auth.scopes) {
      validateScopes(auth.scopes, ['projects:write'])
    }
    const { id: projectId } = await context.params
    const supabase = await createClient()

    // Verify project exists and user owns it
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, logo_url, user_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Defense in depth: verify ownership
    if (project.user_id !== auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete file if exists
    if (project.logo_url) {
      try {
        const filepath = path.join(process.cwd(), 'public', project.logo_url)
        await unlink(filepath)
      } catch {
        // File might not exist, that's okay
      }
    }

    // Clear logo URL in database
    const { error: updateError } = await supabase
      .from('projects')
      .update({ logo_url: null, updated_at: new Date().toISOString() })
      .eq('id', projectId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error deleting logo:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
