import type { Metadata } from 'next'
import { Nunito } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Providers } from './providers'
import '../index.css'
import '@/lib/envValidation' // Validate env vars on startup
import { CookieConsent } from '@/components/ui/CookieConsent'
import { PostHogProvider } from '@/lib/posthog'

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-nunito',
})

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://bullhorn.to'

// eslint-disable-next-line react-refresh/only-export-components -- metadata export is required by Next.js App Router
export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Bullhorn — Social Media Post Scheduler',
    template: '%s | Bullhorn',
  },
  description:
    'Schedule and manage social media posts for Twitter, LinkedIn, and Reddit. Organize with campaigns and projects.',
  openGraph: {
    type: 'website',
    siteName: 'Bullhorn',
    title: 'Bullhorn — Social Media Post Scheduler',
    description:
      'Schedule and manage social media posts for Twitter, LinkedIn, and Reddit. Organize with campaigns and projects.',
    url: appUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Bullhorn — Social Media Post Scheduler',
    description: 'Schedule and manage social media posts for Twitter, LinkedIn, and Reddit.',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={nunito.variable} suppressHydrationWarning>
      <body className="font-sans">
        <PostHogProvider>
          <Providers>{children}</Providers>
        </PostHogProvider>
        <Analytics />
        <SpeedInsights />
        <CookieConsent />
      </body>
    </html>
  )
}
