/**
 * Storage layer — thin HTTP wrappers around the Bullhorn API.
 * All data transforms and auth are handled server-side.
 */

import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { BullhornClient } from './client.js'

// Singleton client
let client: BullhornClient | null = null

function getClient(): BullhornClient {
  if (!client) {
    client = new BullhornClient()
  }
  return client
}

/** Reset singleton client — only for testing. */
export function _resetClient(): void {
  client = null
}

// ==================
// Type definitions
// ==================

export type Platform = 'twitter' | 'linkedin' | 'reddit'
export type PostStatus = 'draft' | 'scheduled' | 'ready' | 'published' | 'failed' | 'archived'
export type CampaignStatus = 'active' | 'paused' | 'completed' | 'archived'
export type GroupType = 'reddit-crosspost'
export type BlogDraftStatus = 'draft' | 'scheduled' | 'published' | 'archived'
export type LaunchPlatform =
  | 'hacker_news_show'
  | 'hacker_news_ask'
  | 'hacker_news_link'
  | 'product_hunt'
  | 'dev_hunt'
  | 'beta_list'
  | 'indie_hackers'

export interface TwitterContent {
  text: string
  mediaUrls?: string[]
  launchedUrl?: string
}

export interface LinkedInContent {
  text: string
  visibility: 'public' | 'connections'
  mediaUrl?: string
  launchedUrl?: string
}

export interface RedditContent {
  subreddit: string
  title: string
  body?: string
  url?: string
  flairId?: string
  flairText?: string
  launchedUrl?: string
}

export interface PublishResult {
  success: boolean
  postId?: string
  postUrl?: string
  error?: string
  publishedAt?: string
}

export type PlatformContent = TwitterContent | LinkedInContent | RedditContent

export interface Post {
  id: string
  createdAt: string
  updatedAt: string
  scheduledAt: string | null
  status: PostStatus
  platform: Platform
  notes?: string
  campaignId?: string
  groupId?: string
  groupType?: GroupType
  content: PlatformContent
  publishResult?: PublishResult
}

export interface Campaign {
  id: string
  name: string
  description?: string
  status: CampaignStatus
  projectId?: string
  createdAt: string
  updatedAt: string
}

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

export interface ProjectAccount {
  id: string
  projectId: string
  accountId: string
  createdAt: string
}

export interface ProjectAnalytics {
  totalCampaigns: number
  totalPosts: number
  scheduledPosts: number
  publishedPosts: number
  draftPosts: number
  failedPosts: number
}

export interface BlogDraft {
  id: string
  createdAt: string
  updatedAt: string
  scheduledAt: string | null
  status: BlogDraftStatus
  title: string
  date: string | null
  content: string
  notes?: string
  wordCount: number
  campaignId?: string
  images: string[]
}

export interface LaunchPost {
  id: string
  createdAt: string
  updatedAt: string
  platform: LaunchPlatform
  status: string
  scheduledAt: string | null
  postedAt: string | null
  title: string
  url: string | null
  description: string | null
  platformFields: Record<string, unknown>
  campaignId: string | null
  notes: string | null
}

// ==================
// Post Operations
// ==================

export async function createPost(data: {
  platform: Platform
  content: PlatformContent
  scheduledAt?: string | null
  status?: PostStatus
  notes?: string
  campaignId?: string
  groupId?: string
  groupType?: GroupType
}): Promise<Post> {
  const res = await getClient().post<{ post: Post }>('/posts', {
    platform: data.platform,
    content: data.content,
    scheduledAt: data.scheduledAt || null,
    status: data.status || 'draft',
    notes: data.notes || null,
    campaignId: data.campaignId || null,
    groupId: data.groupId || null,
    groupType: data.groupType || null,
  })
  return res.post
}

export async function getPost(id: string): Promise<Post | undefined> {
  try {
    const res = await getClient().get<{ post: Post }>(`/posts/${id}`)
    return res.post
  } catch {
    return undefined
  }
}

export async function updatePost(
  id: string,
  updates: Partial<Omit<Post, 'id' | 'createdAt'>>
): Promise<Post | undefined> {
  try {
    const res = await getClient().patch<{ post: Post }>(
      `/posts/${id}`,
      updates as Record<string, unknown>
    )
    return res.post
  } catch {
    return undefined
  }
}

export async function deletePost(id: string): Promise<boolean> {
  try {
    await getClient().delete(`/posts/${id}`)
    return true
  } catch {
    return false
  }
}

export async function archivePost(id: string): Promise<Post | undefined> {
  return updatePost(id, { status: 'archived' })
}

export async function restorePost(id: string): Promise<Post | undefined> {
  return updatePost(id, { status: 'draft' })
}

export async function listPosts(options?: {
  status?: PostStatus | 'all'
  platform?: Platform
  campaignId?: string
  groupId?: string
  limit?: number
}): Promise<Post[]> {
  const params: Record<string, string> = {}
  if (options?.status && options.status !== 'all') params.status = options.status
  if (options?.platform) params.platform = options.platform
  if (options?.campaignId) params.campaignId = options.campaignId
  if (options?.groupId) params.groupId = options.groupId
  if (options?.limit) params.limit = String(options.limit)

  const res = await getClient().get<{ posts: Post[] }>('/posts', params)
  return res.posts
}

export async function searchPosts(query: string, options?: { limit?: number }): Promise<Post[]> {
  const params: Record<string, string> = { q: query }
  if (options?.limit) params.limit = String(options.limit)

  const res = await getClient().get<{ posts: Post[] }>('/posts', params)
  return res.posts
}

// ==================
// Publish Workflow Operations
// ==================

export interface DuePost {
  id: string
  platform: Platform
  status: PostStatus
  scheduledAt: string | null
  preview: string
  hasMedia: boolean
}

export async function listDuePosts(options?: { platform?: Platform }): Promise<DuePost[]> {
  const params: Record<string, string> = {}
  if (options?.platform) params.platform = options.platform
  const res = await getClient().get<{ posts: DuePost[] }>('/posts/due', params)
  return res.posts
}

export interface UpcomingPost {
  id: string
  platform: Platform
  scheduledAt: string | null
  preview: string
  campaignId: string | null
}

export async function listUpcomingPosts(hours: number = 24): Promise<UpcomingPost[]> {
  const res = await getClient().get<{ posts: UpcomingPost[] }>('/posts/upcoming', {
    hours: String(hours),
  })
  return res.posts
}

export interface PostMedia {
  filename: string
  originalUrl: string
  downloadUrl: string | null
  expiresIn: number
}

export async function getPostMedia(postId: string): Promise<PostMedia[]> {
  const res = await getClient().get<{ media: PostMedia[] }>(`/posts/${postId}/media`)
  return res.media
}

// ==================
// Campaign Operations
// ==================

export async function createCampaign(data: {
  name: string
  description?: string
  status?: CampaignStatus
}): Promise<Campaign> {
  const res = await getClient().post<{ campaign: Campaign }>('/campaigns', {
    name: data.name,
    description: data.description || null,
    status: data.status || 'active',
  })
  return res.campaign
}

export async function getCampaign(
  id: string
): Promise<{ campaign: Campaign; posts: Post[] } | undefined> {
  try {
    const res = await getClient().get<{ campaign: Campaign; posts: Post[] }>(`/campaigns/${id}`)
    return res
  } catch {
    return undefined
  }
}

export async function updateCampaign(
  id: string,
  updates: Partial<Omit<Campaign, 'id' | 'createdAt'>>
): Promise<Campaign | undefined> {
  try {
    const res = await getClient().patch<{ campaign: Campaign }>(
      `/campaigns/${id}`,
      updates as Record<string, unknown>
    )
    return res.campaign
  } catch {
    return undefined
  }
}

export async function deleteCampaign(id: string): Promise<boolean> {
  try {
    await getClient().delete(`/campaigns/${id}`)
    return true
  } catch {
    return false
  }
}

export async function listCampaigns(options?: {
  status?: CampaignStatus | 'all'
  limit?: number
}): Promise<Campaign[]> {
  const params: Record<string, string> = {}
  if (options?.status && options.status !== 'all') params.status = options.status
  if (options?.limit) params.limit = String(options.limit)

  const res = await getClient().get<{ campaigns: Campaign[] }>('/campaigns', params)
  return res.campaigns
}

export async function addPostToCampaign(
  campaignId: string,
  postId: string
): Promise<Post | undefined> {
  return updatePost(postId, { campaignId })
}

export async function removePostFromCampaign(
  _campaignId: string,
  postId: string
): Promise<Post | undefined> {
  // Set campaignId to null by sending null in update
  try {
    const res = await getClient().patch<{ post: Post }>(`/posts/${postId}`, { campaignId: null })
    return res.post
  } catch {
    return undefined
  }
}

// ==================
// Blog Draft Operations
// ==================

export async function createBlogDraft(data: {
  title: string
  content?: string
  date?: string | null
  scheduledAt?: string | null
  status?: BlogDraftStatus
  notes?: string
  campaignId?: string
}): Promise<BlogDraft> {
  const res = await getClient().post<{ draft: BlogDraft }>('/blog-drafts', {
    title: data.title,
    content: data.content || '',
    date: data.date || null,
    scheduledAt: data.scheduledAt || null,
    status: data.status || 'draft',
    notes: data.notes || null,
    campaignId: data.campaignId || null,
  })
  return res.draft
}

export async function getBlogDraft(id: string): Promise<BlogDraft | undefined> {
  try {
    const res = await getClient().get<{ draft: BlogDraft }>(`/blog-drafts/${id}`)
    return res.draft
  } catch {
    return undefined
  }
}

export async function updateBlogDraft(
  id: string,
  updates: Partial<Omit<BlogDraft, 'id' | 'createdAt' | 'wordCount'>>
): Promise<BlogDraft | undefined> {
  try {
    const res = await getClient().patch<{ draft: BlogDraft }>(
      `/blog-drafts/${id}`,
      updates as Record<string, unknown>
    )
    return res.draft
  } catch {
    return undefined
  }
}

export async function deleteBlogDraft(id: string): Promise<boolean> {
  try {
    await getClient().delete(`/blog-drafts/${id}`)
    return true
  } catch {
    return false
  }
}

export async function archiveBlogDraft(id: string): Promise<BlogDraft | undefined> {
  return updateBlogDraft(id, { status: 'archived' })
}

export async function restoreBlogDraft(id: string): Promise<BlogDraft | undefined> {
  return updateBlogDraft(id, { status: 'draft' })
}

export async function listBlogDrafts(options?: {
  status?: BlogDraftStatus | 'all'
  campaignId?: string
  limit?: number
}): Promise<BlogDraft[]> {
  const params: Record<string, string> = {}
  if (options?.status && options.status !== 'all') params.status = options.status
  if (options?.campaignId) params.campaignId = options.campaignId
  if (options?.limit) params.limit = String(options.limit)

  const res = await getClient().get<{ drafts: BlogDraft[] }>('/blog-drafts', params)
  return res.drafts
}

export async function searchBlogDrafts(
  query: string,
  options?: { limit?: number }
): Promise<BlogDraft[]> {
  const params: Record<string, string> = { q: query }
  if (options?.limit) params.limit = String(options.limit)

  const res = await getClient().get<{ drafts: BlogDraft[] }>('/blog-drafts', params)
  return res.drafts
}

// ==================
// Media Upload
// ==================

const ALLOWED_EXTENSIONS: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
}

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])
const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB

export async function uploadMedia(filePath: string): Promise<{ filename: string; url: string }> {
  const resolved = path.resolve(filePath)
  const ext = path.extname(resolved).toLowerCase()

  // Validate extension before reading file
  const mimetype = ALLOWED_EXTENSIONS[ext]
  if (!mimetype) {
    const allowed = Object.keys(ALLOWED_EXTENSIONS).join(', ')
    throw new Error(`Unsupported file type "${ext}". Allowed: ${allowed}`)
  }

  // Check file exists and is a regular file
  const fileStat = await stat(resolved)
  if (!fileStat.isFile()) {
    throw new Error(`Path is not a regular file: ${resolved}`)
  }

  // Check size locally before uploading
  const isImage = IMAGE_EXTENSIONS.has(ext)
  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE
  if (fileStat.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024)
    throw new Error(
      `File too large (${Math.round(fileStat.size / (1024 * 1024))}MB). Max: ${maxMB}MB`
    )
  }

  // Read file and upload
  const buffer = await readFile(resolved)
  const basename = path.basename(resolved)
  const blob = new Blob([buffer], { type: mimetype })
  const formData = new FormData()
  formData.append('file', blob, basename)

  const client = getClient()
  const res = await client.postFormData<{ success: boolean; filename: string; url: string }>(
    '/media/upload',
    formData
  )

  // Construct full public URL from relative path
  const baseUrl = (process.env.BULLHORN_API_URL || 'https://bullhorn.to').replace(/\/$/, '')
  const url = `${baseUrl}${res.url}`

  return { filename: res.filename, url }
}

export interface MediaFile {
  filename: string
  url: string
  size: number | null
  mimetype: string | null
  createdAt: string
}

export async function listMediaFiles(): Promise<MediaFile[]> {
  const res = await getClient().get<{ files: MediaFile[] }>('/media')
  return res.files
}

export async function deleteMediaFile(filename: string): Promise<void> {
  const client = getClient()
  const res = await client.delete<{ success?: boolean; error?: string }>(`/media/${filename}`)
  if (res.error) {
    throw new Error(res.error)
  }
}

export async function addImageToBlogDraft(
  _draftId: string,
  sourcePath: string
): Promise<{ filename: string; size: number; mimetype: string; markdown: string }> {
  const result = await uploadMedia(sourcePath)

  const resolved = path.resolve(sourcePath)
  const ext = path.extname(resolved).toLowerCase()
  const fileStat = await stat(resolved)

  return {
    filename: result.filename,
    size: fileStat.size,
    mimetype: ALLOWED_EXTENSIONS[ext] || 'application/octet-stream',
    markdown: `![image](${result.url})`,
  }
}

export async function getDraftImages(draftId: string): Promise<string[]> {
  const draft = await getBlogDraft(draftId)
  return draft?.images || []
}

// ==================
// Project Operations
// ==================

export async function createProject(data: {
  name: string
  description?: string
  hashtags?: string[]
  brandColors?: Record<string, string>
  logoUrl?: string
}): Promise<{ project: Project; atLimit: boolean }> {
  const res = await getClient().post<{
    project: Project
    meta: { atLimit: boolean }
  }>('/projects', {
    name: data.name,
    description: data.description || null,
    hashtags: data.hashtags || [],
    brandColors: data.brandColors || {},
    logoUrl: data.logoUrl || null,
  })
  return { project: res.project, atLimit: res.meta?.atLimit || false }
}

export async function getProject(id: string): Promise<Project | undefined> {
  try {
    const res = await getClient().get<{ project: Project }>(`/projects/${id}`)
    return res.project
  } catch {
    return undefined
  }
}

export async function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt'>>
): Promise<Project | undefined> {
  try {
    const res = await getClient().patch<{ project: Project }>(
      `/projects/${id}`,
      updates as Record<string, unknown>
    )
    return res.project
  } catch {
    return undefined
  }
}

export async function deleteProject(
  id: string
): Promise<{ success: boolean; campaignsDeleted: number }> {
  const res = await getClient().delete<{
    success: boolean
    deleted: { campaignsAffected: number }
  }>(`/projects/${id}`)
  return { success: true, campaignsDeleted: res.deleted?.campaignsAffected || 0 }
}

export async function listProjects(options?: {
  limit?: number
  offset?: number
}): Promise<{ projects: Project[]; total: number; softLimit: number; atLimit: boolean }> {
  const params: Record<string, string> = {}
  if (options?.limit) params.limit = String(options.limit)
  if (options?.offset) params.offset = String(options.offset)

  const res = await getClient().get<{
    projects: Project[]
    meta: { count: number; softLimit: number; atLimit: boolean }
  }>('/projects', params)
  return {
    projects: res.projects,
    total: res.meta?.count || res.projects.length,
    softLimit: res.meta?.softLimit || 3,
    atLimit: res.meta?.atLimit || false,
  }
}

export async function getProjectWithCampaigns(
  id: string
): Promise<{ project: Project; campaigns: Campaign[] } | undefined> {
  const project = await getProject(id)
  if (!project) return undefined

  const campaigns = await listCampaignsByProject(id, {})
  return { project, campaigns }
}

export async function getProjectAnalytics(id: string): Promise<ProjectAnalytics | undefined> {
  const project = await getProject(id)
  if (!project) return undefined

  const campaigns = await listCampaignsByProject(id, {})
  const campaignIds = campaigns.map((c) => c.id)

  if (campaignIds.length === 0) {
    return {
      totalCampaigns: 0,
      totalPosts: 0,
      scheduledPosts: 0,
      publishedPosts: 0,
      draftPosts: 0,
      failedPosts: 0,
    }
  }

  // Get posts for each campaign and aggregate
  let totalPosts = 0
  let scheduledPosts = 0
  let publishedPosts = 0
  let draftPosts = 0
  let failedPosts = 0

  for (const cid of campaignIds) {
    const posts = await listPosts({ campaignId: cid })
    totalPosts += posts.length
    for (const p of posts) {
      if (p.status === 'scheduled') scheduledPosts++
      else if (p.status === 'published') publishedPosts++
      else if (p.status === 'draft') draftPosts++
      else if (p.status === 'failed') failedPosts++
    }
  }

  return {
    totalCampaigns: campaignIds.length,
    totalPosts,
    scheduledPosts,
    publishedPosts,
    draftPosts,
    failedPosts,
  }
}

// ==================
// Project Account Operations
// ==================

export async function addAccountToProject(
  projectId: string,
  accountId: string
): Promise<ProjectAccount> {
  const res = await getClient().post<{ association: ProjectAccount }>(
    `/projects/${projectId}/accounts`,
    { accountId }
  )
  return res.association
}

export async function removeAccountFromProject(
  projectId: string,
  accountId: string
): Promise<boolean> {
  try {
    await getClient().delete(`/projects/${projectId}/accounts/${accountId}`)
    return true
  } catch {
    return false
  }
}

export async function getProjectAccounts(projectId: string): Promise<ProjectAccount[]> {
  try {
    const res = await getClient().get<{ accounts: ProjectAccount[] }>(
      `/projects/${projectId}/accounts`
    )
    return res.accounts
  } catch {
    return []
  }
}

// ==================
// Campaign-Project Operations
// ==================

export async function moveCampaignToProject(
  campaignId: string,
  targetProjectId: string | null
): Promise<Campaign | undefined> {
  return updateCampaign(campaignId, { projectId: targetProjectId || undefined })
}

export async function listCampaignsByProject(
  projectId: string | null,
  options?: { status?: CampaignStatus | 'all'; limit?: number }
): Promise<Campaign[]> {
  const params: Record<string, string> = {}
  if (projectId) params.projectId = projectId
  else params.projectId = 'unassigned'
  if (options?.status && options.status !== 'all') params.status = options.status
  if (options?.limit) params.limit = String(options.limit)

  const res = await getClient().get<{ campaigns: Campaign[] }>('/campaigns', params)
  return res.campaigns
}

// ==================
// Launch Post Operations
// ==================

export async function createLaunchPost(data: {
  platform: LaunchPlatform
  title: string
  url?: string
  description?: string
  platformFields?: Record<string, unknown>
  campaignId?: string
  scheduledAt?: string
  notes?: string
  status?: string
}): Promise<LaunchPost> {
  const res = await getClient().post<{ launchPost: LaunchPost }>('/launch-posts', {
    platform: data.platform,
    title: data.title,
    url: data.url || null,
    description: data.description || null,
    platformFields: data.platformFields || {},
    campaignId: data.campaignId || null,
    scheduledAt: data.scheduledAt || null,
    notes: data.notes || null,
    status: data.status || 'draft',
  })
  return res.launchPost
}

export async function getLaunchPost(id: string): Promise<LaunchPost | undefined> {
  try {
    const res = await getClient().get<{ launchPost: LaunchPost }>(`/launch-posts/${id}`)
    return res.launchPost
  } catch {
    return undefined
  }
}

export async function updateLaunchPost(
  id: string,
  updates: Partial<Omit<LaunchPost, 'id' | 'createdAt'>>
): Promise<LaunchPost | undefined> {
  try {
    const res = await getClient().patch<{ launchPost: LaunchPost }>(
      `/launch-posts/${id}`,
      updates as Record<string, unknown>
    )
    return res.launchPost
  } catch {
    return undefined
  }
}

export async function deleteLaunchPost(id: string): Promise<boolean> {
  try {
    await getClient().delete(`/launch-posts/${id}`)
    return true
  } catch {
    return false
  }
}

export async function listLaunchPosts(options?: {
  platform?: LaunchPlatform
  status?: string
  campaignId?: string
  limit?: number
}): Promise<LaunchPost[]> {
  const params: Record<string, string> = {}
  if (options?.platform) params.platform = options.platform
  if (options?.status && options.status !== 'all') params.status = options.status
  if (options?.campaignId) params.campaignId = options.campaignId
  if (options?.limit) params.limit = String(options.limit)

  const res = await getClient().get<{ launchPosts: LaunchPost[] }>('/launch-posts', params)
  return res.launchPosts
}
