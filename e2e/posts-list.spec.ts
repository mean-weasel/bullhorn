import { test, expect } from '@playwright/test'
import { enterDemoMode, goToPosts, getPostCards, createTestPost, generateTestId, uniqueContent } from './helpers'

test.describe('Posts List', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test.describe.serial('Navigation', () => {
    test('should navigate to posts list from dashboard', async ({ page }) => {
      await page.goto('/')

      // Navigate to posts via URL (bottom nav uses /posts route)
      await page.goto('/posts')

      await expect(page).toHaveURL('/posts')
      await expect(page.getByRole('heading', { name: /all posts/i })).toBeVisible()
    })
  })

  test.describe.serial('Filter Tabs', () => {
    test('should show all posts by default', async ({ page }) => {
      await goToPosts(page)

      // All tab should be active (has primary background)
      const allTab = page.getByRole('button', { name: /^all/i })
      await expect(allTab).toHaveClass(/bg-primary/)
    })

    test('should filter to drafts', async ({ page }, testInfo) => {
      const testId = generateTestId(testInfo)
      const content = uniqueContent('Draft post', testId)
      // Create a draft post first
      await createTestPost(page, { platform: 'twitter', content })

      await goToPosts(page)
      await page.getByRole('button', { name: /drafts/i }).click()

      const cards = await getPostCards(page)
      const count = await cards.count()
      expect(count).toBeGreaterThan(0)

      // All visible cards should be drafts
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i)
        await expect(card).toContainText(/draft/i)
      }
    })

    test('should filter to scheduled', async ({ page }, testInfo) => {
      const testId = generateTestId(testInfo)
      const content = uniqueContent('Scheduled post', testId)
      // Create a scheduled post first
      await createTestPost(page, {
        platform: 'twitter',
        content,
        asDraft: false,
      })

      await goToPosts(page)
      await page.getByRole('button', { name: /scheduled/i }).click()

      const cards = await getPostCards(page)
      const count = await cards.count()
      expect(count).toBeGreaterThan(0)

      // All visible cards should be scheduled
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i)
        await expect(card).toContainText(/scheduled/i)
      }
    })

    test('should show counts in filter tabs', async ({ page }) => {
      // Create some posts first
      await createTestPost(page, { platform: 'twitter', content: 'Post 1' })
      await createTestPost(page, { platform: 'linkedin', content: 'Post 2' })

      await goToPosts(page)

      // Each tab should show a count
      const allTab = page.getByRole('button', { name: /^all/i })
      await expect(allTab).toContainText(/\(\d+\)/)

      const draftsTab = page.getByRole('button', { name: /drafts/i })
      await expect(draftsTab).toContainText(/\(\d+\)/)
    })
  })

  test.describe.serial('Post Cards', () => {
    test('should display platform indicators', async ({ page }, testInfo) => {
      const testId = generateTestId(testInfo)
      const content = uniqueContent('Test post', testId)
      await createTestPost(page, { platform: 'twitter', content })

      await goToPosts(page)

      const firstCard = (await getPostCards(page)).first()

      // Should have platform indicator (icon box with platform symbol)
      // Twitter shows "𝕏", LinkedIn shows "in", Reddit shows "r/"
      const platformIndicator = firstCard.locator('.rounded-md').filter({ hasText: /𝕏|in|r\// })
      const indicatorCount = await platformIndicator.count()
      expect(indicatorCount).toBeGreaterThan(0)
    })

    test('should display content preview', async ({ page }, testInfo) => {
      const testId = generateTestId(testInfo)
      const content = uniqueContent('My post content preview', testId)
      await createTestPost(page, { platform: 'twitter', content })

      await goToPosts(page)

      const firstCard = (await getPostCards(page)).first()

      // Should show the content
      await expect(firstCard).toContainText(content)
    })

    test('should display status badge', async ({ page }, testInfo) => {
      const testId = generateTestId(testInfo)
      const content = uniqueContent('Test post', testId)
      await createTestPost(page, { platform: 'twitter', content })

      await goToPosts(page)

      const firstCard = (await getPostCards(page)).first()

      // Should have a status indicator
      const hasStatus = await firstCard.locator('text=/draft|scheduled|published/i').count()
      expect(hasStatus).toBeGreaterThan(0)
    })

    test('should navigate to editor when clicked', async ({ page }, testInfo) => {
      const testId = generateTestId(testInfo)
      const content = uniqueContent('Clickable post', testId)
      await createTestPost(page, { platform: 'twitter', content })

      await goToPosts(page)

      const firstCard = (await getPostCards(page)).first()
      await firstCard.click()

      await expect(page).toHaveURL(/\/edit\//)
      await expect(page.getByRole('heading', { name: /edit post/i })).toBeVisible()
    })
  })

  test.describe('New Post Button', () => {
    test('should have new post button in header', async ({ page }) => {
      await goToPosts(page)

      // The header has a "New Post" link with exact text
      const newPostBtn = page.getByRole('link', { name: 'New Post', exact: true })
      await expect(newPostBtn).toBeVisible()
    })

    test('should navigate to new post page', async ({ page }) => {
      await goToPosts(page)

      // Click the header "New Post" button (not the floating one)
      await page.getByRole('link', { name: 'New Post', exact: true }).click()

      await expect(page).toHaveURL('/new')
      await expect(page.getByRole('heading', { name: /create post/i })).toBeVisible()
    })
  })
})
