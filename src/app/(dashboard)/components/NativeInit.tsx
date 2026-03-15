'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { isNativePlatform } from '@/lib/capacitor'
import { onNetworkStatusChange } from '@/lib/networkStatus'
import { clearBadge, setBadgeCount, calculateBadgeCount } from '@/lib/appBadge'
import { useRemindersStore } from '@/lib/reminders'
import { usePostsStore } from '@/lib/storage'

// eslint-disable-next-line max-lines-per-function
export function NativeInit() {
  const router = useRouter()
  const initialized = useRef(false)
  const reminders = useRemindersStore((s) => s.reminders)
  const posts = usePostsStore((s) => s.posts)

  // eslint-disable-next-line max-lines-per-function -- component JSX rendering, extraction would fragment UI
  useEffect(() => {
    if (!isNativePlatform() || initialized.current) return
    initialized.current = true

    // Run independent init tasks in parallel so one blocking task can't prevent others
    async function initSessionBridge() {
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
    }

    async function initBiometric() {
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
    }

    async function initPushNotifications() {
      try {
        console.log('[NativeInit] Starting push registration...')
        const { registerPushNotifications, addPushListeners, savePushToken } =
          await import('@/lib/pushNotifications')
        const token = await registerPushNotifications()
        console.log('[NativeInit] Push registration result:', token ? 'got token' : 'no token')
        if (token) {
          await savePushToken(token)
          console.log('[NativeInit] Push token saved')
        }
        addPushListeners((url) => {
          router.push(url)
        })
      } catch (err) {
        console.error('[NativeInit] Push registration failed:', err)
      }
    }

    async function initShareHandler() {
      try {
        const { initShareHandler: initShare } = await import('@/lib/shareHandler')
        initShare(router)
      } catch (err) {
        console.error('[NativeInit] Share handler init failed:', err)
      }
    }

    async function initAppState() {
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
    }

    // Push registration runs independently — not blocked by session/biometric
    initPushNotifications()

    // Other tasks run in parallel
    Promise.all([initSessionBridge(), initBiometric(), initShareHandler(), initAppState()]).catch(
      (err) => console.error('[NativeInit] Init error:', err)
    )

    // Non-async tasks
    onNetworkStatusChange((status) => {
      console.log('[NativeInit] Network status:', status.connected ? 'online' : 'offline')
    })
    clearBadge()
  }, [router])

  // Update badge count when reminders or posts change (for next background event)
  useEffect(() => {
    if (!isNativePlatform()) return
    // Badge is set on backgrounding, so we just keep state current
  }, [reminders, posts])

  return null
}
