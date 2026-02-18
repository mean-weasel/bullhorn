import { describe, it, expect, vi, beforeEach } from 'vitest'
import { openInBrowser } from './nativeBrowser'

vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

describe('nativeBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls window.open on web', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)

    await openInBrowser('https://example.com')

    expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')
    openSpy.mockRestore()
  })
})
