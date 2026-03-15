import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rateLimit'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const checkSchema = z.object({
  email: z.string().email(),
})

/**
 * POST /api/auth/pre-signup-check
 *
 * Called before signup to enforce:
 * 1. IP-based signup rate limit (max 2 signups per IP per 24 hours)
 * 2. Deleted account re-registration cooldown (30-day wait)
 *
 * Returns { allowed: true } or { allowed: false, reason: string }.
 */
export async function POST(request: NextRequest) {
  try {
    // IP-based signup rate limit (stricter than general API rate limit)
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'
    const rateLimitResult = await rateLimit(`signup:${ip}`)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { allowed: false, reason: 'Too many signup attempts. Please try again later.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => null)
    const parsed = checkSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ allowed: true })
    }

    const email = parsed.data.email.toLowerCase()

    // Check deleted account cooldown
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (supabaseUrl && serviceKey) {
      const supabase = createSupabaseJsClient(supabaseUrl, serviceKey, {
        global: {
          fetch: (url: string | URL | Request, options?: RequestInit) =>
            fetch(url, { ...options, cache: 'no-store' }),
        },
      })

      const { data } = await supabase
        .from('deleted_accounts')
        .select('can_reregister_at')
        .eq('email', email)
        .single()

      if (data && new Date(data.can_reregister_at) > new Date()) {
        const daysLeft = Math.ceil(
          (new Date(data.can_reregister_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
        return NextResponse.json(
          {
            allowed: false,
            reason: `This email was recently deleted. You can re-register in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
          },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({ allowed: true })
  } catch (error) {
    console.error('Pre-signup check error:', error)
    // Fail open — don't block signups if the check itself fails
    return NextResponse.json({ allowed: true })
  }
}
