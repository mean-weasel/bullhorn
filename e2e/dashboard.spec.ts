import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  createTestPost,
  deletePost,
  archivePost,
  waitForNavigation,
} from './helpers'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test for clean state
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await enterDemoMode(page)
  })

  // Stats tests need serial execution to ensure accurate counts
  test.describe.serial('Stats Bar', () => {
    test('should show zero stats when no posts exist', async ({ page }) => {
      // Verify all stats show 0
      // The stats bar uses 'flex-1 flex items-center gap-4 sm:gap-6'
      const statsBar = page.locator('.flex-1.flex.items-center')

      // Check Scheduled count
      await expect(
        statsBar.locator('text=Scheduled').locator('..').locator('.text-2xl')
      ).toHaveText('0')

      // Check Drafts count
      await expect(statsBar.locator('text=Drafts').locator('..').locator('.text-2xl')).toHaveText(
        '0'
      )

      // Check Published count
      await expect(
        statsBar.locator('text=Published').locator('..').locator('.text-2xl')
      ).toHaveText('0')
    })

    test('should increment drafts count when draft is created', async ({ page }) => {
      // Create a draft post
      await createTestPost(page, { platform: 'twitter', content: 'Test draft', asDraft: true })

      // Navigate to dashboard
      await page.goto('/')

      // Verify drafts count is 1
      const draftsSection = page.locator('text=Drafts').locator('..')
      await expect(draftsSection.locator('.text-2xl')).toHaveText('1')

      // Scheduled should still be 0
      const scheduledSection = page.locator('text=Scheduled').locator('..')
      await expect(scheduledSection.locator('.text-2xl')).toHaveText('0')
    })

    test('should increment scheduled count when post is scheduled', async ({ page }) => {
      // Create a scheduled post
      await createTestPost(page, { platform: 'twitter', content: 'Scheduled post', asDraft: false })

      // Navigate to dashboard
      await page.goto('/')

      // Verify scheduled count is 1
      const scheduledSection = page.locator('text=Scheduled').locator('..')
      await expect(scheduledSection.locator('.text-2xl')).toHaveText('1')

      // Drafts should still be 0
      const draftsSection = page.locator('text=Drafts').locator('..')
      await expect(draftsSection.locator('.text-2xl')).toHaveText('0')
    })

    test('should show correct counts with multiple posts', async ({ page }) => {
      // Create 2 drafts
      await createTestPost(page, { platform: 'twitter', content: 'Draft 1', asDraft: true })
      await createTestPost(page, { platform: 'linkedin', content: 'Draft 2', asDraft: true })

      // Create 3 scheduled posts
      await createTestPost(page, { platform: 'twitter', content: 'Scheduled 1', asDraft: false })
      await createTestPost(page, { platform: 'linkedin', content: 'Scheduled 2', asDraft: false })
      await createTestPost(page, { platform: 'reddit', content: 'Scheduled 3', asDraft: false })

      // Navigate to dashboard
      await page.goto('/')

      // Verify counts
      const scheduledSection = page.locator('text=Scheduled').locator('..')
      await expect(scheduledSection.locator('.text-2xl')).toHaveText('3')

      const draftsSection = page.locator('text=Drafts').locator('..')
      await expect(draftsSection.locator('.text-2xl')).toHaveText('2')

      const publishedSection = page.locator('text=Published').locator('..')
      await expect(publishedSection.locator('.text-2xl')).toHaveText('0')
    })

    test('should decrement count when post is deleted', async ({ page }) => {
      // Create 2 drafts
      await createTestPost(page, { platform: 'twitter', content: 'Draft to keep', asDraft: true })
      await createTestPost(page, {
        platform: 'linkedin',
        content: 'Draft to delete',
        asDraft: true,
      })

      // Navigate to dashboard and verify count is 2
      await page.goto('/')
      const draftsSection = page.locator('text=Drafts').locator('..')
      await expect(draftsSection.locator('.text-2xl')).toHaveText('2')

      // Go to posts and archive one first (posts must be archived before deletion)
      await page.goto('/posts')
      await page.getByRole('button', { name: /drafts/i }).click()

      // Click on the first draft to edit
      const firstCard = page.locator('a[href^="/edit/"]').first()
      await firstCard.click()
      await expect(page).toHaveURL(/\/edit\//)

      // Archive the post first
      await archivePost(page)
      await waitForNavigation(page, '/')

      // Verify drafts count decreased to 1
      await expect(draftsSection.locator('.text-2xl')).toHaveText('1')

      // Now go to archived posts and delete
      await page.goto('/posts')
      await page.getByRole('button', { name: /archived/i }).click()

      // Click on the archived post to edit
      const archivedCard = page.locator('a[href^="/edit/"]').first()
      await archivedCard.click()
      await expect(page).toHaveURL(/\/edit\//)

      // Delete the post
      await deletePost(page)

      // Should navigate back to dashboard
      await expect(page).toHaveURL('/dashboard')
    })

    test('should decrement count when post is archived', async ({ page }) => {
      // Create 2 scheduled posts
      await createTestPost(page, { platform: 'twitter', content: 'Post to keep', asDraft: false })
      await createTestPost(page, {
        platform: 'linkedin',
        content: 'Post to archive',
        asDraft: false,
      })

      // Navigate to dashboard and verify count is 2
      await page.goto('/')
      const scheduledSection = page.locator('text=Scheduled').locator('..')
      await expect(scheduledSection.locator('.text-2xl')).toHaveText('2')

      // Go to posts and archive one
      await page.goto('/posts')
      await page.getByRole('button', { name: /scheduled/i }).click()

      // Click on the first scheduled post to edit
      const firstCard = page.locator('a[href^="/edit/"]').first()
      await firstCard.click()
      await expect(page).toHaveURL(/\/edit\//)

      // Archive the post
      await archivePost(page)

      // Should navigate back to dashboard
      await waitForNavigation(page, '/')

      // Verify scheduled count decreased to 1
      await expect(scheduledSection.locator('.text-2xl')).toHaveText('1')
    })
  })

  // Empty state tests need serial execution to ensure no posts exist
  test.describe.serial('Empty State', () => {
    test('should show welcome message when no posts exist', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /welcome to bullhorn/i })).toBeVisible()
      // The paragraph contains more text, so use partial match
      await expect(page.getByText('Create your first post to get started')).toBeVisible()
    })

    test('should have create first post button', async ({ page }) => {
      const createBtn = page.getByRole('link', { name: /create your first post/i })
      await expect(createBtn).toBeVisible()

      await createBtn.click()
      await expect(page).toHaveURL('/new')
    })

    test('should hide empty state when posts exist', async ({ page }) => {
      // Create a post
      await createTestPost(page, { platform: 'twitter', content: 'Test post', asDraft: true })

      // Navigate to dashboard
      await page.goto('/')

      // Empty state should not be visible
      await expect(page.getByRole('heading', { name: /welcome to bullhorn/i })).not.toBeVisible()
    })
  })

  // Upcoming tests need serial execution to check empty/non-empty states
  test.describe.serial('Upcoming Section', () => {
    test('should show upcoming posts section when scheduled posts exist', async ({ page }) => {
      // Create a scheduled post
      await createTestPost(page, { platform: 'twitter', content: 'Upcoming post', asDraft: false })

      // Navigate to dashboard
      await page.goto('/')

      // Upcoming section should be visible
      await expect(page.getByRole('heading', { name: /upcoming/i }).first()).toBeVisible()
    })

    test('should show empty state when no scheduled posts', async ({ page }) => {
      // Create only a draft (no scheduled)
      await createTestPost(page, { platform: 'twitter', content: 'Just a draft', asDraft: true })

      // Navigate to dashboard
      await page.goto('/')

      // Should show "No posts scheduled" message
      await expect(page.getByText(/no posts scheduled/i)).toBeVisible()
    })
  })

  // Drafts tests need serial execution to check empty/non-empty states
  test.describe.serial('Drafts Section', () => {
    test('should show drafts section when drafts exist', async ({ page }) => {
      // Create a draft
      await createTestPost(page, { platform: 'twitter', content: 'My draft', asDraft: true })

      // Navigate to dashboard
      await page.goto('/')

      // Drafts section heading should be visible
      await expect(page.getByRole('heading', { name: /drafts/i })).toBeVisible()
    })

    test('should show empty state when no drafts', async ({ page }) => {
      // Create only a scheduled post (no drafts)
      await createTestPost(page, { platform: 'twitter', content: 'Scheduled only', asDraft: false })

      // Navigate to dashboard
      await page.goto('/')

      // Should show "No drafts" message
      await expect(page.getByText(/no drafts/i)).toBeVisible()
    })

    test('should display draft content preview', async ({ page }) => {
      const content = 'This is my draft post content for testing'
      await createTestPost(page, { platform: 'twitter', content, asDraft: true })

      // Navigate to dashboard
      await page.goto('/')

      // Should show the content preview
      await expect(page.getByText(content)).toBeVisible()
    })
  })
})
