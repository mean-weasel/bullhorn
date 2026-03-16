import type { PublishInput, PublishOutput } from './index'
import type { LinkedInContent } from '@/lib/posts'
import { downloadMediaFromStorage } from './mediaDownload'
import { uploadLinkedInImage } from './linkedinMedia'

const LINKEDIN_API_URL = 'https://api.linkedin.com/rest/posts'
const LINKEDIN_API_VERSION = '202501'

// eslint-disable-next-line max-lines-per-function -- borderline, extraction would hurt readability
export async function publishToLinkedIn(input: PublishInput): Promise<PublishOutput> {
  const content = input.post.content as LinkedInContent
  const { accessToken, providerAccountId } = input

  try {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
    }

    let imageUrn: string | undefined

    if (content.mediaUrl && input.supabase && input.userId) {
      const { buffer, contentType } = await downloadMediaFromStorage(
        input.supabase,
        input.userId,
        content.mediaUrl
      )
      imageUrn = await uploadLinkedInImage(
        input.accessToken,
        providerAccountId,
        buffer,
        contentType
      )
    }

    const postBody = {
      author: `urn:li:person:${providerAccountId}`,
      commentary: content.text,
      visibility: content.visibility === 'connections' ? 'CONNECTIONS' : 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }

    if (imageUrn) {
      ;(postBody as Record<string, unknown>).content = {
        media: { title: '', id: imageUrn },
      }
    }

    const res = await fetch(LINKEDIN_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(postBody),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      const isRateLimit = res.status === 429
      return {
        success: false,
        error: errorData.message || 'Failed to create LinkedIn post',
        retryable: isRateLimit || res.status >= 500,
      }
    }

    const postUrn = res.headers.get('x-restli-id') || ''
    const postUrl = `https://www.linkedin.com/feed/update/${postUrn}`

    return {
      success: true,
      publishResult: {
        success: true,
        platform: 'linkedin',
        postUrn,
        postUrl,
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
