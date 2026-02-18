import { describe, it, expect, vi } from 'vitest'

vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

import {
  isBiometricAvailable,
  authenticateBiometric,
  setBiometricEnabled,
  isBiometricEnabled,
} from './biometricAuth'

describe('biometricAuth', () => {
  it('isBiometricAvailable returns unavailable on web', async () => {
    const result = await isBiometricAvailable()
    expect(result).toEqual({ available: false, biometryType: 'none' })
  })

  it('authenticateBiometric returns true on web (passthrough)', async () => {
    const result = await authenticateBiometric()
    expect(result).toBe(true)
  })

  it('setBiometricEnabled is a no-op on web', async () => {
    await expect(setBiometricEnabled(true)).resolves.toBeUndefined()
  })

  it('isBiometricEnabled returns false on web', async () => {
    const result = await isBiometricEnabled()
    expect(result).toBe(false)
  })
})
