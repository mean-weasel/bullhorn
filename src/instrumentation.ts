export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }

  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.SELF_HOSTED === 'true') {
    try {
      const { startScheduler } = await import('./lib/scheduler')
      startScheduler()
    } catch (err) {
      console.error('[instrumentation] Failed to start scheduler:', err)
    }
  }
}

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key']

export async function onRequestError(
  err: { digest: string } & Error,
  request: {
    path: string
    method: string
    headers: { [key: string]: string }
  },
  context: { routerKind: string; routePath: string; routeType: string; renderSource: string }
) {
  // Scrub sensitive headers before sending to Sentry
  const sanitizedHeaders = { ...request.headers }
  for (const key of Object.keys(sanitizedHeaders)) {
    if (SENSITIVE_HEADERS.includes(key.toLowerCase())) {
      sanitizedHeaders[key] = '[Filtered]'
    }
  }

  const { captureRequestError } = await import('@sentry/nextjs')
  captureRequestError(err, { ...request, headers: sanitizedHeaders }, context)
}
