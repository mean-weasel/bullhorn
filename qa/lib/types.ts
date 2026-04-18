/** Raw YAML fixture shapes — before ref resolution */

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
  status?: string
  'ref:projectId'?: string
  [key: string]: unknown
}

export interface RawPost {
  _name: string
  platform: 'twitter' | 'linkedin' | 'reddit'
  content: Record<string, unknown>
  status?: string
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
  status?: string
  notes?: string
  tags?: string[]
  'ref:campaignId'?: string
  [key: string]: unknown
}

export interface RawLaunchPost {
  _name: string
  platform: string
  title: string
  url?: string
  description?: string
  platformFields?: Record<string, unknown>
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
