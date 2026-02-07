import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformPostFromDb } from '@/lib/utils'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const addPostToCampaignSchema = z.object({
  postId: z.string().uuid().optional(),
  post_id: z.string().uuid().optional(),
})

// GET /api/campaigns/[id]/posts - Get posts for campaign
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

    // Verify user owns the campaign first
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get posts for this campaign (with ownership check)
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('campaign_id', id)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const posts = (data || []).map((post) => transformPostFromDb(post as Record<string, unknown>))
    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Error fetching campaign posts:', error)
    return NextResponse.json({ error: 'Failed to fetch campaign posts' }, { status: 500 })
  }
}

// POST /api/campaigns/[id]/posts - Add post to campaign
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
    const parsed = addPostToCampaignSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const postId = parsed.data.postId || parsed.data.post_id

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 })
    }

    // CRITICAL: Verify user owns the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // CRITICAL: Verify user owns the post being added
    const { data: postCheck, error: postCheckError } = await supabase
      .from('posts')
      .select('id')
      .eq('id', postId)
      .eq('user_id', userId)
      .single()

    if (postCheckError || !postCheck) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    // Update post with campaign_id (with ownership check)
    const { data, error } = await supabase
      .from('posts')
      .update({ campaign_id: id })
      .eq('id', postId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const post = transformPostFromDb(data as Record<string, unknown>)
    return NextResponse.json(post)
  } catch (error) {
    console.error('Error adding post to campaign:', error)
    return NextResponse.json({ error: 'Failed to add post to campaign' }, { status: 500 })
  }
}
