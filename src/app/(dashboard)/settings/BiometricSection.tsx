'use client'

import { useState, useEffect } from 'react'
import { Fingerprint } from 'lucide-react'
import { isNativePlatform } from '@/lib/capacitor'

export function BiometricSection() {
  const [available, setAvailable] = useState(false)
  const [biometryType, setBiometryType] = useState<string>('none')
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isNativePlatform()) {
      setLoading(false)
      return
    }
    async function check() {
      const { isBiometricAvailable, isBiometricEnabled } = await import('@/lib/biometricAuth')
      const avail = await isBiometricAvailable()
      setAvailable(avail.available)
      setBiometryType(avail.biometryType)
      const on = await isBiometricEnabled()
      setEnabled(on)
      setLoading(false)
    }
    check()
  }, [])

  if (!isNativePlatform() || loading || !available) return null

  const label = biometryType === 'faceID' ? 'Face ID' : 'Touch ID'

  const handleToggle = async () => {
    const { setBiometricEnabled, authenticateBiometric } = await import('@/lib/biometricAuth')
    if (!enabled) {
      const success = await authenticateBiometric(`Enable ${label} for Bullhorn`)
      if (!success) return
    }
    const newValue = !enabled
    await setBiometricEnabled(newValue)
    setEnabled(newValue)
  }

  return (
    <div className="p-6 rounded-md border-[3px] border-border bg-card shadow-sticker mb-6">
      <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground mb-4">
        <Fingerprint className="w-4 h-4 inline-block mr-1 -mt-0.5" /> Security
      </h2>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-sm">{label} Lock</p>
          <p className="text-sm text-muted-foreground">Require {label} to open Bullhorn</p>
        </div>
        <button
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors border-2 border-border ${
            enabled ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform border border-border ${
              enabled ? 'translate-x-5' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </div>
  )
}
