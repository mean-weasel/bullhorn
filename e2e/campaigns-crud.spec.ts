import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  goToNewPost,
  selectPlatform,
  fillContent,
  saveDraft,
  waitForNavigation,
  getAllCampaigns,
  getCampaignPosts,
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
  campaignName: string
) {
  await goToNewPost(page)
  await selectPlatform(page, platform)
  await fillContent(page, content)
  await selectCampaignDropdown(page, campaignName)
  await saveDraft(page)
  await waitForNavigation(page, '/')
}

test.describe('Campaign CRUD Operations', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should create a new campaign', async ({ page }) => {
    await createCampaignViaUI(
      page,
      'Product Launch 2024',
      'Marketing campaign for new product release'
    )
    await expect(page.getByText('Product Launch 2024')).toBeVisible()
    const campaigns = await getAllCampaigns(page)
    expect(campaigns.length).toBe(1)
    expect(campaigns[0].name).toBe('Product Launch 2024')
    expect(campaigns[0].description).toBe('Marketing campaign for new product release')
  })

  test('should edit a campaign name and description', async ({ page }) => {
    await createCampaignViaUI(page, 'Edit Test Campaign')
    await expect(page.getByRole('heading', { name: 'Edit Test Campaign' })).toBeVisible()
    const editButton = page.locator('h1').locator('..').locator('button').first()
    await editButton.click()
    const nameInput = page.locator('input[type="text"]').first()
    await expect(nameInput).toBeVisible()
    await nameInput.clear()
    await nameInput.fill('Updated Campaign Name')
    const descInput = page.locator('textarea').first()
    await descInput.fill('New description for the campaign')
    await page.getByRole('button', { name: /^save$/i }).click()
    await expect(page.getByRole('heading', { name: 'Updated Campaign Name' })).toBeVisible()
    await expect(page.getByText('New description for the campaign')).toBeVisible()
    const campaigns = await getAllCampaigns(page)
    expect(campaigns[0].name).toBe('Updated Campaign Name')
  })

  test('should change campaign status', async ({ page }) => {
    await createCampaignViaUI(page, 'Status Test')
    await page.getByRole('button', { name: 'Active' }).click()
    const campaigns = await getAllCampaigns(page)
    expect(campaigns[0].status).toBe('active')
  })

  test('should delete a campaign', async ({ page }) => {
    await createCampaignViaUI(page, 'Campaign to Delete')
    let campaigns = await getAllCampaigns(page)
    expect(campaigns.length).toBe(1)
    const deleteButton = page.getByTitle('Delete campaign')
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()
    const dialog = page.getByRole('alertdialog')
    await dialog.waitFor({ state: 'visible' })
    await dialog.getByRole('button', { name: 'Delete' }).click()
    await page.waitForURL('/campaigns')
    campaigns = await getAllCampaigns(page)
    expect(campaigns.length).toBe(0)
  })
})

test.describe('Campaign with Single Platform', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should create Twitter post within a campaign', async ({ page }) => {
    const campaignId = await createCampaignViaUI(page, 'Twitter Only Campaign')
    await goToNewPost(page)
    await selectPlatform(page, 'twitter')
    await fillContent(page, 'This is a Twitter post for our campaign! #marketing')
    const campaignButton = page.locator('button').filter({ hasText: /no campaign/i })
    await expect(campaignButton).toBeVisible({ timeout: 10000 })
    await campaignButton.click()
    const dropdown = page.locator('.absolute.z-20')
    await dropdown.waitFor()
    await dropdown.getByText('Twitter Only Campaign').click()
    await expect(page.locator('button').filter({ hasText: 'Twitter Only Campaign' })).toBeVisible()
    await saveDraft(page)
    await waitForNavigation(page, '/')
    const posts = await getCampaignPosts(page, campaignId)
    expect(posts.length).toBe(1)
    expect(posts[0].platform).toBe('twitter')
  })

  test('should create LinkedIn post within a campaign', async ({ page }) => {
    const campaignId = await createCampaignViaUI(page, 'LinkedIn Only Campaign')
    await createPostInCampaign(
      page,
      'linkedin',
      'Professional update for LinkedIn. Excited to share our latest developments.',
      'LinkedIn Only Campaign'
    )
    const posts = await getCampaignPosts(page, campaignId)
    expect(posts.length).toBe(1)
    expect(posts[0].platform).toBe('linkedin')
  })
})
