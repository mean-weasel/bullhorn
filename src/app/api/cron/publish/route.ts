import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { getNextOccurrence } from '@/lib/rrule'
import { sendPushToUser } from '@/lib/webPushSender'
import { sendApnsToUser } from '@/lib/apnsSender'
import { sendPostsReadyEmail } from '@/lib/emailSender'
import { verifyCronSecret } from '@/lib/cronAuth'
import { PLAN_LIMITS, type PlanType } from '@/lib/limits'

export const dynamic = 'force-dynamic'

/**
 * Cron: notify-due-posts
 *
 * Runs every 5 minutes. Transitions scheduled posts that are due to "ready"
 * status and fires notifications. Actual publishing happens externally
 * (Claude in Chrome, Share Sheet, or manual copy/paste).
 */

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

interface DbPostRow {
  id: string
  user_id: string
  platform: string
  content: Record<string, unknown>
  status: string
  scheduled_at: string | null
  recurrence_rule: string | null
  campaign_id: string | null
  social_account_id: string | null
  group_id: string | null
  group_type: string | null
  notes: string | null
}

function getPreview(post: DbPostRow): string {
  if (typeof post.content !== 'object' || post.content === null) return ''
  const c = post.content as Record<string, string>
  const raw = c.text || c.title || c.body || ''
  return raw.length > 80 ? raw.slice(0, 80) + '...' : raw
}

async function scheduleNextRecurrence(
  post: DbPostRow,
  supabase: ReturnType<typeof createServiceClient>
) {
  if (!post.recurrence_rule || !post.scheduled_at) return

  const nextDate = getNextOccurrence(post.recurrence_rule, new Date(post.scheduled_at))
  if (!nextDate) return

  // Enforce plan limit before creating the next recurrence
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('plan')
    .eq('id', post.user_id)
    .single()
  const plan = (profile?.plan as PlanType) || 'free'
  const limit = PLAN_LIMITS[plan].posts

  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', post.user_id)
  if ((count || 0) >= limit) {
    console.warn(
      `[notify-due-posts] Skipping recurrence for ${post.id}: user ${post.user_id} at post limit (${count}/${limit})`
    )
    return
  }

  const { error } = await supabase.from('posts').insert({
    id: crypto.randomUUID(),
    user_id: post.user_id,
    platform: post.platform,
    content: post.content,
    status: 'scheduled',
    scheduled_at: nextDate.toISOString(),
    recurrence_rule: post.recurrence_rule,
    campaign_id: post.campaign_id,
    social_account_id: post.social_account_id,
    group_id: post.group_id,
    group_type: post.group_type,
    notes: post.notes,
  })

  if (error) {
    console.error(`[notify-due-posts] Failed to schedule next recurrence for ${post.id}:`, error)
  }
}

// eslint-disable-next-line max-lines-per-function -- API handler requires auth+db in single try/catch
export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const supabase = createServiceClient()

  try {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Find scheduled posts that are due (within the last hour)
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString())
      .gte('scheduled_at', oneHourAgo.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50)

    if (error) {
      console.error('[notify-due-posts] Query error:', error)
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
    }

    if (!posts?.length) {
      return NextResponse.json({ processed: 0, notified: 0 })
    }

    let processed = 0
    let notified = 0

    // Group processed posts by user for batched notifications
    const readyByUser = new Map<string, DbPostRow[]>()

    for (const post of posts) {
      const dbPost = post as DbPostRow

      // Transition to ready
      const { error: updateError } = await supabase
        .from('posts')
        .update({ status: 'ready', updated_at: now.toISOString() })
        .match({ id: dbPost.id, status: 'scheduled' })

      if (updateError) {
        console.error(`[notify-due-posts] Failed to update post ${dbPost.id}:`, updateError)
        continue
      }

      processed++

      const userPosts = readyByUser.get(dbPost.user_id) || []
      userPosts.push(dbPost)
      readyByUser.set(dbPost.user_id, userPosts)

      // Schedule next recurrence if applicable
      await scheduleNextRecurrence(dbPost, supabase)
    }

    // Send batched notifications per user (one push + one email per user)
    for (const [userId, userPosts] of readyByUser) {
      // Push notification (single summary)
      try {
        const pushPayload =
          userPosts.length === 1
            ? {
                title: `Ready to publish on ${userPosts[0].platform}`,
                body: getPreview(userPosts[0]) || 'Your scheduled post is ready',
                url: `/edit/${userPosts[0].id}`,
              }
            : {
                title: `${userPosts.length} posts ready to publish`,
                body: userPosts.map((p) => p.platform).join(', '),
                url: '/posts?status=ready',
              }
        await Promise.all([
          sendPushToUser(userId, pushPayload),
          sendApnsToUser(userId, pushPayload),
        ])
      } catch (pushErr) {
        console.error(`[notify-due-posts] Push failed for user ${userId}:`, pushErr)
      }

      // Email notification (single digest)
      try {
        const { data: userData } = await supabase.auth.admin.getUserById(userId)
        if (userData?.user?.email) {
          await sendPostsReadyEmail(
            userData.user.email,
            userPosts.map((p) => ({
              id: p.id,
              platform: p.platform,
              preview: getPreview(p),
            }))
          )
        }
      } catch (emailErr) {
        console.error(`[notify-due-posts] Email failed for user ${userId}:`, emailErr)
      }

      notified++
    }

    console.log(`[notify-due-posts] Processed: ${processed}, Notified: ${notified} users`)
    return NextResponse.json({ processed, notified })
  } catch (err) {
    console.error('[notify-due-posts] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
