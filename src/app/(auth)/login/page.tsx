'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { isNativePlatform } from '@/lib/capacitor'
import { nativeGoogleSignIn } from '@/lib/googleSignIn'

// eslint-disable-next-line max-lines-per-function
export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGoogleLogin = async () => {
    if (isNativePlatform()) {
      setError(null)
      setLoading(true)
      const result = await nativeGoogleSignIn(supabase)
      if (result.success) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError(result.error || 'Google Sign-In failed')
      }
      setLoading(false)
      return
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(error.message)
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-lg bg-primary flex items-center justify-center border-[3px] border-border shadow-sticker text-3xl">
              📢
            </div>
            <h1 className="text-3xl font-extrabold text-foreground">Bullhorn</h1>
            <p className="mt-2 text-muted-foreground">Sign in to manage your social posts</p>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-5">
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

            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-bold text-foreground">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-primary hover:text-primary/80"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
                'bg-primary text-primary-foreground font-bold',
                'border-[3px] border-border',
                'shadow-sticker',
                'hover:translate-y-[-2px] hover:shadow-[6px_6px_0_hsl(var(--border))]',
                'active:translate-y-[2px] active:shadow-sticker-hover',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
                'transition-all duration-200'
              )}
            >
              {loading ? '⏳ Signing in...' : '🚀 Sign in'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-border" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-card text-muted-foreground font-medium">
                Or continue with
              </span>
            </div>
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogleLogin}
            className={cn(
              'w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-md',
              'bg-card text-foreground font-bold',
              'border-[3px] border-border',
              'shadow-sticker',
              'hover:translate-y-[-2px] hover:shadow-[6px_6px_0_hsl(var(--border))]',
              'active:translate-y-[2px] active:shadow-sticker-hover',
              'transition-all duration-200'
            )}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary hover:text-primary/80 font-bold">
              Sign up
            </Link>
          </p>

          <p className="text-xs text-center text-muted-foreground mt-6">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="text-primary font-bold hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-primary font-bold hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
