import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  transformCampaignFromDb,
  transformPostFromDb,
  type DbCampaign,
  type DbPost,
} from '@/lib/utils'
import { requireAuth, validateScopes, parseJsonBody } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateCampaignSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
  projectId: z.string().uuid().optional().nullable(),
})

// GET /api/campaigns/[id] - Get single campaign with posts
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) validateScopes(auth.scopes, ['campaigns:read'])
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()

    const [campaignResult, postsResult] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', id).eq('user_id', userId).single(),
      supabase
        .from('posts')
        .select('*')
        .eq('campaign_id', id)
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
    ])

    if (campaignResult.error) {
      if (campaignResult.error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }
      console.error('Database error:', campaignResult.error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    if (postsResult.error) {
      console.error('Database error:', postsResult.error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const campaign = campaignResult.data
    const posts = postsResult.data

    // Transform campaign and posts from snake_case to camelCase
    const transformedCampaign = transformCampaignFromDb(campaign as DbCampaign)
    const transformedPosts = (posts || []).map((post) => transformPostFromDb(post as DbPost))
    return NextResponse.json({ campaign: transformedCampaign, posts: transformedPosts })
  } catch (error) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 })
  }
}

function buildCampaignUpdates(data: z.infer<typeof updateCampaignSchema>) {
  const updates: Record<string, unknown> = {}
  if (data.name !== undefined) {
    const trimmedName = data.name.trim()
    if (!trimmedName) return null
    updates.name = trimmedName
  }
  if (data.description !== undefined) updates.description = data.description
  if (data.status !== undefined) updates.status = data.status
  if (data.projectId !== undefined) updates.project_id = data.projectId || null
  return updates
}

// PATCH /api/campaigns/[id] - Update campaign
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) validateScopes(auth.scopes, ['campaigns:write'])
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const parsed = updateCampaignSchema.safeParse(jsonResult.data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updates = buildCampaignUpdates(parsed.data)
    if (updates === null) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const campaign = transformCampaignFromDb(data as DbCampaign)
    return NextResponse.json({ campaign })
  } catch (error) {
    console.error('Error updating campaign:', error)
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
  }
}

// DELETE /api/campaigns/[id] - Delete campaign
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) validateScopes(auth.scopes, ['campaigns:write'])
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = await createClient()

    const { data: campaign, error: checkError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (checkError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    await supabase
      .from('posts')
      .update({ campaign_id: null })
      .eq('campaign_id', id)
      .eq('user_id', userId)

    const { error } = await supabase.from('campaigns').delete().eq('id', id).eq('user_id', userId)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 })
  }
}
