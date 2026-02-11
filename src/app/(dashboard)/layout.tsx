import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppHeader, FloatingActionButton } from './components/AppHeader'
import { BottomNav } from './components/BottomNav'
import { EmailVerificationBanner } from './components/EmailVerificationBanner'
import { VerificationSuccessBanner } from './components/VerificationSuccessBanner'
import { NativeInit } from './components/NativeInit'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let userEmail: string | undefined
  let userDisplayName: string | null | undefined
  let isEmailVerified = true
  let isOAuthUser = false

  // Skip auth check in E2E test mode
  if (process.env.E2E_TEST_MODE !== 'true') {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    userEmail = user.email
    isEmailVerified = !!user.email_confirmed_at
    isOAuthUser = user.app_metadata?.provider === 'google'

    // Fetch user profile for display name
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()

    userDisplayName = profile?.display_name
  }

  return (
    <div className="min-h-screen flex flex-col">
      <NativeInit />
      <AppHeader userEmail={userEmail} userDisplayName={userDisplayName} />

      {/* Email verification success banner - always rendered to catch ?verified=true */}
      <VerificationSuccessBanner />

      {/* Email verification banner - shown for unverified non-OAuth users */}
      {userEmail && !isEmailVerified && !isOAuthUser && (
        <EmailVerificationBanner email={userEmail} />
      )}

      {/* Main content - bottom padding for mobile nav */}
      <main className="flex-1 pb-20 md:pb-0">{children}</main>

      {/* FAB for new post - hidden on mobile (replaced by bottom nav) */}
      <FloatingActionButton />

      {/* Bottom navigation for mobile */}
      <BottomNav />
    </div>
  )
}
