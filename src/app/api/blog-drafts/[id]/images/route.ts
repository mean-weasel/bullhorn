import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes, parseJsonBody } from '@/lib/auth'
import { transformDraftFromDb } from '@/lib/utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const addImageSchema = z.object({
  filename: z.string().max(500).optional(),
  url: z.string().url().optional(),
  sourcePath: z.string().max(1000).optional(),
})

// GET /api/blog-drafts/[id]/images - List images for a blog draft
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['blog:read'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()

    // Defense-in-depth: filter by user_id
    const { data: draft, error } = await supabase
      .from('blog_drafts')
      .select('images')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Blog draft not found' }, { status: 404 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json(draft.images || [])
  } catch (error) {
    console.error('Error fetching blog draft images:', error)
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 })
  }
}

// POST /api/blog-drafts/[id]/images - Add image to blog draft
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['blog:write'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const body = jsonResult.data
    const parsed = addImageSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { filename, url, sourcePath } = parsed.data

    if (!filename && !url && !sourcePath) {
      return NextResponse.json(
        { error: 'filename, url, or sourcePath is required' },
        { status: 400 }
      )
    }

    // Get current draft (with ownership check)
    const { data: draft, error: fetchError } = await supabase
      .from('blog_drafts')
      .select('images')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Blog draft not found' }, { status: 404 })
      }
      console.error('Database error:', fetchError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Add new image to array
    const images = draft.images || []
    const newImage = {
      filename: filename || url || sourcePath,
      url: url,
      addedAt: new Date().toISOString(),
    }
    images.push(newImage)

    // Update draft (with ownership check)
    const { data, error } = await supabase
      .from('blog_drafts')
      .update({ images })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Transform to camelCase for frontend
    return NextResponse.json(transformDraftFromDb(data), { status: 201 })
  } catch (error) {
    console.error('Error adding image to blog draft:', error)
    return NextResponse.json({ error: 'Failed to add image' }, { status: 500 })
  }
}
