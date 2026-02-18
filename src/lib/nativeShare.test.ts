import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shareContent, isShareAvailable } from './nativeShare'

vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

describe('nativeShare', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isShareAvailable', () => {
    it('returns false when navigator.share is not available', () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
      expect(isShareAvailable()).toBe(false)
    })

    it('returns true when navigator.share is available', () => {
      Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
      expect(isShareAvailable()).toBe(true)
    })
  })

  describe('shareContent', () => {
    it('returns false when share is not available on web', async () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
      const result = await shareContent({ title: 'Test', text: 'Hello' })
      expect(result).toBe(false)
    })

    it('calls navigator.share on web when available', async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'share', { value: shareMock, configurable: true })

      const result = await shareContent({
        title: 'Test',
        text: 'Hello',
        url: 'https://example.com',
      })
      expect(result).toBe(true)
      expect(shareMock).toHaveBeenCalledWith({
        title: 'Test',
        text: 'Hello',
        url: 'https://example.com',
      })
    })
  })
})
