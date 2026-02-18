import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  reminderIdToNotificationId,
  scheduleLocalNotification,
  cancelLocalNotification,
  cancelAllLocalNotifications,
} from './localNotifications'

vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

describe('localNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('reminderIdToNotificationId', () => {
    it('returns a stable number for the same UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000'
      const id1 = reminderIdToNotificationId(uuid)
      const id2 = reminderIdToNotificationId(uuid)
      expect(id1).toBe(id2)
      expect(typeof id1).toBe('number')
    })

    it('returns different numbers for different UUIDs', () => {
      const uuid1 = '550e8400-e29b-41d4-a716-446655440000'
      const uuid2 = '550e8400-e29b-41d4-a716-446655440001'
      expect(reminderIdToNotificationId(uuid1)).not.toBe(reminderIdToNotificationId(uuid2))
    })

    it('returns a non-negative number', () => {
      const uuid = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
      expect(reminderIdToNotificationId(uuid)).toBeGreaterThanOrEqual(0)
    })
  })

  describe('scheduleLocalNotification', () => {
    it('is a no-op on web', async () => {
      await expect(
        scheduleLocalNotification('test-id', 'Title', 'Body', new Date())
      ).resolves.toBeUndefined()
    })
  })

  describe('cancelLocalNotification', () => {
    it('is a no-op on web', async () => {
      await expect(cancelLocalNotification('test-id')).resolves.toBeUndefined()
    })
  })

  describe('cancelAllLocalNotifications', () => {
    it('is a no-op on web', async () => {
      await expect(cancelAllLocalNotifications()).resolves.toBeUndefined()
    })
  })
})
