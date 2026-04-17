export type PlanType = 'free' | 'pro' | 'selfHosted'

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
  selfHosted: {
    posts: Number.MAX_SAFE_INTEGER,
    campaigns: Number.MAX_SAFE_INTEGER,
    projects: Number.MAX_SAFE_INTEGER,
    blogDrafts: Number.MAX_SAFE_INTEGER,
    launchPosts: Number.MAX_SAFE_INTEGER,
    apiKeys: Number.MAX_SAFE_INTEGER,
    socialAccountsPerProvider: Number.MAX_SAFE_INTEGER,
    storageBytes: Number.MAX_SAFE_INTEGER,
  },
} as const satisfies Record<PlanType, Record<string, number>>

export type ResourceType = keyof typeof PLAN_LIMITS.free

export const PLAN_FEATURES = {
  free: {
    autoPublish: false,
  },
  pro: {
    autoPublish: true,
  },
  selfHosted: {
    autoPublish: true,
  },
} as const satisfies Record<PlanType, Record<string, boolean>>

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
