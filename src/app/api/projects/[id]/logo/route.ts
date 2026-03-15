import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, validateScopes } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Allowed file types for logos (SVG removed - XSS vector)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/projects/[id]/logo - Upload project logo
// eslint-disable-next-line max-lines-per-function -- API handler requires auth+db in single try/catch
export async function POST(request: NextRequest, context: RouteContext) {
  try {
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

    if (project.user_id !== auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: JPG, PNG, WebP' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size: 5MB' }, { status: 400 })
    }

    // Delete old logo from storage if exists
    if (project.logo_url) {
      const oldPath = project.logo_url.replace(/^\/storage\/logos\//, '')
      if (oldPath && !oldPath.includes('..')) {
        await supabase.storage.from('logos').remove([oldPath])
      }
    }

    // Derive extension from validated MIME type (not user-supplied filename)
    const MIME_TO_EXT: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    }
    const ext = MIME_TO_EXT[file.type] || 'png'
    const filename = `${auth.userId}/${projectId}-${crypto.randomUUID().slice(0, 8)}.${ext}`

    const bytes = await file.arrayBuffer()
    const { error: uploadError } = await supabase.storage.from('logos').upload(filename, bytes, {
      contentType: file.type,
      upsert: false,
    })

    if (uploadError) {
      console.error('Logo upload error:', uploadError)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }

    const logoUrl = `/storage/logos/${filename}`

    // Update project with new logo URL
    const { error: updateError } = await supabase
      .from('projects')
      .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
      .eq('id', projectId)

    if (updateError) {
      // Clean up uploaded file
      await supabase.storage.from('logos').remove([filename])
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
    }

    // Get public URL for the logo
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(filename)

    return NextResponse.json({
      success: true,
      logoUrl: urlData.publicUrl || logoUrl,
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

    if (project.user_id !== auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete file from Supabase Storage if exists
    if (project.logo_url) {
      const storagePath = project.logo_url.replace(/^\/storage\/logos\//, '')
      if (storagePath && !storagePath.includes('..')) {
        await supabase.storage.from('logos').remove([storagePath])
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
