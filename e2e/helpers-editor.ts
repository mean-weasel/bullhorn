import { Page, expect } from '@playwright/test'

// ============================================
// Platform Selection
// ============================================

export async function selectPlatform(page: Page, platform: 'twitter' | 'linkedin' | 'reddit') {
  const platformNames = {
    twitter: 'Twitter',
    linkedin: 'LinkedIn',
    reddit: 'Reddit',
  }
  await page.getByRole('button', { name: platformNames[platform] }).click()
  await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10000 })
}

export async function togglePlatform(page: Page, platform: 'twitter' | 'linkedin' | 'reddit') {
  await selectPlatform(page, platform)
}

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
  const dialog = page.getByRole('alertdialog')
  const dialogVisible = await dialog.isVisible().catch(() => false)
  if (dialogVisible) {
    await dialog.getByRole('button', { name: 'Switch' }).click()
  }
}

// ============================================
// Content Helpers
// ============================================

export async function waitForContentToLoad(page: Page, expectedContent?: string) {
  const textarea = page.locator('textarea').first()
  if (expectedContent) {
    await expect(textarea).toHaveValue(expectedContent, { timeout: 15000 })
  } else {
    await expect(textarea).not.toHaveValue('', { timeout: 15000 })
  }
}

export async function fillContent(page: Page, content: string) {
  const textarea = page.locator('textarea').first()
  await textarea.fill(content)
}

export async function fillNotes(page: Page, notes: string) {
  await page.getByRole('button', { name: /notes/i }).click()
  const notesTextarea = page.getByPlaceholder(/add notes about this post/i)
  await notesTextarea.fill(notes)
}

// ============================================
// Reddit-specific Helpers
// ============================================

export async function fillRedditFields(
  page: Page,
  options: { subreddit?: string; subreddits?: string[]; title?: string; flair?: string }
) {
  const subredditsToAdd = options.subreddits || (options.subreddit ? [options.subreddit] : [])
  for (const sub of subredditsToAdd) {
    const input = page.getByPlaceholder(/type subreddit, press enter/i)
    await input.fill(sub)
    await input.press('Enter')
  }
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

export async function waitForRedditEditForm(page: Page, subreddit: string) {
  const card = page.locator(`[data-testid="subreddit-card-${subreddit}"]`)
  await card.waitFor({ state: 'visible', timeout: 30000 })
  const titleInput = page.locator(`[data-testid="subreddit-title-${subreddit}"]`)
  await titleInput.waitFor({ state: 'visible', timeout: 30000 })
}

async function tryExpandCard(
  page: Page,
  subreddit: string,
  titleInput: ReturnType<Page['locator']>
) {
  await page.evaluate((sub) => {
    const btn = document.querySelector(
      `[data-testid="subreddit-toggle-${sub}"]`
    ) as HTMLButtonElement
    if (btn) btn.click()
  }, subreddit)

  const isExpandedNow = await titleInput.isVisible().catch(() => false)
  if (!isExpandedNow) {
    const card = page.locator(`[data-testid="subreddit-card-${subreddit}"]`)
    const chevron = card.locator('button').last()
    await chevron.click()
  }

  await titleInput.waitFor({ state: 'visible', timeout: 5000 })
}

export async function expandSubredditCard(page: Page, subreddit: string) {
  const card = page.locator(`[data-testid="subreddit-card-${subreddit}"]`)
  const titleInput = card.locator(`[data-testid="subreddit-title-${subreddit}"]`)
  const isExpanded = await titleInput.isVisible().catch(() => false)
  if (!isExpanded) {
    await tryExpandCard(page, subreddit, titleInput)
  }
}

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

export async function fillSubredditTitle(page: Page, subreddit: string, title: string) {
  const titleInput = page.locator(`[data-testid="subreddit-title-${subreddit}"]`)
  await titleInput.fill(title)
}

export async function setSubredditSchedule(page: Page, subreddit: string, date: Date) {
  const dateStr = date.toISOString().split('T')[0]
  const timeStr = date.toISOString().split('T')[1].slice(0, 5)
  const dateInput = page.locator(`[data-testid="subreddit-date-${subreddit}-input"]`)
  const timeInput = page.locator(`[data-testid="subreddit-time-${subreddit}-input"]`)
  await dateInput.fill(dateStr)
  await expect(dateInput).toHaveValue(dateStr)
  await timeInput.fill(timeStr)
  await expect(timeInput).toHaveValue(timeStr)
}

export async function removeSubredditViaCard(page: Page, subreddit: string) {
  const card = page.locator(`[data-testid="subreddit-card-${subreddit}"]`)
  const removeButton = card.locator('button[aria-label="Remove subreddit"]')
  await removeButton.click()
}

// ============================================
// LinkedIn Helpers
// ============================================

export async function setLinkedInVisibility(page: Page, visibility: 'public' | 'connections') {
  const buttonText = visibility === 'public' ? 'Public' : 'Connections Only'
  await page.getByRole('button', { name: buttonText, exact: true }).click()
}

// ============================================
// Schedule Helpers
// ============================================

export async function setSchedule(page: Page, date: Date) {
  const dateStr = date.toISOString().split('T')[0]
  const timeStr = date.toISOString().split('T')[1].slice(0, 5)
  const dateInput = page.locator('[data-testid="main-schedule-date-input"]')
  await dateInput.fill(dateStr)
  await expect(dateInput).toHaveValue(dateStr)
  const timeInput = page.locator('[data-testid="main-schedule-time-input"]')
  await timeInput.fill(timeStr)
  await expect(timeInput).toHaveValue(timeStr)
}
