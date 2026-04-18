# Blog Drafts — Lifecycle & Search

**Fixture:** `qa/fixtures/default.yaml`
**Seed command:** `make qa-seed`
**Browser prep:** Clear localStorage (especially `bullhorn-draft-new-post`) before running — stale draft state from prior runs causes phantom redirects to `/new`.

Test blog draft CRUD, search, status filtering, and tag management.

## Steps

### 1. View Blog Drafts List

1. Navigate to `/blog`
2. Verify the "All" tab shows 3 blog drafts (archived drafts are excluded from this tab)
3. Verify status badges are visible on each card

### 2. Filter by Status

1. Click "Drafts" tab — should show 2 drafts ("Introducing Bullhorn", "How to Plan a Product Launch")
2. Click "Published" tab — should show 1 ("5 Tips for Effective Social Media Scheduling")
3. Click "Archived" tab — should show 1 ("Old Beta Announcement")
4. Click "All" tab — should show 3 (all non-archived)

### 3. Search Blog Drafts

1. Type "scheduling" in the search bar
2. Verify results include "5 Tips for Effective Social Media Scheduling"
3. Clear search, type "Bullhorn"
4. Verify results include "Introducing Bullhorn"
5. Clear search

### 4. Create a New Blog Draft

1. Navigate to `/blog/new`
2. Fill in title: "QA Test Blog Draft"
3. Write some markdown content:
   ```
   # Test Post
   
   This is a **test** blog draft from the QA workflow.
   
   - Item 1
   - Item 2
   ```
4. Select the "Blog Post" tag
5. Add notes: "Created during QA workflow"
6. Click "Save"
7. Verify redirect to the edit page
8. Verify word count is calculated and displayed

### 5. Edit a Blog Draft

1. Navigate to `/blog`
2. Click on "Introducing Bullhorn"
3. Verify the full markdown content loads in the editor
4. Verify the "Blog Post" tag is selected
5. Append a paragraph to the content
6. Save changes
7. Verify the word count updated

### 6. Archive a Blog Draft

1. Navigate to `/blog`
2. Click on "How to Plan a Product Launch on Social Media"
3. Click "Archive" (button is directly visible on the edit page)
4. Verify the draft moves to the "Archived" tab
5. Navigate to "Archived" tab and verify it appears

### 7. Restore an Archived Blog Draft

1. While on the "Archived" tab
2. Click on "Old Beta Announcement"
3. Click "Restore" (button is directly visible on the edit page)
4. Verify it moves back to "Draft" status

### 8. Delete a Blog Draft

1. Navigate to `/blog` and go to "Archived" tab
2. Archive a draft first if needed
3. Click on an archived draft
4. Click "Delete" (button is directly visible on the edit page)
5. Confirm deletion in the dialog
6. Verify the draft is permanently removed
