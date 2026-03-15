import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformPostFromDb, type DbPost } from '@/lib/utils'
import { transformReminderFromDb, type DbReminder } from '@/lib/reminders'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function fetchCalendarData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  start: string,
  end: string
) {
  const [postsResult, remindersResult] = await Promise.all([
    supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'archived')
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', `${start}T00:00:00.000Z`)
      .lte('scheduled_at', `${end}T23:59:59.999Z`)
      .order('scheduled_at', { ascending: true })
      .limit(500),
    supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .gte('remind_at', `${start}T00:00:00.000Z`)
      .lte('remind_at', `${end}T23:59:59.999Z`)
      .order('remind_at', { ascending: true })
      .limit(500),
  ])
  return { postsResult, remindersResult }
}

// GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(request: NextRequest) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return NextResponse.json(
        { error: 'Missing required query parameters: start, end' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { postsResult, remindersResult } = await fetchCalendarData(supabase, userId, start, end)

    if (postsResult.error) {
      console.error('Database error fetching posts:', postsResult.error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
    if (remindersResult.error) {
      console.error('Database error fetching reminders:', remindersResult.error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const posts = (postsResult.data || []).map((post) => transformPostFromDb(post as DbPost))
    const reminders = (remindersResult.data || []).map((r) =>
      transformReminderFromDb(r as DbReminder)
    )
    return NextResponse.json({ posts, reminders })
  } catch (error) {
    console.error('Error fetching calendar data:', error)
    return NextResponse.json({ error: 'Failed to fetch calendar data' }, { status: 500 })
  }
}
