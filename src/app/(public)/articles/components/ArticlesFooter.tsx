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
