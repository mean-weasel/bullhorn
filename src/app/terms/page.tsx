import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Bullhorn Terms of Service',
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-extrabold mb-2">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: February 25, 2026</p>

      <div className="space-y-8 text-muted-foreground">
        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Bullhorn, you agree to be bound by these Terms of Service. If you
            do not agree to these terms, do not use the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">2. Description of Service</h2>
          <p>
            Bullhorn is a social media post scheduling and organization tool. The service is
            currently in beta. The service is provided &quot;as is&quot; and may change as we
            continue development.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">3. User Accounts</h2>
          <p>
            You are responsible for maintaining the security of your account and password. One
            account per person. You are responsible for all activity that occurs under your account.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">4. User Content</h2>
          <p>
            You retain full ownership of content you create on Bullhorn. We store your content
            solely to provide the service. You are responsible for any content you publish via
            connected platforms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">5. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Use the service for spam or unsolicited messages</li>
            <li>Post illegal or harmful content</li>
            <li>Engage in automated abuse of the service</li>
            <li>Circumvent rate limits or other usage restrictions</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">6. Free and Pro Plans</h2>
          <p>
            The free tier is subject to resource limits including 50 posts, 5 campaigns, and 3
            projects. The Pro tier is subject to payment terms which will be announced separately.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">7. Service Availability</h2>
          <p>
            Bullhorn is currently a beta service. We do not guarantee uptime or availability. We may
            modify or discontinue features with reasonable notice.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">8. Data and Privacy</h2>
          <p>
            See our{' '}
            <Link href="/privacy" className="text-primary font-bold hover:underline">
              Privacy Policy
            </Link>{' '}
            for details on how we collect, use, and protect your data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">9. Limitation of Liability</h2>
          <p>
            The service is provided &quot;as is&quot; without warranties of any kind, express or
            implied. Bullhorn is not liable for any damages arising from your use of the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">10. Termination</h2>
          <p>
            Either party may terminate this agreement at any time. You can delete your account via
            Profile settings. We may suspend or terminate accounts that violate these terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">11. Changes to Terms</h2>
          <p>
            We may update these terms from time to time. Continued use of the service after changes
            constitutes acceptance of the updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-foreground mb-3">12. Contact</h2>
          <p>
            For questions about these terms, contact us at{' '}
            <a href="mailto:support@bullhorn.to" className="text-primary font-bold hover:underline">
              support@bullhorn.to
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  )
}
