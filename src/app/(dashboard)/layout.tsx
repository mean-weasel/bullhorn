import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppHeader, FloatingActionButton } from './components/AppHeader'
import { BottomNav } from './components/BottomNav'
import { EmailVerificationBanner } from './components/EmailVerificationBanner'
import { VerificationSuccessBanner } from './components/VerificationSuccessBanner'
import { NativeInit } from './components/NativeInit'
import { PlanInitializer } from './components/PlanInitializer'
import { PostHogIdentify } from './components/PostHogIdentify'
import { AuthSyncProvider } from '@/components/ui/AuthSyncProvider'
import { Toaster } from 'react-hot-toast'

// eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let userId: string | undefined
  let userEmail: string | undefined
  let userDisplayName: string | null | undefined
  let isEmailVerified = true
  let isOAuthUser = false

  // Skip auth check in E2E test mode (requires CI=true + E2E_TEST_MODE=true + non-production)
  const isTestMode =
    process.env.E2E_TEST_MODE === 'true' &&
    process.env.CI === 'true' &&
    process.env.NODE_ENV !== 'production'
  if (!isTestMode) {
    const supabase = await createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session?.user) {
      redirect('/login')
    }

    const user = session.user
    userId = user.id
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
    <AuthSyncProvider>
      <div className="min-h-screen flex flex-col">
        <Toaster
          position="top-right"
          toastOptions={{
            className: 'border-2 border-border shadow-sticker-sm font-sans',
            duration: 4000,
          }}
        />
        <NativeInit />
        <PlanInitializer />
        {userId && <PostHogIdentify userId={userId} />}
        {/* Skip to content link for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-100 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:font-bold focus:border-[3px] focus:border-border focus:shadow-sticker-sm"
        >
          Skip to content
        </a>
        <AppHeader userEmail={userEmail} userDisplayName={userDisplayName} />

        {/* Email verification success banner - always rendered to catch ?verified=true */}
        <VerificationSuccessBanner />

        {/* Email verification banner - shown for unverified non-OAuth users */}
        {userEmail && !isEmailVerified && !isOAuthUser && (
          <EmailVerificationBanner email={userEmail} />
        )}

        {/* Main content - bottom padding for mobile nav */}
        <main id="main-content" className="flex-1 pb-20 md:pb-0">
          {children}
        </main>

        {/* FAB for new post - hidden on mobile (replaced by bottom nav) */}
        <FloatingActionButton />

        {/* Bottom navigation for mobile */}
        <BottomNav />
      </div>
    </AuthSyncProvider>
  )
}
