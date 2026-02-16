type Platform = 'twitter' | 'linkedin' | 'reddit'

/**
 * Validate platform-specific content shape.
 * Returns null if valid, or an error message string if invalid.
 */
export function validatePostContent(
  platform: Platform,
  content: Record<string, unknown>
): string | null {
  switch (platform) {
    case 'twitter': {
      if (!content.text || typeof content.text !== 'string' || content.text.trim() === '') {
        return 'Twitter content requires a non-empty "text" field. Expected: { text: string, mediaUrls?: string[] }'
      }
      return null
    }
    case 'linkedin': {
      if (!content.text || typeof content.text !== 'string' || content.text.trim() === '') {
        return 'LinkedIn content requires a non-empty "text" field. Expected: { text: string, visibility?: "public" | "connections", mediaUrl?: string }'
      }
      if (
        content.visibility !== undefined &&
        content.visibility !== 'public' &&
        content.visibility !== 'connections'
      ) {
        return 'LinkedIn visibility must be "public" or "connections". Expected: { text: string, visibility?: "public" | "connections" }'
      }
      return null
    }
    case 'reddit': {
      const missing: string[] = []
      if (!content.subreddit || typeof content.subreddit !== 'string') missing.push('subreddit')
      if (!content.title || typeof content.title !== 'string') missing.push('title')
      if (missing.length > 0) {
        return `Reddit content requires: ${missing.join(', ')}. Expected: { subreddit: string, title: string, body?: string, url?: string }`
      }
      return null
    }
    default:
      return `Unknown platform: ${platform}`
  }
}
