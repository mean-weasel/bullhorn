import { Page, expect } from '@playwright/test'

const PORT = process.env.TEST_PORT || 3000
const API_BASE = `http://localhost:${PORT}/api`

export type LaunchPlatform =
  | 'hacker_news_show'
  | 'hacker_news_ask'
  | 'hacker_news_link'
  | 'product_hunt'
  | 'dev_hunt'
  | 'beta_list'
  | 'indie_hackers'

export type LaunchPostStatus = 'draft' | 'scheduled' | 'posted'

interface LaunchPostFromAPI {
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
  platformFields: Record<string, unknown>
  campaignId: string | null
  notes: string | null
}

const LAUNCH_PLATFORM_LABELS: Record<LaunchPlatform, string> = {
  hacker_news_show: 'Show HN',
  hacker_news_ask: 'Ask HN',
  hacker_news_link: 'HN Link',
  product_hunt: 'Product Hunt',
  dev_hunt: 'Dev Hunt',
  beta_list: 'BetaList',
  indie_hackers: 'Indie Hackers',
}

// ============================================
// Navigation
// ============================================

export async function goToLaunchPosts(page: Page) {
  await page.goto('/launch-posts')
  await expect(page.getByRole('heading', { name: 'Launch Posts', exact: true })).toBeVisible()
}

export async function goToNewLaunchPost(page: Page) {
  await page.goto('/launch-posts/new')
  await expect(page.getByRole('heading', { name: /new launch post/i })).toBeVisible()
}

// ============================================
// Form Helpers
// ============================================

export async function selectLaunchPlatform(page: Page, platform: LaunchPlatform) {
  const label = LAUNCH_PLATFORM_LABELS[platform]
  await page.getByRole('button', { name: label }).click()
}

export async function fillLaunchPostTitle(page: Page, title: string) {
  await page.getByLabel(/^title/i).fill(title)
}

export async function fillLaunchPostUrl(page: Page, url: string) {
  await page.getByLabel(/^url/i).fill(url)
}

export async function fillLaunchPostDescription(page: Page, description: string) {
  await page.getByLabel(/^description/i).fill(description)
}

export async function fillLaunchPostNotes(page: Page, notes: string) {
  await page.getByLabel(/internal notes/i).fill(notes)
}

export async function setLaunchPostStatus(page: Page, status: LaunchPostStatus) {
  await page.getByLabel(/^status$/i).selectOption(status)
}

export async function fillProductHuntFields(
  page: Page,
  options: { tagline?: string; pricing?: 'free' | 'paid' | 'freemium'; firstComment?: string }
) {
  if (options.tagline) {
    await page.getByLabel(/tagline/i).fill(options.tagline)
  }
  if (options.pricing) {
    await page.getByLabel(/pricing model/i).selectOption(options.pricing)
  }
  if (options.firstComment) {
    await page.getByLabel(/first comment/i).fill(options.firstComment)
  }
}

export async function fillAskHNFields(page: Page, options: { text?: string }) {
  if (options.text) {
    await page.getByLabel(/question body/i).fill(options.text)
  }
}

export async function fillBetaListFields(page: Page, options: { oneSentencePitch?: string }) {
  if (options.oneSentencePitch) {
    await page.getByLabel(/one-sentence pitch/i).fill(options.oneSentencePitch)
  }
}

export async function fillDevHuntFields(
  page: Page,
  options: { githubUrl?: string; founderStory?: string }
) {
  if (options.githubUrl) {
    await page.getByLabel(/github url/i).fill(options.githubUrl)
  }
  if (options.founderStory) {
    await page.getByLabel(/founder story/i).fill(options.founderStory)
  }
}

export async function fillIndieHackersFields(
  page: Page,
  options: { shortDescription?: string; revenue?: string }
) {
  if (options.shortDescription) {
    await page.getByLabel(/short description/i).fill(options.shortDescription)
  }
  if (options.revenue) {
    await page.getByLabel(/monthly revenue/i).fill(options.revenue)
  }
}

export async function saveLaunchPost(page: Page) {
  await page.getByRole('button', { name: /create launch post|save changes/i }).click()
  await page.waitForURL('/launch-posts')
}

// ============================================
// API Helpers
// ============================================

export async function getAllLaunchPosts(page: Page): Promise<LaunchPostFromAPI[]> {
  const response = await page.request.get(`${API_BASE}/launch-posts`)
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to get launch posts: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = await response.json()
  return data.launchPosts
}

export async function getLaunchPostById(page: Page, id: string): Promise<LaunchPostFromAPI | null> {
  const response = await page.request.get(`${API_BASE}/launch-posts/${id}`)
  if (!response.ok()) return null
  const data = await response.json()
  return data.launchPost
}

export async function createLaunchPostViaAPI(
  page: Page,
  options: {
    platform: LaunchPlatform
    title: string
    url?: string
    description?: string
    platformFields?: Record<string, unknown>
    campaignId?: string
    status?: LaunchPostStatus
  }
): Promise<LaunchPostFromAPI> {
  const response = await page.request.post(`${API_BASE}/launch-posts`, {
    data: {
      platform: options.platform,
      title: options.title,
      url: options.url,
      description: options.description,
      platformFields: options.platformFields || {},
      campaignId: options.campaignId,
    },
  })
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to create launch post: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = await response.json()
  return data.launchPost
}

// ============================================
// List Interaction Helpers
// ============================================

export async function getLaunchPostCards(page: Page) {
  const locator = page.locator('[data-testid="launch-post-card"]')
  return locator
}

export async function openLaunchPostMenu(page: Page, index: number = 0) {
  const cards = page.locator('[data-testid="launch-post-card"]')
  const card = cards.nth(index)
  await card.locator('button').last().click()
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible({ timeout: 5000 })
}

export async function clickLaunchPost(page: Page, index: number = 0) {
  await openLaunchPostMenu(page, index)
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByRole('heading', { name: /edit launch post/i })).toBeVisible()
}

export async function deleteLaunchPost(page: Page, index: number = 0) {
  await openLaunchPostMenu(page, index)
  await page.getByRole('button', { name: 'Delete' }).click()
  const dialog = page.getByRole('alertdialog')
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(dialog).not.toBeVisible({ timeout: 10000 })
}

export async function copyLaunchPostFields(page: Page, index: number = 0) {
  await openLaunchPostMenu(page, index)
  await page.getByRole('button', { name: /copy fields/i }).click()
}
