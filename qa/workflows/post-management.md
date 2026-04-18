# Post Management — CRUD Across Platforms

**Fixture:** `qa/fixtures/default.yaml`
**Seed command:** `make qa-seed`
**Browser prep:** Clear localStorage (especially `bullhorn-draft-new-post`) before running — stale draft state from prior runs causes phantom redirects to `/new`.

Test all post lifecycle operations across Twitter, LinkedIn, and Reddit.

## Steps

### 1. Create Twitter Draft

1. Navigate to `/new`
2. Select Twitter as the platform
3. Type: "Testing post creation from QA workflow"
4. Add notes: "QA test note"
5. Click "Save Draft"
6. Verify redirect to the dashboard
7. Verify content, notes, and platform are correct

### 2. Create LinkedIn Scheduled Post

1. Navigate to `/new`
2. Select LinkedIn as the platform
3. Type: "LinkedIn post from QA workflow — testing the full scheduling flow"
4. Set a schedule date (tomorrow, any time)
5. Click "Schedule"
6. Verify redirect to the dashboard
7. Verify the scheduled date/time is set
8. Verify status shows "Scheduled"

### 3. Create Reddit Draft

1. Navigate to `/new`
2. Select Reddit as the platform
3. Fill in subreddit: "test"
4. Fill in title: "QA workflow test"
5. Fill in body: "This is a test post from the QA workflow"
6. Click "Save Draft"
7. Verify the Reddit-specific fields are saved correctly

### 4. Edit an Existing Post

1. Navigate to `/posts`
2. Click on the teaser tweet ("Something big is coming next week...")
3. Modify the text: append " 🎉"
4. Click "Save Draft"
5. Verify the content is updated
6. Navigate back to posts list and verify the updated content shows

### 5. Schedule a Draft

1. Navigate to `/posts` and filter to "Draft"
2. Click on the tip tweet ("Pro tip: Use campaigns...")
3. Set a schedule for 2 days from now at 15:00
4. Click "Schedule"
5. Verify the post now shows as "Scheduled"
6. Navigate to posts list, filter to "Scheduled"
7. Verify the post appears in the scheduled list

### 6. Archive a Post

1. Navigate to `/posts`
2. Click on the published tweet ("Just shipped a major update...")
3. Click "Archive" (button is directly visible on the edit page)
4. Confirm the archive action in the dialog
5. Verify the post moves to "Archived" filter
6. Navigate to "Archived" filter and verify it appears

### 7. Restore an Archived Post

1. While on the "Archived" filter
2. Click on the archived tweet ("This was a test post...")
3. Click "Restore" (button is directly visible on the edit page)
4. Verify the post moves back to "Draft" status
5. Navigate to "Draft" filter and verify it appears

### 8. Delete a Post

1. Navigate to `/posts` and filter to "Archived"
2. Archive a post first (if none are archived after step 7)
3. Click on an archived post
4. Click "Delete" (button is directly visible on the edit page)
5. Confirm the delete action in the dialog
6. Verify the post is removed from the list
7. Verify the total post count decreased

### 9. Assign Post to Campaign

1. Navigate to `/posts` and filter to "Draft"
2. Click on the Reddit draft (look for body text: "Built this over the past few months...")
3. Open the campaign selector
4. Assign it to "Weekly Tips Series"
5. Save the post
6. Navigate to `/campaigns`, open "Weekly Tips Series"
7. Verify the Reddit post appears in the campaign's linked posts
