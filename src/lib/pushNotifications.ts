/**
 * Browser Push Notification utilities.
 *
 * Client-side infrastructure for requesting permission, registering a service
 * worker, managing push subscriptions, and firing local notifications.
 *
 * Server-side push sending (storing subscriptions, calling the Web Push API)
 * is intentionally not included here and can be added later.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

/** Whether the current browser supports the Push API and service workers. */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

/** Register (or re-use) the push service worker. */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return registration
  } catch (err) {
    console.error('[push] Failed to register service worker:', err)
    return null
  }
}

/**
 * Request browser notification permission.
 * Returns `true` when granted, `false` otherwise.
 */
export async function requestPermission(): Promise<boolean> {
  if (!isPushSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  const result = await Notification.requestPermission()
  return result === 'granted'
}

/**
 * Convert a URL-safe base64 string to a Uint8Array (required by
 * `PushManager.subscribe` for the `applicationServerKey`).
 */
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

/**
 * Subscribe the browser to push notifications.
 *
 * 1. Registers the service worker.
 * 2. Requests notification permission (if not already granted).
 * 3. Creates a `PushSubscription` using the VAPID public key.
 *
 * Returns the `PushSubscription` on success, or `null` on failure.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null

  const permissionGranted = await requestPermission()
  if (!permissionGranted) return null

  const registration = await getRegistration()
  if (!registration) return null

  // Check for an existing subscription first
  const existing = await registration.pushManager.getSubscription()
  if (existing) return existing

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
    return subscription
  } catch (err) {
    console.error('[push] Failed to subscribe:', err)
    return null
  }
}

/** Unsubscribe from push notifications. Returns `true` on success. */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return true

  try {
    const result = await subscription.unsubscribe()
    return result
  } catch (err) {
    console.error('[push] Failed to unsubscribe:', err)
    return false
  }
}

/** Check whether there is an active push subscription. */
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

/**
 * Show a local notification immediately (not via push — useful for testing
 * and for local events like post status changes).
 *
 * Falls back to the basic `Notification` constructor when the service worker
 * is not available.
 */
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
    // Fallback to basic Notification API
    new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
    })
  }
}
