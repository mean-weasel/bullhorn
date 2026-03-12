'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, X } from 'lucide-react'

/**
 * Shows a success banner when ?verified=true is in the URL.
 * This component should always be rendered in the layout so it can
 * catch the verification success redirect from the auth callback.
 */
export function VerificationSuccessBanner() {
  const searchParams = useSearchParams()
  const [show, setShow] = useState(() => searchParams.get('verified') === 'true')

  useEffect(() => {
    if (!show) return
    // Clean up URL
    window.history.replaceState({}, '', window.location.pathname)
    // Auto-dismiss after 5 seconds
    const timer = setTimeout(() => setShow(false), 5000)
    return () => clearTimeout(timer)
  }, [show])

  if (!show) return null

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-sticker-green/10 text-sticker-green border-b-2 border-sticker-green/30 font-bold">
      <span className="text-lg">🎉</span>
      <CheckCircle className="w-5 h-5 shrink-0" />
      <p className="flex-1 text-sm">Email verified successfully!</p>
      <button
        onClick={() => setShow(false)}
        className="p-1.5 hover:bg-sticker-green/20 rounded-md transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
