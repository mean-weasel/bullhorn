import type { Metadata } from 'next'

// eslint-disable-next-line react-refresh/only-export-components -- Next.js metadata export
export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Bullhorn Privacy Policy',
}

// eslint-disable-next-line max-lines-per-function
export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: February 25, 2026</p>

      <div className="space-y-8 text-muted-foreground">
        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">1. Information We Collect</h2>
          <p className="mb-3">We collect the following types of information:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong className="text-foreground">Account data:</strong> Email address and display
              name, provided via Google OAuth or email signup.
            </li>
            <li>
              <strong className="text-foreground">Content data:</strong> Posts, campaigns, projects,
              blog drafts, launch posts, and media uploads you create.
            </li>
            <li>
              <strong className="text-foreground">Usage data:</strong> Vercel Analytics collects
              anonymous page views and web vitals. No personally identifiable information is
              included.
            </li>
            <li>
              <strong className="text-foreground">Error data:</strong> Sentry captures JavaScript
              errors with stack traces to help us fix bugs. No personally identifiable information
              is included.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">2. How We Use Your Data</h2>
          <p>
            We use your data solely to provide and improve the Bullhorn service. We do not sell user
            data. We do not use your data for advertising.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">3. Third-Party Services</h2>
          <p className="mb-3">We use the following third-party services:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong className="text-foreground">Supabase</strong> — Database, authentication, and
              file storage (US region)
            </li>
            <li>
              <strong className="text-foreground">Vercel</strong> — Hosting and anonymous analytics
              (global CDN)
            </li>
            <li>
              <strong className="text-foreground">Sentry</strong> — Error monitoring (US region)
            </li>
            <li>
              <strong className="text-foreground">Google</strong> — OAuth authentication only
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">4. Cookies</h2>
          <p>
            We use authentication cookies to maintain your Supabase session and analytics cookies
            for Vercel Analytics. We do not use third-party tracking cookies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">5. Data Retention</h2>
          <p>
            Your data is retained while your account is active. When you delete data, it is
            permanently removed within 30 days. Backups containing deleted data are purged within 90
            days.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">6. Your Rights</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>
              <strong className="text-foreground">Access:</strong> View all your data directly in
              the app.
            </li>
            <li>
              <strong className="text-foreground">Export:</strong> Download all your data via
              Settings &gt; Data Management (JSON/CSV).
            </li>
            <li>
              <strong className="text-foreground">Deletion:</strong> Delete your account via Profile
              &gt; Danger Zone. This cascades to all associated data.
            </li>
            <li>
              <strong className="text-foreground">Correction:</strong> Edit your profile and content
              at any time.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">7. Data Security</h2>
          <p>
            All data is encrypted in transit using TLS. We enforce row-level security on all
            database tables. OAuth tokens are stored server-side.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">8. Children</h2>
          <p>
            Bullhorn is not intended for users under the age of 13. We do not knowingly collect
            information from children.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">9. Changes</h2>
          <p>
            We may update this privacy policy from time to time. We will notify you via email for
            material changes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">10. Contact</h2>
          <p>
            For privacy-related questions, contact us at{' '}
            <a href="mailto:privacy@bullhorn.to" className="text-primary font-bold hover:underline">
              privacy@bullhorn.to
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
