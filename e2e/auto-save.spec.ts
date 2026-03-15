import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  fillContent,
  getPostCount,
  getAllPosts,
  extractPostIdFromUrl,
  switchPlatformWithConfirm,
  waitForContentToLoad,
} from './helpers'

// eslint-disable-next-line max-lines-per-function
test.describe('Auto-save', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

   
  test.describe.serial('New Post Auto-save', () => {
     
    test('should auto-save new post after delay and update URL', async ({ page }) => {
      // Start with empty database
      expect(await getPostCount(page)).toBe(0)

      // Go to new post page (opt-in to auto-save, disabled by default in E2E mode)
      await page.goto('/new?autosave=true')
      await expect(page.getByRole('heading', { name: /create post/i })).toBeVisible()

      // Select Twitter platform
      await page.getByRole('button', { name: 'Twitter' }).click()

      // Type content
      await fillContent(page, 'Auto-save test content')

      // Wait for auto-save to complete and URL to change
      // Auto-save has 2s delay + API call time, so use 15s timeout for CI reliability
      await expect(page).toHaveURL(/\/edit\/[a-f0-9-]+/, { timeout: 15000 })

      // Database should have exactly 1 post
      expect(await getPostCount(page)).toBe(1)

      // Get the post and verify content
      const posts = await getAllPosts(page)
      expect(posts[0].status).toBe('draft')
      expect(posts[0].platform).toBe('twitter')
    })

     
    test('should not create duplicate posts on subsequent edits', async ({ page }) => {
      // Start with empty database
      expect(await getPostCount(page)).toBe(0)

      // Go to new post page (opt-in to auto-save, disabled by default in E2E mode)
      await page.goto('/new?autosave=true')
      await page.getByRole('button', { name: 'Twitter' }).click()
      await fillContent(page, 'First content')

      // Wait for first auto-save and URL change (15s timeout for CI reliability)
      await expect(page).toHaveURL(/\/edit\/[a-f0-9-]+/, { timeout: 15000 })

      // Should have 1 post
      expect(await getPostCount(page)).toBe(1)

      // Get the ID from URL
      const urlAfterFirstSave = page.url()
      const postId = extractPostIdFromUrl(urlAfterFirstSave)
      expect(postId).toBeTruthy()

      // Continue editing - manually save to ensure update is persisted
      const textarea = page.locator('textarea').first()
      await textarea.press('End')
      await textarea.type(' - updated')
      await page.getByRole('button', { name: /save draft/i }).click()
      await expect(page).toHaveURL('/dashboard')

      // Should STILL have exactly 1 post (no duplicates)
      expect(await getPostCount(page)).toBe(1)

      // Verify the post was updated (has both original and appended text)
      const posts = await getAllPosts(page)
      expect(posts[0].id).toBe(postId)
      expect((posts[0].content as { text: string }).text).toContain('First content')
      expect((posts[0].content as { text: string }).text).toContain('updated')
    })

     
    test('should show auto-save indicator after save completes', async ({ page }) => {
      await page.goto('/new?autosave=true')
      await page.getByRole('button', { name: 'Twitter' }).click()

      // Type content
      await fillContent(page, 'Test for indicator')

      // First wait for URL to change - this confirms auto-save completed and created the post
      // The URL change is the most reliable indicator that auto-save worked
      await expect(page).toHaveURL(/\/edit\/[a-f0-9-]+/, { timeout: 10000 })

      // The "Saved" indicator should still be visible (shows for 5 seconds after save)
      await expect(page.getByText(/saved/i)).toBeVisible({ timeout: 5000 })
    })
  })

   
  test.describe.serial('Edit Post Auto-save', () => {
     
    test('should auto-save changes to existing draft', async ({ page }) => {
      // Create a draft manually via the UI first
      await page.goto('/new')
      await page.getByRole('button', { name: 'Twitter' }).click()
      await fillContent(page, 'Original draft content')
      await page.getByRole('button', { name: /save draft/i }).click()
      await expect(page).toHaveURL('/dashboard')

      // Should have 1 post
      expect(await getPostCount(page)).toBe(1)
      const originalPosts = await getAllPosts(page)
      const postId = originalPosts[0].id

      // Go to edit the post
      await page.goto(`/edit/${postId}`)
      await expect(page.getByRole('heading', { name: /edit post/i })).toBeVisible()

      // Wait for existing content to load before editing
      await waitForContentToLoad(page, 'Original draft content')

      // Edit the content and verify React processed the change
      await fillContent(page, 'Modified draft content via auto-save')
      await expect(page.locator('textarea').first()).toHaveValue(
        'Modified draft content via auto-save'
      )

      // Wait for auto-save to complete (3s debounce + save time)
      await expect(page.getByText('Saved!')).toBeVisible({ timeout: 15000 })

      // Should still have exactly 1 post
      expect(await getPostCount(page)).toBe(1)

      // Verify content was updated
      const updatedPosts = await getAllPosts(page)
      expect(updatedPosts[0].id).toBe(postId)
      expect((updatedPosts[0].content as { text: string }).text).toBe(
        'Modified draft content via auto-save'
      )
    })

     
    test('should auto-save platform switch', async ({ page }) => {
      // Create a Twitter draft
      await page.goto('/new')
      await page.getByRole('button', { name: 'Twitter' }).click()
      await fillContent(page, 'Platform switch test')
      await page.getByRole('button', { name: /save draft/i }).click()
      await expect(page).toHaveURL('/dashboard')

      const originalPosts = await getAllPosts(page)
      const postId = originalPosts[0].id
      expect(originalPosts[0].platform).toBe('twitter')

      // Edit and switch to LinkedIn (with confirmation dialog)
      await page.goto(`/edit/${postId}`)
      await waitForContentToLoad(page, 'Platform switch test')
      await switchPlatformWithConfirm(page, 'linkedin')

      // Wait for auto-save to complete (3s debounce + save time)
      await expect(page.getByText('Saved!')).toBeVisible({ timeout: 15000 })

      // Verify platform was switched to LinkedIn
      const updatedPosts = await getAllPosts(page)
      expect(updatedPosts[0].platform).toBe('linkedin')
    })
  })

   
  test.describe.serial('Auto-save Edge Cases', () => {
     
    test('should not auto-save if no changes made', async ({ page }) => {
      // Create a draft
      await page.goto('/new')
      await page.getByRole('button', { name: 'Twitter' }).click()
      await fillContent(page, 'No changes test')
      await page.getByRole('button', { name: /save draft/i }).click()
      await expect(page).toHaveURL('/dashboard')

      const originalPosts = await getAllPosts(page)
      const postId = originalPosts[0].id
      const originalUpdatedAt = originalPosts[0].updatedAt

      // Go to edit but don't change anything
      await page.goto(`/edit/${postId}`)
      await expect(page.getByRole('heading', { name: /edit post/i })).toBeVisible()

      // Wait for content to load before checking auto-save behavior
      await waitForContentToLoad(page, 'No changes test')

      // Wait for potential auto-save cycle to complete — check that no "Saved!" indicator appears
      await expect(page.getByText('Saved!')).not.toBeVisible({ timeout: 5000 })

      // updatedAt should not have changed (no unnecessary saves)
      const currentPosts = await getAllPosts(page)
      expect(currentPosts[0].updatedAt).toBe(originalUpdatedAt)
    })

     
    test('should keep scheduled status when editing and saving a scheduled post', async ({
      page,
    }) => {
      // Create a scheduled post
      await page.goto('/new')
      await page.getByRole('button', { name: 'Twitter' }).click()
      await fillContent(page, 'Scheduled post')

      // Set schedule for tomorrow
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]
      await page.locator('[data-testid="main-schedule-date-input"]').fill(dateStr)
      await page.locator('[data-testid="main-schedule-time-input"]').fill('12:00')

      // Schedule the post
      await page.getByRole('button', { name: /^schedule$/i }).click()
      await expect(page).toHaveURL('/dashboard')

      const originalPosts = await getAllPosts(page)
      expect(originalPosts[0].status).toBe('scheduled')
      const postId = originalPosts[0].id

      // Edit the scheduled post
      await page.goto(`/edit/${postId}`)
      await waitForContentToLoad(page, 'Scheduled post')
      await fillContent(page, 'Updated scheduled post content')

      // Note: Auto-save is disabled for scheduled posts (only works for drafts)
      // Save manually by clicking "Update Schedule"
      await page.getByRole('button', { name: /schedule/i }).click()
      await expect(page).toHaveURL('/dashboard')

      // Post should remain scheduled (not converted to draft)
      const updatedPosts = await getAllPosts(page)
      expect(updatedPosts[0].status).toBe('scheduled')
      expect(updatedPosts[0].scheduledAt).toBeTruthy()
      expect((updatedPosts[0].content as { text: string }).text).toBe(
        'Updated scheduled post content'
      )
    })
  })
})
