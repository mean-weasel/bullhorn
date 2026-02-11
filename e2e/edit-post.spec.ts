import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  goToPosts,
  clickPost,
  fillContent,
  fillNotes,
  saveDraft,
  schedulePost,
  waitForNavigation,
  createTestPost,
  setSchedule,
  generateTestId,
  uniqueContent,
  waitForContentToLoad,
} from './helpers'

test.describe('Edit Post', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test.describe.serial('Navigate to Edit', () => {
    test('should navigate to edit page from posts list', async ({ page }, testInfo) => {
      const testId = generateTestId(testInfo)
      const content = uniqueContent('Test post', testId)
      // Create a post first
      await createTestPost(page, { platform: 'twitter', content })

      await goToPosts(page)

      // Click on the first post
      await clickPost(page, 0)

      // Should be on edit page
      await expect(page.getByRole('heading', { name: /edit post/i })).toBeVisible()
    })

    test('should load existing post content in editor', async ({ page }, testInfo) => {
      const testId = generateTestId(testInfo)
      const testContent = uniqueContent('This is my test content', testId)
      await createTestPost(page, { platform: 'twitter', content: testContent })

      await goToPosts(page)
      await clickPost(page, 0)

      // Verify content is loaded in textarea
      const textarea = page.locator('textarea').first()
      await expect(textarea).toHaveValue(testContent)
    })
  })

  test.describe.serial('Edit Post Content', () => {
    test('should edit post content', async ({ page }) => {
      await createTestPost(page, { platform: 'twitter', content: 'Original content' })

      await goToPosts(page)
      await clickPost(page, 0)

      // Wait for original content to load
      await waitForContentToLoad(page, 'Original content')

      // Edit the content
      const newContent = 'Updated content from E2E test!'
      await fillContent(page, newContent)

      // Save changes
      await saveDraft(page)
      await waitForNavigation(page, '/')
    })

    test('should change draft post to scheduled', async ({ page }) => {
      await createTestPost(page, { platform: 'twitter', content: 'Draft to schedule' })

      await goToPosts(page)
      await clickPost(page, 0)

      // Set a schedule
      const tomorrow = new Date()
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      tomorrow.setUTCHours(10, 0, 0, 0)
      await setSchedule(page, tomorrow)

      // Schedule the post
      await schedulePost(page)
      await waitForNavigation(page, '/')
    })
  })

  test.describe('Edit Scheduled Posts', () => {
    test('should reschedule a post', async ({ page }) => {
      // Create a scheduled post
      await createTestPost(page, {
        platform: 'twitter',
        content: 'Scheduled post',
        asDraft: false,
      })

      await goToPosts(page)
      await clickPost(page, 0)

      // Change the schedule
      const newDate = new Date()
      newDate.setUTCDate(newDate.getUTCDate() + 3)
      newDate.setUTCHours(14, 30, 0, 0)
      await setSchedule(page, newDate)

      // Re-schedule
      await schedulePost(page)
      await waitForNavigation(page, '/')
    })

    test('should convert scheduled post to draft', async ({ page }) => {
      // Create a scheduled post
      await createTestPost(page, {
        platform: 'twitter',
        content: 'Scheduled to become draft',
        asDraft: false,
      })

      await goToPosts(page)
      await clickPost(page, 0)

      // Clear the schedule by clearing the date input
      await page.locator('[data-testid="main-schedule-date-input"]').fill('')

      // Save as draft
      await saveDraft(page)
      await waitForNavigation(page, '/')
    })
  })

  test.describe.serial('Edit Notes', () => {
    test('should add notes to existing post', async ({ page }, testInfo) => {
      const testId = generateTestId(testInfo)
      const content = uniqueContent('Post without notes', testId)
      await createTestPost(page, { platform: 'twitter', content })

      await goToPosts(page)
      await clickPost(page, 0)

      // Add notes
      await fillNotes(page, 'Added notes after creation')

      // Save
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Go back and verify notes are saved
      await goToPosts(page)
      await clickPost(page, 0)

      // Notes section should auto-expand since notes exist
      const notesTextarea = page.getByPlaceholder(/add notes about this post/i)
      await expect(notesTextarea).toBeVisible()
      await expect(notesTextarea).toHaveValue('Added notes after creation')
    })

    test('should edit existing notes', async ({ page }, testInfo) => {
      const testId = generateTestId(testInfo)
      const content = uniqueContent('Post to edit notes', testId)
      await createTestPost(page, { platform: 'twitter', content })

      await goToPosts(page)
      await clickPost(page, 0)

      // Add initial notes
      await fillNotes(page, 'Initial notes')
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Go back and edit notes
      await goToPosts(page)
      await clickPost(page, 0)

      const notesTextarea = page.getByPlaceholder(/add notes about this post/i)
      await notesTextarea.fill('Updated notes content')

      await saveDraft(page)
      await waitForNavigation(page, '/')
    })
  })

  test.describe('Validation', () => {
    test('should preserve changes when switching platforms', async ({ page }) => {
      await createTestPost(page, { platform: 'twitter', content: 'Original' })

      await goToPosts(page)
      await clickPost(page, 0)

      // Wait for original content to load
      await waitForContentToLoad(page, 'Original')

      // Type some content
      const originalContent = 'Content that should persist'
      await fillContent(page, originalContent)

      // Add LinkedIn platform
      await page.getByRole('button', { name: 'LinkedIn' }).click()

      // Content should still be there
      const textarea = page.locator('textarea').first()
      await expect(textarea).toHaveValue(originalContent)
    })

    test('should show save button as enabled when content changes', async ({ page }) => {
      await createTestPost(page, { platform: 'twitter', content: 'Original' })

      await goToPosts(page)
      await clickPost(page, 0)

      // Wait for original content to load
      await waitForContentToLoad(page, 'Original')

      // Make a change
      await fillContent(page, 'Modified content')

      // The save draft button should be visible and enabled
      const saveDraftBtn = page.getByRole('button', { name: /save draft/i })
      await expect(saveDraftBtn).toBeEnabled()
    })
  })
})
