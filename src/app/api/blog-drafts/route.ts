import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { z } from 'zod'

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

// Transform snake_case Supabase response to camelCase for frontend
function transformDraft(draft: Record<string, unknown>) {
  return {
    id: draft.id,
    createdAt: draft.created_at,
    updatedAt: draft.updated_at,
    scheduledAt: draft.scheduled_at,
    status: draft.status,
    title: draft.title,
    date: draft.date,
    content: draft.content,
    notes: draft.notes,
    wordCount: draft.word_count,
    campaignId: draft.campaign_id,
    images: draft.images || [],
    tags: (draft.tags as string[]) || [],
  }
}

// Calculate word count from markdown content
function calculateWordCount(content: string): number {
  if (!content) return 0
  // Remove markdown syntax and count words
  const text = content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]*`/g, '') // Remove inline code
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // Convert links to text
    .replace(/[#*_~>\-|]/g, '') // Remove markdown characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
  return text ? text.split(' ').length : 0
}

// GET /api/blog-drafts - List blog drafts
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

    const status = searchParams.get('status')
    const campaignId = searchParams.get('campaignId')
    const limit = parseInt(searchParams.get('limit') || '50')
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
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%,notes.ilike.%${search}%`)
    }
    if (limit > 0) {
      query = query.limit(limit)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform to camelCase for frontend
    const drafts = (data || []).map(transformDraft)
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
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const body = await request.json()
    const parsed = createBlogDraftSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const content = parsed.data.content || ''
    const wordCount = calculateWordCount(content)

    const { data, error } = await supabase
      .from('blog_drafts')
      .insert({
        user_id: userId,
        title: parsed.data.title,
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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform to camelCase for frontend
    return NextResponse.json({ draft: transformDraft(data) }, { status: 201 })
  } catch (error) {
    console.error('Error creating blog draft:', error)
    return NextResponse.json({ error: 'Failed to create blog draft' }, { status: 500 })
  }
}
