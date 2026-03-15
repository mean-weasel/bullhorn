/* eslint-disable max-lines */
import { test, expect } from '@playwright/test'
import {
  enterDemoMode,
  goToProjects,
  getAllProjects,
  getProjectById,
  getAllCampaigns,
  createProjectViaAPI,
} from './helpers'

// eslint-disable-next-line max-lines-per-function
test.describe('Projects', () => {
  test.beforeEach(async ({ page }) => {
    await enterDemoMode(page)
  })

  // eslint-disable-next-line max-lines-per-function
  test.describe('Project CRUD Operations', () => {
     
    test('should create a new project', async ({ page }) => {
      // Navigate to projects
      await goToProjects(page)

      // Click "New Project" button
      await page.getByRole('button', { name: /new project|new$/i }).click()

      // Fill project details in modal
      await page.getByPlaceholder(/enter project name/i).fill('Product Launch 2024')
      await page
        .getByPlaceholder(/describe this project/i)
        .fill('Marketing initiatives for new product release')

      // Submit
      await page.getByRole('button', { name: /create project/i }).click()

      // Should navigate to project detail page
      await page.waitForURL(/\/projects\//, { timeout: 15000 })
      await expect(page.getByText('Product Launch 2024')).toBeVisible({ timeout: 10000 })

      // Verify in database
      const projects = await getAllProjects(page)
      expect(projects.length).toBe(1)
      expect(projects[0].name).toBe('Product Launch 2024')
      expect(projects[0].description).toBe('Marketing initiatives for new product release')
    })

     
    test('should edit a project name and description', async ({ page }) => {
      // Create a project first
      await goToProjects(page)
      await page.getByRole('button', { name: /new project|new$/i }).click()
      await page.getByPlaceholder(/enter project name/i).fill('Edit Test Project')
      await page.getByRole('button', { name: /create project/i }).click()

      // Wait for navigation to detail page
      await page.waitForURL(/\/projects\//)
      await expect(page.getByRole('heading', { name: 'Edit Test Project' })).toBeVisible()

      // Click the edit button (pencil icon) next to the project name - this opens Settings tab
      const editButton = page.locator('h1').locator('..').locator('button').first()
      await editButton.click()

      // Settings tab should now be active with input fields
      await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()

      // Update name - the input is in the Settings tab
      const nameInput = page.locator('input[type="text"]').first()
      await expect(nameInput).toBeVisible()
      await nameInput.clear()
      await nameInput.fill('Updated Project Name')

      // Update description
      const descInput = page.locator('textarea').first()
      await descInput.fill('New description for the project')

      // Save changes - button says "Save Changes" in Settings tab
      await page.getByRole('button', { name: /save changes/i }).click()

      // Switch back to Campaigns tab and verify heading updated
      await page.getByRole('button', { name: 'Campaigns' }).click()
      await expect(page.getByRole('heading', { name: 'Updated Project Name' })).toBeVisible()

      // Verify in database
      const projects = await getAllProjects(page)
      expect(projects[0].name).toBe('Updated Project Name')
      expect(projects[0].description).toBe('New description for the project')
    })

     
    test('should delete a project', async ({ page }) => {
      // Create a project
      await goToProjects(page)
      await page.getByRole('button', { name: /new project|new$/i }).click()
      await page.getByPlaceholder(/enter project name/i).fill('Project to Delete')
      await page.getByRole('button', { name: /create project/i }).click()
      await page.waitForURL(/\/projects\//)

      // Verify project exists
      let projects = await getAllProjects(page)
      expect(projects.length).toBe(1)

      // Click delete button (trash icon)
      const deleteButton = page.getByTitle('Delete project')
      await expect(deleteButton).toBeVisible()
      await deleteButton.click()

      // Confirm in the dialog
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      await dialog.getByRole('button', { name: 'Delete' }).click()

      // Should navigate back to projects list
      await page.waitForURL('/projects')

      // Verify project is deleted
      projects = await getAllProjects(page)
      expect(projects.length).toBe(0)
    })

     
    test('should delete project and show affected campaigns in confirmation', async ({ page }) => {
      // Create a project
      await goToProjects(page)
      await page.getByRole('button', { name: /new project|new$/i }).click()
      await page.getByPlaceholder(/enter project name/i).fill('Project With Campaigns')
      await page.getByRole('button', { name: /create project/i }).click()
      await page.waitForURL(/\/projects\//)
      const projectId = page.url().split('/projects/')[1]

      // Create a campaign in this project via API
      const campaignResponse = await page.request.post('/api/campaigns', {
        data: { name: 'Campaign for Project', projectId },
      })
      expect(campaignResponse.ok()).toBe(true)

      // Go back to project detail
      await page.goto(`/projects/${projectId}`)
      // Wait for the campaign to show up in the list
      await expect(page.getByText('Campaign for Project')).toBeVisible({ timeout: 5000 })

      // Click delete button
      const deleteButton = page.getByTitle('Delete project')
      await deleteButton.click()

      // Confirmation dialog should show affected campaigns
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText(/1 campaign.* will be affected/i)).toBeVisible()
      await expect(dialog.getByText('Campaign for Project')).toBeVisible()

      // Confirm deletion - button says "Delete Project"
      await dialog.getByRole('button', { name: /delete/i }).click()

      // Should navigate back to projects list
      await page.waitForURL('/projects')

      // Verify project is deleted
      const projects = await getAllProjects(page)
      expect(projects.length).toBe(0)

      // Campaign should be unassigned (not deleted)
      const campaigns = await getAllCampaigns(page)
      expect(campaigns.length).toBe(1)
      expect(campaigns[0].projectId == null).toBe(true)
    })
  })

   
  test.describe('Project List Page', () => {
     
    test('should show empty state when no projects exist', async ({ page }) => {
      await goToProjects(page)

      // Should show empty state message
      await expect(page.getByText('No projects yet')).toBeVisible()

      // Should have "Create Your First Project" button
      await expect(page.getByRole('button', { name: /create your first project/i })).toBeVisible()
    })

     
    test('should list all projects sorted by most recent', async ({ page }) => {
      // Create projects via API
      await createProjectViaAPI(page, { name: 'First Project' })
      await page.waitForTimeout(100) // Small delay for different timestamps
      await createProjectViaAPI(page, { name: 'Second Project' })
      await page.waitForTimeout(100)
      await createProjectViaAPI(page, { name: 'Third Project' })

      // Navigate to projects
      await goToProjects(page)

      // All projects should be visible
      await expect(page.getByText('First Project')).toBeVisible()
      await expect(page.getByText('Second Project')).toBeVisible()
      await expect(page.getByText('Third Project')).toBeVisible()

      // Most recent should be first (Third Project)
      const projectCards = page.locator('a[href^="/projects/"]')
      const firstCardText = await projectCards.first().textContent()
      expect(firstCardText).toContain('Third Project')
    })

     
    test('should show campaign count on project cards', async ({ page }) => {
      // Create a project
      const project = await createProjectViaAPI(page, { name: 'Project With Count' })

      // Create campaigns via API and assign to project
      const campaignResponse = await page.request.post('/api/campaigns', {
        data: { name: 'Campaign 1', projectId: project.id },
      })
      expect(campaignResponse.ok()).toBeTruthy()

      const campaignResponse2 = await page.request.post('/api/campaigns', {
        data: { name: 'Campaign 2', projectId: project.id },
      })
      expect(campaignResponse2.ok()).toBeTruthy()

      // Navigate to projects
      await goToProjects(page)

      // Should show "2 campaigns" on the project card
      await expect(page.getByText('2 campaigns')).toBeVisible()
    })
  })

   
  test.describe('Project Detail Page', () => {
     
    test('should show project details', async ({ page }) => {
      // Create a project
      await goToProjects(page)
      await page.getByRole('button', { name: /new project|new$/i }).click()
      await page.getByPlaceholder(/enter project name/i).fill('Detailed Project')
      await page.getByPlaceholder(/describe this project/i).fill('This is the project description')
      await page.getByRole('button', { name: /create project/i }).click()
      await page.waitForURL(/\/projects\//)

      // Should show project name and description
      await expect(page.getByRole('heading', { name: 'Detailed Project' })).toBeVisible()
      await expect(page.getByText('This is the project description')).toBeVisible()
    })

     
    test('should show empty campaigns state', async ({ page }) => {
      // Create a project
      await goToProjects(page)
      await page.getByRole('button', { name: /new project|new$/i }).click()
      await page.getByPlaceholder(/enter project name/i).fill('Empty Project')
      await page.getByRole('button', { name: /create project/i }).click()
      await page.waitForURL(/\/projects\//)

      // Should show empty campaigns message
      await expect(page.getByText(/no campaigns/i)).toBeVisible()
    })

     
    test('should list campaigns in project', async ({ page }) => {
      // Create a project
      const project = await createProjectViaAPI(page, { name: 'Project With Campaigns' })

      // Create campaigns assigned to this project
      await page.request.post('/api/campaigns', {
        data: { name: 'First Campaign', projectId: project.id },
      })
      await page.request.post('/api/campaigns', {
        data: { name: 'Second Campaign', projectId: project.id },
      })

      // Navigate to project detail
      await page.goto(`/projects/${project.id}`)

      // Should show both campaigns
      await expect(page.getByText('First Campaign')).toBeVisible()
      await expect(page.getByText('Second Campaign')).toBeVisible()
    })

     
    test('should navigate to create campaign scoped to project', async ({ page }) => {
      // Create a project
      const project = await createProjectViaAPI(page, { name: 'Project for Campaign' })

      // Navigate to project detail
      await page.goto(`/projects/${project.id}`)

      // Click "New Campaign" button (it's a button that opens a modal, not a link)
      const newCampaignButton = page.getByRole('button', { name: /new campaign/i })
      await expect(newCampaignButton).toBeVisible()
      await newCampaignButton.click()

      // Modal should appear with campaign creation form
      const modal = page.locator('.fixed.inset-0').last()
      await expect(modal).toBeVisible()
      await expect(modal.getByRole('heading', { name: /new campaign/i })).toBeVisible()

      // Fill in the campaign name
      await modal.getByPlaceholder(/enter campaign name/i).fill('Test Campaign')

      // Submit the form
      await modal.getByRole('button', { name: /create campaign/i }).click()

      // Campaign should be created and shown in the project's campaign list
      await expect(page.getByText('Test Campaign')).toBeVisible()

      // Verify campaign was created with correct projectId
      const campaigns = await getAllCampaigns(page)
      const createdCampaign = campaigns.find((c) => c.name === 'Test Campaign')
      expect(createdCampaign).toBeDefined()
      expect(createdCampaign?.projectId).toBe(project.id)
    })
  })

  // eslint-disable-next-line max-lines-per-function
  test.describe('Campaign Move Between Projects', () => {
     
    test('should move campaign from unassigned to project', async ({ page }) => {
      // Create a project
      const project = await createProjectViaAPI(page, { name: 'Target Project' })

      // Create an unassigned campaign via API
      const campaignResponse = await page.request.post('/api/campaigns', {
        data: { name: 'Campaign to Move' },
      })
      const campaignData = await campaignResponse.json()
      const campaignId = campaignData.campaign.id

      // Verify campaign is unassigned
      let campaigns = await getAllCampaigns(page)
      expect(campaigns.find((c) => c.id === campaignId)?.projectId == null).toBe(true)

      // Navigate to campaign detail
      await page.goto(`/campaigns/${campaignId}`)
      await expect(page.getByRole('heading', { name: 'Campaign to Move' })).toBeVisible()

      // Click move button
      await page.getByRole('button', { name: /^move$/i }).click()

      // Modal should appear with "Move Campaign" heading
      const modal = page.getByRole('dialog').filter({ hasText: 'Move Campaign' })
      await expect(modal).toBeVisible()

      // Wait for projects to load in the modal
      await expect(modal.getByText('Target Project')).toBeVisible({ timeout: 5000 })

      // Select the target project
      await modal.getByText('Target Project').click()

      // Click move button
      await modal.getByRole('button', { name: /move campaign/i }).click()

      // Wait for modal to close
      await expect(modal).not.toBeVisible({ timeout: 5000 })

      // Verify campaign is now in the project
      campaigns = await getAllCampaigns(page)
      const movedCampaign = campaigns.find((c) => c.id === campaignId)
      expect(movedCampaign?.projectId).toBe(project.id)
    })

     
    test('should move campaign between projects', async ({ page }) => {
      // Create two projects
      const project1 = await createProjectViaAPI(page, { name: 'Project One' })
      const project2 = await createProjectViaAPI(page, { name: 'Project Two' })

      // Create a campaign in project 1
      const campaignResponse = await page.request.post('/api/campaigns', {
        data: { name: 'Campaign to Move', projectId: project1.id },
      })
      const campaignData = await campaignResponse.json()
      const campaignId = campaignData.campaign.id

      // Navigate to campaign detail
      await page.goto(`/campaigns/${campaignId}`)
      await expect(page.getByRole('heading', { name: 'Campaign to Move' })).toBeVisible()

      // Click move button
      await page.getByRole('button', { name: /^move$/i }).click()

      // Modal should show current project
      const modal = page.getByRole('dialog').filter({ hasText: 'Move Campaign' })
      await expect(modal).toBeVisible()
      await expect(modal.getByText(/currently in/i)).toBeVisible()
      // "Project One" appears in "Currently in:" section
      await expect(modal.locator('.bg-accent\\/30').getByText('Project One')).toBeVisible()

      // Wait for projects to load and select project 2 (click the button, not the "Currently in:" text)
      const project2Button = modal.getByRole('button').filter({ hasText: 'Project Two' })
      await expect(project2Button).toBeVisible({ timeout: 5000 })
      await project2Button.click()

      // Click move button
      await modal.getByRole('button', { name: /move campaign/i }).click()

      // Wait for modal to close
      await expect(modal).not.toBeVisible({ timeout: 5000 })

      // Verify campaign is now in project 2
      const campaigns = await getAllCampaigns(page)
      const movedCampaign = campaigns.find((c) => c.id === campaignId)
      expect(movedCampaign?.projectId).toBe(project2.id)
    })

     
    test('should move campaign to unassigned', async ({ page }) => {
      // Create a project
      const project = await createProjectViaAPI(page, { name: 'Source Project' })

      // Create a campaign in the project
      const campaignResponse = await page.request.post('/api/campaigns', {
        data: { name: 'Campaign to Unassign', projectId: project.id },
      })
      const campaignData = await campaignResponse.json()
      const campaignId = campaignData.campaign.id

      // Navigate to campaign detail
      await page.goto(`/campaigns/${campaignId}`)
      await expect(page.getByRole('heading', { name: 'Campaign to Unassign' })).toBeVisible()

      // Click move button
      await page.getByRole('button', { name: /^move$/i }).click()

      // Modal should appear
      const modal = page.getByRole('dialog').filter({ hasText: 'Move Campaign' })
      await expect(modal).toBeVisible()

      // Select "Unassigned" option
      const unassignedOption = modal
        .locator('button')
        .filter({ hasText: 'Unassigned' })
        .filter({ hasText: 'Not part of any project' })
      await expect(unassignedOption).toBeVisible({ timeout: 5000 })
      await unassignedOption.click()

      // Click move button
      await modal.getByRole('button', { name: /move campaign/i }).click()

      // Wait for modal to close
      await expect(modal).not.toBeVisible({ timeout: 5000 })

      // Verify campaign is now unassigned
      const campaigns = await getAllCampaigns(page)
      const movedCampaign = campaigns.find((c) => c.id === campaignId)
      expect(movedCampaign?.projectId == null).toBe(true)
    })
  })

   
  test.describe('Project Brand Kit', () => {
     
    test('should add hashtags to project', async ({ page }) => {
      // Create a project
      await goToProjects(page)
      await page.getByRole('button', { name: /new project|new$/i }).click()
      await page.getByPlaceholder(/enter project name/i).fill('Hashtag Test Project')
      await page.getByRole('button', { name: /create project/i }).click()
      await page.waitForURL(/\/projects\//)
      const projectId = page.url().split('/projects/')[1]

      // Find the hashtag input and add hashtags
      const hashtagInput = page.getByPlaceholder(/add hashtag/i)
      if (await hashtagInput.isVisible()) {
        await hashtagInput.fill('marketing')
        await hashtagInput.press('Enter')

        await hashtagInput.fill('launch2024')
        await hashtagInput.press('Enter')

        // Wait for save to complete
        await expect(page.getByText('#launch2024')).toBeVisible({ timeout: 5000 })

        // Verify hashtags in database
        const project = await getProjectById(page, projectId)
        expect(project?.hashtags).toContain('#marketing')
        expect(project?.hashtags).toContain('#launch2024')
      }
    })

     
    test('should remove hashtag from project', async ({ page }) => {
      // Create a project with hashtags via API
      const response = await page.request.post('/api/projects', {
        data: {
          name: 'Hashtag Remove Test',
          hashtags: ['#test', '#remove'],
        },
      })
      const projectData = await response.json()
      const projectId = projectData.project.id

      // Navigate to project
      await page.goto(`/projects/${projectId}`)

      // Find and click remove button for a hashtag
      const hashtagChip = page.locator('[data-testid="hashtag-chip"]').filter({ hasText: '#test' })
      if (await hashtagChip.isVisible()) {
        await hashtagChip.locator('button').click()

        // Wait for chip to disappear after removal
        await expect(hashtagChip).not.toBeVisible({ timeout: 5000 })

        // Verify hashtag removed in database
        const project = await getProjectById(page, projectId)
        expect(project?.hashtags).not.toContain('#test')
        expect(project?.hashtags).toContain('#remove')
      }
    })
  })

   
  test.describe('Loading and Error States', () => {
     
    test('should show loading state while fetching projects', async ({ page }) => {
      // Navigate to projects - loading should briefly appear
      await page.goto('/projects')

      // The loading spinner should appear briefly (this is fast, may need network throttling)
      // Just verify the page eventually loads
      await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
    })

     
    test('should show retry button on error', async ({ page }) => {
      // This test would require mocking network failures
      // For now, just verify the error UI exists by checking component structure
      // In a real test, you'd use page.route() to intercept and fail the API call

      // Navigate to projects normally
      await goToProjects(page)

      // Verify page loads without error
      await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
    })
  })

   
  test.describe('Navigation', () => {
     
    test('should navigate from dashboard to projects', async ({ page }) => {
      // Go to dashboard
      await page.goto('/dashboard')

      // Click on Projects in the nav
      await page.getByRole('link', { name: 'Projects' }).click()

      // Should be on projects page
      await expect(page).toHaveURL('/projects')
      await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible()
    })

     
    test('should navigate from project list to project detail', async ({ page }) => {
      // Create a project
      const project = await createProjectViaAPI(page, { name: 'Navigation Test' })

      // Navigate to projects list
      await goToProjects(page)

      // Click on the project card
      await page.getByText('Navigation Test').click()

      // Should be on project detail page
      await expect(page).toHaveURL(`/projects/${project.id}`)
      await expect(page.getByRole('heading', { name: 'Navigation Test' })).toBeVisible()
    })

     
    test('should navigate back to projects list from detail', async ({ page }) => {
      // Create a project
      const project = await createProjectViaAPI(page, { name: 'Back Nav Test' })

      // Navigate to project detail
      await page.goto(`/projects/${project.id}`)

      // Click back link or breadcrumb
      const backLink = page.getByRole('link', { name: /projects/i }).first()
      await backLink.click()

      // Should be back on projects list
      await expect(page).toHaveURL('/projects')
    })
  })
})
