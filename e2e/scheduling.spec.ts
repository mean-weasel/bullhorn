import { test, expect } from '@playwright/test'
import {
  resetDatabase,
  goToNewPost,
  selectPlatform,
  fillContent,
  setSchedule,
  schedulePost,
  saveDraft,
  waitForNavigation,
  getAllPosts,
  waitForContentToLoad,
} from './helpers'

test.describe('Scheduling', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page)
  })

  test.describe('Date Input', () => {
    test('should be visible and clickable', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      // The date picker button should be visible
      const dateButton = page.locator('[data-testid="main-schedule-date"]')
      await expect(dateButton).toBeVisible()
      await expect(dateButton).toBeEnabled()

      // Click should work
      await dateButton.click()
    })

    test('should accept date via keyboard input', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      const dateInput = page.locator('[data-testid="main-schedule-date-input"]')

      // Set date via fill
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]

      await dateInput.fill(dateStr)
      await expect(dateInput).toHaveValue(dateStr)
    })

    test('should persist date after page navigation', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Testing date persistence')

      const dateInput = page.locator('[data-testid="main-schedule-date-input"]')
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]

      await dateInput.fill(dateStr)
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Get post and navigate back to edit
      const posts = await getAllPosts(page)
      expect(posts.length).toBe(1)

      await page.goto(`/edit/${posts[0].id}`)
      await waitForContentToLoad(page, 'Testing date persistence')
      await expect(page.locator('[data-testid="main-schedule-date-input"]')).toHaveValue(dateStr)
    })
  })

  test.describe('Time Input', () => {
    test('should be visible and clickable', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      // The time picker button should be visible
      const timeButton = page.locator('[data-testid="main-schedule-time"]')
      await expect(timeButton).toBeVisible()
      await expect(timeButton).toBeEnabled()

      // Click should work
      await timeButton.click()
    })

    test('should accept time via keyboard input', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      // First set a date (time depends on date being set)
      const dateInput = page.locator('[data-testid="main-schedule-date-input"]')
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      await dateInput.fill(tomorrow.toISOString().split('T')[0])

      const timeInput = page.locator('[data-testid="main-schedule-time-input"]')
      await timeInput.fill('14:30')
      await expect(timeInput).toHaveValue('14:30')
    })

    test('should persist time after page navigation', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Testing time persistence')

      // Set date and time
      const dateInput = page.locator('[data-testid="main-schedule-date-input"]')
      const timeInput = page.locator('[data-testid="main-schedule-time-input"]')

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]

      await dateInput.fill(dateStr)
      await timeInput.fill('09:15')

      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Navigate back to edit
      const posts = await getAllPosts(page)
      await page.goto(`/edit/${posts[0].id}`)
      await waitForContentToLoad(page, 'Testing time persistence')

      await expect(page.locator('[data-testid="main-schedule-date-input"]')).toHaveValue(dateStr)
      await expect(page.locator('[data-testid="main-schedule-time-input"]')).toHaveValue('09:15')
    })
  })

  test.describe('Scheduling Flow', () => {
    test('should schedule post with date and time', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Scheduled post test')

      // Set schedule
      const dateInput = page.locator('[data-testid="main-schedule-date-input"]')
      const timeInput = page.locator('[data-testid="main-schedule-time-input"]')

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]

      await dateInput.fill(dateStr)
      await timeInput.fill('10:00')

      await schedulePost(page)
      await waitForNavigation(page, '/')

      // Verify post is scheduled
      const posts = await getAllPosts(page)
      expect(posts.length).toBe(1)
      expect(posts[0].status).toBe('scheduled')
      expect(posts[0].scheduledAt).toBeTruthy()
    })

    test('should disable schedule button when no date is set', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Missing date test')

      // Schedule button should be disabled without a date
      const scheduleButton = page.getByRole('button', { name: /^schedule$/i })
      await expect(scheduleButton).toBeDisabled()
      await expect(scheduleButton).toHaveAttribute('title', 'Select a date and time to schedule')
    })

    test('should reschedule existing post', async ({ page }) => {
      // Create scheduled post
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Post to reschedule')

      const tomorrow = new Date()
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      tomorrow.setUTCHours(10, 0, 0, 0)
      await setSchedule(page, tomorrow)

      await schedulePost(page)
      await waitForNavigation(page, '/')

      // Edit and reschedule
      const posts = await getAllPosts(page)
      const originalScheduledAt = posts[0].scheduledAt
      await page.goto(`/edit/${posts[0].id}`)
      await waitForContentToLoad(page, 'Post to reschedule')

      // Change date to day after tomorrow and time to 15:00
      const dayAfter = new Date()
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 2)
      dayAfter.setUTCHours(15, 0, 0, 0)
      const newDateStr = dayAfter.toISOString().split('T')[0]

      await setSchedule(page, dayAfter)

      // Verify inputs have new values before scheduling
      await expect(page.locator('[data-testid="main-schedule-date-input"]')).toHaveValue(newDateStr)
      await expect(page.locator('[data-testid="main-schedule-time-input"]')).toHaveValue('15:00')

      await schedulePost(page)
      await waitForNavigation(page, '/')

      // Verify schedule was changed (different from original)
      const updatedPosts = await getAllPosts(page)
      expect(updatedPosts[0].scheduledAt).not.toBe(originalScheduledAt)
      expect(updatedPosts[0].scheduledAt).toBeTruthy()

      // Verify the date/time shows correctly in the UI
      await page.goto(`/edit/${updatedPosts[0].id}`)
      await waitForContentToLoad(page, 'Post to reschedule')
      await expect(page.locator('[data-testid="main-schedule-date-input"]')).toHaveValue(newDateStr)
      await expect(page.locator('[data-testid="main-schedule-time-input"]')).toHaveValue('15:00')
    })

    test('should clear schedule and save as draft', async ({ page }) => {
      // Create scheduled post
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Scheduled then draft')

      const dateInput = page.locator('[data-testid="main-schedule-date-input"]')
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      await dateInput.fill(tomorrow.toISOString().split('T')[0])

      await schedulePost(page)
      await waitForNavigation(page, '/')

      // Edit and save as draft (which should clear schedule)
      const posts = await getAllPosts(page)
      await page.goto(`/edit/${posts[0].id}`)
      await waitForContentToLoad(page, 'Scheduled then draft')

      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify still has date but status is draft
      const updatedPosts = await getAllPosts(page)
      expect(updatedPosts[0].status).toBe('draft')
    })
  })

  test.describe('Calendar Icon Visibility', () => {
    test('date input should have visible picker indicator', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      // The date picker button should be visible and interactable
      const dateButton = page.locator('[data-testid="main-schedule-date"]')
      await expect(dateButton).toBeVisible()

      // Button should have proper dimensions
      const box = await dateButton.boundingBox()
      expect(box).toBeTruthy()
      expect(box!.width).toBeGreaterThan(50)
      expect(box!.height).toBeGreaterThan(20)
    })

    test('time input should have visible picker indicator', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      // The time picker button should be visible and interactable
      const timeButton = page.locator('[data-testid="main-schedule-time"]')
      await expect(timeButton).toBeVisible()

      // Button should have proper dimensions
      const box = await timeButton.boundingBox()
      expect(box).toBeTruthy()
      expect(box!.width).toBeGreaterThan(50)
      expect(box!.height).toBeGreaterThan(20)
    })
  })

  test.describe('Date and Time Selection', () => {
    test('should enable schedule button when date and time are set', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Post with future date')

      // Set tomorrow's date with a time
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]

      await page.locator('[data-testid="main-schedule-date-input"]').fill(dateStr)
      await page.locator('[data-testid="main-schedule-time-input"]').fill('14:00')

      // Schedule button should be enabled
      const scheduleButton = page.getByRole('button', { name: /^schedule$/i })
      await expect(scheduleButton).toBeEnabled()
    })

    test('should enable schedule button for today with future time', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Post scheduled for later today')

      // Set today's date
      const today = new Date()
      const dateStr = today.toISOString().split('T')[0]

      // Calculate a time 2 hours from now
      const futureTime = new Date(today.getTime() + 2 * 60 * 60 * 1000)
      const hours = futureTime.getUTCHours().toString().padStart(2, '0')
      const minutes = futureTime.getUTCMinutes().toString().padStart(2, '0')
      const timeStr = `${hours}:${minutes}`

      await page.locator('[data-testid="main-schedule-date-input"]').fill(dateStr)
      await page.locator('[data-testid="main-schedule-time-input"]').fill(timeStr)

      // Schedule button should be enabled for future time today
      const scheduleButton = page.getByRole('button', { name: /^schedule$/i })
      await expect(scheduleButton).toBeEnabled()
    })

    test('should allow selecting any date in the date picker', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Testing date selection')

      // Set a week from now
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      const dateStr = nextWeek.toISOString().split('T')[0]

      await page.locator('[data-testid="main-schedule-date-input"]').fill(dateStr)
      await expect(page.locator('[data-testid="main-schedule-date-input"]')).toHaveValue(dateStr)
    })
  })

  test.describe('Scheduled Posts Display', () => {
    test('should show all scheduled posts in the scheduled filter', async ({ page }) => {
      // Create 3 scheduled posts
      const baseTomorrow = new Date()
      baseTomorrow.setDate(baseTomorrow.getDate() + 1)

      const times = ['09:00', '15:00', '12:00']

      for (const time of times) {
        await goToNewPost(page)
        await selectPlatform(page, 'twitter')
        await fillContent(page, `Post scheduled at ${time}`)

        await page
          .locator('[data-testid="main-schedule-date-input"]')
          .fill(baseTomorrow.toISOString().split('T')[0])
        await page.locator('[data-testid="main-schedule-time-input"]').fill(time)

        await schedulePost(page)
        await waitForNavigation(page, '/')
      }

      // Navigate to posts and filter by scheduled
      await page.goto('/posts')
      await page.getByRole('button', { name: /scheduled/i }).click()

      // Wait for posts to load
      await expect(page.locator('a[href^="/edit/"]').first()).toBeVisible({ timeout: 10000 })

      // Verify all 3 posts are visible
      const postCards = page.locator('a[href^="/edit/"]')
      const count = await postCards.count()
      expect(count).toBe(3)

      // Verify each post content is present
      await expect(page.getByText('Post scheduled at 09:00')).toBeVisible()
      await expect(page.getByText('Post scheduled at 15:00')).toBeVisible()
      await expect(page.getByText('Post scheduled at 12:00')).toBeVisible()
    })

    test('should display schedule datetime on post card', async ({ page }) => {
      // Create a scheduled post for a specific date/time
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]

      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Post with visible schedule')

      await page.locator('[data-testid="main-schedule-date-input"]').fill(dateStr)
      await page.locator('[data-testid="main-schedule-time-input"]').fill('10:30')

      await schedulePost(page)
      await waitForNavigation(page, '/')

      // Go to posts list
      await page.goto('/posts')

      // Find the post card
      const postCard = page
        .locator('a[href^="/edit/"]')
        .filter({ hasText: 'Post with visible schedule' })
      await expect(postCard).toBeVisible()

      // Should show the schedule time somewhere (10:30 AM formatted)
      await expect(postCard.getByText(/10:30/i)).toBeVisible()
    })
  })
})
