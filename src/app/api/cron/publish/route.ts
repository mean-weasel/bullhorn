import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { transformPostFromDb, type DbPost } from '@/lib/utils'
import { publishPost } from '@/lib/publishers'
import { getNextOccurrence } from '@/lib/rrule'

export const dynamic = 'force-dynamic'

/** Extended DB row that includes the optional social_account_id column */
type DbPostRow = DbPost & { social_account_id?: string | null }

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

interface ProcessResult {
  postId: string
  outcome: 'published' | 'failed'
  error?: string
}

async function findAccountForPost(
  post: DbPostRow,
  supabase: ReturnType<typeof createServiceClient>
): Promise<string | null> {
  if (post.social_account_id) {
    const { data } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('id', post.social_account_id)
      .eq('status', 'active')
      .limit(1)
    return data?.[0]?.id ?? null
  }

  const { data } = await supabase
    .from('social_accounts')
    .select('id')
    .eq('user_id', post.user_id)
    .eq('provider', post.platform)
    .eq('status', 'active')
    .limit(1)
  return data?.[0]?.id ?? null
}

async function markPostFailed(
  postId: string,
  errorMsg: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  await supabase
    .from('posts')
    .update({
      status: 'failed',
      publish_result: {
        success: false,
        error: errorMsg,
        retryable: false,
        lastAttemptAt: new Date().toISOString(),
      },
    })
    .eq('id', postId)
}

/**
 * If the published post has a recurrence_rule, compute the next occurrence
 * and insert a new scheduled copy of the post.
 */
async function scheduleNextRecurrence(
  post: DbPostRow,
  supabase: ReturnType<typeof createServiceClient>
) {
  if (!post.recurrence_rule || !post.scheduled_at) return

  const nextDate = getNextOccurrence(post.recurrence_rule, new Date(post.scheduled_at))
  if (!nextDate) return

  const { error } = await supabase.from('posts').insert({
    id: crypto.randomUUID(),
    user_id: post.user_id,
    platform: post.platform,
    content: post.content,
    status: 'scheduled',
    scheduled_at: nextDate.toISOString(),
    recurrence_rule: post.recurrence_rule,
    campaign_id: post.campaign_id ?? null,
    social_account_id: post.social_account_id ?? null,
    group_id: post.group_id ?? null,
    group_type: post.group_type ?? null,
    notes: post.notes ?? null,
  })

  if (error) {
    console.error(`[cron/publish] Failed to schedule next recurrence for ${post.id}:`, error)
  } else {
    console.log(
      `[cron/publish] Scheduled next recurrence for ${post.id} at ${nextDate.toISOString()}`
    )
  }
}

async function processPost(
  post: DbPostRow,
  supabase: ReturnType<typeof createServiceClient>
): Promise<ProcessResult> {
  // Set status to 'publishing' (optimistic lock)
  await supabase.from('posts').update({ status: 'publishing' }).eq('id', post.id)

  // Find a connected social account
  const accountId = await findAccountForPost(post, supabase)

  if (!accountId) {
    await markPostFailed(post.id, 'No connected account for this platform', supabase)
    return { postId: post.id, outcome: 'failed', error: 'No account' }
  }

  // Transform and publish
  const transformed = transformPostFromDb(post)
  const result = await publishPost(transformed, accountId)
  return {
    postId: post.id,
    outcome: result.success ? 'published' : 'failed',
    error: result.success ? undefined : result.error,
  }
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  try {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Fetch scheduled posts that are due
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now.toISOString())
      .gte('scheduled_at', oneHourAgo.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(20)

    if (error) {
      console.error('[cron/publish] Query error:', error)
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
    }

    if (!posts?.length) {
      return NextResponse.json({ processed: 0, published: 0, failed: 0 })
    }

    // Process each post independently
    const results: ProcessResult[] = []
    for (const dbPost of posts) {
      try {
        const result = await processPost(dbPost as DbPostRow, supabase)
        results.push(result)

        // On successful publish, schedule the next recurrence if applicable
        if (result.outcome === 'published') {
          await scheduleNextRecurrence(dbPost as DbPostRow, supabase)
        }
      } catch (err) {
        console.error(`[cron/publish] Post ${dbPost.id} error:`, err)
        results.push({
          postId: dbPost.id,
          outcome: 'failed',
          error: (err as Error).message,
        })
      }
    }

    const published = results.filter((r) => r.outcome === 'published').length
    const failed = results.filter((r) => r.outcome === 'failed').length

    return NextResponse.json({
      processed: results.length,
      published,
      failed,
    })
  } catch (err) {
    console.error('[cron/publish] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
