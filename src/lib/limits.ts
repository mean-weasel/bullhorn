export type PlanType = 'free' | 'pro'

export const PLAN_LIMITS = {
  free: {
    posts: 50,
    campaigns: 5,
    projects: 3,
    blogDrafts: 10,
    launchPosts: 10,
    storageBytes: 50 * 1024 * 1024,
  },
  pro: {
    posts: 500,
    campaigns: 50,
    projects: 20,
    blogDrafts: 100,
    launchPosts: 100,
    storageBytes: 2 * 1024 * 1024 * 1024,
  },
} as const

export type ResourceType = keyof typeof PLAN_LIMITS.free

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  posts: 'Posts',
  campaigns: 'Campaigns',
  projects: 'Projects',
  blogDrafts: 'Blog Drafts',
  launchPosts: 'Launch Posts',
  storageBytes: 'Storage',
}
