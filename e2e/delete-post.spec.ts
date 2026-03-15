import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  deletePost,
  archivePost,
  waitForNavigation,
  getPostCards,
  createTestPost,
  filterByStatus,
  generateTestId,
  uniqueContent,
} from './helpers'

// Delete tests need serial execution to avoid interference
// eslint-disable-next-line max-lines-per-function
test.describe.serial('Delete Post', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

   
  test('should permanently delete an archived post from editor', async ({ page }, testInfo) => {
    const testId = generateTestId(testInfo)
    const content = uniqueContent('Post to delete', testId)
    // Create a post first
    await createTestPost(page, { platform: 'twitter', content })

    // Go to posts and archive the post
    await page.goto('/posts')
    const cards = await getPostCards(page)
    await cards.first().click()
    await archivePost(page)

    // Navigate to archived posts
    await page.goto('/posts')
    await filterByStatus(page, 'archived')
    const archivedCards = await getPostCards(page)
    await archivedCards.first().click()

    // Delete the archived post
    await deletePost(page)

    // Should navigate back to dashboard
    await waitForNavigation(page, '/')
  })

   
  test('should delete a scheduled post after archiving', async ({ page }, testInfo) => {
    const testId = generateTestId(testInfo)
    const content = uniqueContent('Scheduled post to delete', testId)
    // Create a scheduled post
    await createTestPost(page, {
      platform: 'twitter',
      content,
      asDraft: false,
    })

    // Go to posts and archive it
    await page.goto('/posts')
    const cards = await getPostCards(page)
    await cards.first().click()
    await archivePost(page)

    // Navigate to archived and delete permanently
    await page.goto('/posts')
    await filterByStatus(page, 'archived')
    const archivedCards = await getPostCards(page)
    await archivedCards.first().click()

    // Delete the post
    await deletePost(page)

    // Should navigate back to dashboard
    await waitForNavigation(page, '/')
  })

   
  test('should cancel delete when declining confirmation on archived post', async ({ page }) => {
    // Create and archive a post
    await createTestPost(page, { platform: 'twitter', content: 'Post to keep' })
    await page.goto('/posts')
    const cards = await getPostCards(page)
    await cards.first().click()
    await archivePost(page)

    // Navigate to archived
    await page.goto('/posts')
    await filterByStatus(page, 'archived')
    const archivedCards = await getPostCards(page)
    await archivedCards.first().click()

    // Click delete to open modal
    await page.getByRole('button', { name: /delete/i }).click()

    // Wait for modal and click Keep (cancel button)
    await page.getByRole('alertdialog').waitFor()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Keep' }).click()

    // Wait for dialog to dismiss before checking page state
    await expect(page.getByRole('alertdialog')).not.toBeVisible({ timeout: 10000 })

    // Should still be on the edit page
    await expect(page.getByRole('heading', { name: /edit post/i })).toBeVisible()
  })

   
  test('should show delete button only on archived posts', async ({ page }) => {
    // Create and archive a post
    await createTestPost(page, { platform: 'twitter', content: 'Test post' })
    await page.goto('/posts')
    const cards = await getPostCards(page)
    await cards.first().click()

    // Should NOT see delete button on non-archived post
    await expect(page.getByRole('button', { name: /delete/i })).not.toBeVisible()

    // Archive the post
    await archivePost(page)

    // Navigate to archived
    await page.goto('/posts')
    await filterByStatus(page, 'archived')
    const archivedCards = await getPostCards(page)
    await archivedCards.first().click()

    // Should see delete button on archived post
    await expect(page.getByRole('button', { name: /delete/i })).toBeVisible()
  })

   
  test('should not show delete button on new post page', async ({ page }) => {
    await page.goto('/new')

    const deleteBtn = page.getByRole('button', { name: /delete/i })
    await expect(deleteBtn).not.toBeVisible()
  })

   
  test('should show confirmation dialog before delete', async ({ page }) => {
    // Create and archive a post
    await createTestPost(page, { platform: 'twitter', content: 'Test post' })
    await page.goto('/posts')
    const cards = await getPostCards(page)
    await cards.first().click()
    await archivePost(page)

    // Navigate to archived
    await page.goto('/posts')
    await filterByStatus(page, 'archived')
    const archivedCards = await getPostCards(page)
    await archivedCards.first().click()

    // Click delete to open modal
    await page.getByRole('button', { name: /delete/i }).click()

    // Modal dialog should appear with title and description
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Delete this post?')).toBeVisible()
    await expect(dialog.getByText('This action cannot be undone')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Delete' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Keep' })).toBeVisible()
  })
})
