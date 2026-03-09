import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  createTestPost,
  createPostViaAPI,
  archivePost,
  waitForNavigation,
} from './helpers'

/** Navigate to dashboard and wait for stats to render */
async function gotoDashboard(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.locator('[data-testid="stat-scheduled"]').waitFor({ state: 'visible' })
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test for clean state
    await page.addInitScript(() => localStorage.clear())
    await enterDemoMode(page)
  })

  // Stats tests need serial execution to ensure accurate counts
  test.describe.serial('Stats Bar', () => {
    test('should show zero stats when no posts exist', async ({ page }) => {
      await expect(page.locator('[data-testid="stat-scheduled"]')).toHaveText('0')
      await expect(page.locator('[data-testid="stat-drafts"]')).toHaveText('0')
      await expect(page.locator('[data-testid="stat-published"]')).toHaveText('0')
    })

    test('should increment drafts count when draft is created', async ({ page }) => {
      await createTestPost(page, { platform: 'twitter', content: 'Test draft', asDraft: true })
      await gotoDashboard(page)

      await expect(page.locator('[data-testid="stat-drafts"]')).toHaveText('1')
      await expect(page.locator('[data-testid="stat-scheduled"]')).toHaveText('0')
    })

    test('should increment scheduled count when post is scheduled', async ({ page }) => {
      await createTestPost(page, {
        platform: 'twitter',
        content: 'Scheduled post',
        asDraft: false,
      })
      await gotoDashboard(page)

      await expect(page.locator('[data-testid="stat-scheduled"]')).toHaveText('1')
      await expect(page.locator('[data-testid="stat-drafts"]')).toHaveText('0')
    })

    test('should show correct counts with multiple posts', async ({ page }) => {
      // Create posts via API to avoid slow UI navigation (5 sequential UI saves is flaky in CI)
      await createPostViaAPI(page, { platform: 'twitter', content: 'Draft 1', status: 'draft' })
      await createPostViaAPI(page, { platform: 'linkedin', content: 'Draft 2', status: 'draft' })
      await createPostViaAPI(page, {
        platform: 'twitter',
        content: 'Scheduled 1',
        status: 'scheduled',
      })
      await createPostViaAPI(page, {
        platform: 'linkedin',
        content: 'Scheduled 2',
        status: 'scheduled',
      })
      await createPostViaAPI(page, {
        platform: 'reddit',
        content: 'Scheduled 3',
        status: 'scheduled',
      })

      await gotoDashboard(page)

      await expect(page.locator('[data-testid="stat-scheduled"]')).toHaveText('3')
      await expect(page.locator('[data-testid="stat-drafts"]')).toHaveText('2')
      await expect(page.locator('[data-testid="stat-published"]')).toHaveText('0')
    })

    test('should decrement count when post is deleted', async ({ page }) => {
      await createTestPost(page, { platform: 'twitter', content: 'Draft to keep', asDraft: true })
      await createTestPost(page, {
        platform: 'linkedin',
        content: 'Draft to delete',
        asDraft: true,
      })

      await gotoDashboard(page)
      await expect(page.locator('[data-testid="stat-drafts"]')).toHaveText('2')

      // Go to posts and archive one first (posts must be archived before deletion)
      await page.goto('/posts')
      await page.getByRole('button', { name: /drafts/i }).click()

      const firstCard = page.locator('a[href^="/edit/"]').first()
      await firstCard.click()
      await expect(page).toHaveURL(/\/edit\//)

      await archivePost(page)
      await waitForNavigation(page, '/')

      await expect(page.locator('[data-testid="stat-drafts"]')).toHaveText('1')

      // Now go to archived posts and delete
      await page.goto('/posts')
      await page.getByRole('button', { name: /archived/i }).click()

      const archivedCard = page.locator('a[href^="/edit/"]').first()
      await archivedCard.click()
      await expect(page).toHaveURL(/\/edit\//)

      // Delete the post
      const deleteBtn = page.getByRole('button', { name: /delete/i })
      await deleteBtn.click()
      const dialog = page.getByRole('alertdialog')
      const dialogVisible = await dialog.isVisible().catch(() => false)
      if (dialogVisible) {
        await dialog.getByRole('button', { name: /delete/i }).click()
      }

      await expect(page).toHaveURL('/dashboard')
    })

    test('should decrement count when post is archived', async ({ page }) => {
      await createTestPost(page, { platform: 'twitter', content: 'Post to keep', asDraft: false })
      await createTestPost(page, {
        platform: 'linkedin',
        content: 'Post to archive',
        asDraft: false,
      })

      await gotoDashboard(page)
      await expect(page.locator('[data-testid="stat-scheduled"]')).toHaveText('2')

      await page.goto('/posts')
      await page.getByRole('button', { name: /scheduled/i }).click()

      const firstCard = page.locator('a[href^="/edit/"]').first()
      await firstCard.click()
      await expect(page).toHaveURL(/\/edit\//)

      await archivePost(page)
      await waitForNavigation(page, '/')

      await expect(page.locator('[data-testid="stat-scheduled"]')).toHaveText('1')
    })
  })

  // Empty state tests need serial execution to ensure no posts exist
  test.describe.serial('Empty State', () => {
    test('should show welcome message when no posts exist', async ({ page }) => {
      await expect(
        page.getByRole('heading', { name: /welcome to bullhorn/i }).first()
      ).toBeVisible()
      await expect(page.getByText('Create your first post to get started')).toBeVisible()
    })

    test('should have create first post button', async ({ page }) => {
      const createBtn = page.getByRole('link', { name: /create your first post/i })
      await expect(createBtn).toBeVisible()

      await createBtn.click()
      await expect(page).toHaveURL('/new')
    })

    test('should hide empty state when posts exist', async ({ page }) => {
      await createTestPost(page, { platform: 'twitter', content: 'Test post', asDraft: true })
      await gotoDashboard(page)

      await expect(
        page.getByRole('heading', { name: /welcome to bullhorn/i }).first()
      ).not.toBeVisible()
    })
  })

  // Upcoming tests need serial execution to check empty/non-empty states
  test.describe.serial('Upcoming Section', () => {
    test('should show upcoming posts section when scheduled posts exist', async ({ page }) => {
      await createTestPost(page, {
        platform: 'twitter',
        content: 'Upcoming post',
        asDraft: false,
      })
      await gotoDashboard(page)

      await expect(page.getByRole('heading', { name: /upcoming/i }).first()).toBeVisible()
    })

    test('should show empty state when no scheduled posts', async ({ page }) => {
      await createTestPost(page, {
        platform: 'twitter',
        content: 'Just a draft',
        asDraft: true,
      })
      await gotoDashboard(page)

      await expect(page.getByText(/no posts scheduled/i)).toBeVisible()
    })
  })

  // Drafts tests need serial execution to check empty/non-empty states
  test.describe.serial('Drafts Section', () => {
    test('should show drafts section when drafts exist', async ({ page }) => {
      await createTestPost(page, { platform: 'twitter', content: 'My draft', asDraft: true })
      await gotoDashboard(page)

      await expect(page.getByRole('heading', { name: /drafts/i })).toBeVisible()
    })

    test('should show empty state when no drafts', async ({ page }) => {
      await createTestPost(page, {
        platform: 'twitter',
        content: 'Scheduled only',
        asDraft: false,
      })
      await gotoDashboard(page)

      await expect(page.getByText(/no drafts/i)).toBeVisible()
    })

    test('should display draft content preview', async ({ page }) => {
      const content = 'This is my draft post content for testing'
      await createTestPost(page, { platform: 'twitter', content, asDraft: true })
      await gotoDashboard(page)

      await expect(page.getByText(content)).toBeVisible()
    })
  })
})
