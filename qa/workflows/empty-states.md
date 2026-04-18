# Empty States — First-Time User Experience

**Fixture:** `qa/fixtures/empty.yaml`
**Seed command:** `make qa-seed-empty`

Test what a brand new user sees with no data. Verify empty state messaging and first-action CTAs.

## Steps

### 1. Dashboard Empty State

1. Navigate to `/dashboard`
2. Verify the stats bar shows all zeros (0 drafts, 0 scheduled, 0 published)
3. Verify an empty state message or "Create your first post" CTA is visible

### 2. Posts Empty State

1. Navigate to `/posts`
2. Verify the posts list shows an empty state
3. Verify a CTA to create a new post is visible
4. Verify all filter tabs show zero counts

### 3. Campaigns Empty State

1. Navigate to `/campaigns`
2. Verify the campaigns list shows an empty state
3. Verify a "Create Campaign" CTA is visible

### 4. Projects Empty State

1. Navigate to `/projects`
2. Verify the projects list shows an empty state
3. Verify a "Create Project" CTA is visible

### 5. Blog Drafts Empty State

1. Navigate to `/blog`
2. Verify the blog drafts list shows an empty state

### 6. Launch Posts Empty State

1. Navigate to `/launch-posts`
2. Verify the launch posts list shows an empty state

### 7. First Post Creation

1. From any empty state, click the "Create" CTA (or navigate to `/new`)
2. Select Twitter
3. Type: "My first post!"
4. Save as draft
5. Navigate to `/dashboard`
6. Verify the stats bar now shows 1 draft
7. Navigate to `/posts`
8. Verify the post appears in the list
9. Verify the empty state is no longer shown

### 8. First Project + Campaign

1. Navigate to `/projects`
2. Create a project: "My First Project"
3. Navigate to `/campaigns`
4. Create a campaign: "My First Campaign"
5. On the campaign detail page, click "Move" and assign to "My First Project"
6. Navigate to `/projects`, click "My First Project"
7. Verify "My First Campaign" appears under the project
