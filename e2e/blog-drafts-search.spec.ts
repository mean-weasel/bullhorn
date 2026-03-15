import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  goToBlogDrafts,
  searchBlogDrafts,
  filterBlogDraftsByStatus,
  archiveBlogDraft,
  restoreBlogDraft,
  deleteBlogDraft,
  createBlogDraftViaAPI,
  getBlogDraftById,
} from './helpers'

test.describe('Blog Drafts - Search and Filter', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should search drafts by title', async ({ page }) => {
    await createBlogDraftViaAPI(page, { title: 'React Tutorial', content: 'Learn React' })
    await createBlogDraftViaAPI(page, { title: 'Vue Guide', content: 'Learn Vue' })
    await goToBlogDrafts(page)
    await searchBlogDrafts(page, 'React')
    await expect(page.getByText('React Tutorial').first()).toBeVisible()
    await expect(page.getByText('Vue Guide').first()).not.toBeVisible()
  })

  test('should search drafts by content', async ({ page }) => {
    await createBlogDraftViaAPI(page, { title: 'Post 1', content: 'This post is about TypeScript' })
    await createBlogDraftViaAPI(page, { title: 'Post 2', content: 'This post is about Python' })
    await goToBlogDrafts(page)
    await searchBlogDrafts(page, 'TypeScript')
    await expect(page.getByText('Post 1').first()).toBeVisible()
    await expect(page.getByText('Post 2').first()).not.toBeVisible()
  })

  test('should search drafts by notes', async ({ page }) => {
    await createBlogDraftViaAPI(page, {
      title: 'Post A',
      content: 'Content A',
      notes: 'Add images later',
    })
    await createBlogDraftViaAPI(page, {
      title: 'Post B',
      content: 'Content B',
      notes: 'Review with team',
    })
    await goToBlogDrafts(page)
    await searchBlogDrafts(page, 'images')
    await expect(page.getByText('Post A').first()).toBeVisible()
    await expect(page.getByText('Post B').first()).not.toBeVisible()
  })

  test('should clear search results', async ({ page }) => {
    await createBlogDraftViaAPI(page, { title: 'First Post', content: 'Content 1' })
    await createBlogDraftViaAPI(page, { title: 'Second Post', content: 'Content 2' })
    await goToBlogDrafts(page)
    await searchBlogDrafts(page, 'First')
    await expect(page.getByText('Second Post').first()).not.toBeVisible()
    await page.getByPlaceholder('Search by title, content, or notes...').fill('')
    await expect(page.getByText('First Post').first()).toBeVisible()
    await expect(page.getByText('Second Post').first()).toBeVisible()
  })

  test('should filter by draft status', async ({ page }) => {
    await createBlogDraftViaAPI(page, { title: 'Draft Post', content: 'Draft', status: 'draft' })
    await createBlogDraftViaAPI(page, {
      title: 'Published Post',
      content: 'Published',
      status: 'published',
    })
    await goToBlogDrafts(page)
    await filterBlogDraftsByStatus(page, 'draft')
    await expect(page.getByText('Draft Post').first()).toBeVisible()
    await expect(page.getByText('Published Post').first()).not.toBeVisible()
  })

  test('should filter by published status', async ({ page }) => {
    await createBlogDraftViaAPI(page, { title: 'Draft Post', content: 'Draft', status: 'draft' })
    await createBlogDraftViaAPI(page, {
      title: 'Published Post',
      content: 'Published',
      status: 'published',
    })
    await goToBlogDrafts(page)
    await filterBlogDraftsByStatus(page, 'published')
    await expect(page.getByText('Published Post').first()).toBeVisible()
    await expect(page.getByText('Draft Post').first()).not.toBeVisible()
  })

  test('should filter by All status (excludes archived)', async ({ page }) => {
    await createBlogDraftViaAPI(page, {
      title: 'Active Draft Post',
      content: 'Active',
      status: 'draft',
    })
    await createBlogDraftViaAPI(page, {
      title: 'Archived Post',
      content: 'Archived',
      status: 'archived',
    })
    await goToBlogDrafts(page)
    await expect(page.getByText('Active Draft Post').first()).toBeVisible()
    await expect(page.getByText('Archived Post').first()).not.toBeVisible()
  })

  test('should filter by tag', async ({ page }) => {
    await createBlogDraftViaAPI(page, {
      title: 'Blog Tagged Post',
      content: 'Blog',
      tags: ['Blog Post'],
    })
    await createBlogDraftViaAPI(page, {
      title: 'Twitter Tagged Post',
      content: 'Twitter',
      tags: ['Twitter Article'],
    })
    await goToBlogDrafts(page)
    await page.locator('button').filter({ hasText: 'Twitter Article' }).first().click()
    await expect(page.getByText('Twitter Tagged Post').first()).toBeVisible()
    await expect(page.getByText('Blog Tagged Post').first()).not.toBeVisible()
  })

  test('should show search results count', async ({ page }) => {
    await createBlogDraftViaAPI(page, { title: 'Result 1', content: 'test content' })
    await createBlogDraftViaAPI(page, { title: 'Result 2', content: 'test content' })
    await goToBlogDrafts(page)
    await searchBlogDrafts(page, 'Result')
    await expect(page.getByText(/found 2 draft/i)).toBeVisible()
  })

  test('should show no results message', async ({ page }) => {
    await createBlogDraftViaAPI(page, { title: 'Some Post', content: 'Some content' })
    await goToBlogDrafts(page)
    await searchBlogDrafts(page, 'nonexistent')
    await expect(page.getByText(/no matching drafts/i)).toBeVisible()
  })
})

test.describe('Blog Drafts - Archive and Restore', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should archive a blog draft', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, { title: 'Archive Me', content: 'Archive' })
    await page.goto(`/blog/${created.id}`)
    await archiveBlogDraft(page)
    await expect(page).toHaveURL('/blog', { timeout: 15000 })
    await expect(page.getByText('Archive Me').first()).not.toBeVisible()
    const updated = await getBlogDraftById(page, created.id)
    expect(updated?.status).toBe('archived')
  })

  test('should show archived drafts in Archived filter', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, { title: 'Archived Draft', content: 'A' })
    await page.goto(`/blog/${created.id}`)
    await archiveBlogDraft(page)
    await expect(page).toHaveURL('/blog', { timeout: 15000 })
    await filterBlogDraftsByStatus(page, 'archived')
    await expect(page.getByText('Archived Draft').first()).toBeVisible()
  })

  test('should restore an archived draft', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, {
      title: 'Restore Me',
      content: 'Restore',
      status: 'archived',
    })
    await page.goto(`/blog/${created.id}`)
    await restoreBlogDraft(page)
    await expect(page.getByText(/draft restored/i)).toBeVisible()
    const updated = await getBlogDraftById(page, created.id)
    expect(updated?.status).toBe('draft')
  })

  test('should show restore button for archived drafts', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, {
      title: 'Archived Test',
      content: 'A',
      status: 'archived',
    })
    await page.goto(`/blog/${created.id}`)
    await expect(page.getByRole('button', { name: /^restore$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^archive$/i })).not.toBeVisible()
  })

  test('should show archive button for non-archived drafts', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, {
      title: 'Draft Test',
      content: 'D',
      status: 'draft',
    })
    await page.goto(`/blog/${created.id}`)
    await expect(page.getByRole('button', { name: /^archive$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^restore$/i })).not.toBeVisible()
  })

  test('should show archived tab only when archived drafts exist', async ({ page }) => {
    await createBlogDraftViaAPI(page, { title: 'Draft', content: 'D', status: 'draft' })
    await goToBlogDrafts(page)
    await expect(page.getByRole('button', { name: /^archived/i })).not.toBeVisible()
    await createBlogDraftViaAPI(page, { title: 'Archived', content: 'A', status: 'archived' })
    await page.reload()
    await expect(page.getByRole('button', { name: /^archived/i })).toBeVisible()
  })
})

test.describe('Blog Drafts - Delete', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should delete a blog draft', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, { title: 'Delete Me', content: 'Delete' })
    await page.goto(`/blog/${created.id}`)
    await deleteBlogDraft(page)
    await expect(page).toHaveURL('/blog', { timeout: 15000 })
    await expect(page.getByText('Delete Me').first()).not.toBeVisible()
    const deleted = await getBlogDraftById(page, created.id)
    expect(deleted).toBeNull()
  })

  test('should show confirmation dialog when deleting', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, { title: 'Confirm Delete', content: 'C' })
    await page.goto(`/blog/${created.id}`)
    await page.getByRole('button', { name: /^delete$/i }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('permanently')
    await dialog.getByRole('button', { name: /^keep$/i }).click()
    await expect(page).toHaveURL(/\/blog\/[a-f0-9-]+/)
    const draft = await getBlogDraftById(page, created.id)
    expect(draft).not.toBeNull()
  })

  test('should not delete when confirmation is cancelled', async ({ page }) => {
    const created = await createBlogDraftViaAPI(page, { title: 'Cancel Delete', content: 'C' })
    await page.goto(`/blog/${created.id}`)
    await page.getByRole('button', { name: /^delete$/i }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: /^keep$/i }).click()
    await expect(page).toHaveURL(/\/blog\/[a-f0-9-]+/)
    const draft = await getBlogDraftById(page, created.id)
    expect(draft).not.toBeNull()
  })
})

test.describe('Blog Drafts - Empty States', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test('should show empty state for filtered status with no results', async ({ page }) => {
    await createBlogDraftViaAPI(page, { title: 'Draft Only', content: 'D', status: 'draft' })
    await goToBlogDrafts(page)
    await filterBlogDraftsByStatus(page, 'published')
    await expect(page.getByText(/no published drafts/i)).toBeVisible()
  })

  test('should show empty state when search has no results', async ({ page }) => {
    await createBlogDraftViaAPI(page, { title: 'Some Post', content: 'Content' })
    await goToBlogDrafts(page)
    await searchBlogDrafts(page, 'xyz123nonexistent')
    await expect(page.getByText(/no matching drafts/i)).toBeVisible()
    await expect(page.getByText(/try a different search term/i)).toBeVisible()
  })
})
