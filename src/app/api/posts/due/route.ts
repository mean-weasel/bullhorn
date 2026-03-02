import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes, type ApiKeyScope } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function getPreview(content: Record<string, unknown>): string {
  const text = (content.text as string) || (content.title as string) || ''
  return text.slice(0, 100) + (text.length > 100 ? '...' : '')
}

function hasMedia(content: Record<string, unknown>): boolean {
  return !!(content.mediaUrls && (content.mediaUrls as string[]).length > 0) || !!content.mediaUrl
}

// GET /api/posts/due - Get posts due for publishing
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
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    const now = new Date().toISOString()

    let query = supabase
      .from('posts')
      .select('id, platform, status, scheduled_at, content, created_at, updated_at')
      .eq('user_id', userId)
      .or(`status.eq.ready,and(status.eq.scheduled,scheduled_at.lte.${now})`)
      .order('scheduled_at', { ascending: true })
      .limit(200)

    if (platform) {
      query = query.eq('platform', platform)
    }

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const posts = (data || []).map((p) => ({
      id: p.id,
      platform: p.platform,
      status: p.status,
      scheduledAt: p.scheduled_at,
      preview: getPreview(p.content as Record<string, unknown>),
      hasMedia: hasMedia(p.content as Record<string, unknown>),
    }))

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('Error fetching due posts:', error)
    return NextResponse.json({ error: 'Failed to fetch due posts' }, { status: 500 })
  }
}
