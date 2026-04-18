# Smoke Test — Golden Path

**Fixture:** `qa/fixtures/default.yaml`
**Seed command:** `make qa-seed`
**Browser prep:** Clear localStorage (especially `bullhorn-draft-new-post`) before running — stale draft state from prior runs causes phantom redirects to `/new`.

Walk through all major features and verify the app renders correctly with seeded data.

## Expected Data After Seeding

- 2 projects: "Bullhorn Product Launch", "Q2 Content Calendar"
- 4 campaigns: "Launch Week", "Pre-Launch Teasers", "Weekly Tips Series", "Beta Feedback Round"
- 10 posts: 3 Twitter draft (1 teaser, 1 tip, 1 with media), 1 Twitter scheduled, 1 Twitter published, 1 Twitter archived, 1 LinkedIn scheduled, 1 LinkedIn draft, 1 Reddit scheduled, 1 Reddit draft
- 4 blog drafts: 1 draft with "Blog Post" tag, 1 published with "Blog Post" tag, 1 draft WIP, 1 archived
- 4 launch posts: Show HN, Product Hunt, BetaList, Dev Hunt (all draft)

## Steps

### 1. Dashboard

1. Navigate to `/dashboard`
2. Verify the stats bar is visible and shows non-zero counts
3. Verify the "Drafts", "Scheduled", and "Published" counts match seeded data:
   - Drafts: 5 (3 Twitter + 1 LinkedIn + 1 Reddit)
   - Scheduled: 3 (1 Twitter + 1 LinkedIn + 1 Reddit)
   - Published: 1 (1 Twitter)
4. Verify recent posts or activity appears below the stats

### 2. Posts List

1. Navigate to `/posts`
2. Verify posts appear in the list
3. Click the "All" tab — should show all non-archived posts (9 visible)
4. Click the "Draft" filter — should show 5 draft posts
5. Click the "Scheduled" filter — should show 3 scheduled posts
6. Click the "Published" filter — should show 1 published post
7. Click the "Archived" filter — should show 1 archived post
8. Verify each post card shows the correct platform icon (Twitter/LinkedIn/Reddit)

### 3. Post Detail

1. Click on the scheduled Twitter post ("We're live! Bullhorn is now available...")
2. Verify the edit form loads with the correct content
3. Verify the scheduled date/time is set (should be tomorrow at 10:00 UTC)
4. Verify the campaign selector shows "Launch Week"
5. Navigate back to posts list

### 4. Campaigns

1. Navigate to `/campaigns`
2. Verify 4 campaigns are listed
3. Click on "Launch Week" campaign
4. Verify the campaign detail page shows linked posts (should include the launch tweet, launch LinkedIn, and launch Reddit posts)
5. Navigate back to campaigns list

### 5. Projects

1. Navigate to `/projects`
2. Verify 2 projects are listed: "Bullhorn Product Launch" and "Q2 Content Calendar"
3. Click on "Bullhorn Product Launch"
4. Verify the project detail shows campaigns: "Launch Week" and "Pre-Launch Teasers"
5. Navigate back to projects list

### 6. Blog Drafts

1. Navigate to `/blog`
2. Verify blog drafts are listed
3. Verify status tabs work (draft, published, archived)
4. Click on "Introducing Bullhorn" draft
5. Verify the markdown content loads in the editor
6. Verify the "Blog Post" tag is selected
7. Navigate back to blog list

### 7. Launch Posts

1. Navigate to `/launch-posts`
2. Verify 4 launch posts are listed
3. Verify platform labels: "Show HN", "Product Hunt", "BetaList", "Dev Hunt"
4. Click on the Product Hunt launch post
5. Verify platform fields are populated (tagline, pricing, firstComment)
6. Navigate back to launch posts list

### 8. Settings

1. Navigate to `/settings`
2. Verify the settings page loads
3. Verify theme toggle works (light/dark)

### 9. Create New Post (Verification)

1. Navigate to `/new`
2. Verify the post editor loads with an empty form
3. Select Twitter as the platform
4. Type a short test message
5. Save as draft
6. Verify redirect to the dashboard
7. Navigate to `/posts` and verify the new post appears in the list
