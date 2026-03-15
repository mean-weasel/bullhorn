import { Page, expect } from '@playwright/test'
import { type CampaignFromAPI } from './helpers-campaigns'

const PORT = process.env.TEST_PORT || 3000
const API_BASE = `http://localhost:${PORT}/api`

interface ProjectFromAPI {
  id: string
  name: string
  description?: string
  hashtags: string[]
  brandColors: Record<string, string>
  logoUrl?: string
  createdAt: string
  updatedAt: string
}

interface ProjectListResponse {
  projects: ProjectFromAPI[]
}

export async function goToProjects(page: Page) {
  await page.goto('/projects')
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
}

export async function getAllProjects(page: Page): Promise<ProjectFromAPI[]> {
  const response = await page.request.get(`${API_BASE}/projects`)
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to get projects: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = (await response.json()) as ProjectListResponse
  return data.projects
}

export async function getProjectById(page: Page, id: string): Promise<ProjectFromAPI | null> {
  const response = await page.request.get(`${API_BASE}/projects/${id}`)
  if (!response.ok()) return null
  const data = await response.json()
  return data.project
}

export async function getProjectCampaigns(
  page: Page,
  projectId: string
): Promise<CampaignFromAPI[]> {
  const response = await page.request.get(`${API_BASE}/projects/${projectId}/campaigns`)
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to get project campaigns: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = await response.json()
  return data.campaigns
}

export async function createProjectViaAPI(
  page: Page,
  options: { name: string; description?: string }
): Promise<ProjectFromAPI> {
  const response = await page.request.post(`${API_BASE}/projects`, {
    data: {
      name: options.name,
      description: options.description,
    },
  })
  if (!response.ok()) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      `Failed to create project: ${response.status()} - ${errorData.error || response.statusText()}`
    )
  }
  const data = await response.json()
  return data.project
}

export async function createProject(page: Page, options: { name: string; description?: string }) {
  await goToProjects(page)
  await page.getByRole('button', { name: /new project|new$/i }).click()
  await page.getByPlaceholder(/enter project name/i).fill(options.name)
  if (options.description) {
    await page.getByPlaceholder(/describe this project/i).fill(options.description)
  }
  await page.getByRole('button', { name: /create project/i }).click()
  await page.waitForURL(/\/projects\//)
}
