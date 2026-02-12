# Landing Page Screenshot Carousel Plan

## Overview
Replace the 7 static feature cards with interactive carousels showing real workflows with dummy data. Each carousel demonstrates the actual UX flow for that feature.

## Technical Approach
- **Mobile viewport**: 393x852 (iPhone 14 Pro dimensions)
- **Screenshot tool**: Playwright browser automation
- **Terminal screenshots**: iTerm2 or native Terminal.app captures
- **Dummy data**: Create via API or direct DB inserts
- **Carousel component**: Build with shadcn/ui or headless UI

---

## Feature 1: Capture with your AI tooling of choice, anytime

**Workflow**: Save a post idea from Claude Code via MCP → See it appear in Bullhorn

### Screenshots (4 total)
1. **Terminal: MCP command in Claude Code**
   - Show: `"Claude, save this as a tweet: 'Just shipped v2.0 with real-time collaboration'"`
   - Highlight: MCP tool use confirmation

2. **Mobile: Dashboard with new draft**
   - Show: Dashboard with the tweet appearing in drafts list
   - Highlight: New draft badge or timestamp

3. **Mobile: Draft detail view**
   - Show: Full tweet content in editor
   - Highlight: Platform badge (Twitter), status (draft)

4. **Mobile: Metadata visible**
   - Show: Created timestamp, "Captured via MCP" badge
   - Highlight: Shows it came from AI tool

**Dummy data needed**:
```json
{
  "platform": "twitter",
  "content": { "text": "Just shipped v2.0 with real-time collaboration" },
  "status": "draft",
  "createdAt": "2026-02-10T14:23:00Z",
  "metadata": { "source": "mcp" }
}
```

---

## Feature 2: Polish and organize when you're ready

**Workflow**: Navigate drafts → Edit a post → Add to campaign

### Screenshots (5 total)
1. **Mobile: Posts list with drafts**
   - Show: List of 3-4 draft posts
   - Highlight: "Draft" status badges

2. **Mobile: Tap into a draft**
   - Show: Editor view with post content
   - Highlight: Edit controls (platform, content, schedule)

3. **Mobile: Editing the content**
   - Show: Keyboard visible, text being refined
   - Highlight: Character count, media upload options

4. **Mobile: Campaign selector open**
   - Show: Bottom sheet with campaign options
   - Highlight: "Add to campaign" action

5. **Mobile: Post added to campaign**
   - Show: Post detail with campaign badge
   - Highlight: "Product Launch Q1" campaign tag

**Dummy data needed**:
```json
{
  "posts": [
    { "platform": "twitter", "content": { "text": "Quick update..." }, "status": "draft" },
    { "platform": "linkedin", "content": { "text": "Excited to share..." }, "status": "draft" },
    { "platform": "reddit", "content": { "subreddit": "webdev", "title": "New tool...", "body": "..." }, "status": "draft" }
  ],
  "campaigns": [
    { "id": "1", "name": "Product Launch Q1", "status": "active" }
  ]
}
```

---

## Feature 3: Fork your content across formats

**Workflow**: Blog post → Terminal command → Multiple tweets created

### Screenshots (4 total)
1. **Mobile: Blog draft detail**
   - Show: Long-form blog post (500+ words visible)
   - Highlight: Blog title "Introducing Real-Time Collaboration"

2. **Terminal: MCP fork command**
   - Show: `"Claude, turn this blog into 5 tweet threads"`
   - Highlight: Blog ID reference, MCP tool confirmation

3. **Mobile: New tweets in draft list**
   - Show: 5 new Twitter posts with thread numbering (1/5, 2/5, etc.)
   - Highlight: "Generated from blog" metadata

4. **Mobile: Tweet detail showing source**
   - Show: One tweet with "Forked from: [Blog title]" indicator
   - Highlight: Link back to source blog

**Dummy data needed**:
```json
{
  "blog": {
    "id": "blog-1",
    "title": "Introducing Real-Time Collaboration",
    "content": "# Intro\n\nToday we're excited to announce...\n\n(500 words)",
    "status": "draft"
  },
  "tweets": [
    { "content": { "text": "1/5 Announcing real-time collaboration..." }, "metadata": { "sourceId": "blog-1" } },
    { "content": { "text": "2/5 The key challenge we solved..." }, "metadata": { "sourceId": "blog-1" } },
    // ... 5 total
  ]
}
```

---

## Feature 4: Organize launches like you organize code

**Workflow**: Campaign list → Campaign detail → Add post to campaign

### Screenshots (4 total)
1. **Mobile: Campaign list**
   - Show: 3 campaigns (Active, Planning, Completed)
   - Highlight: "Product Launch Q1" campaign

2. **Mobile: Campaign detail view**
   - Show: Campaign stats (5 posts, 2 scheduled, 3 drafts)
   - Highlight: Timeline view of posts

3. **Mobile: Add post to campaign**
   - Show: Bottom sheet selector from post editor
   - Highlight: Campaign options

4. **Mobile: Campaign with new post**
   - Show: Updated campaign with 6 posts
   - Highlight: New post in timeline

**Dummy data needed**:
```json
{
  "campaigns": [
    {
      "id": "1",
      "name": "Product Launch Q1",
      "status": "active",
      "postCount": 5,
      "scheduledCount": 2,
      "draftCount": 3
    },
    {
      "id": "2",
      "name": "Feature Announcements",
      "status": "planning",
      "postCount": 8
    }
  ],
  "posts": [
    { "id": "1", "campaignId": "1", "content": {...}, "scheduledAt": "2026-02-15T10:00:00Z" },
    // ... 5 total posts in campaign 1
  ]
}
```

---

## Feature 5: Dedicated workflows for launch day

**Workflow**: Create launch post → Fill Product Hunt fields → Schedule

### Screenshots (4 total)
1. **Mobile: Launch posts list**
   - Show: 2 launch posts (Product Hunt, Hacker News)
   - Highlight: Special launch post icons/badges

2. **Mobile: Create new launch post**
   - Show: Launch post template selector
   - Highlight: Product Hunt, Hacker News, Launch Day options

3. **Mobile: Product Hunt specific fields**
   - Show: Tagline, description, maker comment fields
   - Highlight: Product Hunt-specific UI (orange color, logo)

4. **Mobile: Launch post scheduled**
   - Show: Launch post with date/time set
   - Highlight: "Scheduled for Feb 15, 10:00 AM PST" badge

**Dummy data needed**:
```json
{
  "launchPosts": [
    {
      "id": "1",
      "platform": "producthunt",
      "name": "CollabTool Launch",
      "tagline": "Real-time collaboration for modern teams",
      "description": "The easiest way to...",
      "makerComment": "Hey Product Hunt!...",
      "scheduledAt": "2026-02-15T18:00:00Z"
    },
    {
      "id": "2",
      "platform": "hackernews",
      "title": "Show HN: CollabTool – Real-time collaboration",
      "url": "https://collabtool.com",
      "scheduledAt": "2026-02-15T14:00:00Z"
    }
  ]
}
```

---

## Feature 6: Draft long-form alongside your social content

**Workflow**: Blog list → Create blog → Dashboard showing blogs + social

### Screenshots (4 total)
1. **Mobile: Blog drafts list**
   - Show: 3 blog posts in various states
   - Highlight: Word count, last edited timestamps

2. **Mobile: Blog editor**
   - Show: Rich text editor with markdown support
   - Highlight: Title, content, media upload

3. **Mobile: Dashboard unified view**
   - Show: Mixed list of blogs and social posts
   - Highlight: Different post type indicators

4. **Mobile: Blog detail with social connections**
   - Show: Blog with "Generated 5 tweets" indicator
   - Highlight: Link to forked social posts

**Dummy data needed**:
```json
{
  "blogs": [
    {
      "id": "1",
      "title": "Introducing Real-Time Collaboration",
      "content": "# Introduction\n\nToday we're announcing...",
      "wordCount": 850,
      "status": "draft",
      "updatedAt": "2026-02-10T12:00:00Z"
    },
    {
      "id": "2",
      "title": "Building in Public: Month 1",
      "content": "...",
      "wordCount": 1200,
      "status": "published",
      "publishedAt": "2026-02-05T10:00:00Z"
    }
  ]
}
```

---

## Feature 7: Manage multiple products or clients

**Workflow**: Projects list → Project detail → Create post in project context

### Screenshots (4 total)
1. **Mobile: Projects list**
   - Show: 3 projects (CollabTool, SideProject, Client Work)
   - Highlight: Post counts, campaign counts per project

2. **Mobile: Project detail**
   - Show: Project overview with campaigns and posts
   - Highlight: Stats, recent activity timeline

3. **Mobile: Project selector in post editor**
   - Show: Bottom sheet with project options
   - Highlight: Current project badge

4. **Mobile: Dashboard filtered by project**
   - Show: Posts/campaigns filtered to single project
   - Highlight: Project filter chip at top

**Dummy data needed**:
```json
{
  "projects": [
    {
      "id": "1",
      "name": "CollabTool",
      "postCount": 12,
      "campaignCount": 2,
      "color": "blue"
    },
    {
      "id": "2",
      "name": "SideProject",
      "postCount": 8,
      "campaignCount": 1,
      "color": "purple"
    },
    {
      "id": "3",
      "name": "Client: Acme Corp",
      "postCount": 15,
      "campaignCount": 3,
      "color": "green"
    }
  ]
}
```

---

## Implementation Plan

### Phase 1: Set Up Dummy Data (Day 1)
1. Create seed script to generate all dummy data
2. Run seed against local dev database
3. Verify data in UI manually

### Phase 2: Capture Mobile Screenshots (Day 2)
1. Write Playwright script to navigate and screenshot each workflow
2. Use mobile viewport (393x852)
3. Save screenshots to `/public/landing/feature-{n}/step-{m}.png`
4. Total: ~30 screenshots across 7 features

### Phase 3: Capture Terminal Screenshots (Day 2)
1. Set up dummy MCP interactions in terminal
2. Use iTerm2 or screenshot tool to capture terminal windows
3. Edit/annotate if needed (highlight commands, add arrows)
4. Save to `/public/landing/feature-{n}/terminal-{m}.png`
5. Total: ~8 terminal screenshots

### Phase 4: Build Carousel Component (Day 3)
1. Create reusable Carousel component (shadcn/ui Carousel or custom)
2. Auto-advance on timer (3-4 seconds per slide)
3. Manual navigation (dots, arrows)
4. Add captions per screenshot
5. Responsive (mobile-first, works on desktop too)

### Phase 5: Update Landing Page (Day 3)
1. Replace feature cards with carousel components
2. Load screenshots dynamically
3. Add captions/annotations
4. Test on mobile and desktop
5. Deploy to staging for review

---

## Screenshot Checklist

### Mobile Screenshots (per feature)
- [ ] Feature 1: 4 screenshots (1 terminal + 3 mobile)
- [ ] Feature 2: 5 screenshots (all mobile)
- [ ] Feature 3: 4 screenshots (2 terminal + 2 mobile)
- [ ] Feature 4: 4 screenshots (all mobile)
- [ ] Feature 5: 4 screenshots (all mobile)
- [ ] Feature 6: 4 screenshots (all mobile)
- [ ] Feature 7: 4 screenshots (all mobile)

### Terminal Screenshots
- [ ] Feature 1: MCP save command
- [ ] Feature 3: MCP fork command (blog → tweets)
- [ ] Additional: MCP list_posts, update_post examples

---

## Carousel Design Specs

### Layout
- Max width: 600px on desktop
- Full width on mobile
- Image aspect ratio: 9:16 (mobile screenshot ratio)
- Auto-advance: 4 seconds per slide
- Manual controls: Dots at bottom, left/right arrows

### Annotations
- Screenshot caption at bottom (overlay or below image)
- Highlight important UI elements with subtle borders/arrows
- Keep annotations minimal to avoid clutter

### Interaction
- Pause on hover (desktop)
- Swipe gestures (mobile)
- Click dots to jump to specific screenshot
- Auto-loop back to first slide

---

## Next Steps
1. ✅ Create this plan
2. ⏳ Review and approve plan with user
3. ⏳ Create dummy data seed script
4. ⏳ Write Playwright screenshot automation
5. ⏳ Capture terminal screenshots manually
6. ⏳ Build carousel component
7. ⏳ Update landing page with carousels
8. ⏳ Deploy to staging and review
