'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import PasswordStrength from '@/components/ui/PasswordStrength'

// eslint-disable-next-line max-lines-per-function
export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isValidSession, setIsValidSession] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      setIsValidSession(!!session)
    }
    checkSession()

    // Listen for auth state changes (recovery link clicked)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })

      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  // Loading state while checking session
  if (isValidSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-1 gradient-bar" />
        </div>
        <div className="text-muted-foreground font-medium">⏳ Loading...</div>
      </div>
    )
  }

  // No valid session - show error
  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-1 gradient-bar" />
        </div>
        <div className="w-full max-w-md">
          <div className="bg-card rounded-lg border-[3px] border-border shadow-[6px_6px_0_hsl(var(--border))] p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-destructive/10 flex items-center justify-center border-[3px] border-border shadow-sticker text-3xl">
              ⚠️
            </div>
            <h2 className="text-xl font-extrabold text-foreground mb-2">Invalid or expired link</h2>
            <p className="text-muted-foreground mb-4">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Link
              href="/forgot-password"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-md',
                'bg-primary text-primary-foreground font-bold text-sm',
                'border-[3px] border-border',
                'shadow-sticker-sm',
                'hover:-translate-y-px hover:shadow-sticker',
                'transition-all'
              )}
            >
              Request new reset link
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-1 gradient-bar" />
        </div>
        <div className="w-full max-w-md">
          <div className="bg-card rounded-lg border-[3px] border-border shadow-[6px_6px_0_hsl(var(--border))] p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-sticker-green/10 flex items-center justify-center border-[3px] border-border shadow-sticker text-3xl">
              ✅
            </div>
            <h2 className="text-xl font-extrabold text-foreground mb-2">Password updated</h2>
            <p className="text-muted-foreground mb-4">
              Your password has been successfully reset. Redirecting you to sign in...
            </p>
            <Link
              href="/login"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-md',
                'bg-sticker-green text-white font-bold text-sm',
                'border-[3px] border-border',
                'shadow-sticker-sm',
                'hover:-translate-y-px hover:shadow-sticker',
                'transition-all'
              )}
            >
              Sign in now
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-sticker-purple/10 flex items-center justify-center border-[3px] border-border shadow-sticker text-3xl">
              🔐
            </div>
            <h1 className="text-3xl font-extrabold text-foreground">Set new password</h1>
            <p className="mt-2 text-muted-foreground">Enter your new password below</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-4 text-sm font-medium text-destructive bg-destructive/10 rounded-md border-2 border-destructive/30">
                ⚠️ {error}
              </div>
            )}

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-foreground mb-2">
                New Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={cn(
                  'w-full px-4 py-3 rounded-md',
                  'bg-card text-foreground placeholder-muted-foreground',
                  'border-[3px] border-border',
                  'shadow-sticker-sm',
                  'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
                  'transition-all duration-200'
                )}
                placeholder="••••••••"
              />
              <PasswordStrength password={password} />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-bold text-foreground mb-2"
              >
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className={cn(
                  'w-full px-4 py-3 rounded-md',
                  'bg-card text-foreground placeholder-muted-foreground',
                  'border-[3px] border-border',
                  'shadow-sticker-sm',
                  'focus:outline-hidden focus:ring-2 focus:ring-primary/50',
                  'transition-all duration-200'
                )}
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full px-4 py-3.5 rounded-md',
                'bg-sticker-purple text-white font-bold',
                'border-[3px] border-border',
                'shadow-sticker',
                'hover:translate-y-[-2px] hover:shadow-[6px_6px_0_hsl(var(--border))]',
                'active:translate-y-[2px] active:shadow-sticker-hover',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
                'transition-all duration-200'
              )}
            >
              {loading ? '⏳ Updating...' : '🔒 Update password'}
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
