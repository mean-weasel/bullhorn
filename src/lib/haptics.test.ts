import { describe, it, expect, vi } from 'vitest'

vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

import { hapticSuccess, hapticWarning, hapticLight } from './haptics'

describe('haptics', () => {
  it('hapticSuccess is a no-op on web', async () => {
    await expect(hapticSuccess()).resolves.toBeUndefined()
  })

  it('hapticWarning is a no-op on web', async () => {
    await expect(hapticWarning()).resolves.toBeUndefined()
  })

  it('hapticLight is a no-op on web', async () => {
    await expect(hapticLight()).resolves.toBeUndefined()
  })
})
