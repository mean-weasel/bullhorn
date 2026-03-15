import { Page, expect } from '@playwright/test'

export async function goToProfile(page: Page) {
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: /Profile/ }).first()).toBeVisible()
}

export async function fillDisplayName(page: Page, name: string) {
  await page.getByLabel('Display Name').fill(name)
}

export async function fillPasswordChange(page: Page, newPassword: string, confirmPassword: string) {
  await page.getByLabel('New Password', { exact: true }).fill(newPassword)
  await page.getByLabel('Confirm New Password', { exact: true }).fill(confirmPassword)
}

export async function saveProfile(page: Page) {
  await page.getByRole('button', { name: 'Save Changes' }).click()
}

export async function updatePassword(page: Page) {
  await page.getByRole('button', { name: 'Update Password' }).click()
}

export async function openDeleteAccountDialog(page: Page) {
  await page.getByRole('button', { name: /delete account/i }).click()
  await page.getByRole('alertdialog').waitFor()
}

export async function confirmDeleteAccount(page: Page) {
  const dialog = page.getByRole('alertdialog')
  await dialog.getByRole('button', { name: /delete account/i }).click()
}

export async function cancelDeleteAccount(page: Page) {
  const dialog = page.getByRole('alertdialog')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
}
