import { NextRequest, NextResponse } from 'next/server'
import { requireSessionAuth, parseJsonBody } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/** DB row shape for notification_preferences (snake_case) */
interface DbNotificationPreferences {
  id: string
  user_id: string
  email_post_published: boolean
  email_post_failed: boolean
  email_weekly_digest: boolean
  email_campaign_reminder: boolean
  push_enabled: boolean
  created_at: string
  updated_at: string
}

/** Frontend shape (camelCase) */
interface NotificationPreferences {
  id: string
  emailPostPublished: boolean
  emailPostFailed: boolean
  emailWeeklyDigest: boolean
  emailCampaignReminder: boolean
  pushEnabled: boolean
  createdAt: string
  updatedAt: string
}

function transformFromDb(row: DbNotificationPreferences): NotificationPreferences {
  return {
    id: row.id,
    emailPostPublished: row.email_post_published,
    emailPostFailed: row.email_post_failed,
    emailWeeklyDigest: row.email_weekly_digest,
    emailCampaignReminder: row.email_campaign_reminder,
    pushEnabled: row.push_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const updateSchema = z.object({
  emailPostPublished: z.boolean().optional(),
  emailPostFailed: z.boolean().optional(),
  emailWeeklyDigest: z.boolean().optional(),
  emailCampaignReminder: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
})

// GET /api/notification-preferences
// Returns the current user's notification preferences.
// Creates a default row if none exists.
export async function GET() {
  try {
    let userId: string
    try {
      const auth = await requireSessionAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    // Try to fetch existing preferences
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code === 'PGRST116') {
      // No row found — create defaults
      const { data: inserted, error: insertError } = await supabase
        .from('notification_preferences')
        .insert({ user_id: userId })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating default notification preferences:', insertError)
        return NextResponse.json({ error: 'Failed to create preferences' }, { status: 500 })
      }

      return NextResponse.json({
        preferences: transformFromDb(inserted as DbNotificationPreferences),
      })
    }

    if (error) {
      console.error('Error fetching notification preferences:', error)
      return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
    }

    return NextResponse.json({
      preferences: transformFromDb(data as DbNotificationPreferences),
    })
  } catch (error) {
    console.error('Error in GET /api/notification-preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function buildNotifUpdates(data: z.infer<typeof updateSchema>) {
  const updates: Record<string, boolean> = {}
  if (data.emailPostPublished !== undefined) updates.email_post_published = data.emailPostPublished
  if (data.emailPostFailed !== undefined) updates.email_post_failed = data.emailPostFailed
  if (data.emailWeeklyDigest !== undefined) updates.email_weekly_digest = data.emailWeeklyDigest
  if (data.emailCampaignReminder !== undefined) {
    updates.email_campaign_reminder = data.emailCampaignReminder
  }
  if (data.pushEnabled !== undefined) updates.push_enabled = data.pushEnabled
  return updates
}

async function upsertNotifPreferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  updates: Record<string, boolean>
): Promise<{ preferences: NotificationPreferences } | { error: string }> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .update(updates)
    .eq('user_id', userId)
    .select()
    .single()

  if (error && error.code === 'PGRST116') {
    const { data: inserted, error: insertError } = await supabase
      .from('notification_preferences')
      .insert({ user_id: userId, ...updates })
      .select()
      .single()
    if (insertError) return { error: 'Failed to save preferences' }
    return { preferences: transformFromDb(inserted as DbNotificationPreferences) }
  }

  if (error) return { error: 'Failed to update preferences' }
  return { preferences: transformFromDb(data as DbNotificationPreferences) }
}

// PATCH /api/notification-preferences
// Updates the current user's notification preferences.
export async function PATCH(request: NextRequest) {
  try {
    let userId: string
    try {
      const auth = await requireSessionAuth()
      userId = auth.userId
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jsonResult = await parseJsonBody(request)
    if ('error' in jsonResult) return jsonResult.error
    const parsed = updateSchema.safeParse(jsonResult.data)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updates = buildNotifUpdates(parsed.data)
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const supabase = await createClient()
    const result = await upsertNotifPreferences(supabase, userId, updates)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ preferences: result.preferences })
  } catch (error) {
    console.error('Error in PATCH /api/notification-preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
