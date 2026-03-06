import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  createTestPost,
  goToPosts,
  getPostCards,
  archivePost,
  restorePost,
  filterByStatus,
  deletePost,
  generateTestId,
  uniqueContent,
} from './helpers'

test.describe('Archive Post', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should archive a draft post from editor', async ({ page }, testInfo) => {
    const testId = generateTestId(testInfo)
    // Create a test post
    await createTestPost(page, {
      platform: 'twitter',
      content: uniqueContent('Post to archive', testId),
    })

    // Navigate to posts and click on it
    await goToPosts(page)
    const cards = await getPostCards(page)
    await cards.first().click()

    // Archive the post
    await archivePost(page)

    // Should navigate back to dashboard (archivePost now waits for URL)
    await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 15000 })
  })

  test('should show archived posts in archived filter', async ({ page }, testInfo) => {
    const testId = generateTestId(testInfo)
    const content = uniqueContent('Archived post content', testId)
    // Create and archive a post
    await createTestPost(page, { platform: 'twitter', content })
    await goToPosts(page)
    const cards = await getPostCards(page)
    await cards.first().click()
    await archivePost(page)

    // Go to posts list and filter by archived
    await goToPosts(page)
    await filterByStatus(page, 'archived')

    // Should see the archived post
    await expect(page.getByText(content)).toBeVisible()
  })

  test('should hide archived posts from All view', async ({ page }, testInfo) => {
    const testId = generateTestId(testInfo)
    const visibleContent = uniqueContent('Visible post', testId)
    const hiddenContent = uniqueContent('Hidden archived post', testId)
    // Create two posts
    await createTestPost(page, { platform: 'twitter', content: visibleContent })
    await createTestPost(page, { platform: 'twitter', content: hiddenContent })

    // Archive the second post
    await goToPosts(page)
    const cards = await getPostCards(page)
    await cards.first().click() // Click the most recent (second) post
    await archivePost(page)

    // Check All view - should only see the visible post
    await goToPosts(page)
    await expect(page.getByText(visibleContent)).toBeVisible()
    await expect(page.getByText(hiddenContent)).not.toBeVisible()
  })

  test('should restore archived post to drafts', async ({ page }, testInfo) => {
    const testId = generateTestId(testInfo)
    const content = uniqueContent('Post to restore', testId)
    // Create and archive a post
    await createTestPost(page, { platform: 'twitter', content })
    await goToPosts(page)
    let cards = await getPostCards(page)
    await cards.first().click()
    await archivePost(page)

    // Navigate to archived and restore
    await goToPosts(page)
    await filterByStatus(page, 'archived')
    cards = await getPostCards(page)
    await cards.first().click()

    // Click restore
    await restorePost(page)

    // Should navigate back to dashboard (restorePost now waits for URL)
    await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 15000 })

    // Verify restored to drafts
    await goToPosts(page)
    await filterByStatus(page, 'draft')
    await expect(page.getByText(content)).toBeVisible()
  })

  test('should permanently delete archived post', async ({ page }, testInfo) => {
    const testId = generateTestId(testInfo)
    const content = uniqueContent('Post to delete forever', testId)
    // Create and archive a post
    await createTestPost(page, { platform: 'twitter', content })
    await goToPosts(page)
    let cards = await getPostCards(page)
    await cards.first().click()
    await archivePost(page)

    // Go to archived and delete permanently
    await goToPosts(page)
    await filterByStatus(page, 'archived')
    cards = await getPostCards(page)
    await cards.first().click()

    // Delete the archived post
    await deletePost(page)

    // Should navigate back
    await expect(page).toHaveURL(/\/(dashboard)?$/, { timeout: 15000 })

    // Verify gone - archived tab should be hidden since no archived posts remain
    await goToPosts(page)
    // The archived tab is hidden when there are no archived posts
    await expect(page.getByRole('button', { name: /archived/i })).not.toBeVisible()
  })

  test('should cancel archive confirmation', async ({ page }, testInfo) => {
    const testId = generateTestId(testInfo)
    const content = uniqueContent('Post to keep', testId)
    // Create a test post
    await createTestPost(page, { platform: 'twitter', content })
    await goToPosts(page)
    const cards = await getPostCards(page)
    await cards.first().click()

    // Click archive button
    await page.getByRole('button', { name: /archive/i }).click()

    // Wait for dialog and click Cancel
    await page.getByRole('alertdialog').waitFor()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()

    // Should still be on the edit page
    await expect(page.getByRole('heading', { name: /edit post/i })).toBeVisible()

    // Post should still exist in drafts
    await goToPosts(page)
    await filterByStatus(page, 'draft')
    await expect(page.getByText(content)).toBeVisible()
  })

  test('should show restore button only for archived posts', async ({ page }, testInfo) => {
    const testId = generateTestId(testInfo)
    const content = uniqueContent('Draft post', testId)
    // Create a draft post
    await createTestPost(page, { platform: 'twitter', content })
    await goToPosts(page)
    const cards = await getPostCards(page)
    await cards.first().click()

    // Should see Archive button, not Restore
    await expect(page.getByRole('button', { name: /archive/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /restore/i })).not.toBeVisible()
  })

  test('should hide archived tab when no archived posts', async ({ page }, testInfo) => {
    const testId = generateTestId(testInfo)
    const content = uniqueContent('Regular post', testId)
    // Create a post but don't archive it
    await createTestPost(page, { platform: 'twitter', content })

    // Go to posts
    await goToPosts(page)

    // Archived tab should not be visible when count is 0
    await expect(page.getByRole('button', { name: /archived/i })).not.toBeVisible()
  })

  test('should show archived tab when archived posts exist', async ({ page }, testInfo) => {
    const testId = generateTestId(testInfo)
    const content = uniqueContent('To be archived', testId)
    // Create and archive a post
    await createTestPost(page, { platform: 'twitter', content })
    await goToPosts(page)
    const cards = await getPostCards(page)
    await cards.first().click()
    await archivePost(page)

    // Go to posts
    await goToPosts(page)

    // Archived tab should now be visible
    await expect(page.getByRole('button', { name: /archived/i })).toBeVisible()
  })
})
