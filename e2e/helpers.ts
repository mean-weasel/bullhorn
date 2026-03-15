import { Page, expect, TestInfo } from '@playwright/test'

// Use the same port as the test server (configured in playwright.config.ts)
const PORT = process.env.TEST_PORT || 3000
const API_BASE = `http://localhost:${PORT}/api`

/**
 * Generate a unique test ID for content isolation in parallel tests.
 * Uses a combination of worker index and random string to ensure uniqueness.
 */
export function generateTestId(testInfo: TestInfo): string {
  const workerId = testInfo.parallelIndex
  const random = Math.random().toString(36).substring(2, 8)
  return `w${workerId}-${random}`
}

/**
 * Create unique content string for a test
 */
export function uniqueContent(baseContent: string, testId: string): string {
  return `${baseContent} [${testId}]`
}

/**
 * Reset the test database before each test
 */
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

/**
 * Initialize the app - just navigate to the dashboard
 * (No login required since we use localStorage)
 */
export async function enterDemoMode(page: Page) {
  // Reset the database before each test to ensure clean state
  await resetDatabase()

  // Dismiss overlays that intercept pointer events in E2E tests
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', 'accepted')
    localStorage.setItem('onboarding_complete', 'true')
  })

  await page.goto('/')
  // Wait for the dashboard to load - look for the header
  // The link contains emoji + text, so use regex to match "Bullhorn"
  await expect(page.getByRole('link', { name: /Bullhorn/ })).toBeVisible()
}

/**
 * Navigate to create new post
 */
export async function goToNewPost(page: Page) {
  await page.goto('/new')
  await expect(page.getByRole('heading', { name: /create post/i })).toBeVisible()
}

/**
 * Navigate to posts list
 */
export async function goToPosts(page: Page) {
  await page.goto('/posts')
  await expect(page.getByRole('heading', { name: /all posts/i })).toBeVisible()
}

/**
 * Select a platform in the editor
 */
export async function selectPlatform(page: Page, platform: 'twitter' | 'linkedin' | 'reddit') {
  const platformNames = {
    twitter: 'Twitter',
    linkedin: 'LinkedIn',
    reddit: 'Reddit',
  }
  await page.getByRole('button', { name: platformNames[platform] }).click()
  await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10000 })
}

/**
 * Toggle platform selection
 */
export async function togglePlatform(page: Page, platform: 'twitter' | 'linkedin' | 'reddit') {
  await selectPlatform(page, platform)
}

/**
 * Switch platform and confirm if dialog appears (when content exists)
 */
export async function switchPlatformWithConfirm(
  page: Page,
  platform: 'twitter' | 'linkedin' | 'reddit'
) {
  const platformNames = {
    twitter: 'Twitter',
    linkedin: 'LinkedIn',
    reddit: 'Reddit',
  }
  await page.getByRole('button', { name: platformNames[platform] }).click()

  // Check if confirmation dialog appears and confirm it
  const dialog = page.getByRole('alertdialog')
  const dialogVisible = await dialog.isVisible().catch(() => false)
  if (dialogVisible) {
    await dialog.getByRole('button', { name: 'Switch' }).click()
  }
}

/**
 * Wait for existing post content to load in the editor
 * This is needed when editing an existing post because the store loads async
 */
export async function waitForContentToLoad(page: Page, expectedContent?: string) {
  const textarea = page.locator('textarea').first()
  if (expectedContent) {
    // Wait for specific content to appear
    await expect(textarea).toHaveValue(expectedContent, { timeout: 15000 })
  } else {
    // Just wait for any non-empty content (existing post loaded)
    await expect(textarea).not.toHaveValue('', { timeout: 15000 })
  }
}

/**
 * Fill in the main content textarea
 */
export async function fillContent(page: Page, content: string) {
  const textarea = page.locator('textarea').first()
  await textarea.fill(content)
}

/**
 * Add notes to a post
 */
export async function fillNotes(page: Page, notes: string) {
  // Click the Notes section to expand it
  await page.getByRole('button', { name: /notes/i }).click()
  // Fill in the notes textarea (it's the one with "Add notes about this post" placeholder)
  const notesTextarea = page.getByPlaceholder(/add notes about this post/i)
  await notesTextarea.fill(notes)
}

/**
 * Fill in Reddit-specific fields (subreddits and optional flair)
 * Note: Titles are now per-subreddit via collapsible cards
 */
export async function fillRedditFields(
  page: Page,
  options: { subreddit?: string; subreddits?: string[]; title?: string; flair?: string }
) {
  // Handle single subreddit (legacy) or multiple subreddits
  const subredditsToAdd = options.subreddits || (options.subreddit ? [options.subreddit] : [])
  for (const sub of subredditsToAdd) {
    const input = page.getByPlaceholder(/type subreddit, press enter/i)
    await input.fill(sub)
    await input.press('Enter')
  }
  // If title is provided, set it for all subreddits via their cards
  if (options.title && subredditsToAdd.length > 0) {
    for (const sub of subredditsToAdd) {
      await expandSubredditCard(page, sub)
      await fillSubredditTitle(page, sub, options.title)
    }
  }
  if (options.flair) {
    await page.getByPlaceholder(/show and tell/i).fill(options.flair)
  }
}

/**
 * Wait for the Reddit edit form to be ready (subreddit card visible and expanded)
 * This is needed when editing an existing Reddit post to ensure data is loaded
 */
export async function waitForRedditEditForm(page: Page, subreddit: string) {
  // Wait for the subreddit card to be visible
  const card = page.locator(`[data-testid="subreddit-card-${subreddit}"]`)
  await card.waitFor({ state: 'visible', timeout: 30000 })
  // Wait for the title input to be visible (card is auto-expanded when editing)
  const titleInput = page.locator(`[data-testid="subreddit-title-${subreddit}"]`)
  await titleInput.waitFor({ state: 'visible', timeout: 30000 })
}

/**
 * Expand a subreddit card to reveal title and schedule fields
 */
export async function expandSubredditCard(page: Page, subreddit: string) {
  const card = page.locator(`[data-testid="subreddit-card-${subreddit}"]`)
  // Check if card is already expanded by looking for the title input
  const titleInput = card.locator(`[data-testid="subreddit-title-${subreddit}"]`)
  const isExpanded = await titleInput.isVisible().catch(() => false)
  if (!isExpanded) {
    // Click using JavaScript for more reliable interaction
    await page.evaluate((sub) => {
      const btn = document.querySelector(
        `[data-testid="subreddit-toggle-${sub}"]`
      ) as HTMLButtonElement
      if (btn) btn.click()
    }, subreddit)

    // Check if expanded, try fallback click on chevron if not
    const isExpandedNow = await titleInput.isVisible().catch(() => false)
    if (!isExpandedNow) {
      const chevron = card.locator('button').last()
      await chevron.click()
    }

    await titleInput.waitFor({ state: 'visible', timeout: 5000 })
  }
}

/**
 * Collapse a subreddit card
 */
export async function collapseSubredditCard(page: Page, subreddit: string) {
  const card = page.locator(`[data-testid="subreddit-card-${subreddit}"]`)
  const toggleButton = page.locator(`[data-testid="subreddit-toggle-${subreddit}"]`)
  const titleInput = card.locator(`[data-testid="subreddit-title-${subreddit}"]`)
  const isExpanded = await titleInput.isVisible().catch(() => false)
  if (isExpanded) {
    await toggleButton.click()
    await titleInput.waitFor({ state: 'hidden' })
  }
}

/**
 * Fill in the title for a specific subreddit (card must be expanded)
 */
export async function fillSubredditTitle(page: Page, subreddit: string, title: string) {
  const titleInput = page.locator(`[data-testid="subreddit-title-${subreddit}"]`)
  await titleInput.fill(title)
}

/**
 * Set schedule for a specific subreddit (card must be expanded)
 * Uses the hidden inputs within IOSDateTimePicker components
 */
export async function setSubredditSchedule(page: Page, subreddit: string, date: Date) {
  const dateStr = date.toISOString().split('T')[0]
  const timeStr = date.toISOString().split('T')[1].slice(0, 5)

  // Fill the hidden inputs directly (they have -input suffix)
  const dateInput = page.locator(`[data-testid="subreddit-date-${subreddit}-input"]`)
  const timeInput = page.locator(`[data-testid="subreddit-time-${subreddit}-input"]`)

  // Fill date first, wait for React to process the new date value,
  // then fill time. The time input's onChange reads the current date
  // from the component's value prop, so React must re-render first.
  await dateInput.fill(dateStr)
  await expect(dateInput).toHaveValue(dateStr)
  await timeInput.fill(timeStr)
  await expect(timeInput).toHaveValue(timeStr)
}

/**
 * Remove a subreddit via its card's X button
 */
export async function removeSubredditViaCard(page: Page, subreddit: string) {
  const card = page.locator(`[data-testid="subreddit-card-${subreddit}"]`)
  const removeButton = card.locator('button[aria-label="Remove subreddit"]')
  await removeButton.click()
}

/**
 * Set LinkedIn visibility
 */
export async function setLinkedInVisibility(page: Page, visibility: 'public' | 'connections') {
  const buttonText = visibility === 'public' ? 'Public' : 'Connections Only'
  await page.getByRole('button', { name: buttonText, exact: true }).click()
}

/**
 * Set schedule date and time (main schedule, not per-subreddit)
 * Uses the hidden inputs within IOSDateTimePicker components
 */
export async function setSchedule(page: Page, date: Date) {
  const dateStr = date.toISOString().split('T')[0]
  const timeStr = date.toISOString().split('T')[1].slice(0, 5)

  // Fill the hidden inputs directly (they have -input suffix)
  // Fill date first, wait for React to process the new date value,
  // then fill time. The time input's onChange reads the current date
  // from the component's value prop, so React must re-render first.
  const dateInput = page.locator('[data-testid="main-schedule-date-input"]')
  await dateInput.fill(dateStr)
  await expect(dateInput).toHaveValue(dateStr)

  const timeInput = page.locator('[data-testid="main-schedule-time-input"]')
  await timeInput.fill(timeStr)
  await expect(timeInput).toHaveValue(timeStr)
}

/**
 * Click save as draft button
 */
export async function saveDraft(page: Page) {
  await page.getByRole('button', { name: /save draft/i }).click()
}

/**
 * Click schedule button
 */
export async function schedulePost(page: Page) {
  await page.getByRole('button', { name: /^schedule$/i }).click()
}

/**
 * Click publish now button
 */
export async function publishNow(page: Page) {
  await page.getByRole('button', { name: /publish now/i }).click()
}

/**
 * Click delete button and confirm in modal dialog
 */
export async function deletePost(page: Page) {
  // Click the delete button
  await page.getByRole('button', { name: /delete/i }).click()

  // Wait for the confirmation dialog modal to appear and click Delete
  await page.getByRole('alertdialog').waitFor()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()

  // Wait for navigation to dashboard after delete
  await page.waitForURL(/\/(dashboard)?$/)
}

/**
 * Click archive button and confirm in modal dialog
 */
export async function archivePost(page: Page) {
  // Click the archive button
  await page.getByRole('button', { name: /archive/i }).click()

  // Wait for the confirmation dialog modal to appear and click Archive
  await page.getByRole('alertdialog').waitFor()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Archive' }).click()

  // Wait for navigation to dashboard after archive
  await page.waitForURL(/\/(dashboard)?$/)
}

/**
 * Click restore button to restore an archived post
 */
export async function restorePost(page: Page) {
  await page.getByRole('button', { name: /restore/i }).click()

  // Wait for navigation to dashboard after restore
  await page.waitForURL(/\/(dashboard)?$/)
}

/**
 * Filter posts list by status
 */
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

/**
 * Get post cards from the posts list
 * Waits for at least one card to be visible before returning
 */
export async function getPostCards(page: Page) {
  const locator = page.locator('a[href^="/edit/"]')
  // Wait for at least one post card to be visible
  await locator.first().waitFor({ state: 'visible', timeout: 30000 })
  return locator
}

/**
 * Click on a post to edit it
 */
export async function clickPost(page: Page, index: number = 0) {
  const cards = await getPostCards(page)
  await cards.nth(index).click()
  await expect(page.getByRole('heading', { name: /edit post/i })).toBeVisible()
}

/**
 * Verify character count is displayed
 */
export async function verifyCharacterCount(
  page: Page,
  platform: 'twitter' | 'linkedin' | 'reddit'
) {
  const limits = {
    twitter: '280',
    linkedin: '3000',
    reddit: '40000',
  }
  // Check that the character limit is visible somewhere on the page
  await expect(page.getByText(limits[platform])).toBeVisible()
}

/**
 * Wait for navigation after action
 */
export async function waitForNavigation(page: Page, url: string | RegExp) {
  // Normalize '/' to '/dashboard' since the root redirects to dashboard
  const normalizedUrl = url === '/' ? '/dashboard' : url
  await expect(page).toHaveURL(normalizedUrl, { timeout: 30000 })
}

/**
 * Create a test post with given options
 */
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

  // Select platform and wait for form to be ready
  await page.getByRole('button', { name: platform, exact: false }).click()
  const textarea = page.locator('textarea').first()
  await expect(textarea).toBeVisible({ timeout: 10000 })

  // Fill content
  await textarea.fill(content)

  // Save — wait for the API response before expecting navigation
  const responsePromise = page.waitForResponse(
    (resp) => resp.url().includes('/api/posts') && resp.status() < 400,
    { timeout: 60000 }
  )

  if (asDraft) {
    await page.getByRole('button', { name: /save draft/i }).click()
  } else {
    // Set a schedule date in the future
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    tomorrow.setUTCHours(12, 0, 0, 0)
    await setSchedule(page, tomorrow)
    await page.getByRole('button', { name: /^schedule$/i }).click()
  }

  await responsePromise
  // Wait to leave /new page — use global navigationTimeout (60s in CI) instead of hardcoded 30s
  await page.waitForURL((url) => url.pathname !== '/new')
  // If auto-save redirected to /edit/:id before Save Draft navigated, go to dashboard manually
  if (!page.url().match(/\/(dashboard)?$/)) {
    await page.goto('/')
  }
  await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 30000 })
}

// ============================================
// Database State Verification Helpers
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

// Type guards for content types
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

interface PostFromAPI {
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

/**
 * Get all posts from the database via API
 */
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

/**
 * Get the count of posts in the database
 */
export async function getPostCount(page: Page): Promise<number> {
  const posts = await getAllPosts(page)
  return posts.length
}

/**
 * Get a specific post by ID from the database
 */
export async function getPostById(page: Page, id: string): Promise<PostFromAPI | null> {
  const response = await page.request.get(`${API_BASE}/posts/${id}`)
  if (!response.ok()) return null
  const data = await response.json()
  return data.post
}

/**
 * Create a post directly via API (no UI navigation — fast and reliable for test data setup)
 */
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

/**
 * Extract post ID from URL like /edit/abc-123
 */
export function extractPostIdFromUrl(url: string): string | null {
  const match = url.match(/\/edit\/([a-f0-9-]+)/)
  return match ? match[1] : null
}

// ============================================
// Campaign Helpers
// ============================================

interface CampaignFromAPI {
  id: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'completed' | 'archived'
  projectId?: string
  createdAt: string
  updatedAt: string
}

/**
 * Navigate to campaigns list
 */
export async function goToCampaigns(page: Page) {
  await page.goto('/campaigns')
  await expect(page.getByRole('heading', { name: /campaigns/i })).toBeVisible()
}

/**
 * Navigate to create new campaign
 */
export async function goToNewCampaign(page: Page) {
  await page.goto('/campaigns/new')
  await expect(page.getByRole('heading', { name: /create campaign/i })).toBeVisible()
}

/**
 * Fill in campaign name
 */
export async function fillCampaignName(page: Page, name: string) {
  await page.getByPlaceholder(/campaign name/i).fill(name)
}

/**
 * Fill in campaign description
 */
export async function fillCampaignDescription(page: Page, description: string) {
  await page.getByPlaceholder(/describe your campaign/i).fill(description)
}

/**
 * Create a campaign and save
 */
export async function createCampaign(page: Page, options: { name: string; description?: string }) {
  await goToNewCampaign(page)
  await fillCampaignName(page, options.name)
  if (options.description) {
    await fillCampaignDescription(page, options.description)
  }
  await page.getByRole('button', { name: /create campaign/i }).click()
}

/**
 * Get all campaigns from the database via API
 */
export async function getAllCampaigns(page: Page): Promise<CampaignFromAPI[]> {
  const response = await page.request.get(`${API_BASE}/campaigns`)
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to get campaigns: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = await response.json()
  return data.campaigns
}

/**
 * Get campaign by ID from the database
 */
export async function getCampaignById(page: Page, id: string): Promise<CampaignFromAPI | null> {
  const response = await page.request.get(`${API_BASE}/campaigns/${id}`)
  if (!response.ok()) return null
  const data = await response.json()
  return data.campaign
}

/**
 * Get posts for a specific campaign
 */
export async function getCampaignPosts(page: Page, campaignId: string): Promise<PostFromAPI[]> {
  const response = await page.request.get(`${API_BASE}/campaigns/${campaignId}/posts`)
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to get campaign posts: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = await response.json()
  return data.posts
}

/**
 * Click on a campaign card to view it
 */
export async function clickCampaign(page: Page, index: number = 0) {
  const cards = page
    .locator('a[href^="/campaigns/"]')
    .filter({ hasNot: page.locator('a[href="/campaigns/new"]') })
  await cards.nth(index).click()
}

/**
 * Select a campaign in the editor dropdown
 */
export async function selectCampaignInEditor(page: Page, campaignName: string) {
  // Click the campaign selector button
  await page.getByRole('button', { name: /select campaign|no campaign/i }).click()
  // Select the campaign from dropdown
  await page.getByRole('option', { name: campaignName }).click()
}

/**
 * Delete a campaign and confirm
 */
export async function deleteCampaign(page: Page) {
  await page.getByRole('button', { name: /delete/i }).click()
  await page.getByRole('alertdialog').waitFor()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
}

// ============================================
// Profile Page Helpers
// ============================================

/**
 * Navigate to profile page
 */
export async function goToProfile(page: Page) {
  await page.goto('/profile')
  // Main heading contains emoji + "Profile" - use first() to avoid matching section headings
  await expect(page.getByRole('heading', { name: /Profile/ }).first()).toBeVisible()
}

/**
 * Fill display name on profile page
 */
export async function fillDisplayName(page: Page, name: string) {
  await page.getByLabel('Display Name').fill(name)
}

/**
 * Fill password change fields
 */
export async function fillPasswordChange(page: Page, newPassword: string, confirmPassword: string) {
  await page.getByLabel('New Password', { exact: true }).fill(newPassword)
  await page.getByLabel('Confirm New Password', { exact: true }).fill(confirmPassword)
}

/**
 * Save profile changes
 */
export async function saveProfile(page: Page) {
  await page.getByRole('button', { name: 'Save Changes' }).click()
}

/**
 * Update password
 */
export async function updatePassword(page: Page) {
  await page.getByRole('button', { name: 'Update Password' }).click()
}

/**
 * Open delete account dialog
 */
export async function openDeleteAccountDialog(page: Page) {
  await page.getByRole('button', { name: /delete account/i }).click()
  await page.getByRole('alertdialog').waitFor()
}

/**
 * Confirm delete account (in dialog)
 */
export async function confirmDeleteAccount(page: Page) {
  const dialog = page.getByRole('alertdialog')
  await dialog.getByRole('button', { name: /delete account/i }).click()
}

/**
 * Cancel delete account dialog
 */
export async function cancelDeleteAccount(page: Page) {
  const dialog = page.getByRole('alertdialog')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
}

// ============================================
// Media Upload Helpers
// ============================================

/**
 * Upload a media file and wait for preview to appear
 */
export async function uploadMediaFile(page: Page, filePath: string) {
  const fileInput = page.locator('input[type="file"]').first()
  await fileInput.setInputFiles(filePath)
  // Wait for preview to appear
  await page.locator('img[alt^="Media"]').last().waitFor({ timeout: 10000 })
}

/**
 * Get the count of uploaded media items
 */
export async function getMediaCount(page: Page): Promise<number> {
  const mediaItems = page.locator('.relative.group img[alt^="Media"]')
  return await mediaItems.count()
}

/**
 * Open media upload section
 */
export async function openMediaSection(page: Page) {
  await page.locator('button[title="Add media (images/videos)"]').click()
  await expect(page.getByText('Media Attachments')).toBeVisible()
}

// ============================================
// Project Helpers
// ============================================

interface ProjectFromAPI {
  id: string
  name: string
  description?: string
  hashtags: string[]
  brandColors: Record<string, string>
  logoUrl?: string
  createdAt: string
  updatedAt: string
}

interface ProjectListResponse {
  projects: ProjectFromAPI[]
}

/**
 * Navigate to projects list
 */
export async function goToProjects(page: Page) {
  await page.goto('/projects')
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
}

/**
 * Get all projects from the database via API
 */
export async function getAllProjects(page: Page): Promise<ProjectFromAPI[]> {
  const response = await page.request.get(`${API_BASE}/projects`)
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to get projects: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = (await response.json()) as ProjectListResponse
  return data.projects
}

/**
 * Get project by ID from the database via API
 */
export async function getProjectById(page: Page, id: string): Promise<ProjectFromAPI | null> {
  const response = await page.request.get(`${API_BASE}/projects/${id}`)
  if (!response.ok()) return null
  const data = await response.json()
  return data.project
}

/**
 * Get campaigns for a specific project
 */
export async function getProjectCampaigns(
  page: Page,
  projectId: string
): Promise<CampaignFromAPI[]> {
  const response = await page.request.get(`${API_BASE}/projects/${projectId}/campaigns`)
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to get project campaigns: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = await response.json()
  return data.campaigns
}

/**
 * Create a project via API (for test setup)
 */
export async function createProjectViaAPI(
  page: Page,
  options: { name: string; description?: string }
): Promise<ProjectFromAPI> {
  const response = await page.request.post(`${API_BASE}/projects`, {
    data: {
      name: options.name,
      description: options.description,
    },
  })
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to create project: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = await response.json()
  return data.project
}

/**
 * Create a project via UI
 */
export async function createProject(page: Page, options: { name: string; description?: string }) {
  await goToProjects(page)
  await page.getByRole('button', { name: /new project|new$/i }).click()

  // Fill in the modal form
  await page.getByPlaceholder(/enter project name/i).fill(options.name)
  if (options.description) {
    await page.getByPlaceholder(/describe this project/i).fill(options.description)
  }

  // Submit and wait for navigation to project detail
  await page.getByRole('button', { name: /create project/i }).click()
  await page.waitForURL(/\/projects\//)
}

// ============================================
// Launch Post Helpers
// ============================================

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

/**
 * Navigate to launch posts list
 */
export async function goToLaunchPosts(page: Page) {
  await page.goto('/launch-posts')
  await expect(page.getByRole('heading', { name: 'Launch Posts', exact: true })).toBeVisible()
}

/**
 * Navigate to create new launch post
 */
export async function goToNewLaunchPost(page: Page) {
  await page.goto('/launch-posts/new')
  await expect(page.getByRole('heading', { name: /new launch post/i })).toBeVisible()
}

/**
 * Platform button labels for selection
 */
const LAUNCH_PLATFORM_LABELS: Record<LaunchPlatform, string> = {
  hacker_news_show: 'Show HN',
  hacker_news_ask: 'Ask HN',
  hacker_news_link: 'HN Link',
  product_hunt: 'Product Hunt',
  dev_hunt: 'Dev Hunt',
  beta_list: 'BetaList',
  indie_hackers: 'Indie Hackers',
}

/**
 * Select a launch platform
 */
export async function selectLaunchPlatform(page: Page, platform: LaunchPlatform) {
  const label = LAUNCH_PLATFORM_LABELS[platform]
  await page.getByRole('button', { name: label }).click()
}

/**
 * Fill in launch post title
 */
export async function fillLaunchPostTitle(page: Page, title: string) {
  await page.getByLabel(/^title/i).fill(title)
}

/**
 * Fill in launch post URL
 */
export async function fillLaunchPostUrl(page: Page, url: string) {
  await page.getByLabel(/^url/i).fill(url)
}

/**
 * Fill in launch post description
 */
export async function fillLaunchPostDescription(page: Page, description: string) {
  await page.getByLabel(/^description/i).fill(description)
}

/**
 * Fill in launch post notes
 */
export async function fillLaunchPostNotes(page: Page, notes: string) {
  await page.getByLabel(/internal notes/i).fill(notes)
}

/**
 * Set launch post status
 */
export async function setLaunchPostStatus(page: Page, status: LaunchPostStatus) {
  await page.getByLabel(/^status$/i).selectOption(status)
}

/**
 * Fill Product Hunt specific fields
 */
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

/**
 * Fill Ask HN specific fields
 */
export async function fillAskHNFields(page: Page, options: { text?: string }) {
  if (options.text) {
    await page.getByLabel(/question body/i).fill(options.text)
  }
}

/**
 * Fill BetaList specific fields
 */
export async function fillBetaListFields(page: Page, options: { oneSentencePitch?: string }) {
  if (options.oneSentencePitch) {
    await page.getByLabel(/one-sentence pitch/i).fill(options.oneSentencePitch)
  }
}

/**
 * Fill Dev Hunt specific fields
 */
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

/**
 * Fill Indie Hackers specific fields
 */
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

/**
 * Save launch post (create or update)
 */
export async function saveLaunchPost(page: Page) {
  await page.getByRole('button', { name: /create launch post|save changes/i }).click()
  // Wait for navigation back to launch posts list
  await page.waitForURL('/launch-posts')
}

/**
 * Get all launch posts via API
 */
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

/**
 * Get launch post by ID via API
 */
export async function getLaunchPostById(page: Page, id: string): Promise<LaunchPostFromAPI | null> {
  const response = await page.request.get(`${API_BASE}/launch-posts/${id}`)
  if (!response.ok()) return null
  const data = await response.json()
  return data.launchPost
}

/**
 * Create a launch post via API (for test setup)
 */
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

/**
 * Get launch post cards from the list page
 */
export async function getLaunchPostCards(page: Page) {
  const locator = page.locator('[data-testid="launch-post-card"]')
  return locator
}

/**
 * Open the dropdown menu on a launch post card
 */
export async function openLaunchPostMenu(page: Page, index: number = 0) {
  const cards = page.locator('[data-testid="launch-post-card"]')
  const card = cards.nth(index)
  // Click the 3-dot menu button
  await card.locator('button').last().click()
  // Wait for dropdown menu to appear
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible({ timeout: 5000 })
}

/**
 * Click on a launch post to edit it
 */
export async function clickLaunchPost(page: Page, index: number = 0) {
  await openLaunchPostMenu(page, index)
  // Click Edit in the dropdown
  await page.getByRole('button', { name: 'Edit' }).click()
  await expect(page.getByRole('heading', { name: /edit launch post/i })).toBeVisible()
}

/**
 * Delete a launch post from the list
 */
export async function deleteLaunchPost(page: Page, index: number = 0) {
  await openLaunchPostMenu(page, index)
  // Click Delete in the dropdown menu to open confirm dialog
  await page.getByRole('button', { name: 'Delete' }).click()

  // Confirm in the ConfirmDialog
  const dialog = page.getByRole('alertdialog')
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByRole('button', { name: 'Delete' }).click()

  // Wait for the dialog to close after deletion
  await expect(dialog).not.toBeVisible({ timeout: 10000 })
}

/**
 * Copy launch post fields from the list
 */
export async function copyLaunchPostFields(page: Page, index: number = 0) {
  await openLaunchPostMenu(page, index)
  // Click Copy Fields in the dropdown
  await page.getByRole('button', { name: /copy fields/i }).click()
}

// ============================================
// Blog Drafts Helpers
// ============================================

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

/**
 * Navigate to blog drafts list
 */
export async function goToBlogDrafts(page: Page) {
  await page.goto('/blog')
  await expect(page.getByRole('heading', { name: 'Blog Drafts' }).first()).toBeVisible()
}

/**
 * Navigate to create new blog draft
 */
export async function goToNewBlogDraft(page: Page) {
  await page.goto('/blog/new')
  await expect(page.getByPlaceholder('Post title...')).toBeVisible()
}

/**
 * Fill in blog draft title
 */
export async function fillBlogDraftTitle(page: Page, title: string) {
  await page.getByPlaceholder('Post title...').fill(title)
}

/**
 * Fill in blog draft content (markdown)
 */
export async function fillBlogDraftContent(page: Page, content: string) {
  const textarea = page.locator('textarea').first()
  await textarea.fill(content)
}

/**
 * Fill in blog draft notes
 */
export async function fillBlogDraftNotes(page: Page, notes: string) {
  await page.getByPlaceholder(/add private notes about this draft/i).fill(notes)
}

/**
 * Save blog draft
 */
export async function saveBlogDraft(page: Page) {
  await page.getByRole('button', { name: /^save$/i }).click()
}

/**
 * Search blog drafts
 */
export async function searchBlogDrafts(page: Page, query: string) {
  await page.getByPlaceholder('Search by title, content, or notes...').fill(query)
}

/**
 * Filter blog drafts by status
 */
export async function filterBlogDraftsByStatus(page: Page, status: 'all' | BlogDraftStatus) {
  const statusLabels: Record<string, string> = {
    all: 'All',
    draft: 'Drafts',
    scheduled: 'Scheduled',
    published: 'Published',
    archived: 'Archived',
  }
  // Filter tabs include a count badge, so match start of text only (not exact)
  // eslint-disable-next-line security/detect-non-literal-regexp -- test helper, input is controlled
  await page.getByRole('button', { name: new RegExp(`^${statusLabels[status]}`, 'i') }).click()
}

/**
 * Archive blog draft (from edit page)
 */
export async function archiveBlogDraft(page: Page) {
  await page.getByRole('button', { name: /^archive$/i }).click()
}

/**
 * Restore blog draft (from edit page)
 */
export async function restoreBlogDraft(page: Page) {
  await page.getByRole('button', { name: /^restore$/i }).click()
}

/**
 * Delete blog draft (from edit page)
 */
export async function deleteBlogDraft(page: Page) {
  // Click the delete button to open the confirm dialog
  await page.getByRole('button', { name: /^delete$/i }).click()

  // Confirm in the ConfirmDialog
  const dialog = page.getByRole('alertdialog')
  await dialog.waitFor({ state: 'visible' })
  await dialog.getByRole('button', { name: /^delete$/i }).click()

  // Wait for navigation back to list
  await page.waitForURL('/blog')
}

/**
 * Get all blog drafts via API
 */
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

/**
 * Get blog draft by ID via API
 */
export async function getBlogDraftById(page: Page, id: string): Promise<BlogDraftFromAPI | null> {
  const response = await page.request.get(`${API_BASE}/blog-drafts/${id}`)
  if (!response.ok()) return null
  const data = await response.json()
  return data.draft
}

/**
 * Create a blog draft via API (for test setup)
 */
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

/**
 * Get blog draft cards from the list page
 */
export async function getBlogDraftCards(page: Page) {
  return page.locator('a[href^="/blog/"]:not([href="/blog/new"]):not([href="/blog"])')
}

/**
 * Click on a blog draft to edit it
 */
export async function clickBlogDraft(page: Page, index: number = 0) {
  const cards = await getBlogDraftCards(page)
  await cards.nth(index).click()
}
