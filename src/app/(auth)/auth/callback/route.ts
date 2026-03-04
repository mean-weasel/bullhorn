import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function sanitizeRedirectPath(path: string): string {
  // Must start with / and not contain protocol or double slashes (open redirect)
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
    return '/dashboard'
  }
  return path
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = sanitizeRedirectPath(searchParams.get('next') ?? '/dashboard')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check if user just verified their email (within last minute)
      const {
        data: { user },
      } = await supabase.auth.getUser()
      const wasJustVerified =
        user?.email_confirmed_at && Date.now() - new Date(user.email_confirmed_at).getTime() < 60000

      // Redirect to dashboard with verified flag if email was just confirmed
      if (wasJustVerified) {
        return NextResponse.redirect(`${origin}/dashboard?verified=true`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Return to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
