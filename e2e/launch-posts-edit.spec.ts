import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  goToLaunchPosts,
  goToNewLaunchPost,
  selectLaunchPlatform,
  fillLaunchPostTitle,
  fillLaunchPostUrl,
  fillLaunchPostDescription,
  setLaunchPostStatus,
  saveLaunchPost,
  getLaunchPostById,
  createLaunchPostViaAPI,
  clickLaunchPost,
  deleteLaunchPost,
  openLaunchPostMenu,
  getAllLaunchPosts,
} from './helpers'

test.describe('Edit Launch Posts', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should edit an existing launch post', async ({ page }) => {
    const created = await createLaunchPostViaAPI(page, {
      platform: 'hacker_news_show',
      title: 'Original Title',
      url: 'https://original.com',
    })
    await page.goto(`/launch-posts/${created.id}`)
    await expect(page.getByLabel(/^title/i)).toHaveValue('Original Title', { timeout: 15000 })
    await fillLaunchPostTitle(page, 'Updated Title')
    await saveLaunchPost(page)
    const updated = await getLaunchPostById(page, created.id)
    expect(updated?.title).toBe('Updated Title')
  })

  test('should navigate to edit from list', async ({ page }) => {
    await createLaunchPostViaAPI(page, {
      platform: 'hacker_news_show',
      title: 'Edit Test Post',
      url: 'https://edit-test.com',
    })
    await goToLaunchPosts(page)
    await clickLaunchPost(page, 0)
    await expect(page.getByRole('heading', { name: /edit launch post/i })).toBeVisible()
    await expect(page.getByLabel(/^title/i)).toHaveValue('Edit Test Post', { timeout: 15000 })
  })

  test('should change platform when editing', async ({ page }) => {
    const created = await createLaunchPostViaAPI(page, {
      platform: 'hacker_news_show',
      title: 'Platform Test',
      url: 'https://platform.com',
    })
    await page.goto(`/launch-posts/${created.id}`)
    await expect(page.getByLabel(/^title/i)).toHaveValue('Platform Test', { timeout: 15000 })
    await selectLaunchPlatform(page, 'product_hunt')
    await expect(page.getByText('Product Hunt Fields')).toBeVisible()
    await saveLaunchPost(page)
    const updated = await getLaunchPostById(page, created.id)
    expect(updated?.platform).toBe('product_hunt')
  })

  test('should update status', async ({ page }) => {
    const created = await createLaunchPostViaAPI(page, {
      platform: 'hacker_news_show',
      title: 'Status Test',
      url: 'https://status.com',
    })
    await page.goto(`/launch-posts/${created.id}`)
    await expect(page.getByLabel(/^title/i)).toHaveValue('Status Test', { timeout: 15000 })
    await setLaunchPostStatus(page, 'posted')
    await saveLaunchPost(page)
    const updated = await getLaunchPostById(page, created.id)
    expect(updated?.status).toBe('posted')
  })
})

test.describe('Delete Launch Posts', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should delete a launch post from list', async ({ page }) => {
    await createLaunchPostViaAPI(page, {
      platform: 'hacker_news_show',
      title: 'Delete Test',
      url: 'https://delete.com',
    })
    await goToLaunchPosts(page)
    await expect(page.getByText('Delete Test')).toBeVisible()
    await deleteLaunchPost(page, 0)
    await expect(page.getByText('Delete Test')).not.toBeVisible({ timeout: 10000 })
    const posts = await getAllLaunchPosts(page)
    expect(posts.length).toBe(0)
  })
})

test.describe('Launch Posts Platform Features', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should show link to platform submission page', async ({ page }) => {
    await goToNewLaunchPost(page)
    const link = page.getByRole('link', { name: /open show hn submission page/i })
    await expect(link).toHaveAttribute('href', 'https://news.ycombinator.com/submit')
  })

  test('should update platform link when switching platforms', async ({ page }) => {
    await goToNewLaunchPost(page)
    await selectLaunchPlatform(page, 'product_hunt')
    const link = page.getByRole('link', { name: /open product hunt submission page/i })
    await expect(link).toHaveAttribute('href', 'https://www.producthunt.com/posts/new')
  })

  test('should switch between platforms', async ({ page }) => {
    await goToNewLaunchPost(page)
    await expect(page.getByRole('button', { name: 'Show HN' })).toHaveClass(/bg-primary/)
    await selectLaunchPlatform(page, 'product_hunt')
    await expect(page.getByRole('button', { name: 'Product Hunt' })).toHaveClass(/bg-primary/)
    await expect(page.getByText('Product Hunt Fields')).toBeVisible()
    await selectLaunchPlatform(page, 'hacker_news_ask')
    await expect(page.getByRole('button', { name: 'Ask HN' })).toHaveClass(/bg-primary/)
    await expect(page.getByText('Ask HN Fields')).toBeVisible()
    await expect(page.getByText('Product Hunt Fields')).not.toBeVisible()
  })

  test('should preserve common fields when switching platforms', async ({ page }) => {
    await goToNewLaunchPost(page)
    await fillLaunchPostTitle(page, 'My Product Title')
    await fillLaunchPostUrl(page, 'https://myproduct.com')
    await fillLaunchPostDescription(page, 'Product description')
    await selectLaunchPlatform(page, 'product_hunt')
    await expect(page.getByLabel(/^title/i)).toHaveValue('My Product Title')
    await expect(page.getByLabel(/^url/i)).toHaveValue('https://myproduct.com')
    await expect(page.getByLabel(/^description/i)).toHaveValue('Product description')
  })

  test('should have copy button in launch post dropdown menu', async ({ page }) => {
    await createLaunchPostViaAPI(page, {
      platform: 'hacker_news_show',
      title: 'Copy Test Post',
      url: 'https://copy-test.com',
      description: 'Test description for copying',
    })
    await goToLaunchPosts(page)
    await expect(page.getByText('Copy Test Post')).toBeVisible()
    await openLaunchPostMenu(page, 0)
    const copyButton = page.getByRole('button', { name: /copy fields/i })
    await expect(copyButton).toBeVisible()
  })
})
