import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes, parseJsonBody } from '@/lib/auth'
import { enforceResourceLimit } from '@/lib/planEnforcement'
import { transformLaunchPostFromDb } from '@/lib/utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

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

// GET /api/launch-posts - List launch posts with optional filters
export async function GET(request: NextRequest) {
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

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const platform = searchParams.get('platform')
    const status = searchParams.get('status')
    const campaignId = searchParams.get('campaignId')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 200)

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
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const launchPosts = (data || []).map(transformLaunchPostFromDb)
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

    // Enforce plan limit
    const limitCheck = await enforceResourceLimit(userId, 'launchPosts')
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Launch post limit reached',
          limit: limitCheck.limit,
          current: limitCheck.current,
        },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const body = jsonResult.data
    const parsed = createLaunchPostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const title = parsed.data.title.trim()
    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('launch_posts')
      .insert({
        user_id: userId,
        platform: parsed.data.platform,
        status: parsed.data.status || 'draft',
        title,
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
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const launchPost = transformLaunchPostFromDb(data as Record<string, unknown>)
    return NextResponse.json({ launchPost }, { status: 201 })
  } catch (error) {
    console.error('Error creating launch post:', error)
    return NextResponse.json({ error: 'Failed to create launch post' }, { status: 500 })
  }
}
