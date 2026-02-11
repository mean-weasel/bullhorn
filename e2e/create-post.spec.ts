import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  goToNewPost,
  selectPlatform,
  fillContent,
  fillNotes,
  fillRedditFields,
  setLinkedInVisibility,
  setSchedule,
  saveDraft,
  schedulePost,
  waitForNavigation,
} from './helpers'

test.describe('Create Post', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test.describe('Twitter Posts', () => {
    test('should create a Twitter draft post', async ({ page }) => {
      await goToNewPost(page)

      // Select Twitter platform
      await selectPlatform(page, 'twitter')

      // Fill in content
      await fillContent(page, 'This is a test tweet from Playwright E2E tests!')

      // Verify character count is visible
      await expect(page.getByText('/ 280')).toBeVisible()

      // Save as draft
      await saveDraft(page)

      // Should navigate back to dashboard
      await waitForNavigation(page, '/')
    })

    test('should create a Twitter scheduled post', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Scheduled tweet for tomorrow!')

      // Set schedule for tomorrow
      const tomorrow = new Date()
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      tomorrow.setUTCHours(10, 0, 0, 0)
      await setSchedule(page, tomorrow)

      // Schedule the post
      await schedulePost(page)

      await waitForNavigation(page, '/')
    })

    test('should show character count warning when approaching limit', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'twitter')

      // Fill with content near the limit
      const longText = 'A'.repeat(270)
      await fillContent(page, longText)

      // Character count should show warning color (yellow when > 90%)
      await expect(page.getByText('270')).toBeVisible()
    })

    test('should show error when exceeding character limit', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'twitter')

      // Fill with content over the limit
      const overLimitText = 'A'.repeat(290)
      await fillContent(page, overLimitText)

      // Character count should show error color
      await expect(page.getByText('290')).toBeVisible()
    })
  })

  test.describe('LinkedIn Posts', () => {
    test('should create a LinkedIn draft post with public visibility', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'linkedin')
      await fillContent(
        page,
        'Professional update from E2E tests!\n\nKey points:\n- Testing is important\n- Automation saves time'
      )

      // Verify LinkedIn settings panel is visible
      await expect(page.getByText('LinkedIn Settings')).toBeVisible()

      // Set visibility to public (should be default)
      await setLinkedInVisibility(page, 'public')

      await saveDraft(page)
      await waitForNavigation(page, '/')
    })

    test('should create a LinkedIn post with connections-only visibility', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'linkedin')
      await fillContent(page, 'A more personal update for my network.')

      // Set visibility to connections only
      await setLinkedInVisibility(page, 'connections')

      await saveDraft(page)
      await waitForNavigation(page, '/')
    })

    test('should create a LinkedIn scheduled post', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'linkedin')
      await fillContent(page, 'Scheduled LinkedIn post for next week!')

      const nextWeek = new Date()
      nextWeek.setUTCDate(nextWeek.getUTCDate() + 7)
      nextWeek.setUTCHours(9, 0, 0, 0)
      await setSchedule(page, nextWeek)

      await schedulePost(page)
      await waitForNavigation(page, '/')
    })
  })

  test.describe('Reddit Posts', () => {
    test('should create a Reddit draft post', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'reddit')

      // Verify Reddit settings panel is visible
      await expect(page.getByText('Reddit Settings')).toBeVisible()

      // Fill in Reddit-specific fields
      await fillRedditFields(page, {
        subreddit: 'webdev',
        title: 'Built a social scheduler with Playwright tests',
      })

      await fillContent(
        page,
        'Just added E2E tests to my social scheduler app. Here are some learnings...'
      )

      await saveDraft(page)
      await waitForNavigation(page, '/')
    })

    test('should create a Reddit post with flair', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddit: 'SideProject',
        title: 'Show and Tell: My testing project',
        flair: 'Show and Tell',
      })

      await fillContent(page, 'Check out my side project with comprehensive E2E tests!')

      await saveDraft(page)
      await waitForNavigation(page, '/')
    })

    test('should create a Reddit scheduled post', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddit: 'startups',
        title: 'Launch day announcement',
      })

      await fillContent(page, "We're launching next month and would love your feedback!")

      const nextMonth = new Date()
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
      nextMonth.setUTCHours(12, 0, 0, 0)
      await setSchedule(page, nextMonth)

      await schedulePost(page)
      await waitForNavigation(page, '/')
    })

    test('should show title character count', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddit: 'test',
        title: 'This is a test title',
      })

      // Should show character count for title
      await expect(page.getByText('/ 300')).toBeVisible()
    })
  })

  test.describe('Platform Switching', () => {
    test('should switch between platforms', async ({ page }) => {
      await goToNewPost(page)

      const previewPanel = page.locator('[data-testid="preview-panel"]')

      // Select Twitter
      await selectPlatform(page, 'twitter')
      await expect(previewPanel.getByText('Twitter / X')).toBeVisible()

      // Switch to LinkedIn
      await selectPlatform(page, 'linkedin')
      await expect(previewPanel.getByText('LinkedIn').first()).toBeVisible()
      // Twitter preview should be hidden
      await expect(previewPanel.getByText('Twitter / X')).not.toBeVisible()

      // Switch to Reddit
      await selectPlatform(page, 'reddit')
      await expect(previewPanel.getByText('Reddit').first()).toBeVisible()
      await expect(previewPanel.getByText('LinkedIn').first()).not.toBeVisible()
    })
  })

  test.describe('Notes', () => {
    test('should add notes to a post', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Post with notes attached')

      // Add notes
      await fillNotes(page, 'Remember to use #hashtags and mention @partner')

      // Verify notes section is expanded and has content
      await expect(page.getByPlaceholder(/add notes about this post/i)).toHaveValue(
        'Remember to use #hashtags and mention @partner'
      )

      await saveDraft(page)
      await waitForNavigation(page, '/')
    })

    test('should collapse and expand notes section', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'twitter')

      // Notes section should be collapsed by default
      const notesTextarea = page.getByPlaceholder(/add notes about this post/i)
      await expect(notesTextarea).not.toBeVisible()

      // Click to expand
      await page.getByRole('button', { name: /notes/i }).click()
      await expect(notesTextarea).toBeVisible()

      // Click to collapse
      await page.getByRole('button', { name: /notes/i }).click()
      await expect(notesTextarea).not.toBeVisible()
    })
  })

  test.describe('Multi-Subreddit Posts', () => {
    test('should add multiple subreddits', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'reddit')

      // Add multiple subreddits
      await fillRedditFields(page, {
        subreddits: ['startups', 'SaaS', 'sideproject'],
      })

      // Verify all subreddits are shown as collapsible cards
      await expect(page.locator('[data-testid="subreddit-card-startups"]')).toBeVisible()
      await expect(page.locator('[data-testid="subreddit-card-SaaS"]')).toBeVisible()
      await expect(page.locator('[data-testid="subreddit-card-sideproject"]')).toBeVisible()

      // Verify count is shown
      await expect(page.getByText('(3)')).toBeVisible()

      await fillContent(page, 'This post will go to multiple subreddits!')

      await saveDraft(page)
      await waitForNavigation(page, '/')
    })

    test('should remove subreddits via card', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'reddit')

      // Add subreddits
      await fillRedditFields(page, {
        subreddits: ['startups', 'SaaS'],
      })

      // Verify both cards are visible
      await expect(page.locator('[data-testid="subreddit-card-startups"]')).toBeVisible()
      await expect(page.locator('[data-testid="subreddit-card-SaaS"]')).toBeVisible()

      // Count should be 2
      await expect(page.getByText('(2)')).toBeVisible()

      // Remove one subreddit by clicking the X button on the card
      const startupCard = page.locator('[data-testid="subreddit-card-startups"]')
      await startupCard.locator('button[aria-label="Remove subreddit"]').click()

      // Verify it's removed
      await expect(page.locator('[data-testid="subreddit-card-startups"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="subreddit-card-SaaS"]')).toBeVisible()

      // Count should be 1
      await expect(page.getByText('(1)')).toBeVisible()
    })

    test('should show subreddits in preview', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddits: ['startups', 'SaaS'],
      })

      // Check preview panel shows both subreddits
      const previewPanel = page.locator('[data-testid="preview-panel"]')
      await expect(previewPanel).toContainText('r/startups')
      await expect(previewPanel).toContainText('r/SaaS')
    })
  })

  test.describe('Validation', () => {
    test('should show preview as user types', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'twitter')

      const testText = 'Testing live preview functionality!'
      await fillContent(page, testText)

      // Preview should show the content
      const previewSection = page.locator('.bg-\\[\\#15202B\\]') // Twitter preview background
      await expect(previewSection).toContainText(testText)
    })

    test('should require date for scheduling', async ({ page }) => {
      await goToNewPost(page)

      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Test content')

      // Schedule button should be disabled without a date
      const scheduleButton = page.getByRole('button', { name: /^schedule$/i })
      await expect(scheduleButton).toBeDisabled()
      await expect(scheduleButton).toHaveAttribute('title', 'Select a date and time to schedule')

      // Should still be on the editor page
      await expect(page.getByRole('heading', { name: /create post/i })).toBeVisible()
    })
  })
})
