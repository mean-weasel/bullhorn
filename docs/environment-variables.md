# Environment Variables

This document lists all environment variables used by Bullhorn, their purpose, and whether they're required or optional.

## Required Variables

These must be set for the application to function:

### Supabase

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Purpose**: Database and authentication
**Where to get**: Supabase project settings → API
**Impact if missing**: Application will not start

---

## Recommended Variables

These are optional but enable important features:

### Rate Limiting (Upstash Redis)

```bash
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

**Purpose**: API rate limiting (10 requests per 10 seconds per IP)
**Where to get**: https://console.upstash.com/ → Create Redis instance → REST API
**Impact if missing**:
- ⚠️ **Rate limiting is disabled** - application is vulnerable to abuse
- Requests will be allowed through without limits
- Warning logged on every request: `[rateLimit] Upstash Redis is not configured`

**Free tier**: 10,000 requests/day (sufficient for most use cases)

**How to set up**:
1. Create free Upstash account at https://console.upstash.com/
2. Create a new Redis database (select any region)
3. Copy the REST URL and token from the database details page
4. Add to Vercel environment variables or `.env.local`
5. Redeploy

---

### Error Monitoring (Sentry)

```bash
NEXT_PUBLIC_SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
SENTRY_AUTH_TOKEN=your-auth-token  # Optional: enables source map uploads
```

**Purpose**: Error tracking and monitoring in production
**Where to get**: https://sentry.io/ → Project Settings → Client Keys (DSN)
**Impact if missing**:
- Error monitoring is disabled — errors only logged to console
- Application functions normally

**How to set up**:
1. Create free Sentry account at https://sentry.io/
2. Create a new Next.js project
3. Copy the DSN from Project Settings → Client Keys
4. Add `NEXT_PUBLIC_SENTRY_DSN` to Vercel environment variables
5. (Optional) Create auth token at Settings → Auth Tokens for source map uploads
6. Redeploy

---

### Web Push Notifications

```bash
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
```

**Purpose**: Browser push notifications when scheduled posts become ready
**Where to get**: Generate with `npx tsx scripts/generate-vapid-keys.ts`
**Impact if missing**: Push notifications disabled — users must check the app manually

**How to set up**:
1. Run `npx tsx scripts/generate-vapid-keys.ts` to generate a key pair
2. Add both keys to Vercel environment variables
3. `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is used client-side for push subscription
4. `VAPID_PRIVATE_KEY` is server-side only (never expose to client)
5. Redeploy

---

### Native iOS Push Notifications (APNs)

```bash
APNS_KEY_ID=your-10-character-key-id
APNS_AUTH_KEY=base64-encoded-p8-key-contents
APNS_ENVIRONMENT=production
```

**Purpose**: Native push notifications to iOS devices via Apple Push Notification service
**Where to get**: Apple Developer portal → Certificates, Identifiers & Profiles → Keys
**Impact if missing**: Native iOS push notifications disabled — iOS users rely on web push or email

**How to set up**:
1. Sign in to https://developer.apple.com/account/resources/authkeys/list
2. Create a new key with **Apple Push Notifications service (APNs)** enabled
3. Download the `.p8` file (one-time download)
4. Note the **Key ID** (10 characters) shown on the key page
5. Base64-encode the `.p8` file: `base64 -i AuthKey_XXXXXXXX.p8 | tr -d '\n'`
6. Add `APNS_KEY_ID`, `APNS_AUTH_KEY`, and `APNS_ENVIRONMENT=production` to Vercel
7. Redeploy

**Note**: `APNS_TEAM_ID` must be set via the environment variable. TestFlight builds use the **production** APNs endpoint, not sandbox.

---

### Email Notifications (Resend)

```bash
RESEND_API_KEY=re_your-api-key
RESEND_FROM_EMAIL=Bullhorn <notifications@bullhorn.to>  # Optional, has default
```

**Purpose**: Email notifications when scheduled posts become ready
**Where to get**: https://resend.com/api-keys
**Impact if missing**: Email notifications disabled — users rely on push or manual checking

**How to set up**:
1. Create free Resend account at https://resend.com/
2. Configure sending domain `bullhorn.to` (add SPF + DKIM DNS records)
3. Create an API key at https://resend.com/api-keys
4. Add `RESEND_API_KEY` to Vercel environment variables
5. Optionally set `RESEND_FROM_EMAIL` to customize the sender
6. Redeploy

---

## Optional Variables

### Google OAuth (iOS/Mobile)

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID_IOS=your-ios-client-id
NEXT_PUBLIC_GOOGLE_CLIENT_ID_WEB=your-web-client-id
```

**Purpose**: Google sign-in for iOS and web platforms
**Where to get**: Google Cloud Console → APIs & Services → Credentials
**Impact if missing**: Google OAuth will not work

---

## Vercel-Specific Variables

These are automatically set by Vercel:

```bash
VERCEL_URL              # Auto-set: Current deployment URL
VERCEL_ENV              # Auto-set: production | preview | development
NEXT_PUBLIC_VERCEL_ENV  # Auto-set: Same as VERCEL_ENV
```

---

## Setting Environment Variables

### Local Development

Create `.env.local` in the project root:

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Recommended
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

### Vercel Production

1. Go to Vercel project settings
2. Navigate to "Environment Variables"
3. Add each variable with appropriate scope (Production, Preview, Development)
4. Redeploy for changes to take effect

---

## Validation on Startup

The application validates environment variables on startup in production. You'll see:

**✅ All configured:**
```
[envValidation] ✅ All environment variables configured
```

**⚠️ Missing recommended:**
```
[envValidation] ⚠️  Missing recommended environment variables:
  - UPSTASH_REDIS_REST_URL: Upstash Redis URL for rate limiting
  - UPSTASH_REDIS_REST_TOKEN: Upstash Redis token for rate limiting
[envValidation] ⚠️  Some features may be degraded. See docs for configuration.
```

**❌ Missing required:**
```
[envValidation] ❌ Missing required environment variables:
  - NEXT_PUBLIC_SUPABASE_URL: Supabase project URL
Error: Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL
```

---

## Security Best Practices

1. **Never commit `.env.local`** - it's in `.gitignore` for a reason
2. **Rotate keys regularly** - especially service role keys
3. **Use different keys for dev/prod** - separate Supabase projects recommended
4. **Restrict CORS origins** - configure in Supabase dashboard
5. **Enable RLS policies** - never expose service role key to client

---

## Troubleshooting

### "Rate limiting is disabled" warnings in production

**Cause**: `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` not set
**Solution**: Configure Upstash Redis (see above)
**Impact**: Application works but rate limiting is disabled

### Application shows only skeleton loaders

**Possible causes**:
1. ~~Rate limiting denying all requests~~ (fixed in PR #108)
2. Vercel Authentication enabled - disable in Deployment Protection settings
3. API routes returning 401/403 - check Supabase RLS policies
4. Network/CORS issues - check browser console for details

### 401 Unauthorized errors

**Cause**: Supabase keys incorrect or RLS policies blocking access
**Solution**:
1. Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` matches Supabase dashboard
2. Check RLS policies allow authenticated users
3. Ensure user is signed in (check browser console for auth state)
