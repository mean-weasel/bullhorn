import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes, parseJsonBody } from '@/lib/auth'
import { transformLaunchPostFromDb } from '@/lib/utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

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

// GET /api/launch-posts/[id] - Get single launch post
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) validateScopes(auth.scopes, ['launches:read'])
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()

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
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const launchPost = transformLaunchPostFromDb(data as Record<string, unknown>)
    return NextResponse.json({ launchPost })
  } catch (error) {
    console.error('Error fetching launch post:', error)
    return NextResponse.json({ error: 'Failed to fetch launch post' }, { status: 500 })
  }
}

function buildLaunchPostUpdates(data: z.infer<typeof updateLaunchPostSchema>) {
  const updates: Record<string, unknown> = {}
  if (data.platform !== undefined) updates.platform = data.platform
  if (data.status !== undefined) updates.status = data.status
  if (data.title !== undefined) {
    const trimmedTitle = data.title.trim()
    if (!trimmedTitle) return null
    updates.title = trimmedTitle
  }
  if (data.url !== undefined) updates.url = data.url
  if (data.description !== undefined) updates.description = data.description
  if (data.platformFields !== undefined) updates.platform_fields = data.platformFields
  if (data.campaignId !== undefined) updates.campaign_id = data.campaignId
  if (data.scheduledAt !== undefined) updates.scheduled_at = data.scheduledAt
  if (data.postedAt !== undefined) updates.posted_at = data.postedAt
  if (data.notes !== undefined) updates.notes = data.notes
  return updates
}

// PATCH /api/launch-posts/[id] - Update launch post
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) validateScopes(auth.scopes, ['launches:write'])
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const parsed = updateLaunchPostSchema.safeParse(jsonResult.data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updates = buildLaunchPostUpdates(parsed.data)
    if (updates === null) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    }

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
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const launchPost = transformLaunchPostFromDb(data as Record<string, unknown>)
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
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) validateScopes(auth.scopes, ['launches:write'])
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting launch post:', error)
    return NextResponse.json({ error: 'Failed to delete launch post' }, { status: 500 })
  }
}
