import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { getNextOccurrence } from '@/lib/rrule'
import { sendPushToUser } from '@/lib/webPushSender'
import { sendApnsToUser } from '@/lib/apnsSender'
import { sendPostsReadyEmail } from '@/lib/emailSender'
import { verifyCronSecret } from '@/lib/cronAuth'
import { PLAN_LIMITS, PLAN_FEATURES, type PlanType } from '@/lib/limits'
import { getUserPlan } from '@/lib/planEnforcement'
import { isSelfHosted } from '@/lib/selfHosted'
import { publishPost } from '@/lib/publishers'
import { transformPostFromDb } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/**
 * Cron: publish-due-posts
 *
 * Runs every 5 minutes. In self-hosted mode, auto-publishes all posts with
 * linked social accounts (including Reddit). In SaaS mode, auto-publishes
 * for Pro users (excluding Reddit), and transitions other posts to "ready"
 * status with notifications for manual publishing.
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
  created_at: string
  updated_at: string
  publish_result?: Record<string, unknown> | null
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

  // In self-hosted mode, skip plan limit check (limits are unlimited)
  if (isSelfHosted()) {
    // No resource limits in self-hosted mode; proceed to create next recurrence
  } else {
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
        `[publish] Skipping recurrence for ${post.id}: user ${post.user_id} at post limit (${count}/${limit})`
      )
      return
    }
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
    console.error(`[publish] Failed to schedule next recurrence for ${post.id}:`, error)
  }
}

/**
 * Send batched notifications per user for a group of posts.
 */
async function sendNotifications(
  userPostsMap: Map<string, DbPostRow[]>,
  supabase: ReturnType<typeof createServiceClient>,
  notificationType: 'ready' | 'failed'
) {
  let notified = 0

  for (const [userId, userPosts] of userPostsMap) {
    // Push notification (single summary)
    try {
      const pushPayload =
        notificationType === 'failed'
          ? {
              title:
                userPosts.length === 1
                  ? `Failed to auto-publish on ${userPosts[0].platform}`
                  : `${userPosts.length} posts failed to auto-publish`,
              body: 'Manual action needed',
              url: '/posts?status=ready',
            }
          : userPosts.length === 1
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
      await Promise.all([sendPushToUser(userId, pushPayload), sendApnsToUser(userId, pushPayload)])
    } catch (pushErr) {
      console.error(`[publish] Push failed for user ${userId}:`, pushErr)
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
      console.error(`[publish] Email failed for user ${userId}:`, emailErr)
    }

    notified++
  }

  return notified
}

// eslint-disable-next-line max-lines-per-function -- handler requires auth+db+publish in single try/catch
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
      .limit(8)

    if (error) {
      console.error('[publish] Query error:', error)
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
    }

    if (!posts?.length) {
      return NextResponse.json({ processed: 0, notified: 0 })
    }

    let processed = 0

    // Group posts by user for batched notifications
    const readyByUser = new Map<string, DbPostRow[]>()
    const failedAutoPublish = new Map<string, DbPostRow[]>()

    // Batch-fetch user plans
    const uniqueUserIds = [...new Set(posts.map((p: DbPostRow) => p.user_id))]
    const userPlans = new Map<string, PlanType>()
    for (const uid of uniqueUserIds) {
      const plan = await getUserPlan(uid)
      userPlans.set(uid, plan)
    }

    // Split posts into auto-publish candidates and notify-only
    const autoPublishCandidates: DbPostRow[] = []
    const notifyOnlyPosts: DbPostRow[] = []
    for (const post of posts) {
      const dbPost = post as DbPostRow
      const plan = userPlans.get(dbPost.user_id) || 'free'
      const canAutoPublish = isSelfHosted()
        ? !!dbPost.social_account_id
        : dbPost.social_account_id &&
          dbPost.platform !== 'reddit' &&
          PLAN_FEATURES[plan].autoPublish
      if (canAutoPublish) {
        autoPublishCandidates.push(dbPost)
      } else {
        notifyOnlyPosts.push(dbPost)
      }
    }

    // Process auto-publish candidates concurrently
    let autoPublished = 0
    const publishPromises = autoPublishCandidates.map(async (dbPost) => {
      const { data: updated, error: updateError } = await supabase
        .from('posts')
        .update({ status: 'publishing', updated_at: now.toISOString() })
        .match({ id: dbPost.id, status: 'scheduled' })
        .select('id')

      if (updateError || !updated?.length) return

      try {
        const post = transformPostFromDb(dbPost as unknown as import('@/lib/utils').DbPost)
        const result = await publishPost(post, dbPost.social_account_id!, {
          supabaseClient: supabase,
          userId: dbPost.user_id,
        })

        if (result.success) {
          autoPublished++
          processed++
        } else {
          const userPosts = failedAutoPublish.get(dbPost.user_id) || []
          userPosts.push(dbPost)
          failedAutoPublish.set(dbPost.user_id, userPosts)
          processed++
        }
      } catch (err) {
        console.error(`[publish] Auto-publish failed for ${dbPost.id}:`, err)
        const userPosts = failedAutoPublish.get(dbPost.user_id) || []
        userPosts.push(dbPost)
        failedAutoPublish.set(dbPost.user_id, userPosts)
        processed++
      }

      await scheduleNextRecurrence(dbPost, supabase)
    })
    await Promise.allSettled(publishPromises)

    // Process notify-only posts (transition to ready)
    for (const dbPost of notifyOnlyPosts) {
      const { error: updateError } = await supabase
        .from('posts')
        .update({ status: 'ready', updated_at: now.toISOString() })
        .match({ id: dbPost.id, status: 'scheduled' })

      if (updateError) {
        console.error(`[publish] Failed to update post ${dbPost.id}:`, updateError)
        continue
      }

      processed++

      const userPosts = readyByUser.get(dbPost.user_id) || []
      userPosts.push(dbPost)
      readyByUser.set(dbPost.user_id, userPosts)

      // Schedule next recurrence if applicable
      await scheduleNextRecurrence(dbPost, supabase)
    }

    // Send notifications for both groups
    let notified = 0
    notified += await sendNotifications(readyByUser, supabase, 'ready')
    notified += await sendNotifications(failedAutoPublish, supabase, 'failed')

    console.log(
      `[publish] Processed: ${processed}, Notified: ${notified} users, Auto-published: ${autoPublished}`
    )
    return NextResponse.json({ processed, notified, autoPublished })
  } catch (err) {
    console.error('[publish] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
