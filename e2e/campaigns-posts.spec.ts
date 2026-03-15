import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  goToNewPost,
  selectPlatform,
  fillContent,
  fillRedditFields,
  saveDraft,
  waitForNavigation,
  getCampaignPosts,
  getAllPosts,
} from './helpers'

async function createCampaignViaUI(
  page: import('@playwright/test').Page,
  name: string,
  description?: string
) {
  await page.goto('/campaigns')
  await page.getByRole('button', { name: /new campaign|new$/i }).click()
  await page.getByPlaceholder(/enter campaign name/i).fill(name)
  if (description) {
    await page.getByPlaceholder(/describe this campaign/i).fill(description)
  }
  await page.getByRole('button', { name: /create campaign/i }).click()
  await page.waitForURL(/\/campaigns\//)
  return page.url().split('/campaigns/')[1]
}

async function selectCampaignDropdown(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: /no campaign|select campaign/i }).click()
  await page.getByText(name).click()
}

async function createPostInCampaign(
  page: import('@playwright/test').Page,
  platform: 'twitter' | 'linkedin' | 'reddit',
  content: string,
  campaignName: string,
  redditOptions?: { subreddit: string; title: string }
) {
  await goToNewPost(page)
  await selectPlatform(page, platform)
  if (redditOptions) {
    await fillRedditFields(page, redditOptions)
  }
  await fillContent(page, content)
  await selectCampaignDropdown(page, campaignName)
  await saveDraft(page)
  await waitForNavigation(page, '/')
}

test.describe('Campaign with Reddit Post', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should create Reddit post within a campaign', async ({ page }) => {
    const campaignId = await createCampaignViaUI(page, 'Reddit Only Campaign')
    await createPostInCampaign(
      page,
      'reddit',
      'We built something cool for developers!',
      'Reddit Only Campaign',
      { subreddit: 'programming', title: 'Check out our new tool' }
    )
    const posts = await getCampaignPosts(page, campaignId)
    expect(posts.length).toBe(1)
    expect(posts[0].platform).toBe('reddit')
    expect((posts[0].content as { subreddit: string }).subreddit).toBe('programming')
  })
})

test.describe('Campaign with Multiple Platforms', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should create Twitter and LinkedIn posts in same campaign', async ({ page }) => {
    const campaignId = await createCampaignViaUI(page, 'Twitter LinkedIn Campaign')
    await createPostInCampaign(
      page,
      'twitter',
      'Exciting news! #announcement',
      'Twitter LinkedIn Campaign'
    )
    await createPostInCampaign(
      page,
      'linkedin',
      'Professional update. Stay tuned!',
      'Twitter LinkedIn Campaign'
    )
    const posts = await getCampaignPosts(page, campaignId)
    expect(posts.length).toBe(2)
    const platforms = posts.map((p) => p.platform)
    expect(platforms).toContain('twitter')
    expect(platforms).toContain('linkedin')
  })

  test('should create Twitter and Reddit posts in same campaign', async ({ page }) => {
    const campaignId = await createCampaignViaUI(page, 'Twitter Reddit Campaign')
    await createPostInCampaign(page, 'twitter', 'Check it out!', 'Twitter Reddit Campaign')
    await createPostInCampaign(
      page,
      'reddit',
      'I built a thing - feedback welcome!',
      'Twitter Reddit Campaign',
      { subreddit: 'webdev', title: 'I built a thing - feedback welcome!' }
    )
    const posts = await getCampaignPosts(page, campaignId)
    expect(posts.length).toBe(2)
    const platforms = posts.map((p) => p.platform)
    expect(platforms).toContain('twitter')
    expect(platforms).toContain('reddit')
  })

  test('should create LinkedIn and Reddit posts in same campaign', async ({ page }) => {
    const campaignId = await createCampaignViaUI(page, 'LinkedIn Reddit Campaign')
    await createPostInCampaign(
      page,
      'linkedin',
      'Open source contribution!',
      'LinkedIn Reddit Campaign'
    )
    await createPostInCampaign(
      page,
      'reddit',
      'We just released this tool as open source.',
      'LinkedIn Reddit Campaign',
      { subreddit: 'opensource', title: 'Our open source contribution' }
    )
    const posts = await getCampaignPosts(page, campaignId)
    expect(posts.length).toBe(2)
    const platforms = posts.map((p) => p.platform)
    expect(platforms).toContain('linkedin')
    expect(platforms).toContain('reddit')
  })

  test('should create all three platform posts in same campaign', async ({ page }) => {
    const name = 'Full Platform Launch'
    const campaignId = await createCampaignViaUI(page, name, 'Cross-platform campaign')
    await createPostInCampaign(page, 'twitter', 'Big announcement! #launch #tech', name)
    await createPostInCampaign(page, 'linkedin', 'Thrilled to announce our latest product!', name)
    await createPostInCampaign(page, 'reddit', 'Would love your feedback.', name, {
      subreddit: 'startups',
      title: '[Launch] We just launched - feedback welcome!',
    })
    const posts = await getCampaignPosts(page, campaignId)
    expect(posts.length).toBe(3)
    const platforms = posts.map((p) => p.platform)
    expect(platforms).toContain('twitter')
    expect(platforms).toContain('linkedin')
    expect(platforms).toContain('reddit')
  })
})

test.describe('Campaign Post Management', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should add existing post to a campaign', async ({ page }) => {
    await goToNewPost(page)
    await selectPlatform(page, 'twitter')
    await fillContent(page, 'Standalone post that will be added to campaign')
    await saveDraft(page)
    await waitForNavigation(page, '/')
    const posts = await getAllPosts(page)
    expect(posts.length).toBe(1)
    const postId = posts[0].id
    const campaignId = await createCampaignViaUI(page, 'Campaign for Existing Posts')
    const addExistingButton = page.getByRole('button', { name: /add existing post/i })
    await expect(addExistingButton).toBeVisible({ timeout: 10000 })
    await addExistingButton.click()
    const modal = page.locator('.fixed.inset-0')
    await expect(modal).toBeVisible()
    await modal.getByText('Standalone post that will be added').click()
    await expect(modal).not.toBeVisible({ timeout: 10000 })
    const campaignPosts = await getCampaignPosts(page, campaignId)
    expect(campaignPosts.length).toBe(1)
    expect(campaignPosts[0].id).toBe(postId)
  })

  test('should remove post from campaign', async ({ page }) => {
    const campaignId = await createCampaignViaUI(page, 'Campaign to Remove Post From')
    await createPostInCampaign(
      page,
      'twitter',
      'Post to be removed from campaign',
      'Campaign to Remove Post From'
    )
    let campaignPosts = await getCampaignPosts(page, campaignId)
    expect(campaignPosts.length).toBe(1)
    await page.goto(`/campaigns/${campaignId}`)
    await page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-x') })
      .first()
      .click()
    await expect(page.getByText('Post to be removed from campaign')).not.toBeVisible()
    campaignPosts = await getCampaignPosts(page, campaignId)
    expect(campaignPosts.length).toBe(0)
    const allPosts = await getAllPosts(page)
    expect(allPosts.length).toBe(1)
    expect(allPosts[0].campaignId == null).toBe(true)
  })
})

test.describe('Campaign Filtering and Empty States', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should filter campaigns by status', async ({ page }) => {
    await createCampaignViaUI(page, 'First Campaign')
    await page.goto('/campaigns')
    await createCampaignViaUI(page, 'Second Campaign')
    await page.goto('/campaigns')
    await expect(page.getByRole('heading', { name: 'Campaigns', exact: true })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByText('First Campaign')).toBeVisible()
    await expect(page.getByText('Second Campaign')).toBeVisible()
    const activeFilter = page.getByRole('tab', { name: /active/i })
    await activeFilter.click()
    await expect(page.getByText('First Campaign')).toBeVisible()
    const pausedFilter = page.getByRole('tab', { name: /paused/i })
    await pausedFilter.click()
    await expect(page.getByText(/no paused campaigns/i)).toBeVisible()
    const allFilter = page.getByRole('tab', { name: /all/i })
    await allFilter.click()
    await expect(page.getByText('First Campaign')).toBeVisible()
    await expect(page.getByText('Second Campaign')).toBeVisible()
  })

  test('should show empty state when no campaigns exist', async ({ page }) => {
    await page.goto('/campaigns')
    await expect(page.getByText('No campaigns yet')).toBeVisible()
    await expect(page.getByRole('button', { name: /create your first campaign/i })).toBeVisible()
  })

  test('should show empty state for campaign with no posts', async ({ page }) => {
    await createCampaignViaUI(page, 'Empty Campaign')
    await expect(page.getByText('No posts yet')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Create First Post' })).toBeVisible()
  })

  test('should display post count on campaign detail page', async ({ page }) => {
    const campaignId = await createCampaignViaUI(page, 'Count Test Campaign')
    await expect(page.getByText('0 posts')).toBeVisible()
    for (let i = 0; i < 2; i++) {
      await createPostInCampaign(
        page,
        'twitter',
        `Post ${i + 1} for count test`,
        'Count Test Campaign'
      )
    }
    await page.goto(`/campaigns/${campaignId}`)
    await expect(page.getByText('2 posts')).toBeVisible()
  })

  test('should update post count when posts are removed', async ({ page }) => {
    const campaignId = await createCampaignViaUI(page, 'Update Count Campaign')
    for (let i = 0; i < 2; i++) {
      await createPostInCampaign(
        page,
        'twitter',
        `Removable post ${i + 1}`,
        'Update Count Campaign'
      )
    }
    await page.goto(`/campaigns/${campaignId}`)
    await expect(page.getByText('2 posts')).toBeVisible()
    await page
      .locator('button')
      .filter({ has: page.locator('svg.lucide-x') })
      .first()
      .click()
    await expect(page.getByText('1 post')).toBeVisible({ timeout: 5000 })
  })
})
