import { describe, it, expect, vi } from 'vitest'

vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

import {
  saveSessionToKeychain,
  getSessionFromKeychain,
  clearSessionFromKeychain,
} from './sessionBridge'

describe('sessionBridge', () => {
  it('returns null from getSessionFromKeychain on web', async () => {
    const result = await getSessionFromKeychain()
    expect(result).toBeNull()
  })

  it('saveSessionToKeychain is a no-op on web', async () => {
    await expect(saveSessionToKeychain('token', 'refresh')).resolves.toBeUndefined()
  })

  it('clearSessionFromKeychain is a no-op on web', async () => {
    await expect(clearSessionFromKeychain()).resolves.toBeUndefined()
  })
})
