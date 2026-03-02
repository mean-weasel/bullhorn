import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { transformEventFromDb, type DbCommunityEvent } from '@/lib/communityEvents'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// GET /api/community-events - List active community events
export async function GET() {
  try {
    try {
      await requireAuth()
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('community_events')
      .select('*')
      .eq('is_active', true)
      .order('platform', { ascending: true })
      .order('name', { ascending: true })
      .limit(200)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const events = (data || []).map((event) => transformEventFromDb(event as DbCommunityEvent))
    return NextResponse.json({ events })
  } catch (error) {
    console.error('Error fetching community events:', error)
    return NextResponse.json({ error: 'Failed to fetch community events' }, { status: 500 })
  }
}
