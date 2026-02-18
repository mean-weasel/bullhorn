'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { isNativePlatform } from '@/lib/capacitor'
import { onNetworkStatusChange } from '@/lib/networkStatus'
import { clearBadge, setBadgeCount, calculateBadgeCount } from '@/lib/appBadge'
import { useRemindersStore } from '@/lib/reminders'
import { usePostsStore } from '@/lib/storage'

export function NativeInit() {
  const router = useRouter()
  const initialized = useRef(false)
  const reminders = useRemindersStore((s) => s.reminders)
  const posts = usePostsStore((s) => s.posts)

  useEffect(() => {
    if (!isNativePlatform() || initialized.current) return
    initialized.current = true

    async function init() {
      // Restore session from Keychain
      try {
        const { getSessionFromKeychain, saveSessionToKeychain, clearSessionFromKeychain } =
          await import('@/lib/sessionBridge')
        const session = await getSessionFromKeychain()
        if (session) {
          const { createClient } = await import('@/lib/supabase/client')
          const supabase = createClient()
          await supabase.auth.setSession({
            access_token: session.accessToken,
            refresh_token: session.refreshToken,
          })
        }
        // Listen for future auth changes to save tokens
        const { createClient } = await import('@/lib/supabase/client')
        const supabase = createClient()
        supabase.auth.onAuthStateChange(async (_event, newSession) => {
          if (newSession) {
            await saveSessionToKeychain(newSession.access_token, newSession.refresh_token)
          } else {
            await clearSessionFromKeychain()
          }
        })
      } catch (err) {
        console.error('[NativeInit] Session bridge failed:', err)
      }

      // Check biometric lock
      try {
        const { isBiometricEnabled, authenticateBiometric } = await import('@/lib/biometricAuth')
        const enabled = await isBiometricEnabled()
        if (enabled) {
          const success = await authenticateBiometric()
          if (!success) {
            console.warn('[NativeInit] Biometric auth failed')
          }
        }
      } catch (err) {
        console.error('[NativeInit] Biometric check failed:', err)
      }

      // Register push notifications
      try {
        const { registerPushNotifications, addPushListeners, savePushToken } =
          await import('@/lib/pushNotifications')
        const token = await registerPushNotifications()
        if (token) {
          await savePushToken(token)
        }
        addPushListeners((url) => {
          router.push(url)
        })
      } catch (err) {
        console.error('[NativeInit] Push registration failed:', err)
      }

      // Set up share deep link handler
      try {
        const { initShareHandler } = await import('@/lib/shareHandler')
        initShareHandler(router)
      } catch (err) {
        console.error('[NativeInit] Share handler init failed:', err)
      }

      // Monitor network status
      const cleanupNetwork = onNetworkStatusChange((status) => {
        console.log('[NativeInit] Network status:', status.connected ? 'online' : 'offline')
      })

      // Clear badge on app open
      clearBadge()

      // Listen for app state changes (foreground/background)
      try {
        const { App } = await import('@capacitor/app')
        App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            clearBadge()
          } else {
            const count = calculateBadgeCount(
              useRemindersStore.getState().reminders,
              usePostsStore.getState().posts
            )
            if (count > 0) {
              setBadgeCount(count)
            }
          }
        })
      } catch (err) {
        console.error('[NativeInit] App state listener failed:', err)
      }

      return cleanupNetwork
    }

    init()
  }, [router])

  // Update badge count when reminders or posts change (for next background event)
  useEffect(() => {
    if (!isNativePlatform()) return
    // Badge is set on backgrounding, so we just keep state current
  }, [reminders, posts])

  return null
}
