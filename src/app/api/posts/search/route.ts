import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformPostFromDb, type DbPost } from '@/lib/utils'
import { requireAuth, validateScopes } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/posts/search - Search posts
// eslint-disable-next-line max-lines-per-function -- borderline, extraction would hurt readability
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth()
    const userId = auth.userId
    if (auth.scopes) {
      validateScopes(auth.scopes, ['posts:read'])
    }
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const query = searchParams.get('q') || searchParams.get('query') || ''
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50') || 50, 1), 200)

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    // Fetch all non-archived posts, then filter in Node.js.
    // PostgREST can't search within JSONB text (content field), so we
    // fetch a larger buffer and filter across all text fields client-side.
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(500)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    // Filter by search query across all text fields (content JSON, notes, platform)
    const searchLower = query.toLowerCase()
    const filtered = (data || []).filter(
      (post: { content?: unknown; notes?: string; platform?: string }) => {
        const contentStr = JSON.stringify(post.content || {}).toLowerCase()
        const notesStr = (post.notes || '').toLowerCase()
        const platformStr = (post.platform || '').toLowerCase()
        return (
          contentStr.includes(searchLower) ||
          notesStr.includes(searchLower) ||
          platformStr.includes(searchLower)
        )
      }
    )

    // Transform and apply the requested limit
    const posts = filtered.slice(0, limit).map((post) => transformPostFromDb(post as DbPost))
    return NextResponse.json({ posts })
  } catch (error) {
    if (error instanceof Error && error.message === 'Forbidden') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error searching posts:', error)
    return NextResponse.json({ error: 'Failed to search posts' }, { status: 500 })
  }
}
