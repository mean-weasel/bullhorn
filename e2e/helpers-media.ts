import { Page, expect } from '@playwright/test'

export async function uploadMediaFile(page: Page, filePath: string) {
  const fileInput = page.locator('input[type="file"]').first()
  await fileInput.setInputFiles(filePath)
  await page.locator('img[alt^="Media"]').last().waitFor({ timeout: 10000 })
}

export async function getMediaCount(page: Page): Promise<number> {
  const mediaItems = page.locator('.relative.group img[alt^="Media"]')
  return await mediaItems.count()
}

export async function openMediaSection(page: Page) {
  await page.locator('button[title="Add media (images/videos)"]').click()
  await expect(page.getByText('Media Attachments')).toBeVisible()
}
