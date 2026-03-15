import { Page, expect } from '@playwright/test'

// Use the same port as the test server (configured in playwright.config.ts)
const PORT = process.env.TEST_PORT || 3000
const API_BASE = `http://localhost:${PORT}/api`

// ============================================
// Platform Content Types
// ============================================

interface TwitterContentAPI {
  text: string
  mediaUrls?: string[]
  launchedUrl?: string
}

interface LinkedInContentAPI {
  text: string
  visibility: 'public' | 'connections'
  mediaUrl?: string
  launchedUrl?: string
}

interface RedditContentAPI {
  subreddit: string
  title: string
  body?: string
  url?: string
  flairId?: string
  flairText?: string
  launchedUrl?: string
}

type PlatformContentAPI = TwitterContentAPI | LinkedInContentAPI | RedditContentAPI

export interface PostFromAPI {
  id: string
  createdAt: string
  updatedAt: string
  scheduledAt: string | null
  status: 'draft' | 'scheduled' | 'published' | 'archived'
  platform: 'twitter' | 'linkedin' | 'reddit'
  notes?: string
  campaignId?: string
  groupId?: string
  groupType?: 'reddit-crosspost'
  content: PlatformContentAPI
  publishResult?: {
    success: boolean
    postId?: string
    postUrl?: string
    publishedAt?: string
    error?: string
  }
}

// ============================================
// Type Guards
// ============================================

export function getTwitterContent(post: PostFromAPI): TwitterContentAPI | undefined {
  if (post.platform === 'twitter') {
    return post.content as TwitterContentAPI
  }
  return undefined
}

export function getLinkedInContent(post: PostFromAPI): LinkedInContentAPI | undefined {
  if (post.platform === 'linkedin') {
    return post.content as LinkedInContentAPI
  }
  return undefined
}

export function getRedditContent(post: PostFromAPI): RedditContentAPI | undefined {
  if (post.platform === 'reddit') {
    return post.content as RedditContentAPI
  }
  return undefined
}

// ============================================
// Post API Helpers
// ============================================

export async function getAllPosts(page: Page): Promise<PostFromAPI[]> {
  const response = await page.request.get(`${API_BASE}/posts`)
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to get posts: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = await response.json()
  return data.posts
}

export async function getPostCount(page: Page): Promise<number> {
  const posts = await getAllPosts(page)
  return posts.length
}

export async function getPostById(page: Page, id: string): Promise<PostFromAPI | null> {
  const response = await page.request.get(`${API_BASE}/posts/${id}`)
  if (!response.ok()) return null
  const data = await response.json()
  return data.post
}

function buildPostBody(
  platform: 'twitter' | 'linkedin' | 'reddit',
  content: string,
  status: 'draft' | 'scheduled',
  scheduledAt?: string
) {
  const body: Record<string, unknown> = { platform, status }

  if (platform === 'twitter') {
    body.content = { text: content }
  } else if (platform === 'linkedin') {
    body.content = { text: content }
  } else if (platform === 'reddit') {
    body.content = { subreddit: 'test', title: content, body: content }
  }

  if (status === 'scheduled') {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    tomorrow.setUTCHours(12, 0, 0, 0)
    body.scheduledAt = scheduledAt || tomorrow.toISOString()
  }

  return body
}

export async function createPostViaAPI(
  page: Page,
  options: {
    platform?: 'twitter' | 'linkedin' | 'reddit'
    content?: string
    status?: 'draft' | 'scheduled'
    scheduledAt?: string
  } = {}
): Promise<PostFromAPI> {
  const {
    platform = 'twitter',
    content = 'Test post content',
    status = 'draft',
    scheduledAt,
  } = options

  const body = buildPostBody(platform, content, status, scheduledAt)

  const response = await page.request.post(`${API_BASE}/posts`, { data: body })
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to create post via API: ${response.status()} - ${JSON.stringify(errorData)}`
    )
  }
  const data = await response.json()
  return data.post
}

export function extractPostIdFromUrl(url: string): string | null {
  const match = url.match(/\/edit\/([a-f0-9-]+)/)
  return match ? match[1] : null
}

// ============================================
// Post List Helpers
// ============================================

export async function getPostCards(page: Page) {
  const locator = page.locator('a[href^="/edit/"]')
  await locator.first().waitFor({ state: 'visible', timeout: 30000 })
  return locator
}

export async function clickPost(page: Page, index: number = 0) {
  const cards = await getPostCards(page)
  await cards.nth(index).click()
  await expect(page.getByRole('heading', { name: /edit post/i })).toBeVisible()
}

export async function filterByStatus(
  page: Page,
  status: 'all' | 'draft' | 'scheduled' | 'published' | 'archived'
) {
  const statusNames: Record<string, string> = {
    all: 'All',
    draft: 'Drafts',
    scheduled: 'Scheduled',
    published: 'Published',
    archived: 'Archived',
  }
  // eslint-disable-next-line security/detect-non-literal-regexp -- test helper, input is controlled
  await page.getByRole('button', { name: new RegExp(statusNames[status], 'i') }).click()
  await page.waitForLoadState('networkidle')
}

// ============================================
// Post Action Helpers
// ============================================

export async function deletePost(page: Page) {
  await page.getByRole('button', { name: /delete/i }).click()
  await page.getByRole('alertdialog').waitFor()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await page.waitForURL(/\/(dashboard)?$/)
}

export async function archivePost(page: Page) {
  await page.getByRole('button', { name: /archive/i }).click()
  await page.getByRole('alertdialog').waitFor()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click()
  await page.waitForURL(/\/(dashboard)?$/)
}

export async function restorePost(page: Page) {
  await page.getByRole('button', { name: /restore/i }).click()
  await page.waitForURL(/\/(dashboard)?$/)
}
