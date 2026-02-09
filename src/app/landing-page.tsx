import Link from 'next/link'
import {
  CalendarDays,
  BarChart3,
  Bot,
  Rocket,
  FileText,
  FolderKanban,
  Share2,
  Megaphone,
  PenLine,
  Send,
  TrendingUp,
} from 'lucide-react'

const features = [
  {
    icon: CalendarDays,
    title: 'Multi-Platform Scheduling',
    description:
      'Write once, schedule across Twitter, LinkedIn, and Reddit. Pick the perfect time for each platform.',
    color: 'bg-sticker-blue',
  },
  {
    icon: FolderKanban,
    title: 'Campaign Management',
    description:
      'Group related posts into campaigns. Coordinate launches, announcements, and content series in one place.',
    color: 'bg-sticker-purple',
  },
  {
    icon: Rocket,
    title: 'Launch Posts',
    description:
      'Dedicated workflows for Product Hunt, Hacker News, and launch day. Ship your announcements with confidence.',
    color: 'bg-sticker-orange',
  },
  {
    icon: FileText,
    title: 'Blog Drafts',
    description:
      'Draft long-form content alongside your social posts. Keep your writing and distribution in one tool.',
    color: 'bg-sticker-green',
  },
  {
    icon: BarChart3,
    title: 'Analytics Dashboard',
    description:
      'Track engagement and performance across platforms. See what resonates and double down on what works.',
    color: 'bg-sticker-pink',
  },
  {
    icon: Share2,
    title: 'Projects',
    description:
      'Organize posts, campaigns, and drafts by project. Perfect for managing multiple products or clients.',
    color: 'bg-sticker-yellow',
  },
  {
    icon: Bot,
    title: 'AI-Powered Workflow',
    description:
      'Manage posts, campaigns, and drafts from Claude Code or any AI assistant. Our MCP server gives your tools direct access to Bullhorn.',
    color: 'bg-sticker-black',
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
              href="/login"
              className="sticker-button bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
            >
              Log in
            </Link>
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
            Schedule and ship social content{' '}
            <span className="text-primary">across every platform</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            One tool for Twitter, LinkedIn, and Reddit. Write your posts, schedule them, and track
            what works — without switching tabs.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="sticker-button bg-primary px-8 py-3 text-base text-primary-foreground"
            >
              Get started free
            </Link>
            <Link
              href="/login"
              className="sticker-button bg-card px-8 py-3 text-base text-foreground transition-colors hover:bg-secondary"
            >
              Log in
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

      {/* Features Grid */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Everything you need to ship content
            </h2>
            <p className="mx-auto max-w-2xl text-muted-foreground">
              From drafting to scheduling to analytics, Bullhorn keeps your entire content workflow
              in one place.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="sticker-card-hover p-6">
                <div
                  className={`mb-4 inline-flex rounded-md border-[3px] border-border p-2.5 ${feature.color}`}
                >
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-lg font-bold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
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
