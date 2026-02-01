'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Settings,
  Plus,
  FolderOpen,
  FileText,
  FolderKanban,
  Rocket,
} from 'lucide-react'
import { UserMenu } from './UserMenu'

interface AppHeaderProps {
  userEmail?: string
  userDisplayName?: string | null
}

export function AppHeader({ userEmail, userDisplayName }: AppHeaderProps) {
  const pathname = usePathname()
  const isEditorPage = pathname?.startsWith('/new') || pathname?.startsWith('/edit') || pathname?.startsWith('/blog/new') || pathname?.startsWith('/blog/edit')

  return (
    <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-xl border-b-[3px] border-border">
      <div className="flex items-center justify-between h-16 px-6">
        <div className="flex items-center gap-3">
          {isEditorPage && (
            <Link
              href="/dashboard"
              className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors border-2 border-transparent hover:border-border"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
          )}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center border-[3px] border-border shadow-[3px_3px_0_hsl(var(--border))] text-xl">
              📢
            </div>
            <span className="font-extrabold text-xl md:text-2xl tracking-tight">
              Bullhorn
            </span>
          </Link>
        </div>

        {/* Desktop nav icons - hidden on mobile */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/projects"
            className={cn(
              'p-2 rounded-md text-muted-foreground transition-all',
              'hover:text-foreground hover:bg-secondary',
              'border-2 border-transparent hover:border-border',
              pathname?.startsWith('/projects') && 'bg-secondary text-foreground border-border'
            )}
            title="Projects"
          >
            <FolderKanban className="w-5 h-5" />
          </Link>
          <Link
            href="/campaigns"
            className={cn(
              'p-2 rounded-md text-muted-foreground transition-all',
              'hover:text-foreground hover:bg-secondary',
              'border-2 border-transparent hover:border-border',
              pathname?.startsWith('/campaigns') && 'bg-secondary text-foreground border-border'
            )}
            title="Campaigns"
          >
            <FolderOpen className="w-5 h-5" />
          </Link>
          <Link
            href="/blog"
            className={cn(
              'p-2 rounded-md text-muted-foreground transition-all',
              'hover:text-foreground hover:bg-secondary',
              'border-2 border-transparent hover:border-border',
              pathname?.startsWith('/blog') && 'bg-secondary text-foreground border-border'
            )}
            title="Blog Drafts"
          >
            <FileText className="w-5 h-5" />
          </Link>
          <Link
            href="/launch-posts"
            className={cn(
              'p-2 rounded-md text-muted-foreground transition-all',
              'hover:text-foreground hover:bg-secondary',
              'border-2 border-transparent hover:border-border',
              pathname?.startsWith('/launch-posts') && 'bg-secondary text-foreground border-border'
            )}
            title="Launch Posts"
          >
            <Rocket className="w-5 h-5" />
          </Link>
          <Link
            href="/settings"
            className={cn(
              'p-2 rounded-md text-muted-foreground transition-all',
              'hover:text-foreground hover:bg-secondary',
              'border-2 border-transparent hover:border-border',
              pathname === '/settings' && 'bg-secondary text-foreground border-border'
            )}
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </Link>
          <div className="ml-2">
            {userEmail ? (
              <UserMenu email={userEmail} displayName={userDisplayName} />
            ) : (
              <div className="w-9 h-9 rounded-md bg-sticker-purple flex items-center justify-center text-xs font-bold text-white border-2 border-border">
                U
              </div>
            )}
          </div>
        </div>
        {/* Mobile user avatar only */}
        <div className="md:hidden">
          {userEmail ? (
            <UserMenu email={userEmail} displayName={userDisplayName} />
          ) : (
            <div className="w-9 h-9 rounded-md bg-sticker-purple flex items-center justify-center text-xs font-bold text-white border-2 border-border">
              U
            </div>
          )}
        </div>
      </div>
      {/* Colorful gradient bar under header */}
      <div className="h-1 gradient-bar" />
    </header>
  )
}

export function FloatingActionButton() {
  const pathname = usePathname()
  const isEditorPage = pathname?.startsWith('/new') || pathname?.startsWith('/edit') || pathname?.startsWith('/blog/new') || pathname?.startsWith('/blog/edit')

  if (isEditorPage) return null

  return (
    <Link
      href="/new"
      className={cn(
        'fixed bottom-8 right-8 z-50',
        'w-14 h-14 rounded-md',
        'bg-primary',
        'flex items-center justify-center',
        'text-primary-foreground',
        'border-[3px] border-border',
        'shadow-[4px_4px_0_hsl(var(--border))]',
        'hover:translate-y-[-2px] hover:shadow-[6px_6px_0_hsl(var(--border))]',
        'active:translate-y-[2px] active:shadow-[2px_2px_0_hsl(var(--border))]',
        'transition-all duration-200',
        'hidden md:flex'
      )}
      title="Create new post"
    >
      <Plus className="w-7 h-7" strokeWidth={3} />
    </Link>
  )
}
