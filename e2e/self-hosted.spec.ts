import { test, expect } from '@playwright/test'
import { enterDemoMode, createProjectViaAPI, getAllProjects } from './helpers'

const API_BASE = `http://localhost:${process.env.TEST_PORT || 3000}/api`

/**
 * Self-hosted mode E2E tests.
 *
 * These tests run with SELF_HOSTED=true set in the environment.
 * They verify behavioral differences from SaaS mode:
 *  - Plan enforcement is disabled (unlimited resources)
 *  - /api/plan returns the selfHosted plan type
 *  - Settings page shows self-hosted branding (no "Free" badge)
 *  - Reddit script auth endpoint is accessible (not gated behind SaaS)
 */

// eslint-disable-next-line max-lines-per-function
test.describe('Self-Hosted Mode', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  // ---------------------------------------------------------------------------
  // Plan Enforcement Bypass
  // ---------------------------------------------------------------------------

  test.describe('Plan Enforcement Bypass', () => {
    test('should allow creating more than 3 projects (free tier limit)', async ({ page }) => {
      // Free tier limit is 3 projects — self-hosted mode has no limit
      for (let i = 1; i <= 4; i++) {
        await createProjectViaAPI(page, { name: `SH Project ${i}` })
      }

      const projects = await getAllProjects(page)
      expect(projects.length).toBe(4)
    })

    test('should allow creating more than 5 campaigns (free tier limit)', async ({ page }) => {
      // Free tier limit is 5 campaigns — self-hosted mode has no limit
      for (let i = 1; i <= 6; i++) {
        const response = await page.request.post(`${API_BASE}/campaigns`, {
          data: { name: `SH Campaign ${i}` },
        })
        expect(response.ok()).toBe(true)
      }
    })

    test('should not disable create button at free tier limit', async ({ page }) => {
      // Create 3 projects (would be the limit on free tier)
      for (let i = 1; i <= 3; i++) {
        await createProjectViaAPI(page, { name: `SH Project ${i}` })
      }

      await page.goto('/projects')
      await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()

      // Wait for plan data to load
      const newProjectButton = page.getByRole('button', { name: /new project/i })
      await expect(newProjectButton).toBeVisible({ timeout: 10000 })

      // In self-hosted mode, the button should NOT be disabled even at 3 projects
      await expect(newProjectButton).not.toHaveAttribute('aria-disabled', 'true')
    })
  })

  // ---------------------------------------------------------------------------
  // Plan API
  // ---------------------------------------------------------------------------

  test.describe('Plan API', () => {
    test('should return selfHosted plan with unlimited limits', async ({ page }) => {
      const response = await page.request.get(`${API_BASE}/plan`)
      expect(response.ok()).toBe(true)

      const data = await response.json()
      expect(data.plan).toBe('selfHosted')

      // All resource limits should be MAX_SAFE_INTEGER
      expect(data.limits.posts.limit).toBe(Number.MAX_SAFE_INTEGER)
      expect(data.limits.projects.limit).toBe(Number.MAX_SAFE_INTEGER)
      expect(data.limits.campaigns.limit).toBe(Number.MAX_SAFE_INTEGER)
      expect(data.limits.blogDrafts.limit).toBe(Number.MAX_SAFE_INTEGER)
      expect(data.limits.launchPosts.limit).toBe(Number.MAX_SAFE_INTEGER)
      expect(data.limits.apiKeys.limit).toBe(Number.MAX_SAFE_INTEGER)
    })

    test('should have autoPublish enabled', async ({ page }) => {
      const response = await page.request.get(`${API_BASE}/plan`)
      const data = await response.json()
      expect(data.features.autoPublish).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Settings Page — Self-Hosted Plan Display
  // ---------------------------------------------------------------------------

  test.describe('Settings Page', () => {
    test('should show Self-Hosted badge instead of Free', async ({ page }) => {
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Wait for plan data to load
      await expect(page.getByText('Plan & Usage')).toBeVisible({ timeout: 10000 })

      // Should show "Self-Hosted" badge
      await expect(page.getByText('Self-Hosted', { exact: true })).toBeVisible()

      // Should NOT show "Free" badge
      await expect(page.getByText('Free', { exact: true })).not.toBeVisible()
    })

    test('should show unlimited messaging instead of usage bars', async ({ page }) => {
      await page.goto('/settings')
      await expect(page.getByText('Plan & Usage')).toBeVisible({ timeout: 10000 })

      // Should show unlimited messaging
      await expect(page.getByText(/all features and resources are unlimited/i)).toBeVisible()

      // Should NOT show free tier messaging
      await expect(page.getByText('Free during beta')).not.toBeVisible()
      await expect(page.getByText(/paid plans with higher limits coming soon/i)).not.toBeVisible()
    })
  })

  // ---------------------------------------------------------------------------
  // Reddit Script Auth Endpoint
  // ---------------------------------------------------------------------------

  test.describe('Reddit Script Auth', () => {
    test('should be accessible in self-hosted mode (not 403)', async ({ page }) => {
      // In SaaS mode, this endpoint returns 403 "only available in self-hosted mode"
      // In self-hosted mode, it should return 500 "credentials not configured" (no Reddit env vars)
      const response = await page.request.post(`${API_BASE}/social-accounts/reddit/connect`)

      // Should NOT be 403 (that would mean the self-hosted gate failed)
      expect(response.status()).not.toBe(403)

      // Without Reddit credentials in env, expect 500 with descriptive error
      expect(response.status()).toBe(500)
      const data = await response.json()
      expect(data.error).toContain('Reddit credentials not configured')
    })
  })
})
