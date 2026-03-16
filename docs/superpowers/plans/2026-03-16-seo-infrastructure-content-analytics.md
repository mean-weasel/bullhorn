# SEO Infrastructure, Content System & Analytics — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix critical SEO infrastructure gaps, create public article pages targeting low-competition keywords, and add PostHog analytics instrumentation.

**Architecture:** Three sequential workstreams. WS1 fixes middleware, robots, sitemap, and OG image (pure config changes). WS2 creates a `(public)/articles/` route group with static content pages and SSG. WS3 adds PostHog client-side SDK with a provider component, capture helper, and event instrumentation in existing Zustand stores.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS (sticker bomb design system), PostHog JS SDK, Zustand

**Spec:** `docs/superpowers/specs/2026-03-16-seo-infrastructure-content-analytics-design.md`

---

## Chunk 1: Infrastructure Fixes

### Task 1: Fix middleware public paths

**Files:**
- Modify: `src/lib/supabase/middleware.ts` (line ~112-120)

- [ ] **Step 1: Add `/privacy`, `/terms`, `/articles` to publicPaths**

In `src/lib/supabase/middleware.ts`, find the `publicPaths` array (around line 112) and add the three new paths:

```typescript
const publicPaths = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth',
  '/api',
  '/access-denied',
  '/docs',
  '/privacy',
  '/terms',
  '/articles',
]
```

- [ ] **Step 2: Verify the change**

Run: `make typecheck`
Expected: PASS (no type errors)

Start dev server and verify in a private/incognito browser:
- `http://localhost:3000/privacy` — should load without redirect to `/login`
- `http://localhost:3000/terms` — should load without redirect to `/login`

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/middleware.ts
git commit -m "fix: add /privacy, /terms, /articles to public middleware paths"
```

---

### Task 2: Update robots.ts

**Files:**
- Modify: `src/app/robots.ts`

- [ ] **Step 1: Update allow and disallow lists**

Replace the contents of `src/app/robots.ts` with:

```typescript
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/signup', '/docs/mcp', '/privacy', '/terms', '/articles'],
        disallow: [
          '/dashboard',
          '/posts',
          '/new',
          '/edit',
          '/campaigns',
          '/projects',
          '/launch-posts',
          '/settings',
          '/profile',
          '/api',
        ],
      },
    ],
    sitemap: `${process.env.NEXT_PUBLIC_APP_URL || 'https://bullhorn.to'}/sitemap.xml`,
  }
}
```

Key changes from current file:
1. Added `/privacy`, `/terms`, `/articles` to allow
2. **Removed** `/blog` from disallow (middleware handles auth gating)

- [ ] **Step 2: Verify**

Run: `make typecheck`

Start dev server, fetch `http://localhost:3000/robots.txt` and confirm:
- `/articles` appears in `Allow`
- `/blog` does NOT appear in `Disallow`
- `/privacy` and `/terms` appear in `Allow`

- [ ] **Step 3: Commit**

```bash
git add src/app/robots.ts
git commit -m "fix: update robots.ts to allow /privacy, /terms, /articles"
```

---

### Task 3: Improve opengraph-image.tsx

**Files:**
- Modify: `src/app/opengraph-image.tsx`

- [ ] **Step 1: Update OG image design**

The existing file uses `ImageResponse` with edge runtime. Update the styling to use the Bullhorn brand identity more strongly — gold (#ce9a08) on dark (#0f172a), with the tagline "Social Media Post Scheduler for developers, indie hackers, and teams who ship fast."

Keep the same file structure and `ImageResponse` approach. Just improve the visual design (colors, layout, text). The file is already convention-based, so Next.js serves it automatically.

- [ ] **Step 2: Verify**

Run: `make typecheck`

Visit `http://localhost:3000/opengraph-image` in the browser to preview the generated image.

- [ ] **Step 3: Commit**

```bash
git add src/app/opengraph-image.tsx
git commit -m "chore: improve OG image branding"
```

---

## Chunk 2: Article Content System — Data Layer & Components

### Task 4: Create article data types and content index

**Files:**
- Create: `src/app/(public)/articles/content/index.ts`

- [ ] **Step 1: Create the content directory and index file**

```bash
mkdir -p src/app/\(public\)/articles/content
mkdir -p src/app/\(public\)/articles/components
mkdir -p src/app/\(public\)/articles/\[slug\]
```

Create `src/app/(public)/articles/content/index.ts`:

```typescript
import type { ReactElement } from 'react'

export interface Article {
  slug: string
  title: string
  description: string
  publishedAt: string
  updatedAt?: string
  keywords: string[]
}

export interface ArticleWithContent extends Article {
  content: () => ReactElement
}

// Import all articles here
import { article as scheduleLinkedin } from './schedule-linkedin-posts'
import { article as schedulingTools } from './social-media-scheduling-tools'
import { article as schedulingDevs } from './social-media-scheduling-for-developers'

const articles: ArticleWithContent[] = [scheduleLinkedin, schedulingTools, schedulingDevs]

export function getAllArticles(): Article[] {
  return articles
    .map(({ content: _, ...metadata }) => metadata)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
}

export function getArticleBySlug(slug: string): ArticleWithContent | undefined {
  return articles.find((a) => a.slug === slug)
}
```

- [ ] **Step 2: Verify types compile (will fail on missing article files — expected)**

Run: `npx tsc --noEmit 2>&1 | head -5`
Expected: Errors about missing article files — that's fine, we create them next.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(public\)/articles/content/index.ts
git commit -m "feat: add article content data layer with types and index"
```

---

### Task 5: Create Article 1 — Schedule LinkedIn Posts

**Files:**
- Create: `src/app/(public)/articles/content/schedule-linkedin-posts.tsx`

- [ ] **Step 1: Write the article content**

Create `src/app/(public)/articles/content/schedule-linkedin-posts.tsx`:

```tsx
/* eslint-disable max-lines */
import Link from 'next/link'
import type { ArticleWithContent } from './index'

export const article: ArticleWithContent = {
  slug: 'schedule-linkedin-posts',
  title: 'How to Schedule LinkedIn Posts in 2026',
  description:
    'Learn how to schedule LinkedIn posts for maximum engagement. Compare native scheduling, third-party tools, and multi-platform schedulers like Bullhorn.',
  publishedAt: '2026-03-16',
  keywords: ['schedule linkedin posts', 'linkedin post scheduler', 'linkedin scheduling tool'],
  content: () => (
    <>
      <p>
        LinkedIn is where professional conversations happen — product announcements, hiring updates,
        thought leadership. But posting at the right time matters. Scheduling your LinkedIn posts
        lets you plan content when you have creative energy and publish when your audience is
        active.
      </p>

      <h2>Why Schedule LinkedIn Posts?</h2>
      <p>
        LinkedIn&apos;s algorithm favors consistent posting. Scheduling helps you maintain a regular
        cadence without being glued to the app. Whether you&apos;re a solo founder or part of a
        marketing team, batch-creating content and scheduling it saves hours per week.
      </p>

      <h2>Option 1: Native LinkedIn Scheduling</h2>
      <p>
        LinkedIn now offers built-in scheduling for posts. When composing a post, click the clock
        icon to set a future date and time. It works, but it&apos;s limited:
      </p>
      <ul>
        <li>Only works for LinkedIn — you need separate tools for Twitter and Reddit</li>
        <li>No campaign or project organization</li>
        <li>No cross-platform content repurposing</li>
        <li>Cannot schedule from external tools or APIs</li>
      </ul>

      <h2>Option 2: Third-Party Scheduling Tools</h2>
      <p>
        Tools like Buffer, Hootsuite, and Later offer multi-platform scheduling. They work well for
        marketing teams but can feel heavyweight for developers and indie hackers who just want to
        ship updates alongside their product work.
      </p>

      <h2>Option 3: Bullhorn — Built for Developers Who Ship</h2>
      <p>
        <Link href="/signup" className="text-[hsl(var(--gold))] font-bold hover:underline">
          Bullhorn
        </Link>{' '}
        is a social media scheduler built specifically for developers, indie hackers, and
        early-stage teams. Schedule posts for LinkedIn, Twitter, and Reddit from one place.
      </p>
      <p>What makes Bullhorn different:</p>
      <ul>
        <li>
          <strong>AI capture via MCP</strong> — Save post ideas from Claude, Cursor, or any AI tool
          without leaving your workflow
        </li>
        <li>
          <strong>Campaign organization</strong> — Group related posts for product launches
        </li>
        <li>
          <strong>Launch day workflows</strong> — Templates for Product Hunt, Hacker News, and
          coordinated launches
        </li>
        <li>
          <strong>Free tier</strong> — 50 posts, 5 campaigns, 3 projects at no cost
        </li>
      </ul>

      <h2>Tips for LinkedIn Scheduling</h2>
      <ol>
        <li>
          <strong>Post Tuesday–Thursday, 8–10 AM</strong> in your audience&apos;s timezone for
          maximum engagement
        </li>
        <li>
          <strong>Batch your content</strong> — Write 5 posts in one sitting, schedule them across
          the week
        </li>
        <li>
          <strong>Repurpose across platforms</strong> — A LinkedIn post can become a tweet thread
          with minor edits
        </li>
        <li>
          <strong>Track what works</strong> — Review engagement weekly and double down on formats
          that resonate
        </li>
      </ol>

      <h2>Get Started</h2>
      <p>
        Ready to schedule your LinkedIn posts alongside Twitter and Reddit?{' '}
        <Link href="/signup" className="text-[hsl(var(--gold))] font-bold hover:underline">
          Try Bullhorn free
        </Link>{' '}
        — no credit card required.
      </p>
    </>
  ),
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: May still have errors from missing article files 2 and 3 — that's OK.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(public\)/articles/content/schedule-linkedin-posts.tsx
git commit -m "feat: add article — How to Schedule LinkedIn Posts"
```

---

### Task 6: Create Article 2 — Social Media Scheduling Tools

**Files:**
- Create: `src/app/(public)/articles/content/social-media-scheduling-tools.tsx`

- [ ] **Step 1: Write the article content**

Create `src/app/(public)/articles/content/social-media-scheduling-tools.tsx` following the same pattern as Task 5. Target keyword: "social media scheduling tools". Content: honest comparison of Buffer, Hootsuite, Later, and Bullhorn with pros/cons for each. Position Bullhorn for the developer/indie hacker audience. ~1000-1500 words. Include internal links to `/signup` and the landing page.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(public\)/articles/content/social-media-scheduling-tools.tsx
git commit -m "feat: add article — Social Media Scheduling Tools Compared"
```

---

### Task 7: Create Article 3 — Scheduling for Developers

**Files:**
- Create: `src/app/(public)/articles/content/social-media-scheduling-for-developers.tsx`

- [ ] **Step 1: Write the article content**

Create `src/app/(public)/articles/content/social-media-scheduling-for-developers.tsx` following the same pattern. Target keyword: "social media scheduler for developers". Content: the problem with existing tools for technical founders, MCP integration, CLI workflows, AI capture. Thought leadership piece. ~800-1200 words. Internal links to `/docs/mcp`, `/signup`, landing page.

- [ ] **Step 2: Verify all articles compile**

Run: `npx tsc --noEmit`
Expected: PASS (all three article files exist, content/index.ts imports resolve)

- [ ] **Step 3: Commit**

```bash
git add src/app/\(public\)/articles/content/social-media-scheduling-for-developers.tsx
git commit -m "feat: add article — Social Media Scheduling for Developers"
```

---

### Task 8: Create ArticleCard component

**Files:**
- Create: `src/app/(public)/articles/components/ArticleCard.tsx`

- [ ] **Step 1: Write the component**

Create `src/app/(public)/articles/components/ArticleCard.tsx`:

```tsx
import Link from 'next/link'
import type { Article } from '../content'

interface ArticleCardProps {
  article: Article
}

export function ArticleCard({ article }: ArticleCardProps) {
  return (
    <Link href={`/articles/${article.slug}`} className="block">
      <article className="sticker-card-hover p-6 transition-all">
        <time
          dateTime={article.publishedAt}
          className="text-sm text-muted-foreground"
        >
          {new Date(article.publishedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        <h2 className="mt-2 text-xl font-bold">{article.title}</h2>
        <p className="mt-2 text-muted-foreground leading-relaxed">
          {article.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {article.keywords.slice(0, 3).map((kw) => (
            <span key={kw} className="sticker-badge text-xs">
              {kw}
            </span>
          ))}
        </div>
      </article>
    </Link>
  )
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/\(public\)/articles/components/ArticleCard.tsx
git commit -m "feat: add ArticleCard component for articles index"
```

---

### Task 9: Create ArticlesHeader and ArticlesFooter

**Files:**
- Create: `src/app/(public)/articles/components/ArticlesHeader.tsx`
- Create: `src/app/(public)/articles/components/ArticlesFooter.tsx`

- [ ] **Step 1: Write ArticlesHeader**

Create `src/app/(public)/articles/components/ArticlesHeader.tsx`:

```tsx
import Link from 'next/link'

export function ArticlesHeader() {
  return (
    <header className="border-b-3 border-[hsl(var(--border))] bg-background">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-extrabold text-[hsl(var(--gold))]">
            Bullhorn
          </Link>
          <Link
            href="/articles"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Articles
          </Link>
        </div>
        <Link href="/signup" className="sticker-button bg-[hsl(var(--gold))] px-4 py-2 text-sm">
          Sign Up Free
        </Link>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Write ArticlesFooter**

Create `src/app/(public)/articles/components/ArticlesFooter.tsx`:

```tsx
import Link from 'next/link'

export function ArticlesFooter() {
  return (
    <footer className="border-t-3 border-[hsl(var(--border))] bg-background">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-sm text-muted-foreground">
        <div className="flex gap-4">
          <Link href="/" className="hover:text-foreground">
            Home
          </Link>
          <Link href="/articles" className="hover:text-foreground">
            Articles
          </Link>
          <Link href="/docs/mcp" className="hover:text-foreground">
            MCP Docs
          </Link>
        </div>
        <div className="flex gap-4">
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Terms
          </Link>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/\(public\)/articles/components/
git commit -m "feat: add ArticlesHeader and ArticlesFooter components"
```

---

## Chunk 3: Article Content System — Pages & Routing

### Task 10: Create articles layout

**Files:**
- Create: `src/app/(public)/articles/layout.tsx`

- [ ] **Step 1: Write the layout**

Create `src/app/(public)/articles/layout.tsx`:

```tsx
import { ArticlesHeader } from './components/ArticlesHeader'
import { ArticlesFooter } from './components/ArticlesFooter'

export default function ArticlesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ArticlesHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">{children}</main>
      <ArticlesFooter />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(public\)/articles/layout.tsx
git commit -m "feat: add articles layout with header and footer"
```

---

### Task 11: Create articles index page

**Files:**
- Create: `src/app/(public)/articles/page.tsx`

- [ ] **Step 1: Write the index page**

Create `src/app/(public)/articles/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { getAllArticles } from './content'
import { ArticleCard } from './components/ArticleCard'

export const metadata: Metadata = {
  title: 'Articles',
  description:
    'Guides and tips on social media scheduling, content planning, and product launches for developers and indie hackers.',
}

export default function ArticlesPage() {
  const articles = getAllArticles()

  return (
    <div>
      <h1 className="text-3xl font-extrabold">Articles</h1>
      <p className="mt-2 text-muted-foreground">
        Guides on social media scheduling, product launches, and building in public.
      </p>
      <div className="mt-8 space-y-6">
        {articles.map((article) => (
          <ArticleCard key={article.slug} article={article} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(public\)/articles/page.tsx
git commit -m "feat: add articles index page"
```

---

### Task 12: Create article detail page with SSG

**Files:**
- Create: `src/app/(public)/articles/[slug]/page.tsx`

- [ ] **Step 1: Write the article page**

Create `src/app/(public)/articles/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllArticles, getArticleBySlug } from '../content'

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return getAllArticles().map((article) => ({ slug: article.slug }))
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) return {}

  return {
    title: article.title,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
      publishedTime: article.publishedAt,
    },
  }
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) notFound()

  const Content = article.content

  return (
    <article>
      <Link
        href="/articles"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; All articles
      </Link>

      <header className="mt-4">
        <time
          dateTime={article.publishedAt}
          className="text-sm text-muted-foreground"
        >
          {new Date(article.publishedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">{article.title}</h1>
      </header>

      <div className="prose prose-invert mt-8 max-w-none">
        <Content />
      </div>

      <div className="mt-12 rounded-lg border-3 border-[hsl(var(--gold))] bg-[hsl(var(--gold))/0.05] p-6 text-center">
        <p className="text-lg font-bold">Ready to schedule your posts?</p>
        <p className="mt-1 text-muted-foreground">
          Schedule across Twitter, LinkedIn, and Reddit from one place.
        </p>
        <Link
          href="/signup"
          className="sticker-button mt-4 inline-block bg-[hsl(var(--gold))] px-6 py-3"
        >
          Try Bullhorn Free
        </Link>
      </div>
    </article>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `make build`
Expected: PASS — all pages build, including static article pages

- [ ] **Step 3: Commit**

```bash
git add src/app/\(public\)/articles/\[slug\]/page.tsx
git commit -m "feat: add article detail page with SSG and metadata"
```

---

### Task 13: Update sitemap.ts

**Files:**
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Update sitemap to include all public routes**

Replace `src/app/sitemap.ts` contents with:

```typescript
import type { MetadataRoute } from 'next'
import { getAllArticles } from './(public)/articles/content'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bullhorn.to'

  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/login`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/signup`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/docs/mcp`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${baseUrl}/privacy`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/terms`, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/articles`, changeFrequency: 'weekly', priority: 0.7 },
  ]

  const articlePages: MetadataRoute.Sitemap = getAllArticles().map((article) => ({
    url: `${baseUrl}/articles/${article.slug}`,
    lastModified: new Date(article.publishedAt),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...articlePages]
}
```

- [ ] **Step 2: Verify**

Run: `make build`

Then fetch `http://localhost:3000/sitemap.xml` and confirm it includes:
- `/articles`
- `/articles/schedule-linkedin-posts`
- `/articles/social-media-scheduling-tools`
- `/articles/social-media-scheduling-for-developers`
- `/privacy`, `/terms`

- [ ] **Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat: update sitemap with all public routes and article pages"
```

---

## Chunk 4: PostHog Instrumentation

### Task 14: Install PostHog and create provider

**Files:**
- Modify: `package.json`
- Create: `src/lib/posthog.tsx`

- [ ] **Step 1: Install posthog-js**

```bash
npm install posthog-js
```

- [ ] **Step 2: Create PostHog provider and capture helper**

Create `src/lib/posthog.tsx`:

```tsx
'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'memory',
  })
}

function PostHogPageview() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname
      const search = searchParams.toString()
      if (search) {
        url = url + '?' + search
      }
      posthog.capture('$pageview', { $current_url: url })
    }
  }, [pathname, searchParams])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageview />
      </Suspense>
      {children}
    </PHProvider>
  )
}

export function captureEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.capture(event, properties)
  }
}

export function identifyUser(userId: string) {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.identify(userId)
  }
}

export function enableFullTracking() {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    posthog.set_config({ persistence: 'localStorage+cookie' })
  }
}
```

Note: `persistence: 'memory'` by default for GDPR compliance. Call `enableFullTracking()` after cookie consent. `identifyUser()` sends UUID only — no email or PII.

- [ ] **Step 3: Verify**

Run: `make typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/posthog.tsx
git commit -m "feat: add PostHog provider with capture helper and GDPR-safe defaults"
```

---

### Task 15: Integrate PostHog provider into root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add PostHogProvider to layout**

In `src/app/layout.tsx`:

1. Add import at the top:
```typescript
import { PostHogProvider } from '@/lib/posthog'
```

2. Wrap `{children}` with `<PostHogProvider>` inside the body. The existing structure is:
```tsx
<body className="font-sans">
  <Providers>{children}</Providers>
  <Analytics />
  <SpeedInsights />
  <CookieConsent />
</body>
```

Change to:
```tsx
<body className="font-sans">
  <PostHogProvider>
    <Providers>{children}</Providers>
  </PostHogProvider>
  <Analytics />
  <SpeedInsights />
  <CookieConsent />
</body>
```

- [ ] **Step 2: Verify**

Run: `make typecheck`
Expected: PASS

Run: `make dev` and check browser console — PostHog should not throw errors even without `NEXT_PUBLIC_POSTHOG_KEY` set (provider is a no-op).

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: integrate PostHog provider into root layout"
```

---

### Task 16: Add event instrumentation to Zustand stores

**Files:**
- Modify: `src/lib/storage.ts` (~lines 50-102)
- Modify: `src/lib/campaigns.ts` (~lines 63-92)

- [ ] **Step 1: Add captureEvent to storage.ts**

In `src/lib/storage.ts`, add import at the top:
```typescript
import { captureEvent } from '@/lib/posthog'
```

In the `addPost` function, after `hapticSuccess()` (around line 68), add:
```typescript
captureEvent('post_created', { postId: newPost.id })
```

In the `updatePost` function, after the successful response (around line 95), add:
```typescript
if (updates.status === 'scheduled') {
  captureEvent('post_scheduled', { postId: id })
}
```

- [ ] **Step 2: Add captureEvent to campaigns.ts**

In `src/lib/campaigns.ts`, add import at the top:
```typescript
import { captureEvent } from '@/lib/posthog'
```

In the `addCampaign` function, after `hapticSuccess()` (around line 85), add:
```typescript
captureEvent('campaign_created', { campaignId: newCampaign.id })
```

- [ ] **Step 3: Verify**

Run: `make typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/storage.ts src/lib/campaigns.ts
git commit -m "feat: add PostHog event capture to post and campaign stores"
```

---

### Task 17: Add signup event and user identification

**Files:**
- Modify: `src/app/(auth)/signup/page.tsx`
- Modify: `src/app/(dashboard)/components/NativeInit.tsx` (or similar dashboard client component)

- [ ] **Step 1: Add signup_started event**

In `src/app/(auth)/signup/page.tsx`, add import:
```typescript
import { captureEvent } from '@/lib/posthog'
```

In the `handleEmailSignUp` function, right after `setLoading(true)` (line ~44), add:
```typescript
captureEvent('signup_started', { method: 'email' })
```

Also in the Google OAuth handler (if one exists), add a similar capture with `{ method: 'google' }`.

- [ ] **Step 2: Add user identification on dashboard load**

In `src/app/(dashboard)/components/NativeInit.tsx` (or another dashboard client component that runs after auth), add:
```typescript
import { identifyUser } from '@/lib/posthog'
```

After getting the user session, call:
```typescript
identifyUser(user.id)
```

- [ ] **Step 3: Detect signup_completed on client**

In the same dashboard component or `VerificationSuccessBanner.tsx`, detect the `?verified=true` query param and fire:
```typescript
import { captureEvent } from '@/lib/posthog'
import { useSearchParams } from 'next/navigation'

// In the component:
const searchParams = useSearchParams()
useEffect(() => {
  if (searchParams.get('verified') === 'true') {
    captureEvent('signup_completed')
  }
}, [searchParams])
```

- [ ] **Step 4: Verify**

Run: `make typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/\(auth\)/signup/page.tsx src/app/\(dashboard\)/components/
git commit -m "feat: add PostHog signup events and user identification"
```

---

### Task 18: Update privacy policy

**Files:**
- Modify: `src/app/privacy/page.tsx`

- [ ] **Step 1: Add PostHog disclosure**

In `src/app/privacy/page.tsx`, find the third-party services section (around line 51-69, lists Supabase, Vercel, Sentry, Google). Add a new entry:

```
PostHog — Product analytics (anonymized pageviews and events, user identified by UUID only, no email or personal data sent — US region)
```

- [ ] **Step 2: Verify**

Visit `http://localhost:3000/privacy` and confirm PostHog is listed.

- [ ] **Step 3: Commit**

```bash
git add src/app/privacy/page.tsx
git commit -m "docs: add PostHog disclosure to privacy policy"
```

---

## Chunk 5: Final Verification

### Task 19: Full build and integration test

- [ ] **Step 1: Run full CI checks**

```bash
make ci
```

Expected: All lint, typecheck, and test checks pass.

- [ ] **Step 2: Run build**

```bash
make build
```

Expected: Build succeeds. Static article pages are generated.

- [ ] **Step 3: Manual verification checklist**

Start dev server (`make dev`) and verify in an incognito browser:

1. `/privacy` loads without auth redirect
2. `/terms` loads without auth redirect
3. `/articles` shows three article cards
4. `/articles/schedule-linkedin-posts` renders full article with metadata
5. `/articles/social-media-scheduling-tools` renders
6. `/articles/social-media-scheduling-for-developers` renders
7. `/robots.txt` shows `/articles` in Allow, no `/blog` in Disallow
8. `/sitemap.xml` includes all article URLs + `/privacy` + `/terms`
9. View page source on article pages — content is server-rendered (visible in HTML)
10. `/privacy` page mentions PostHog
11. No console errors from PostHog (env var not set = silent no-op)

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final fixes from integration verification"
```
