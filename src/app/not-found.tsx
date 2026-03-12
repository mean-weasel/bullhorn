import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Decorative gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-1 gradient-bar" />
      </div>

      <div className="w-full max-w-md text-center">
        <div className="bg-card rounded-lg border-[3px] border-border shadow-[6px_6px_0_hsl(var(--border))] p-8">
          {/* Megaphone icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-lg bg-primary/10 flex items-center justify-center border-[3px] border-border shadow-sticker text-4xl">
            📢
          </div>

          {/* 404 heading */}
          <h1 className="text-6xl font-extrabold text-primary mb-2">404</h1>
          <h2 className="text-xl font-extrabold text-foreground mb-3">Page not found</h2>
          <p className="text-muted-foreground mb-8">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>

          {/* Back to dashboard button */}
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md bg-primary text-primary-foreground font-bold border-[3px] border-border shadow-sticker hover:translate-y-[-2px] hover:shadow-[6px_6px_0_hsl(var(--border))] active:translate-y-[2px] active:shadow-sticker-hover transition-all duration-200"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
