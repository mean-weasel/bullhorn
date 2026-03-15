'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { isNativePlatform } from '@/lib/capacitor'

// EU/EEA + UK country codes that require GDPR cookie consent
const GDPR_COUNTRIES = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
  'IS',
  'LI',
  'NO', // EEA
  'GB', // UK GDPR
])

function getCookie(name: string): string | null {
  // eslint-disable-next-line security/detect-non-literal-regexp -- name is always a controlled constant
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

export function CookieConsent() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    if (isNativePlatform()) return false
    if (process.env.NEXT_PUBLIC_E2E_TEST_MODE === 'true') return false
    const country = getCookie('user_country')
    if (country && !GDPR_COUNTRIES.has(country)) return false
    return !localStorage.getItem('cookie_consent')
  })

  const handleAccept = () => {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-100',
        'bg-card border-t-[3px] border-border',
        'shadow-[0_-4px_0_hsl(var(--border))]',
        'p-4 md:px-8 pb-safe animate-slide-up'
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
            'shadow-sticker-sm',
            'hover:-translate-y-px hover:shadow-sticker',
            'transition-all'
          )}
        >
          Accept
        </button>
      </div>
    </div>
  )
}
