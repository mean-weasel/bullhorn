'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// eslint-disable-next-line max-lines-per-function -- borderline, extraction would hurt readability
export default function AccessDeniedPage() {
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Decorative gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-1 gradient-bar" />
      </div>

      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-card rounded-lg border-[3px] border-border shadow-[6px_6px_0_hsl(var(--border))] p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-lg bg-destructive/10 flex items-center justify-center border-[3px] border-border shadow-sticker text-4xl">
            🔒
          </div>

          {/* Header */}
          <h1 className="text-2xl font-extrabold text-foreground mb-2">Access Restricted</h1>
          <p className="text-muted-foreground mb-6">
            This environment is currently in private beta and restricted to authorized users only.
          </p>

          {/* Message */}
          <div className="bg-muted/50 rounded-md border-2 border-border p-4 mb-6">
            <p className="text-sm text-muted-foreground">
              If you believe you should have access, please contact the administrator.
            </p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-3 rounded-md font-bold text-sm transition-all bg-primary text-primary-foreground border-[3px] border-border shadow-sticker-sm hover:translate-y-[-2px] hover:shadow-[5px_5px_0_hsl(var(--border))]"
            >
              Sign Out & Try Different Account
            </button>
            <Link
              href="/"
              className="block w-full px-4 py-3 rounded-md font-bold text-sm transition-all bg-card text-foreground border-[3px] border-border shadow-sticker-sm hover:translate-y-[-2px] hover:shadow-[5px_5px_0_hsl(var(--border))]"
            >
              Go to Home
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-6">Bullhorn Private Beta</p>
      </div>
    </div>
  )
}
