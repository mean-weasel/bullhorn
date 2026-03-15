import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformPostFromDb, type DbPost } from '@/lib/utils'
import { requireAuth, validateScopes, parseJsonBody, type ApiKeyScope } from '@/lib/auth'
import { enforceResourceLimit, isPlanLimitError } from '@/lib/planEnforcement'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createPostSchema = z.object({
  platform: z.enum(['twitter', 'linkedin', 'reddit']),
  content: z.record(z.string(), z.unknown()),
  status: z.enum(['draft', 'scheduled', 'published', 'failed', 'archived']).optional(),
  scheduled_at: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  campaign_id: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  group_id: z.string().optional().nullable(),
  groupId: z.string().optional().nullable(),
  group_type: z.string().optional().nullable(),
  groupType: z.string().optional().nullable(),
})

// GET /api/posts - List posts with optional filters
// eslint-disable-next-line max-lines-per-function -- borderline, extraction would hurt readability
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId

      // Enforce scope check for API-key authenticated requests
      if (auth.scopes) {
        const required: ApiKeyScope[] = ['posts:read']
        validateScopes(auth.scopes, required)
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

    const status = searchParams.get('status')
    const platform = searchParams.get('platform')
    const campaignId = searchParams.get('campaignId')
    const groupId = searchParams.get('groupId')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 200)

    let query = supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (platform) {
      query = query.eq('platform', platform)
    }
    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }
    if (groupId) {
      query = query.eq('group_id', groupId)
    }
    if (limit > 0) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Transform posts from snake_case to camelCase
    const posts = (data || []).map((post) => transformPostFromDb(post as DbPost))
    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}

// POST /api/posts - Create new post
// eslint-disable-next-line max-lines-per-function -- API handler requires auth+db in single try/catch
export async function POST(request: NextRequest) {
  try {
    // Require authentication - throws if not authenticated
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId

      // Enforce scope check for API-key authenticated requests
      if (auth.scopes) {
        const required: ApiKeyScope[] = ['posts:write']
        validateScopes(auth.scopes, required)
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Enforce plan limit
    const limitCheck = await enforceResourceLimit(userId, 'posts')
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Post limit reached',
          limit: limitCheck.limit,
          current: limitCheck.current,
          plan: limitCheck.plan,
        },
        { status: 403 }
      )
    }

    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const body = jsonResult.data
    const parsed = createPostSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    // Enforce content size limit (50 KB max)
    const contentStr = JSON.stringify(parsed.data.content)
    if (contentStr.length > 50_000) {
      return NextResponse.json({ error: 'Content too large (max 50 KB)' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        platform: parsed.data.platform,
        content: parsed.data.content,
        status: parsed.data.status || 'draft',
        scheduled_at: parsed.data.scheduled_at || parsed.data.scheduledAt,
        notes: parsed.data.notes,
        campaign_id: parsed.data.campaign_id || parsed.data.campaignId,
        group_id: parsed.data.group_id || parsed.data.groupId,
        group_type: parsed.data.group_type || parsed.data.groupType,
      })
      .select()
      .single()

    if (error) {
      if (isPlanLimitError(error)) {
        return NextResponse.json({ error: 'Post limit reached' }, { status: 403 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Transform post from snake_case to camelCase
    const post = transformPostFromDb(data as DbPost)
    return NextResponse.json({ post }, { status: 201 })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
