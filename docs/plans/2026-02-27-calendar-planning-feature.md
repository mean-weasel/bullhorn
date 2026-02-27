# Auto-Post Calendar Planning with Community Event Awareness

> **GitHub Issue Title:** `feat: Auto-post calendar planning with community event awareness`
> **Labels:** `enhancement`
> **Date:** 2026-02-27

---

## Context

### Reddit BYOT (Bring Your Own Token) Research Summary

We investigated whether Bullhorn could support a "Bring Your Own Token" model for Reddit, where users supply their own API client credentials. Key findings:

- **Reddit killed self-service API key creation in November 2025.** New apps require manual pre-approval (~7 day turnaround). Existing credentials from before the cutoff still work.
- **"Script" apps are for single-user personal use only.** Users creating script-type credentials and funneling them through a commercial web app is a gray area that could violate Reddit's intended use.
- **Commercial use requires explicit Reddit permission.** Social media schedulers are considered commercial by Reddit's definition, regardless of whose credentials are used.
- **The Responsible Builder Policy prohibits misrepresentation** of how or why you're accessing Reddit data. A BYOT model for a commercial product could be seen as circumventing the commercial approval process.
- **Scheduling tools are allowed** when using the official API properly. Existing tools (Postpone, Later, etc.) operate through registered "web app" OAuth clients.

**Recommendation:** Register Bullhorn as a commercial "web app" with Reddit through the proper approval process. Optionally support BYOT as a power-user fallback, but do not rely on it as the primary integration path. The compliance risk falls on users, and onboarding UX is poor (7+ day wait for new credentials).

---

## Feature: Auto-Post Calendar Planning

### Problem

Users currently schedule posts one at a time and must remember community events (Reddit "Saturday Showcase", LinkedIn engagement windows, Twitter trending hours) on their own. There's no way to:
- See posts alongside reminders in a unified calendar view
- Plan around recurring community events or platform-specific best times
- Get prompted to create content for upcoming events
- Set up recurring post cadences (e.g., "post to r/webdev every Saturday")

### Existing Infrastructure

We already have strong foundations to build on:

| Component | Location | What exists |
|-----------|----------|-------------|
| **Calendar view** | `src/app/(dashboard)/posts/CalendarView.tsx` | Month grid showing scheduled posts by date, platform-colored badges, click-to-create |
| **Reminders** | `src/lib/reminders.ts` + migration | Full CRUD, `remind_at` field, links to posts/campaigns, browser notifications, `getUpcomingReminders()` |
| **Reminders UI** | `src/components/reminders/RemindersList.tsx` + `AddReminderModal.tsx` | List with overdue highlighting, add modal with post/campaign linking |
| **Scheduling** | `src/components/editor/SchedulePicker.tsx` + `IOSDateTimePicker.tsx` | Date/time picker for post scheduling |
| **Cron publishing** | `src/app/api/cron/publish/route.ts` | Processes scheduled posts every run, 1-hour lookback window |
| **Dashboard** | `src/app/(dashboard)/dashboard/page.tsx` | Shows upcoming posts, drafts, reminders in a grid layout |

### Proposed Solution

Build a unified **Calendar Planning** view that overlays scheduled posts, reminders, and community events, with smart prompts to help users plan content ahead of time.

---

### Phase 1: Unified Calendar View

**Goal:** Merge posts and reminders into a single calendar, add week view.

#### Database Changes
None required — posts have `scheduled_at` and reminders have `remind_at`, both timestamptz.

#### UI Changes

1. **Enhanced CalendarView** — Extend existing `CalendarView.tsx`:
   - Add week view toggle (month | week)
   - Overlay reminders alongside posts (bell icon + reminder title)
   - Color coding: platform colors for posts, accent color for reminders
   - Day detail panel: click a day to see full list of posts + reminders
   - Drag-to-reschedule (stretch goal)

2. **New route**: `/calendar` as a top-level dashboard page
   - Full-page calendar with sidebar for "today's agenda"
   - Quick-create post or reminder from any date cell

3. **Dashboard widget**: Mini week-ahead calendar card replacing or supplementing the existing "Upcoming Posts" + "Upcoming Reminders" sections

#### API Changes
- New endpoint: `GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD`
  - Returns `{ posts: Post[], reminders: Reminder[] }` for the date range
  - Filters by user, joins efficiently

---

### Phase 2: Community Events Catalog

**Goal:** Let users subscribe to recurring community events that appear on their calendar.

#### Database Changes

**New table: `community_events`** (system-level, not per-user)
```sql
create table community_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- "Saturday Showcase"
  description text,                      -- "Share your projects on r/webdev"
  platform text not null,                -- 'reddit' | 'twitter' | 'linkedin'
  target text,                           -- subreddit name, hashtag, etc.
  recurrence_rule text not null,         -- iCal RRULE: "FREQ=WEEKLY;BYDAY=SA"
  recurrence_timezone text default 'UTC',
  suggested_post_type text,              -- 'self' | 'link' | 'text'
  tags text[],                           -- ['webdev', 'showcase', 'weekly']
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**New table: `user_event_subscriptions`** (per-user)
```sql
create table user_event_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  event_id uuid references community_events(id) on delete cascade not null,
  notify_hours_before integer default 24,  -- When to nudge
  auto_create_draft boolean default false, -- Auto-create a draft post
  created_at timestamptz default now(),
  unique(user_id, event_id)
);
```

#### Seed Data (Examples)
| Event | Platform | Target | RRULE |
|-------|----------|--------|-------|
| Saturday Showcase | Reddit | r/webdev | `FREQ=WEEKLY;BYDAY=SA` |
| Self-Promotion Saturday | Reddit | r/SideProject | `FREQ=WEEKLY;BYDAY=SA` |
| Show HN | Reddit | r/startups | `FREQ=DAILY` |
| Milestone Monday | Reddit | r/startups | `FREQ=WEEKLY;BYDAY=MO` |
| Feedback Friday | Reddit | r/design | `FREQ=WEEKLY;BYDAY=FR` |
| #BuildInPublic hour | Twitter | #BuildInPublic | `FREQ=DAILY` |
| Best posting window | LinkedIn | — | `FREQ=WEEKLY;BYDAY=TU,WE,TH` |

#### UI Changes
- **Event browser**: Browse/search available community events, one-click subscribe
- **Calendar overlay**: Subscribed events appear as background highlights on relevant days
- **Custom events**: Users can create their own recurring events (e.g., "Weekly newsletter promo")

#### API Changes
- `GET /api/community-events` — List available events (with search/filter)
- `GET /api/community-events/subscriptions` — User's subscriptions
- `POST /api/community-events/subscriptions` — Subscribe
- `DELETE /api/community-events/subscriptions/[id]` — Unsubscribe

---

### Phase 3: Smart Nudges & Auto-Draft

**Goal:** Proactively prompt users to create content for upcoming events.

#### Nudge System

**New cron: `/api/cron/calendar-nudges`**
- Runs daily (or every 6 hours)
- For each user's subscriptions, check if an event is coming up within `notify_hours_before`
- If `auto_create_draft` is true: create a draft post pre-filled with platform, subreddit/hashtag, and a template title
- Send browser notification via existing notification system
- Create a reminder linked to the draft post

#### Reminder Enhancement
- Add `recurrence_rule` field to existing `reminders` table (nullable, iCal RRULE)
- Add `source_event_id` field to link auto-generated reminders to community events
- `getUpcomingReminders()` expands recurrence rules into individual instances

#### UI Changes
- **Nudge banner** on dashboard: "Saturday Showcase is tomorrow — you have no content scheduled for r/webdev. [Create post]"
- **Suggested times** in SchedulePicker: highlight optimal posting windows based on subscribed events
- **Template system**: Pre-fill post content with event-specific templates (subreddit, flair, title prefix)

---

### Phase 4: Recurring Posts (Stretch)

**Goal:** Allow users to schedule repeating posts.

- Add `recurrence_rule` to posts table (nullable)
- Cron job generates next instance after each publish
- UI for configuring repeat (daily, weekly, custom RRULE)
- Useful for "post metrics update every Monday" type workflows

---

## Implementation Priority

| Phase | Effort | Value | Dependencies |
|-------|--------|-------|--------------|
| Phase 1: Unified Calendar | Medium | High | None |
| Phase 2: Community Events | Medium | High | Phase 1 |
| Phase 3: Smart Nudges | Medium | Very High | Phase 2 |
| Phase 4: Recurring Posts | High | Medium | Phase 1 |

**Recommended start:** Phase 1 (unified calendar view) — delivers immediate value and sets the foundation for everything else.

---

## Technical Notes

- **RRULE parsing**: Use `rrule` npm package for iCal recurrence rule expansion
- **Timezone handling**: Store all rules in UTC, expand to user's local timezone for display
- **Calendar API performance**: Single query with date range filter on `scheduled_at` / `remind_at` indexes (both already exist)
- **Existing CalendarView**: Currently only shows posts; extending to overlay reminders and events is straightforward since it already groups items by date
- **Mobile**: The existing calendar has responsive min-heights; week view will be the default on mobile for better usability
