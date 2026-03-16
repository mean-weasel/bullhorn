import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { verifyCronSecret } from '@/lib/cronAuth'
import { publishPost } from '@/lib/publishers'
import { transformPostFromDb } from '@/lib/utils'

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

const MAX_RETRIES = 3
const RETRY_LIMIT = 5

export async function GET(request: NextRequest) {
  const authError = verifyCronSecret(request)
  if (authError) return authError

  const supabase = createServiceClient()

  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'failed')
      .limit(20)

    if (error) {
      console.error('[retry-failed] Query error:', error)
      return NextResponse.json({ error: 'Database query failed' }, { status: 500 })
    }

    const retryable = (posts || []).filter((p) => {
      const pr = p.publish_result as { retryable?: boolean; retryCount?: number } | null
      return p.social_account_id && pr?.retryable === true && (pr?.retryCount || 0) < MAX_RETRIES
    })

    const toRetry = retryable.slice(0, RETRY_LIMIT)

    let retried = 0
    await Promise.allSettled(
      toRetry.map(async (dbPost) => {
        const post = transformPostFromDb(dbPost)
        const result = await publishPost(post, dbPost.social_account_id, {
          supabaseClient: supabase,
          userId: dbPost.user_id,
        })
        if (result.success) retried++
      })
    )

    console.log(`[retry-failed] Attempted: ${toRetry.length}, Succeeded: ${retried}`)

    return NextResponse.json({
      retried,
      attempted: toRetry.length,
      skippedExhausted: retryable.length - toRetry.length,
    })
  } catch (err) {
    console.error('[retry-failed] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
