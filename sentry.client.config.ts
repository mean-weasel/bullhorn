import * as Sentry from '@sentry/nextjs'

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key']

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance tracing at 10%, error replays at 50%
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0.5,

  // Filter noisy errors
  ignoreErrors: [
    'ResizeObserver loop',
    'Network request failed',
    'Load failed',
    'Failed to fetch',
    'AbortError',
  ],

  beforeSend(event) {
    if (event.request?.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
          event.request.headers[key] = '[Filtered]'
        }
      }
    }
    return event
  },
})
