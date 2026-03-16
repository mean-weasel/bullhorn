import type { PublishInput, PublishOutput } from './index'
import type { TwitterContent } from '@/lib/posts'
import { downloadMediaFromStorage } from './mediaDownload'
import { uploadTwitterMedia } from './twitterMedia'

const TWITTER_API_URL = 'https://api.x.com/2/tweets'

function inferMediaCategory(contentType: string): 'tweet_image' | 'tweet_video' | 'tweet_gif' {
  if (contentType.startsWith('video/')) return 'tweet_video'
  if (contentType === 'image/gif') return 'tweet_gif'
  return 'tweet_image'
}

/**
 * Split text into tweet-sized chunks at word boundaries.
 * Exported for testing.
 */
export function splitIntoThread(text: string, maxLength = 280): string[] {
  if (text.length <= maxLength) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining)
      break
    }

    // Find last space within maxLength
    let splitIndex = remaining.lastIndexOf(' ', maxLength)
    if (splitIndex <= 0) {
      // No space found, hard split at maxLength
      splitIndex = maxLength
    }

    chunks.push(remaining.slice(0, splitIndex).trimEnd())
    remaining = remaining.slice(splitIndex).trimStart()
  }

  return chunks
}

// eslint-disable-next-line max-lines-per-function -- borderline, extraction would hurt readability
export async function publishToTwitter(input: PublishInput): Promise<PublishOutput> {
  const content = input.post.content as TwitterContent
  const { accessToken } = input

  try {
    let mediaIds: string[] | undefined

    if (content.mediaUrls?.length && input.supabase && input.userId) {
      mediaIds = []
      for (const mediaUrl of content.mediaUrls) {
        const { buffer, contentType } = await downloadMediaFromStorage(
          input.supabase,
          input.userId,
          mediaUrl
        )
        const category = inferMediaCategory(contentType)
        const mediaId = await uploadTwitterMedia(input.accessToken, buffer, contentType, category)
        mediaIds.push(mediaId)
      }
    }

    const tweets = splitIntoThread(content.text)
    const tweetIds: string[] = []
    let lastTweetId: string | null = null

    for (const tweetText of tweets) {
      const body: Record<string, unknown> = { text: tweetText }
      if (lastTweetId) {
        body.reply = { in_reply_to_tweet_id: lastTweetId }
      }
      if (!lastTweetId && mediaIds?.length) {
        body.media = { media_ids: mediaIds }
      }

      const res = await fetch(TWITTER_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        const isRateLimit = res.status === 429
        return {
          success: false,
          error: errorData.detail || errorData.title || 'Failed to create tweet',
          retryable: isRateLimit || res.status >= 500,
        }
      }

      const result = await res.json()
      tweetIds.push(result.data.id)
      lastTweetId = result.data.id
    }

    return {
      success: true,
      publishResult: {
        success: true,
        platform: 'twitter',
        postId: tweetIds[0],
        postUrl: `https://x.com/i/status/${tweetIds[0]}`,
        threadIds: tweetIds.length > 1 ? tweetIds : undefined,
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
