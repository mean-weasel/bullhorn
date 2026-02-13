import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes } from '@/lib/auth'
import { z } from 'zod'

const updateLaunchPostSchema = z.object({
  platform: z
    .enum([
      'hacker_news_show',
      'hacker_news_ask',
      'hacker_news_link',
      'product_hunt',
      'dev_hunt',
      'beta_list',
      'indie_hackers',
    ])
    .optional(),
  title: z.string().min(1).max(500).optional(),
  status: z.enum(['draft', 'scheduled', 'posted']).optional(),
  url: z.string().url().optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  platformFields: z.record(z.string(), z.unknown()).optional(),
  campaignId: z.string().uuid().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  postedAt: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

// Transform snake_case DB response to camelCase for frontend
function transformLaunchPost(data: Record<string, unknown>) {
  return {
    id: data.id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    platform: data.platform,
    status: data.status,
    scheduledAt: data.scheduled_at,
    postedAt: data.posted_at,
    title: data.title,
    url: data.url,
    description: data.description,
    platformFields: data.platform_fields || {},
    campaignId: data.campaign_id,
    notes: data.notes,
  }
}

// GET /api/launch-posts/[id] - Get single launch post
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['launches:read'])
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
    const { data, error } = await supabase
      .from('launch_posts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Launch post not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const launchPost = transformLaunchPost(data as Record<string, unknown>)
    return NextResponse.json({ launchPost })
  } catch (error) {
    console.error('Error fetching launch post:', error)
    return NextResponse.json({ error: 'Failed to fetch launch post' }, { status: 500 })
  }
}

// PATCH /api/launch-posts/[id] - Update launch post
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['launches:write'])
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
    const body = await request.json()
    const parsed = updateLaunchPostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Build update object - only include fields that were provided
    const updates: Record<string, unknown> = {}
    if (parsed.data.platform !== undefined) updates.platform = parsed.data.platform
    if (parsed.data.status !== undefined) updates.status = parsed.data.status
    if (parsed.data.title !== undefined) updates.title = parsed.data.title
    if (parsed.data.url !== undefined) updates.url = parsed.data.url
    if (parsed.data.description !== undefined) updates.description = parsed.data.description
    if (parsed.data.platformFields !== undefined)
      updates.platform_fields = parsed.data.platformFields
    if (parsed.data.campaignId !== undefined) updates.campaign_id = parsed.data.campaignId
    if (parsed.data.scheduledAt !== undefined) updates.scheduled_at = parsed.data.scheduledAt
    if (parsed.data.postedAt !== undefined) updates.posted_at = parsed.data.postedAt
    if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes

    const { data, error } = await supabase
      .from('launch_posts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Launch post not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const launchPost = transformLaunchPost(data as Record<string, unknown>)
    return NextResponse.json({ launchPost })
  } catch (error) {
    console.error('Error updating launch post:', error)
    return NextResponse.json({ error: 'Failed to update launch post' }, { status: 500 })
  }
}

// DELETE /api/launch-posts/[id] - Delete launch post
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
        validateScopes(auth.scopes, ['launches:write'])
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

    const { error } = await supabase
      .from('launch_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting launch post:', error)
    return NextResponse.json({ error: 'Failed to delete launch post' }, { status: 500 })
  }
}
