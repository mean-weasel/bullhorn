// Post fixtures for testing
import { Post, TwitterContent, LinkedInContent, RedditContent } from '@/lib/posts'

// Base fixture factory
function createBasePost(overrides: Partial<Post> = {}): Post {
  const now = new Date().toISOString()
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: now,
    updatedAt: now,
    scheduledAt: null,
    status: 'draft',
    platform: 'twitter',
    content: { text: '' },
    ...overrides,
  }
}

// ============================================
// Twitter Fixtures
// ============================================

export const twitterDraftFixture: Post = createBasePost({
  id: 'twitter-draft-1',
  platform: 'twitter',
  status: 'draft',
  content: {
    text: 'This is a test tweet for the social scheduler app. Testing 1, 2, 3...',
  } as TwitterContent,
})

export const twitterScheduledFixture: Post = createBasePost({
  id: 'twitter-scheduled-1',
  platform: 'twitter',
  status: 'scheduled',
  scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
  content: {
    text: 'Scheduled tweet going out tomorrow! Stay tuned for more updates.',
  } as TwitterContent,
})

export const twitterPublishedFixture: Post = createBasePost({
  id: 'twitter-published-1',
  platform: 'twitter',
  status: 'published',
  scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
  content: {
    text: 'This tweet was successfully published!',
  } as TwitterContent,
  publishResult: {
    success: true,
    postId: '1234567890123456789',
    postUrl: 'https://twitter.com/testuser/status/1234567890123456789',
    publishedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
})

export const twitterLongTweetFixture: Post = createBasePost({
  id: 'twitter-long-1',
  platform: 'twitter',
  status: 'draft',
  content: {
    text: 'This is a longer tweet that tests character limits. We want to make sure the app correctly handles tweets that approach the 280 character limit. Here we go with more text to fill it up and see how it displays.',
  } as TwitterContent,
})

export const twitterWithMediaFixture: Post = createBasePost({
  id: 'twitter-media-1',
  platform: 'twitter',
  status: 'draft',
  content: {
    text: 'Check out this amazing photo!',
    mediaUrls: ['https://example.com/image.jpg'],
  } as TwitterContent,
})

// ============================================
// LinkedIn Fixtures
// ============================================

export const linkedinDraftFixture: Post = createBasePost({
  id: 'linkedin-draft-1',
  platform: 'linkedin',
  status: 'draft',
  content: {
    text: 'Excited to share some thoughts on professional development and career growth.\n\nKey takeaways:\n- Always be learning\n- Network authentically\n- Share your knowledge\n\nWhat are your top career tips?',
    visibility: 'public',
  } as LinkedInContent,
})

export const linkedinConnectionsOnlyFixture: Post = createBasePost({
  id: 'linkedin-connections-1',
  platform: 'linkedin',
  status: 'draft',
  content: {
    text: "A more personal update for my network. Sometimes it's good to share with just your connections.",
    visibility: 'connections',
  } as LinkedInContent,
})

export const linkedinScheduledFixture: Post = createBasePost({
  id: 'linkedin-scheduled-1',
  platform: 'linkedin',
  status: 'scheduled',
  scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // In 2 days
  content: {
    text: "Big announcement coming soon! We've been working on something special and can't wait to share it with the LinkedIn community.",
    visibility: 'public',
  } as LinkedInContent,
})

export const linkedinPublishedFixture: Post = createBasePost({
  id: 'linkedin-published-1',
  platform: 'linkedin',
  status: 'published',
  scheduledAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
  content: {
    text: "Successfully published LinkedIn post about our team's latest achievement!",
    visibility: 'public',
  } as LinkedInContent,
  publishResult: {
    success: true,
    postId: 'urn:li:share:7123456789012345678',
    postUrl: 'https://www.linkedin.com/feed/update/urn:li:share:7123456789012345678',
    publishedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
  },
})

// ============================================
// Reddit Fixtures
// ============================================

export const redditDraftFixture: Post = createBasePost({
  id: 'reddit-draft-1',
  platform: 'reddit',
  status: 'draft',
  content: {
    subreddit: 'programming',
    title: 'Built a social media scheduler with GitHub as the backend',
    body: 'Just finished building a social media scheduler that uses GitHub repos for storage and GitHub Actions for publishing. Would love to get some feedback from the community!\n\nFeatures:\n- Schedule posts to Twitter, LinkedIn, and Reddit\n- Calendar view for managing posts\n- Draft support',
  } as RedditContent,
})

export const redditWithFlairFixture: Post = createBasePost({
  id: 'reddit-flair-1',
  platform: 'reddit',
  status: 'draft',
  content: {
    subreddit: 'SideProject',
    title: 'Show and Tell: My weekend project',
    body: 'Spent the weekend building something cool. Let me know what you think!',
    flairId: 'show-and-tell',
    flairText: 'Show and Tell',
  } as RedditContent,
})

export const redditLinkPostFixture: Post = createBasePost({
  id: 'reddit-link-1',
  platform: 'reddit',
  status: 'draft',
  content: {
    subreddit: 'webdev',
    title: 'Great article on modern CSS techniques',
    url: 'https://example.com/css-article',
  } as RedditContent,
})

export const redditScheduledFixture: Post = createBasePost({
  id: 'reddit-scheduled-1',
  platform: 'reddit',
  status: 'scheduled',
  scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // In 3 days
  content: {
    subreddit: 'startups',
    title: 'Launching next week - would love early feedback',
    body: "We're launching our product next week and would love to get some early adopters from this community.",
  } as RedditContent,
})

export const redditPublishedFixture: Post = createBasePost({
  id: 'reddit-published-1',
  platform: 'reddit',
  status: 'published',
  scheduledAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 3 days ago
  content: {
    subreddit: 'learnprogramming',
    title: 'Tips for learning React in 2024',
    body: 'Here are my top recommendations for learning React effectively...',
  } as RedditContent,
  publishResult: {
    success: true,
    postId: 'abc123xyz',
    postUrl: 'https://reddit.com/r/learnprogramming/comments/abc123xyz',
    publishedAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(),
  },
})

// ============================================
// Edge Case Fixtures
// ============================================

export const emptyContentFixture: Post = createBasePost({
  id: 'empty-content-1',
  platform: 'twitter',
  status: 'draft',
  content: {
    text: '',
  } as TwitterContent,
})

export const maxLengthTwitterFixture: Post = createBasePost({
  id: 'max-twitter-1',
  platform: 'twitter',
  status: 'draft',
  content: {
    text: 'A'.repeat(280), // Exactly 280 characters
  } as TwitterContent,
})

export const overLengthTwitterFixture: Post = createBasePost({
  id: 'over-twitter-1',
  platform: 'twitter',
  status: 'draft',
  content: {
    text: 'A'.repeat(300), // Over 280 characters
  } as TwitterContent,
})

// ============================================
// Factory Functions
// ============================================

export function createTwitterPost(text: string, status: Post['status'] = 'draft'): Post {
  return createBasePost({
    platform: 'twitter',
    status,
    content: { text } as TwitterContent,
  })
}

export function createLinkedInPost(
  text: string,
  visibility: 'public' | 'connections' = 'public',
  status: Post['status'] = 'draft'
): Post {
  return createBasePost({
    platform: 'linkedin',
    status,
    content: { text, visibility } as LinkedInContent,
  })
}

export function createRedditPost(
  subreddit: string,
  title: string,
  body: string,
  status: Post['status'] = 'draft'
): Post {
  return createBasePost({
    platform: 'reddit',
    status,
    content: { subreddit, title, body } as RedditContent,
  })
}

// ============================================
// Collections for testing
// ============================================

export const allTwitterFixtures = [
  twitterDraftFixture,
  twitterScheduledFixture,
  twitterPublishedFixture,
  twitterLongTweetFixture,
  twitterWithMediaFixture,
]

export const allLinkedInFixtures = [
  linkedinDraftFixture,
  linkedinConnectionsOnlyFixture,
  linkedinScheduledFixture,
  linkedinPublishedFixture,
]

export const allRedditFixtures = [
  redditDraftFixture,
  redditWithFlairFixture,
  redditLinkPostFixture,
  redditScheduledFixture,
  redditPublishedFixture,
]

export const allDraftFixtures = [
  twitterDraftFixture,
  twitterLongTweetFixture,
  twitterWithMediaFixture,
  linkedinDraftFixture,
  linkedinConnectionsOnlyFixture,
  redditDraftFixture,
  redditWithFlairFixture,
  redditLinkPostFixture,
]

export const allScheduledFixtures = [
  twitterScheduledFixture,
  linkedinScheduledFixture,
  redditScheduledFixture,
]

export const allPublishedFixtures = [
  twitterPublishedFixture,
  linkedinPublishedFixture,
  redditPublishedFixture,
]

export const allFixtures = [...allTwitterFixtures, ...allLinkedInFixtures, ...allRedditFixtures]
