import { Page, expect } from '@playwright/test'
import { type PostFromAPI } from './helpers-posts'

const PORT = process.env.TEST_PORT || 3000
const API_BASE = `http://localhost:${PORT}/api`

export interface CampaignFromAPI {
  id: string
  name: string
  description?: string
  status: 'draft' | 'active' | 'completed' | 'archived'
  projectId?: string
  createdAt: string
  updatedAt: string
}

export async function goToCampaigns(page: Page) {
  await page.goto('/campaigns')
  await expect(page.getByRole('heading', { name: /campaigns/i })).toBeVisible()
}

export async function goToNewCampaign(page: Page) {
  await page.goto('/campaigns/new')
  await expect(page.getByRole('heading', { name: /create campaign/i })).toBeVisible()
}

export async function fillCampaignName(page: Page, name: string) {
  await page.getByPlaceholder(/campaign name/i).fill(name)
}

export async function fillCampaignDescription(page: Page, description: string) {
  await page.getByPlaceholder(/describe your campaign/i).fill(description)
}

export async function createCampaign(page: Page, options: { name: string; description?: string }) {
  await goToNewCampaign(page)
  await fillCampaignName(page, options.name)
  if (options.description) {
    await fillCampaignDescription(page, options.description)
  }
  await page.getByRole('button', { name: /create campaign/i }).click()
}

export async function getAllCampaigns(page: Page): Promise<CampaignFromAPI[]> {
  const response = await page.request.get(`${API_BASE}/campaigns`)
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to get campaigns: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = await response.json()
  return data.campaigns
}

export async function getCampaignById(page: Page, id: string): Promise<CampaignFromAPI | null> {
  const response = await page.request.get(`${API_BASE}/campaigns/${id}`)
  if (!response.ok()) return null
  const data = await response.json()
  return data.campaign
}

export async function getCampaignPosts(page: Page, campaignId: string): Promise<PostFromAPI[]> {
  const response = await page.request.get(`${API_BASE}/campaigns/${campaignId}/posts`)
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to get campaign posts: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = await response.json()
  return data.posts
}

export async function clickCampaign(page: Page, index: number = 0) {
  const cards = page
    .locator('a[href^="/campaigns/"]')
    .filter({ hasNot: page.locator('a[href="/campaigns/new"]') })
  await cards.nth(index).click()
}

export async function selectCampaignInEditor(page: Page, campaignName: string) {
  await page.getByRole('button', { name: /select campaign|no campaign/i }).click()
  await page.getByRole('option', { name: campaignName }).click()
}

export async function deleteCampaign(page: Page) {
  await page.getByRole('button', { name: /delete/i }).click()
  await page.getByRole('alertdialog').waitFor()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
}
