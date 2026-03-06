import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  goToBlogDrafts,
  goToNewBlogDraft,
  fillBlogDraftTitle,
  fillBlogDraftContent,
  fillBlogDraftNotes,
  saveBlogDraft,
  searchBlogDrafts,
  filterBlogDraftsByStatus,
  archiveBlogDraft,
  restoreBlogDraft,
  deleteBlogDraft,
  createBlogDraftViaAPI,
  getAllBlogDrafts,
  getBlogDraftById,
} from './helpers'

test.describe('Blog Drafts', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  test.describe('Blog Drafts List', () => {
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
      // Create a draft via API
      await createBlogDraftViaAPI(page, {
        title: 'My First Blog Post',
        content: 'This is the content of my first blog post.',
      })

      await goToBlogDrafts(page)

      // Use .first() since text appears in both the card link and inner title element
      await expect(page.getByText('My First Blog Post').first()).toBeVisible()
    })

    test('should show word count on draft cards', async ({ page }) => {
      await createBlogDraftViaAPI(page, {
        title: 'Word Count Test',
        content: 'One two three four five words here',
      })

      await goToBlogDrafts(page)

      // Should show "7 words" (content has 7 words)
      await expect(page.getByText(/7 words/i)).toBeVisible()
    })

    test('should show tags on draft cards', async ({ page }) => {
      await createBlogDraftViaAPI(page, {
        title: 'Tagged Post',
        content: 'Post with tags',
        tags: ['Blog Post', 'Twitter Article'],
      })

      await goToBlogDrafts(page)

      // Tags appear in both the card and the tag filter section, use .first()
      const card = page
        .locator('a[href^="/blog/"]:not([href="/blog/new"]):not([href="/blog"])')
        .first()
      await expect(card.getByText('Blog Post')).toBeVisible()
      await expect(card.getByText('Twitter Article')).toBeVisible()
    })

    test('should show status counts in filter tabs', async ({ page }) => {
      // Create drafts with different statuses
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

      // All tab should show count excluding archived (2 total)
      await expect(page.getByRole('button', { name: /^all/i })).toContainText('2')
      // Drafts tab should show 1
      await expect(page.getByRole('button', { name: /^drafts/i })).toContainText('1')
      // Published tab should show 1
      await expect(page.getByRole('button', { name: /^published/i })).toContainText('1')
    })
  })

  test.describe('Create Blog Draft', () => {
    test('should create a new blog draft with title and content', async ({ page }) => {
      await goToNewBlogDraft(page)

      await fillBlogDraftTitle(page, 'How to Build a Next.js App')
      await fillBlogDraftContent(page, 'Next.js is a powerful React framework...')
      await fillBlogDraftNotes(page, 'Remember to add code examples')

      await saveBlogDraft(page)

      // Should show success message
      await expect(page.getByText(/draft created/i)).toBeVisible()

      // Verify in database
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

      // Should show "5 words"
      await expect(page.getByText(/5 words/i)).toBeVisible()
    })

    test('should require title to save', async ({ page }) => {
      await goToNewBlogDraft(page)

      // Fill only content, no title
      await fillBlogDraftContent(page, 'Content without title')

      // Save button should be disabled
      const saveButton = page.getByRole('button', { name: /^save$/i })
      await expect(saveButton).toBeDisabled()
    })

    test('should save draft without content', async ({ page }) => {
      await goToNewBlogDraft(page)

      await fillBlogDraftTitle(page, 'Title Only Draft')

      await saveBlogDraft(page)

      // Verify in database
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

      // Should redirect to /blog/{id}
      await expect(page).toHaveURL(/\/blog\/[a-f0-9-]+/)

      // Should show the title in the form
      await expect(page.getByPlaceholder('Post title...')).toHaveValue('Redirect Test')
    })

    test('should show unsaved changes indicator', async ({ page }) => {
      await goToNewBlogDraft(page)

      await fillBlogDraftTitle(page, 'Unsaved Draft')

      // Should show unsaved changes text
      await expect(page.getByText(/unsaved changes/i)).toBeVisible()
    })
  })

  test.describe('Edit Blog Draft', () => {
    test('should edit an existing blog draft', async ({ page }) => {
      // Create a draft first
      const created = await createBlogDraftViaAPI(page, {
        title: 'Original Title',
        content: 'Original content here.',
      })

      await page.goto(`/blog/${created.id}`)

      // Wait for content to load
      await expect(page.getByPlaceholder('Post title...')).toHaveValue('Original Title')

      // Update the title
      await fillBlogDraftTitle(page, 'Updated Title')

      await saveBlogDraft(page)

      // Should show success message
      await expect(page.getByText(/draft saved/i)).toBeVisible()

      // Verify the update
      const updated = await getBlogDraftById(page, created.id)
      expect(updated?.title).toBe('Updated Title')
    })

    test('should navigate to edit from list', async ({ page }) => {
      const created = await createBlogDraftViaAPI(page, {
        title: 'Click to Edit',
        content: 'Edit me',
      })

      await goToBlogDrafts(page)

      // Click the draft card link directly
      await page.locator(`a[href="/blog/${created.id}"]`).click()

      // Should be on edit page
      await expect(page).toHaveURL(`/blog/${created.id}`)
      await expect(page.getByPlaceholder('Post title...')).toHaveValue('Click to Edit')
    })

    test('should update title', async ({ page }) => {
      const created = await createBlogDraftViaAPI(page, {
        title: 'Original Title',
        content: 'Some content here',
      })

      await page.goto(`/blog/${created.id}`)

      // Wait for form to load with original data before making changes
      await expect(page.getByPlaceholder('Post title...')).toHaveValue('Original Title')

      await fillBlogDraftTitle(page, 'Updated Title')
      await saveBlogDraft(page)

      // Wait for save to complete
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

      // Click back
      await page.getByRole('button', { name: /back to drafts/i }).click()

      // Should be on list page
      await expect(page).toHaveURL('/blog', { timeout: 15000 })
    })

    test('should warn about unsaved changes when navigating away', async ({ page }) => {
      const created = await createBlogDraftViaAPI(page, {
        title: 'Warning Test',
        content: 'Content',
      })

      await page.goto(`/blog/${created.id}`)

      // Wait for form to load with original data
      await expect(page.getByPlaceholder('Post title...')).toHaveValue('Warning Test')

      // Make a change
      await fillBlogDraftTitle(page, 'Changed Title')

      // Try to navigate away
      await page.getByRole('button', { name: /back to drafts/i }).click()

      // Verify the ConfirmDialog is shown with unsaved changes warning
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText('unsaved changes')

      // Cancel the dialog (stay on page)
      await dialog.getByRole('button', { name: /^stay$/i }).click()

      // Should still be on edit page (dialog cancelled)
      await expect(page).toHaveURL(/\/blog\/[a-f0-9-]+/)
    })

    test('should clear unsaved changes indicator after save', async ({ page }) => {
      const created = await createBlogDraftViaAPI(page, {
        title: 'Clear Indicator Test',
        content: 'Content',
      })

      await page.goto(`/blog/${created.id}`)

      // Wait for form to load with original data
      await expect(page.getByPlaceholder('Post title...')).toHaveValue('Clear Indicator Test')

      // Make a change
      await fillBlogDraftTitle(page, 'Changed')

      // Should show unsaved changes
      await expect(page.getByText(/unsaved changes/i)).toBeVisible({ timeout: 5000 })

      await saveBlogDraft(page)

      // Wait for save to complete and indicator to disappear
      await expect(page.getByText(/unsaved changes/i)).not.toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Search and Filter', () => {
    test('should search drafts by title', async ({ page }) => {
      await createBlogDraftViaAPI(page, {
        title: 'React Tutorial',
        content: 'Learn React',
      })
      await createBlogDraftViaAPI(page, {
        title: 'Vue Guide',
        content: 'Learn Vue',
      })

      await goToBlogDrafts(page)

      await searchBlogDrafts(page, 'React')

      // Should show React post (use .first() for strict mode)
      await expect(page.getByText('React Tutorial').first()).toBeVisible()
      // Should not show Vue post
      await expect(page.getByText('Vue Guide').first()).not.toBeVisible()
    })

    test('should search drafts by content', async ({ page }) => {
      await createBlogDraftViaAPI(page, {
        title: 'Post 1',
        content: 'This post is about TypeScript',
      })
      await createBlogDraftViaAPI(page, {
        title: 'Post 2',
        content: 'This post is about Python',
      })

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
      await createBlogDraftViaAPI(page, {
        title: 'First Post',
        content: 'Content 1',
      })
      await createBlogDraftViaAPI(page, {
        title: 'Second Post',
        content: 'Content 2',
      })

      await goToBlogDrafts(page)

      // Search
      await searchBlogDrafts(page, 'First')
      await expect(page.getByText('Second Post').first()).not.toBeVisible()

      // Clear search by emptying input
      await page.getByPlaceholder('Search by title, content, or notes...').fill('')

      // Should show all posts
      await expect(page.getByText('First Post').first()).toBeVisible()
      await expect(page.getByText('Second Post').first()).toBeVisible()
    })

    test('should filter by draft status', async ({ page }) => {
      await createBlogDraftViaAPI(page, {
        title: 'Draft Post',
        content: 'Draft content here',
        status: 'draft',
      })
      await createBlogDraftViaAPI(page, {
        title: 'Published Post',
        content: 'Published content here',
        status: 'published',
      })

      await goToBlogDrafts(page)

      // Filter by Drafts
      await filterBlogDraftsByStatus(page, 'draft')

      await expect(page.getByText('Draft Post').first()).toBeVisible()
      await expect(page.getByText('Published Post').first()).not.toBeVisible()
    })

    test('should filter by published status', async ({ page }) => {
      await createBlogDraftViaAPI(page, {
        title: 'Draft Post',
        content: 'Draft content here',
        status: 'draft',
      })
      await createBlogDraftViaAPI(page, {
        title: 'Published Post',
        content: 'Published content here',
        status: 'published',
      })

      await goToBlogDrafts(page)

      // Filter by Published
      await filterBlogDraftsByStatus(page, 'published')

      await expect(page.getByText('Published Post').first()).toBeVisible()
      await expect(page.getByText('Draft Post').first()).not.toBeVisible()
    })

    test('should filter by All status (excludes archived)', async ({ page }) => {
      await createBlogDraftViaAPI(page, {
        title: 'Active Draft Post',
        content: 'Active content',
        status: 'draft',
      })
      await createBlogDraftViaAPI(page, {
        title: 'Archived Post',
        content: 'Archived content',
        status: 'archived',
      })

      await goToBlogDrafts(page)

      // All filter should exclude archived
      await expect(page.getByText('Active Draft Post').first()).toBeVisible()
      await expect(page.getByText('Archived Post').first()).not.toBeVisible()
    })

    test('should filter by tag', async ({ page }) => {
      await createBlogDraftViaAPI(page, {
        title: 'Blog Tagged Post',
        content: 'Blog content',
        tags: ['Blog Post'],
      })
      await createBlogDraftViaAPI(page, {
        title: 'Twitter Tagged Post',
        content: 'Twitter content',
        tags: ['Twitter Article'],
      })

      await goToBlogDrafts(page)

      // Click "Twitter Article" tag filter
      await page.locator('button').filter({ hasText: 'Twitter Article' }).first().click()

      await expect(page.getByText('Twitter Tagged Post').first()).toBeVisible()
      await expect(page.getByText('Blog Tagged Post').first()).not.toBeVisible()
    })

    test('should show search results count', async ({ page }) => {
      await createBlogDraftViaAPI(page, {
        title: 'Result 1',
        content: 'test content',
      })
      await createBlogDraftViaAPI(page, {
        title: 'Result 2',
        content: 'test content',
      })

      await goToBlogDrafts(page)

      await searchBlogDrafts(page, 'Result')

      // Should show count
      await expect(page.getByText(/found 2 draft/i)).toBeVisible()
    })

    test('should show no results message', async ({ page }) => {
      await createBlogDraftViaAPI(page, {
        title: 'Some Post',
        content: 'Some content',
      })

      await goToBlogDrafts(page)

      await searchBlogDrafts(page, 'nonexistent')

      await expect(page.getByText(/no matching drafts/i)).toBeVisible()
    })
  })

  test.describe('Archive and Restore', () => {
    test('should archive a blog draft', async ({ page }) => {
      const created = await createBlogDraftViaAPI(page, {
        title: 'Archive Me',
        content: 'Archive test',
      })

      await page.goto(`/blog/${created.id}`)

      await archiveBlogDraft(page)

      // Should redirect to list
      await expect(page).toHaveURL('/blog', { timeout: 15000 })

      // Draft should not appear in All view
      await expect(page.getByText('Archive Me').first()).not.toBeVisible()

      // Verify in database
      const updated = await getBlogDraftById(page, created.id)
      expect(updated?.status).toBe('archived')
    })

    test('should show archived drafts in Archived filter', async ({ page }) => {
      const created = await createBlogDraftViaAPI(page, {
        title: 'Archived Draft',
        content: 'Archived',
      })

      await page.goto(`/blog/${created.id}`)
      await archiveBlogDraft(page)

      // Should be on list page
      await expect(page).toHaveURL('/blog', { timeout: 15000 })

      // Filter by Archived
      await filterBlogDraftsByStatus(page, 'archived')

      // Should show archived draft
      await expect(page.getByText('Archived Draft').first()).toBeVisible()
    })

    test('should restore an archived draft', async ({ page }) => {
      const created = await createBlogDraftViaAPI(page, {
        title: 'Restore Me',
        content: 'Restore test',
        status: 'archived',
      })

      await page.goto(`/blog/${created.id}`)

      await restoreBlogDraft(page)

      // Should show success message
      await expect(page.getByText(/draft restored/i)).toBeVisible()

      // Verify in database
      const updated = await getBlogDraftById(page, created.id)
      expect(updated?.status).toBe('draft')
    })

    test('should show restore button for archived drafts', async ({ page }) => {
      const created = await createBlogDraftViaAPI(page, {
        title: 'Archived Test',
        content: 'Archived',
        status: 'archived',
      })

      await page.goto(`/blog/${created.id}`)

      // Should show Restore button instead of Archive
      await expect(page.getByRole('button', { name: /^restore$/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /^archive$/i })).not.toBeVisible()
    })

    test('should show archive button for non-archived drafts', async ({ page }) => {
      const created = await createBlogDraftViaAPI(page, {
        title: 'Draft Test',
        content: 'Draft',
        status: 'draft',
      })

      await page.goto(`/blog/${created.id}`)

      // Should show Archive button instead of Restore
      await expect(page.getByRole('button', { name: /^archive$/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /^restore$/i })).not.toBeVisible()
    })

    test('should show archived drafts count only when there are archived drafts', async ({
      page,
    }) => {
      // Create non-archived draft
      await createBlogDraftViaAPI(page, {
        title: 'Draft',
        content: 'Draft',
        status: 'draft',
      })

      await goToBlogDrafts(page)

      // Archived tab should not be visible
      await expect(page.getByRole('button', { name: /^archived/i })).not.toBeVisible()

      // Now create archived draft
      await createBlogDraftViaAPI(page, {
        title: 'Archived',
        content: 'Archived',
        status: 'archived',
      })

      // Refresh page
      await page.reload()

      // Archived tab should now be visible
      await expect(page.getByRole('button', { name: /^archived/i })).toBeVisible()
    })
  })

  test.describe('Delete Blog Draft', () => {
    test('should delete a blog draft', async ({ page }) => {
      const created = await createBlogDraftViaAPI(page, {
        title: 'Delete Me',
        content: 'Delete test',
      })

      await page.goto(`/blog/${created.id}`)

      await deleteBlogDraft(page)

      // Should redirect to list
      await expect(page).toHaveURL('/blog', { timeout: 15000 })

      // Draft should not appear
      await expect(page.getByText('Delete Me').first()).not.toBeVisible()

      // Verify in database
      const deleted = await getBlogDraftById(page, created.id)
      expect(deleted).toBeNull()
    })

    test('should show confirmation dialog when deleting', async ({ page }) => {
      const created = await createBlogDraftViaAPI(page, {
        title: 'Confirm Delete',
        content: 'Confirm',
      })

      await page.goto(`/blog/${created.id}`)

      // Click delete to open ConfirmDialog
      await page.getByRole('button', { name: /^delete$/i }).click()

      // Verify the ConfirmDialog is shown with the expected message
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText('permanently')

      // Cancel the dialog
      await dialog.getByRole('button', { name: /^keep$/i }).click()

      // Should still be on edit page (dialog cancelled)
      await expect(page).toHaveURL(/\/blog\/[a-f0-9-]+/)

      // Draft should still exist
      const draft = await getBlogDraftById(page, created.id)
      expect(draft).not.toBeNull()
    })

    test('should not delete when confirmation is cancelled', async ({ page }) => {
      const created = await createBlogDraftViaAPI(page, {
        title: 'Cancel Delete',
        content: 'Cancel',
      })

      await page.goto(`/blog/${created.id}`)

      // Click delete to open ConfirmDialog
      await page.getByRole('button', { name: /^delete$/i }).click()

      // Cancel the ConfirmDialog
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: /^keep$/i }).click()

      // Should still be on edit page
      await expect(page).toHaveURL(/\/blog\/[a-f0-9-]+/)

      // Draft should still exist
      const draft = await getBlogDraftById(page, created.id)
      expect(draft).not.toBeNull()
    })
  })

  test.describe('Keyboard Shortcuts', () => {
    test('should save draft with Cmd+S / Ctrl+S', async ({ page }) => {
      await goToNewBlogDraft(page)

      await fillBlogDraftTitle(page, 'Keyboard Test')
      await fillBlogDraftContent(page, 'Testing keyboard shortcut')

      // Press Cmd+S (or Ctrl+S on Windows/Linux)
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
      await page.keyboard.press(`${modifier}+KeyS`)

      // Should show success message
      await expect(page.getByText(/draft created/i)).toBeVisible()

      // Verify in database
      const drafts = await getAllBlogDrafts(page)
      const created = drafts.find((d) => d.title === 'Keyboard Test')
      expect(created).toBeDefined()
    })
  })

  test.describe('Empty States', () => {
    test('should show empty state for filtered status with no results', async ({ page }) => {
      // Create a draft
      await createBlogDraftViaAPI(page, {
        title: 'Draft Only',
        content: 'Draft',
        status: 'draft',
      })

      await goToBlogDrafts(page)

      // Filter by Published (no published drafts)
      await filterBlogDraftsByStatus(page, 'published')

      await expect(page.getByText(/no published drafts/i)).toBeVisible()
    })

    test('should show empty state when search has no results', async ({ page }) => {
      await createBlogDraftViaAPI(page, {
        title: 'Some Post',
        content: 'Some content',
      })

      await goToBlogDrafts(page)

      await searchBlogDrafts(page, 'xyz123nonexistent')

      await expect(page.getByText(/no matching drafts/i)).toBeVisible()
      await expect(page.getByText(/try a different search term/i)).toBeVisible()
    })
  })
})
