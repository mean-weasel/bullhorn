/** Raw YAML fixture shapes — before ref resolution */

import type { Platform, PostStatus, CampaignStatus } from '../../src/lib/posts'
import type { LaunchPlatform, LaunchPostStatus } from '../../src/lib/launchPosts'
import type { BlogDraftStatus } from '../../src/lib/blogDrafts'

export interface RawProject {
  _name: string
  name: string
  description?: string
  hashtags?: string[]
  brandColors?: Record<string, string>
  [key: string]: unknown
}

export interface RawCampaign {
  _name: string
  name: string
  description?: string
  status?: CampaignStatus
  'ref:projectId'?: string
  [key: string]: unknown
}

export interface RawPost {
  _name: string
  platform: Platform
  content: Record<string, unknown>
  status?: PostStatus
  scheduledAt?: string
  notes?: string
  'ref:campaignId'?: string
  media?: Array<{ path: string }>
  [key: string]: unknown
}

export interface RawBlogDraft {
  _name: string
  title?: string
  content?: string
  status?: BlogDraftStatus
  notes?: string
  tags?: string[]
  'ref:campaignId'?: string
  [key: string]: unknown
}

export interface RawLaunchPost {
  _name: string
  platform: LaunchPlatform
  title: string
  url?: string
  description?: string
  platformFields?: Record<string, unknown>
  status?: LaunchPostStatus
  notes?: string
  'ref:campaignId'?: string
  [key: string]: unknown
}

export interface FixtureFile {
  projects?: RawProject[]
  campaigns?: RawCampaign[]
  posts?: RawPost[]
  blogDrafts?: RawBlogDraft[]
  launchPosts?: RawLaunchPost[]
}

/** Maps _name → created UUID */
export type RefRegistry = Map<string, string>
