# Launch Day — Launch Post Management

**Fixture:** `qa/fixtures/default.yaml`
**Seed command:** `make qa-seed`
**Browser prep:** Clear localStorage (especially `bullhorn-draft-new-post`) before running — stale draft state from prior runs causes phantom redirects to `/new`.

Test launch post CRUD for all supported platforms.

## Expected Data

- Show HN (hacker_news_show): "Show HN: Bullhorn - Social media scheduler for indie hackers"
- Product Hunt: "Bullhorn - Schedule social posts across Twitter, LinkedIn & Reddit"
- BetaList: "Bullhorn"
- Dev Hunt: "Bullhorn"

All in "Launch Week" campaign, all draft status.

## Steps

### 1. View Launch Posts List

1. Navigate to `/launch-posts`
2. Verify 4 launch posts are listed
3. Verify platform labels are correct for each
4. Verify all show "Draft" status

### 2. View Launch Post Detail

1. Click on the Product Hunt post
2. Verify all fields are populated:
   - Title: "Bullhorn - Schedule social posts across Twitter, LinkedIn & Reddit"
   - URL: "https://bullhorn.to"
   - Description is present
   - Platform fields: tagline, pricing, firstComment
   - Notes: "Launch at 12:01am PT"
3. Navigate back

### 3. Create a New Launch Post

1. Navigate to `/launch-posts/new` (or click "New Launch Post")
2. Select platform: Indie Hackers
3. Fill in title: "Bullhorn - Schedule your indie hacker content"
4. Fill in URL: "https://bullhorn.to"
5. Fill in description: "Built for indie hackers who need to manage social media across platforms"
6. Save the launch post
7. Verify it appears in the launch posts list (now 5 total)

### 4. Create Ask HN Post

1. Navigate to `/launch-posts/new`
2. Select platform: Ask HN
3. Fill in title: "Ask HN: Best practices for social media scheduling?"
4. Fill in description: "I'm building a social media scheduler and curious what HN thinks about..."
5. Save
6. Verify it appears in the list

### 5. Edit a Launch Post

1. Navigate to `/launch-posts`
2. Click on the Show HN post
3. Modify the title: "Show HN: Bullhorn – Open source social media scheduler"
4. Update notes: "Submit Tuesday at 9am ET"
5. Save changes
6. Verify the updates persist

### 6. Copy Launch Post Fields

1. Navigate to `/launch-posts`
2. Click on the Product Hunt post
3. Use the "Copy" functionality (if available) to copy platform-specific fields
4. Verify the clipboard contains the expected content

### 7. Delete a Launch Post

1. Navigate to `/launch-posts`
2. Click on the Dev Hunt post
3. Delete the launch post
4. Verify it's removed from the list (back to 5 or fewer)
5. Verify other launch posts are unaffected
