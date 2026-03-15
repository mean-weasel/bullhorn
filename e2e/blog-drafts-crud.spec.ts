import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  goToBlogDrafts,
  goToNewBlogDraft,
  fillBlogDraftTitle,
  fillBlogDraftContent,
  fillBlogDraftNotes,
  saveBlogDraft,
  createBlogDraftViaAPI,
  getAllBlogDrafts,
  getBlogDraftById,
} from './helpers'

test.describe('Blog Drafts - List', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should show empty state when no blog drafts exist', async ({ page }) => {
    await goToBlogDrafts(page)
    await expect(page.getByText(/no blog drafts yet/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /create draft/i })).toBeVisible()
  })

  test('should navigate to new draft from empty state button', async ({ page }) => {
    await goToBlogDrafts(page)
    await page.getByRole('link', { name: /create draft/i }).click()
    await expect(page.getByPlaceholder('Post title...')).toBeVisible({ timeout: 15000 })
  })

  test('should navigate to new draft from header button', async ({ page }) => {
    await goToBlogDrafts(page)
    await page.getByRole('link', { name: /new draft/i }).click()
    await expect(page.getByPlaceholder('Post title...')).toBeVisible({ timeout: 15000 })
  })

  test('should display blog drafts after creation', async ({ page }) => {
    await createBlogDraftViaAPI(page, {
      title: 'My First Blog Post',
      content: 'This is the content of my first blog post.',
    })
    await goToBlogDrafts(page)
    await expect(page.getByText('My First Blog Post').first()).toBeVisible()
  })

  test('should show word count on draft cards', async ({ page }) => {
    await createBlogDraftViaAPI(page, {
      title: 'Word Count Test',
      content: 'One two three four five words here',
    })
    await goToBlogDrafts(page)
    await expect(page.getByText(/7 words/i)).toBeVisible()
  })

  test('should show tags on draft cards', async ({ page }) => {
    await createBlogDraftViaAPI(page, {
      title: 'Tagged Post',
      content: 'Post with tags',
      tags: ['Blog Post', 'Twitter Article'],
    })
    await goToBlogDrafts(page)
    const card = page
      .locator('a[href^="/blog/"]:not([href="/blog/new"]):not([href="/blog"])')
      .first()
    await expect(card.getByText('Blog Post')).toBeVisible()
    await expect(card.getByText('Twitter Article')).toBeVisible()
  })

  test('should show status counts in filter tabs', async ({ page }) => {
    await createBlogDraftViaAPI(page, {
      title: 'Draft 1',
      content: 'Draft content',
      status: 'draft',
    })
    await createBlogDraftViaAPI(page, {
      title: 'Published 1',
      content: 'Published content',
      status: 'published',
    })
    await goToBlogDrafts(page)
    await expect(page.getByRole('button', { name: /^all/i })).toContainText('2')
    await expect(page.getByRole('button', { name: /^drafts/i })).toContainText('1')
    await expect(page.getByRole('button', { name: /^published/i })).toContainText('1')
  })
})

test.describe('Blog Drafts - Create', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should create a new blog draft with title and content', async ({ page }) => {
    await goToNewBlogDraft(page)
    await fillBlogDraftTitle(page, 'How to Build a Next.js App')
    await fillBlogDraftContent(page, 'Next.js is a powerful React framework...')
    await fillBlogDraftNotes(page, 'Remember to add code examples')
    await saveBlogDraft(page)
    await expect(page.getByText(/draft created/i)).toBeVisible()
    const drafts = await getAllBlogDrafts(page)
    const created = drafts.find((d) => d.title === 'How to Build a Next.js App')
    expect(created).toBeDefined()
    expect(created?.content).toBe('Next.js is a powerful React framework...')
    expect(created?.notes).toBe('Remember to add code examples')
    expect(created?.status).toBe('draft')
  })

  test('should show word count while typing', async ({ page }) => {
    await goToNewBlogDraft(page)
    await fillBlogDraftContent(page, 'One two three four five')
    await expect(page.getByText(/5 words/i)).toBeVisible()
  })

  test('should require title to save', async ({ page }) => {
    await goToNewBlogDraft(page)
    await fillBlogDraftContent(page, 'Content without title')
    const saveButton = page.getByRole('button', { name: /^save$/i })
    await expect(saveButton).toBeDisabled()
  })

  test('should save draft without content', async ({ page }) => {
    await goToNewBlogDraft(page)
    await fillBlogDraftTitle(page, 'Title Only Draft')
    await saveBlogDraft(page)
    const drafts = await getAllBlogDrafts(page)
    const created = drafts.find((d) => d.title === 'Title Only Draft')
    expect(created).toBeDefined()
    expect(created?.content).toBe('')
    expect(created?.wordCount).toBe(0)
  })

  test('should redirect to edit page after creating draft', async ({ page }) => {
    await goToNewBlogDraft(page)
    await fillBlogDraftTitle(page, 'Redirect Test')
    await fillBlogDraftContent(page, 'Testing redirect')
    await saveBlogDraft(page)
    await expect(page).toHaveURL(/\/blog\/[a-f0-9-]+/)
    await expect(page.getByPlaceholder('Post title...')).toHaveValue('Redirect Test')
  })

  test('should show unsaved changes indicator', async ({ page }) => {
    await goToNewBlogDraft(page)
    await fillBlogDraftTitle(page, 'Unsaved Draft')
    await expect(page.getByText(/unsaved changes/i)).toBeVisible()
  })

  test('should save draft with Cmd+S / Ctrl+S', async ({ page }) => {
    await goToNewBlogDraft(page)
    await fillBlogDraftTitle(page, 'Keyboard Test')
    await fillBlogDraftContent(page, 'Testing keyboard shortcut')
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
    await page.keyboard.press(`${modifier}+KeyS`)
    await expect(page.getByText(/draft created/i)).toBeVisible()
    const drafts = await getAllBlogDrafts(page)
    const created = drafts.find((d) => d.title === 'Keyboard Test')
    expect(created).toBeDefined()
  })
})

test.describe('Blog Drafts - Edit', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should edit an existing blog draft', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, {
      title: 'Original Title',
      content: 'Original content here.',
    })
    await page.goto(`/blog/${created.id}`)
    await expect(page.getByPlaceholder('Post title...')).toHaveValue('Original Title')
    await fillBlogDraftTitle(page, 'Updated Title')
    await saveBlogDraft(page)
    await expect(page.getByText(/draft saved/i)).toBeVisible()
    const updated = await getBlogDraftById(page, created.id)
    expect(updated?.title).toBe('Updated Title')
  })

  test('should navigate to edit from list', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, {
      title: 'Click to Edit',
      content: 'Edit me',
    })
    await goToBlogDrafts(page)
    await page.locator(`a[href="/blog/${created.id}"]`).click()
    await expect(page).toHaveURL(`/blog/${created.id}`)
    await expect(page.getByPlaceholder('Post title...')).toHaveValue('Click to Edit')
  })

  test('should update title', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, {
      title: 'Original Title',
      content: 'Some content here',
    })
    await page.goto(`/blog/${created.id}`)
    await expect(page.getByPlaceholder('Post title...')).toHaveValue('Original Title')
    await fillBlogDraftTitle(page, 'Updated Title')
    await saveBlogDraft(page)
    await expect(page.getByText(/draft saved/i)).toBeVisible({ timeout: 10000 })
    const updated = await getBlogDraftById(page, created.id)
    expect(updated?.title).toBe('Updated Title')
  })

  test('should show back button to return to list', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, {
      title: 'Back Test',
      content: 'Content',
    })
    await page.goto(`/blog/${created.id}`)
    await expect(page.getByRole('button', { name: /back to drafts/i })).toBeVisible()
    await page.getByRole('button', { name: /back to drafts/i }).click()
    await expect(page).toHaveURL('/blog', { timeout: 15000 })
  })

  test('should warn about unsaved changes when navigating away', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, {
      title: 'Warning Test',
      content: 'Content',
    })
    await page.goto(`/blog/${created.id}`)
    await expect(page.getByPlaceholder('Post title...')).toHaveValue('Warning Test')
    await fillBlogDraftTitle(page, 'Changed Title')
    await page.getByRole('button', { name: /back to drafts/i }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('unsaved changes')
    await dialog.getByRole('button', { name: /^stay$/i }).click()
    await expect(page).toHaveURL(/\/blog\/[a-f0-9-]+/)
  })

  test('should clear unsaved changes indicator after save', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, {
      title: 'Clear Indicator Test',
      content: 'Content',
    })
    await page.goto(`/blog/${created.id}`)
    await expect(page.getByPlaceholder('Post title...')).toHaveValue('Clear Indicator Test')
    await fillBlogDraftTitle(page, 'Changed')
    await expect(page.getByText(/unsaved changes/i)).toBeVisible({ timeout: 5000 })
    await saveBlogDraft(page)
    await expect(page.getByText(/unsaved changes/i)).not.toBeVisible({ timeout: 10000 })
  })
})
