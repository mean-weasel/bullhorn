import type { Post, PublishResult, Platform } from '@/lib/posts'
import { getValidAccessToken } from '@/lib/tokenRefresh'
import { createClient } from '@/lib/supabase/server'
import { publishToTwitter } from './twitter'
import { publishToLinkedIn } from './linkedin'
import { publishToReddit } from './reddit'

export interface PublishInput {
  post: Post
  accessToken: string
  providerAccountId: string
}

export interface PublishOutput {
  success: boolean
  publishResult?: PublishResult
  error?: string
  retryable?: boolean
}

type Publisher = (input: PublishInput) => Promise<PublishOutput>

const publishers: Record<Platform, Publisher> = {
  twitter: publishToTwitter,
  linkedin: publishToLinkedIn,
  reddit: publishToReddit,
}

/**
 * Main entry point for the publishing engine.
 * Resolves the access token, calls the platform publisher,
 * and updates the post status in the database.
 *
 * @param post - The post to publish
 * @param accountId - The social_accounts row ID
 */
export async function publishPost(post: Post, accountId: string): Promise<PublishOutput> {
  const publisher = publishers[post.platform]
  if (!publisher) {
    return {
      success: false,
      error: `Unsupported platform: ${post.platform}`,
      retryable: false,
    }
  }

  try {
    // 1. Get a valid access token (refreshes if needed)
    const accessToken = await getValidAccessToken(accountId)

    // 2. Fetch the account to get providerAccountId
    const supabase = await createClient()
    const { data: account } = await supabase
      .from('social_accounts')
      .select('provider_account_id')
      .eq('id', accountId)
      .single()

    if (!account) {
      return { success: false, error: 'Social account not found', retryable: false }
    }

    // 3. Call the platform publisher
    const result = await publisher({
      post,
      accessToken,
      providerAccountId: account.provider_account_id,
    })

    // 4. Update post status and publish_result in DB
    const newStatus = result.success ? 'published' : 'failed'
    const publishResult: PublishResult = result.publishResult || {
      success: false,
      platform: post.platform,
      error: result.error,
      retryable: result.retryable,
      retryCount: (post.publishResult?.retryCount || 0) + (result.success ? 0 : 1),
      lastAttemptAt: new Date().toISOString(),
    }

    await supabase
      .from('posts')
      .update({ status: newStatus, publish_result: publishResult })
      .eq('id', post.id)

    // 5. Update account last_used_at on success
    if (result.success) {
      await supabase
        .from('social_accounts')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', accountId)
    }

    return result
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      retryable: true,
    }
  }
}
