// Launch platform types
export type LaunchPlatform =
  | 'hacker_news_show'
  | 'hacker_news_ask'
  | 'hacker_news_link'
  | 'product_hunt'
  | 'dev_hunt'
  | 'beta_list'
  | 'indie_hackers'

export type LaunchPostStatus = 'draft' | 'scheduled' | 'posted'

// Platform-specific field interfaces
interface HackerNewsFields {
  text?: string
}

interface ProductHuntFields {
  tagline?: string
  thumbnail?: string
  gallery?: string[]
  pricing?: 'free' | 'paid' | 'freemium'
  productStatus?: 'available' | 'beta' | 'coming_soon'
  makers?: string[]
  twitterHandle?: string
  promoCode?: string
  promoDescription?: string
  promoExpiry?: string
  firstComment?: string
  interactiveDemo?: string
  appStoreUrl?: string
  playStoreUrl?: string
}

interface DevHuntFields {
  logo?: string
  screenshots?: string[]
  githubUrl?: string
  category?: string
  founderStory?: string
}

interface BetaListFields {
  oneSentencePitch?: string
  logo?: string
  screenshots?: string[]
  category?: string
}

interface IndieHackersFields {
  shortDescription?: string
  longDescription?: string
  revenue?: string
  affiliateUrl?: string
}

export type PlatformFields =
  | HackerNewsFields
  | ProductHuntFields
  | DevHuntFields
  | BetaListFields
  | IndieHackersFields

export interface LaunchPost {
  id: string
  createdAt: string
  updatedAt: string
  platform: LaunchPlatform
  status: LaunchPostStatus
  scheduledAt: string | null
  postedAt: string | null
  title: string
  url: string | null
  description: string | null
  platformFields: PlatformFields
  campaignId: string | null
  notes: string | null
}

export const LAUNCH_CHAR_LIMITS: Partial<Record<LaunchPlatform, Record<string, number>>> = {
  hacker_news_show: { title: 80 },
  hacker_news_ask: { title: 80 },
  hacker_news_link: { title: 80 },
  product_hunt: { tagline: 60, description: 260 },
  beta_list: { oneSentencePitch: 140 },
}

export const LAUNCH_PLATFORM_INFO: Record<
  LaunchPlatform,
  { name: string; label: string; color: string; bgColor: string; icon: string }
> = {
  hacker_news_show: {
    name: 'Show HN',
    label: 'Show HN',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: 'Y',
  },
  hacker_news_ask: {
    name: 'Ask HN',
    label: 'Ask HN',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: 'Y',
  },
  hacker_news_link: {
    name: 'Hacker News',
    label: 'HN Link',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    icon: 'Y',
  },
  product_hunt: {
    name: 'Product Hunt',
    label: 'Product Hunt',
    color: 'text-[#DA552F]',
    bgColor: 'bg-orange-100',
    icon: 'P',
  },
  dev_hunt: {
    name: 'Dev Hunt',
    label: 'Dev Hunt',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    icon: 'D',
  },
  beta_list: {
    name: 'BetaList',
    label: 'BetaList',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    icon: 'B',
  },
  indie_hackers: {
    name: 'Indie Hackers',
    label: 'Indie Hackers',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-100',
    icon: 'IH',
  },
}

export const LAUNCH_PLATFORM_URLS: Record<LaunchPlatform, string> = {
  hacker_news_show: 'https://news.ycombinator.com/submit',
  hacker_news_ask: 'https://news.ycombinator.com/submit',
  hacker_news_link: 'https://news.ycombinator.com/submit',
  product_hunt: 'https://www.producthunt.com/posts/new',
  dev_hunt: 'https://devhunt.org',
  beta_list: 'https://betalist.com/submit',
  indie_hackers: 'https://www.indiehackers.com/products',
}

export function getDefaultPlatformFields(platform: LaunchPlatform): PlatformFields {
  switch (platform) {
    case 'hacker_news_show':
    case 'hacker_news_ask':
    case 'hacker_news_link':
      return {}
    case 'product_hunt':
      return { pricing: 'free', productStatus: 'available' }
    case 'dev_hunt':
    case 'beta_list':
    case 'indie_hackers':
      return {}
  }
}

export function getHackerNewsFields(post: LaunchPost): HackerNewsFields {
  return (post.platformFields || {}) as HackerNewsFields
}

export function getProductHuntFields(post: LaunchPost): ProductHuntFields {
  return (post.platformFields || {}) as ProductHuntFields
}

export function getDevHuntFields(post: LaunchPost): DevHuntFields {
  return (post.platformFields || {}) as DevHuntFields
}

export function getBetaListFields(post: LaunchPost): BetaListFields {
  return (post.platformFields || {}) as BetaListFields
}

export function getIndieHackersFields(post: LaunchPost): IndieHackersFields {
  return (post.platformFields || {}) as IndieHackersFields
}
