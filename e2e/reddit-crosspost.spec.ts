import { test, expect } from '@playwright/test'
import {
  resetDatabase,
  goToNewPost,
  selectPlatform,
  fillContent,
  fillRedditFields,
  saveDraft,
  schedulePost,
  setSchedule,
  waitForNavigation,
  getAllPosts,
  expandSubredditCard,
  collapseSubredditCard,
  fillSubredditTitle,
  setSubredditSchedule,
  removeSubredditViaCard,
  waitForRedditEditForm,
} from './helpers'

// Type guard to access Reddit content fields
function getRedditContent(post: {
  content: unknown
}): { subreddit: string; title: string; body?: string; launchedUrl?: string } | undefined {
  const content = post.content as {
    subreddit?: string
    title?: string
    body?: string
    launchedUrl?: string
  }
  if (content && typeof content.subreddit === 'string') {
    return content as { subreddit: string; title: string; body?: string; launchedUrl?: string }
  }
  return undefined
}

test.describe('Reddit Cross-posting', () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase(page)
  })

  test.describe('Multiple Subreddit Post Creation', () => {
    test('should create separate posts for each subreddit', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      // Add 3 subreddits
      await fillRedditFields(page, {
        subreddits: ['startups', 'SaaS', 'sideproject'],
        title: 'Launching my new product',
      })
      await fillContent(page, 'Check out what I built!')

      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify 3 separate posts were created
      const posts = await getAllPosts(page)
      expect(posts.length).toBe(3)

      // Verify each post has a different subreddit
      const subreddits = posts.map((p) => getRedditContent(p)?.subreddit).sort()
      expect(subreddits).toEqual(['SaaS', 'sideproject', 'startups'])

      // Verify all posts have the same content
      for (const post of posts) {
        expect(getRedditContent(post)?.title).toBe('Launching my new product')
        expect(getRedditContent(post)?.body).toContain('Check out what I built!')
      }
    })

    test('should link posts with shared groupId', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddits: ['webdev', 'programming'],
        title: 'Code tip of the day',
      })
      await fillContent(page, 'Here is a useful trick...')

      await saveDraft(page)
      await waitForNavigation(page, '/')

      const posts = await getAllPosts(page)
      expect(posts.length).toBe(2)

      // Verify both posts share the same groupId
      expect(posts[0].groupId).toBeTruthy()
      expect(posts[1].groupId).toBeTruthy()
      expect(posts[0].groupId).toBe(posts[1].groupId)

      // Verify groupType is 'reddit-crosspost'
      expect(posts[0].groupType).toBe('reddit-crosspost')
      expect(posts[1].groupType).toBe('reddit-crosspost')
    })

    test('should create single post for single subreddit (no groupId)', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddits: ['webdev'],
        title: 'Single subreddit post',
      })
      await fillContent(page, 'Just one subreddit')

      await saveDraft(page)
      await waitForNavigation(page, '/')

      const posts = await getAllPosts(page)
      expect(posts.length).toBe(1)

      // Single post should NOT have groupId
      expect(posts[0].groupId).toBeFalsy()
      expect(posts[0].groupType).toBeFalsy()
      expect(getRedditContent(posts[0])?.subreddit).toBe('webdev')
    })
  })

  test.describe('Independent Scheduling', () => {
    test('should schedule all subreddit posts with same initial time', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddits: ['startups', 'entrepreneur'],
        title: 'My startup journey',
      })
      await fillContent(page, 'How I built my company')

      // Set schedule
      const tomorrow = new Date()
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      tomorrow.setUTCHours(10, 0, 0, 0)
      await setSchedule(page, tomorrow)

      await schedulePost(page)
      await waitForNavigation(page, '/')

      const posts = await getAllPosts(page)
      expect(posts.length).toBe(2)

      // Both should be scheduled
      expect(posts[0].status).toBe('scheduled')
      expect(posts[1].status).toBe('scheduled')

      // Both should have scheduledAt set
      expect(posts[0].scheduledAt).toBeTruthy()
      expect(posts[1].scheduledAt).toBeTruthy()
    })

    test('should allow editing individual subreddit post schedule', async ({ page }) => {
      // Create cross-posts
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddits: ['startups', 'entrepreneur'],
        title: 'My startup journey',
      })
      await fillContent(page, 'How I built my company')

      const tomorrow = new Date()
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      tomorrow.setUTCHours(10, 0, 0, 0)
      await setSchedule(page, tomorrow)

      await schedulePost(page)
      await waitForNavigation(page, '/')

      // Get the posts
      let posts = await getAllPosts(page)
      expect(posts.length).toBe(2)
      const entrepreneurPost = posts.find((p) => getRedditContent(p)?.subreddit === 'entrepreneur')!

      // Edit the entrepreneur post to a different time
      await page.goto(`/edit/${entrepreneurPost.id}`)
      await waitForRedditEditForm(page, 'entrepreneur')

      // Change to day after tomorrow at 3pm
      const dayAfter = new Date()
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 2)
      dayAfter.setUTCHours(15, 0, 0, 0)

      // Use setSchedule helper to update schedule
      await setSchedule(page, dayAfter)

      await schedulePost(page)
      await waitForNavigation(page, '/')

      // Verify the posts now have different schedules
      posts = await getAllPosts(page)
      const updatedStartup = posts.find((p) => getRedditContent(p)?.subreddit === 'startups')!
      const updatedEntrepreneur = posts.find(
        (p) => getRedditContent(p)?.subreddit === 'entrepreneur'
      )!

      // The schedules should be different
      expect(updatedStartup.scheduledAt).not.toBe(updatedEntrepreneur.scheduledAt)

      // Verify the UI shows correct times in the subreddit cards (check hidden input with -input suffix)
      await page.goto(`/edit/${updatedStartup.id}`)
      await waitForRedditEditForm(page, 'startups')
      await expect(page.locator('[data-testid="subreddit-time-startups-input"]')).toHaveValue(
        '10:00',
        { timeout: 15000 }
      )

      await page.goto(`/edit/${updatedEntrepreneur.id}`)
      await waitForRedditEditForm(page, 'entrepreneur')
      await expect(page.locator('[data-testid="subreddit-time-entrepreneur-input"]')).toHaveValue(
        '15:00',
        { timeout: 15000 }
      )
    })

    test('should allow different statuses for grouped posts', async ({ page }) => {
      // Create cross-posts as drafts
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddits: ['webdev', 'javascript'],
        title: 'JS tip',
      })
      await fillContent(page, 'Use const by default')

      await saveDraft(page)
      await waitForNavigation(page, '/')

      let posts = await getAllPosts(page)
      expect(posts.length).toBe(2)

      // Both should be drafts
      expect(posts[0].status).toBe('draft')
      expect(posts[1].status).toBe('draft')

      // Schedule only the webdev post
      const webdevPost = posts.find((p) => getRedditContent(p)?.subreddit === 'webdev')!
      await page.goto(`/edit/${webdevPost.id}`)
      await waitForRedditEditForm(page, 'webdev')

      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      await setSchedule(page, tomorrow)
      await schedulePost(page)
      await waitForNavigation(page, '/')

      // Verify different statuses
      posts = await getAllPosts(page)
      const updatedWebdev = posts.find((p) => getRedditContent(p)?.subreddit === 'webdev')!
      const updatedJs = posts.find((p) => getRedditContent(p)?.subreddit === 'javascript')!

      expect(updatedWebdev.status).toBe('scheduled')
      expect(updatedJs.status).toBe('draft')

      // They should still share the same groupId
      expect(updatedWebdev.groupId).toBe(updatedJs.groupId)
    })
  })

  test.describe('Post Content Independence', () => {
    test('should allow editing individual post content independently', async ({ page }) => {
      // Create cross-posts
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddits: ['startups', 'smallbusiness'],
        title: 'Original title',
      })
      await fillContent(page, 'Original content')

      await saveDraft(page)
      await waitForNavigation(page, '/')

      let posts = await getAllPosts(page)
      const startupPost = posts.find((p) => getRedditContent(p)?.subreddit === 'startups')!

      // Edit just the startups post title
      await page.goto(`/edit/${startupPost.id}`)
      await waitForRedditEditForm(page, 'startups')

      // Change the Reddit title via the subreddit card
      await expandSubredditCard(page, 'startups')
      await fillSubredditTitle(page, 'startups', 'Updated title for startups')

      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify only the startups post was updated
      posts = await getAllPosts(page)
      const updatedStartup = posts.find((p) => getRedditContent(p)?.subreddit === 'startups')!
      const smallbizPost = posts.find((p) => getRedditContent(p)?.subreddit === 'smallbusiness')!

      expect(getRedditContent(updatedStartup)?.title).toBe('Updated title for startups')
      expect(getRedditContent(smallbizPost)?.title).toBe('Original title')
    })

    test('should track launchedUrl independently per subreddit', async ({ page }) => {
      // Create cross-posts
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, {
        subreddits: ['webdev', 'programming'],
        title: 'Code tutorial',
      })
      await fillContent(page, 'Learn something new')

      await saveDraft(page)
      await waitForNavigation(page, '/')

      let posts = await getAllPosts(page)
      const webdevPost = posts.find((p) => getRedditContent(p)?.subreddit === 'webdev')!

      // Add launchedUrl to just the webdev post
      await page.goto(`/edit/${webdevPost.id}`)
      await waitForRedditEditForm(page, 'webdev')

      // Expand Published Links section and wait for input to render
      await page.getByText('Published Links').click()
      const redditUrlInput = page.locator('input[placeholder="https://reddit.com/r/..."]')
      await expect(redditUrlInput).toBeVisible()

      // Fill in the Reddit launched URL and verify React processed the value
      await redditUrlInput.fill('https://reddit.com/r/webdev/comments/abc123')
      await expect(redditUrlInput).toHaveValue('https://reddit.com/r/webdev/comments/abc123')

      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify only webdev post has launchedUrl
      posts = await getAllPosts(page)
      const updatedWebdev = posts.find((p) => getRedditContent(p)?.subreddit === 'webdev')!
      const programmingPost = posts.find((p) => getRedditContent(p)?.subreddit === 'programming')!

      expect(getRedditContent(updatedWebdev)?.launchedUrl).toBe(
        'https://reddit.com/r/webdev/comments/abc123'
      )
      expect(getRedditContent(programmingPost)?.launchedUrl).toBeFalsy()
    })
  })

  test.describe('Per-Subreddit Collapsible Cards', () => {
    test('should display collapsible card for each subreddit', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      // Add two subreddits
      await fillRedditFields(page, { subreddits: ['startups', 'entrepreneur'] })

      // Verify cards are visible
      const startupsCard = page.locator('[data-testid="subreddit-card-startups"]')
      const entrepreneurCard = page.locator('[data-testid="subreddit-card-entrepreneur"]')

      await expect(startupsCard).toBeVisible()
      await expect(entrepreneurCard).toBeVisible()

      // Cards should show subreddit names
      await expect(startupsCard.getByText('r/startups')).toBeVisible()
      await expect(entrepreneurCard.getByText('r/entrepreneur')).toBeVisible()
    })

    test('should set unique titles per subreddit', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, { subreddits: ['startups', 'entrepreneur'] })
      await fillContent(page, 'Great content here')

      // Expand first card and set title
      await expandSubredditCard(page, 'startups')
      await fillSubredditTitle(page, 'startups', 'Startup Title')

      // Expand second card and set different title
      await expandSubredditCard(page, 'entrepreneur')
      await fillSubredditTitle(page, 'entrepreneur', 'Entrepreneur Title')

      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Verify database has different titles
      const posts = await getAllPosts(page)
      expect(posts.length).toBe(2)

      const startupPost = posts.find((p) => getRedditContent(p)?.subreddit === 'startups')!
      const entrepreneurPost = posts.find((p) => getRedditContent(p)?.subreddit === 'entrepreneur')!

      expect(getRedditContent(startupPost)?.title).toBe('Startup Title')
      expect(getRedditContent(entrepreneurPost)?.title).toBe('Entrepreneur Title')
    })

    test('should set unique schedules per subreddit via cards', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, { subreddits: ['webdev', 'javascript'] })
      await fillContent(page, 'Code tip')

      // Expand first card and set schedule
      await expandSubredditCard(page, 'webdev')
      await fillSubredditTitle(page, 'webdev', 'Webdev Title')
      const tomorrow = new Date()
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
      tomorrow.setUTCHours(10, 0, 0, 0)
      await setSubredditSchedule(page, 'webdev', tomorrow)

      // Expand second card and set different schedule
      await expandSubredditCard(page, 'javascript')
      await fillSubredditTitle(page, 'javascript', 'JS Title')
      const dayAfter = new Date()
      dayAfter.setUTCDate(dayAfter.getUTCDate() + 2)
      dayAfter.setUTCHours(14, 0, 0, 0)
      await setSubredditSchedule(page, 'javascript', dayAfter)

      await schedulePost(page)
      await waitForNavigation(page, '/')

      const posts = await getAllPosts(page)
      const webdevPost = posts.find((p) => getRedditContent(p)?.subreddit === 'webdev')!
      const jsPost = posts.find((p) => getRedditContent(p)?.subreddit === 'javascript')!

      expect(webdevPost.scheduledAt).not.toBe(jsPost.scheduledAt)
      expect(webdevPost.status).toBe('scheduled')
      expect(jsPost.status).toBe('scheduled')
    })

    test('should show preview text when card is collapsed', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, { subreddits: ['startups'] })

      // Expand and set title
      await expandSubredditCard(page, 'startups')
      await fillSubredditTitle(page, 'startups', 'My Amazing Post')

      // Collapse by clicking header again
      await collapseSubredditCard(page, 'startups')

      // Verify preview shows title
      const card = page.locator('[data-testid="subreddit-card-startups"]')
      await expect(card.getByText(/My Amazing Post/)).toBeVisible()
    })

    test('should expand/collapse cards independently', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, { subreddits: ['webdev', 'javascript', 'programming'] })

      // Expand webdev
      await expandSubredditCard(page, 'webdev')
      const webdevTitle = page.locator('[data-testid="subreddit-title-webdev"]')
      await expect(webdevTitle).toBeVisible()

      // javascript and programming should still be collapsed
      const jsTitle = page.locator('[data-testid="subreddit-title-javascript"]')
      const progTitle = page.locator('[data-testid="subreddit-title-programming"]')
      await expect(jsTitle).not.toBeVisible()
      await expect(progTitle).not.toBeVisible()

      // Expand javascript (webdev stays expanded)
      await expandSubredditCard(page, 'javascript')
      await expect(webdevTitle).toBeVisible()
      await expect(jsTitle).toBeVisible()
      await expect(progTitle).not.toBeVisible()
    })

    test('should remove subreddit via card X button', async ({ page }) => {
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, { subreddits: ['startups', 'entrepreneur'] })

      // Verify both cards exist
      await expect(page.locator('[data-testid="subreddit-card-startups"]')).toBeVisible()
      await expect(page.locator('[data-testid="subreddit-card-entrepreneur"]')).toBeVisible()

      // Remove startups via X button
      await removeSubredditViaCard(page, 'startups')

      // Verify only entrepreneur remains
      await expect(page.locator('[data-testid="subreddit-card-startups"]')).not.toBeVisible()
      await expect(page.locator('[data-testid="subreddit-card-entrepreneur"]')).toBeVisible()
    })

    test('should preserve title when editing existing post', async ({ page }) => {
      // Create a post first
      await goToNewPost(page)
      await selectPlatform(page, 'reddit')

      await fillRedditFields(page, { subreddits: ['webdev'] })
      await expandSubredditCard(page, 'webdev')
      await fillSubredditTitle(page, 'webdev', 'Original Title')
      await fillContent(page, 'Test content')

      await saveDraft(page)
      await waitForNavigation(page, '/')

      // Get the post and edit it
      const posts = await getAllPosts(page)
      expect(posts.length).toBe(1)
      await page.goto(`/edit/${posts[0].id}`)
      await waitForRedditEditForm(page, 'webdev')

      // Verify the title is loaded in the card
      const titleInput = page.locator('[data-testid="subreddit-title-webdev"]')
      await expect(titleInput).toHaveValue('Original Title', { timeout: 15000 })
    })
  })
})
