import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getNetworkStatus, onNetworkStatusChange } from './networkStatus'

vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

describe('networkStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getNetworkStatus', () => {
    it('returns navigator.onLine status on web', async () => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      const status = await getNetworkStatus()
      expect(status.connected).toBe(true)
      expect(status.connectionType).toBe('unknown')
    })
  })

  describe('onNetworkStatusChange', () => {
    let addSpy: ReturnType<typeof vi.spyOn>
    let removeSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      addSpy = vi.spyOn(window, 'addEventListener')
      removeSpy = vi.spyOn(window, 'removeEventListener')
    })

    afterEach(() => {
      addSpy.mockRestore()
      removeSpy.mockRestore()
    })

    it('adds online/offline event listeners on web', () => {
      const callback = vi.fn()
      const cleanup = onNetworkStatusChange(callback)

      expect(addSpy).toHaveBeenCalledWith('online', expect.any(Function))
      expect(addSpy).toHaveBeenCalledWith('offline', expect.any(Function))

      cleanup()
      expect(removeSpy).toHaveBeenCalledWith('online', expect.any(Function))
      expect(removeSpy).toHaveBeenCalledWith('offline', expect.any(Function))
    })
  })
})
