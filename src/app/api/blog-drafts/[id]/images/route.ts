import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const addImageSchema = z.object({
  filename: z.string().max(500).optional(),
  url: z.string().url().optional(),
  sourcePath: z.string().max(1000).optional(),
})

// Transform snake_case Supabase response to camelCase for frontend
function transformDraft(draft: Record<string, unknown>) {
  return {
    id: draft.id,
    createdAt: draft.created_at,
    updatedAt: draft.updated_at,
    scheduledAt: draft.scheduled_at,
    status: draft.status,
    title: draft.title,
    date: draft.date,
    content: draft.content,
    notes: draft.notes,
    wordCount: draft.word_count,
    campaignId: draft.campaign_id,
    images: draft.images || [],
  }
}

// GET /api/blog-drafts/[id]/images - List images for a blog draft
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
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
      return NextResponse.json({ error: error.message }, { status: 500 })
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
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()
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
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform to camelCase for frontend
    return NextResponse.json(transformDraft(data), { status: 201 })
  } catch (error) {
    console.error('Error adding image to blog draft:', error)
    return NextResponse.json({ error: 'Failed to add image' }, { status: 500 })
  }
}
