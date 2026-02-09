import { test, expect } from '@playwright/test'
import { enterDemoMode } from './helpers'

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test.describe('Appearance / Theme Toggle', () => {
    test('should display theme options', async ({ page }) => {
      await page.goto('/settings')
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

      // Verify Appearance section is visible
      await expect(page.getByText(/appearance/i)).toBeVisible()

      // Verify all three theme buttons are visible
      await expect(page.locator('button').filter({ hasText: 'Light' })).toBeVisible()
      await expect(page.locator('button').filter({ hasText: 'Dark' })).toBeVisible()
      await expect(page.locator('button').filter({ hasText: 'System' })).toBeVisible()
    })

    test('should switch to dark theme', async ({ page }) => {
      await page.goto('/settings')

      // Click Dark button
      const darkButton = page.locator('button').filter({ hasText: 'Dark' })
      await darkButton.click()

      // Verify html element has dark class
      const htmlElement = page.locator('html')
      await expect(htmlElement).toHaveClass(/dark/)

      // Verify button is active (has bg-primary)
      await expect(darkButton).toHaveClass(/bg-primary/)

      // Verify localStorage is updated
      const theme = await page.evaluate(() => localStorage.getItem('bullhorn-theme'))
      expect(theme).toBe('dark')
    })

    test('should switch to light theme', async ({ page }) => {
      await page.goto('/settings')

      // First switch to dark to ensure we're changing state
      await page.locator('button').filter({ hasText: 'Dark' }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)

      // Click Light button
      const lightButton = page.locator('button').filter({ hasText: 'Light' })
      await lightButton.click()

      // Verify html element has light class
      const htmlElement = page.locator('html')
      await expect(htmlElement).toHaveClass(/light/)

      // Verify button is active (has bg-primary)
      await expect(lightButton).toHaveClass(/bg-primary/)

      // Verify localStorage is updated
      const theme = await page.evaluate(() => localStorage.getItem('bullhorn-theme'))
      expect(theme).toBe('light')
    })

    test('should switch to system theme', async ({ page }) => {
      await page.goto('/settings')

      // Click System button
      const systemButton = page.locator('button').filter({ hasText: 'System' })
      await systemButton.click()

      // Verify button is active (has bg-primary)
      await expect(systemButton).toHaveClass(/bg-primary/)

      // Verify localStorage is updated
      const theme = await page.evaluate(() => localStorage.getItem('bullhorn-theme'))
      expect(theme).toBe('system')

      // Verify html element has either light or dark class based on system preference
      const htmlElement = page.locator('html')
      const htmlClass = await htmlElement.getAttribute('class')
      expect(htmlClass).toMatch(/light|dark/)
    })

    test('should persist theme after reload', async ({ page }) => {
      await page.goto('/settings')

      // Set dark theme
      await page.locator('button').filter({ hasText: 'Dark' }).click()
      await expect(page.locator('html')).toHaveClass(/dark/)

      // Reload page
      await page.reload()

      // Verify dark theme persists (html class and localStorage)
      await expect(page.locator('html')).toHaveClass(/dark/)
      const darkTheme = await page.evaluate(() => localStorage.getItem('bullhorn-theme'))
      expect(darkTheme).toBe('dark')

      // Set light theme
      await page.locator('button').filter({ hasText: 'Light' }).click()
      await expect(page.locator('html')).toHaveClass(/light/)

      // Reload page
      await page.reload()

      // Verify light theme persists (html class and localStorage)
      await expect(page.locator('html')).toHaveClass(/light/)
      const lightTheme = await page.evaluate(() => localStorage.getItem('bullhorn-theme'))
      expect(lightTheme).toBe('light')
    })

    test('should switch between all themes in sequence', async ({ page }) => {
      await page.goto('/settings')

      // Start with light
      const lightButton = page.locator('button').filter({ hasText: 'Light' })
      await lightButton.click()
      await expect(page.locator('html')).toHaveClass(/light/)
      await expect(lightButton).toHaveClass(/bg-primary/)

      // Switch to dark
      const darkButton = page.locator('button').filter({ hasText: 'Dark' })
      await darkButton.click()
      await expect(page.locator('html')).toHaveClass(/dark/)
      await expect(darkButton).toHaveClass(/bg-primary/)
      await expect(lightButton).not.toHaveClass(/bg-primary/)

      // Switch to system
      const systemButton = page.locator('button').filter({ hasText: 'System' })
      await systemButton.click()
      await expect(systemButton).toHaveClass(/bg-primary/)
      await expect(darkButton).not.toHaveClass(/bg-primary/)

      // Switch back to light
      await lightButton.click()
      await expect(page.locator('html')).toHaveClass(/light/)
      await expect(lightButton).toHaveClass(/bg-primary/)
      await expect(systemButton).not.toHaveClass(/bg-primary/)
    })
  })
})
