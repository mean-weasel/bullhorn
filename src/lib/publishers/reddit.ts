import type { PublishInput, PublishOutput } from './index'
import type { RedditContent } from '@/lib/posts'

const REDDIT_API_URL = 'https://oauth.reddit.com/api/submit'
const REDDIT_USER_AGENT =
  process.env.REDDIT_USER_AGENT || 'web:bullhorn-scheduler:v1.0.0 (by /u/unknown)'

function buildRedditParams(content: RedditContent): { params: URLSearchParams; subreddit: string } {
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

  if (kind === 'self' && content.body) params.set('text', content.body)
  else if (kind === 'link' && content.url) params.set('url', content.url)
  if (content.flairId) params.set('flair_id', content.flairId)
  if (content.flairText) params.set('flair_text', content.flairText)

  return { params, subreddit }
}

export async function publishToReddit(input: PublishInput): Promise<PublishOutput> {
  const content = input.post.content as RedditContent
  const { accessToken } = input

  try {
    const { params, subreddit } = buildRedditParams(content)

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
      return {
        success: false,
        error: `Reddit API error: ${res.status}`,
        retryable: res.status === 429 || res.status >= 500,
      }
    }

    const data = await res.json()
    if (data.json?.errors?.length) {
      const errorMsg = data.json.errors.map((e: string[]) => e.join(': ')).join('; ')
      return { success: false, error: errorMsg, retryable: false }
    }

    const postData = data.json?.data
    return {
      success: true,
      publishResult: {
        success: true,
        platform: 'reddit',
        postId: postData?.name || postData?.id || '',
        postUrl: postData?.url || '',
        subreddit,
        publishedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    return { success: false, error: (error as Error).message, retryable: true }
  }
}
