import { Page, expect, TestInfo } from '@playwright/test'
import { setSchedule } from './helpers-editor'

// Re-export all sub-module helpers so existing imports from './helpers' still work
export * from './helpers-posts'
export * from './helpers-campaigns'
export * from './helpers-projects'
export * from './helpers-profile'
export * from './helpers-media'
export * from './helpers-launch-posts'
export * from './helpers-blog-drafts'
export * from './helpers-editor'

// Use the same port as the test server (configured in playwright.config.ts)
const PORT = process.env.TEST_PORT || 3000
const API_BASE = `http://localhost:${PORT}/api`

// ============================================
// Test Isolation Helpers
// ============================================

export function generateTestId(testInfo: TestInfo): string {
  const workerId = testInfo.parallelIndex
  const random = Math.random().toString(36).substring(2, 8)
  return `w${workerId}-${random}`
}

export function uniqueContent(baseContent: string, testId: string): string {
  return `${baseContent} [${testId}]`
}

// ============================================
// App Initialization
// ============================================

export async function resetDatabase() {
  try {
    const response = await fetch(`${API_BASE}/posts/reset`, { method: 'POST' })
    if (!response.ok) {
      console.warn('Failed to reset database:', response.statusText)
    }
  } catch (error) {
    console.warn('Error resetting database:', error)
  }
}

export async function enterDemoMode(page: Page) {
  await resetDatabase()
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', 'accepted')
    localStorage.setItem('onboarding_complete', 'true')
  })
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Bullhorn/ })).toBeVisible()
}

// ============================================
// Navigation Helpers
// ============================================

export async function goToNewPost(page: Page) {
  await page.goto('/new')
  await expect(page.getByRole('heading', { name: /create post/i })).toBeVisible()
}

export async function goToPosts(page: Page) {
  await page.goto('/posts')
  await expect(page.getByRole('heading', { name: /all posts/i })).toBeVisible()
}

export async function waitForNavigation(page: Page, url: string | RegExp) {
  const normalizedUrl = url === '/' ? '/dashboard' : url
  await expect(page).toHaveURL(normalizedUrl, { timeout: 30000 })
}

// ============================================
// Save / Publish Actions
// ============================================

export async function saveDraft(page: Page) {
  await page.getByRole('button', { name: /save draft/i }).click()
}

export async function schedulePost(page: Page) {
  await page.getByRole('button', { name: /^schedule$/i }).click()
}

export async function publishNow(page: Page) {
  await page.getByRole('button', { name: /publish now/i }).click()
}

// ============================================
// Character Count
// ============================================

export async function verifyCharacterCount(
  page: Page,
  platform: 'twitter' | 'linkedin' | 'reddit'
) {
  const limits = {
    twitter: '280',
    linkedin: '3000',
    reddit: '40000',
  }
  await expect(page.getByText(limits[platform])).toBeVisible()
}

// ============================================
// Create Test Post (UI-based)
// ============================================

async function saveTestPost(page: Page, asDraft: boolean) {
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/posts') && resp.status() < 400,
    { timeout: 60000 }
  )

  if (asDraft) {
    await page.getByRole('button', { name: /save draft/i }).click()
  } else {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    tomorrow.setUTCHours(12, 0, 0, 0)
    await setSchedule(page, tomorrow)
    await page.getByRole('button', { name: /^schedule$/i }).click()
  }

  await responsePromise
}

async function waitForPostSaveNavigation(page: Page) {
  await page.waitForURL((url) => url.pathname !== '/new')
  if (!page.url().match(/\/(dashboard)?$/)) {
    await page.goto('/')
  }
  await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 30000 })
}

export async function createTestPost(
  page: Page,
  options: {
    platform?: 'twitter' | 'linkedin' | 'reddit'
    content?: string
    asDraft?: boolean
  } = {}
) {
  const { platform = 'twitter', content = 'Test post content', asDraft = true } = options

  await page.goto('/new')
  await expect(page.getByRole('heading', { name: /create post/i })).toBeVisible()
  await page.getByRole('button', { name: platform, exact: false }).click()
  const textarea = page.locator('textarea').first()
  await expect(textarea).toBeVisible({ timeout: 10000 })
  await textarea.fill(content)

  await saveTestPost(page, asDraft)
  await waitForPostSaveNavigation(page)
}
