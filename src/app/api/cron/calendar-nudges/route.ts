import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import type { DbEventSubscription } from '@/lib/communityEvents'
import { getNextOccurrence } from '@/lib/rrule'
import { verifyCronSecret } from '@/lib/cronAuth'

export const dynamic = 'force-dynamic'

function createServiceClient() {
  return createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
      },
    }
  )
}

/** Build placeholder body text for an auto-created draft post */
function buildDraftContent(eventName: string, target: string | null): string {
  const targetText = target ? ` on ${target}` : ''
  return [
    `Upcoming: ${eventName}${targetText}`,
    '',
    'Replace this with your content for the event.',
  ].join('\n')
}

/** Create a draft post pre-filled for the upcoming event */
async function createDraftPost(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  platform: string,
  eventName: string,
  target: string | null,
  nextOccurrence: Date
) {
  const content = buildDraftContent(eventName, target)
  const { error } = await supabase.from('posts').insert({
    user_id: userId,
    platform,
    status: 'draft',
    content: { text: content },
    scheduled_at: nextOccurrence.toISOString(),
  })
  if (error) {
    console.error('[cron/calendar-nudges] Draft insert error:', error)
  }
  return !error
}

/** Create a reminder linked to the community event */
async function createReminder(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  eventName: string,
  target: string | null,
  eventId: string,
  nextOccurrence: Date
) {
  const targetText = target ? ` (${target})` : ''
  const { error } = await supabase.from('reminders').insert({
    user_id: userId,
    title: `${eventName}${targetText} is coming up`,
    description: `Your subscribed event "${eventName}" is approaching. Prepare your content!`,
    remind_at: nextOccurrence.toISOString(),
    source_event_id: eventId,
  })
  if (error) {
    console.error('[cron/calendar-nudges] Reminder insert error:', error)
  }
  return !error
}

/** Check if a reminder already exists for this user + event + occurrence */
async function reminderExists(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  eventId: string,
  remindAt: Date
): Promise<boolean> {
  const windowStart = new Date(remindAt.getTime() - 60 * 60 * 1000)
  const windowEnd = new Date(remindAt.getTime() + 60 * 60 * 1000)

  const { data } = await supabase
    .from('reminders')
    .select('id')
    .eq('user_id', userId)
    .eq('source_event_id', eventId)
    .gte('remind_at', windowStart.toISOString())
    .lte('remind_at', windowEnd.toISOString())
    .limit(1)

  return (data?.length ?? 0) > 0
}

// eslint-disable-next-line max-lines-per-function -- borderline, extraction would hurt readability
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const supabase = createServiceClient()
  const now = new Date()

  let processed = 0
  let nudged = 0
  let draftsCreated = 0

  try {
    const { data: subs, error } = await supabase
      .from('user_event_subscriptions')
      .select('*, community_events(*)')

    if (error) {
      console.error('[cron/calendar-nudges] Query error:', error)
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
    }

    if (!subs?.length) {
      return NextResponse.json({ processed: 0, nudged: 0, draftsCreated: 0 })
    }

    for (const row of subs as DbEventSubscription[]) {
      processed++
      const event = row.community_events
      if (!event || !event.is_active) continue

      const next = getNextOccurrence(event.recurrence_rule, now)
      if (!next) continue

      const hoursUntil = (next.getTime() - now.getTime()) / (1000 * 60 * 60)
      if (hoursUntil > row.notify_hours_before || hoursUntil < 0) continue

      // Avoid duplicate reminders for the same occurrence
      const alreadyNudged = await reminderExists(supabase, row.user_id, event.id, next)
      if (alreadyNudged) continue

      // Create reminder
      const reminderOk = await createReminder(
        supabase,
        row.user_id,
        event.name,
        event.target,
        event.id,
        next
      )
      if (reminderOk) nudged++

      // Create draft if enabled
      if (row.auto_create_draft) {
        const draftOk = await createDraftPost(
          supabase,
          row.user_id,
          event.platform,
          event.name,
          event.target,
          next
        )
        if (draftOk) draftsCreated++
      }
    }

    return NextResponse.json({ processed, nudged, draftsCreated })
  } catch (err) {
    console.error('[cron/calendar-nudges] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
