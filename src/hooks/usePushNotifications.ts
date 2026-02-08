import { useState, useEffect, useCallback } from 'react'
import {
  isPushSupported,
  requestPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribed as checkIsSubscribed,
  sendLocalNotification,
} from '@/lib/pushNotifications'

interface UsePushNotificationsReturn {
  /** Whether the browser supports push notifications. */
  isSupported: boolean
  /** Current `Notification.permission` value. */
  permission: NotificationPermission
  /** Whether there is an active push subscription. */
  subscribed: boolean
  /** `true` while an async operation is in progress. */
  loading: boolean
  /** Subscribe to push notifications (requests permission if needed). */
  subscribe: () => Promise<boolean>
  /** Unsubscribe from push notifications. */
  unsubscribe: () => Promise<boolean>
  /** Fire a test notification locally. */
  sendTestNotification: () => Promise<void>
}

export function usePushNotifications(): UsePushNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  // Initialise state on mount (client-only)
  useEffect(() => {
    const supported = isPushSupported()
    setIsSupported(supported)

    if (supported) {
      setPermission(Notification.permission)
      checkIsSubscribed().then(setSubscribed)
    }
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    try {
      const subscription = await subscribeToPush()
      const ok = subscription !== null
      setSubscribed(ok)
      setPermission(Notification.permission)
      return ok
    } finally {
      setLoading(false)
    }
  }, [])

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    try {
      const ok = await unsubscribeFromPush()
      if (ok) setSubscribed(false)
      return ok
    } finally {
      setLoading(false)
    }
  }, [])

  const sendTestNotification = useCallback(async (): Promise<void> => {
    // Make sure we have permission first
    if (Notification.permission !== 'granted') {
      const granted = await requestPermission()
      setPermission(Notification.permission)
      if (!granted) return
    }

    await sendLocalNotification(
      'Bullhorn Test',
      'Push notifications are working! You will be notified when posts are due.',
      '/dashboard'
    )
  }, [])

  return {
    isSupported,
    permission,
    subscribed,
    loading,
    subscribe,
    unsubscribe,
    sendTestNotification,
  }
}
