import type { PublishInput, PublishOutput } from './index'
import type { RedditContent } from '@/lib/posts'

const REDDIT_API_URL = 'https://oauth.reddit.com/api/submit'
const REDDIT_USER_AGENT =
  process.env.REDDIT_USER_AGENT || 'web:bullhorn-scheduler:v1.0.0 (by /u/unknown)'

// eslint-disable-next-line max-lines-per-function -- API handler requires auth+db in single try/catch
export async function publishToReddit(input: PublishInput): Promise<PublishOutput> {
  const content = input.post.content as RedditContent
  const { accessToken } = input

  try {
    // TODO: Add image/gallery upload support in follow-up task.

    const subreddit = content.subreddit.replace(/^r\//, '')
    const kind = content.url ? 'link' : 'self'

    const params = new URLSearchParams({
      sr: subreddit,
      title: content.title,
      kind,
      api_type: 'json',
      resubmit: 'true',
      send_replies: 'true',
    })

    if (kind === 'self' && content.body) {
      params.set('text', content.body)
    } else if (kind === 'link' && content.url) {
      params.set('url', content.url)
    }

    if (content.flairId) params.set('flair_id', content.flairId)
    if (content.flairText) params.set('flair_text', content.flairText)

    const res = await fetch(REDDIT_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': REDDIT_USER_AGENT,
      },
      body: params.toString(),
    })

    if (!res.ok) {
      const isRateLimit = res.status === 429
      return {
        success: false,
        error: `Reddit API error: ${res.status}`,
        retryable: isRateLimit || res.status >= 500,
      }
    }

    const data = await res.json()

    // Check for Reddit-level errors in JSON response
    if (data.json?.errors?.length) {
      const errorMsg = data.json.errors.map((e: string[]) => e.join(': ')).join('; ')
      return {
        success: false,
        error: errorMsg,
        retryable: false,
      }
    }

    const postData = data.json?.data
    const postUrl = postData?.url || ''
    const postId = postData?.name || postData?.id || ''

    return {
      success: true,
      publishResult: {
        success: true,
        platform: 'reddit',
        postId,
        postUrl,
        subreddit,
        publishedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      retryable: true,
    }
  }
}
