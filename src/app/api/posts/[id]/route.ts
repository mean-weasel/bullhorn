import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformPostFromDb, type DbPost } from '@/lib/utils'
import { requireAuth, validateScopes, parseJsonBody } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updatePostSchema = z.object({
  platform: z.enum(['twitter', 'linkedin', 'reddit']).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
  status: z.enum(['draft', 'scheduled', 'ready', 'published', 'failed', 'archived']).optional(),
  scheduled_at: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  campaign_id: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  publish_result: z.record(z.string(), z.unknown()).optional().nullable(),
  publishResult: z.record(z.string(), z.unknown()).optional().nullable(),
  group_id: z.string().optional().nullable(),
  groupId: z.string().optional().nullable(),
  group_type: z.string().optional().nullable(),
  groupType: z.string().optional().nullable(),
})

// Valid status transitions
const validTransitions: Record<string, string[]> = {
  draft: ['scheduled', 'archived'],
  scheduled: ['draft', 'ready', 'published', 'failed', 'archived'],
  ready: ['draft', 'scheduled', 'published', 'archived'],
  published: ['archived'],
  failed: ['draft', 'scheduled', 'archived'],
  archived: ['draft'],
}

// GET /api/posts/[id] - Get single post
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) validateScopes(auth.scopes, ['posts:read'])
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const post = transformPostFromDb(data as DbPost)
    return NextResponse.json({ post })
  } catch (error) {
    console.error('Error fetching post:', error)
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 })
  }
}

function buildPostUpdates(data: z.infer<typeof updatePostSchema>) {
  const updates: Record<string, unknown> = {}
  if (data.platform !== undefined) updates.platform = data.platform
  if (data.content !== undefined) updates.content = data.content
  if (data.status !== undefined) updates.status = data.status
  if (data.scheduled_at !== undefined || data.scheduledAt !== undefined) {
    updates.scheduled_at = data.scheduled_at || data.scheduledAt
  }
  if (data.notes !== undefined) updates.notes = data.notes
  if (data.campaign_id !== undefined || data.campaignId !== undefined) {
    updates.campaign_id = data.campaign_id || data.campaignId
  }
  if (data.publish_result !== undefined || data.publishResult !== undefined) {
    updates.publish_result = data.publish_result || data.publishResult
  }
  if (data.group_id !== undefined || data.groupId !== undefined) {
    updates.group_id = data.group_id || data.groupId
  }
  if (data.group_type !== undefined || data.groupType !== undefined) {
    updates.group_type = data.group_type || data.groupType
  }
  return updates
}

// PATCH /api/posts/[id] - Update post
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) validateScopes(auth.scopes, ['posts:write'])
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const parsed = updatePostSchema.safeParse(jsonResult.data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data: currentPost, error: fetchError } = await supabase
      .from('posts')
      .select('status')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      }
      console.error('Database error:', fetchError)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (parsed.data.status && parsed.data.status !== currentPost.status) {
      const allowed = validTransitions[currentPost.status] || []
      if (!allowed.includes(parsed.data.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${currentPost.status} to ${parsed.data.status}` },
          { status: 400 }
        )
      }
    }

    const updates = buildPostUpdates(parsed.data)
    const { data, error } = await supabase
      .from('posts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const post = transformPostFromDb(data as DbPost)
    return NextResponse.json({ post })
  } catch (error) {
    console.error('Error updating post:', error)
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 })
  }
}

// DELETE /api/posts/[id] - Delete post
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) validateScopes(auth.scopes, ['posts:write'])
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()

    const { error } = await supabase.from('posts').delete().eq('id', id).eq('user_id', userId)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting post:', error)
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 })
  }
}
