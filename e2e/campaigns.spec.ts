import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  goToNewPost,
  selectPlatform,
  fillContent,
  fillRedditFields,
  saveDraft,
  waitForNavigation,
  getAllCampaigns,
  getCampaignPosts,
  getAllPosts,
} from './helpers'

test.describe('Campaigns', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test.describe('Campaign CRUD Operations', () => {
    test('should create a new campaign', async ({ page }) => {
      // Navigate to campaigns
      await page.goto('/campaigns')
      await expect(page.getByRole('heading', { name: 'Campaigns', exact: true })).toBeVisible({
        timeout: 15000,
      })

      // Click "New Campaign" button
      await page.getByRole('button', { name: /new campaign|new$/i }).click()

      // Fill campaign details in modal
      await page.getByPlaceholder(/enter campaign name/i).fill('Product Launch 2024')
      await page
        .getByPlaceholder(/describe this campaign/i)
        .fill('Marketing campaign for new product release')

      // Submit
      await page.getByRole('button', { name: /create campaign/i }).click()

      // Should navigate to campaign detail page
      await page.waitForURL(/\/campaigns\//)
      await expect(page.getByText('Product Launch 2024')).toBeVisible()

      // Verify in database
      const campaigns = await getAllCampaigns(page)
      expect(campaigns.length).toBe(1)
      expect(campaigns[0].name).toBe('Product Launch 2024')
      expect(campaigns[0].description).toBe('Marketing campaign for new product release')
    })

    test('should edit a campaign name and description', async ({ page }) => {
      // First create a campaign via API or UI
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Edit Test Campaign')
      await page.getByRole('button', { name: /create campaign/i }).click()

      // Wait for navigation to detail page
      await page.waitForURL(/\/campaigns\//)
      await expect(page.getByRole('heading', { name: 'Edit Test Campaign' })).toBeVisible()

      // Click the edit button next to the campaign name (it's a small pencil button)
      // The edit button is right after the campaign name heading
      const editButton = page.locator('h1').locator('..').locator('button').first()
      await editButton.click()

      // Update name and description - the inputs should now be visible
      const nameInput = page.locator('input[type="text"]').first()
      await expect(nameInput).toBeVisible()
      await nameInput.clear()
      await nameInput.fill('Updated Campaign Name')

      const descInput = page.locator('textarea').first()
      await descInput.fill('New description for the campaign')

      // Save changes
      await page.getByRole('button', { name: /^save$/i }).click()

      // Verify updates are visible
      await expect(page.getByRole('heading', { name: 'Updated Campaign Name' })).toBeVisible()
      await expect(page.getByText('New description for the campaign')).toBeVisible()

      // Verify in database
      const campaigns = await getAllCampaigns(page)
      expect(campaigns[0].name).toBe('Updated Campaign Name')
    })

    test('should change campaign status', async ({ page }) => {
      // Create a campaign
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Status Test')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)

      // Find the status button group and change to active
      await page.getByRole('button', { name: 'Active' }).click()

      // Verify in database
      const campaigns = await getAllCampaigns(page)
      expect(campaigns[0].status).toBe('active')
    })

    test('should delete a campaign', async ({ page }) => {
      // Create a campaign
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Campaign to Delete')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)

      // Verify campaign exists
      let campaigns = await getAllCampaigns(page)
      expect(campaigns.length).toBe(1)

      // Click delete button - it's the button with title="Delete campaign"
      const deleteButton = page.getByTitle('Delete campaign')
      await expect(deleteButton).toBeVisible()
      await deleteButton.click()

      // Confirm in the ConfirmDialog
      const dialog = page.getByRole('alertdialog')
      await dialog.waitFor({ state: 'visible' })
      await dialog.getByRole('button', { name: 'Delete' }).click()

      // Should navigate back to campaigns list
      await page.waitForURL('/campaigns')

      // Verify campaign is deleted
      campaigns = await getAllCampaigns(page)
      expect(campaigns.length).toBe(0)
    })
  })

  test.describe('Campaign with Twitter Post', () => {
    test('should create Twitter post within a campaign', async ({ page }) => {
      // Create a campaign first
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Twitter Only Campaign')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)
      const campaignId = page.url().split('/campaigns/')[1]

      // Go to new post
      await goToNewPost(page)

      // Select Twitter
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'This is a Twitter post for our campaign! #marketing')

      // Select campaign from dropdown
      const campaignButton = page.locator('button').filter({ hasText: /no campaign/i })
      await expect(campaignButton).toBeVisible({ timeout: 10000 })
      await campaignButton.click()

      // Wait for dropdown and click the campaign
      const dropdown = page.locator('.absolute.z-20')
      await dropdown.waitFor()
      await dropdown.getByText('Twitter Only Campaign').click()

      // Verify campaign was selected (button should now show campaign name)
      await expect(
        page.locator('button').filter({ hasText: 'Twitter Only Campaign' })
      ).toBeVisible()

      // Save draft
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify post is associated with campaign
      const posts = await getCampaignPosts(page, campaignId)
      expect(posts.length).toBe(1)
      expect(posts[0].platform).toBe('twitter')
      expect((posts[0].content as { text: string }).text).toContain('Twitter post for our campaign')
    })
  })

  test.describe('Campaign with LinkedIn Post', () => {
    test('should create LinkedIn post within a campaign', async ({ page }) => {
      // Create a campaign
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('LinkedIn Only Campaign')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)
      const campaignId = page.url().split('/campaigns/')[1]

      // Create LinkedIn post
      await goToNewPost(page)
      await selectPlatform(page, 'linkedin')
      await fillContent(
        page,
        'Professional update for LinkedIn. Excited to share our latest developments with the community.'
      )

      // Select campaign
      await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
      await page.getByText('LinkedIn Only Campaign').click()

      // Save draft
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify
      const posts = await getCampaignPosts(page, campaignId)
      expect(posts.length).toBe(1)
      expect(posts[0].platform).toBe('linkedin')
      expect((posts[0].content as { text: string }).text).toContain(
        'Professional update for LinkedIn'
      )
    })
  })

  test.describe('Campaign with Reddit Post', () => {
    test('should create Reddit post within a campaign', async ({ page }) => {
      // Create a campaign
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Reddit Only Campaign')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)
      const campaignId = page.url().split('/campaigns/')[1]

      // Create Reddit post
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')
      await fillRedditFields(page, {
        subreddit: 'programming',
        title: 'Check out our new tool',
      })
      await fillContent(page, 'We built something cool for developers!')

      // Select campaign
      await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
      await page.getByText('Reddit Only Campaign').click()

      // Save draft
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify
      const posts = await getCampaignPosts(page, campaignId)
      expect(posts.length).toBe(1)
      expect(posts[0].platform).toBe('reddit')
      expect((posts[0].content as { subreddit: string }).subreddit).toBe('programming')
      expect((posts[0].content as { title: string }).title).toBe('Check out our new tool')
    })
  })

  test.describe('Campaign with Twitter and LinkedIn Posts', () => {
    test('should create Twitter and LinkedIn posts in same campaign', async ({ page }) => {
      // Create campaign
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Twitter LinkedIn Campaign')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)
      const campaignId = page.url().split('/campaigns/')[1]

      // Create Twitter post
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, '🚀 Exciting news coming soon! #announcement')
      await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
      await page.getByText('Twitter LinkedIn Campaign').click()
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Create LinkedIn post
      await goToNewPost(page)
      await selectPlatform(page, 'linkedin')
      await fillContent(
        page,
        'Thrilled to share some exciting news with my professional network. Stay tuned for our upcoming announcement!'
      )
      await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
      await page.getByText('Twitter LinkedIn Campaign').click()
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify both posts in campaign
      const posts = await getCampaignPosts(page, campaignId)
      expect(posts.length).toBe(2)

      const platforms = posts.map((p) => p.platform)
      expect(platforms).toContain('twitter')
      expect(platforms).toContain('linkedin')
    })
  })

  test.describe('Campaign with Twitter and Reddit Posts', () => {
    test('should create Twitter and Reddit posts in same campaign', async ({ page }) => {
      // Create campaign
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Twitter Reddit Campaign')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)
      const campaignId = page.url().split('/campaigns/')[1]

      // Create Twitter post
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Just posted something interesting on Reddit! Check it out 👀')
      await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
      await page.getByText('Twitter Reddit Campaign').click()
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Create Reddit post
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')
      await fillRedditFields(page, {
        subreddit: 'webdev',
        title: 'I built a thing - feedback welcome!',
      })
      await fillContent(
        page,
        'Here is what I built and why I think it could be useful for the community.'
      )
      await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
      await page.getByText('Twitter Reddit Campaign').click()
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify both posts in campaign
      const posts = await getCampaignPosts(page, campaignId)
      expect(posts.length).toBe(2)

      const platforms = posts.map((p) => p.platform)
      expect(platforms).toContain('twitter')
      expect(platforms).toContain('reddit')
    })
  })

  test.describe('Campaign with LinkedIn and Reddit Posts', () => {
    test('should create LinkedIn and Reddit posts in same campaign', async ({ page }) => {
      // Create campaign
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('LinkedIn Reddit Campaign')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)
      const campaignId = page.url().split('/campaigns/')[1]

      // Create LinkedIn post
      await goToNewPost(page)
      await selectPlatform(page, 'linkedin')
      await fillContent(
        page,
        'Proud to announce our latest open source contribution. We believe in giving back to the developer community.'
      )
      await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
      await page.getByText('LinkedIn Reddit Campaign').click()
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Create Reddit post
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')
      await fillRedditFields(page, {
        subreddit: 'opensource',
        title: 'Our open source contribution - looking for collaborators',
      })
      await fillContent(
        page,
        'We just released this tool as open source. Looking for contributors!'
      )
      await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
      await page.getByText('LinkedIn Reddit Campaign').click()
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify both posts in campaign
      const posts = await getCampaignPosts(page, campaignId)
      expect(posts.length).toBe(2)

      const platforms = posts.map((p) => p.platform)
      expect(platforms).toContain('linkedin')
      expect(platforms).toContain('reddit')
    })
  })

  test.describe('Campaign with All Three Platforms', () => {
    test('should create Twitter, LinkedIn, and Reddit posts in same campaign', async ({ page }) => {
      // Create a comprehensive marketing campaign
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Full Platform Launch')
      await page
        .getByPlaceholder(/describe this campaign/i)
        .fill('Cross-platform marketing campaign covering Twitter, LinkedIn, and Reddit')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)
      const campaignId = page.url().split('/campaigns/')[1]

      // Create Twitter post
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, '🚀 Big announcement! Check out our new product. #launch #tech')
      await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
      await page.getByText('Full Platform Launch').click()
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Create LinkedIn post
      await goToNewPost(page)
      await selectPlatform(page, 'linkedin')
      await fillContent(
        page,
        'Thrilled to announce the launch of our latest product! After months of development, we are ready to share it with the world.'
      )
      await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
      await page.getByText('Full Platform Launch').click()
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Create Reddit post
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')
      await fillRedditFields(page, {
        subreddit: 'startups',
        title: '[Launch] We just launched our product - feedback welcome!',
      })
      await fillContent(
        page,
        'Hey r/startups! We have been working on this for 6 months and would love your feedback.'
      )
      await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
      await page.getByText('Full Platform Launch').click()
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify all three posts are in the campaign
      const posts = await getCampaignPosts(page, campaignId)
      expect(posts.length).toBe(3)

      // Verify we have one of each platform
      const platforms = posts.map((p) => p.platform)
      expect(platforms).toContain('twitter')
      expect(platforms).toContain('linkedin')
      expect(platforms).toContain('reddit')

      // Verify each post has correct content
      const twitterPost = posts.find((p) => p.platform === 'twitter')
      const linkedinPost = posts.find((p) => p.platform === 'linkedin')
      const redditPost = posts.find((p) => p.platform === 'reddit')

      expect((twitterPost?.content as { text: string })?.text).toContain('Big announcement')
      expect((linkedinPost?.content as { text: string })?.text).toContain('Thrilled to announce')
      expect((redditPost?.content as { subreddit: string })?.subreddit).toBe('startups')
    })
  })

  test.describe('Campaign Post Management', () => {
    test('should add existing post to a campaign', async ({ page }) => {
      // Create a post first (without campaign)
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Standalone post that will be added to campaign')
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Get the post ID
      const posts = await getAllPosts(page)
      expect(posts.length).toBe(1)
      const postId = posts[0].id

      // Create a campaign
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Campaign for Existing Posts')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)
      const campaignId = page.url().split('/campaigns/')[1]

      // Click "Add Existing Post" button
      const addExistingButton = page.getByRole('button', { name: /add existing post/i })
      await expect(addExistingButton).toBeVisible({ timeout: 10000 })
      await addExistingButton.click()

      // Wait for modal and select the existing post
      const modal = page.locator('.fixed.inset-0')
      await expect(modal).toBeVisible()
      await modal.getByText('Standalone post that will be added').click()

      // Wait for modal to close
      await expect(modal).not.toBeVisible({ timeout: 10000 })

      // Verify post is now in the campaign
      const campaignPosts = await getCampaignPosts(page, campaignId)
      expect(campaignPosts.length).toBe(1)
      expect(campaignPosts[0].id).toBe(postId)
    })

    test('should remove post from campaign', async ({ page }) => {
      // Create campaign with a post
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Campaign to Remove Post From')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)
      const campaignId = page.url().split('/campaigns/')[1]

      // Create a post in the campaign
      await goToNewPost(page)
      await selectPlatform(page, 'twitter')
      await fillContent(page, 'Post to be removed from campaign')
      await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
      await page.getByText('Campaign to Remove Post From').click()
      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify post is in campaign
      let campaignPosts = await getCampaignPosts(page, campaignId)
      expect(campaignPosts.length).toBe(1)

      // Go to campaign detail
      await page.goto(`/campaigns/${campaignId}`)

      // Find and click remove button for the post
      await page
        .locator('button')
        .filter({ has: page.locator('svg.lucide-x') })
        .first()
        .click()

      // Wait for the post card to disappear from the UI
      await expect(page.getByText('Post to be removed from campaign')).not.toBeVisible()

      // Verify post is removed from campaign
      campaignPosts = await getCampaignPosts(page, campaignId)
      expect(campaignPosts.length).toBe(0)

      // Verify post still exists (just unlinked)
      const allPosts = await getAllPosts(page)
      expect(allPosts.length).toBe(1)
      // campaignId should be null or undefined after removing from campaign
      expect(allPosts[0].campaignId == null).toBe(true)
    })
  })

  test.describe('Campaign Filtering', () => {
    test('should filter campaigns by status', async ({ page }) => {
      // Create two campaigns (both will be 'active' by default)
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('First Campaign')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)

      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Second Campaign')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)

      // Go back to campaigns list
      await page.goto('/campaigns')
      await expect(page.getByRole('heading', { name: 'Campaigns', exact: true })).toBeVisible({
        timeout: 15000,
      })

      // Verify both campaigns appear (both should be active by default)
      await expect(page.getByText('First Campaign')).toBeVisible()
      await expect(page.getByText('Second Campaign')).toBeVisible()

      // Filter by active should show both
      const activeFilter = page.getByRole('tab', { name: /active/i })
      await activeFilter.click()
      await expect(page.getByText('First Campaign')).toBeVisible()
      await expect(page.getByText('Second Campaign')).toBeVisible()

      // Filter by paused should show none (since default status is active)
      const pausedFilter = page.getByRole('tab', { name: /paused/i })
      await pausedFilter.click()
      // Wait for the empty state to appear
      await expect(page.getByText(/no paused campaigns/i)).toBeVisible()
      // Campaign cards should be hidden
      await expect(
        page.locator('a[href^="/campaigns/"]').filter({ hasText: 'First Campaign' })
      ).not.toBeVisible()
      await expect(
        page.locator('a[href^="/campaigns/"]').filter({ hasText: 'Second Campaign' })
      ).not.toBeVisible()

      // Show all should show both again
      const allFilter = page.getByRole('tab', { name: /all/i })
      await allFilter.click()
      await expect(page.getByText('First Campaign')).toBeVisible()
      await expect(page.getByText('Second Campaign')).toBeVisible()
    })
  })

  test.describe('Empty States', () => {
    test('should show empty state when no campaigns exist', async ({ page }) => {
      // Navigate to campaigns page with fresh database (reset in beforeEach)
      await page.goto('/campaigns')

      // Should show empty state message "No campaigns yet"
      await expect(page.getByText('No campaigns yet')).toBeVisible()

      // Should have "Create Your First Campaign" button
      await expect(page.getByRole('button', { name: /create your first campaign/i })).toBeVisible()
    })

    test('should show empty state for campaign with no posts', async ({ page }) => {
      // Create a new campaign
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Empty Campaign')
      await page.getByRole('button', { name: /create campaign/i }).click()

      // Wait for navigation to detail page
      await page.waitForURL(/\/campaigns\//)

      // Should show empty posts message "No posts yet"
      await expect(page.getByText('No posts yet')).toBeVisible()

      // Should have "Create First Post" link (exact match to avoid multiple matches)
      await expect(page.getByRole('link', { name: 'Create First Post' })).toBeVisible()
    })
  })

  test.describe('Campaign Post Count', () => {
    test('should display post count on campaign detail page', async ({ page }) => {
      // Create a campaign
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Count Test Campaign')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)

      // Should initially show "0 posts"
      await expect(page.getByText('0 posts')).toBeVisible()

      const campaignId = page.url().split('/campaigns/')[1]

      // Create 2 posts in this campaign
      for (let i = 0; i < 2; i++) {
        await goToNewPost(page)
        await selectPlatform(page, 'twitter')
        await fillContent(page, `Post ${i + 1} for count test`)
        await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
        await page.getByText('Count Test Campaign').click()
        await saveDraft(page)
        await waitForNavigation(page, '/')
      }

      // Go back to campaign detail page
      await page.goto(`/campaigns/${campaignId}`)

      // Should now show "2 posts"
      await expect(page.getByText('2 posts')).toBeVisible()
    })

    test('should update post count when posts are removed from campaign', async ({ page }) => {
      // Create a campaign with 2 posts
      await page.goto('/campaigns')
      await page.getByRole('button', { name: /new campaign|new$/i }).click()
      await page.getByPlaceholder(/enter campaign name/i).fill('Update Count Campaign')
      await page.getByRole('button', { name: /create campaign/i }).click()
      await page.waitForURL(/\/campaigns\//)
      const campaignId = page.url().split('/campaigns/')[1]

      // Create 2 posts
      for (let i = 0; i < 2; i++) {
        await goToNewPost(page)
        await selectPlatform(page, 'twitter')
        await fillContent(page, `Removable post ${i + 1}`)
        await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
        await page.getByText('Update Count Campaign').click()
        await saveDraft(page)
        await waitForNavigation(page, '/')
      }

      // Go to campaign detail - should show "2 posts"
      await page.goto(`/campaigns/${campaignId}`)
      await expect(page.getByText('2 posts')).toBeVisible()

      // Remove one post via the X button
      await page
        .locator('button')
        .filter({ has: page.locator('svg.lucide-x') })
        .first()
        .click()

      // Wait for UI to update and verify count changed to "1 post"
      await expect(page.getByText('1 post')).toBeVisible({ timeout: 5000 })
    })
  })
})
