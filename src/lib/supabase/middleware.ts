import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Parse allowed emails from environment variable (comma-separated)
function getAllowedEmails(): string[] | null {
  const allowedEmailsEnv = process.env.ALLOWED_EMAILS
  if (!allowedEmailsEnv) return null
  return allowedEmailsEnv.split(',').map(email => email.trim().toLowerCase())
}

export async function updateSession(request: NextRequest) {
  // Skip auth in E2E test mode
  if (process.env.E2E_TEST_MODE === 'true') {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check if access is restricted to specific emails
  const allowedEmails = getAllowedEmails()
  const isAccessDeniedPage = request.nextUrl.pathname === '/access-denied'

  if (allowedEmails && user && !isAccessDeniedPage) {
    const userEmail = user.email?.toLowerCase()
    if (!userEmail || !allowedEmails.includes(userEmail)) {
      const url = request.nextUrl.clone()
      url.pathname = '/access-denied'
      return NextResponse.redirect(url)
    }
  }

  // Redirect to login if not authenticated and trying to access protected routes
  // API routes handle their own auth via Supabase RLS
  const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth', '/api', '/access-denied']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path)) ||
    request.nextUrl.pathname === '/'

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
