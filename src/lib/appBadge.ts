import { isNativePlatform } from './capacitor'

export async function setBadgeCount(count: number): Promise<void> {
  if (!isNativePlatform()) return

  try {
    const { Badge } = await import('@capawesome/capacitor-badge')
    await Badge.set({ count })
  } catch (err) {
    console.error('[Badge] Failed to set count:', err)
  }
}

export async function clearBadge(): Promise<void> {
  if (!isNativePlatform()) return

  try {
    const { Badge } = await import('@capawesome/capacitor-badge')
    await Badge.clear()
  } catch (err) {
    console.error('[Badge] Failed to clear:', err)
  }
}

interface ReminderLike {
  isCompleted: boolean
  remindAt: string
}

interface PostLike {
  status: string
  scheduledAt?: string | null
}

/**
 * Calculate the badge count based on reminders due today and posts scheduled for today.
 * This is a pure function — works on web too.
 */
export function calculateBadgeCount(reminders: ReminderLike[], posts: PostLike[]): number {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  const dueReminders = reminders.filter((r) => {
    if (r.isCompleted) return false
    const remindDate = new Date(r.remindAt)
    return remindDate >= todayStart && remindDate < todayEnd
  }).length

  const scheduledPosts = posts.filter((p) => {
    if (p.status !== 'scheduled' || !p.scheduledAt) return false
    const schedDate = new Date(p.scheduledAt)
    return schedDate >= todayStart && schedDate < todayEnd
  }).length

  return dueReminders + scheduledPosts
}
