/**
 * Push Notification utilities — supports both web (Service Worker) and native (Capacitor).
 *
 * Web exports (used by usePushNotifications hook):
 *   isPushSupported, requestPermission, subscribeToPush, unsubscribeFromPush,
 *   isSubscribed, sendLocalNotification
 *
 * Native exports (used by NativeInit component):
 *   registerPushNotifications, addPushListeners, savePushToken, removePushToken
 */

import { isNativePlatform } from './capacitor'

// ---------------------------------------------------------------------------
// Web Push (Service Worker / Notification API)
// ---------------------------------------------------------------------------

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch (err) {
    console.error('[push] Failed to register service worker:', err)
    return null
  }
}

export async function requestPermission(): Promise<boolean> {
  if (!isPushSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null
  const permissionGranted = await requestPermission()
  if (!permissionGranted) return null

  const registration = await getRegistration()
  if (!registration) return null

  const existing = await registration.pushManager.getSubscription()
  if (existing) {
    // Persist to server in case it wasn't saved
    await persistSubscription(existing)
    return existing
  }

  if (!VAPID_PUBLIC_KEY) {
    console.warn('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set — skipping push subscription')
    return null
  }

  try {
    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
    })
    // Persist to server for server-side push delivery
    await persistSubscription(subscription)
    return subscription
  } catch (err) {
    console.error('[push] Failed to subscribe:', err)
    return null
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return true

  try {
    // Remove from server
    await removeSubscription(subscription.endpoint)
    return await subscription.unsubscribe()
  } catch (err) {
    console.error('[push] Failed to unsubscribe:', err)
    return false
  }
}

export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    return subscription !== null
  } catch {
    return false
  }
}

export async function sendLocalNotification(
  title: string,
  body: string,
  url?: string
): Promise<void> {
  if (!isPushSupported()) return
  if (Notification.permission !== 'granted') return

  try {
    const registration = await navigator.serviceWorker.ready
    await registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: url ? { url } : undefined,
    })
  } catch {
    new Notification(title, { body, icon: '/pwa-192x192.png' })
  }
}

async function persistSubscription(subscription: PushSubscription): Promise<void> {
  try {
    const json = subscription.toJSON()
    await fetch('/api/push-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    })
  } catch (err) {
    console.error('[push] Failed to persist subscription to server:', err)
  }
}

async function removeSubscription(endpoint: string): Promise<void> {
  try {
    await fetch('/api/push-subscriptions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    })
  } catch (err) {
    console.error('[push] Failed to remove subscription from server:', err)
  }
}

// ---------------------------------------------------------------------------
// Native Push (Capacitor — iOS APNs)
// ---------------------------------------------------------------------------

export async function registerPushNotifications(): Promise<string | null> {
  if (!isNativePlatform()) return null

  const { PushNotifications } = await import('@capacitor/push-notifications')

  console.log('[Push] Requesting permissions...')
  const permission = await PushNotifications.requestPermissions()
  console.log('[Push] Permission result:', permission.receive)
  if (permission.receive !== 'granted') return null

  // Set up listeners BEFORE register() to avoid race condition
  const tokenPromise = new Promise<string | null>((resolve) => {
    const timeout = setTimeout(() => {
      console.warn('[Push] Registration timed out after 10s')
      resolve(null)
    }, 10000)

    PushNotifications.addListener('registration', (token) => {
      clearTimeout(timeout)
      console.log('[Push] Got device token')
      resolve(token.value)
    })
    PushNotifications.addListener('registrationError', (err) => {
      clearTimeout(timeout)
      console.error('[Push] Registration error:', JSON.stringify(err))
      resolve(null)
    })
  })

  await PushNotifications.register()

  return tokenPromise
}

export function addPushListeners(onNotificationTap?: (url: string) => void) {
  if (!isNativePlatform()) return

  import('@capacitor/push-notifications').then(({ PushNotifications }) => {
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Foreground notification:', notification.title)
    })

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const url = action.notification.data?.url as string | undefined
      if (url && onNotificationTap) {
        onNotificationTap(url)
      }
    })
  })
}

export async function savePushToken(token: string): Promise<void> {
  await fetch('/api/push-tokens', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, platform: 'ios' }),
  })
}

export async function removePushToken(token: string): Promise<void> {
  await fetch('/api/push-tokens', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
}
