import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
    })

    test('should display login page with all elements', async ({ page }) => {
      // Check heading
      await expect(page.getByRole('heading', { name: 'Bullhorn' })).toBeVisible()
      await expect(page.getByText('Sign in to manage your social posts')).toBeVisible()

      // Check email/password form
      await expect(page.getByLabel('Email')).toBeVisible()
      await expect(page.getByLabel('Password')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()

      // Check Google OAuth button
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()

      // Check sign up link
      await expect(page.getByText("Don't have an account?")).toBeVisible()
      await expect(page.getByRole('link', { name: 'Sign up' })).toBeVisible()
    })

    test('should show error for invalid credentials', async ({ page }) => {
      // Fill in form with invalid credentials
      await page.getByLabel('Email').fill('invalid@example.com')
      await page.getByLabel('Password').fill('wrongpassword')

      // Submit form
      await page.getByRole('button', { name: 'Sign in' }).click()

      // Wait for error message (Supabase returns "Invalid login credentials")
      await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 10000 })
    })

    test('should require email field', async ({ page }) => {
      // Try to submit with only password
      await page.getByLabel('Password').fill('somepassword')
      await page.getByRole('button', { name: 'Sign in' }).click()

      // Email field should show validation error (HTML5 validation)
      const emailInput = page.getByLabel('Email')
      await expect(emailInput).toHaveAttribute('required', '')
    })

    test('should require password field', async ({ page }) => {
      // Try to submit with only email
      await page.getByLabel('Email').fill('test@example.com')
      await page.getByRole('button', { name: 'Sign in' }).click()

      // Password field should have required attribute
      const passwordInput = page.getByLabel('Password')
      await expect(passwordInput).toHaveAttribute('required', '')
    })

    test('should navigate to signup page', async ({ page }) => {
      await page.getByRole('link', { name: 'Sign up' }).click()
      await expect(page).toHaveURL('/signup', { timeout: 15000 })
    })

    test('should have forgot password link', async ({ page }) => {
      await expect(page.getByRole('link', { name: 'Forgot password?' })).toBeVisible()
    })

    test('should navigate to forgot password page', async ({ page }) => {
      await page.getByRole('link', { name: 'Forgot password?' }).click()
      await expect(page).toHaveURL('/forgot-password', { timeout: 15000 })
    })

    test('should show loading state when signing in', async ({ page }) => {
      await page.getByLabel('Email').fill('test@example.com')
      await page.getByLabel('Password').fill('password123')

      // Track whether the button was ever disabled during form submission
      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]')
        if (btn) {
          const w = window as unknown as Record<string, boolean>
          w.__btnWasDisabled = false
          new MutationObserver(() => {
            if ((btn as HTMLButtonElement).disabled) {
              w.__btnWasDisabled = true
            }
          }).observe(btn, { attributes: true, attributeFilter: ['disabled'] })
        }
      })

      const signInButton = page.getByRole('button', { name: /sign in/i })
      await signInButton.click()

      // Wait for the full submit cycle (loading → error → idle)
      await expect(page.getByText(/invalid|error|failed/i)).toBeVisible({ timeout: 10000 })

      // Verify the button was disabled at some point during loading
      const wasDisabled = await page.evaluate(
        () => (window as unknown as Record<string, boolean>).__btnWasDisabled
      )
      expect(wasDisabled).toBe(true)
    })
  })

  test.describe('Signup Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/signup')
    })

    test('should display signup page with all elements', async ({ page }) => {
      // Check heading
      await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()
      await expect(page.getByText('Get started with Bullhorn')).toBeVisible()

      // Check form fields
      await expect(page.getByLabel('Email')).toBeVisible()
      await expect(page.getByLabel('Password', { exact: true })).toBeVisible()
      await expect(page.getByLabel('Confirm Password')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()

      // Check Google OAuth button
      await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible()

      // Check login link
      await expect(page.getByText('Already have an account?')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
    })

    test('should show error when passwords do not match', async ({ page }) => {
      await page.getByLabel('Email').fill('newuser@example.com')
      await page.getByLabel('Password', { exact: true }).fill('password123')
      await page.getByLabel('Confirm Password').fill('differentpassword')

      await page.getByRole('button', { name: 'Create account' }).click()

      await expect(page.getByText('Passwords do not match')).toBeVisible()
    })

    test('should have password minimum length validation via HTML5', async ({ page }) => {
      // Verify HTML5 minLength attribute is set for browser validation
      const passwordInput = page.getByLabel('Password', { exact: true })
      const confirmInput = page.getByLabel('Confirm Password')

      await expect(passwordInput).toHaveAttribute('minLength', '8')
      await expect(confirmInput).toHaveAttribute('minLength', '8')
    })

    test('should require all fields via HTML5', async ({ page }) => {
      // Check that all fields have required attribute for browser validation
      await expect(page.getByLabel('Email')).toHaveAttribute('required', '')
      await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('required', '')
      await expect(page.getByLabel('Confirm Password')).toHaveAttribute('required', '')
    })

    test('should navigate to login page', async ({ page }) => {
      await page.getByRole('link', { name: 'Sign in' }).click()
      await expect(page).toHaveURL('/login', { timeout: 15000 })
    })

    test('should show loading state when creating account', async ({ page }) => {
      await page.getByLabel('Email').fill('newuser@example.com')
      await page.getByLabel('Password', { exact: true }).fill('password123')
      await page.getByLabel('Confirm Password').fill('password123')

      // Track whether the button was ever disabled during form submission
      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]')
        if (btn) {
          const w = window as unknown as Record<string, boolean>
          w.__btnWasDisabled = false
          new MutationObserver(() => {
            if ((btn as HTMLButtonElement).disabled) {
              w.__btnWasDisabled = true
            }
          }).observe(btn, { attributes: true, attributeFilter: ['disabled'] })
        }
      })

      const createButton = page.getByRole('button', { name: /create account/i })
      await createButton.click()

      // Should show loading text briefly then complete
      await expect(createButton).not.toBeDisabled({ timeout: 10000 })

      // Verify the button was disabled at some point during loading
      const wasDisabled = await page.evaluate(
        () => (window as unknown as Record<string, boolean>).__btnWasDisabled
      )
      expect(wasDisabled).toBe(true)
    })

    test('should validate email format via HTML5', async ({ page }) => {
      const emailInput = page.getByLabel('Email')
      await expect(emailInput).toHaveAttribute('type', 'email')
    })

    test('should show password strength indicator when typing password', async ({ page }) => {
      const passwordInput = page.getByLabel('Password', { exact: true })

      // No indicator when empty
      await expect(page.getByText('Weak')).not.toBeVisible()

      // Score 1 (Weak): 8+ chars, one criterion met
      await passwordInput.fill('abcdefgh')
      await expect(page.getByText('Weak')).toBeVisible()

      // Score 2 (Fair): 10+ chars (two criteria: length >= 8 and length >= 10)
      await passwordInput.fill('abcdefghij')
      await expect(page.getByText('Fair')).toBeVisible()

      // Score 3 (Good): 10+ chars with mixed case (three criteria)
      await passwordInput.fill('Abcdefghij')
      await expect(page.getByText('Good')).toBeVisible()

      // Score 4 (Strong): 10+ chars, mixed case, and numbers (four criteria, capped at 4)
      await passwordInput.fill('Abcdefgh12')
      await expect(page.getByText('Strong')).toBeVisible()
    })

    test('should show helpful tips for weak passwords', async ({ page }) => {
      const passwordInput = page.getByLabel('Password', { exact: true })

      // Must be >= 8 chars to show tip (score 1-2)
      await passwordInput.fill('abcdefgh')
      // Should show tip about improving password
      await expect(page.getByText(/Try adding/)).toBeVisible()
    })
  })

  test.describe('Forgot Password Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/forgot-password')
    })

    test('should display forgot password page with all elements', async ({ page }) => {
      // Check heading
      await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible()
      await expect(page.getByText("Enter your email and we'll send you a reset link")).toBeVisible()

      // Check form
      await expect(page.getByLabel('Email')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Send reset link' })).toBeVisible()

      // Check login link
      await expect(page.getByText('Remember your password?')).toBeVisible()
      await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
    })

    test('should require email field', async ({ page }) => {
      const emailInput = page.getByLabel('Email')
      await expect(emailInput).toHaveAttribute('required', '')
      await expect(emailInput).toHaveAttribute('type', 'email')
    })

    test('should show loading state when sending reset link', async ({ page }) => {
      await page.getByLabel('Email').fill('test@example.com')

      // Track whether the button was ever disabled during form submission
      await page.evaluate(() => {
        const btn = document.querySelector('button[type="submit"]')
        if (btn) {
          const w = window as unknown as Record<string, boolean>
          w.__btnWasDisabled = false
          new MutationObserver(() => {
            if ((btn as HTMLButtonElement).disabled) {
              w.__btnWasDisabled = true
            }
          }).observe(btn, { attributes: true, attributeFilter: ['disabled'] })
        }
      })

      const submitButton = page.getByRole('button', { name: /send reset link/i })
      await submitButton.click()

      // Should show loading text briefly then complete
      await expect(submitButton).not.toBeDisabled({ timeout: 10000 })

      // Verify the button was disabled at some point during loading
      const wasDisabled = await page.evaluate(
        () => (window as unknown as Record<string, boolean>).__btnWasDisabled
      )
      expect(wasDisabled).toBe(true)
    })

    test('should navigate back to login page', async ({ page }) => {
      await page.getByRole('link', { name: 'Sign in' }).click()
      await expect(page).toHaveURL('/login', { timeout: 15000 })
    })
  })

  test.describe('Reset Password Page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/reset-password')
    })

    test('should show invalid/expired link message when accessed directly', async ({ page }) => {
      // When accessed without a valid recovery session, should show error
      await expect(page.getByText(/invalid or expired link/i)).toBeVisible({ timeout: 10000 })
      await expect(page.getByRole('link', { name: 'Request new reset link' })).toBeVisible()
    })

    test('should navigate to forgot password from invalid session', async ({ page }) => {
      await expect(page.getByText(/invalid or expired link/i)).toBeVisible({ timeout: 10000 })
      await page.getByRole('link', { name: 'Request new reset link' }).click()
      await expect(page).toHaveURL('/forgot-password', { timeout: 15000 })
    })
  })

  test.describe('Navigation between auth pages', () => {
    test('should navigate from login to signup and back', async ({ page }) => {
      // Start at login
      await page.goto('/login')
      await expect(page.getByRole('heading', { name: 'Bullhorn' })).toBeVisible()

      // Go to signup
      await page.getByRole('link', { name: 'Sign up' }).click()
      await expect(page).toHaveURL('/signup', { timeout: 15000 })
      await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible()

      // Go back to login
      await page.getByRole('link', { name: 'Sign in' }).click()
      await expect(page).toHaveURL('/login', { timeout: 15000 })
      await expect(page.getByRole('heading', { name: 'Bullhorn' })).toBeVisible()
    })

    test('should navigate through forgot password flow', async ({ page }) => {
      // Start at login
      await page.goto('/login')

      // Go to forgot password
      await page.getByRole('link', { name: 'Forgot password?' }).click()
      await expect(page).toHaveURL('/forgot-password', { timeout: 15000 })
      await expect(page.getByRole('heading', { name: 'Reset password' })).toBeVisible()

      // Go back to login
      await page.getByRole('link', { name: 'Sign in' }).click()
      await expect(page).toHaveURL('/login', { timeout: 15000 })
    })
  })
})
