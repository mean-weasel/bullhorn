import cron from 'node-cron'

export function startScheduler(): void {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn('[scheduler] CRON_SECRET not set — internal cron disabled')
    return
  }

  const headers = { Authorization: `Bearer ${cronSecret}` }

  const jobs = [
    { path: '/api/cron/publish', label: 'Publish' },
    { path: '/api/cron/refresh-tokens', label: 'Token refresh' },
  ]

  for (const { path, label } of jobs) {
    cron.schedule('*/5 * * * *', async () => {
      try {
        const res = await fetch(`${baseUrl}${path}`, { headers })
        if (!res.ok) {
          const body = await res.text().catch(() => '')
          console.error(`[scheduler] ${label} cron failed: ${res.status}`, body)
        }
      } catch (err) {
        console.error(`[scheduler] ${label} cron error:`, err)
      }
    })
  }

  console.log('[scheduler] Internal cron started (publish + token refresh every 5 min)')
}
