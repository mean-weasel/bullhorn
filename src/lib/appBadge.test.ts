import { describe, it, expect, vi, beforeEach } from 'vitest'
import { calculateBadgeCount, setBadgeCount, clearBadge } from './appBadge'

vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

describe('appBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('calculateBadgeCount', () => {
    const today = new Date()
    const todayISO = today.toISOString()
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()

    it('returns 0 for empty arrays', () => {
      expect(calculateBadgeCount([], [])).toBe(0)
    })

    it('counts reminders due today', () => {
      const reminders = [
        { isCompleted: false, remindAt: todayISO },
        { isCompleted: true, remindAt: todayISO },
        { isCompleted: false, remindAt: tomorrow },
      ]
      expect(calculateBadgeCount(reminders, [])).toBe(1)
    })

    it('counts posts scheduled for today', () => {
      const posts = [
        { status: 'scheduled', scheduledAt: todayISO },
        { status: 'draft', scheduledAt: todayISO },
        { status: 'scheduled', scheduledAt: tomorrow },
      ]
      expect(calculateBadgeCount([], posts)).toBe(1)
    })

    it('combines reminders and posts', () => {
      const reminders = [{ isCompleted: false, remindAt: todayISO }]
      const posts = [{ status: 'scheduled', scheduledAt: todayISO }]
      expect(calculateBadgeCount(reminders, posts)).toBe(2)
    })

    it('excludes past dates', () => {
      const reminders = [{ isCompleted: false, remindAt: yesterday }]
      const posts = [{ status: 'scheduled', scheduledAt: yesterday }]
      expect(calculateBadgeCount(reminders, posts)).toBe(0)
    })
  })

  describe('setBadgeCount', () => {
    it('is a no-op on web', async () => {
      await expect(setBadgeCount(5)).resolves.toBeUndefined()
    })
  })

  describe('clearBadge', () => {
    it('is a no-op on web', async () => {
      await expect(clearBadge()).resolves.toBeUndefined()
    })
  })
})
