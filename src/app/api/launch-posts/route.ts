import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

const createLaunchPostSchema = z.object({
  platform: z.enum([
    'hacker_news_show',
    'hacker_news_ask',
    'hacker_news_link',
    'product_hunt',
    'dev_hunt',
    'beta_list',
    'indie_hackers',
  ]),
  title: z.string().min(1).max(500),
  status: z.enum(['draft', 'scheduled', 'posted']).optional(),
  url: z.string().url().optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  platformFields: z.record(z.string(), z.unknown()).optional(),
  campaignId: z.string().uuid().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
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

// GET /api/launch-posts - List launch posts with optional filters
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const platform = searchParams.get('platform')
    const status = searchParams.get('status')
    const campaignId = searchParams.get('campaignId')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('launch_posts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (platform) {
      query = query.eq('platform', platform)
    }
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }
    if (limit > 0) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const launchPosts = (data || []).map(transformLaunchPost)
    return NextResponse.json({ launchPosts })
  } catch (error) {
    console.error('Error fetching launch posts:', error)
    return NextResponse.json({ error: 'Failed to fetch launch posts' }, { status: 500 })
  }
}

// POST /api/launch-posts - Create new launch post
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const body = await request.json()
    const parsed = createLaunchPostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('launch_posts')
      .insert({
        user_id: userId,
        platform: parsed.data.platform,
        status: parsed.data.status || 'draft',
        title: parsed.data.title,
        url: parsed.data.url || null,
        description: parsed.data.description || null,
        platform_fields: parsed.data.platformFields || {},
        campaign_id: parsed.data.campaignId || null,
        scheduled_at: parsed.data.scheduledAt || null,
        notes: parsed.data.notes || null,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const launchPost = transformLaunchPost(data as Record<string, unknown>)
    return NextResponse.json({ launchPost }, { status: 201 })
  } catch (error) {
    console.error('Error creating launch post:', error)
    return NextResponse.json({ error: 'Failed to create launch post' }, { status: 500 })
  }
}
