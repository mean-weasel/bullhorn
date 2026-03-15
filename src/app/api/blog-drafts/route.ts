import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes, parseJsonBody } from '@/lib/auth'
import { enforceResourceLimit, isPlanLimitError } from '@/lib/planEnforcement'
import { escapeSearchPattern, transformDraftFromDb, calculateWordCount } from '@/lib/utils'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createBlogDraftSchema = z.object({
  title: z.string().max(500).optional().nullable(),
  content: z.string().max(100000).optional().nullable(),
  date: z.string().optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'published', 'archived']).optional(),
  scheduled_at: z.string().optional().nullable(),
  scheduledAt: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  campaign_id: z.string().uuid().optional().nullable(),
  campaignId: z.string().uuid().optional().nullable(),
  images: z.array(z.unknown()).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
})

// GET /api/blog-drafts - List blog drafts
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['blog:read'])
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
    const campaignId = searchParams.get('campaignId')
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 200)
    const search = searchParams.get('search')

    let query = supabase
      .from('blog_drafts')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (campaignId) {
      query = query.eq('campaign_id', campaignId)
    }
    if (search) {
      const escaped = escapeSearchPattern(search)
      query = query.or(
        `title.ilike.%${escaped}%,content.ilike.%${escaped}%,notes.ilike.%${escaped}%`
      )
    }
    if (limit > 0) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Transform to camelCase for frontend
    const drafts = (data || []).map(transformDraftFromDb)
    return NextResponse.json({ drafts })
  } catch (error) {
    console.error('Error fetching blog drafts:', error)
    return NextResponse.json({ error: 'Failed to fetch blog drafts' }, { status: 500 })
  }
}

// POST /api/blog-drafts - Create blog draft
export async function POST(request: NextRequest) {
  try {
    // Require authentication - throws if not authenticated
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
      if (auth.scopes) {
        validateScopes(auth.scopes, ['blog:write'])
      }
    } catch (authError) {
      const msg = (authError as Error).message
      if (msg === 'Forbidden') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Enforce plan limit
    const limitCheck = await enforceResourceLimit(userId, 'blogDrafts')
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Blog draft limit reached',
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
    const parsed = createBlogDraftSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const title = parsed.data.title?.trim() ?? null
    if (title !== null && !title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const content = parsed.data.content || ''
    const wordCount = calculateWordCount(content)

    const { data, error } = await supabase
      .from('blog_drafts')
      .insert({
        user_id: userId,
        title,
        content: content,
        date: parsed.data.date,
        status: parsed.data.status || 'draft',
        scheduled_at: parsed.data.scheduled_at || parsed.data.scheduledAt,
        notes: parsed.data.notes,
        word_count: wordCount,
        campaign_id: parsed.data.campaign_id || parsed.data.campaignId,
        images: parsed.data.images || [],
        tags: parsed.data.tags || [],
      })
      .select()
      .single()

    if (error) {
      if (isPlanLimitError(error)) {
        return NextResponse.json({ error: 'Blog draft limit reached' }, { status: 403 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Transform to camelCase for frontend
    return NextResponse.json({ draft: transformDraftFromDb(data) }, { status: 201 })
  } catch (error) {
    console.error('Error creating blog draft:', error)
    return NextResponse.json({ error: 'Failed to create blog draft' }, { status: 500 })
  }
}
