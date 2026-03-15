/* eslint-disable max-lines -- large page component with extracted sub-components */
import type { Metadata } from 'next'
import Link from 'next/link'

// eslint-disable-next-line react-refresh/only-export-components -- metadata export is required by Next.js App Router
export const metadata: Metadata = {
  title: 'MCP Server Documentation',
  description:
    'Connect Claude Code or any MCP client to manage your Bullhorn content with AI. Documentation for the @mean-weasel/bullhorn-mcp npm package.',
}
import {
  Megaphone,
  Key,
  Terminal,
  ArrowLeft,
  Package,
  FileText,
  FolderKanban,
  Rocket,
  PenLine,
  ExternalLink,
  Zap,
  Globe,
  Image,
  Shield,
  Gauge,
  Code,
} from 'lucide-react'

const postTools = [
  { name: 'create_post', description: 'Create a new social media post for a single platform' },
  { name: 'get_post', description: 'Get a single post by ID' },
  { name: 'update_post', description: 'Update an existing post' },
  { name: 'delete_post', description: 'Permanently delete a post' },
  { name: 'archive_post', description: 'Archive a post (soft delete, can be restored)' },
  { name: 'restore_post', description: 'Restore an archived post back to draft' },
  {
    name: 'list_posts',
    description: 'List posts with optional status, platform, and campaign filters',
  },
  {
    name: 'search_posts',
    description: 'Search posts by content, notes, platform, or campaign name',
  },
  {
    name: 'create_reddit_crossposts',
    description: 'Create multiple Reddit posts to different subreddits with a shared group',
  },
]

const campaignTools = [
  { name: 'create_campaign', description: 'Create a new campaign to organize related posts' },
  { name: 'get_campaign', description: 'Get a campaign by ID, including associated posts' },
  { name: 'update_campaign', description: 'Update a campaign name, description, or status' },
  {
    name: 'delete_campaign',
    description: 'Delete a campaign (posts become unlinked, not deleted)',
  },
  { name: 'list_campaigns', description: 'List campaigns with optional status filter' },
  { name: 'add_post_to_campaign', description: 'Link an existing post to a campaign' },
  {
    name: 'remove_post_from_campaign',
    description: 'Unlink a post from a campaign (does not delete)',
  },
]

const projectTools = [
  {
    name: 'create_project',
    description: 'Create a project with optional brand kit (hashtags, colors, logo)',
  },
  { name: 'get_project', description: 'Get a project by ID, including brand kit and settings' },
  { name: 'update_project', description: 'Update project name, description, or brand kit' },
  { name: 'delete_project', description: 'Delete a project (campaigns become unassigned)' },
  { name: 'list_projects', description: 'List all projects with optional pagination' },
  { name: 'get_project_campaigns', description: 'Get a project with all its campaigns' },
  {
    name: 'get_project_analytics',
    description: 'Get rolled-up analytics (campaign count, post counts by status)',
  },
  { name: 'add_account_to_project', description: 'Associate a social account with a project' },
  {
    name: 'remove_account_from_project',
    description: 'Remove a social account association from a project',
  },
  { name: 'get_project_accounts', description: 'Get all social accounts linked to a project' },
  {
    name: 'move_campaign_to_project',
    description: 'Move a campaign to a different project or make it unassigned',
  },
  {
    name: 'list_campaigns_by_project',
    description: 'List campaigns filtered by project or unassigned',
  },
]

const blogDraftTools = [
  { name: 'create_blog_draft', description: 'Create a new blog post draft with markdown content' },
  { name: 'get_blog_draft', description: 'Get a blog draft by ID with full content' },
  { name: 'update_blog_draft', description: 'Update title, content, date, notes, or status' },
  { name: 'delete_blog_draft', description: 'Permanently delete a blog draft' },
  { name: 'archive_blog_draft', description: 'Archive a blog draft (can be restored)' },
  { name: 'restore_blog_draft', description: 'Restore an archived blog draft' },
  {
    name: 'list_blog_drafts',
    description: 'List blog drafts with optional status and campaign filters',
  },
  { name: 'search_blog_drafts', description: 'Search blog drafts by content, title, or notes' },
  {
    name: 'add_image_to_draft',
    description: 'Copy an image to blog media and attach it to a draft',
  },
  { name: 'get_draft_images', description: 'Get list of images attached to a blog draft' },
]

const mediaTools = [
  {
    name: 'upload_media',
    description: 'Upload an image or video file (JPG, PNG, GIF, WebP, MP4, MOV, WebM)',
  },
  {
    name: 'list_media',
    description: 'List all uploaded media files with filename, URL, size, and mimetype',
  },
  { name: 'delete_media', description: 'Delete an uploaded media file by filename' },
]

const launchPostTools = [
  {
    name: 'create_launch_post',
    description: 'Create a launch post for Product Hunt, Hacker News, or other platforms',
  },
  { name: 'get_launch_post', description: 'Get a single launch post by ID' },
  { name: 'update_launch_post', description: 'Update an existing launch post' },
  { name: 'delete_launch_post', description: 'Delete a launch post' },
  {
    name: 'list_launch_posts',
    description: 'List launch posts with optional platform and status filters',
  },
]

const toolCategories = [
  {
    label: 'Posts',
    color: 'bg-sticker-blue/10 text-sticker-blue',
    icon: FileText,
    tools: postTools,
  },
  {
    label: 'Campaigns',
    color: 'bg-sticker-purple/10 text-sticker-purple',
    icon: FolderKanban,
    tools: campaignTools,
  },
  {
    label: 'Projects',
    color: 'bg-sticker-orange/10 text-sticker-orange',
    icon: Package,
    tools: projectTools,
  },
  {
    label: 'Blog Drafts',
    color: 'bg-sticker-green/10 text-sticker-green',
    icon: PenLine,
    tools: blogDraftTools,
  },
  {
    label: 'Media',
    color: 'bg-sticker-yellow/10 text-sticker-yellow',
    icon: Image,
    tools: mediaTools,
  },
  {
    label: 'Launch Posts',
    color: 'bg-sticker-pink/10 text-sticker-pink',
    icon: Rocket,
    tools: launchPostTools,
  },
]

const mcpConfig = `{
  "mcpServers": {
    "bullhorn": {
      "command": "npx",
      "args": ["-y", "@mean-weasel/bullhorn-mcp"],
      "env": {
        "BULLHORN_API_URL": "https://bullhorn.to"
      }
    }
  }
}`

const toolExamples = [
  {
    title: 'Create a Twitter Post',
    json: `{
  "tool": "create_post",
  "arguments": {
    "platform": "twitter",
    "content": { "text": "Launching our new feature today!" },
    "status": "draft"
  }
}`,
  },
  {
    title: 'Create a LinkedIn Post',
    json: `{
  "tool": "create_post",
  "arguments": {
    "platform": "linkedin",
    "content": {
      "text": "Excited to announce our Series A funding!",
      "visibility": "public"
    },
    "status": "scheduled",
    "scheduledAt": "2026-03-01T09:00:00Z"
  }
}`,
  },
  {
    title: 'Create a Reddit Post',
    json: `{
  "tool": "create_post",
  "arguments": {
    "platform": "reddit",
    "content": {
      "subreddit": "SideProject",
      "title": "Show r/SideProject: I built a social media scheduler",
      "body": "After 6 months of development..."
    },
    "status": "draft"
  }
}`,
  },
  {
    title: 'Create Reddit Crossposts',
    json: `{
  "tool": "create_reddit_crossposts",
  "arguments": {
    "subreddits": ["SideProject", "startups", "webdev"],
    "title": "Show: I built Bullhorn",
    "body": "A social media post scheduler...",
    "status": "draft"
  }
}`,
  },
]

const planLimits = [
  { resource: 'Posts', free: '50', pro: '500' },
  { resource: 'Campaigns', free: '5', pro: '50' },
  { resource: 'Projects', free: '3', pro: '20' },
  { resource: 'Blog Drafts', free: '10', pro: '100' },
  { resource: 'Launch Posts', free: '10', pro: '100' },
  { resource: 'Storage', free: '50 MB', pro: '2 GB' },
]

function ToolTable({ tools }: { tools: { name: string; description: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b-[3px] border-border">
            <th className="px-4 py-3 text-left text-sm font-bold">Tool</th>
            <th className="px-4 py-3 text-left text-sm font-bold">Description</th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => (
            <tr key={tool.name} className="border-b-2 border-border/50">
              <td className="px-4 py-3">
                <code className="rounded bg-[#1e1e2e] px-2 py-1 font-mono text-sm text-[#cdd6f4]">
                  {tool.name}
                </code>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">{tool.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// eslint-disable-next-line max-lines-per-function
export default function McpDocsPage() {
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
              href="/signup"
              className="sticker-button bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              Sign up
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pb-12 pt-16 sm:px-6 sm:pb-16 sm:pt-20">
        <div className="gradient-bar absolute left-0 top-0 h-1 w-full" />

        <div className="mx-auto max-w-4xl">
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="mb-6 inline-flex">
            <span className="sticker-badge bg-sticker-black/10 text-sticker-black dark:bg-sticker-black dark:text-white">
              <Terminal className="mr-1.5 h-3.5 w-3.5" />
              MCP Server
            </span>
          </div>

          <h1 className="mb-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            MCP Server <span className="text-primary">Documentation</span>
          </h1>
          <p className="mb-8 max-w-2xl text-lg text-muted-foreground">
            Connect Claude Code or any MCP client to manage your Bullhorn content with AI.
          </p>

          <div className="inline-flex">
            <a
              href="https://www.npmjs.com/package/@mean-weasel/bullhorn-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="sticker-badge border-[hsl(var(--gold-dark))] bg-primary/10 font-mono text-sm text-primary transition-colors hover:bg-primary/20"
            >
              <Package className="mr-1.5 h-3.5 w-3.5" />
              @mean-weasel/bullhorn-mcp
              <ExternalLink className="ml-1.5 h-3 w-3" />
            </a>
          </div>
        </div>
      </section>

      {/* Quick Start */}
      <section className="px-4 pb-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="sticker-card p-6 sm:p-8">
            <h2 className="mb-8 text-2xl font-extrabold tracking-tight sm:text-3xl">
              <Zap className="mr-2 inline-block h-7 w-7 text-primary" />
              Quick Start
            </h2>

            {/* Step 1 */}
            <div className="mb-10">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[3px] border-border bg-primary text-sm font-black text-primary-foreground">
                  1
                </div>
                <h3 className="text-lg font-bold">Create an API Key</h3>
              </div>
              <div className="ml-11">
                <p className="mb-3 text-muted-foreground">
                  Go to <strong className="text-foreground">Settings &rarr; API Keys</strong> in the
                  Bullhorn app and create a new key.
                </p>
                <p className="mb-4 text-sm text-muted-foreground">
                  <Key className="mr-1 inline-block h-3.5 w-3.5" />
                  Copy the key immediately &mdash; it won&apos;t be shown again.
                </p>
                <Link
                  href="/settings"
                  className="sticker-button inline-flex items-center gap-1.5 bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                >
                  Open Settings
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Step 2 */}
            <div className="mb-10">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[3px] border-border bg-primary text-sm font-black text-primary-foreground">
                  2
                </div>
                <h3 className="text-lg font-bold">Configure Claude Code</h3>
              </div>
              <div className="ml-11">
                <p className="mb-4 text-muted-foreground">
                  Add this to your{' '}
                  <code className="rounded bg-[#1e1e2e] px-1.5 py-0.5 font-mono text-sm text-[#cdd6f4]">
                    .mcp.json
                  </code>{' '}
                  file in your project root:
                </p>
                <pre className="mb-4 overflow-x-auto rounded-lg border-[3px] border-border bg-[#1e1e2e] p-4">
                  <code className="font-mono text-sm leading-relaxed text-[#cdd6f4]">
                    {mcpConfig}
                  </code>
                </pre>
                <div className="rounded-lg border-2 border-border/50 bg-muted/50 p-4">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Note:</strong> Set{' '}
                    <code className="rounded bg-[#1e1e2e] px-1.5 py-0.5 font-mono text-xs text-[#cdd6f4]">
                      BULLHORN_API_KEY
                    </code>{' '}
                    in your shell environment or{' '}
                    <code className="rounded bg-[#1e1e2e] px-1.5 py-0.5 font-mono text-xs text-[#cdd6f4]">
                      .env
                    </code>{' '}
                    file. The MCP server reads it automatically at startup.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[3px] border-border bg-primary text-sm font-black text-primary-foreground">
                  3
                </div>
                <h3 className="text-lg font-bold">Start Using</h3>
              </div>
              <div className="ml-11">
                <p className="text-muted-foreground">
                  Ask Claude to list your posts, create a campaign, or draft a blog post. The MCP
                  server handles authentication and API calls automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Available Tools */}
      <section className="border-y-[3px] border-border bg-card px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
            Available Tools
          </h2>
          <p className="mb-10 text-muted-foreground">
            {toolCategories.reduce((sum, cat) => sum + cat.tools.length, 0)} tools across{' '}
            {toolCategories.length} categories. Each tool maps to a Bullhorn API endpoint.
          </p>

          <div className="space-y-10">
            {toolCategories.map((category) => (
              <div key={category.label}>
                <div className="mb-4 flex items-center gap-2">
                  <span className={`sticker-badge ${category.color}`}>
                    <category.icon className="mr-1.5 h-3.5 w-3.5" />
                    {category.label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {category.tools.length} tools
                  </span>
                </div>
                <div className="sticker-card overflow-hidden">
                  <ToolTable tools={category.tools} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Environment Variables */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <Globe className="mr-2 inline-block h-7 w-7 text-primary" />
            Environment Variables
          </h2>
          <p className="mb-8 text-muted-foreground">
            Configure the MCP server with these environment variables.
          </p>

          <div className="sticker-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b-[3px] border-border">
                  <th className="px-4 py-3 text-left text-sm font-bold">Variable</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Required</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b-2 border-border/50">
                  <td className="px-4 py-3">
                    <code className="rounded bg-[#1e1e2e] px-2 py-1 font-mono text-sm text-[#cdd6f4]">
                      BULLHORN_API_KEY
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="sticker-badge bg-destructive/10 text-destructive">
                      Required
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    Your API key from Settings &rarr; API Keys
                  </td>
                </tr>
                <tr className="border-b-2 border-border/50">
                  <td className="px-4 py-3">
                    <code className="rounded bg-[#1e1e2e] px-2 py-1 font-mono text-sm text-[#cdd6f4]">
                      BULLHORN_API_URL
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="sticker-badge bg-muted text-muted-foreground">Optional</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    API base URL. Defaults to{' '}
                    <code className="rounded bg-[#1e1e2e] px-1.5 py-0.5 font-mono text-xs text-[#cdd6f4]">
                      https://bullhorn.to
                    </code>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Rate Limits */}
      <section className="border-y-[3px] border-border bg-card px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <Gauge className="mr-2 inline-block h-7 w-7 text-primary" />
            Rate Limits
          </h2>
          <p className="mb-8 text-muted-foreground">
            API requests are rate-limited to{' '}
            <strong className="text-foreground">10 requests per 10 seconds</strong> per API key
            using a sliding window algorithm. If exceeded, requests return HTTP{' '}
            <code className="rounded bg-[#1e1e2e] px-1.5 py-0.5 font-mono text-sm text-[#cdd6f4]">
              429
            </code>{' '}
            with a{' '}
            <code className="rounded bg-[#1e1e2e] px-1.5 py-0.5 font-mono text-sm text-[#cdd6f4]">
              Retry-After
            </code>{' '}
            header.
          </p>
        </div>
      </section>

      {/* Plan Limits */}
      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <Shield className="mr-2 inline-block h-7 w-7 text-primary" />
            Plan Limits
          </h2>
          <p className="mb-8 text-muted-foreground">
            Resource creation is subject to plan limits. When a limit is reached, creation tools
            return an error with the current usage.
          </p>

          <div className="sticker-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b-[3px] border-border">
                  <th className="px-4 py-3 text-left text-sm font-bold">Resource</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Free Plan</th>
                  <th className="px-4 py-3 text-left text-sm font-bold">Pro Plan</th>
                </tr>
              </thead>
              <tbody>
                {planLimits.map((row) => (
                  <tr key={row.resource} className="border-b-2 border-border/50">
                    <td className="px-4 py-3 text-sm font-medium">{row.resource}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{row.free}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Tool Examples */}
      <section className="border-y-[3px] border-border bg-card px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-4 text-2xl font-extrabold tracking-tight sm:text-3xl">
            <Code className="mr-2 inline-block h-7 w-7 text-primary" />
            Tool Examples
          </h2>
          <p className="mb-10 text-muted-foreground">
            Example tool calls showing the JSON arguments for common operations.
          </p>

          <div className="space-y-8">
            {toolExamples.map((example) => (
              <div key={example.title}>
                <h3 className="mb-3 text-lg font-bold">{example.title}</h3>
                <pre className="overflow-x-auto rounded-lg border-[3px] border-border bg-[#1e1e2e] p-4">
                  <code className="font-mono text-sm leading-relaxed text-[#cdd6f4]">
                    {example.json}
                  </code>
                </pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="border-t-[3px] border-border bg-card px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ready to automate?
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Create an account, grab an API key, and start managing your content with AI.
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
              href="https://www.npmjs.com/package/@mean-weasel/bullhorn-mcp"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              npm
            </a>
            <a
              href="https://github.com/mean-weasel/bullhorn"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
            <span>&copy; {new Date().getFullYear()} Bullhorn</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
