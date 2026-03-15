'use client'

import { useState, useEffect } from 'react'
import { Mail, X, RefreshCw, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface EmailVerificationBannerProps {
  email: string
}

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
export function EmailVerificationBanner({ email }: EmailVerificationBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check sessionStorage for dismissed state
  useEffect(() => {
    const isDismissed = sessionStorage.getItem('email-verification-dismissed')
    if (isDismissed === 'true') {
      setDismissed(true)
    }
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    sessionStorage.setItem('email-verification-dismissed', 'true')
  }

  const handleResend = async () => {
    setResending(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (resendError) {
        // Handle rate limiting
        if (resendError.message.includes('rate') || resendError.message.includes('limit')) {
          setError('Please wait a moment before requesting another email.')
        } else {
          setError(resendError.message)
        }
        return
      }

      setResendSuccess(true)
      // Auto-dismiss success after 5 seconds
      setTimeout(() => {
        setResendSuccess(false)
      }, 5000)
    } catch (err) {
      setError('Failed to send verification email. Please try again.')
    } finally {
      setResending(false)
    }
  }

  // Show resend success banner
  if (resendSuccess) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-sticker-green/10 text-sticker-green border-b-2 border-sticker-green/30 font-bold">
        <span className="text-lg">✅</span>
        <CheckCircle className="w-5 h-5 shrink-0" />
        <p className="flex-1 text-sm">Verification email sent! Check your inbox.</p>
        <button
          onClick={() => setResendSuccess(false)}
          className="p-1.5 hover:bg-sticker-green/20 rounded-md transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  // Don't show if dismissed
  if (dismissed) {
    return null
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-primary/10 text-foreground border-b-2 border-primary/30 font-medium">
      <span className="text-lg">📧</span>
      <Mail className="w-5 h-5 shrink-0 text-primary" />
      <p className="flex-1 text-sm">Please verify your email address to ensure account security.</p>

      {error && <span className="text-xs text-destructive font-bold">{error}</span>}

      <button
        onClick={handleResend}
        disabled={resending}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-md',
          'bg-primary text-primary-foreground',
          'border-2 border-border',
          'shadow-sticker-hover',
          'hover:-translate-y-px hover:shadow-sticker-sm',
          'active:translate-y-px active:shadow-[1px_1px_0_hsl(var(--border))]',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
          'transition-all'
        )}
      >
        <RefreshCw className={cn('w-3.5 h-3.5', resending && 'animate-spin')} />
        {resending ? 'Sending...' : 'Resend'}
      </button>

      <button
        onClick={handleDismiss}
        className="p-1.5 hover:bg-primary/20 rounded-md transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
