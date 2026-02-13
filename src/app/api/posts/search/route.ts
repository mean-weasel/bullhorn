import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformPostFromDb, escapeSearchPattern, type DbPost } from '@/lib/utils'
import { requireAuth, validateScopes } from '@/lib/auth'

// GET /api/posts/search - Search posts
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
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!query) {
      return NextResponse.json({ error: 'Search query is required' }, { status: 400 })
    }

    // Search in content (as text), notes, and platform
    // Note: Supabase textSearch requires full-text search setup
    // Using ilike for simple search
    const searchPattern = `%${escapeSearchPattern(query)}%`

    // Defense-in-depth: filter by user_id alongside RLS
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'archived')
      .or(`notes.ilike.${searchPattern},platform.ilike.${searchPattern}`)
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Additionally filter by content (JSON field) on the client side
    // since Supabase doesn't easily search within JSONB text
    const filtered = data.filter(
      (post: { content?: unknown; notes?: string; platform?: string }) => {
        const contentStr = JSON.stringify(post.content || {}).toLowerCase()
        const notesStr = (post.notes || '').toLowerCase()
        const platformStr = (post.platform || '').toLowerCase()
        const searchLower = query.toLowerCase()

        return (
          contentStr.includes(searchLower) ||
          notesStr.includes(searchLower) ||
          platformStr.includes(searchLower)
        )
      }
    )

    // Transform posts from snake_case to camelCase
    const posts = filtered.map((post) => transformPostFromDb(post as DbPost))
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
