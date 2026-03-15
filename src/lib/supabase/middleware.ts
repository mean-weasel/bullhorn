import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit } from '@/lib/rateLimit'

// Parse allowed emails from environment variable (comma-separated)
function getAllowedEmails(): string[] | null {
  const allowedEmailsEnv = process.env.ALLOWED_EMAILS
  if (!allowedEmailsEnv) return null
  return allowedEmailsEnv.split(',').map((email) => email.trim().toLowerCase())
}

/**
 * Extract a client identifier for rate limiting.
 * Prefers x-forwarded-for or x-real-ip headers, falls back to 'unknown'.
 */
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return 'unknown'
}

async function handleApiRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname
  if (!pathname.startsWith('/api/') || pathname === '/api/health') return null

  const identifier = getClientIp(request)
  const result = await rateLimit(identifier)

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Too many requests', retryAfter },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    )
  }
  return null
}

function createSupabaseMiddlewareClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  return { supabase, getResponse: () => supabaseResponse }
}

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/auth',
  '/api',
  '/access-denied',
  '/docs',
]

export async function updateSession(request: NextRequest) {
  if (process.env.E2E_TEST_MODE === 'true') {
    return NextResponse.next({ request })
  }

  const pathname = request.nextUrl.pathname

  // Rate limit API routes
  const rateLimitResponse = await handleApiRateLimit(request)
  if (rateLimitResponse) return rateLimitResponse

  // API routes handle their own auth via requireAuth()
  if (pathname.startsWith('/api/')) {
    return NextResponse.next({ request })
  }

  const { supabase, getResponse } = createSupabaseMiddlewareClient(request)

  // Do not run code between createServerClient and supabase.auth.getUser().
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Check email allowlist
  const allowedEmails = getAllowedEmails()
  if (allowedEmails && user && pathname !== '/access-denied') {
    const userEmail = user.email?.toLowerCase()
    if (!userEmail || !allowedEmails.includes(userEmail)) {
      const url = request.nextUrl.clone()
      url.pathname = '/access-denied'
      return NextResponse.redirect(url)
    }
  }

  // Redirect unauthenticated users to login for protected routes
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname === '/'
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return getResponse()
}
