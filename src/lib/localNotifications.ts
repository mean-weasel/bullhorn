import { isNativePlatform } from './capacitor'

/**
 * Hash a UUID string to a stable 32-bit integer for use as a notification ID.
 * The Capacitor LocalNotifications plugin requires numeric IDs.
 */
export function reminderIdToNotificationId(uuid: string): number {
  let hash = 0
  for (let i = 0; i < uuid.length; i++) {
    const char = uuid.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0 // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

export async function scheduleLocalNotification(
  id: string,
  title: string,
  body: string,
  scheduleAt: Date,
  extra?: Record<string, string>
): Promise<void> {
  if (!isNativePlatform()) return

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const permission = await LocalNotifications.requestPermissions()
    if (permission.display !== 'granted') return

    await LocalNotifications.schedule({
      notifications: [
        {
          id: reminderIdToNotificationId(id),
          title,
          body,
          schedule: { at: scheduleAt },
          extra: extra || {},
        },
      ],
    })
  } catch (err) {
    console.error('[LocalNotifications] Failed to schedule:', err)
  }
}

export async function cancelLocalNotification(id: string): Promise<void> {
  if (!isNativePlatform()) return

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({
      notifications: [{ id: reminderIdToNotificationId(id) }],
    })
  } catch (err) {
    console.error('[LocalNotifications] Failed to cancel:', err)
  }
}

export async function cancelAllLocalNotifications(): Promise<void> {
  if (!isNativePlatform()) return

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const pending = await LocalNotifications.getPending()
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications })
    }
  } catch (err) {
    console.error('[LocalNotifications] Failed to cancel all:', err)
  }
}
