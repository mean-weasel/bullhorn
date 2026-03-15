import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  fillContent,
  fillRedditFields,
  setSchedule,
  getPostCount,
  getAllPosts,
  getPostById,
  createTestPost,
  archivePost,
  deletePost,
  filterByStatus,
  getPostCards,
  switchPlatformWithConfirm,
  waitForContentToLoad,
} from './helpers'

/**
 * These tests verify database state after each operation,
 * ensuring only expected posts exist and no duplicates are created.
 */
// eslint-disable-next-line max-lines-per-function
test.describe('Database State Verification', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  // eslint-disable-next-line max-lines-per-function
  test.describe.serial('Create Operations', () => {
     
    test('should create exactly one Twitter draft', async ({ page }) => {
      expect(await getPostCount(page)).toBe(0)

      await page.goto('/new')
      await page.getByRole('button', { name: 'Twitter' }).click()
      await fillContent(page, 'Twitter draft content')
      await page.getByRole('button', { name: /save draft/i }).click()
      await expect(page).toHaveURL('/dashboard', { timeout: 30000 })

      // Verify exactly 1 post in database
      expect(await getPostCount(page)).toBe(1)

      const posts = await getAllPosts(page)
      expect(posts[0].status).toBe('draft')
      expect(posts[0].platform).toBe('twitter')
      expect(posts[0].content).toMatchObject({ text: 'Twitter draft content' })
    })

     
    test('should create exactly one LinkedIn draft', async ({ page }) => {
      expect(await getPostCount(page)).toBe(0)

      await page.goto('/new')
      await page.getByRole('button', { name: 'LinkedIn' }).click()
      await fillContent(page, 'LinkedIn draft content')
      await page.getByRole('button', { name: /save draft/i }).click()
      await expect(page).toHaveURL('/dashboard', { timeout: 30000 })

      expect(await getPostCount(page)).toBe(1)

      const posts = await getAllPosts(page)
      expect(posts[0].platform).toBe('linkedin')
      expect(posts[0].content).toMatchObject({ text: 'LinkedIn draft content' })
    })

     
    test('should create exactly one Reddit draft with metadata', async ({ page }) => {
      expect(await getPostCount(page)).toBe(0)

      await page.goto('/new')
      await page.getByRole('button', { name: 'Reddit' }).click()
      await fillContent(page, 'Reddit draft content')
      await fillRedditFields(page, { subreddit: 'test', title: 'Test Title' })
      await page.getByRole('button', { name: /save draft/i }).click()
      await expect(page).toHaveURL('/dashboard', { timeout: 30000 })

      expect(await getPostCount(page)).toBe(1)

      const posts = await getAllPosts(page)
      expect(posts[0].platform).toBe('reddit')
      expect(posts[0].content).toMatchObject({
        body: 'Reddit draft content',
        title: 'Test Title',
      })
    })

     
    test('should create exactly one scheduled post', async ({ page }) => {
      expect(await getPostCount(page)).toBe(0)

      await page.goto('/new')
      await page.getByRole('button', { name: 'Twitter' }).click()
      await fillContent(page, 'Scheduled post content')

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      await setSchedule(page, tomorrow)

      await page.getByRole('button', { name: /^schedule$/i }).click()
      await expect(page).toHaveURL('/dashboard', { timeout: 30000 })

      expect(await getPostCount(page)).toBe(1)

      const posts = await getAllPosts(page)
      expect(posts[0].status).toBe('scheduled')
      expect(posts[0].scheduledAt).toBeTruthy()
    })
  })

  // eslint-disable-next-line max-lines-per-function
  test.describe.serial('Edit Operations', () => {
     
    test('should update content without creating duplicates', async ({ page }) => {
      // Create a post first
      await createTestPost(page, { platform: 'twitter', content: 'Original content' })
      expect(await getPostCount(page)).toBe(1)

      const originalPosts = await getAllPosts(page)
      const postId = originalPosts[0].id

      // Edit the post
      await page.goto(`/edit/${postId}`)
      await waitForContentToLoad(page, 'Original content')
      await fillContent(page, 'Updated content')
      // Verify React processed the content change before saving
      await expect(page.locator('textarea').first()).toHaveValue('Updated content')
      await page.getByRole('button', { name: /save draft/i }).click()
      await expect(page).toHaveURL('/dashboard', { timeout: 30000 })

      // Should still have exactly 1 post
      expect(await getPostCount(page)).toBe(1)

      const updatedPost = await getPostById(page, postId)
      expect(updatedPost?.content).toMatchObject({ text: 'Updated content' })
    })

     
    test('should switch platform without creating duplicates', async ({ page }) => {
      await createTestPost(page, { platform: 'twitter', content: 'Platform test' })
      expect(await getPostCount(page)).toBe(1)

      const posts = await getAllPosts(page)
      const postId = posts[0].id
      expect(posts[0].platform).toBe('twitter')

      // Edit and switch platform (with confirmation dialog)
      await page.goto(`/edit/${postId}`)
      await waitForContentToLoad(page, 'Platform test')
      await switchPlatformWithConfirm(page, 'linkedin')
      await page.getByRole('button', { name: /save draft/i }).click()
      await expect(page).toHaveURL('/dashboard', { timeout: 30000 })

      // Should still have exactly 1 post
      expect(await getPostCount(page)).toBe(1)

      const updatedPost = await getPostById(page, postId)
      expect(updatedPost?.platform).toBe('linkedin')
    })

     
    test('should convert draft to scheduled without creating duplicates', async ({ page }) => {
      await createTestPost(page, {
        platform: 'twitter',
        content: 'Draft to schedule',
        asDraft: true,
      })
      expect(await getPostCount(page)).toBe(1)

      const posts = await getAllPosts(page)
      const postId = posts[0].id
      expect(posts[0].status).toBe('draft')

      // Edit and add schedule
      await page.goto(`/edit/${postId}`)
      await waitForContentToLoad(page, 'Draft to schedule')
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      await setSchedule(page, tomorrow)
      await page.getByRole('button', { name: /^schedule$/i }).click()
      await expect(page).toHaveURL('/dashboard', { timeout: 30000 })

      // Should still have exactly 1 post
      expect(await getPostCount(page)).toBe(1)

      const updatedPost = await getPostById(page, postId)
      expect(updatedPost?.status).toBe('scheduled')
      expect(updatedPost?.scheduledAt).toBeTruthy()
    })
  })

   
  test.describe.serial('Delete Operations', () => {
     
    test('should remove post from database after deletion', async ({ page }) => {
      // Create and archive a post (required before deletion)
      await createTestPost(page, { platform: 'twitter', content: 'Post to delete' })
      expect(await getPostCount(page)).toBe(1)

      await page.goto('/posts')
      const cards = await getPostCards(page)
      await cards.first().click()
      await archivePost(page)

      // Navigate to archived and delete
      await page.goto('/posts')
      await filterByStatus(page, 'archived')
      const archivedCards = await getPostCards(page)
      await archivedCards.first().click()
      await deletePost(page)

      // Database should be empty
      expect(await getPostCount(page)).toBe(0)
    })

     
    test('should delete one post and leave others intact', async ({ page }) => {
      // Create two posts
      await createTestPost(page, { platform: 'twitter', content: 'Post to keep' })
      await createTestPost(page, { platform: 'linkedin', content: 'Post to delete' })
      expect(await getPostCount(page)).toBe(2)

      const posts = await getAllPosts(page)
      const postToKeepId = posts.find((p) => p.platform === 'twitter')?.id
      const postToDeleteId = posts.find((p) => p.platform === 'linkedin')?.id

      // Archive the LinkedIn post
      await page.goto(`/edit/${postToDeleteId}`)
      await waitForContentToLoad(page, 'Post to delete')
      await archivePost(page)

      // Delete the archived post
      await page.goto('/posts')
      await filterByStatus(page, 'archived')
      const archivedCards = await getPostCards(page)
      await archivedCards.first().click()
      await deletePost(page)

      // Should have exactly 1 post remaining
      expect(await getPostCount(page)).toBe(1)

      // The kept post should still exist
      const remainingPost = await getPostById(page, postToKeepId!)
      expect(remainingPost).toBeTruthy()
      expect(remainingPost?.platform).toBe('twitter')
    })
  })

   
  test.describe.serial('Archive Operations', () => {
     
    test('should archive post without creating duplicates', async ({ page }) => {
      await createTestPost(page, { platform: 'twitter', content: 'Post to archive' })
      expect(await getPostCount(page)).toBe(1)

      const posts = await getAllPosts(page)
      const postId = posts[0].id

      // Archive the post
      await page.goto(`/edit/${postId}`)
      await waitForContentToLoad(page, 'Post to archive')
      await archivePost(page)

      // Should still have exactly 1 post
      expect(await getPostCount(page)).toBe(1)

      const archivedPost = await getPostById(page, postId)
      expect(archivedPost?.status).toBe('archived')
    })

     
    test('should restore post without creating duplicates', async ({ page }) => {
      await createTestPost(page, { platform: 'twitter', content: 'Post to restore' })
      expect(await getPostCount(page)).toBe(1)

      const posts = await getAllPosts(page)
      const postId = posts[0].id

      // Archive the post
      await page.goto(`/edit/${postId}`)
      await waitForContentToLoad(page, 'Post to restore')
      await archivePost(page)

      // Restore the post
      await page.goto('/posts')
      await filterByStatus(page, 'archived')
      const archivedCards = await getPostCards(page)
      await archivedCards.first().click()
      const restoreResponse = page.waitForResponse(
        (resp) => resp.url().includes('/restore') && resp.request().method() === 'POST',
        { timeout: 60000 }
      )
      await page.getByRole('button', { name: /restore/i }).click()
      await restoreResponse

      // Should still have exactly 1 post
      expect(await getPostCount(page)).toBe(1)

      const restoredPost = await getPostById(page, postId)
      expect(restoredPost?.status).toBe('draft')
    })
  })
})
