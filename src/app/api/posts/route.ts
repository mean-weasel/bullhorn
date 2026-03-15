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

function parsePostFilters(searchParams: URLSearchParams) {
  return {
    status: searchParams.get('status'),
    platform: searchParams.get('platform'),
    campaignId: searchParams.get('campaignId'),
    groupId: searchParams.get('groupId'),
    limit: Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 200),
  }
}

// GET /api/posts - List posts with optional filters
export async function GET(request: NextRequest) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
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
    const filters = parsePostFilters(new URL(request.url).searchParams)

    let query = supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
    if (filters.platform) query = query.eq('platform', filters.platform)
    if (filters.campaignId) query = query.eq('campaign_id', filters.campaignId)
    if (filters.groupId) query = query.eq('group_id', filters.groupId)
    if (filters.limit > 0) query = query.limit(filters.limit)

    const { data, error } = await query
    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const posts = (data || []).map((post) => transformPostFromDb(post as DbPost))
    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Error fetching posts:', error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}

function buildPostInsertData(userId: string, data: z.infer<typeof createPostSchema>) {
  return {
    user_id: userId,
    platform: data.platform,
    content: data.content,
    status: data.status || 'draft',
    scheduled_at: data.scheduled_at || data.scheduledAt,
    notes: data.notes,
    campaign_id: data.campaign_id || data.campaignId,
    group_id: data.group_id || data.groupId,
    group_type: data.group_type || data.groupType,
  }
}

// POST /api/posts - Create new post
export async function POST(request: NextRequest) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
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
    const parsed = createPostSchema.safeParse(jsonResult.data)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (JSON.stringify(parsed.data.content).length > 50_000) {
      return NextResponse.json({ error: 'Content too large (max 50 KB)' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('posts')
      .insert(buildPostInsertData(userId, parsed.data))
      .select()
      .single()

    if (error) {
      if (isPlanLimitError(error)) {
        return NextResponse.json({ error: 'Post limit reached' }, { status: 403 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const post = transformPostFromDb(data as DbPost)
    return NextResponse.json({ post }, { status: 201 })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
