import * as Sentry from '@sentry/nextjs'

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key']

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Error capture only — no performance tracing
  tracesSampleRate: 0,

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
