import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { transformPostFromDb } from '@/lib/utils'
import type { DbPost } from '@/lib/utils'
import type { Post } from '@/lib/posts'

export const dynamic = 'force-dynamic'

const MAX_RETRY_COUNT = 3
const MAX_AGE_HOURS = 24
const BATCH_LIMIT = 10

interface RetryPublishResult {
  retryable?: boolean
  retryCount?: number
  lastAttemptAt?: string
  error?: string
  success?: boolean
  postId?: string
  postUrl?: string
  publishedAt?: string
}

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

function isRetryable(publishResult: RetryPublishResult | null): boolean {
  if (!publishResult) return false
  if (publishResult.retryable !== true) return false
  const count = publishResult.retryCount ?? 0
  return count < MAX_RETRY_COUNT
}

function getRetryCount(publishResult: RetryPublishResult | null): number {
  return publishResult?.retryCount ?? 0
}

async function findAccount(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  platform: string
) {
  const { data } = await supabase
    .from('social_accounts')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', platform)
    .limit(1)
    .single()
  return data
}

async function retryPost(
  supabase: ReturnType<typeof createServiceClient>,
  post: Post,
  userId: string
): Promise<'retried' | 'skipped' | 'failed'> {
  const account = await findAccount(supabase, userId, post.platform)
  const currentCount = getRetryCount(post.publishResult as RetryPublishResult | null)

  if (!account) {
    await supabase
      .from('posts')
      .update({
        publish_result: {
          ...(post.publishResult ?? {}),
          retryable: true,
          retryCount: currentCount + 1,
          lastAttemptAt: new Date().toISOString(),
          error: 'No active social account found for platform',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id)
    return 'skipped'
  }

  try {
    const { publishPost } = await import('@/lib/publishers')
    const result = await publishPost(post, account.id)

    if (result.success) {
      await supabase
        .from('posts')
        .update({
          status: 'published',
          publish_result: {
            ...result,
            retryCount: currentCount + 1,
            lastAttemptAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id)
      return 'retried'
    }

    await supabase
      .from('posts')
      .update({
        publish_result: {
          ...result,
          retryable: currentCount + 1 < MAX_RETRY_COUNT,
          retryCount: currentCount + 1,
          lastAttemptAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id)
    return 'failed'
  } catch (err) {
    await supabase
      .from('posts')
      .update({
        publish_result: {
          ...(post.publishResult ?? {}),
          retryable: currentCount + 1 < MAX_RETRY_COUNT,
          retryCount: currentCount + 1,
          lastAttemptAt: new Date().toISOString(),
          error: (err as Error).message,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id)
    return 'failed'
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = createServiceClient()
    const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString()

    const { data: rows, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'failed')
      .gte('updated_at', cutoff)
      .order('updated_at', { ascending: true })
      .limit(50)

    if (error) throw error

    const candidates = (rows as DbPost[])
      .map((row) => ({
        post: transformPostFromDb(row),
        userId: row.user_id,
      }))
      .filter(({ post }) => isRetryable(post.publishResult as RetryPublishResult | null))
      .slice(0, BATCH_LIMIT)

    const counts = { processed: 0, retried: 0, failed: 0, skipped: 0 }

    for (const { post, userId } of candidates) {
      counts.processed++
      const outcome = await retryPost(supabase, post, userId)
      counts[outcome]++
    }

    return NextResponse.json(counts)
  } catch (err) {
    console.error('[retry-failed]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
