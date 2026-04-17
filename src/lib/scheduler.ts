import cron from 'node-cron'

export function startScheduler(): void {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[scheduler] CRON_SECRET not set — internal cron disabled')
    return
  }

  const headers = { Authorization: `Bearer ${cronSecret}` }

  // Publish scheduled posts every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const res = await fetch(`${baseUrl}/api/cron/publish`, { headers })
      if (!res.ok) console.error('[scheduler] Publish cron failed:', res.status)
    } catch (err) {
      console.error('[scheduler] Publish cron error:', err)
    }
  })

  // Refresh expiring tokens every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const res = await fetch(`${baseUrl}/api/cron/refresh-tokens`, { headers })
      if (!res.ok) console.error('[scheduler] Token refresh cron failed:', res.status)
    } catch (err) {
      console.error('[scheduler] Token refresh cron error:', err)
    }
  })

  console.log('[scheduler] Internal cron started (publish + token refresh every 5 min)')
}
