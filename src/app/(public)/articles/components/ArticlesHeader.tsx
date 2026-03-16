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
