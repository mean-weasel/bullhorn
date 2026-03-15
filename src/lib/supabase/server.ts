import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { getApiKeyFromHeaders } from '../auth'

// eslint-disable-next-line max-lines-per-function -- borderline, extraction would hurt readability
export async function createClient() {
  // In E2E test mode, use service role key to bypass RLS
  // SECURITY: Requires CI=true + E2E_TEST_MODE=true + non-production
  if (
    process.env.E2E_TEST_MODE === 'true' &&
    process.env.CI === 'true' &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NODE_ENV !== 'production'
  ) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[Supabase] E2E test mode active - RLS bypassed')
    }
    return createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        global: {
          fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
        },
      }
    )
  }

  // API key auth: use service role client since no session cookie exists.
  // This is safe because every API route filters by .eq('user_id', userId)
  // for application-level ownership enforcement.
  const apiKey = await getApiKeyFromHeaders()
  if (apiKey && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[supabase] Service role client via API key (prefix: ${apiKey.slice(0, 6)})`)
    }
    return createSupabaseJsClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        global: {
          fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }),
        },
      }
    )
  }

  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - cookies can only be modified in
            // a Server Action or Route Handler
          }
        },
      },
    }
  )
}
