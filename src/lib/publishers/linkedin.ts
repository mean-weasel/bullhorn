import type { PublishInput, PublishOutput } from './index'
import type { LinkedInContent } from '@/lib/posts'

const LINKEDIN_API_URL = 'https://api.linkedin.com/rest/posts'
const LINKEDIN_API_VERSION = '202501'

function buildLinkedInPostBody(content: LinkedInContent, providerAccountId: string) {
  return {
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
}

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

    const res = await fetch(LINKEDIN_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildLinkedInPostBody(content, providerAccountId)),
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.message || 'Failed to create LinkedIn post',
        retryable: res.status === 429 || res.status >= 500,
      }
    }

    const postUrn = res.headers.get('x-restli-id') || ''
    return {
      success: true,
      publishResult: {
        success: true,
        platform: 'linkedin',
        postUrn,
        postUrl: `https://www.linkedin.com/feed/update/${postUrn}`,
        publishedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    return { success: false, error: (error as Error).message, retryable: true }
  }
}
