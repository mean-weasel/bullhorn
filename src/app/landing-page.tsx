/* eslint-disable max-lines -- large page component with extracted sub-components */
import Link from 'next/link'
import {
  Bot,
  Rocket,
  FileText,
  FolderKanban,
  Share2,
  Megaphone,
  PenLine,
  Send,
  TrendingUp,
  Folder,
} from 'lucide-react'
import { FeatureCarousel } from '@/components/ui/FeatureCarousel'
import type { LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  color: string
  slides: { src: string; alt: string; caption: string }[]
}

const features: Feature[] = [
  {
    icon: Bot,
    title: 'Capture with your AI tooling of choice, anytime',
    description:
      'Save post ideas from Claude, Cursor, or whatever AI tool you use. Capture mid-flow via MCP without breaking your work context.',
    color: 'bg-sticker-purple',
    slides: [
      {
        src: '/landing/feature-1/terminal-1.png',
        alt: 'MCP create_post in Claude Code',
        caption: 'Save a tweet draft from Claude Code via MCP',
      },
      {
        src: '/landing/feature-1/step-2.png',
        alt: 'Dashboard overview with stats',
        caption: 'Your dashboard shows all captured drafts at a glance',
      },
      {
        src: '/landing/feature-1/step-3.png',
        alt: 'Dashboard drafts section',
        caption: 'Drafts captured via MCP appear instantly',
      },
    ],
  },
  {
    icon: PenLine,
    title: "Polish and organize when you're ready",
    description:
      'Come back later to draft full announcements, refine messaging, and organize into campaigns. Your product context is waiting for you.',
    color: 'bg-sticker-blue',
    slides: [
      {
        src: '/landing/feature-2/step-1.png',
        alt: 'Posts list with filter tabs',
        caption: 'Filter posts by status — drafts, scheduled, or all',
      },
      {
        src: '/landing/feature-2/step-2.png',
        alt: 'Post editor with content',
        caption: 'Edit content, assign campaigns, and set platforms',
      },
      {
        src: '/landing/feature-2/step-3.png',
        alt: 'Post editor scheduling controls',
        caption: 'Schedule posts and configure platform-specific settings',
      },
      {
        src: '/landing/feature-2/step-4.png',
        alt: 'Create new post form',
        caption: 'Create posts for Twitter, LinkedIn, or Reddit',
      },
    ],
  },
  {
    icon: Share2,
    title: 'Fork your content across formats',
    description:
      'Take a blog post and turn it into tweets. Turn a feature idea into a LinkedIn update. Transform your context for any platform.',
    color: 'bg-sticker-green',
    slides: [
      {
        src: '/landing/feature-3/terminal-1.png',
        alt: 'MCP fork blog to tweets in Claude Code',
        caption: 'Turn a blog post into a tweet thread via MCP',
      },
    ],
  },
  {
    icon: FolderKanban,
    title: 'Organize launches like you organize code',
    description:
      'Group related posts into campaigns. Coordinate product launches, feature drops, and announcements in one place.',
    color: 'bg-sticker-orange',
    slides: [
      {
        src: '/landing/feature-4/step-1.png',
        alt: 'Dashboard campaigns section',
        caption: 'See all campaigns from your dashboard',
      },
      {
        src: '/landing/feature-4/step-2.png',
        alt: 'Campaigns list with filters',
        caption: 'Filter campaigns by status — active, planning, or completed',
      },
      {
        src: '/landing/feature-4/step-3.png',
        alt: 'Campaign detail with posts',
        caption: 'Drill into a campaign to see all its posts',
      },
    ],
  },
  {
    icon: Rocket,
    title: 'Dedicated workflows for launch day',
    description:
      'Templates for Product Hunt, Hacker News, and coordinated launches. Keep all your launch communication organized and ready.',
    color: 'bg-sticker-pink',
    slides: [
      {
        src: '/landing/feature-5/step-1.png',
        alt: 'Launch posts list',
        caption: 'Dedicated launch posts for Product Hunt and Hacker News',
      },
      {
        src: '/landing/feature-5/step-2.png',
        alt: 'Launch post creation form',
        caption: 'Create launch posts with platform-specific fields',
      },
      {
        src: '/landing/feature-5/step-3.png',
        alt: 'Product Hunt specific fields',
        caption: 'Fill in tagline, pricing, and maker comment for PH',
      },
    ],
  },
  {
    icon: FileText,
    title: 'Draft long-form alongside your social content',
    description:
      'Write blog posts in the same place as your tweets and updates. Keep your full product story in one context-rich workspace.',
    color: 'bg-sticker-yellow',
    slides: [
      {
        src: '/landing/feature-6/step-1.png',
        alt: 'Blog drafts list',
        caption: 'Manage blog drafts with word counts and timestamps',
      },
      {
        src: '/landing/feature-6/step-2.png',
        alt: 'Blog editor with markdown',
        caption: 'Rich markdown editor with live word count',
      },
    ],
  },
  {
    icon: Folder,
    title: 'Manage multiple products or clients',
    description:
      'Organize everything by project. Perfect for teams shipping multiple products or agencies managing client launches.',
    color: 'bg-sticker-black',
    slides: [
      {
        src: '/landing/feature-7/step-1.png',
        alt: 'Dashboard projects section',
        caption: 'Projects overview right on your dashboard',
      },
      {
        src: '/landing/feature-7/step-2.png',
        alt: 'Projects list page',
        caption: 'Browse all projects with descriptions and stats',
      },
      {
        src: '/landing/feature-7/step-3.png',
        alt: 'Project detail with campaigns and posts',
        caption: 'Drill into a project to see campaigns and posts',
      },
    ],
  },
]

const steps = [
  {
    number: 1,
    icon: PenLine,
    title: 'Create your post',
    description:
      'Write your content and pick which platforms to publish on. Customize per platform if needed.',
  },
  {
    number: 2,
    icon: Send,
    title: 'Schedule across platforms',
    description:
      'Set the date and time for each platform. Bullhorn handles the rest so you can get back to building.',
  },
  {
    number: 3,
    icon: TrendingUp,
    title: 'Track performance',
    description:
      'Monitor engagement across all your channels. Learn what works and refine your content strategy.',
  },
]

// eslint-disable-next-line max-lines-per-function
export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b-[3px] border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Megaphone className="h-7 w-7 text-primary" />
            <span className="text-xl font-extrabold tracking-tight">Bullhorn</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/docs/mcp"
              className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              Docs
            </Link>
            <Link
              href="/signup"
              className="sticker-button bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28">
        {/* Decorative gradient bar */}
        <div className="gradient-bar absolute left-0 top-0 h-1 w-full" />

        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex">
            <span className="sticker-badge bg-sticker-pink/10 text-sticker-pink">Now in beta</span>
          </div>
          <h1 className="mb-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl md:text-6xl">
            Your single source of truth for <span className="text-primary">product context</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            Capture product updates while working with AI. Organize and polish in the UI. One place
            for all your launches, updates, and social content.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="sticker-button bg-primary px-8 py-3 text-base text-primary-foreground"
            >
              Get started free
            </Link>
          </div>

          {/* Platform badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
            <span className="sticker-badge border-twitter bg-twitter-soft text-twitter">
              Twitter
            </span>
            <span className="sticker-badge border-linkedin bg-linkedin-soft text-linkedin">
              LinkedIn
            </span>
            <span className="sticker-badge border-reddit bg-reddit-soft text-reddit">Reddit</span>
          </div>
        </div>
      </section>

      {/* Features — alternating text + carousel */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Built for teams who work with AI
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Capture ideas in flow, organize them later, and ship when ready. Your entire product
              communication workflow in one tool.
            </p>
          </div>

          <div className="space-y-20 sm:space-y-28">
            {features.map((feature, idx) => {
              const hasSlides = feature.slides.length > 0
              const isEven = idx % 2 === 0

              return (
                <div
                  key={feature.title}
                  className={`flex flex-col items-center gap-8 sm:gap-12 ${
                    hasSlides ? 'lg:flex-row' : ''
                  } ${hasSlides && !isEven ? 'lg:flex-row-reverse' : ''}`}
                >
                  {/* Text side */}
                  <div className={hasSlides ? 'flex-1' : 'max-w-2xl'}>
                    <div
                      className={`mb-4 inline-flex rounded-md border-[3px] border-border p-2.5 ${feature.color}`}
                    >
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="mb-3 text-2xl font-bold sm:text-3xl">{feature.title}</h3>
                    <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
                      {feature.description}
                    </p>
                  </div>

                  {/* Carousel side */}
                  {hasSlides && (
                    <div className="w-full max-w-xs shrink-0 sm:max-w-sm">
                      <FeatureCarousel slides={feature.slides} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="border-y-[3px] border-border bg-card px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              How it works
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              Three steps from draft to published. No complicated setup required.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-border bg-primary text-2xl font-black text-primary-foreground">
                  {step.number}
                </div>
                <div className="mx-auto mb-3 flex justify-center">
                  <step.icon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Target Audience */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-4xl">
          <div className="sticker-card p-8 sm:p-12">
            <h2 className="mb-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
              Built for people who ship
            </h2>
            <p className="mb-6 text-lg leading-relaxed text-muted-foreground">
              Bullhorn is built for developers, indie hackers, and early-stage teams who ship fast.
              Whether you are launching a side project, growing an open-source community, or running
              content for a startup, Bullhorn keeps your social presence consistent without becoming
              a full-time job.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="sticker-badge bg-sticker-green/10 text-sticker-green">
                Indie hackers
              </span>
              <span className="sticker-badge bg-sticker-blue/10 text-sticker-blue">Developers</span>
              <span className="sticker-badge bg-sticker-purple/10 text-sticker-purple">
                Open source maintainers
              </span>
              <span className="sticker-badge bg-sticker-orange/10 text-sticker-orange">
                Early-stage startups
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="border-t-[3px] border-border bg-card px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ready to ship?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Stop juggling tabs and start scheduling. Bullhorn is free to get started.
          </p>
          <Link
            href="/signup"
            className="sticker-button inline-block bg-primary px-10 py-3 text-base text-primary-foreground"
          >
            Get started free
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-[3px] border-border px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold">Bullhorn</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a
              href="https://github.com/mean-weasel/bullhorn"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <Link href="/docs/mcp" className="transition-colors hover:text-foreground">
              Docs
            </Link>
            <span>&copy; {new Date().getFullYear()} Bullhorn</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
