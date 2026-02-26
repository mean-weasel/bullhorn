'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) {
      setVisible(true)
    }
  }, [])

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[100]',
        'bg-card border-t-[3px] border-border',
        'shadow-[0_-4px_0_hsl(var(--border))]',
        'p-4 md:px-8 animate-slide-up'
      )}
    >
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4">
        <p className="text-sm text-muted-foreground flex-1">
          We use cookies for authentication and anonymous analytics.{' '}
          <Link href="/privacy" className="text-primary font-bold hover:underline">
            Privacy Policy
          </Link>
        </p>
        <button
          onClick={handleAccept}
          className={cn(
            'px-6 py-2 rounded-md font-bold text-sm whitespace-nowrap',
            'bg-primary text-primary-foreground',
            'border-[3px] border-border',
            'shadow-[3px_3px_0_hsl(var(--border))]',
            'hover:translate-y-[-1px] hover:shadow-[4px_4px_0_hsl(var(--border))]',
            'transition-all'
          )}
        >
          Accept
        </button>
      </div>
    </div>
  )
}
