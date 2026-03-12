'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Home, Calendar, Plus, Settings, FileText } from 'lucide-react'

interface NavItem {
  icon: typeof Home
  label: string
  path: string
  isAction?: boolean
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: Calendar, label: 'Calendar', path: '/calendar' },
  { icon: Plus, label: 'New', path: '/new', isAction: true },
  { icon: FileText, label: 'Blog', path: '/blog' },
  { icon: Settings, label: 'More', path: '/settings' },
]

export function BottomNav() {
  const pathname = usePathname()

  // Don't show on editor pages (they have their own back navigation)
  const isEditorPage =
    pathname?.startsWith('/new') ||
    pathname?.startsWith('/edit') ||
    pathname?.startsWith('/blog/new') ||
    pathname?.startsWith('/blog/edit')
  if (isEditorPage) return null

  return (
    <nav
      aria-label="Mobile navigation"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50',
        'bg-card/95 backdrop-blur-xl',
        'border-t-[3px] border-border',
        'md:hidden',
        'pb-safe'
      )}
    >
      {/* Colorful gradient bar at top */}
      <div className="h-1 gradient-bar" />
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive =
            pathname === item.path || (item.path === '/dashboard' && pathname === '/')
          const Icon = item.icon

          if (item.isAction) {
            // Center "+" button with sticker styling
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  'flex items-center justify-center',
                  'w-14 h-14 -mt-6 rounded-md',
                  'bg-primary',
                  'text-primary-foreground',
                  'border-[3px] border-border',
                  'shadow-sticker',
                  'active:translate-y-[2px] active:shadow-sticker-hover',
                  'transition-all'
                )}
                aria-label={item.label}
              >
                <Icon className="w-7 h-7" strokeWidth={3} />
              </Link>
            )
          }

          return (
            <Link
              key={item.path}
              href={item.path}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center relative',
                'flex-1 h-full max-w-[72px]',
                'text-muted-foreground',
                'active:scale-95 transition-all',
                isActive && 'text-foreground'
              )}
            >
              <Icon className={cn('w-6 h-6', isActive && 'stroke-[2.5]')} />
              <span
                className={cn(
                  'text-[10px] mt-1 font-bold uppercase',
                  isActive && 'text-foreground'
                )}
              >
                {item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-1 px-3 py-0.5 rounded-full bg-sticker-pink/20">
                  <div className="w-4 h-1 rounded-full bg-sticker-pink" />
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
