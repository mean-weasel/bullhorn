import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  enterDemoMode,
  goToNewPost,
  selectPlatform,
  fillContent,
  fillRedditFields,
  saveDraft,
  waitForNavigation,
  goToPosts,
  clickPost,
} from './helpers'

// Path to test fixtures (ES module compatible)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TEST_IMAGE_PATH = path.join(__dirname, 'fixtures', 'test-image.png')

// eslint-disable-next-line max-lines-per-function
test.describe('Media Features', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  // eslint-disable-next-line max-lines-per-function
  test.describe('Twitter Media Upload', () => {
     
    test('should show media button when Twitter is selected', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      // Media button should be visible
      const mediaButton = page.locator('button[title="Add media (images/videos)"]')
      await expect(mediaButton).toBeVisible()
    })

     
    test('should open media input section when clicking media button', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      // Click media button
      await page.locator('button[title="Add media (images/videos)"]').click()

      // Media section should be visible
      await expect(page.getByText('Media Attachments')).toBeVisible()
      await expect(page.getByText('Twitter (up to 4 images or 1 video)')).toBeVisible()
    })

     
    test('should show drag and drop upload zone for Twitter', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      // Open media section
      await page.locator('button[title="Add media (images/videos)"]').click()

      // Drag and drop zone should be visible
      await expect(page.getByText('Drag & drop or click to upload')).toBeVisible()
    })

     
    test('should upload a media file for Twitter', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Check out this image!')

      // Open media section
      await page.locator('button[title="Add media (images/videos)"]').click()

      // Find the file input and upload
      const fileInput = page.locator('input[type="file"]').first()
      await fileInput.setInputFiles(TEST_IMAGE_PATH)

      // Wait for upload to complete - look for the preview image
      await expect(page.locator('img[alt="Media 1"]').first()).toBeVisible({ timeout: 20000 })

      // Save and verify
      await saveDraft(page)
      await waitForNavigation(page, '/')
    })

     
    test('should show media count badge on media button', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Post with media')

      // Open media section and upload file
      await page.locator('button[title="Add media (images/videos)"]').click()
      const fileInput = page.locator('input[type="file"]').first()
      await fileInput.setInputFiles(TEST_IMAGE_PATH)

      // Wait for upload to complete
      await expect(page.locator('img[alt="Media 1"]').first()).toBeVisible({ timeout: 20000 })

      // Close media section
      await page.locator('button[title="Add media (images/videos)"]').click()

      // Media button should show count
      const mediaButton = page.locator('button[title="Add media (images/videos)"]')
      await expect(mediaButton).toContainText('1')
    })

     
    test('should remove media when clicking remove button', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      // Open media section and upload file
      await page.locator('button[title="Add media (images/videos)"]').click()
      const fileInput = page.locator('input[type="file"]').first()
      await fileInput.setInputFiles(TEST_IMAGE_PATH)

      // Wait for upload to complete
      const mediaPreview = page.locator('img[alt="Media 1"]').first()
      await expect(mediaPreview).toBeVisible({ timeout: 20000 })

      // Hover over image and click remove
      const mediaItem = page.locator('.relative.group').first()
      await mediaItem.hover()
      await mediaItem.locator('button').click()

      // Image should be removed
      await expect(mediaPreview).not.toBeVisible()
    })

     
    test('should show media in Twitter preview panel', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Post with preview')

      // Open media section and upload file
      await page.locator('button[title="Add media (images/videos)"]').click()
      const fileInput = page.locator('input[type="file"]').first()
      await fileInput.setInputFiles(TEST_IMAGE_PATH)

      // Wait for upload to complete
      await expect(page.locator('img[alt="Media 1"]').first()).toBeVisible({ timeout: 20000 })

      // Check preview panel shows media (in the preview area with dark background)
      const previewPanel = page.locator('[data-testid="preview-panel"]')
      await expect(previewPanel.locator('img[alt="Media 1"]')).toBeVisible()
    })
  })

   
  test.describe('LinkedIn Media Upload', () => {
     
    test('should show LinkedIn media input when LinkedIn is selected', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'linkedin')

      // Open media section
      await page.locator('button[title="Add media (images/videos)"]').click()

      // LinkedIn media section should be visible
      await expect(page.getByText('LinkedIn (1 image or video)')).toBeVisible()
    })

     
    test('should upload a media file for LinkedIn', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'linkedin')
      await fillContent(page, 'Professional post with image')

      // Open media section
      await page.locator('button[title="Add media (images/videos)"]').click()

      // Upload file (LinkedIn is the second upload zone if both are visible)
      const fileInput = page.locator('input[type="file"]').first()
      await fileInput.setInputFiles(TEST_IMAGE_PATH)

      // Wait for upload to complete
      await expect(page.locator('img[alt="Media 1"]').first()).toBeVisible({ timeout: 20000 })

      // Save
      await saveDraft(page)
      await waitForNavigation(page, '/')
    })

     
    test('should show LinkedIn media in preview panel', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'linkedin')
      await fillContent(page, 'Post for LinkedIn')

      // Open media section and upload file
      await page.locator('button[title="Add media (images/videos)"]').click()
      const fileInput = page.locator('input[type="file"]').first()
      await fileInput.setInputFiles(TEST_IMAGE_PATH)

      // Wait for upload to complete
      await expect(page.locator('img[alt="Media 1"]').first()).toBeVisible({ timeout: 20000 })

      // Check preview panel shows media
      const previewPanel = page.locator('[data-testid="preview-panel"]')
      await expect(previewPanel.locator('img[alt="LinkedIn media"]')).toBeVisible()
    })
  })

  // eslint-disable-next-line max-lines-per-function
  test.describe('Reddit Link Posts', () => {
     
    test('should show link URL field for Reddit', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      // Link URL field should be visible
      await expect(page.getByText('Link URL (optional)')).toBeVisible()
      await expect(page.locator('input[placeholder*="youtube.com"]')).toBeVisible()
    })

     
    test('should create a Reddit link post', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddit: 'videos',
        title: 'Check out this cool video!',
      })

      // Add link URL
      const videoUrl = 'https://youtube.com/watch?v=dQw4w9WgXcQ'
      await page.locator('input[placeholder*="youtube.com"]').fill(videoUrl)

      await fillContent(page, 'Found this great video, thought you might enjoy it!')

      await saveDraft(page)
      await waitForNavigation(page, '/')
    })

     
    test('should show link indicator in Reddit preview', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddit: 'programming',
        title: 'Interesting article',
      })

      // Add link URL
      await page.locator('input[placeholder*="youtube.com"]').fill('https://example.com/article')

      // Preview should show "(Link Post)" indicator
      const previewPanel = page.locator('[data-testid="preview-panel"]')
      await expect(previewPanel.getByText('(Link Post)')).toBeVisible()
    })

     
    test('should show text post indicator when no URL', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddit: 'AskReddit',
        title: 'What is your favorite color?',
      })

      // Don't add link URL - it's a text post
      await fillContent(page, 'Just curious what everyone thinks!')

      // Preview should show "(Text Post)" indicator
      const previewPanel = page.locator('[data-testid="preview-panel"]')
      await expect(previewPanel.getByText('(Text Post)')).toBeVisible()
    })

     
    test('should show link URL in Reddit preview', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddit: 'videos',
        title: 'Great video',
      })

      const videoUrl = 'https://youtube.com/watch?v=abc123'
      await page.locator('input[placeholder*="youtube.com"]').fill(videoUrl)

      // Preview should show the link
      const previewPanel = page.locator('[data-testid="preview-panel"]')
      await expect(previewPanel.getByText(videoUrl)).toBeVisible()
    })
  })

   
  test.describe('Media Persistence', () => {
     
    test('should persist media when editing post', async ({ page }) => {
      // Create a post with media
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Post with media to edit')

      // Add media
      await page.locator('button[title="Add media (images/videos)"]').click()
      const fileInput = page.locator('input[type="file"]').first()
      await fileInput.setInputFiles(TEST_IMAGE_PATH)

      // Wait for upload to complete
      await expect(page.locator('img[alt="Media 1"]').first()).toBeVisible({ timeout: 20000 })

      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Go to posts and edit
      await goToPosts(page)
      await clickPost(page, 0)

      // Open media section - should show existing media
      await page.locator('button[title="Add media (images/videos)"]').click()
      await expect(page.locator('img[alt="Media 1"]').first()).toBeVisible()
    })
  })

   
  test.describe('File Validation', () => {
     
    test('should show upload zone in media section', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      // Open media section
      await page.locator('button[title="Add media (images/videos)"]').click()

      // The upload zone should be visible
      await expect(page.getByText('Drag & drop or click to upload')).toBeVisible()

      // File input should exist
      await expect(page.locator('input[type="file"]').first()).toBeAttached()
    })
  })

  // eslint-disable-next-line max-lines-per-function
  test.describe('Multiple File Uploads', () => {
     
    test('should allow uploading up to 4 images for Twitter', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Post with multiple images')

      // Open media section
      await page.locator('button[title="Add media (images/videos)"]').click()

      // Upload 4 images sequentially
      const fileInput = page.locator('input[type="file"]').first()
      for (let i = 0; i < 4; i++) {
        await fileInput.setInputFiles(TEST_IMAGE_PATH)
        await expect(page.locator(`img[alt="Media ${i + 1}"]`).first()).toBeVisible({
          timeout: 20000,
        })
      }

      // Verify all 4 previews are visible
      for (let i = 1; i <= 4; i++) {
        await expect(page.locator(`img[alt="Media ${i}"]`).first()).toBeVisible()
      }

      // Close media section and verify count badge shows "4"
      await page.locator('button[title="Add media (images/videos)"]').click()
      const mediaButton = page.locator('button[title="Add media (images/videos)"]')
      await expect(mediaButton).toContainText('4')
    })

     
    test('should hide upload zone when Twitter 4-image limit reached', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')

      // Open media section
      await page.locator('button[title="Add media (images/videos)"]').click()

      // Upload 4 images
      const fileInput = page.locator('input[type="file"]').first()
      for (let i = 0; i < 4; i++) {
        await fileInput.setInputFiles(TEST_IMAGE_PATH)
        await expect(page.locator(`img[alt="Media ${i + 1}"]`).first()).toBeVisible({
          timeout: 20000,
        })
      }

      // The "Drag & drop" zone should be hidden after reaching limit
      await expect(page.getByText('Drag & drop or click to upload')).not.toBeVisible()
    })

     
    test('should enforce single media limit for LinkedIn', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'linkedin')
      await fillContent(page, 'LinkedIn post with media')

      // Open media section
      await page.locator('button[title="Add media (images/videos)"]').click()

      // Upload first image
      const fileInput = page.locator('input[type="file"]').first()
      await fileInput.setInputFiles(TEST_IMAGE_PATH)
      await expect(page.locator('img[alt="Media 1"]').first()).toBeVisible({ timeout: 20000 })

      // Upload zone should be hidden after first upload for LinkedIn (limit 1)
      await expect(page.getByText('Drag & drop or click to upload')).not.toBeVisible()
    })

     
    test('should allow replacing media on LinkedIn after removal', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'linkedin')

      // Open media section
      await page.locator('button[title="Add media (images/videos)"]').click()

      // Upload first image
      const fileInput = page.locator('input[type="file"]').first()
      await fileInput.setInputFiles(TEST_IMAGE_PATH)
      const mediaPreview = page.locator('img[alt="Media 1"]').first()
      await expect(mediaPreview).toBeVisible({ timeout: 20000 })

      // Remove the image
      const mediaItem = page.locator('.relative.group').first()
      await mediaItem.hover()
      await mediaItem.locator('button').click()

      // Image should be removed and upload zone visible again
      await expect(mediaPreview).not.toBeVisible()
      await expect(page.getByText('Drag & drop or click to upload')).toBeVisible()

      // Upload another image
      await fileInput.setInputFiles(TEST_IMAGE_PATH)
      await expect(page.locator('img[alt="Media 1"]').first()).toBeVisible({ timeout: 20000 })
    })
  })
})
