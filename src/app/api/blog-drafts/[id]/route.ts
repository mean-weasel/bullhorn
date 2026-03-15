import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes, parseJsonBody } from '@/lib/auth'
import { transformDraftFromDb, calculateWordCount } from '@/lib/utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateBlogDraftSchema = z.object({
  title: z.string().max(500).optional().nullable(),
  content: z.string().max(100000).optional().nullable(),
  date: z.string().optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'published', 'archived']).optional(),
  scheduled_at: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  campaign_id: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  images: z.array(z.unknown()).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
})

// Valid status transitions for blog drafts
const validTransitions: Record<string, string[]> = {
  draft: ['scheduled', 'archived'],
  scheduled: ['draft', 'published', 'archived'],
  published: ['archived'],
  archived: ['draft'],
}

// GET /api/blog-drafts/[id] - Get single blog draft
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

    // Defense-in-depth: filter by user_id even though RLS should handle this
    const { data, error } = await supabase
      .from('blog_drafts')
      .select('*')
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

    // Transform to camelCase for frontend
    return NextResponse.json({ draft: transformDraftFromDb(data) })
  } catch (error) {
    console.error('Error fetching blog draft:', error)
    return NextResponse.json({ error: 'Failed to fetch blog draft' }, { status: 500 })
  }
}

// PATCH /api/blog-drafts/[id] - Update blog draft
// eslint-disable-next-line max-lines-per-function -- API handler requires auth+db in single try/catch
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const parsed = updateBlogDraftSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Get current draft to validate status transition (with ownership check)
    const { data: currentDraft, error: fetchError } = await supabase
      .from('blog_drafts')
      .select('status')
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

    // Validate status transition
    if (parsed.data.status && parsed.data.status !== currentDraft.status) {
      const allowed = validTransitions[currentDraft.status] || []
      if (!allowed.includes(parsed.data.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${currentDraft.status} to ${parsed.data.status}` },
          { status: 400 }
        )
      }
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) {
      const trimmedTitle = parsed.data.title?.trim() ?? null
      if (trimmedTitle !== null && !trimmedTitle) {
        return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
      }
      updates.title = trimmedTitle
    }
    if (parsed.data.content !== undefined) {
      updates.content = parsed.data.content
      updates.word_count = calculateWordCount(parsed.data.content || '')
    }
    if (parsed.data.date !== undefined) updates.date = parsed.data.date
    if (parsed.data.status !== undefined) updates.status = parsed.data.status
    if (parsed.data.scheduled_at !== undefined || parsed.data.scheduledAt !== undefined) {
      updates.scheduled_at = parsed.data.scheduled_at || parsed.data.scheduledAt
    }
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes
    if (parsed.data.campaign_id !== undefined || parsed.data.campaignId !== undefined) {
      updates.campaign_id = parsed.data.campaign_id || parsed.data.campaignId
    }
    if (parsed.data.images !== undefined) updates.images = parsed.data.images
    if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags

    const { data, error } = await supabase
      .from('blog_drafts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Blog draft not found' }, { status: 404 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Transform to camelCase for frontend
    return NextResponse.json({ draft: transformDraftFromDb(data) })
  } catch (error) {
    console.error('Error updating blog draft:', error)
    return NextResponse.json({ error: 'Failed to update blog draft' }, { status: 500 })
  }
}

// DELETE /api/blog-drafts/[id] - Delete blog draft
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { error } = await supabase.from('blog_drafts').delete().eq('id', id).eq('user_id', userId)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting blog draft:', error)
    return NextResponse.json({ error: 'Failed to delete blog draft' }, { status: 500 })
  }
}
