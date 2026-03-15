// Post type definitions and utilities

export type Platform = 'twitter' | 'linkedin' | 'reddit'
export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'archived'
export type CampaignStatus = 'active' | 'paused' | 'completed' | 'archived'

// Campaign interface
export interface Campaign {
  id: string
  name: string
  description?: string
  status: CampaignStatus
  projectId?: string // Reference to parent project
  createdAt: string
  updatedAt: string
}

// Project interface - organizational unit above campaigns
export interface Project {
  id: string
  name: string
  description?: string
  hashtags: string[]
  brandColors: {
    primary?: string
    secondary?: string
    accent?: string
  }
  logoUrl?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectAnalytics {
  totalCampaigns: number
  totalPosts: number
  scheduledPosts: number
  publishedPosts: number
}

export interface TwitterContent {
  text: string
  mediaUrls?: string[]
  launchedUrl?: string // URL of the published tweet
}

export interface LinkedInContent {
  text: string
  visibility: 'public' | 'connections'
  mediaUrl?: string // Single image or video URL
  launchedUrl?: string // URL of the published LinkedIn post
}

export interface RedditContent {
  subreddit: string // Single target subreddit
  title: string
  body?: string
  url?: string
  flairId?: string
  flairText?: string
  launchedUrl?: string // URL of the published Reddit post
}

export interface PublishResult {
  success: boolean
  platform?: Platform
  // Platform-specific IDs
  postId?: string // Tweet ID, Reddit post ID
  postUrl?: string // URL to the published post
  postUrn?: string // LinkedIn URN (urn:li:share:xxx)
  threadIds?: string[] // Twitter thread tweet IDs
  subreddit?: string // Reddit subreddit posted to
  // Error tracking
  error?: string
  retryable?: boolean
  retryCount?: number
  lastAttemptAt?: string
  publishedAt?: string
}

export type GroupType = 'reddit-crosspost'

// Platform-specific content type based on selected platform
export type PlatformContent = TwitterContent | LinkedInContent | RedditContent

export interface Post {
  id: string
  createdAt: string
  updatedAt: string
  scheduledAt: string | null
  status: PostStatus
  platform: Platform
  notes?: string // User/MCP notes for this post
  campaignId?: string // Optional reference to a campaign
  groupId?: string // Groups related posts (e.g., Reddit crossposts)
  groupType?: GroupType // Type of grouping
  socialAccountId?: string
  content: PlatformContent
  publishResult?: PublishResult
  recurrenceRule?: string | null
}

// Character limits per platform
export const CHAR_LIMITS: Record<Platform, number> = {
  twitter: 280,
  linkedin: 3000,
  reddit: 40000, // For self-post body
}

// Platform display info
export const PLATFORM_INFO: Record<
  Platform,
  { name: string; label: string; color: string; bgColor: string }
> = {
  twitter: {
    name: 'Twitter / X',
    label: 'Twitter',
    color: 'text-twitter',
    bgColor: 'bg-twitter/10',
  },
  linkedin: {
    name: 'LinkedIn',
    label: 'LinkedIn',
    color: 'text-linkedin',
    bgColor: 'bg-linkedin/10',
  },
  reddit: {
    name: 'Reddit',
    label: 'Reddit',
    color: 'text-reddit',
    bgColor: 'bg-reddit/10',
  },
}

// Type guards for platform content
export function isTwitterContent(content: PlatformContent): content is TwitterContent {
  return 'text' in content && !('visibility' in content) && !('subreddit' in content)
}

export function isLinkedInContent(content: PlatformContent): content is LinkedInContent {
  return 'text' in content && 'visibility' in content
}

export function isRedditContent(content: PlatformContent): content is RedditContent {
  return 'subreddit' in content && 'title' in content
}

// Helper to create a new post
export function createPost(overrides: Partial<Post> = {}): Post {
  const now = new Date().toISOString()
  const platform = overrides.platform || 'twitter'
  const defaultContent = getDefaultContent(platform)
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    scheduledAt: null,
    status: 'draft',
    platform,
    content: defaultContent,
    ...overrides,
  }
}

// Get default content for a platform
function getDefaultContent(platform: Platform): PlatformContent {
  switch (platform) {
    case 'twitter':
      return { text: '' }
    case 'linkedin':
      return { text: '', visibility: 'public' }
    case 'reddit':
      return { subreddit: '', title: '', body: '' }
  }
}

// Get the main text content for display
export function getPostPreviewText(post: Post): string {
  const content = post.content
  if (isTwitterContent(content)) {
    return content.text
  }
  if (isLinkedInContent(content)) {
    return content.text
  }
  if (isRedditContent(content)) {
    return content.body || content.title
  }
  return ''
}

// Extract the main text content from platform-specific content JSON
export function getTextFromContent(content: PlatformContent, platform: Platform): string {
  if (platform === 'reddit' && isRedditContent(content)) {
    return content.body || ''
  }
  if (
    (platform === 'twitter' && isTwitterContent(content)) ||
    (platform === 'linkedin' && isLinkedInContent(content))
  ) {
    return (content as TwitterContent | LinkedInContent).text
  }
  return ''
}

// Check if a post is due for publishing
export function isDue(post: Post): boolean {
  if (post.status !== 'scheduled' || !post.scheduledAt) {
    return false
  }
  return new Date(post.scheduledAt) <= new Date()
}
