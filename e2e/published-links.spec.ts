import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  goToNewPost,
  selectPlatform,
  fillContent,
  fillRedditFields,
  saveDraft,
  waitForNavigation,
  clickPost,
  getAllPosts,
  getTwitterContent,
  getLinkedInContent,
  getRedditContent,
} from './helpers'

test.describe('Published Links', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test.describe('UI Display', () => {
    test('should show Published Links section when a platform is selected', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      // Published Links button should be visible
      await expect(page.getByRole('button', { name: /published links/i })).toBeVisible()
    })

    test('should expand Published Links section when clicked', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      // Click to expand
      await page.getByRole('button', { name: /published links/i }).click()

      // Should show Twitter input field
      await expect(page.getByPlaceholder('https://twitter.com/user/status/...')).toBeVisible()
    })

    test('should show correct platform field when switching platforms', async ({ page }) => {
      await goToNewPost(page)

      // Select Twitter
      await selectPlatform(page, 'twitter')
      await page.getByRole('button', { name: /published links/i }).click()
      await expect(page.getByPlaceholder('https://twitter.com/user/status/...')).toBeVisible()
      await expect(page.getByPlaceholder('https://linkedin.com/posts/...')).not.toBeVisible()

      // Switch to LinkedIn
      await selectPlatform(page, 'linkedin')
      await expect(page.getByPlaceholder('https://linkedin.com/posts/...')).toBeVisible()
      await expect(page.getByPlaceholder('https://twitter.com/user/status/...')).not.toBeVisible()
    })
  })

  test.describe('Twitter Launched URL', () => {
    test('should save Twitter launched URL', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Test post with launched URL')

      // Expand Published Links and add URL
      await page.getByRole('button', { name: /published links/i }).click()
      const twitterUrl = 'https://twitter.com/user/status/123456789'
      await page.getByPlaceholder('https://twitter.com/user/status/...').fill(twitterUrl)

      // Save draft
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify in database
      const posts = await getAllPosts(page)
      expect(posts.length).toBe(1)
      expect(getTwitterContent(posts[0])?.launchedUrl).toBe(twitterUrl)
    })

    test('should persist Twitter launched URL on reload', async ({ page }) => {
      // Create post with launched URL
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Twitter persistence test')
      await page.getByRole('button', { name: /published links/i }).click()
      const twitterUrl = 'https://twitter.com/user/status/987654321'
      await page.getByPlaceholder('https://twitter.com/user/status/...').fill(twitterUrl)
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Click on the post to edit
      await clickPost(page, 0)

      // Wait for editor to load, then check Published Links input
      await expect(page.locator('textarea').first()).not.toHaveValue('', { timeout: 15000 })
      await expect(page.getByPlaceholder('https://twitter.com/user/status/...')).toHaveValue(
        twitterUrl,
        { timeout: 15000 }
      )
    })
  })

  test.describe('LinkedIn Launched URL', () => {
    test('should save LinkedIn launched URL', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'linkedin')
      await fillContent(page, 'LinkedIn post with launched URL')

      // Expand Published Links and add URL
      await page.getByRole('button', { name: /published links/i }).click()
      const linkedInUrl = 'https://linkedin.com/posts/user_activity-123456789'
      await page.getByPlaceholder('https://linkedin.com/posts/...').fill(linkedInUrl)

      // Save draft
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify in database
      const posts = await getAllPosts(page)
      expect(posts.length).toBe(1)
      expect(getLinkedInContent(posts[0])?.launchedUrl).toBe(linkedInUrl)
    })

    test('should persist LinkedIn launched URL on reload', async ({ page }) => {
      // Create post with launched URL
      await goToNewPost(page)
      await selectPlatform(page, 'linkedin')
      await fillContent(page, 'LinkedIn persistence test')
      await page.getByRole('button', { name: /published links/i }).click()
      const linkedInUrl = 'https://linkedin.com/posts/user_activity-111222333'
      await page.getByPlaceholder('https://linkedin.com/posts/...').fill(linkedInUrl)
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Click on the post to edit
      await clickPost(page, 0)

      // Wait for editor to load, then check Published Links input
      await expect(page.locator('textarea').first()).not.toHaveValue('', { timeout: 15000 })
      await expect(page.getByPlaceholder('https://linkedin.com/posts/...')).toHaveValue(
        linkedInUrl,
        { timeout: 15000 }
      )
    })
  })

  test.describe('Reddit Launched URLs', () => {
    test('should show URL field for Reddit post', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      // Add subreddit
      await fillRedditFields(page, {
        subreddit: 'programming',
        title: 'Test Reddit post',
      })

      // Expand Published Links
      await page.getByRole('button', { name: /published links/i }).click()

      // Should show Reddit URL input field
      await expect(page.getByPlaceholder('https://reddit.com/r/...')).toBeVisible()
    })

    test('should save Reddit launched URL', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')
      await fillRedditFields(page, {
        subreddit: 'javascript',
        title: 'JavaScript Tips',
      })
      await fillContent(page, 'Some helpful tips')

      // Expand Published Links and add URL
      await page.getByRole('button', { name: /published links/i }).click()
      const redditUrl = 'https://reddit.com/r/javascript/comments/abc123'
      await page.getByPlaceholder('https://reddit.com/r/...').fill(redditUrl)

      // Save draft
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify in database
      const posts = await getAllPosts(page)
      expect(posts.length).toBe(1)
      expect(getRedditContent(posts[0])?.launchedUrl).toBe(redditUrl)
    })

    test('should persist Reddit launched URL on reload', async ({ page }) => {
      // Create post with launched URL
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')
      await fillRedditFields(page, {
        subreddit: 'reactjs',
        title: 'React tips',
      })
      await fillContent(page, 'Some React tips')
      await page.getByRole('button', { name: /published links/i }).click()
      const reactUrl = 'https://reddit.com/r/reactjs/comments/xyz789'
      await page.getByPlaceholder('https://reddit.com/r/...').fill(reactUrl)
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Click on the post to edit
      await clickPost(page, 0)

      // Wait for editor to load, then check Published Links input
      await expect(page.locator('textarea').first()).not.toHaveValue('', { timeout: 15000 })
      await expect(page.getByPlaceholder('https://reddit.com/r/...')).toHaveValue(reactUrl, {
        timeout: 15000,
      })
    })
  })

  test.describe('Auto-expand behavior', () => {
    test('should auto-expand Published Links when loading post with URLs', async ({ page }) => {
      // Create post with launched URL
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Auto-expand test')
      await page.getByRole('button', { name: /published links/i }).click()
      await page
        .getByPlaceholder('https://twitter.com/user/status/...')
        .fill('https://twitter.com/autoexpand')
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Navigate to edit
      await clickPost(page, 0)

      // Wait for editor to load, then check Published Links auto-expanded
      await expect(page.locator('textarea').first()).not.toHaveValue('', { timeout: 15000 })
      await expect(page.getByPlaceholder('https://twitter.com/user/status/...')).toBeVisible({
        timeout: 15000,
      })
    })
  })
})
