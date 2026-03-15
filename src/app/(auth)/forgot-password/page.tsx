'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// eslint-disable-next-line max-lines-per-function
export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-1 gradient-bar" />
        </div>
        <div className="w-full max-w-md">
          <div className="bg-card rounded-lg border-[3px] border-border shadow-[6px_6px_0_hsl(var(--border))] p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-sticker-green/10 flex items-center justify-center border-[3px] border-border shadow-sticker text-3xl">
              ✉️
            </div>
            <h2 className="text-xl font-extrabold text-foreground mb-2">Check your email</h2>
            <p className="text-muted-foreground mb-4">
              We&apos;ve sent a password reset link to{' '}
              <strong className="text-foreground">{email}</strong>. Click the link to reset your
              password.
            </p>
            <Link
              href="/login"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-md',
                'bg-secondary text-secondary-foreground font-bold text-sm',
                'border-[3px] border-border',
                'shadow-sticker-sm',
                'hover:-translate-y-px hover:shadow-sticker',
                'transition-all'
              )}
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Decorative gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-1 gradient-bar" />
      </div>

      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-card rounded-lg border-[3px] border-border shadow-[6px_6px_0_hsl(var(--border))] p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-sticker-orange/10 flex items-center justify-center border-[3px] border-border shadow-sticker text-3xl">
              🔑
            </div>
            <h1 className="text-3xl font-extrabold text-foreground">Reset password</h1>
            <p className="mt-2 text-muted-foreground">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 text-sm font-medium text-destructive bg-destructive/10 rounded-md border-2 border-destructive/30">
                ⚠️ {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-bold text-foreground mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={cn(
                  'w-full px-4 py-3 rounded-md',
                  'bg-card text-foreground placeholder-muted-foreground',
                  'border-[3px] border-border',
                  'shadow-sticker-sm',
                  'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
                  'transition-all duration-200'
                )}
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full px-4 py-3.5 rounded-md',
                'bg-sticker-orange text-white font-bold',
                'border-[3px] border-border',
                'shadow-sticker',
                'hover:translate-y-[-2px] hover:shadow-[6px_6px_0_hsl(var(--border))]',
                'active:translate-y-[2px] active:shadow-sticker-hover',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
                'transition-all duration-200'
              )}
            >
              {loading ? '⏳ Sending...' : '📧 Send reset link'}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Remember your password?{' '}
            <Link href="/login" className="text-primary hover:text-primary/80 font-bold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
