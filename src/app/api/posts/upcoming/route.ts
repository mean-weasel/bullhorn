import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, validateScopes, type ApiKeyScope } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/posts/upcoming - Get posts scheduled within the next N hours
// eslint-disable-next-line max-lines-per-function -- borderline, extraction would hurt readability
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

    const hours = Math.min(Math.max(parseInt(searchParams.get('hours') || '24', 10) || 24, 1), 168)
    const now = new Date()
    const until = new Date(now.getTime() + hours * 60 * 60 * 1000)

    const { data, error } = await supabase
      .from('posts')
      .select('id, platform, status, scheduled_at, content, campaign_id')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', until.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(200)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const posts = (data || []).map((p) => {
      const content = p.content as Record<string, unknown>
      const text = (content.text as string) || (content.title as string) || ''
      return {
        id: p.id,
        platform: p.platform,
        scheduledAt: p.scheduled_at,
        preview: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
        campaignId: p.campaign_id,
      }
    })

    return NextResponse.json({ posts, hours })
  } catch (error) {
    console.error('Error fetching upcoming posts:', error)
    return NextResponse.json({ error: 'Failed to fetch upcoming posts' }, { status: 500 })
  }
}
