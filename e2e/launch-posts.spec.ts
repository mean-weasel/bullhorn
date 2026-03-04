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
  setLaunchPostStatus,
  fillProductHuntFields,
  fillAskHNFields,
  fillBetaListFields,
  fillDevHuntFields,
  fillIndieHackersFields,
  saveLaunchPost,
  getAllLaunchPosts,
  getLaunchPostById,
  createLaunchPostViaAPI,
  clickLaunchPost,
  deleteLaunchPost,
  openLaunchPostMenu,
} from './helpers'

test.describe('Launch Posts', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test.describe('Launch Posts List', () => {
    test('should show empty state when no launch posts exist', async ({ page }) => {
      await goToLaunchPosts(page)

      await expect(page.getByText('No launch posts yet')).toBeVisible()
      await expect(
        page.getByRole('button', { name: /create your first launch post/i })
      ).toBeVisible()
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
      // Create a launch post via API
      await createLaunchPostViaAPI(page, {
        platform: 'hacker_news_show',
        title: 'Show HN: Test Product',
        url: 'https://test-product.com',
      })

      await goToLaunchPosts(page)

      await expect(page.getByText('Show HN: Test Product')).toBeVisible()
    })

    test('should filter launch posts by platform', async ({ page }) => {
      // Create posts for different platforms
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

      // Open filters
      await page.getByRole('button', { name: /filters/i }).click()

      // Filter by Product Hunt
      await page.getByLabel(/platform/i).selectOption('product_hunt')

      // Should show Product Hunt post
      await expect(page.getByText('Product Hunt Post')).toBeVisible()
      // Should not show Show HN post
      await expect(page.getByText('Show HN: Test 1')).not.toBeVisible()
    })

    test('should filter launch posts by status', async ({ page }) => {
      // Create a draft post
      await createLaunchPostViaAPI(page, {
        platform: 'hacker_news_show',
        title: 'Draft Post',
        url: 'https://draft.com',
      })

      await goToLaunchPosts(page)

      // Open filters
      await page.getByRole('button', { name: /filters/i }).click()

      // Filter by draft status
      await page.getByLabel(/status/i).selectOption('draft')

      // Should show draft post
      await expect(page.getByText('Draft Post')).toBeVisible()
    })
  })

  test.describe('Create Launch Posts', () => {
    test.describe('Show HN', () => {
      test('should create a Show HN launch post', async ({ page }) => {
        await goToNewLaunchPost(page)

        // Show HN should be selected by default (selected button has bg-primary)
        await expect(page.getByRole('button', { name: 'Show HN' })).toHaveClass(/bg-primary/)

        await fillLaunchPostTitle(page, 'Show HN: My Awesome Product')
        await fillLaunchPostUrl(page, 'https://my-product.com')
        await fillLaunchPostDescription(page, 'This is my awesome product description')

        await saveLaunchPost(page)

        // Verify in database - find the post we just created
        const posts = await getAllLaunchPosts(page)
        const createdPost = posts.find((p) => p.title === 'Show HN: My Awesome Product')
        expect(createdPost).toBeDefined()
        expect(createdPost?.platform).toBe('hacker_news_show')
      })

      test('should show character limit for title', async ({ page }) => {
        await goToNewLaunchPost(page)

        await fillLaunchPostTitle(page, 'Show HN: Test')

        // Should show character count (13 characters)
        await expect(page.getByText(/13\/80/)).toBeVisible()
      })
    })

    test.describe('Ask HN', () => {
      test('should create an Ask HN launch post', async ({ page }) => {
        await goToNewLaunchPost(page)

        await selectLaunchPlatform(page, 'hacker_news_ask')

        // URL should not be required for Ask HN
        await expect(page.getByText('(optional for Ask HN)')).toBeVisible()

        await fillLaunchPostTitle(page, 'Ask HN: What is the best testing framework?')
        await fillAskHNFields(page, { text: 'I have been trying various testing frameworks...' })

        await saveLaunchPost(page)

        // Verify in database - find the post we just created
        const posts = await getAllLaunchPosts(page)
        const createdPost = posts.find(
          (p) => p.title === 'Ask HN: What is the best testing framework?'
        )
        expect(createdPost).toBeDefined()
        expect(createdPost?.platform).toBe('hacker_news_ask')
        expect(createdPost?.platformFields).toHaveProperty('text')
      })

      test('should show Ask HN specific fields', async ({ page }) => {
        await goToNewLaunchPost(page)

        await selectLaunchPlatform(page, 'hacker_news_ask')

        // Should show Question Body field
        await expect(page.getByText('Ask HN Fields')).toBeVisible()
        await expect(page.getByLabel(/question body/i)).toBeVisible()
      })
    })

    test.describe('Product Hunt', () => {
      test('should create a Product Hunt launch post', async ({ page }) => {
        await goToNewLaunchPost(page)

        await selectLaunchPlatform(page, 'product_hunt')

        await fillLaunchPostTitle(page, 'Amazing SaaS Tool')
        await fillLaunchPostUrl(page, 'https://amazing-saas.com')
        await fillLaunchPostDescription(page, 'The best SaaS tool for productivity')

        // Fill Product Hunt specific fields
        await fillProductHuntFields(page, {
          tagline: 'Boost your productivity 10x',
          pricing: 'freemium',
          firstComment: 'Hey everyone! I am the maker of this product...',
        })

        await saveLaunchPost(page)

        // Verify in database - find the post we just created
        const posts = await getAllLaunchPosts(page)
        const createdPost = posts.find((p) => p.title === 'Amazing SaaS Tool')
        expect(createdPost).toBeDefined()
        expect(createdPost?.platform).toBe('product_hunt')
        expect(createdPost?.platformFields).toHaveProperty('tagline', 'Boost your productivity 10x')
        expect(createdPost?.platformFields).toHaveProperty('pricing', 'freemium')
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

        // Should show character count
        await expect(page.getByText(/13\/60/)).toBeVisible()
      })
    })

    test.describe('Dev Hunt', () => {
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

        // Verify in database - find the post we just created
        const posts = await getAllLaunchPosts(page)
        const createdPost = posts.find((p) => p.title === 'Open Source CLI Tool')
        expect(createdPost).toBeDefined()
        expect(createdPost?.platform).toBe('dev_hunt')
        expect(createdPost?.platformFields).toHaveProperty(
          'githubUrl',
          'https://github.com/user/cli-tool'
        )
      })

      test('should show Dev Hunt specific fields', async ({ page }) => {
        await goToNewLaunchPost(page)

        await selectLaunchPlatform(page, 'dev_hunt')

        await expect(page.getByText('Dev Hunt Fields')).toBeVisible()
        await expect(page.getByLabel(/github url/i)).toBeVisible()
        await expect(page.getByLabel(/founder story/i)).toBeVisible()
      })
    })

    test.describe('BetaList', () => {
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

        // Verify in database - find the post we just created
        const posts = await getAllLaunchPosts(page)
        const createdPost = posts.find((p) => p.title === 'Startup Idea Validator')
        expect(createdPost).toBeDefined()
        expect(createdPost?.platform).toBe('beta_list')
        expect(createdPost?.platformFields).toHaveProperty(
          'oneSentencePitch',
          'Validate startup ideas in 5 minutes with AI'
        )
      })

      test('should show BetaList specific fields', async ({ page }) => {
        await goToNewLaunchPost(page)

        await selectLaunchPlatform(page, 'beta_list')

        await expect(page.getByText('BetaList Fields')).toBeVisible()
        await expect(page.getByLabel(/one-sentence pitch/i)).toBeVisible()
      })

      test('should show pitch character limit', async ({ page }) => {
        await goToNewLaunchPost(page)

        await selectLaunchPlatform(page, 'beta_list')
        await fillBetaListFields(page, { oneSentencePitch: 'Quick pitch' })

        // Should show character count
        await expect(page.getByText(/11\/140/)).toBeVisible()
      })
    })

    test.describe('Indie Hackers', () => {
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

        // Verify in database - find the post we just created
        const posts = await getAllLaunchPosts(page)
        const createdPost = posts.find((p) => p.title === 'Solo SaaS Product')
        expect(createdPost).toBeDefined()
        expect(createdPost?.platform).toBe('indie_hackers')
        expect(createdPost?.platformFields).toHaveProperty('revenue', '$1,000/mo')
      })

      test('should show Indie Hackers specific fields', async ({ page }) => {
        await goToNewLaunchPost(page)

        await selectLaunchPlatform(page, 'indie_hackers')

        await expect(page.getByText('Indie Hackers Fields')).toBeVisible()
        await expect(page.getByLabel(/short description/i)).toBeVisible()
        await expect(page.getByLabel(/monthly revenue/i)).toBeVisible()
      })
    })

    test.describe('Common Fields', () => {
      test('should save internal notes', async ({ page }) => {
        await goToNewLaunchPost(page)

        await fillLaunchPostTitle(page, 'Test Post With Notes')
        await fillLaunchPostUrl(page, 'https://test-notes.com')
        await fillLaunchPostNotes(page, 'Remember to post at 9am PST')

        await saveLaunchPost(page)

        // Verify in database - find the post we just created
        const posts = await getAllLaunchPosts(page)
        const createdPost = posts.find((p) => p.title === 'Test Post With Notes')
        expect(createdPost).toBeDefined()
        expect(createdPost?.notes).toBe('Remember to post at 9am PST')
      })

      test('should require title', async ({ page }) => {
        await goToNewLaunchPost(page)

        // Don't fill title
        await fillLaunchPostUrl(page, 'https://test.com')

        // Save button should be disabled
        const saveButton = page.getByRole('button', { name: /create launch post/i })
        await expect(saveButton).toBeDisabled()
      })

      test('should require URL for most platforms', async ({ page }) => {
        await goToNewLaunchPost(page)

        await fillLaunchPostTitle(page, 'Test Post')

        // URL should be required
        const urlInput = page.getByLabel(/^url/i)
        await expect(urlInput).toHaveAttribute('required')
      })
    })
  })

  test.describe('Edit Launch Posts', () => {
    test('should edit an existing launch post', async ({ page }) => {
      // Create a post first
      const created = await createLaunchPostViaAPI(page, {
        platform: 'hacker_news_show',
        title: 'Original Title',
        url: 'https://original.com',
      })

      await page.goto(`/launch-posts/${created.id}`)
      // Wait for form to load with existing data
      await expect(page.getByLabel(/^title/i)).toHaveValue('Original Title', { timeout: 15000 })

      // Update the title
      await fillLaunchPostTitle(page, 'Updated Title')

      await saveLaunchPost(page)

      // Verify the update
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
      // Wait for form to load with existing data
      await expect(page.getByLabel(/^title/i)).toHaveValue('Platform Test', { timeout: 15000 })

      // Change to Product Hunt
      await selectLaunchPlatform(page, 'product_hunt')

      // Product Hunt fields should now appear
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
      // Wait for form to load with existing data
      await expect(page.getByLabel(/^title/i)).toHaveValue('Status Test', { timeout: 15000 })

      await setLaunchPostStatus(page, 'posted')

      await saveLaunchPost(page)

      const updated = await getLaunchPostById(page, created.id)
      expect(updated?.status).toBe('posted')
    })
  })

  test.describe('Delete Launch Posts', () => {
    test('should delete a launch post from list', async ({ page }) => {
      await createLaunchPostViaAPI(page, {
        platform: 'hacker_news_show',
        title: 'Delete Test',
        url: 'https://delete.com',
      })

      await goToLaunchPosts(page)

      // Wait for the card to be visible
      await expect(page.getByText('Delete Test')).toBeVisible()

      // Use helper to delete via dropdown menu
      await deleteLaunchPost(page, 0)

      // Wait for the post to be removed from the list
      await expect(page.getByText('Delete Test')).not.toBeVisible({ timeout: 10000 })

      // Verify in database
      const posts = await getAllLaunchPosts(page)
      expect(posts.length).toBe(0)
    })
  })

  test.describe('Platform Links', () => {
    test('should show link to platform submission page', async ({ page }) => {
      await goToNewLaunchPost(page)

      // Show HN should have link to HN submit page
      const link = page.getByRole('link', { name: /open show hn submission page/i })
      await expect(link).toHaveAttribute('href', 'https://news.ycombinator.com/submit')
    })

    test('should update platform link when switching platforms', async ({ page }) => {
      await goToNewLaunchPost(page)

      await selectLaunchPlatform(page, 'product_hunt')

      const link = page.getByRole('link', { name: /open product hunt submission page/i })
      await expect(link).toHaveAttribute('href', 'https://www.producthunt.com/posts/new')
    })
  })

  test.describe('Platform Switching', () => {
    test('should switch between platforms', async ({ page }) => {
      await goToNewLaunchPost(page)

      // Start with Show HN (default) - selected button has bg-primary
      await expect(page.getByRole('button', { name: 'Show HN' })).toHaveClass(/bg-primary/)

      // Switch to Product Hunt
      await selectLaunchPlatform(page, 'product_hunt')
      await expect(page.getByRole('button', { name: 'Product Hunt' })).toHaveClass(/bg-primary/)
      await expect(page.getByText('Product Hunt Fields')).toBeVisible()

      // Switch to Ask HN
      await selectLaunchPlatform(page, 'hacker_news_ask')
      await expect(page.getByRole('button', { name: 'Ask HN' })).toHaveClass(/bg-primary/)
      await expect(page.getByText('Ask HN Fields')).toBeVisible()

      // Product Hunt fields should no longer be visible
      await expect(page.getByText('Product Hunt Fields')).not.toBeVisible()
    })

    test('should preserve common fields when switching platforms', async ({ page }) => {
      await goToNewLaunchPost(page)

      // Fill in common fields
      await fillLaunchPostTitle(page, 'My Product Title')
      await fillLaunchPostUrl(page, 'https://myproduct.com')
      await fillLaunchPostDescription(page, 'Product description')

      // Switch platform
      await selectLaunchPlatform(page, 'product_hunt')

      // Common fields should still have their values
      await expect(page.getByLabel(/^title/i)).toHaveValue('My Product Title')
      await expect(page.getByLabel(/^url/i)).toHaveValue('https://myproduct.com')
      await expect(page.getByLabel(/^description/i)).toHaveValue('Product description')
    })
  })

  test.describe('Copy to Clipboard', () => {
    test('should have copy button in launch post dropdown menu', async ({ page }) => {
      await createLaunchPostViaAPI(page, {
        platform: 'hacker_news_show',
        title: 'Copy Test Post',
        url: 'https://copy-test.com',
        description: 'Test description for copying',
      })

      await goToLaunchPosts(page)

      // Wait for the card to be visible
      await expect(page.getByText('Copy Test Post')).toBeVisible()

      // Open the dropdown menu
      await openLaunchPostMenu(page, 0)

      // Should have a Copy Fields button in the dropdown
      const copyButton = page.getByRole('button', { name: /copy fields/i })
      await expect(copyButton).toBeVisible()
    })
  })
})
