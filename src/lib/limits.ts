export type PlanType = 'free' | 'pro'

export const PLAN_LIMITS = {
  free: {
    posts: 50,
    campaigns: 5,
    projects: 3,
    blogDrafts: 10,
    launchPosts: 10,
    apiKeys: 5,
    socialAccountsPerProvider: 1,
    storageBytes: 50 * 1024 * 1024,
  },
  pro: {
    posts: 500,
    campaigns: 50,
    projects: 20,
    blogDrafts: 100,
    launchPosts: 100,
    apiKeys: 25,
    socialAccountsPerProvider: 5,
    storageBytes: 2 * 1024 * 1024 * 1024,
  },
} as const

export type ResourceType = keyof typeof PLAN_LIMITS.free

export const PLAN_FEATURES = {
  free: {
    autoPublish: false,
  },
  pro: {
    autoPublish: true,
  },
} as const

export type FeatureType = keyof typeof PLAN_FEATURES.free

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  posts: 'Posts',
  campaigns: 'Campaigns',
  projects: 'Projects',
  blogDrafts: 'Blog Drafts',
  launchPosts: 'Launch Posts',
  apiKeys: 'API Keys',
  socialAccountsPerProvider: 'Social Accounts per Platform',
  storageBytes: 'Storage',
}
