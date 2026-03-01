/**
 * Environment variable validation
 * Checks for required and recommended env vars on startup
 */

interface EnvCheck {
  name: string
  required: boolean
  description: string
}

const ENV_CHECKS: EnvCheck[] = [
  // Required (app won't work without these)
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key (server-side)',
  },

  // Recommended (app works but features are degraded)
  {
    name: 'CRON_SECRET',
    required: false,
    description: 'Bearer token for cron endpoint authentication',
  },
  {
    name: 'UPSTASH_REDIS_REST_URL',
    required: false,
    description: 'Upstash Redis URL for rate limiting',
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    required: false,
    description: 'Upstash Redis token for rate limiting',
  },
  {
    name: 'NEXT_PUBLIC_SENTRY_DSN',
    required: false,
    description: 'Sentry DSN for error monitoring',
  },

  // Platform OAuth (optional - platform features disabled without these)
  {
    name: 'TWITTER_CLIENT_ID',
    required: false,
    description: 'Twitter/X OAuth client ID for posting',
  },
  {
    name: 'LINKEDIN_CLIENT_ID',
    required: false,
    description: 'LinkedIn OAuth client ID for posting',
  },
  {
    name: 'REDDIT_CLIENT_ID',
    required: false,
    description: 'Reddit OAuth client ID for posting',
  },
]

/**
 * Validate environment variables on startup
 * Throws error for missing required vars, warns for missing recommended vars
 */
export function validateEnv(): void {
  const missing: { name: string; description: string; required: boolean }[] = []

  for (const check of ENV_CHECKS) {
    const value = process.env[check.name]
    if (!value || value === '') {
      missing.push({
        name: check.name,
        description: check.description,
        required: check.required,
      })
    }
  }

  if (missing.length === 0) {
    console.log('[envValidation] ✅ All environment variables configured')
    return
  }

  const requiredMissing = missing.filter((m) => m.required)
  const recommendedMissing = missing.filter((m) => !m.required)

  // Error for required vars
  if (requiredMissing.length > 0) {
    console.error('[envValidation] ❌ Missing required environment variables:')
    requiredMissing.forEach((m) => {
      console.error(`  - ${m.name}: ${m.description}`)
    })
    throw new Error(
      `Missing required environment variables: ${requiredMissing.map((m) => m.name).join(', ')}`
    )
  }

  // Warn for recommended vars
  if (recommendedMissing.length > 0) {
    console.warn('[envValidation] ⚠️  Missing recommended environment variables:')
    recommendedMissing.forEach((m) => {
      console.warn(`  - ${m.name}: ${m.description}`)
    })
    console.warn('[envValidation] ⚠️  Some features may be degraded. See docs for configuration.')
  }
}

// Run validation on module load in non-development environments
if (process.env.NODE_ENV !== 'development') {
  validateEnv()
}
