# Browser Workflows

> Auto-generated workflow documentation for Social Scheduler
> Last updated: 2026-02-06

## Quick Reference

| Workflow | Purpose | Steps |
|----------|---------|-------|
| Dashboard Overview | View stats, recent posts, and navigate | 6 |
| Navigation Flow | Navigate between all app sections | 7 |
| First-Time User Experience | Handle empty states, create first post | 5 |
| Create Twitter Post | Full Twitter post with media | 10 |
| Create LinkedIn Post | LinkedIn post with visibility settings | 9 |
| Create Reddit Post | Multi-subreddit crossposting | 12 |
| Edit Existing Post | Modify content, schedule, campaign | 8 |
| Schedule Post for Future | Date/time selection and scheduling | 6 |
| Publish Post Immediately | Mark as posted workflow | 5 |
| Search and Filter Posts | List/calendar views, filtering, search | 8 |
| Create New Campaign | Modal form submission | 5 |
| Edit Campaign Details | Inline editing name, description, status | 7 |
| Add Posts to Campaign | Link existing or create new posts | 6 |
| Delete Campaign | Confirmation and deletion | 4 |
| Upload Media to Post | Drag-drop or click upload | 7 |
| Remove Media from Post | Delete uploaded media | 4 |
| Change Theme | Light/Dark/System switching | 4 |
| Enable Browser Notifications | Permission request and toggle | 5 |
| Archive and Restore Post | Soft delete and recovery | 6 |
| Handle Empty States | Verify empty state displays | 5 |
| Login with Email and Password | Email/password sign-in flow | 6 |
| Login with Google OAuth | Google OAuth sign-in flow | 5 |
| Sign Up with Email | New account registration | 7 |
| Forgot Password | Request password reset email | 5 |
| Reset Password | Set new password from reset link | 6 |
| Access Denied (Email Gating) | Blocked user redirect flow | 4 |
| Create Launch Post | New launch post for any platform | 9 |
| Edit Launch Post | Modify existing launch post | 6 |
| Filter Launch Posts | Platform and status filtering | 6 |
| Delete Launch Post | Remove a launch post | 4 |
| Create New Project | Modal form to create project | 5 |
| View Project Detail | Project header, campaigns, settings | 7 |
| Edit Project Settings | Name, description, brand kit | 8 |
| Delete Project | Confirmation and deletion | 5 |
| Create Campaign in Project | New campaign scoped to project | 5 |
| Create New Blog Draft | New markdown blog post | 7 |
| Edit Blog Draft | Modify existing blog draft | 7 |
| Search and Filter Blog Drafts | Status tabs and search | 6 |
| Archive and Restore Blog Draft | Soft delete and recovery | 6 |
| Delete Blog Draft | Permanent blog draft deletion | 4 |
| Connect Google Analytics | OAuth flow and property selection | 7 |
| View Analytics Dashboard | Project analytics and connections | 5 |
| Remove Analytics Connection | Delete analytics connection | 4 |
| View and Edit Profile | Display name and avatar | 6 |
| Change Password | Update account password | 6 |
| Delete Account | Permanent account deletion | 5 |

---

## Core Workflows

### Workflow: Dashboard Overview

> Tests the main dashboard view with stats, recent posts, and campaign cards.

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)
- At least one post and one campaign exist for full testing

1. Navigate to the dashboard
   - Open the app URL in browser
   - Verify the dashboard loads with the header showing "Social Scheduler" logo
   - Verify the gold accent line appears beneath the header

2. Verify stats bar displays correctly
   - Verify "Scheduled" count displays with Calendar icon
   - Verify "Drafts" count displays with FileText icon
   - Verify "Published" count displays with CheckCircle icon
   - Verify "Campaigns" count displays (desktop only)

3. Check recent posts sections
   - Verify "Upcoming" section shows scheduled posts (or empty state)
   - Verify "Drafts" section shows draft posts (or empty state)
   - Verify "Published" section shows published posts (or empty state)
   - Each post card should show platform indicator, content preview, and timestamp

4. Check campaigns section
   - Verify "Campaigns" section shows recent campaigns
   - Each campaign card shows folder icon, name, status badge, and description

5. Test "View all" navigation
   - Click "View all" link in any section
   - Verify navigation to appropriate page (/posts or /campaigns)
   - Verify correct filter is applied via URL parameter

6. Test New Post button (desktop)
   - Verify gold "New Post" button appears in stats bar
   - Click the button
   - Verify navigation to /new editor page

---

### Workflow: Navigation Flow

> Tests all navigation paths between app sections on desktop and mobile.

**Prerequisites:**
- App running and accessible

1. Test header navigation (desktop)
   - Click the logo/title in header
   - Verify navigation to dashboard (/)
   - Click the Campaigns icon in header
   - Verify navigation to /campaigns
   - Click the Settings icon in header
   - Verify navigation to /settings

2. Test bottom navigation (mobile)
   - Resize browser to mobile width (<768px)
   - Verify bottom navigation bar appears
   - Click Home icon, verify navigation to /
   - Click Calendar icon, verify navigation to /posts
   - Click center "+" button, verify navigation to /new
   - Click Folder icon, verify navigation to /campaigns
   - Click More icon, verify navigation to /settings

3. Test FAB button (desktop)
   - Resize browser to desktop width (>=768px)
   - Verify floating action button appears (bottom-right, gold)
   - Hover over FAB, verify scale and rotation animation
   - Click FAB, verify navigation to /new

4. Test back navigation from editor
   - Navigate to /new
   - Verify back arrow appears in header
   - Click back arrow
   - Verify navigation to dashboard

5. Test breadcrumb navigation in campaigns
   - Navigate to /campaigns
   - Click a campaign card
   - Verify navigation to /campaigns/:id
   - Click "Back to Campaigns" link
   - Verify navigation to /campaigns

6. Verify active state indicators
   - Navigate to each section
   - Verify gold highlight on active nav item (bottom nav on mobile)
   - Verify URL matches expected route

7. Test deep linking
   - Navigate directly to /posts?status=scheduled
   - Verify posts page loads with "Scheduled" filter active
   - Navigate directly to /edit/[valid-post-id]
   - Verify editor loads with post data

---

### Workflow: First-Time User Experience

> Tests empty states and first-time user onboarding flow.

**Prerequisites:**
- Fresh app state with no posts or campaigns

1. View empty dashboard
   - Navigate to /
   - Verify empty state message displays
   - Verify "Create First Post" button appears with Sparkles icon
   - Verify encouraging message about getting started

2. View empty posts page
   - Navigate to /posts
   - Verify empty state with message about no posts
   - Verify "Create your first post" call-to-action

3. View empty campaigns page
   - Navigate to /campaigns
   - Verify empty state displays
   - Verify "New Campaign" button is visible

4. Create first post from empty state
   - Click "Create First Post" button on dashboard
   - Verify navigation to /new
   - Verify editor loads with empty form

5. Verify empty states update after content creation
   - Create and save a draft post
   - Navigate back to dashboard
   - Verify post now appears in "Drafts" section
   - Verify empty state is replaced with post card

---

## Post Management Workflows

### Workflow: Create Twitter Post

> Tests creating a new Twitter/X post with media and scheduling.

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)
- Test image file available for upload

1. Navigate to post editor
   - Click FAB button (desktop) or "+" button (mobile)
   - Verify /new page loads
   - Verify platform selector shows three options

2. Select Twitter platform
   - Click "Twitter" button in platform selector
   - Verify Twitter button shows checkmark and blue highlight
   - Verify character counter shows "0 / 280"

3. Enter post content
   - Click in the content textarea
   - Type test content (e.g., "This is a test tweet for workflow validation")
   - Verify character counter updates in real-time
   - Verify counter turns yellow when near limit (>252 chars)
   - Verify counter turns red when over limit (>280 chars)

4. Add notes (optional)
   - Click the Notes toggle button (StickyNote icon)
   - Verify notes section expands
   - Type notes text in the textarea
   - Verify gold accent appears when notes has content

5. Upload media
   - Click the media toggle button (Image icon)
   - Verify media upload section expands
   - [MANUAL] Click upload zone or drag image file
   - Verify upload progress bar appears
   - Verify image preview displays after upload
   - Verify media count badge updates on toggle button

6. Add multiple images (Twitter-specific)
   - Upload up to 3 more images
   - Verify grid layout adjusts (2-column for multiple)
   - Verify "Maximum files reached" message when at 4
   - Verify upload zone becomes disabled

7. Set schedule
   - Click the date picker button (Calendar icon)
   - [MANUAL] Select a future date from the date picker
   - Click the time picker button (Clock icon)
   - [MANUAL] Select a time from the time picker
   - Verify selected date and time display in buttons

8. Assign to campaign (optional)
   - Click campaign selector dropdown
   - Verify list of available campaigns appears
   - Click a campaign name
   - Verify campaign name shows in selector

9. Save as draft
   - Click "Save Draft" button
   - Verify toast notification "Post saved as draft"
   - Verify navigation to dashboard
   - Verify post appears in Drafts section

10. Schedule the post
    - Navigate back to edit the draft (/edit/:id)
    - Click "Schedule" button
    - Verify toast notification "Post scheduled"
    - Verify post status changes to "Scheduled"

---

### Workflow: Create LinkedIn Post

> Tests creating a LinkedIn post with visibility settings.

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)

1. Navigate to post editor
   - Click FAB or "+" button
   - Verify /new page loads

2. Select LinkedIn platform
   - Click "LinkedIn" button
   - Verify LinkedIn button shows checkmark and blue highlight
   - Verify character counter shows "0 / 3,000"

3. Enter post content
   - Type content in the textarea
   - Verify character counter updates
   - Note: LinkedIn allows much longer content than Twitter

4. Configure visibility settings
   - Verify LinkedIn Settings panel appears below content
   - Verify two visibility options: "Public" and "Connections Only"
   - Click "Connections Only"
   - Verify button shows gold highlight when selected

5. Upload media (single file)
   - Click media toggle button
   - [MANUAL] Upload one image or video
   - Verify single preview displays (not grid)
   - Verify upload zone is disabled after one file (LinkedIn limit)

6. Verify live preview (desktop)
   - On desktop, verify right-side preview panel
   - Verify preview shows LinkedIn-style formatting
   - Verify visibility indicator shows in preview

7. Set schedule
   - Select future date and time
   - Verify schedule displays correctly

8. Save and schedule
   - Click "Schedule" button
   - Verify post is saved with status "Scheduled"

9. Verify platform-specific storage
   - Edit the saved post
   - Verify visibility setting persists
   - Verify content and media are intact

---

### Workflow: Create Reddit Post

> Tests creating a Reddit post with multi-subreddit crossposting.

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)

1. Navigate to post editor
   - Click FAB or "+" button
   - Verify /new page loads

2. Select Reddit platform
   - Click "Reddit" button
   - Verify Reddit button shows checkmark and orange highlight
   - Verify character counter shows "0 / 40,000"

3. Enter post body content
   - Type content in the main textarea
   - This becomes the body text for the Reddit post

4. Add first subreddit
   - Locate subreddit input field with "r/" prefix
   - Type a subreddit name (e.g., "test")
   - Click "Add" button or press Enter
   - Verify subreddit card appears below

5. Configure subreddit-specific settings
   - Verify subreddit card shows "r/test"
   - Click to expand the card (ChevronDown)
   - Verify expanded view shows:
     - Title input (required for Reddit)
     - Optional schedule override (date/time pickers)
     - Flair input (optional)
     - Link URL input (optional)

6. Set subreddit title
   - Type a title in the Title input (e.g., "Test Post Title")
   - Verify character counter shows "0/300"
   - Verify title appears in collapsed card preview

7. Add additional subreddits for crossposting
   - Type another subreddit name (e.g., "testing")
   - Click Add
   - Verify second subreddit card appears
   - Configure title for second subreddit

8. Set per-subreddit schedules (optional)
   - Expand first subreddit card
   - Click date picker, select a date
   - Click time picker, select a time
   - Expand second subreddit
   - Set a different schedule time
   - Verify each card shows its own schedule

9. Set main schedule (fallback)
   - Set date and time in main schedule section
   - This applies to any subreddit without override

10. Test subreddit removal
    - Click X button on one subreddit card
    - Verify card is removed from list

11. Save the multi-subreddit post
    - Click "Schedule" button
    - Verify all subreddit posts are created
    - Note: Each subreddit creates a separate post with shared groupId

12. Verify grouped posts
    - Navigate to /posts
    - Verify multiple Reddit posts appear (one per subreddit)
    - Each should show its configured schedule

---

### Workflow: Edit Existing Post

> Tests editing an existing post's content, schedule, and campaign assignment.

**Prerequisites:**
- At least one saved post exists

1. Navigate to post from dashboard
   - Find a post card in dashboard sections
   - Click the post card
   - Verify navigation to /edit/:id
   - Verify post content loads in editor

2. Modify post content
   - Change the text in content textarea
   - Verify auto-save indicator shows "Saving..." then "Saved"
   - Verify character counter updates

3. Change schedule
   - Click date picker, select different date
   - Click time picker, select different time
   - Verify schedule updates in the form

4. Change campaign assignment
   - Click campaign selector
   - Select a different campaign (or "No Campaign")
   - Verify selection updates

5. Test platform switching (with confirmation)
   - Click a different platform button
   - Verify confirmation dialog appears
   - Dialog warns about content differences
   - Click "Cancel" to keep current platform
   - Click platform again, then "Switch" to change

6. Copy content to clipboard
   - Click copy button (clipboard icon) next to character count
   - Verify button changes to checkmark with "Copied!" state
   - Verify clipboard contains post content

7. Test keyboard shortcuts
   - Press Ctrl+S (Cmd+S on Mac)
   - Verify post saves (toast notification)
   - Press Escape
   - Verify navigation back to dashboard

8. Verify changes persisted
   - Navigate to the post again
   - Verify all changes are intact

---

### Workflow: Schedule Post for Future

> Tests the complete scheduling flow with date/time pickers.

**Prerequisites:**
- Draft post exists or create new post

1. Open post editor
   - Navigate to /new or /edit/:id
   - Verify schedule section is visible

2. Open date picker
   - Click the date button (shows "Select date" or current date)
   - [MANUAL] Native date picker dialog opens
   - Select a future date
   - Verify date button updates to show selected date (format: "Jan 15, 2026")

3. Open time picker
   - Click the time button (shows "Select time" or current time)
   - [MANUAL] Native time picker dialog opens
   - Select a time
   - Verify time button updates to show selected time (format: "2:30 PM")

4. Verify schedule validation
   - Note: Schedule button should be enabled only when both date and time are set
   - Clear the date (if possible) and verify Schedule button shows validation tooltip

5. Click Schedule button
   - Click the blue "Schedule" button
   - Verify toast notification "Post scheduled successfully"
   - Verify navigation to dashboard or posts list

6. Verify scheduled status
   - Find the post in the Posts list
   - Verify status badge shows "Scheduled" with Calendar icon
   - Verify scheduled time displays correctly

---

### Workflow: Publish Post Immediately

> Tests publishing a post for immediate posting.

**Prerequisites:**
- Draft or scheduled post exists

1. Open post editor
   - Navigate to /edit/:id with a draft post

2. Click Publish Now
   - Click the "Publish Now" button (Send icon)
   - Verify post is scheduled with current timestamp
   - Verify toast notification appears

3. Mark as Posted (alternative flow)
   - Open a scheduled post
   - Click "Mark as Posted" button (CheckCircle icon, green)
   - Verify post status changes to "Published"
   - Verify publishedAt timestamp is set

4. Add published URL
   - After marking as posted, expand "Published Links" section
   - Enter the live URL where post was published
   - Verify URL is saved with the post

5. Verify published state
   - Navigate to /posts
   - Filter by "Published" status
   - Verify post appears with CheckCircle icon and green badge

---

### Workflow: Search and Filter Posts

> Tests list view, calendar view, filtering, and search functionality.

**Prerequisites:**
- Multiple posts exist with different statuses

1. Navigate to Posts page
   - Click /posts in navigation
   - Verify posts list loads

2. Test status filter tabs
   - Click "All" tab, verify all posts show
   - Click "Draft" tab, verify only drafts show
   - Click "Scheduled" tab, verify only scheduled posts show
   - Click "Published" tab, verify only published posts show
   - Note: "Failed" and "Archived" tabs only appear if posts exist with those statuses

3. Test search functionality
   - Type search query in search input
   - Verify posts filter by content match
   - Verify search also matches notes content
   - Verify result count shows (e.g., "3 results")
   - Click X button to clear search
   - Verify all posts return

4. Switch to Calendar view
   - Click "Calendar" view button (grid icon)
   - Verify calendar grid displays with current month
   - Verify scheduled posts appear as pills on their dates

5. Navigate calendar months
   - Click left arrow to go to previous month
   - Click right arrow to go to next month
   - Click "Today" button to return to current month
   - Verify post pills update for visible month

6. Create post from calendar date
   - Click on a future date cell (not past)
   - Verify navigation to /new?date=YYYY-MM-DD
   - Verify date picker is pre-filled with clicked date

7. Edit post from calendar
   - Click a post pill in the calendar
   - Verify navigation to /edit/:id

8. Switch back to List view
   - Click "List" view button
   - Verify list view displays again with cards

---

## Campaign Workflows

### Workflow: Create New Campaign

> Tests creating a new campaign via the modal form.

1. Navigate to Campaigns page
   - Click Campaigns in navigation
   - Verify /campaigns page loads

2. Open new campaign modal
   - Click "New Campaign" button (gold, with Plus icon)
   - Verify modal appears with overlay
   - Verify modal has scale-in animation

3. Fill campaign form
   - Verify name input is focused (autofocus)
   - Type campaign name (e.g., "Q1 Marketing Campaign")
   - Type description in textarea (optional)

4. Submit the form
   - Click "Create Campaign" button
   - Verify modal closes
   - Verify toast notification "Campaign created"
   - Verify new campaign appears in list

5. Verify campaign details
   - Click the new campaign card
   - Verify navigation to /campaigns/:id
   - Verify name and description display correctly
   - Verify initial status is "Draft"

---

### Workflow: Edit Campaign Details

> Tests inline editing of campaign metadata and status.

**Prerequisites:**
- At least one campaign exists

1. Navigate to campaign detail
   - Go to /campaigns
   - Click a campaign card
   - Verify /campaigns/:id loads

2. Enter edit mode
   - Click Edit button (Edit2 icon) next to campaign name
   - Verify form switches to edit mode
   - Verify name input appears with current value
   - Verify description textarea appears

3. Edit campaign name
   - Clear and type new name
   - Verify input accepts changes

4. Edit description
   - Modify description text
   - Verify textarea accepts changes

5. Save changes
   - Click "Save" button
   - Verify form switches back to view mode
   - Verify new name and description display

6. Change campaign status
   - In view mode, locate status buttons (Draft, Active, Completed, Archived)
   - Click "Active" button
   - Verify button shows gold highlight
   - Verify status badge updates

7. Cancel edit without saving
   - Enter edit mode again
   - Make changes
   - Click "Cancel" button
   - Verify original values are restored

---

### Workflow: Add Posts to Campaign

> Tests linking existing posts and creating new posts within a campaign.

**Prerequisites:**
- Campaign exists
- At least one post exists without a campaign

1. Navigate to campaign detail
   - Go to /campaigns/:id

2. Add existing post via modal
   - Click "Add Existing Post" button (only visible if unassigned posts exist)
   - Verify modal opens with list of available posts
   - Verify posts show platform, status, and content preview

3. Select a post to add
   - Click a post in the modal list
   - Verify modal closes
   - Verify post now appears in campaign's post list
   - Verify toast notification confirms addition

4. Create new post in campaign
   - Click "New Post" button (gold gradient)
   - Verify navigation to /new?campaign=:campaignId
   - Verify campaign selector shows the current campaign

5. Save the new post
   - Fill in post content
   - Save or schedule the post
   - Navigate back to campaign detail
   - Verify new post appears in campaign's post list

6. Remove post from campaign
   - In campaign detail, find a post card
   - Click X button on the post card
   - Verify post is removed from campaign (unlinked, not deleted)
   - Verify post still exists in main posts list

---

### Workflow: Delete Campaign

> Tests campaign deletion with confirmation.

**Prerequisites:**
- Campaign exists (preferably one created for testing)

1. Navigate to campaign detail
   - Go to /campaigns/:id

2. Initiate deletion
   - Click Delete button (Trash2 icon, red, top-right)
   - Verify confirmation dialog appears
   - Verify dialog shows warning message

3. Cancel deletion
   - Click "Cancel" or "Keep" button
   - Verify dialog closes
   - Verify campaign still exists

4. Confirm deletion
   - Click Delete button again
   - Click "Delete" in confirmation dialog
   - Verify navigation to /campaigns
   - Verify campaign no longer appears in list
   - Note: Posts previously in campaign remain but are unlinked

---

## Media Workflows

### Workflow: Upload Media to Post

> Tests the complete media upload flow with progress and preview.

**Prerequisites:**
- Test image and video files available
- Post editor open with Twitter or LinkedIn selected

1. Open media section
   - Click media toggle button (Image icon)
   - Verify upload zone expands
   - Verify dashed border upload area displays

2. Upload via click
   - Click anywhere in the upload zone
   - [MANUAL] File picker dialog opens
   - Select an image file
   - Verify upload progress bar appears with percentage
   - Verify image preview displays after completion

3. Upload via drag and drop
   - [MANUAL] Drag an image file from file explorer
   - Verify upload zone border color changes on drag-over
   - [MANUAL] Drop the file
   - Verify upload processes and preview appears

4. View upload progress
   - During upload, verify:
     - Filename displays
     - Progress bar fills
     - Percentage number updates
     - Spinner animation shows

5. Verify media preview
   - Verify uploaded image shows as thumbnail
   - Verify aspect ratio is maintained
   - Hover over preview to reveal delete button

6. Test file type validation
   - [MANUAL] Attempt to upload an unsupported file type (e.g., .pdf)
   - Verify error message appears
   - Verify error can be dismissed with X button

7. Test file size validation
   - [MANUAL] Attempt to upload an oversized file
   - Verify error message shows size limit

---

### Workflow: Remove Media from Post

> Tests removing uploaded media from a post.

**Prerequisites:**
- Post with uploaded media in editor

1. View current media
   - Verify media preview is visible
   - Verify delete button appears on hover

2. Remove media
   - Hover over the media preview card
   - Click the X (delete) button
   - Verify media is removed from preview
   - Verify upload zone becomes active again

3. Verify removal persists
   - Save the post
   - Reload the editor
   - Verify media is no longer attached

4. Re-upload media
   - Upload a new file
   - Verify upload works after removal

---

## Settings Workflows

### Workflow: Change Theme

> Tests theme switching between Light, Dark, and System modes.

1. Navigate to Settings
   - Click Settings in navigation
   - Verify /settings page loads

2. View current theme
   - Locate Appearance section
   - Verify three theme buttons: Light (Sun), Dark (Moon), System (Monitor)
   - Verify current theme has highlighted border

3. Switch to Dark theme
   - Click "Dark" button
   - Verify immediate theme change (dark background, light text)
   - Verify Dark button shows active state

4. Switch to Light theme
   - Click "Light" button
   - Verify immediate theme change (light background, dark text)
   - Verify Light button shows active state

5. Switch to System theme
   - Click "System" button
   - Verify theme matches OS preference
   - Verify System button shows active state

6. Verify theme persistence
   - Refresh the page
   - Verify theme selection persists

---

### Workflow: Enable Browser Notifications

> Tests the notification permission flow and toggle.

**Prerequisites:**
- Browser supports notifications
- Notifications not yet granted for this site

1. Navigate to Settings
   - Go to /settings
   - Locate Notifications section

2. View initial state
   - If not granted: "Enable Notifications" button should display
   - If blocked: Alert message with instructions should display

3. Request notification permission
   - Click "Enable Notifications" button
   - [MANUAL] Browser permission prompt appears
   - [MANUAL] Click "Allow" in browser prompt

4. Verify enabled state
   - Verify green checkmark and "Browser notifications enabled" message
   - Verify toggle switch for "Post reminders" appears

5. Toggle post reminders
   - Click the toggle switch
   - Verify switch animates to off position
   - Verify Bell icon changes to BellOff
   - Click again to re-enable
   - Verify switch animates to on position

---

## Edge Case Workflows

### Workflow: Archive and Restore Post

> Tests the archive/restore flow for soft-deleting and recovering posts.

**Prerequisites:**
- At least one non-archived post exists

1. Open post for archiving
   - Navigate to /edit/:id with a draft or scheduled post
   - Verify "Archive" button is visible (not "Restore")

2. Archive the post
   - Click "Archive" button
   - Verify confirmation dialog appears
   - Click "Archive" to confirm
   - Verify toast notification "Post archived"
   - Verify navigation away from editor

3. Find archived post
   - Navigate to /posts
   - Click "Archived" tab (appears when archived posts exist)
   - Verify archived post appears in list

4. Open archived post
   - Click the archived post card
   - Verify editor opens
   - Verify "Restore" and "Delete" buttons are visible
   - Verify "Archive" button is hidden

5. Restore the post
   - Click "Restore" button
   - Verify toast notification "Post restored"
   - Verify post status changes to "Draft"
   - Verify "Archive" button reappears

6. Permanently delete (optional)
   - Archive the post again
   - Open the archived post
   - Click "Delete" button
   - Verify confirmation dialog with warning
   - Click "Delete" to confirm
   - Verify post is permanently removed

---

### Workflow: Handle Empty States

> Verifies proper empty state displays across all pages.

1. Empty Dashboard
   - With no posts/campaigns, verify:
     - Sparkles icon displays
     - Encouraging message shows
     - "Create First Post" CTA button appears

2. Empty Posts List
   - Navigate to /posts with no posts
   - Verify empty state message
   - Verify list view shows appropriate empty state
   - Switch to calendar view, verify empty state handling

3. Empty Campaigns List
   - Navigate to /campaigns with no campaigns
   - Verify empty state with "New Campaign" prompt

4. Empty Campaign Detail
   - Create a campaign with no posts
   - Navigate to its detail page
   - Verify "No posts in this campaign yet" message
   - Verify "New Post" button is visible

5. Empty Search Results
   - Navigate to /posts with existing posts
   - Search for a term that matches no posts
   - Verify "No posts found" or similar message
   - Clear search, verify posts return

---

## Authentication Workflows

### Workflow: Login with Email and Password

> Tests the email/password sign-in flow via Supabase authentication.

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)
- A registered user account exists with known email and password

1. Navigate to login page
   - Open https://bullhorn.to/login in browser
   - Verify the login card loads with Bullhorn logo and "Sign in to manage your social posts" subtitle
   - Verify the gold gradient bar appears at the top of the page

2. Verify form elements
   - Verify Email label and input field with placeholder "you@example.com"
   - Verify Password label and input field with placeholder
   - Verify "Forgot password?" link appears next to the Password label
   - Verify "Sign in" submit button is present
   - Verify "Or continue with" divider and "Continue with Google" button appear
   - Verify "Don't have an account? Sign up" link at the bottom

3. Submit with invalid credentials
   - Enter an invalid email address
   - Enter an incorrect password
   - Click "Sign in" button
   - Verify button text changes to "Signing in..." while loading
   - Verify error banner appears with the error message (e.g., "Invalid login credentials")
   - Verify error banner has red/destructive styling

4. Submit with valid credentials
   - Clear the form fields
   - Enter a valid email address
   - Enter the correct password
   - Click "Sign in" button
   - Verify button text changes to "Signing in..." while loading
   - Verify successful redirect to /dashboard

5. Test navigation links
   - Navigate back to /login
   - Click "Forgot password?" link
   - Verify navigation to /forgot-password
   - Navigate back to /login
   - Click "Sign up" link
   - Verify navigation to /signup

6. Verify authenticated redirect
   - After successful login, navigate directly to /login
   - Verify redirect to dashboard (middleware blocks authenticated users from auth pages)

---

### Workflow: Login with Google OAuth

> Tests the Google OAuth sign-in flow.

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)
- Google OAuth is configured in Supabase

1. Navigate to login page
   - Open https://bullhorn.to/login in browser
   - Verify the login card loads

2. Initiate Google OAuth
   - Locate the "Continue with Google" button below the divider
   - Verify the Google logo (colored SVG) appears in the button
   - Click "Continue with Google"

3. Complete Google authentication
   - [MANUAL] Google OAuth consent screen opens in a new window or redirect
   - [MANUAL] Select a Google account or enter Google credentials
   - [MANUAL] Grant permissions if prompted

4. Verify OAuth callback
   - Verify redirect to /auth/callback with authorization code
   - Verify automatic redirect to /dashboard (or /dashboard?verified=true for new users)
   - Verify the dashboard loads successfully with the authenticated user

5. Verify error handling
   - If OAuth is denied or fails, verify redirect to /login?error=auth
   - Verify an appropriate error message displays on the login page

---

### Workflow: Sign Up with Email

> Tests the new account registration flow with email and password.

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)
- An email address that is not yet registered

1. Navigate to sign up page
   - Open https://bullhorn.to/signup in browser
   - Verify the sign-up card loads with "Create an account" heading
   - Verify "Get started with Bullhorn" subtitle appears

2. Verify form elements
   - Verify Email input field with placeholder "you@example.com"
   - Verify Password input field with minimum length of 6 characters
   - Verify Confirm Password input field
   - Verify PasswordStrength component appears below the Password field
   - Verify "Create account" submit button (pink styling)
   - Verify "Continue with Google" button below the divider
   - Verify "Already have an account? Sign in" link at the bottom

3. Test password validation
   - Enter a password shorter than 6 characters
   - Enter a different value in the Confirm Password field
   - Click "Create account"
   - Verify error message "Passwords do not match" or "Password must be at least 6 characters"

4. Test password strength indicator
   - Type a short password (e.g., "abc")
   - Verify password strength indicator shows weak
   - Type a stronger password with mixed characters
   - Verify password strength indicator updates in real-time

5. Submit valid registration
   - Enter a valid, unregistered email address
   - Enter a password of 6+ characters
   - Enter the same password in the Confirm Password field
   - Click "Create account"
   - Verify button text changes to "Creating account..." while loading

6. Verify confirmation screen
   - After successful submission, verify the "Check your email" success card appears
   - Verify the email icon displays
   - Verify the message shows the email address that was entered
   - Verify "Back to sign in" link is present and navigates to /login

7. Test Google sign-up alternative
   - Navigate back to /signup
   - Click "Continue with Google"
   - [MANUAL] Complete Google OAuth flow
   - Verify redirect to /auth/callback and then to /dashboard

---

### Workflow: Forgot Password

> Tests the password reset request flow.

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)
- A registered user account exists

1. Navigate to forgot password page
   - Open https://bullhorn.to/forgot-password in browser
   - Verify the card loads with "Reset password" heading and key icon
   - Verify "Enter your email and we'll send you a reset link" subtitle

2. Verify form elements
   - Verify Email input field with placeholder "you@example.com"
   - Verify "Send reset link" submit button (orange styling)
   - Verify "Remember your password? Sign in" link at the bottom

3. Submit with a registered email
   - Enter a valid registered email address
   - Click "Send reset link"
   - Verify button text changes to "Sending..." while loading

4. Verify success screen
   - After successful submission, verify the "Check your email" card appears
   - Verify the message shows "We've sent a password reset link to" with the email address
   - Verify "Back to sign in" link is present and navigates to /login

5. Test error handling
   - Navigate back to /forgot-password
   - Submit with an invalid or non-existent email (behavior depends on Supabase config)
   - Verify appropriate error message displays if applicable

---

### Workflow: Reset Password

> Tests setting a new password after clicking the reset link from email.

**Prerequisites:**
- A valid password reset link has been sent to the user's email
- The reset link has not expired

1. Open reset password page
   - Click the password reset link from the email
   - Verify redirect to /reset-password with a valid recovery session
   - Verify the card loads with "Set new password" heading and lock icon

2. Verify invalid/expired link handling
   - Navigate directly to /reset-password without a valid session
   - Verify the "Invalid or expired link" error card displays
   - Verify "Request new reset link" button navigates to /forgot-password

3. Verify form elements (with valid session)
   - Verify "New Password" input field with minimum length of 6
   - Verify "Confirm New Password" input field
   - Verify PasswordStrength component below the password field
   - Verify "Update password" submit button (purple styling)
   - Verify "Remember your password? Sign in" link

4. Test password validation
   - Enter a password shorter than 6 characters
   - Enter a different value in Confirm field
   - Click "Update password"
   - Verify error message for mismatched or too-short passwords

5. Submit new password
   - Enter a valid new password (6+ characters)
   - Enter the same password in the Confirm field
   - Click "Update password"
   - Verify button text changes to "Updating..." while loading
   - Verify the success card appears with "Password updated" message
   - Verify "Sign in now" link is present

6. Verify auto-redirect
   - After success, verify automatic redirect to /login after approximately 3 seconds
   - Test logging in with the new password

---

### Workflow: Access Denied (Email Gating)

> Tests the access denied flow when email-based gating is active via the ALLOWED_EMAILS environment variable.

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)
- ALLOWED_EMAILS environment variable is set with a comma-separated list of allowed emails
- A user account exists with an email NOT in the allowed list

1. Login with non-allowed email
   - Navigate to /login
   - Sign in with an email that is NOT in the ALLOWED_EMAILS list
   - Verify redirect to /access-denied after authentication

2. Verify access denied page
   - Verify the /access-denied page loads
   - Verify an appropriate message explaining that access is restricted

3. Attempt to navigate to protected routes
   - Try navigating directly to /dashboard, /posts, /campaigns, etc.
   - Verify the middleware redirects back to /access-denied each time
   - Verify public paths (/login, /signup, /forgot-password, /api) remain accessible

4. Login with allowed email
   - Sign out (if possible) and navigate to /login
   - Sign in with an email that IS in the ALLOWED_EMAILS list
   - Verify successful navigation to /dashboard without being redirected to /access-denied

---

## Launch Posts Workflows

### Workflow: Create Launch Post

> Tests creating a new launch post for any supported platform (Show HN, Ask HN, HN Link, Product Hunt, Dev Hunt, BetaList, Indie Hackers).

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)
- User is authenticated

1. Navigate to launch posts
   - Navigate to /launch-posts
   - Verify the "Launch Posts" heading and description display
   - Verify the gold accent bar appears below the heading
   - Click "New Launch Post" button (gold gradient, with Plus icon)
   - Verify navigation to /launch-posts/new

2. Select a platform
   - Verify the platform selector grid shows all 7 platforms: Show HN, Ask HN, HN Link, Product Hunt, Dev Hunt, BetaList, Indie Hackers
   - Click "Show HN" button
   - Verify the button shows active state with shadow highlight
   - Verify "Open Show HN submission page" link appears below

3. Fill in main fields
   - Verify the Title input has focus (autofocus)
   - Type a title (e.g., "Show HN: My New Tool - A brief description")
   - Verify character counter shows count/80 for Hacker News platforms
   - Verify helper text "Start with 'Show HN:' followed by your product name" displays
   - Enter a URL in the URL field (required for all platforms except Ask HN)
   - Enter a description in the Description textarea

4. Test platform-specific fields (Product Hunt)
   - Switch platform to "Product Hunt"
   - Verify the "Product Hunt Fields" section appears
   - Enter a tagline (60 char max) and verify the character counter
   - Select a pricing model from the dropdown (Free, Freemium, Paid)
   - Enter a First Comment (Maker's Introduction) in the textarea

5. Test platform-specific fields (Ask HN)
   - Switch platform to "Ask HN"
   - Verify the "Ask HN Fields" section appears with Question Body textarea
   - Verify the URL field is marked as optional (not required)

6. Test platform-specific fields (BetaList)
   - Switch platform to "BetaList"
   - Verify the "BetaList Fields" section appears
   - Enter a one-sentence pitch (140 char max) and verify the counter
   - Verify helper text about Twitter sharing

7. Set status and scheduling
   - Locate the Status & Scheduling section
   - Select "Scheduled" from the Status dropdown
   - [MANUAL] Pick a date and time using the datetime-local input
   - Verify selected schedule displays

8. Add internal notes
   - Type notes in the Internal Notes textarea
   - Verify notes are accepted

9. Submit the launch post
   - Click "Create Launch Post" button (green, with Rocket icon)
   - Verify button shows loading state with spinner and "Saving..." text
   - Verify navigation to /launch-posts after successful creation
   - Verify the new launch post appears in the list

---

### Workflow: Edit Launch Post

> Tests editing an existing launch post's content and platform-specific fields.

**Prerequisites:**
- At least one launch post exists

1. Navigate to launch post editor
   - Go to /launch-posts
   - Click on a launch post card
   - Verify navigation to /launch-posts/:id
   - Verify the form loads with "Edit Launch Post" heading

2. Verify existing data loads
   - Verify the platform selector shows the correct platform highlighted
   - Verify the title, URL, and description fields are populated with existing data
   - Verify platform-specific fields are populated (if applicable)
   - Verify the status and scheduled date are populated

3. Modify launch post content
   - Change the title text
   - Update the URL
   - Modify the description
   - Update any platform-specific fields

4. Change status
   - Change the status from the dropdown (e.g., Draft to Scheduled, or Scheduled to Posted)
   - If changing to Scheduled, set or update the scheduled date

5. Save changes
   - Click "Save Changes" button (green, with Rocket icon)
   - Verify loading state shows
   - Verify navigation to /launch-posts after save

6. Verify changes persisted
   - Click on the same launch post in the list
   - Verify all changes are intact

---

### Workflow: Filter Launch Posts

> Tests platform and status filtering on the launch posts list.

**Prerequisites:**
- Multiple launch posts exist across different platforms and statuses

1. Navigate to launch posts page
   - Navigate to /launch-posts
   - Verify all launch posts display sorted by most recent first

2. Open filters panel
   - Click the "Filters" button
   - Verify filter panel expands with Platform and Status dropdowns
   - Verify no gold indicator dot shows when no filters are active

3. Filter by platform
   - Select "Show HN" from the Platform dropdown
   - Verify only Show HN launch posts display
   - Verify gold dot indicator appears on the Filters button

4. Filter by status
   - Select "Drafts" from the Status dropdown
   - Verify only draft Show HN posts display (combined filter)

5. Clear filters
   - Click "Clear Filters" button
   - Verify all launch posts return to the list
   - Verify gold dot indicator disappears from Filters button

6. Test empty filter results
   - Select a platform and status combination with no matching posts
   - Verify "No matching launch posts" empty state message
   - Verify "Try adjusting your filters to see more posts" helper text

---

### Workflow: Delete Launch Post

> Tests deleting a launch post with confirmation.

**Prerequisites:**
- At least one launch post exists (preferably one created for testing)

1. Navigate to launch posts page
   - Go to /launch-posts
   - Locate the launch post to delete

2. Initiate deletion
   - Click the delete button on the launch post card
   - [MANUAL] Verify browser confirm dialog appears with "Are you sure you want to delete this launch post?"

3. Cancel deletion
   - [MANUAL] Click "Cancel" in the confirm dialog
   - Verify the launch post still appears in the list

4. Confirm deletion
   - Click the delete button again
   - [MANUAL] Click "OK" in the confirm dialog
   - Verify the launch post is removed from the list

---

## Project Workflows

### Workflow: Create New Project

> Tests creating a new project via the modal form.

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)
- User is authenticated

1. Navigate to Projects page
   - Navigate to /projects
   - Verify "Projects" heading and description display
   - Verify the gold accent bar appears

2. Open new project modal
   - Click "New Project" button (gold gradient, with Plus icon)
   - Verify modal appears with FolderKanban icon and "New Project" title
   - Verify description text "Create a project to organize campaigns and maintain brand consistency"

3. Fill project form
   - Verify name input has focus (autofocus)
   - Verify "Name *" label with required indicator
   - Type project name (e.g., "Product Launch Q1")
   - Type description in textarea (optional)
   - If at the soft limit (3 projects), verify amber warning about free tier limit

4. Submit the form
   - Click "Create Project" button
   - Verify modal closes
   - Verify navigation to /projects/:id (the new project detail page)

5. Verify project details
   - Verify the project detail page loads with header card
   - Verify project name and description display correctly
   - Verify FolderKanban placeholder icon shows (no logo uploaded)
   - Verify "Campaigns" tab is active by default

---

### Workflow: View Project Detail

> Tests the project detail page with header card, analytics stats, tabs, and campaigns.

**Prerequisites:**
- At least one project exists with campaigns

1. Navigate to project detail
   - Go to /projects
   - Click a project card
   - Verify navigation to /projects/:id
   - Verify "Back to Projects" link with ArrowLeft icon

2. Verify project header card
   - Verify project logo (or FolderKanban placeholder) displays
   - Verify project name in large heading
   - Verify Edit button (Edit2 icon) next to the name
   - Verify description text if present
   - Verify hashtags count with Hash icon (if hashtags exist)
   - Verify brand color swatches with Palette icon (if colors exist)
   - Verify "Updated [date]" timestamp
   - Verify Delete button (Trash2 icon, red)

3. Verify analytics stats bar
   - If analytics data exists, verify the 4-column grid below the header:
     - Campaigns count (gold)
     - Total Posts count (gold)
     - Scheduled count (blue)
     - Published count (green)

4. Test tab navigation
   - Verify "Campaigns" and "Settings" tabs are visible
   - Verify "Campaigns" tab has active state (gold highlight)
   - Click "Settings" tab
   - Verify settings tab shows active state
   - Click "Campaigns" tab to return

5. View campaigns list
   - Under the Campaigns tab, verify campaign cards display
   - Each card should show: FolderOpen icon, campaign name, description, status badge, and updated date
   - Click a campaign card
   - Verify navigation to /campaigns/:campaignId

6. Test empty campaigns state
   - If no campaigns exist, verify empty state with:
     - FolderOpen icon
     - "No campaigns yet" message
     - "Create First Campaign" button

7. View archived campaigns
   - If archived campaigns exist, verify "Archived (N)" section below active campaigns
   - Verify archived campaigns appear with reduced opacity

---

### Workflow: Edit Project Settings

> Tests editing project name, description, hashtags, brand colors, and connected accounts.

**Prerequisites:**
- At least one project exists

1. Navigate to project settings
   - Go to /projects/:id
   - Click the "Settings" tab (or click the Edit2 icon in the header)
   - Verify the settings tab content loads

2. Edit project name
   - Locate the "Project Information" card
   - Verify "Name" input shows the current project name
   - Clear and type a new name
   - Verify input accepts changes

3. Edit project description
   - Locate the "Description" textarea
   - Type or modify the description text
   - Verify textarea accepts changes

4. Edit hashtags
   - Locate the "Brand Kit" card
   - Find the "Hashtags" input (comma-separated)
   - Type hashtags (e.g., "product, launch, marketing")
   - Verify hashtag preview pills appear below (e.g., #product, #launch, #marketing)

5. Edit brand colors
   - Locate the "Brand Colors" section with Primary, Secondary, and Accent columns
   - [MANUAL] Click a color picker input to open the native color picker
   - Select a color or type a hex value in the text input (e.g., "#FF5733")
   - Verify the color swatch preview updates
   - Repeat for Secondary and Accent colors

6. View connected accounts
   - Locate the "Connected Accounts" card with Link2 icon
   - Verify the AccountPicker component displays

7. View website analytics section
   - Locate the "Website Analytics" card with BarChart3 icon
   - If no analytics connected, verify "No analytics connected to this project" message
   - Verify "Connect Analytics" button links to /settings

8. Save changes
   - Click "Save Changes" button (gold gradient)
   - Verify changes are saved
   - Click "Campaigns" tab and back to "Settings" to verify persistence

---

### Workflow: Delete Project

> Tests project deletion with confirmation dialog showing affected campaigns.

**Prerequisites:**
- A project exists (preferably one created for testing)
- Optionally, the project has campaigns associated with it

1. Navigate to project detail
   - Go to /projects/:id

2. Initiate deletion from header
   - Click the Trash2 (delete) button in the project header card (red icon, top-right)
   - Verify the ConfirmDialog appears with "Delete Project?" title

3. Verify confirmation details
   - Verify the dialog shows "Are you sure you want to delete [project name]?"
   - If campaigns exist, verify the amber warning box lists affected campaigns
   - Verify the message "These campaigns will be unassigned but not deleted"
   - If no campaigns, verify "This project has no campaigns to unassign" message

4. Cancel deletion
   - Click the cancel button
   - Verify dialog closes and project still exists

5. Confirm deletion
   - Click delete button again to reopen dialog
   - Click "Delete Project" button (red/destructive variant)
   - Verify navigation to /projects
   - Verify the deleted project no longer appears in the list

---

### Workflow: Create Campaign in Project

> Tests creating a new campaign scoped to a specific project from the project detail page.

**Prerequisites:**
- At least one project exists

1. Navigate to project detail
   - Go to /projects/:id
   - Verify the "Campaigns" tab is active

2. Open new campaign modal
   - Click "New Campaign" button (gold gradient, with Plus icon)
   - Verify modal appears with "New Campaign" heading

3. Fill campaign form
   - Verify name input has autofocus
   - Type campaign name
   - Type optional description
   - Verify the helper text "This campaign will be created in the [project name] project"

4. Submit the form
   - Click "Create Campaign" button
   - Verify modal closes
   - Verify the new campaign appears in the project's campaign list

5. Verify campaign is associated with project
   - Click the new campaign card
   - Verify navigation to /campaigns/:campaignId
   - Verify the campaign is linked to the project

---

## Blog Drafts Workflows

### Workflow: Create New Blog Draft

> Tests creating a new markdown blog post draft.

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)
- User is authenticated

1. Navigate to blog drafts
   - Navigate to /blog
   - Verify "Blog Drafts" heading and "Manage your markdown blog posts" subtitle
   - Verify the gold accent bar appears

2. Create new draft
   - Click "New Draft" button (gold gradient, with Plus icon)
   - Verify navigation to /blog/new
   - Verify the editor loads with sticky header containing "Back to Drafts" link and "Save" button

3. Enter draft title
   - Verify the title input has large font styling and placeholder "Post title..."
   - Type a title (e.g., "My First Blog Post")

4. Set publication date
   - Click the date picker (IOSDateTimePicker component)
   - [MANUAL] Select a publication date
   - Verify the date displays in the metadata row

5. Write content
   - Click in the content textarea (monospace font, markdown-ready)
   - Verify placeholder "Start writing your post in markdown..."
   - Type markdown content
   - Verify word count updates in the metadata row

6. Add private notes
   - Locate the "Private Notes (not published)" section below the content
   - Type notes in the notes textarea
   - Verify notes are accepted

7. Save the draft
   - Click "Save" button in the header (gold gradient)
   - Verify "Draft created" success message appears (green text with CheckCircle)
   - Verify URL changes to /blog/:id (editor stays open with the new draft)
   - Verify keyboard shortcut Ctrl+S / Cmd+S also triggers save

---

### Workflow: Edit Blog Draft

> Tests editing an existing blog draft's content and metadata.

**Prerequisites:**
- At least one blog draft exists

1. Navigate to draft from list
   - Go to /blog
   - Click on a draft card
   - Verify navigation to /blog/:id
   - Verify the editor loads with existing content

2. Verify existing data loads
   - Verify the title input shows the existing title
   - Verify the content textarea shows existing markdown content
   - Verify the word count displays in the metadata row
   - Verify the publication date shows (if previously set)
   - Verify the status badge shows (if not "draft")
   - Verify notes section shows existing notes (if any)

3. Modify content
   - Change the title
   - Edit the markdown content
   - Verify word count updates
   - Verify "Unsaved changes" indicator appears in the header

4. Update publication date
   - Click the date picker
   - [MANUAL] Change the publication date
   - Verify the new date displays

5. Save changes
   - Click "Save" button
   - Verify "Draft saved" success message appears
   - Verify "Unsaved changes" indicator disappears

6. Test unsaved changes warning
   - Make a change to the content
   - Click "Back to Drafts" button
   - [MANUAL] Verify browser confirm dialog appears: "You have unsaved changes. Are you sure you want to leave?"
   - [MANUAL] Click "Cancel" to stay
   - Verify the editor remains open with unsaved changes

7. Verify keyboard shortcut
   - Make a change
   - Press Ctrl+S / Cmd+S
   - Verify the draft saves without clicking the button

---

### Workflow: Search and Filter Blog Drafts

> Tests status filtering and search on the blog drafts list.

**Prerequisites:**
- Multiple blog drafts exist with different statuses

1. Navigate to blog drafts page
   - Navigate to /blog
   - Verify drafts list loads sorted by most recent first

2. Test status filter tabs
   - Verify filter tabs display: All, Drafts, Scheduled, Published
   - Verify "Archived" tab only appears if archived drafts exist
   - Click "Drafts" tab, verify only draft posts show and count badge updates
   - Click "Scheduled" tab, verify only scheduled posts show
   - Click "Published" tab, verify only published posts show
   - Click "All" tab, verify all non-archived posts show

3. Test search functionality
   - Type a search query in the search input ("Search by title, content, or notes...")
   - Verify blog drafts filter by title, content, and notes matches
   - Verify search results count displays (e.g., "Found 3 drafts matching...")

4. Clear search
   - Click the X button in the search input
   - Verify all drafts return to the list

5. Test empty search results
   - Search for a term that matches no drafts
   - Verify "No matching drafts" empty state with "Try a different search term" message

6. Test URL-based filtering
   - Navigate directly to /blog?status=scheduled
   - Verify the "Scheduled" tab is active
   - Verify only scheduled drafts display

---

### Workflow: Archive and Restore Blog Draft

> Tests archiving and restoring blog drafts.

**Prerequisites:**
- At least one non-archived blog draft exists

1. Open draft for archiving
   - Navigate to /blog/:id with a draft-status blog post
   - Scroll to the actions section below the content
   - Verify "Archive" button is visible (Archive icon)

2. Archive the draft
   - Click "Archive" button
   - Verify navigation to /blog
   - Verify the draft no longer appears in the "All" tab

3. Find archived draft
   - Click "Archived" tab (appears when archived drafts exist)
   - Verify the archived draft appears in the list
   - Verify the draft card shows archived status styling

4. Restore the draft
   - Click the archived draft card to open it
   - Verify "Restore" button (RotateCcw icon) is visible instead of "Archive"
   - Click "Restore" button
   - Verify "Draft restored" success message appears
   - Verify the status changes back to "draft"

5. Verify restoration
   - Navigate to /blog
   - Click "All" or "Drafts" tab
   - Verify the restored draft appears in the list

6. Test delete from archived state
   - Archive the draft again
   - Open the archived draft
   - Click "Delete" button (Trash2 icon, red/destructive)
   - [MANUAL] Confirm the permanent deletion dialog
   - Verify navigation to /blog
   - Verify the draft is permanently removed

---

### Workflow: Delete Blog Draft

> Tests permanently deleting a blog draft.

**Prerequisites:**
- At least one blog draft exists (preferably one created for testing)

1. Navigate to draft editor
   - Go to /blog/:id
   - Scroll to the actions section

2. Initiate deletion
   - Click "Delete" button (Trash2 icon, red/destructive styling)
   - [MANUAL] Verify browser confirm dialog appears: "Are you sure you want to permanently delete this draft? This cannot be undone."

3. Cancel deletion
   - [MANUAL] Click "Cancel" in the confirm dialog
   - Verify the draft editor remains open

4. Confirm deletion
   - Click "Delete" button again
   - [MANUAL] Click "OK" in the confirm dialog
   - Verify navigation to /blog
   - Verify the draft no longer appears in the list

---

## Analytics Workflows

### Workflow: Connect Google Analytics

> Tests the Google Analytics 4 OAuth connection flow from the Settings page.

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)
- Google Analytics OAuth is configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET env vars)
- User is authenticated

1. Navigate to Settings
   - Navigate to /settings
   - Locate the "Analytics" section with the chart icon

2. Verify initial state
   - If no connections exist, verify "Connect Google Analytics" button (blue, with BarChart3 icon)
   - If connections exist, verify each connection card shows property name, ID, and sync status

3. Initiate connection
   - Click "Connect Google Analytics" button
   - Verify the ConnectAnalyticsModal opens with "connect" step

4. Start OAuth flow
   - Click the connect button in the modal
   - [MANUAL] Browser redirects to Google OAuth consent screen
   - [MANUAL] Select a Google account and grant analytics read permissions
   - [MANUAL] Google redirects back to /settings with analytics_auth=success parameter

5. Select GA4 property
   - After OAuth callback, verify the modal reopens at the "select-property" step
   - Verify the list of available GA4 properties displays (property name, account name)
   - Click on the desired property to select it

6. Complete connection
   - Confirm the selected property
   - Verify the success step displays in the modal
   - Verify "Google Analytics connected successfully!" toast/success message
   - Verify the modal closes

7. Verify connection appears
   - In the Analytics section, verify the new connection card shows:
     - BarChart3 icon with blue styling
     - Property name (or "Property [ID]" fallback)
     - Property ID
     - Sync status ("Connected" in green, or "Sync error" in red)
   - Verify "Add another property" button appears below existing connections

---

### Workflow: View Analytics Dashboard

> Tests viewing analytics data for a project with connected GA4 properties.

**Prerequisites:**
- At least one project exists
- At least one Google Analytics connection exists and is linked to the project

1. Navigate to project detail
   - Go to /projects/:id
   - Click the "Settings" tab

2. Locate analytics section
   - Scroll to the "Website Analytics" card (BarChart3 icon, blue)

3. Verify analytics dashboard
   - If analytics connections exist for this project, verify the AnalyticsDashboard component renders
   - Verify analytics data displays in compact mode

4. Handle no analytics state
   - If no analytics are connected, verify "No analytics connected to this project" message
   - Verify "Connect Analytics" button links to /settings

5. Navigate to settings to add connection
   - Click "Connect Analytics" button
   - Verify navigation to /settings
   - Verify the Analytics section is visible

---

### Workflow: Remove Analytics Connection

> Tests removing a Google Analytics connection from Settings.

**Prerequisites:**
- At least one Google Analytics connection exists

1. Navigate to Settings
   - Go to /settings
   - Locate the Analytics section
   - Verify existing connection cards display

2. Initiate removal
   - Click the Trash2 (delete) icon button on a connection card
   - Verify the ConfirmDialog appears with "Remove Analytics Connection" title
   - Verify description: "Are you sure you want to remove this Google Analytics connection? You can reconnect it later."

3. Cancel removal
   - Click cancel in the dialog
   - Verify dialog closes
   - Verify connection still appears

4. Confirm removal
   - Click the delete icon again
   - Click "Remove" in the confirmation dialog
   - Verify "Analytics connection removed" success message
   - Verify the connection card disappears from the list
   - If no connections remain, verify "Connect Google Analytics" button reappears

---

## Profile Workflows

### Workflow: View and Edit Profile

> Tests the profile page for viewing and editing display name.

**Prerequisites:**
- App running at https://bullhorn.to (or configured URL)
- User is authenticated

1. Navigate to profile page
   - Navigate to /profile
   - Verify "Profile" heading with user icon displays
   - Verify "Manage your account settings" subtitle
   - Verify the gold gradient bar appears

2. Verify profile information section
   - Locate the "Profile Information" card
   - Verify avatar displays with user initials (derived from display name or email)
   - Verify display name shows (or "No display name set" if empty)
   - Verify email address displays below the name

3. Verify account section
   - Locate the "Account" card
   - Verify email address displays in a read-only field
   - Verify "Email cannot be changed" helper text

4. Edit display name
   - Locate the "Display Name" input field
   - Clear the existing value and type a new display name
   - Verify "This name will be shown in the app header" helper text

5. Save profile changes
   - Click "Save Changes" button (primary styling)
   - Verify button is disabled when no changes have been made
   - After making changes, click "Save Changes"
   - Verify button text changes to "Saving..." while loading
   - Verify "Profile updated successfully" success message appears (green banner with Check icon)
   - Verify success message auto-dismisses after 3 seconds

6. Verify changes persisted
   - Refresh the page
   - Verify the updated display name appears in the avatar and name display

---

### Workflow: Change Password

> Tests the password change flow on the profile page.

**Prerequisites:**
- User is authenticated with an email/password account (not OAuth-only)

1. Navigate to profile page
   - Navigate to /profile
   - Scroll to the "Account" section
   - Locate the "Change Password" subsection

2. Verify form elements
   - Verify "New Password" input with eye toggle button for show/hide
   - Verify "Confirm New Password" input with eye toggle button
   - Verify "Update Password" button (blue styling)
   - Verify PasswordStrength component below the New Password field

3. Test password visibility toggle
   - Click the Eye icon on the New Password field
   - Verify the input type changes from password to text (password visible)
   - Click EyeOff icon to hide again
   - Repeat for Confirm Password field

4. Test validation errors
   - Enter a password shorter than 6 characters and click "Update Password"
   - Verify "New password must be at least 6 characters" error message
   - Enter different values in New Password and Confirm Password
   - Click "Update Password"
   - Verify "Passwords do not match" error message

5. Submit valid password change
   - Enter a valid new password (6+ characters)
   - Enter the same value in Confirm Password
   - Click "Update Password"
   - Verify button text changes to "Updating..." while loading
   - Verify "Password updated successfully" success message (green banner)
   - Verify both password fields are cleared after success

6. Verify password strength indicator
   - Type various passwords and verify the PasswordStrength component updates in real-time

---

### Workflow: Delete Account

> Tests the account deletion flow with confirmation dialog.

**Prerequisites:**
- User is authenticated
- User understands this action is irreversible

1. Navigate to profile page
   - Navigate to /profile
   - Scroll to the bottom of the page

2. Verify danger zone
   - Locate the "Danger Zone" section with red/destructive border
   - Verify warning text: "Once you delete your account, there is no going back. All your data will be permanently removed."
   - Verify "Delete Account" button with Trash2 icon (destructive styling)

3. Initiate deletion
   - Click "Delete Account" button
   - Verify the ConfirmDialog appears with "Delete Account" title
   - Verify description warns about permanent data deletion

4. Cancel deletion
   - Click "Cancel" in the dialog
   - Verify dialog closes
   - Verify the profile page remains intact

5. Confirm deletion
   - Click "Delete Account" button again
   - Click "Delete Account" in the confirmation dialog
   - Verify button text changes to "Deleting..." while processing
   - Verify redirect to /login after account deletion
   - Verify the user is signed out

---

## Automation Notes

### Known Limitations

These interactions require `[MANUAL]` intervention:

| Feature | Limitation | Workaround |
|---------|------------|------------|
| File upload dialogs | Native OS dialogs cannot be automated | Mark as [MANUAL], pre-stage files |
| Date/time pickers | Native browser pickers | Use keyboard input or mark [MANUAL] |
| Browser permission prompts | OS-level dialogs | Pre-configure permissions or mark [MANUAL] |
| Clipboard operations | May require permissions | Verify via paste into test field |
| Google OAuth consent screen | External Google domain | Mark as [MANUAL], use test accounts |
| Browser confirm() dialogs | Native JS confirm dialogs | Mark as [MANUAL] |
| Color picker inputs | Native OS color picker | Use text input alternative or mark [MANUAL] |

### Keyboard Shortcuts (Editor)

| Shortcut | Action |
|----------|--------|
| Ctrl+S / Cmd+S | Save Draft |
| Ctrl+Enter / Cmd+Enter | Schedule Post |
| Escape | Return to dashboard |

### Keyboard Shortcuts (Blog Editor)

| Shortcut | Action |
|----------|--------|
| Ctrl+S / Cmd+S | Save Draft |

### Test Data Recommendations

- Create at least 5 posts across different platforms and statuses
- Create 2-3 campaigns with varying statuses
- Upload test media files (images and video) for media workflows
- Test with both empty and populated states
- Create at least 2 projects with campaigns assigned
- Create launch posts across at least 3 different platforms (e.g., Show HN, Product Hunt, BetaList)
- Create 3-4 blog drafts with different statuses (draft, scheduled, published, archived)
- Set up a Google Analytics connection with a test GA4 property
- Create a user profile with display name for profile workflow testing
