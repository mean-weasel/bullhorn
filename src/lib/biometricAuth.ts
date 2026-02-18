import { isNativePlatform } from './capacitor'

interface BiometricPlugin {
  isAvailable(): Promise<{ available: boolean; biometryType: string }>
  authenticate(options: { reason: string }): Promise<{ success: boolean; error?: string }>
  setEnabled(options: { enabled: boolean }): Promise<void>
  isEnabled(): Promise<{ enabled: boolean }>
}

async function getPlugin(): Promise<BiometricPlugin | null> {
  if (!isNativePlatform()) return null
  try {
    const { registerPlugin } = await import('@capacitor/core')
    return registerPlugin<BiometricPlugin>('BiometricAuth')
  } catch {
    return null
  }
}

export async function isBiometricAvailable(): Promise<{
  available: boolean
  biometryType: 'faceID' | 'touchID' | 'none'
}> {
  const plugin = await getPlugin()
  if (!plugin) return { available: false, biometryType: 'none' }
  const result = await plugin.isAvailable()
  return result as { available: boolean; biometryType: 'faceID' | 'touchID' | 'none' }
}

export async function authenticateBiometric(reason = 'Unlock Bullhorn'): Promise<boolean> {
  const plugin = await getPlugin()
  if (!plugin) return true // Allow access on web
  const result = await plugin.authenticate({ reason })
  return result.success
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  const plugin = await getPlugin()
  if (!plugin) return
  await plugin.setEnabled({ enabled })
}

export async function isBiometricEnabled(): Promise<boolean> {
  const plugin = await getPlugin()
  if (!plugin) return false
  const result = await plugin.isEnabled()
  return result.enabled
}
