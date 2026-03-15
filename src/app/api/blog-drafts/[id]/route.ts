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

    return NextResponse.json({ draft: transformDraftFromDb(data) })
  } catch (error) {
    console.error('Error fetching blog draft:', error)
    return NextResponse.json({ error: 'Failed to fetch blog draft' }, { status: 500 })
  }
}

function buildDraftUpdates(data: z.infer<typeof updateBlogDraftSchema>) {
  const updates: Record<string, unknown> = {}
  if (data.title !== undefined) {
    const trimmedTitle = data.title?.trim() ?? null
    if (trimmedTitle !== null && !trimmedTitle) return null
    updates.title = trimmedTitle
  }
  if (data.content !== undefined) {
    updates.content = data.content
    updates.word_count = calculateWordCount(data.content || '')
  }
  if (data.date !== undefined) updates.date = data.date
  if (data.status !== undefined) updates.status = data.status
  if (data.scheduled_at !== undefined || data.scheduledAt !== undefined) {
    updates.scheduled_at = data.scheduled_at || data.scheduledAt
  }
  if (data.notes !== undefined) updates.notes = data.notes
  if (data.campaign_id !== undefined || data.campaignId !== undefined) {
    updates.campaign_id = data.campaign_id || data.campaignId
  }
  if (data.images !== undefined) updates.images = data.images
  if (data.tags !== undefined) updates.tags = data.tags
  return updates
}

function validateDraftStatusTransition(currentStatus: string, newStatus: string | undefined) {
  if (!newStatus || newStatus === currentStatus) return null
  const allowed = validTransitions[currentStatus] || []
  if (!allowed.includes(newStatus)) {
    return `Cannot transition from ${currentStatus} to ${newStatus}`
  }
  return null
}

// PATCH /api/blog-drafts/[id] - Update blog draft
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) validateScopes(auth.scopes, ['blog:write'])
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const parsed = updateBlogDraftSchema.safeParse(jsonResult.data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data: currentDraft, error: fetchError } = await supabase
      .from('blog_drafts')
      .select('status')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116')
        return NextResponse.json({ error: 'Blog draft not found' }, { status: 404 })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const transitionErr = validateDraftStatusTransition(currentDraft.status, parsed.data.status)
    if (transitionErr) return NextResponse.json({ error: transitionErr }, { status: 400 })

    const updates = buildDraftUpdates(parsed.data)
    if (updates === null)
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })

    const { data, error } = await supabase
      .from('blog_drafts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116')
        return NextResponse.json({ error: 'Blog draft not found' }, { status: 404 })
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

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
