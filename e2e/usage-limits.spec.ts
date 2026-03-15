import { test, expect } from '@playwright/test'
import { enterDemoMode, createProjectViaAPI, getAllProjects } from './helpers'

const API_BASE = `http://localhost:${process.env.TEST_PORT || 3000}/api`

// eslint-disable-next-line max-lines-per-function
test.describe('Usage Limits', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  // ---------------------------------------------------------------------------
  // API-Level Enforcement
  // ---------------------------------------------------------------------------

   
  test.describe('API Enforcement', () => {
     
    test('should return 403 when project limit reached (free = 3)', async ({ page }) => {
      // Create 3 projects (free tier limit)
      for (let i = 1; i <= 3; i++) {
        await createProjectViaAPI(page, { name: `Project ${i}` })
      }

      // Verify all 3 exist
      const projects = await getAllProjects(page)
      expect(projects.length).toBe(3)

      // Try to create 4th - should return 403
      const response = await page.request.post(`${API_BASE}/projects`, {
        data: { name: 'Project 4 - Over Limit' },
      })
      expect(response.status()).toBe(403)
      const body = await response.json()
      expect(body.error).toBe('Project limit reached')
      expect(body.limit).toBe(3)
      expect(body.current).toBe(3)
    })

     
    test('should return 403 when campaign limit reached (free = 5)', async ({ page }) => {
      // Create 5 campaigns (free tier limit)
      for (let i = 1; i <= 5; i++) {
        const response = await page.request.post(`${API_BASE}/campaigns`, {
          data: { name: `Campaign ${i}` },
        })
        expect(response.ok()).toBe(true)
      }

      // Try to create 6th
      const response = await page.request.post(`${API_BASE}/campaigns`, {
        data: { name: 'Campaign 6 - Over Limit' },
      })
      expect(response.status()).toBe(403)
      const body = await response.json()
      expect(body.error).toBe('Campaign limit reached')
      expect(body.limit).toBe(5)
      expect(body.current).toBe(5)
    })

     
    test('should allow creation when under the limit', async ({ page }) => {
      // Create 2 projects (under free limit of 3)
      await createProjectViaAPI(page, { name: 'Project 1' })
      await createProjectViaAPI(page, { name: 'Project 2' })

      // 3rd should succeed
      const response = await page.request.post(`${API_BASE}/projects`, {
        data: { name: 'Project 3' },
      })
      expect(response.status()).toBe(201)
    })
  })

  // ---------------------------------------------------------------------------
  // Plan API
  // ---------------------------------------------------------------------------

   
  test.describe('Plan API', () => {
     
    test('should return plan info with correct counts', async ({ page }) => {
      // Create some resources
      await createProjectViaAPI(page, { name: 'Plan Test Project' })
      await page.request.post(`${API_BASE}/campaigns`, {
        data: { name: 'Plan Test Campaign' },
      })

      // Fetch plan info
      const response = await page.request.get(`${API_BASE}/plan`)
      expect(response.ok()).toBe(true)

      const data = await response.json()
      expect(data.plan).toBe('free')
      expect(data.limits.projects.current).toBe(1)
      expect(data.limits.projects.limit).toBe(3)
      expect(data.limits.campaigns.current).toBe(1)
      expect(data.limits.campaigns.limit).toBe(5)
      expect(data.limits.posts.current).toBe(0)
      expect(data.limits.posts.limit).toBe(50)
      expect(data.storage.usedBytes).toBe(0)
      expect(data.storage.limitBytes).toBe(50 * 1024 * 1024)
    })
  })

  // ---------------------------------------------------------------------------
  // UI Enforcement — LimitGate
  // ---------------------------------------------------------------------------

   
  test.describe('UI Enforcement', () => {
     
    test('should disable create button and show upgrade modal at project limit', async ({
      page,
    }) => {
      // Create 3 projects to reach the free limit
      for (let i = 1; i <= 3; i++) {
        await createProjectViaAPI(page, { name: `Project ${i}` })
      }

      // Navigate to projects page — PlanInitializer will fetch plan data
      await page.goto('/projects')
      await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()

      // Wait for plan data to load (PlanInitializer fetches on mount)
      await expect(page.getByRole('button', { name: /new project/i })).toBeVisible({
        timeout: 10000,
      })

      // The "New Project" button should be aria-disabled
      const newProjectButton = page.getByRole('button', { name: /new project/i })
      await expect(newProjectButton).toBeVisible()
      await expect(newProjectButton).toHaveAttribute('aria-disabled', 'true')

      // Click it — force:true since aria-disabled prevents Playwright's default click
      await newProjectButton.click({ force: true })

      // Upgrade modal should appear with limit info
      await expect(page.getByText(/limit reached/i)).toBeVisible()
      await expect(page.getByText('3 / 3')).toBeVisible()
      await expect(page.getByText('Coming Soon', { exact: true })).toBeVisible()

      // Dismiss modal
      await page.getByRole('button', { name: /got it/i }).click()
      await expect(page.getByText(/limit reached/i)).not.toBeVisible()
    })

     
    test('should not disable create button when under limit', async ({ page }) => {
      // Create 1 project (under limit)
      await createProjectViaAPI(page, { name: 'Under Limit Project' })

      // Navigate to projects
      await page.goto('/projects')
      await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()

      // Wait for plan data to load
      await expect(page.getByRole('button', { name: /new project/i })).toBeVisible({
        timeout: 10000,
      })

      // The button should NOT be disabled
      const newProjectButton = page.getByRole('button', { name: /new project/i })
      await expect(newProjectButton).toBeVisible()
      await expect(newProjectButton).not.toHaveAttribute('aria-disabled', 'true')
    })
  })

  // ---------------------------------------------------------------------------
  // Settings Page — Plan Display
  // ---------------------------------------------------------------------------

   
  test.describe('Settings Page Plan Display', () => {
     
    test('should show Free plan badge and beta messaging', async ({ page }) => {
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Should show Plan & Usage section with Free badge and beta messaging
      await expect(page.getByText('Plan & Usage')).toBeVisible()
      await expect(page.getByText('Free', { exact: true })).toBeVisible()
      await expect(page.getByText('Free during beta')).toBeVisible()
    })

     
    test('should show usage bars with correct counts', async ({ page }) => {
      // Create some resources to show in usage bars
      await createProjectViaAPI(page, { name: 'Settings Test Project 1' })
      await createProjectViaAPI(page, { name: 'Settings Test Project 2' })
      await page.request.post(`${API_BASE}/campaigns`, {
        data: { name: 'Settings Test Campaign' },
      })

      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Wait for plan data to load — usage bars appear after plan fetch
      await expect(page.getByText('Plan & Usage')).toBeVisible({ timeout: 10000 })

      // Should show usage bars for projects and campaigns
      await expect(page.getByText('2 / 3')).toBeVisible() // projects
      await expect(page.getByText('1 / 5')).toBeVisible() // campaigns
    })

     
    test('should show paid plans coming soon messaging', async ({ page }) => {
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Should show beta messaging instead of upgrade button
      await expect(page.getByText(/paid plans with higher limits coming soon/i)).toBeVisible()
    })
  })
})
