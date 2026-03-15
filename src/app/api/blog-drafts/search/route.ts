import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes } from '@/lib/auth'
import { escapeSearchPattern, transformDraftFromDb } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// GET /api/blog-drafts/search - Search blog drafts
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const userId = auth.userId
    if (auth.scopes) {
      validateScopes(auth.scopes, ['blog:read'])
    }
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const query = searchParams.get('q') || searchParams.get('query') || ''
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 200)

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    const searchPattern = `%${escapeSearchPattern(query)}%`

    const { data, error } = await supabase
      .from('blog_drafts')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'archived')
      .or(
        `title.ilike.${searchPattern},content.ilike.${searchPattern},notes.ilike.${searchPattern}`
      )
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const drafts = (data || []).map(transformDraftFromDb)
    return NextResponse.json({ drafts })
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error searching blog drafts:', error)
    return NextResponse.json({ error: 'Failed to search blog drafts' }, { status: 500 })
  }
}
