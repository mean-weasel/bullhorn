# Auto-Post Calendar Planning — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a unified calendar planning system with community event awareness, smart nudges, and recurring post support across 4 phases.

**Architecture:** 11 agent tasks across 3 waves, executed via superpowers Task agents with worktree isolation. Each wave's branches merge to main before the next wave starts. All new code follows existing Zustand + API route + sticker design patterns.

**Tech Stack:** Next.js 15, Supabase, Zustand, date-fns, rrule (new), Tailwind CSS, Vitest, Playwright

---

## Execution Strategy

```
Wave 1 (6 agents, parallel, zero dependencies):
  [Agent 1: DB Migrations]  [Agent 2: RRULE Lib]  [Agent 3: Calendar API]
  [Agent 4: CalendarView]   [Agent 5: /calendar Page]  [Agent 6: Dashboard Widget]

Wave 2 (3 agents, parallel, depends on Wave 1):
  [Agent 7: Community Events Store + API]
  [Agent 8: Reminders Recurrence]
  [Agent 9: Recurring Posts]

Wave 3 (2 agents, parallel, depends on Wave 2):
  [Agent 10: Community Events UI]
  [Agent 11: Smart Nudges]
```

Each agent runs in `isolation: "worktree"`. After each wave, review and merge all worktree branches.

---

## Wave 1: Foundation (6 Parallel Agents)

### Agent 1: DB Migrations

**Goal:** Create all database tables and schema changes for Phases 2-4.

**Files:**
- Create: `supabase/migrations/TIMESTAMP_create_community_events.sql`
- Create: `supabase/migrations/TIMESTAMP_create_user_event_subscriptions.sql`
- Create: `supabase/migrations/TIMESTAMP_add_reminders_recurrence.sql`
- Create: `supabase/migrations/TIMESTAMP_add_posts_recurrence.sql`

**Step 1: Create community_events table**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_community_events.sql
create table community_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  platform text not null check (platform in ('twitter', 'linkedin', 'reddit')),
  target text,
  recurrence_rule text not null,
  recurrence_timezone text default 'UTC',
  suggested_post_type text,
  tags text[] default '{}',
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- System-level table: all authenticated users can read, only service role can write
alter table community_events enable row level security;

create policy "Authenticated users can read community events"
  on community_events for select
  to authenticated
  using (true);

-- Index for active events by platform
create index idx_community_events_platform_active
  on community_events (platform) where is_active = true;
```

**Step 2: Create user_event_subscriptions table**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_user_event_subscriptions.sql
create table user_event_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  event_id uuid references community_events(id) on delete cascade not null,
  notify_hours_before integer default 24,
  auto_create_draft boolean default false,
  created_at timestamptz default now(),
  unique(user_id, event_id)
);

alter table user_event_subscriptions enable row level security;

create policy "Users can read own subscriptions"
  on user_event_subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create own subscriptions"
  on user_event_subscriptions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own subscriptions"
  on user_event_subscriptions for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete own subscriptions"
  on user_event_subscriptions for delete
  to authenticated
  using (auth.uid() = user_id);

create index idx_user_event_subscriptions_user
  on user_event_subscriptions (user_id);
```

**Step 3: Add recurrence fields to reminders**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_reminders_recurrence.sql
alter table reminders
  add column recurrence_rule text,
  add column source_event_id uuid references community_events(id) on delete set null;

create index idx_reminders_source_event
  on reminders (source_event_id) where source_event_id is not null;
```

**Step 4: Add recurrence field to posts**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_posts_recurrence.sql
alter table posts
  add column recurrence_rule text;
```

**Step 5: Seed community events**

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_seed_community_events.sql
insert into community_events (name, description, platform, target, recurrence_rule, suggested_post_type, tags) values
  ('Saturday Showcase', 'Share your projects on r/webdev', 'reddit', 'r/webdev', 'FREQ=WEEKLY;BYDAY=SA', 'self', '{webdev,showcase,weekly}'),
  ('Self-Promotion Saturday', 'Promote your side projects', 'reddit', 'r/SideProject', 'FREQ=WEEKLY;BYDAY=SA', 'link', '{sideproject,promotion,weekly}'),
  ('Milestone Monday', 'Share your startup milestones', 'reddit', 'r/startups', 'FREQ=WEEKLY;BYDAY=MO', 'self', '{startups,milestones,weekly}'),
  ('Feedback Friday', 'Get design feedback from the community', 'reddit', 'r/design', 'FREQ=WEEKLY;BYDAY=FR', 'self', '{design,feedback,weekly}'),
  ('#BuildInPublic Hour', 'Share your build progress', 'twitter', '#BuildInPublic', 'FREQ=DAILY', 'text', '{buildinpublic,daily}'),
  ('Best Posting Window', 'Optimal LinkedIn engagement window (Tue-Thu)', 'linkedin', null, 'FREQ=WEEKLY;BYDAY=TU,WE,TH', 'text', '{linkedin,engagement,weekly}');
```

**Step 6: Run migrations locally and verify**

```bash
make db-new name=create_community_events
make db-new name=create_user_event_subscriptions
make db-new name=add_reminders_recurrence
make db-new name=add_posts_recurrence
make db-new name=seed_community_events
supabase db reset
```

**Step 7: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: add community events, subscriptions, and recurrence schema"
```

---

### Agent 2: RRULE Utility Library

**Goal:** Install the `rrule` package and create a typed utility for expanding iCal recurrence rules.

**Files:**
- Create: `src/lib/rrule.ts`
- Create: `src/lib/rrule.test.ts`
- Modify: `package.json` (add rrule dependency)

**Step 1: Install rrule package**

```bash
npm install rrule
```

**Step 2: Write failing tests**

```typescript
// src/lib/rrule.test.ts
import { describe, it, expect } from 'vitest'
import {
  expandRecurrenceRule,
  getNextOccurrence,
  getOccurrencesInRange,
} from './rrule'

describe('expandRecurrenceRule', () => {
  it('expands a weekly Saturday rule', () => {
    const results = expandRecurrenceRule(
      'FREQ=WEEKLY;BYDAY=SA',
      new Date('2026-03-01T00:00:00Z'),
      5
    )
    expect(results).toHaveLength(5)
    results.forEach((d) => expect(d.getUTCDay()).toBe(6)) // Saturday
  })

  it('expands a daily rule', () => {
    const results = expandRecurrenceRule(
      'FREQ=DAILY',
      new Date('2026-03-01T00:00:00Z'),
      3
    )
    expect(results).toHaveLength(3)
    expect(results[1].getTime() - results[0].getTime()).toBe(86400000)
  })

  it('returns empty array for invalid rule', () => {
    const results = expandRecurrenceRule('INVALID', new Date(), 5)
    expect(results).toEqual([])
  })
})

describe('getNextOccurrence', () => {
  it('returns the next Saturday for weekly Saturday rule', () => {
    const next = getNextOccurrence(
      'FREQ=WEEKLY;BYDAY=SA',
      new Date('2026-03-04T00:00:00Z') // Wednesday
    )
    expect(next).not.toBeNull()
    expect(next!.getUTCDay()).toBe(6)
    expect(next!.getTime()).toBeGreaterThan(new Date('2026-03-04T00:00:00Z').getTime())
  })

  it('returns null for invalid rule', () => {
    expect(getNextOccurrence('INVALID', new Date())).toBeNull()
  })
})

describe('getOccurrencesInRange', () => {
  it('returns occurrences within a date range', () => {
    const results = getOccurrencesInRange(
      'FREQ=WEEKLY;BYDAY=SA',
      new Date('2026-03-01T00:00:00Z'),
      new Date('2026-03-31T23:59:59Z')
    )
    expect(results.length).toBeGreaterThanOrEqual(4)
    expect(results.length).toBeLessThanOrEqual(5)
    results.forEach((d) => {
      expect(d.getTime()).toBeGreaterThanOrEqual(new Date('2026-03-01T00:00:00Z').getTime())
      expect(d.getTime()).toBeLessThanOrEqual(new Date('2026-03-31T23:59:59Z').getTime())
    })
  })

  it('handles multi-day rules (TU,WE,TH)', () => {
    const results = getOccurrencesInRange(
      'FREQ=WEEKLY;BYDAY=TU,WE,TH',
      new Date('2026-03-01T00:00:00Z'),
      new Date('2026-03-07T23:59:59Z') // one week
    )
    expect(results.length).toBe(3) // Tue, Wed, Thu
  })
})
```

**Step 3: Run tests to verify they fail**

```bash
npx vitest run src/lib/rrule.test.ts
```

**Step 4: Implement the utility**

```typescript
// src/lib/rrule.ts
import { RRule, rrulestr } from 'rrule'

/**
 * Expand a recurrence rule into N future occurrences from a start date.
 */
export function expandRecurrenceRule(
  rule: string,
  after: Date,
  count: number
): Date[] {
  try {
    const rrule = rrulestr(`RRULE:${rule}`, { dtstart: after })
    return rrule.all((_, i) => i < count)
  } catch {
    return []
  }
}

/**
 * Get the next occurrence of a recurrence rule after a given date.
 */
export function getNextOccurrence(rule: string, after: Date): Date | null {
  try {
    const rrule = rrulestr(`RRULE:${rule}`, { dtstart: after })
    const next = rrule.after(after, false)
    return next
  } catch {
    return null
  }
}

/**
 * Get all occurrences of a recurrence rule within a date range.
 */
export function getOccurrencesInRange(
  rule: string,
  start: Date,
  end: Date
): Date[] {
  try {
    const rrule = rrulestr(`RRULE:${rule}`, { dtstart: start })
    return rrule.between(start, end, true)
  } catch {
    return []
  }
}
```

**Step 5: Run tests to verify they pass**

```bash
npx vitest run src/lib/rrule.test.ts
```

**Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/rrule.ts src/lib/rrule.test.ts
git commit -m "feat: add rrule utility library for recurrence rule expansion"
```

---

### Agent 3: Calendar API Endpoint

**Goal:** Create `GET /api/calendar` that returns posts + reminders for a date range.

**Files:**
- Create: `src/app/api/calendar/route.ts`
- Create: `src/lib/calendarStore.ts`

**Step 1: Create the API route**

```typescript
// src/app/api/calendar/route.ts
import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { transformPostFromDb } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await requireAuth()
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return Response.json(
        { error: 'start and end query params required (YYYY-MM-DD)' },
        { status: 400 }
      )
    }

    // Fetch posts with scheduled_at in range
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .neq('status', 'archived')
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', `${start}T00:00:00Z`)
      .lte('scheduled_at', `${end}T23:59:59Z`)
      .order('scheduled_at', { ascending: true })

    if (postsError) throw postsError

    // Fetch reminders with remind_at in range
    const { data: reminders, error: remindersError } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .gte('remind_at', `${start}T00:00:00Z`)
      .lte('remind_at', `${end}T23:59:59Z`)
      .order('remind_at', { ascending: true })

    if (remindersError) throw remindersError

    return Response.json({
      posts: (posts || []).map(transformPostFromDb),
      reminders: (reminders || []).map((r: Record<string, unknown>) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        remindAt: r.remind_at,
        postId: r.post_id,
        campaignId: r.campaign_id,
        isCompleted: r.is_completed,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    })
  } catch (error) {
    if ((error as Error).message === 'Unauthorized') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Step 2: Create the Zustand store**

```typescript
// src/lib/calendarStore.ts
import { create } from 'zustand'
import { dedup, createDedupKey } from './requestDedup'
import { Post } from './posts'

export interface CalendarReminder {
  id: string
  title: string
  description?: string
  remindAt: string
  postId?: string
  campaignId?: string
  isCompleted: boolean
  createdAt: string
  updatedAt: string
}

interface CalendarState {
  posts: Post[]
  reminders: CalendarReminder[]
  loading: boolean
  error: string | null
  rangeStart: string | null
  rangeEnd: string | null
}

interface CalendarActions {
  fetchCalendarData: (start: string, end: string) => Promise<void>
}

export const useCalendarStore = create<CalendarState & CalendarActions>()((set) => ({
  posts: [],
  reminders: [],
  loading: false,
  error: null,
  rangeStart: null,
  rangeEnd: null,

  fetchCalendarData: async (start: string, end: string) => {
    const key = createDedupKey('fetchCalendarData', start, end)
    return dedup(key, async () => {
      set({ loading: true, error: null })
      try {
        const res = await fetch(`/api/calendar?start=${start}&end=${end}`)
        if (!res.ok) throw new Error('Failed to fetch calendar data')
        const data = await res.json()
        set({
          posts: data.posts,
          reminders: data.reminders,
          loading: false,
          rangeStart: start,
          rangeEnd: end,
        })
      } catch (error) {
        set({ error: (error as Error).message, loading: false })
      }
    })
  },
}))
```

**Step 3: Commit**

```bash
git add src/app/api/calendar/route.ts src/lib/calendarStore.ts
git commit -m "feat: add calendar API endpoint and Zustand store"
```

---

### Agent 4: CalendarView Enhancements

**Goal:** Extend the existing `CalendarView.tsx` with week view toggle and reminders overlay.

**Files:**
- Modify: `src/app/(dashboard)/posts/CalendarView.tsx`

**Step 1: Read the existing CalendarView.tsx (198 lines)**

The current component shows a month grid of posts. We need to add:
- Week/month toggle
- Reminders overlay (bell icon + title)
- Platform color badges
- Day detail panel on click

**Step 2: Enhance the component**

Add a `viewMode` prop (`'month' | 'week'`), a `reminders` prop, and a toggle UI. The month view keeps the existing grid. The week view shows 7 days in a column layout with time slots.

Key changes:
- Add `reminders?: CalendarReminder[]` prop (imported from `calendarStore`)
- Add `viewMode?: 'month' | 'week'` and `onViewModeChange?: (mode) => void` props
- In each day cell, render reminders with a `Bell` icon in accent color alongside post badges
- Add week view: 7-day column layout showing posts + reminders with times
- Keep existing click-to-create and click-to-edit behavior

**Step 3: Run typecheck**

```bash
make typecheck
```

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/posts/CalendarView.tsx
git commit -m "feat: add week view and reminders overlay to CalendarView"
```

---

### Agent 5: /calendar Route Page

**Goal:** Create a standalone `/calendar` page with full-page calendar and sidebar agenda.

**Files:**
- Create: `src/app/(dashboard)/calendar/page.tsx`
- Modify: `src/app/(dashboard)/components/AppHeader.tsx` (add Calendar nav icon)
- Modify: `src/app/(dashboard)/components/BottomNav.tsx` (add Calendar nav item)

**Step 1: Create the calendar page**

```typescript
// src/app/(dashboard)/calendar/page.tsx
'use client'

import { useState, useEffect, useMemo } from 'react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isToday } from 'date-fns'
import { Calendar as CalendarIcon, Bell, ChevronLeft, ChevronRight } from 'lucide-react'
import { useCalendarStore } from '@/lib/calendarStore'
import { usePostsStore } from '@/lib/storage'
import { useRemindersStore } from '@/lib/reminders'
import CalendarView from '@/app/(dashboard)/posts/CalendarView'
import { cn } from '@/lib/utils'
import { PLATFORM_INFO } from '@/lib/posts'

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const { posts, reminders, loading, fetchCalendarData } = useCalendarStore()

  // Fetch data for visible range
  useEffect(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    // Extend to full weeks for calendar grid
    const rangeStart = format(startOfWeek(monthStart), 'yyyy-MM-dd')
    const rangeEnd = format(endOfWeek(monthEnd), 'yyyy-MM-dd')
    fetchCalendarData(rangeStart, rangeEnd)
  }, [currentDate, fetchCalendarData])

  // Today's agenda
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const todayPosts = useMemo(
    () => posts.filter((p) => p.scheduledAt?.startsWith(todayKey)),
    [posts, todayKey]
  )
  const todayReminders = useMemo(
    () => reminders.filter((r) => r.remindAt.startsWith(todayKey)),
    [reminders, todayKey]
  )

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <CalendarIcon className="w-6 h-6" />
          Calendar
        </h1>
        {/* View mode toggle */}
        <div className="flex gap-1 p-1 rounded-md border-[3px] border-border bg-card">
          <button
            onClick={() => setViewMode('month')}
            className={cn(
              'px-3 py-1 text-sm font-bold rounded transition-colors',
              viewMode === 'month' && 'bg-primary text-primary-foreground'
            )}
          >
            Month
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={cn(
              'px-3 py-1 text-sm font-bold rounded transition-colors',
              viewMode === 'week' && 'bg-primary text-primary-foreground'
            )}
          >
            Week
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main calendar */}
        <div className="flex-1">
          <CalendarView
            posts={posts}
            reminders={reminders}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>

        {/* Sidebar: Today's Agenda */}
        <div className="lg:w-80 space-y-4">
          <div className="sticker-card p-4">
            <h2 className="font-bold text-lg mb-3">Today&apos;s Agenda</h2>
            {todayPosts.length === 0 && todayReminders.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled for today</p>
            ) : (
              <div className="space-y-2">
                {todayPosts.map((post) => (
                  <div key={post.id} className="flex items-center gap-2 text-sm">
                    <div className={cn('w-2 h-2 rounded-full', `bg-${post.platform}`)} />
                    <span className="font-medium">{PLATFORM_INFO[post.platform].label}</span>
                    <span className="text-muted-foreground">
                      {post.scheduledAt ? format(new Date(post.scheduledAt), 'h:mm a') : ''}
                    </span>
                  </div>
                ))}
                {todayReminders.map((reminder) => (
                  <div key={reminder.id} className="flex items-center gap-2 text-sm">
                    <Bell className="w-3 h-3 text-accent" />
                    <span className="font-medium">{reminder.title}</span>
                    <span className="text-muted-foreground">
                      {format(new Date(reminder.remindAt), 'h:mm a')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Add Calendar to AppHeader navigation**

In `src/app/(dashboard)/components/AppHeader.tsx`, add a Calendar icon link in the desktop nav row alongside existing icons (Projects, Campaigns, Blog, etc.):

```typescript
// Add import
import { Calendar } from 'lucide-react'

// Add to the nav icons array, before Settings:
<Link href="/calendar" className={cn('p-2 rounded-md ...', pathname === '/calendar' && 'bg-secondary ...')}>
  <Calendar className="w-5 h-5" />
</Link>
```

**Step 3: Add Calendar to BottomNav**

In `src/app/(dashboard)/components/BottomNav.tsx`, replace the current `Posts` item or add Calendar:

```typescript
// Change Posts nav item to Calendar
{ icon: Calendar, label: 'Calendar', path: '/calendar' },
```

**Step 4: Verify typecheck and lint**

```bash
make check
```

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/calendar/ src/app/\(dashboard\)/components/AppHeader.tsx src/app/\(dashboard\)/components/BottomNav.tsx
git commit -m "feat: add /calendar route with sidebar agenda and navigation links"
```

---

### Agent 6: Dashboard Mini-Calendar Widget

**Goal:** Add a week-ahead calendar preview card to the dashboard.

**Files:**
- Create: `src/app/(dashboard)/dashboard/CalendarWidget.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (add widget)

**Step 1: Create the widget component**

```typescript
// src/app/(dashboard)/dashboard/CalendarWidget.tsx
'use client'

import { useMemo } from 'react'
import { format, addDays, startOfDay, isSameDay } from 'date-fns'
import { Calendar, Bell } from 'lucide-react'
import Link from 'next/link'
import { Post, PLATFORM_INFO } from '@/lib/posts'
import { cn } from '@/lib/utils'

interface CalendarWidgetProps {
  posts: Post[]
  reminders: { id: string; title: string; remindAt: string; isCompleted: boolean }[]
  days?: number
}

export function CalendarWidget({ posts, reminders, days = 7 }: CalendarWidgetProps) {
  const today = startOfDay(new Date())

  const dateRange = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(today, i)),
    [today, days]
  )

  return (
    <div className="sticker-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Week Ahead
        </h3>
        <Link href="/calendar" className="text-xs font-bold text-primary hover:underline">
          View Calendar
        </Link>
      </div>
      <div className="space-y-1">
        {dateRange.map((date) => {
          const dayPosts = posts.filter(
            (p) => p.scheduledAt && isSameDay(new Date(p.scheduledAt), date)
          )
          const dayReminders = reminders.filter(
            (r) => !r.isCompleted && isSameDay(new Date(r.remindAt), date)
          )
          const hasItems = dayPosts.length > 0 || dayReminders.length > 0

          return (
            <div
              key={date.toISOString()}
              className={cn(
                'flex items-center gap-3 px-2 py-1.5 rounded text-sm',
                isSameDay(date, new Date()) && 'bg-primary/10 font-bold'
              )}
            >
              <span className="w-16 text-xs text-muted-foreground font-mono">
                {format(date, 'EEE d')}
              </span>
              <div className="flex-1 flex items-center gap-1 overflow-hidden">
                {dayPosts.map((p) => (
                  <div
                    key={p.id}
                    className={cn('w-2 h-2 rounded-full flex-shrink-0', `bg-${p.platform}`)}
                    title={`${PLATFORM_INFO[p.platform].label} post`}
                  />
                ))}
                {dayReminders.map((r) => (
                  <Bell
                    key={r.id}
                    className="w-3 h-3 text-accent flex-shrink-0"
                    title={r.title}
                  />
                ))}
                {!hasItems && (
                  <span className="text-xs text-muted-foreground/50">—</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {dayPosts.length + dayReminders.length > 0
                  ? `${dayPosts.length + dayReminders.length}`
                  : ''}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Step 2: Add widget to dashboard page**

In `src/app/(dashboard)/dashboard/page.tsx`, import and render the widget in the existing grid layout, alongside the Reminders section:

```typescript
import { CalendarWidget } from './CalendarWidget'

// In the JSX grid, add:
<CalendarWidget
  posts={activePosts.filter((p) => p.status === 'scheduled' && p.scheduledAt)}
  reminders={reminders}
/>
```

**Step 3: Verify typecheck**

```bash
make typecheck
```

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/dashboard/CalendarWidget.tsx src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: add week-ahead calendar widget to dashboard"
```

---

## Wave 2: Community Events & Recurrence (3 Parallel Agents)

> **Prerequisite:** Wave 1 merged to main. All migrations applied.

### Agent 7: Community Events Store + API

**Goal:** Create Zustand store and CRUD API routes for community events and subscriptions.

**Files:**
- Create: `src/lib/communityEvents.ts` (Zustand store + types)
- Create: `src/app/api/community-events/route.ts` (GET list)
- Create: `src/app/api/community-events/subscriptions/route.ts` (GET/POST)
- Create: `src/app/api/community-events/subscriptions/[id]/route.ts` (DELETE)

**Step 1: Define types and store**

```typescript
// src/lib/communityEvents.ts
import { create } from 'zustand'
import { dedup, createDedupKey } from './requestDedup'

export interface CommunityEvent {
  id: string
  name: string
  description: string | null
  platform: 'twitter' | 'linkedin' | 'reddit'
  target: string | null
  recurrenceRule: string
  recurrenceTimezone: string
  suggestedPostType: string | null
  tags: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface EventSubscription {
  id: string
  eventId: string
  notifyHoursBefore: number
  autoCreateDraft: boolean
  createdAt: string
  event?: CommunityEvent
}

interface CommunityEventsState {
  events: CommunityEvent[]
  subscriptions: EventSubscription[]
  loading: boolean
  error: string | null
  initialized: boolean
}

interface CommunityEventsActions {
  fetchEvents: () => Promise<void>
  fetchSubscriptions: () => Promise<void>
  subscribe: (eventId: string, options?: { notifyHoursBefore?: number; autoCreateDraft?: boolean }) => Promise<EventSubscription>
  unsubscribe: (subscriptionId: string) => Promise<void>
}

function transformEventFromDb(row: Record<string, unknown>): CommunityEvent {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string | null,
    platform: row.platform as 'twitter' | 'linkedin' | 'reddit',
    target: row.target as string | null,
    recurrenceRule: row.recurrence_rule as string,
    recurrenceTimezone: row.recurrence_timezone as string,
    suggestedPostType: row.suggested_post_type as string | null,
    tags: (row.tags as string[]) || [],
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

function transformSubscriptionFromDb(row: Record<string, unknown>): EventSubscription {
  return {
    id: row.id as string,
    eventId: row.event_id as string,
    notifyHoursBefore: row.notify_hours_before as number,
    autoCreateDraft: row.auto_create_draft as boolean,
    createdAt: row.created_at as string,
    event: row.community_events ? transformEventFromDb(row.community_events as Record<string, unknown>) : undefined,
  }
}

export const useCommunityEventsStore = create<CommunityEventsState & CommunityEventsActions>()(
  (set, get) => ({
    events: [],
    subscriptions: [],
    loading: false,
    error: null,
    initialized: false,

    fetchEvents: async () => {
      const key = createDedupKey('fetchCommunityEvents')
      return dedup(key, async () => {
        set({ loading: true, error: null })
        try {
          const res = await fetch('/api/community-events')
          if (!res.ok) throw new Error('Failed to fetch events')
          const data = await res.json()
          set({ events: data.events, loading: false, initialized: true })
        } catch (error) {
          set({ error: (error as Error).message, loading: false })
        }
      })
    },

    fetchSubscriptions: async () => {
      const key = createDedupKey('fetchEventSubscriptions')
      return dedup(key, async () => {
        try {
          const res = await fetch('/api/community-events/subscriptions')
          if (!res.ok) throw new Error('Failed to fetch subscriptions')
          const data = await res.json()
          set({ subscriptions: data.subscriptions })
        } catch (error) {
          set({ error: (error as Error).message })
        }
      })
    },

    subscribe: async (eventId, options = {}) => {
      const res = await fetch('/api/community-events/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          notifyHoursBefore: options.notifyHoursBefore ?? 24,
          autoCreateDraft: options.autoCreateDraft ?? false,
        }),
      })
      if (!res.ok) throw new Error('Failed to subscribe')
      const { subscription } = await res.json()
      set({ subscriptions: [...get().subscriptions, subscription] })
      return subscription
    },

    unsubscribe: async (subscriptionId) => {
      const res = await fetch(`/api/community-events/subscriptions/${subscriptionId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to unsubscribe')
      set({
        subscriptions: get().subscriptions.filter((s) => s.id !== subscriptionId),
      })
    },
  })
)
```

**Step 2: Create API routes**

Follow the standard API route pattern from CLAUDE.md:
- `GET /api/community-events` — returns all active events (system-level, no user filter)
- `GET /api/community-events/subscriptions` — returns user's subscriptions with joined event data
- `POST /api/community-events/subscriptions` — create subscription, validate with Zod
- `DELETE /api/community-events/subscriptions/[id]` — delete subscription, verify ownership

**Step 3: Commit**

```bash
git add src/lib/communityEvents.ts src/app/api/community-events/
git commit -m "feat: add community events store and API routes"
```

---

### Agent 8: Reminders Recurrence Enhancement

**Goal:** Extend the reminders store to support recurrence rules and auto-generated reminders from community events.

**Files:**
- Modify: `src/lib/reminders.ts` (add recurrence fields, enhance getUpcomingReminders)
- Create: `src/lib/reminders.test.ts` (test recurrence expansion)

**Step 1: Update Reminder types**

Add `recurrenceRule?: string` and `sourceEventId?: string` to the `Reminder` interface. Update `DbReminder` with `recurrence_rule` and `source_event_id`.

**Step 2: Enhance getUpcomingReminders**

For reminders with a `recurrenceRule`, expand the rule using the rrule utility (from Agent 2) to generate virtual upcoming instances. The function should merge one-time reminders with expanded recurring instances, sorted by date.

**Step 3: Update transform functions**

Add the new fields to `transformReminderFromDb` / `transformReminderToDb` in the store.

**Step 4: Write tests for recurrence expansion**

```typescript
// src/lib/reminders.test.ts
import { describe, it, expect } from 'vitest'
// Test that getUpcomingReminders correctly expands recurring reminders
// Test that one-time reminders are unaffected
// Test that completed reminders are filtered out
```

**Step 5: Commit**

```bash
git add src/lib/reminders.ts src/lib/reminders.test.ts
git commit -m "feat: add recurrence support to reminders store"
```

---

### Agent 9: Recurring Posts

**Goal:** Add recurrence support to posts — UI config and cron generation of next instance.

**Files:**
- Modify: `src/lib/posts.ts` (add recurrenceRule to Post type)
- Modify: `src/lib/utils.ts` (update transformPostFromDb/ToDb for recurrence_rule)
- Create: `src/components/editor/RecurrencePicker.tsx` (UI for setting repeat)
- Modify: `src/app/api/cron/publish/route.ts` (generate next instance after publish)

**Step 1: Add recurrenceRule to Post type**

```typescript
// In src/lib/posts.ts, add to Post interface:
recurrenceRule?: string | null  // iCal RRULE, e.g. "FREQ=WEEKLY;BYDAY=MO"
```

**Step 2: Update transform functions**

In `src/lib/utils.ts`, add `recurrence_rule` ↔ `recurrenceRule` to both transform functions.

**Step 3: Create RecurrencePicker component**

Simple dropdown with common options: None, Daily, Weekly (same day), Custom (text input for RRULE). Renders below SchedulePicker in the post editor.

**Step 4: Modify cron publisher**

After successfully publishing a recurring post, use `getNextOccurrence()` from `src/lib/rrule.ts` to calculate the next `scheduled_at` date and create a new draft post with the same content.

**Step 5: Commit**

```bash
git add src/lib/posts.ts src/lib/utils.ts src/components/editor/RecurrencePicker.tsx src/app/api/cron/publish/route.ts
git commit -m "feat: add recurring posts with auto-generation on publish"
```

---

## Wave 3: Events UI & Smart Nudges (2 Parallel Agents)

> **Prerequisite:** Wave 2 merged to main.

### Agent 10: Community Events UI

**Goal:** Build the event browser, subscription management, and calendar overlay for community events.

**Files:**
- Create: `src/app/(dashboard)/calendar/events/page.tsx` (event browser)
- Create: `src/components/calendar/EventBrowser.tsx`
- Create: `src/components/calendar/EventCard.tsx`
- Modify: `src/app/(dashboard)/posts/CalendarView.tsx` (overlay subscribed events)

**Step 1: Create EventCard component**

Displays event name, platform badge, target (subreddit/hashtag), recurrence description, subscribe button. Uses sticker-card styling.

**Step 2: Create EventBrowser component**

Lists all community events, filterable by platform. Shows subscription status per event. Toggle subscribe/unsubscribe.

**Step 3: Create /calendar/events page**

Full-page event browser with search and platform filter tabs.

**Step 4: Add event overlay to CalendarView**

For subscribed events, use `getOccurrencesInRange()` to expand recurrence rules into dates. Render as background highlights on those calendar days with the event name as tooltip.

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/calendar/events/ src/components/calendar/ src/app/\(dashboard\)/posts/CalendarView.tsx
git commit -m "feat: add community events browser and calendar overlay"
```

---

### Agent 11: Smart Nudges & Auto-Draft

**Goal:** Build the cron nudge system and dashboard nudge banner.

**Files:**
- Create: `src/app/api/cron/calendar-nudges/route.ts`
- Create: `src/components/calendar/NudgeBanner.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx` (add nudge banner)

**Step 1: Create the nudges cron endpoint**

```typescript
// src/app/api/cron/calendar-nudges/route.ts
// Pattern: mirrors /api/cron/publish
// 1. Validate CRON_SECRET
// 2. Use service role client
// 3. For each user with subscriptions:
//    a. Check if event occurs within notify_hours_before
//    b. If auto_create_draft: create draft post pre-filled with platform + target
//    c. Create reminder linked to the event
// 4. Return { processed, nudged, draftsCreated }
```

**Step 2: Create NudgeBanner component**

Checks subscriptions + upcoming events. If an event is within 24h and no content is scheduled for it, shows a banner:

> "Saturday Showcase is tomorrow — you have no content scheduled for r/webdev. [Create Post]"

Uses sticker-card styling with accent border.

**Step 3: Add banner to dashboard**

Import and render `<NudgeBanner />` at the top of the dashboard page, above the stats bar.

**Step 4: Commit**

```bash
git add src/app/api/cron/calendar-nudges/ src/components/calendar/NudgeBanner.tsx src/app/\(dashboard\)/dashboard/page.tsx
git commit -m "feat: add smart nudges cron and dashboard nudge banner"
```

---

## Summary

| Wave | Agents | Tasks | Estimated Scope |
|------|--------|-------|-----------------|
| 1 | 6 parallel | DB migrations, RRULE lib, Calendar API, CalendarView, /calendar page, Dashboard widget | Foundation |
| 2 | 3 parallel | Community events store+API, Reminders recurrence, Recurring posts | Data layer |
| 3 | 2 parallel | Events UI + browser, Smart nudges + auto-draft | User-facing features |

**Total: 11 agent tasks, 3 waves, max 6 agents concurrent.**

After Wave 3, create a PR with all changes for review.
