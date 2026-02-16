import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Providers } from './providers'
import '../index.css'
import '@/lib/envValidation' // Validate env vars on startup

// eslint-disable-next-line react-refresh/only-export-components -- metadata export is required by Next.js App Router
export const metadata: Metadata = {
  metadataBase: new URL('https://bullhorn.to'),
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
    url: 'https://bullhorn.to',
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
