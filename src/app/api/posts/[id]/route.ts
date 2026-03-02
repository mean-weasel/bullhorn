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
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['posts:read'])
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

    // Transform post from snake_case to camelCase
    const post = transformPostFromDb(data as DbPost)
    return NextResponse.json({ post })
  } catch (error) {
    console.error('Error fetching post:', error)
    return NextResponse.json({ error: 'Failed to fetch post' }, { status: 500 })
  }
}

// PATCH /api/posts/[id] - Update post
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['posts:write'])
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
    const parsed = updatePostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Get current post to validate status transition (with ownership check)
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

    // Validate status transition if status is being changed
    if (parsed.data.status && parsed.data.status !== currentPost.status) {
      const allowed = validTransitions[currentPost.status] || []
      if (!allowed.includes(parsed.data.status)) {
        return NextResponse.json(
          { error: `Cannot transition from ${currentPost.status} to ${parsed.data.status}` },
          { status: 400 }
        )
      }
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (parsed.data.platform !== undefined) updates.platform = parsed.data.platform
    if (parsed.data.content !== undefined) updates.content = parsed.data.content
    if (parsed.data.status !== undefined) updates.status = parsed.data.status
    if (parsed.data.scheduled_at !== undefined || parsed.data.scheduledAt !== undefined) {
      updates.scheduled_at = parsed.data.scheduled_at || parsed.data.scheduledAt
    }
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes
    if (parsed.data.campaign_id !== undefined || parsed.data.campaignId !== undefined) {
      updates.campaign_id = parsed.data.campaign_id || parsed.data.campaignId
    }
    if (parsed.data.publish_result !== undefined || parsed.data.publishResult !== undefined) {
      updates.publish_result = parsed.data.publish_result || parsed.data.publishResult
    }
    if (parsed.data.group_id !== undefined || parsed.data.groupId !== undefined) {
      updates.group_id = parsed.data.group_id || parsed.data.groupId
    }
    if (parsed.data.group_type !== undefined || parsed.data.groupType !== undefined) {
      updates.group_type = parsed.data.group_type || parsed.data.groupType
    }

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

    // Transform post from snake_case to camelCase
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
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['posts:write'])
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
