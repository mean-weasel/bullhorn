import { describe, it, expect, vi, beforeEach } from 'vitest'
import { showNativeConfirm, isNativeDialogAvailable } from './nativeDialog'

vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

describe('nativeDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isNativeDialogAvailable', () => {
    it('returns false on web', () => {
      expect(isNativeDialogAvailable()).toBe(false)
    })
  })

  describe('showNativeConfirm', () => {
    it('returns null on web', async () => {
      const result = await showNativeConfirm({
        title: 'Delete?',
        message: 'Are you sure?',
      })
      expect(result).toBeNull()
    })
  })
})
