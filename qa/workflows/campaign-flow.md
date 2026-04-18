# Campaign Flow — Project > Campaign > Post Hierarchy

**Fixture:** `qa/fixtures/default.yaml`
**Seed command:** `make qa-seed`
**Browser prep:** Clear localStorage (especially `bullhorn-draft-new-post`) before running — stale draft state from prior runs causes phantom redirects to `/new`.

Test the organizational hierarchy: projects contain campaigns, campaigns group posts.

**Note:** The test user is on the free plan (5 campaigns max). The fixture seeds 4 campaigns, leaving room for 1 new campaign. Steps 3 and 6 each create a campaign — delete one before creating the second, or delete a seeded campaign first.

## Steps

### 1. Verify Project-Campaign Relationship

1. Navigate to `/projects`
2. Verify 2 projects visible
3. Click "Bullhorn Product Launch"
4. Verify 2 campaigns shown: "Launch Week" and "Pre-Launch Teasers"
5. Click "Q2 Content Calendar" (navigate back first)
6. Verify 1 campaign shown: "Weekly Tips Series"

### 2. Verify Campaign-Post Relationship

1. Navigate to `/campaigns`
2. Click "Launch Week"
3. Verify linked posts appear:
   - The scheduled Twitter launch post
   - The scheduled LinkedIn launch post
   - The scheduled Reddit launch post
4. Verify the post count matches (should be 3 posts)
5. Navigate back

### 3. Create a New Campaign in a Project

1. Navigate to `/campaigns`
2. Click "New Campaign" button
3. Fill in name: "Social Proof Collection"
4. Fill in description: "Gathering testimonials and user feedback"
5. Assign to project: "Bullhorn Product Launch"
6. Click "Create"
7. Verify the campaign appears in the list (now 5 — the free plan limit)
8. Navigate to `/projects`, click "Bullhorn Product Launch"
9. Verify "Social Proof Collection" now appears under the project

### 4. Edit Campaign Details

1. Navigate to `/campaigns`
2. Click "Pre-Launch Teasers"
3. Edit the description to: "Updated description for pre-launch teasers"
4. Save changes
5. Verify the description is updated

### 5. Delete a Campaign

1. Navigate to `/campaigns`
2. Click "Beta Feedback Round" (the completed campaign)
3. Delete the campaign
4. Verify it's removed from the campaigns list (now 4)
5. Verify that any posts previously linked to it are not deleted (they should still exist in the posts list, just unlinked)

### 6. Create a Standalone Campaign (No Project)

1. Navigate to `/campaigns`
2. Click "New Campaign"
3. Fill in name: "Standalone Content"
4. Leave project unassigned
5. Click "Create"
6. Verify the campaign appears with no project association

### 7. Create a New Project

1. Navigate to `/projects`
2. Click "New Project"
3. Fill in name: "Side Project Ideas"
4. Fill in description: "Tracking potential side project content"
5. Click "Create"
6. Verify the project appears in the list (now 3 total)

### 8. Delete a Project

1. Navigate to `/projects`
2. Click "Side Project Ideas" (the one just created)
3. Delete the project
4. Verify it's removed from the list
5. Verify campaigns that were under it (if any) are not deleted
