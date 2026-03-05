# Social Scheduler Roadmap

Detailed implementation plans for upcoming features and enhancements.

---

## 1. Password Reset Flow

### Overview
Allow users to reset their password via email when they forget it.

### Implementation Steps

1. **Create forgot password page** (`/forgot-password`)
   - Email input form
   - "Send reset link" button
   - Success message: "Check your email for reset instructions"
   - Link back to login

2. **Create password reset page** (`/reset-password`)
   - New password input
   - Confirm password input
   - Password strength indicator (optional)
   - Submit button
   - Handle token from URL query params

3. **Supabase configuration**
   - Configure email templates in Supabase Dashboard > Authentication > Email Templates
   - Customize "Reset Password" template with branding
   - Set redirect URL to `/reset-password`

4. **Implementation code**
   ```typescript
   // Forgot password - send reset email
   await supabase.auth.resetPasswordForEmail(email, {
     redirectTo: `${window.location.origin}/reset-password`,
   })

   // Reset password page - update password
   await supabase.auth.updateUser({ password: newPassword })
   ```

5. **Add E2E tests**
   - Test forgot password form validation
   - Test reset password form validation
   - Test navigation flows

### Files to Create/Modify
- `src/app/(auth)/forgot-password/page.tsx` (new)
- `src/app/(auth)/reset-password/page.tsx` (new)
- `src/app/(auth)/login/page.tsx` (add "Forgot password?" link)
- `e2e/auth.spec.ts` (add tests)

---

## 2. Google OAuth Production Setup

### Overview
Configure Google OAuth for production use (currently only works in development).

### Implementation Steps

1. **Google Cloud Console Setup**
   - Go to https://console.cloud.google.com
   - Create new project or select existing
   - Enable "Google+ API" and "Google Identity"
   - Navigate to "APIs & Services" > "Credentials"

2. **Create OAuth 2.0 Client ID**
   - Application type: Web application
   - Name: "Social Scheduler"
   - Authorized JavaScript origins:
     - `https://your-app.vercel.app`
     - `http://localhost:3000` (for dev)
   - Authorized redirect URIs:
     - `https://your-project.supabase.co/auth/v1/callback`
     - `http://127.0.0.1:54321/auth/v1/callback` (for local dev)

3. **Configure Supabase**
   - Go to Supabase Dashboard > Authentication > Providers
   - Enable Google provider
   - Enter Client ID and Client Secret from Google Cloud Console

4. **Configure OAuth Consent Screen**
   - App name: "Social Scheduler"
   - User support email: your email
   - App logo (optional)
   - App domain: `your-app.vercel.app`
   - Authorized domains: `vercel.app`, `supabase.co`
   - Developer contact email

5. **Test and verify**
   - Test login flow on production
   - Verify callback redirects correctly
   - Check user appears in Supabase Auth users

### Security Considerations
- Never commit Client Secret to version control
- Store credentials only in Supabase Dashboard
- Request minimum necessary scopes (email, profile)

---

## 3. User Profile / Account Settings

### Overview
Allow users to view and manage their account settings.

### Implementation Steps

1. **Create settings page** (`/settings`)
   - Profile section:
     - Display email (read-only)
     - Display name field
     - Avatar upload (optional)
   - Password section:
     - Current password
     - New password
     - Confirm new password
   - Preferences section:
     - Theme toggle (light/dark/system)
     - Default platform preference
   - Danger zone:
     - Delete account button (with confirmation)

2. **Database schema** (if needed)
   ```sql
   -- Optional: user_profiles table for extended data
   CREATE TABLE user_profiles (
     id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     display_name TEXT,
     avatar_url TEXT,
     preferences JSONB DEFAULT '{}',
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- RLS policy
   ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Users can manage own profile"
     ON user_profiles FOR ALL
     USING (auth.uid() = id);
   ```

3. **API routes**
   - `GET /api/user/profile` - Get current user profile
   - `PATCH /api/user/profile` - Update profile
   - `DELETE /api/user` - Delete account

4. **Implementation code**
   ```typescript
   // Update password
   await supabase.auth.updateUser({ password: newPassword })

   // Update profile
   await supabase.from('user_profiles').upsert({
     id: user.id,
     display_name: name,
     preferences: { theme, defaultPlatform }
   })

   // Delete account (requires edge function for full cleanup)
   ```

5. **Add navigation**
   - Add settings link to header/sidebar
   - Add user menu dropdown with settings option

### Files to Create/Modify
- `src/app/(dashboard)/settings/page.tsx` (new or enhance existing)
- `src/app/api/user/profile/route.ts` (new)
- `supabase/migrations/xxx_user_profiles.sql` (new)
- `src/components/layout/Header.tsx` (add user menu)

---

## 4. Email Notification Preferences

### Overview
Allow users to configure email notifications for their scheduled posts.

### Implementation Steps

1. **Notification types**
   - Post published successfully
   - Post failed to publish
   - Scheduled post reminder (X hours before)
   - Weekly summary digest

2. **Database schema**
   ```sql
   -- Add to user_profiles or create separate table
   ALTER TABLE user_profiles ADD COLUMN notification_settings JSONB DEFAULT '{
     "post_published": true,
     "post_failed": true,
     "reminder_hours": 24,
     "weekly_digest": false
   }';
   ```

3. **Settings UI**
   - Toggle switches for each notification type
   - Dropdown for reminder timing
   - Save button with optimistic updates

4. **Email service integration**
   - Use Supabase Edge Functions for sending
   - Or integrate with Resend/SendGrid/Postmark
   - Create email templates for each notification type

5. **Background job for reminders**
   - Supabase Edge Function with cron trigger
   - Query upcoming scheduled posts
   - Send reminder emails to opted-in users

### Files to Create/Modify
- `src/app/(dashboard)/settings/page.tsx` (add notifications section)
- `supabase/functions/send-notification/index.ts` (new)
- `supabase/functions/scheduled-reminders/index.ts` (new)

---

## 5. Multi-User Support with RLS

### Overview
Ensure proper data isolation between users with Row Level Security.

### Current State
- Posts have `user_id` column
- RLS policies may need review

### Implementation Steps

1. **Audit current RLS policies**
   ```sql
   -- Check existing policies
   SELECT * FROM pg_policies WHERE tablename = 'posts';
   SELECT * FROM pg_policies WHERE tablename = 'campaigns';
   SELECT * FROM pg_policies WHERE tablename = 'blog_drafts';
   ```

2. **Ensure all tables have user_id**
   - `posts` - has user_id ✓
   - `campaigns` - verify user_id
   - `blog_drafts` - verify user_id
   - `media` - verify user_id

3. **Create/update RLS policies**
   ```sql
   -- Posts
   ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can view own posts"
     ON posts FOR SELECT
     USING (auth.uid() = user_id);

   CREATE POLICY "Users can create posts"
     ON posts FOR INSERT
     WITH CHECK (auth.uid() = user_id);

   CREATE POLICY "Users can update own posts"
     ON posts FOR UPDATE
     USING (auth.uid() = user_id);

   CREATE POLICY "Users can delete own posts"
     ON posts FOR DELETE
     USING (auth.uid() = user_id);

   -- Similar for campaigns, blog_drafts, media
   ```

4. **Update API routes**
   - Remove manual user_id filtering (RLS handles it)
   - Ensure createClient() uses user session
   - Test with multiple user accounts

5. **Test multi-user isolation**
   - Create test accounts
   - Verify users can only see their own data
   - Test edge cases (shared campaigns, etc.)

### Files to Modify
- `supabase/migrations/xxx_rls_policies.sql` (new)
- `src/app/api/**/route.ts` (review all API routes)

---

## 6. Custom Domain Setup

### Overview
Configure a custom domain for the production deployment.

### Implementation Steps

1. **Purchase/configure domain**
   - Register domain (if not owned)
   - Access DNS settings

2. **Vercel domain configuration**
   - Go to Vercel Dashboard > Project > Settings > Domains
   - Add custom domain (e.g., `app.yourdomain.com`)
   - Follow Vercel's DNS configuration instructions

3. **DNS records**
   - For apex domain: A record pointing to Vercel
   - For subdomain: CNAME record to `cname.vercel-dns.com`

4. **SSL certificate**
   - Vercel auto-provisions SSL
   - Verify HTTPS works

5. **Update OAuth redirects**
   - Update Google OAuth authorized origins
   - Update Supabase site URL
   - Update email templates with new domain

---

## 7. Analytics & Monitoring

### Overview
Add analytics and error monitoring for production insights.

### Implementation Steps

1. **Vercel Analytics**
   - Enable in Vercel Dashboard > Project > Analytics
   - Install package: `npm install @vercel/analytics`
   - Add to layout:
     ```tsx
     import { Analytics } from '@vercel/analytics/react'

     export default function RootLayout({ children }) {
       return (
         <html>
           <body>
             {children}
             <Analytics />
           </body>
         </html>
       )
     }
     ```

2. **Vercel Speed Insights**
   - Install: `npm install @vercel/speed-insights`
   - Add to layout:
     ```tsx
     import { SpeedInsights } from '@vercel/speed-insights/next'

     // Add alongside Analytics
     <SpeedInsights />
     ```

3. **Error monitoring (Sentry)**
   - Create Sentry project
   - Install: `npm install @sentry/nextjs`
   - Run wizard: `npx @sentry/wizard@latest -i nextjs`
   - Configure DSN in environment variables

4. **Custom event tracking** (optional)
   - Track post creation
   - Track publishing events
   - Track feature usage

### Files to Create/Modify
- `src/app/layout.tsx` (add Analytics, SpeedInsights)
- `sentry.client.config.ts` (new)
- `sentry.server.config.ts` (new)
- `next.config.js` (Sentry webpack config)

---

## 8. Rate Limiting

### Overview
Protect API routes from abuse with rate limiting.

### Implementation Steps

1. **Choose approach**
   - Option A: Vercel Edge Config + KV
   - Option B: Upstash Redis rate limiting
   - Option C: Simple in-memory (not recommended for production)

2. **Upstash implementation** (recommended)
   ```bash
   npm install @upstash/ratelimit @upstash/redis
   ```

   ```typescript
   // src/lib/ratelimit.ts
   import { Ratelimit } from '@upstash/ratelimit'
   import { Redis } from '@upstash/redis'

   export const ratelimit = new Ratelimit({
     redis: Redis.fromEnv(),
     limiter: Ratelimit.slidingWindow(10, '10 s'),
     analytics: true,
   })
   ```

3. **Apply to API routes**
   ```typescript
   // In API route
   import { ratelimit } from '@/lib/ratelimit'

   export async function POST(request: Request) {
     const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1'
     const { success } = await ratelimit.limit(ip)

     if (!success) {
       return Response.json({ error: 'Too many requests' }, { status: 429 })
     }

     // Continue with request handling
   }
   ```

4. **Configure limits per route**
   - Auth routes: 5 requests / minute
   - Post creation: 10 requests / minute
   - Read operations: 100 requests / minute

### Files to Create/Modify
- `src/lib/ratelimit.ts` (new)
- `src/app/api/**/route.ts` (add rate limiting)
- `.env.local` (add Upstash credentials)

---

## Priority Order

1. ✅ **Password Reset Flow** - Essential for user experience
2. ✅ **Google OAuth Production** - Complete the auth story
3. ✅ **Multi-User RLS** - Security critical (PR #55)
4. ✅ **User Profile/Settings** - User management
5. ✅ **Analytics & Monitoring** - Production visibility (Vercel Analytics + Speed Insights)
6. ✅ **Custom Domain** - bullhorn.to configured (Cloudflare DNS + Vercel)
7. **Rate Limiting** - Security hardening
8. **Email Notifications** - Nice to have

---

## Notes

- Each feature should include E2E tests
- Update documentation as features are added
- Consider feature flags for gradual rollout
- Review security implications for each feature
