import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { transformSubscriptionFromDb, type DbEventSubscription } from '@/lib/communityEvents'
import { requireAuth, parseJsonBody } from '@/lib/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createSubscriptionSchema = z.object({
  eventId: z.string().uuid(),
  notifyHoursBefore: z.number().int().min(1).max(168).optional().default(24),
  autoCreateDraft: z.boolean().optional().default(false),
})

// GET /api/community-events/subscriptions - List user's subscriptions
export async function GET() {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('user_event_subscriptions')
      .select('*, community_events(*)')
      .eq('user_id', userId)
      .limit(500)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const subscriptions = (data || []).map((sub) =>
      transformSubscriptionFromDb(sub as DbEventSubscription)
    )
    return NextResponse.json({ subscriptions })
  } catch (error) {
    console.error('Error fetching subscriptions:', error)
    return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
  }
}

// POST /api/community-events/subscriptions - Subscribe to an event
export async function POST(request: NextRequest) {
  try {
    let userId: string
    try {
      const auth = await requireAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()
    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const body = jsonResult.data
    const parsed = createSubscriptionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('user_event_subscriptions')
      .insert({
        user_id: userId,
        event_id: parsed.data.eventId,
        notify_hours_before: parsed.data.notifyHoursBefore,
        auto_create_draft: parsed.data.autoCreateDraft,
      })
      .select('*, community_events(*)')
      .single()

    if (error) {
      // Handle unique constraint violation (user already subscribed)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Already subscribed to this event' }, { status: 409 })
      }
      console.error('Database error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const subscription = transformSubscriptionFromDb(data as DbEventSubscription)
    return NextResponse.json({ subscription }, { status: 201 })
  } catch (error) {
    console.error('Error creating subscription:', error)
    return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
  }
}
