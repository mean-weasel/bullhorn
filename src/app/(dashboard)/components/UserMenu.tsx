'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { User, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/profile'
import { createClient } from '@/lib/supabase/client'

interface UserMenuProps {
  email: string
  displayName?: string | null
}

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
export function UserMenu({ email, displayName }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const initials = getInitials(displayName, email)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close menu on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Logout error:', error)
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-9 h-9 rounded-md flex items-center justify-center text-xs font-bold text-white',
          'bg-sticker-purple',
          'border-2 border-border',
          'hover:-translate-y-px transition-all',
          'focus:outline-hidden focus:ring-2 focus:ring-primary/50'
        )}
        aria-label="User menu"
        aria-expanded={isOpen}
      >
        {initials}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="User menu options"
          className={cn(
            'absolute right-0 mt-2 w-56 py-2',
            'bg-card rounded-md border-[3px] border-border',
            'shadow-sticker',
            'animate-slide-up z-50'
          )}
        >
          {/* User info */}
          <div className="px-4 py-3 border-b-2 border-border">
            <p className="text-sm font-bold truncate">{displayName || 'User'}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/profile"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm font-medium',
                'text-foreground hover:bg-secondary transition-colors'
              )}
            >
              <User className="w-4 h-4" />
              Profile
            </Link>

            <button
              role="menuitem"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm w-full text-left font-medium',
                'text-destructive hover:bg-destructive/10 transition-colors',
                isLoggingOut && 'opacity-50 cursor-not-allowed'
              )}
            >
              <LogOut className="w-4 h-4" />
              {isLoggingOut ? 'Logging out...' : 'Log out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
