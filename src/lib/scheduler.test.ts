import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('node-cron', () => ({
  default: { schedule: vi.fn() },
}))

import cron from 'node-cron'
import { startScheduler } from './scheduler'

describe('startScheduler', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    process.env.CRON_SECRET = 'test-secret'
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('registers two cron jobs', () => {
    startScheduler()
    expect(cron.schedule).toHaveBeenCalledTimes(2)
  })

  it('registers publish cron every 5 minutes', () => {
    startScheduler()
    const calls = vi.mocked(cron.schedule).mock.calls
    expect(calls[0][0]).toBe('*/5 * * * *')
  })

  it('registers token refresh cron every 5 minutes', () => {
    startScheduler()
    const calls = vi.mocked(cron.schedule).mock.calls
    expect(calls[1][0]).toBe('*/5 * * * *')
  })

  it('does not register cron jobs when CRON_SECRET is not set', () => {
    delete process.env.CRON_SECRET
    startScheduler()
    expect(cron.schedule).not.toHaveBeenCalled()
  })
})
