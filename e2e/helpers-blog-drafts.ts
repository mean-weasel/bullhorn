import { Page, expect } from '@playwright/test'

const PORT = process.env.TEST_PORT || 3000
const API_BASE = `http://localhost:${PORT}/api`

export type BlogDraftStatus = 'draft' | 'scheduled' | 'published' | 'archived'

interface BlogDraftFromAPI {
  id: string
  createdAt: string
  updatedAt: string
  scheduledAt: string | null
  status: BlogDraftStatus
  title: string
  date: string | null
  content: string
  notes: string | null
  wordCount: number
  campaignId: string | null
  images: unknown[]
  tags: string[]
}

// ============================================
// Navigation
// ============================================

export async function goToBlogDrafts(page: Page) {
  await page.goto('/blog')
  await expect(page.getByRole('heading', { name: 'Blog Drafts' }).first()).toBeVisible()
}

export async function goToNewBlogDraft(page: Page) {
  await page.goto('/blog/new')
  await expect(page.getByPlaceholder('Post title...')).toBeVisible()
}

// ============================================
// Form Helpers
// ============================================

export async function fillBlogDraftTitle(page: Page, title: string) {
  await page.getByPlaceholder('Post title...').fill(title)
}

export async function fillBlogDraftContent(page: Page, content: string) {
  const textarea = page.locator('textarea').first()
  await textarea.fill(content)
}

export async function fillBlogDraftNotes(page: Page, notes: string) {
  await page.getByPlaceholder(/add private notes about this draft/i).fill(notes)
}

export async function saveBlogDraft(page: Page) {
  await page.getByRole('button', { name: /^save$/i }).click()
}

export async function searchBlogDrafts(page: Page, query: string) {
  await page.getByPlaceholder('Search by title, content, or notes...').fill(query)
}

export async function filterBlogDraftsByStatus(page: Page, status: 'all' | BlogDraftStatus) {
  const statusLabels: Record<string, string> = {
    all: 'All',
    draft: 'Drafts',
    scheduled: 'Scheduled',
    published: 'Published',
    archived: 'Archived',
  }
  await page.getByRole('button', { name: new RegExp(`^${statusLabels[status]}`, 'i') }).click()
}

// ============================================
// Actions
// ============================================

export async function archiveBlogDraft(page: Page) {
  await page.getByRole('button', { name: /^archive$/i }).click()
}

export async function restoreBlogDraft(page: Page) {
  await page.getByRole('button', { name: /^restore$/i }).click()
}

export async function deleteBlogDraft(page: Page) {
  await page.getByRole('button', { name: /^delete$/i }).click()
  const dialog = page.getByRole('alertdialog')
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByRole('button', { name: /^delete$/i }).click()
  await page.waitForURL('/blog')
}

// ============================================
// API Helpers
// ============================================

export async function getAllBlogDrafts(page: Page): Promise<BlogDraftFromAPI[]> {
  const response = await page.request.get(`${API_BASE}/blog-drafts`)
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to get blog drafts: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = await response.json()
  return data.drafts
}

export async function getBlogDraftById(page: Page, id: string): Promise<BlogDraftFromAPI | null> {
  const response = await page.request.get(`${API_BASE}/blog-drafts/${id}`)
  if (!response.ok()) return null
  const data = await response.json()
  return data.draft
}

export async function createBlogDraftViaAPI(
  page: Page,
  options: {
    title?: string
    content?: string
    status?: BlogDraftStatus
    notes?: string
    tags?: string[]
  }
): Promise<BlogDraftFromAPI> {
  const response = await page.request.post(`${API_BASE}/blog-drafts`, {
    data: {
      title: options.title || 'Untitled Draft',
      content: options.content || '',
      status: options.status || 'draft',
      notes: options.notes,
      tags: options.tags || [],
    },
  })
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to create blog draft: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = await response.json()
  return data.draft
}

// ============================================
// List Helpers
// ============================================

export async function getBlogDraftCards(page: Page) {
  return page.locator('a[href^="/blog/"]:not([href="/blog/new"]):not([href="/blog"])')
}

export async function clickBlogDraft(page: Page, index: number = 0) {
  const cards = await getBlogDraftCards(page)
  await cards.nth(index).click()
}
