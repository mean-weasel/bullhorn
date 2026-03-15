import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  goToLaunchPosts,
  goToNewLaunchPost,
  selectLaunchPlatform,
  fillLaunchPostTitle,
  fillLaunchPostUrl,
  fillLaunchPostDescription,
  fillLaunchPostNotes,
  fillProductHuntFields,
  fillAskHNFields,
  fillBetaListFields,
  fillDevHuntFields,
  fillIndieHackersFields,
  saveLaunchPost,
  getAllLaunchPosts,
  createLaunchPostViaAPI,
} from './helpers'

test.describe('Launch Posts List', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should show empty state when no launch posts exist', async ({ page }) => {
    await goToLaunchPosts(page)
    await expect(page.getByText('No launch posts yet')).toBeVisible()
    await expect(page.getByRole('button', { name: /create your first launch post/i })).toBeVisible()
  })

  test('should navigate to new launch post from empty state', async ({ page }) => {
    await goToLaunchPosts(page)
    await page.getByRole('button', { name: /create your first launch post/i }).click()
    await expect(page.getByRole('heading', { name: /new launch post/i })).toBeVisible()
  })

  test('should navigate to new launch post from header button', async ({ page }) => {
    await goToLaunchPosts(page)
    await page.getByRole('button', { name: /^new/i }).click()
    await expect(page.getByRole('heading', { name: /new launch post/i })).toBeVisible()
  })

  test('should display launch posts after creation', async ({ page }) => {
    await createLaunchPostViaAPI(page, {
      platform: 'hacker_news_show',
      title: 'Show HN: Test Product',
      url: 'https://test-product.com',
    })
    await goToLaunchPosts(page)
    await expect(page.getByText('Show HN: Test Product')).toBeVisible()
  })

  test('should filter launch posts by platform', async ({ page }) => {
    await createLaunchPostViaAPI(page, {
      platform: 'hacker_news_show',
      title: 'Show HN: Test 1',
      url: 'https://test1.com',
    })
    await createLaunchPostViaAPI(page, {
      platform: 'product_hunt',
      title: 'Product Hunt Post',
      url: 'https://test2.com',
    })
    await goToLaunchPosts(page)
    await page.getByRole('button', { name: /filters/i }).click()
    await page.getByLabel(/platform/i).selectOption('product_hunt')
    await expect(page.getByText('Product Hunt Post')).toBeVisible()
    await expect(page.getByText('Show HN: Test 1')).not.toBeVisible()
  })

  test('should filter launch posts by status', async ({ page }) => {
    await createLaunchPostViaAPI(page, {
      platform: 'hacker_news_show',
      title: 'Draft Post',
      url: 'https://draft.com',
    })
    await goToLaunchPosts(page)
    await page.getByRole('button', { name: /filters/i }).click()
    await page.getByLabel(/status/i).selectOption('draft')
    await expect(page.getByText('Draft Post')).toBeVisible()
  })
})

test.describe('Create Launch Posts - HN', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should create a Show HN launch post', async ({ page }) => {
    await goToNewLaunchPost(page)
    await expect(page.getByRole('button', { name: 'Show HN' })).toHaveClass(/bg-primary/)
    await fillLaunchPostTitle(page, 'Show HN: My Awesome Product')
    await fillLaunchPostUrl(page, 'https://my-product.com')
    await fillLaunchPostDescription(page, 'This is my awesome product description')
    await saveLaunchPost(page)
    const posts = await getAllLaunchPosts(page)
    const createdPost = posts.find((p) => p.title === 'Show HN: My Awesome Product')
    expect(createdPost).toBeDefined()
    expect(createdPost?.platform).toBe('hacker_news_show')
  })

  test('should show character limit for title', async ({ page }) => {
    await goToNewLaunchPost(page)
    await fillLaunchPostTitle(page, 'Show HN: Test')
    await expect(page.getByText(/13\/80/)).toBeVisible()
  })

  test('should create an Ask HN launch post', async ({ page }) => {
    await goToNewLaunchPost(page)
    await selectLaunchPlatform(page, 'hacker_news_ask')
    await expect(page.getByText('(optional for Ask HN)')).toBeVisible()
    await fillLaunchPostTitle(page, 'Ask HN: What is the best testing framework?')
    await fillAskHNFields(page, { text: 'I have been trying various testing frameworks...' })
    await saveLaunchPost(page)
    const posts = await getAllLaunchPosts(page)
    const createdPost = posts.find((p) => p.title === 'Ask HN: What is the best testing framework?')
    expect(createdPost).toBeDefined()
    expect(createdPost?.platform).toBe('hacker_news_ask')
    expect(createdPost?.platformFields).toHaveProperty('text')
  })

  test('should show Ask HN specific fields', async ({ page }) => {
    await goToNewLaunchPost(page)
    await selectLaunchPlatform(page, 'hacker_news_ask')
    await expect(page.getByText('Ask HN Fields')).toBeVisible()
    await expect(page.getByLabel(/question body/i)).toBeVisible()
  })
})

test.describe('Create Launch Posts - Platforms', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should create a Product Hunt launch post', async ({ page }) => {
    await goToNewLaunchPost(page)
    await selectLaunchPlatform(page, 'product_hunt')
    await fillLaunchPostTitle(page, 'Amazing SaaS Tool')
    await fillLaunchPostUrl(page, 'https://amazing-saas.com')
    await fillLaunchPostDescription(page, 'The best SaaS tool for productivity')
    await fillProductHuntFields(page, {
      tagline: 'Boost your productivity 10x',
      pricing: 'freemium',
      firstComment: 'Hey everyone! I am the maker of this product...',
    })
    await saveLaunchPost(page)
    const posts = await getAllLaunchPosts(page)
    const createdPost = posts.find((p) => p.title === 'Amazing SaaS Tool')
    expect(createdPost).toBeDefined()
    expect(createdPost?.platform).toBe('product_hunt')
    expect(createdPost?.platformFields).toHaveProperty('tagline', 'Boost your productivity 10x')
  })

  test('should show Product Hunt specific fields', async ({ page }) => {
    await goToNewLaunchPost(page)
    await selectLaunchPlatform(page, 'product_hunt')
    await expect(page.getByText('Product Hunt Fields')).toBeVisible()
    await expect(page.getByLabel(/tagline/i)).toBeVisible()
    await expect(page.getByLabel(/pricing model/i)).toBeVisible()
    await expect(page.getByLabel(/first comment/i)).toBeVisible()
  })

  test('should show tagline character limit', async ({ page }) => {
    await goToNewLaunchPost(page)
    await selectLaunchPlatform(page, 'product_hunt')
    await fillProductHuntFields(page, { tagline: 'Short tagline' })
    await expect(page.getByText(/13\/60/)).toBeVisible()
  })

  test('should create a Dev Hunt launch post', async ({ page }) => {
    await goToNewLaunchPost(page)
    await selectLaunchPlatform(page, 'dev_hunt')
    await fillLaunchPostTitle(page, 'Open Source CLI Tool')
    await fillLaunchPostUrl(page, 'https://cli-tool.dev')
    await fillLaunchPostDescription(page, 'A powerful CLI for developers')
    await fillDevHuntFields(page, {
      githubUrl: 'https://github.com/user/cli-tool',
      founderStory: 'I built this because I was tired of...',
    })
    await saveLaunchPost(page)
    const posts = await getAllLaunchPosts(page)
    const createdPost = posts.find((p) => p.title === 'Open Source CLI Tool')
    expect(createdPost).toBeDefined()
    expect(createdPost?.platform).toBe('dev_hunt')
  })

  test('should create a BetaList launch post', async ({ page }) => {
    await goToNewLaunchPost(page)
    await selectLaunchPlatform(page, 'beta_list')
    await fillLaunchPostTitle(page, 'Startup Idea Validator')
    await fillLaunchPostUrl(page, 'https://startup-validator.com')
    await fillLaunchPostDescription(page, 'Validate your startup ideas fast')
    await fillBetaListFields(page, {
      oneSentencePitch: 'Validate startup ideas in 5 minutes with AI',
    })
    await saveLaunchPost(page)
    const posts = await getAllLaunchPosts(page)
    const createdPost = posts.find((p) => p.title === 'Startup Idea Validator')
    expect(createdPost).toBeDefined()
    expect(createdPost?.platform).toBe('beta_list')
  })

  test('should create an Indie Hackers launch post', async ({ page }) => {
    await goToNewLaunchPost(page)
    await selectLaunchPlatform(page, 'indie_hackers')
    await fillLaunchPostTitle(page, 'Solo SaaS Product')
    await fillLaunchPostUrl(page, 'https://solo-saas.com')
    await fillLaunchPostDescription(page, 'Built by a solo founder')
    await fillIndieHackersFields(page, {
      shortDescription: 'SaaS for indie hackers',
      revenue: '$1,000/mo',
    })
    await saveLaunchPost(page)
    const posts = await getAllLaunchPosts(page)
    const createdPost = posts.find((p) => p.title === 'Solo SaaS Product')
    expect(createdPost).toBeDefined()
    expect(createdPost?.platform).toBe('indie_hackers')
  })

  test('should save internal notes', async ({ page }) => {
    await goToNewLaunchPost(page)
    await fillLaunchPostTitle(page, 'Test Post With Notes')
    await fillLaunchPostUrl(page, 'https://test-notes.com')
    await fillLaunchPostNotes(page, 'Remember to post at 9am PST')
    await saveLaunchPost(page)
    const posts = await getAllLaunchPosts(page)
    const createdPost = posts.find((p) => p.title === 'Test Post With Notes')
    expect(createdPost?.notes).toBe('Remember to post at 9am PST')
  })

  test('should require title', async ({ page }) => {
    await goToNewLaunchPost(page)
    await fillLaunchPostUrl(page, 'https://test.com')
    const saveButton = page.getByRole('button', { name: /create launch post/i })
    await expect(saveButton).toBeDisabled()
  })
})
