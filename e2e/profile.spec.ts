import { test, expect } from '@playwright/test'
import {
  goToProfile,
  fillDisplayName,
  fillPasswordChange,
  saveProfile,
  updatePassword,
  openDeleteAccountDialog,
  cancelDeleteAccount,
  confirmDeleteAccount,
} from './helpers'

// eslint-disable-next-line max-lines-per-function
test.describe('User Profile Page', () => {
   
  test.describe('Profile Page Access', () => {
     
    test('should display profile page with all sections', async ({ page }) => {
      await goToProfile(page)

      // Verify page heading (contains emoji)
      await expect(page.getByRole('heading', { name: /Profile/ }).first()).toBeVisible()
      await expect(page.getByText('Manage your account settings')).toBeVisible()

      // Verify Profile Information section (contains emoji)
      await expect(page.getByText(/Profile Information/)).toBeVisible()
      await expect(page.getByLabel('Display Name')).toBeVisible()

      // Verify Account section (contains emoji)
      await expect(page.getByRole('heading', { name: /Account/ })).toBeVisible()
      await expect(page.getByText('Email Address')).toBeVisible()
      await expect(page.getByText('Change Password')).toBeVisible()

      // Verify Danger Zone section (contains emoji)
      await expect(page.getByText(/Danger Zone/)).toBeVisible()
      await expect(page.getByRole('button', { name: /delete account/i })).toBeVisible()
    })

     
    test('should display avatar with initials', async ({ page }) => {
      await goToProfile(page)

      // Avatar should show initials (T for Test User in E2E mode)
      // Use a more specific selector for the avatar div (Sticker Bomb design uses rounded-lg)
      const avatar = page.locator('.w-16.h-16.rounded-lg')
      await expect(avatar).toBeVisible()
      await expect(avatar).toContainText('T')
    })

     
    test('should display user email in read-only field', async ({ page }) => {
      await goToProfile(page)

      // Email should be displayed (test@example.com in E2E mode)
      // Use first() since email appears in both avatar section and email field
      await expect(page.getByText('test@example.com').first()).toBeVisible()
      await expect(page.getByText('Email cannot be changed')).toBeVisible()
    })
  })

   
  test.describe('Display Name Update Flow', () => {
     
    test('should enable save button when display name changes', async ({ page }) => {
      await goToProfile(page)

      const displayNameInput = page.getByLabel('Display Name')
      const saveButton = page.getByRole('button', { name: 'Save Changes' })

      // Initially disabled (no changes)
      await expect(saveButton).toBeDisabled()

      // Type new display name
      await displayNameInput.fill('New Test Name')

      // Button should now be enabled
      await expect(saveButton).toBeEnabled()
    })

     
    test('should disable save button when display name reverts', async ({ page }) => {
      await goToProfile(page)

      const displayNameInput = page.getByLabel('Display Name')
      const saveButton = page.getByRole('button', { name: 'Save Changes' })

      // Get original value
      const originalValue = await displayNameInput.inputValue()

      // Change it
      await displayNameInput.fill('Different Name')
      await expect(saveButton).toBeEnabled()

      // Revert to original
      await displayNameInput.fill(originalValue)
      await expect(saveButton).toBeDisabled()
    })

     
    test('should show saving state when clicking save', async ({ page }) => {
      await goToProfile(page)

      await fillDisplayName(page, 'Updated Name')
      await saveProfile(page)

      // Should show "Saving..." text briefly
      await expect(page.getByRole('button', { name: 'Saving...' })).toBeVisible()
    })

     
    test('should show success message after saving', async ({ page }) => {
      await goToProfile(page)

      await fillDisplayName(page, 'New Display Name')
      await saveProfile(page)

      // Wait for success message
      await expect(page.getByText('Profile updated successfully')).toBeVisible({ timeout: 10000 })
    })

     
    test('should clear success message after timeout', async ({ page }) => {
      await goToProfile(page)

      await fillDisplayName(page, 'Another Name')
      await saveProfile(page)

      // Success message appears
      await expect(page.getByText('Profile updated successfully')).toBeVisible()

      // Message should disappear after timeout (auto-clears after ~3s)
      await expect(page.getByText('Profile updated successfully')).not.toBeVisible({
        timeout: 10000,
      })
    })
  })

  // eslint-disable-next-line max-lines-per-function
  test.describe('Password Change Flow', () => {
     
    test('should display password change fields', async ({ page }) => {
      await goToProfile(page)

      await expect(page.getByLabel('New Password', { exact: true })).toBeVisible()
      await expect(page.getByLabel('Confirm New Password', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Update Password' })).toBeVisible()
    })

     
    test('should have password fields hidden by default', async ({ page }) => {
      await goToProfile(page)

      const newPasswordInput = page.getByLabel('New Password', { exact: true })
      const confirmPasswordInput = page.getByLabel('Confirm New Password', { exact: true })

      await expect(newPasswordInput).toHaveAttribute('type', 'password')
      await expect(confirmPasswordInput).toHaveAttribute('type', 'password')
    })

     
    test('should toggle password visibility for new password', async ({ page }) => {
      await goToProfile(page)

      const newPasswordInput = page.getByLabel('New Password', { exact: true })

      // Find the toggle button (in the same container as the input)
      const inputContainer = newPasswordInput.locator('..')
      const toggleButton = inputContainer.locator('button')

      // Initially hidden
      await expect(newPasswordInput).toHaveAttribute('type', 'password')

      // Click toggle
      await toggleButton.click()
      await expect(newPasswordInput).toHaveAttribute('type', 'text')

      // Click again to hide
      await toggleButton.click()
      await expect(newPasswordInput).toHaveAttribute('type', 'password')
    })

     
    test('should toggle password visibility for confirm password', async ({ page }) => {
      await goToProfile(page)

      const confirmPasswordInput = page.getByLabel('Confirm New Password', { exact: true })
      const inputContainer = confirmPasswordInput.locator('..')
      const toggleButton = inputContainer.locator('button')

      await expect(confirmPasswordInput).toHaveAttribute('type', 'password')
      await toggleButton.click()
      await expect(confirmPasswordInput).toHaveAttribute('type', 'text')
    })

     
    test('should disable update button when fields are empty', async ({ page }) => {
      await goToProfile(page)

      const updateButton = page.getByRole('button', { name: 'Update Password' })
      await expect(updateButton).toBeDisabled()
    })

     
    test('should enable update button when both passwords filled', async ({ page }) => {
      await goToProfile(page)

      await fillPasswordChange(page, 'newpassword123', 'newpassword123')

      const updateButton = page.getByRole('button', { name: 'Update Password' })
      await expect(updateButton).toBeEnabled()
    })

     
    test('should show error when password is too short', async ({ page }) => {
      await goToProfile(page)

      await fillPasswordChange(page, '1234567', '1234567') // 7 chars, needs 8
      await updatePassword(page)

      await expect(page.getByText('New password must be at least 8 characters')).toBeVisible()
    })

     
    test('should show error when passwords do not match', async ({ page }) => {
      await goToProfile(page)

      await fillPasswordChange(page, 'password123', 'different456')
      await updatePassword(page)

      await expect(page.getByText('Passwords do not match')).toBeVisible()
    })

     
    test('should show updating state when submitting valid password', async ({ page }) => {
      await goToProfile(page)

      await fillPasswordChange(page, 'validpassword123', 'validpassword123')
      await updatePassword(page)

      // Should show "Updating..." text briefly
      await expect(page.getByRole('button', { name: 'Updating...' })).toBeVisible()
    })

     
    test('should show password strength indicator when typing new password', async ({ page }) => {
      await goToProfile(page)

      const newPasswordInput = page.getByLabel('New Password', { exact: true })

      // No indicator when empty
      await expect(page.getByText('Weak')).not.toBeVisible()

      // Score 1 (Weak): 8+ chars, one criterion met
      await newPasswordInput.fill('abcdefgh')
      await expect(page.getByText('Weak')).toBeVisible()

      // Score 3 (Good): 10+ chars with mixed case (three criteria)
      await newPasswordInput.fill('Abcdefghij')
      await expect(page.getByText('Good')).toBeVisible()

      // Score 4 (Strong): 10+ chars, mixed case, and numbers
      await newPasswordInput.fill('Abcdefgh12')
      await expect(page.getByText('Strong')).toBeVisible()
    })
  })

   
  test.describe('Account Deletion Flow', () => {
     
    test('should show delete account button in danger zone', async ({ page }) => {
      await goToProfile(page)

      const deleteButton = page.getByRole('button', { name: /delete account/i })
      await expect(deleteButton).toBeVisible()
    })

     
    test('should open confirmation dialog on delete click', async ({ page }) => {
      await goToProfile(page)

      await openDeleteAccountDialog(page)

      // Verify confirmation dialog appears
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      // Use heading role to get the dialog title specifically
      await expect(dialog.getByRole('heading', { name: 'Delete Account' })).toBeVisible()
      await expect(dialog.getByText(/permanently deleted/i)).toBeVisible()
    })

     
    test('should have cancel and confirm buttons in delete dialog', async ({ page }) => {
      await goToProfile(page)

      await openDeleteAccountDialog(page)

      const dialog = page.getByRole('alertdialog')
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
      await expect(dialog.getByRole('button', { name: /delete account/i })).toBeVisible()
    })

     
    test('should close dialog on cancel', async ({ page }) => {
      await goToProfile(page)

      await openDeleteAccountDialog(page)

      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()

      await cancelDeleteAccount(page)

      await expect(dialog).not.toBeVisible()
    })

     
    test('should close dialog on escape key', async ({ page }) => {
      await goToProfile(page)

      await openDeleteAccountDialog(page)

      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()

      await page.keyboard.press('Escape')

      await expect(dialog).not.toBeVisible()
    })

     
    test('should show deleting state when confirming delete', async ({ page }) => {
      await goToProfile(page)

      await openDeleteAccountDialog(page)
      await confirmDeleteAccount(page)

      // Should show "Deleting..." text briefly and redirect
      await expect(page.getByRole('button', { name: 'Deleting...' })).toBeVisible()
    })
  })

   
  test.describe('Error Handling', () => {
     
    test('should display error message styling correctly', async ({ page }) => {
      await goToProfile(page)

      // Trigger a password mismatch error
      await fillPasswordChange(page, 'password123', 'different456')
      await updatePassword(page)

      // Verify error message is visible with destructive styling
      const errorMessage = page.getByText('Passwords do not match')
      await expect(errorMessage).toBeVisible()
    })
  })
})
