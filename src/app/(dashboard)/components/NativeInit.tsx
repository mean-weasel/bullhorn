'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { isNativePlatform } from '@/lib/capacitor'

export function NativeInit() {
  const router = useRouter()
  const initialized = useRef(false)

  useEffect(() => {
    if (!isNativePlatform() || initialized.current) return
    initialized.current = true

    async function init() {
      // Register push notifications
      try {
        const { registerPushNotifications, addPushListeners, savePushToken } = await import(
          '@/lib/pushNotifications'
        )
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
    }

    init()
  }, [router])

  return null
}
