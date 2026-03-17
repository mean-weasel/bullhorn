import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LandingPage } from './landing-page'

// eslint-disable-next-line react-refresh/only-export-components -- metadata export is required by Next.js App Router
export const metadata: Metadata = {
  title: 'Bullhorn — Social Media Post Scheduler',
  description:
    'Free social media scheduler for Twitter, LinkedIn, and Reddit. Schedule posts, organize campaigns, and capture ideas from AI tools. Built for developers and indie hackers.',
}

export default async function Home() {
  // Skip auth check in E2E test mode (requires CI=true + E2E_TEST_MODE=true + non-production)
  const isTestMode =
    process.env.E2E_TEST_MODE === 'true' &&
    process.env.CI === 'true' &&
    process.env.NODE_ENV !== 'production'
  if (isTestMode) {
    redirect('/dashboard')
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return <LandingPage />
}
