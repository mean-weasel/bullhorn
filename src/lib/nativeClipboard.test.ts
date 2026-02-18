import { describe, it, expect, vi, beforeEach } from 'vitest'
import { copyToClipboard } from './nativeClipboard'

vi.mock('./capacitor', () => ({
  isNativePlatform: vi.fn(() => false),
}))

describe('nativeClipboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses navigator.clipboard.writeText on web', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    })

    const result = await copyToClipboard('hello')
    expect(result).toBe(true)
    expect(writeTextMock).toHaveBeenCalledWith('hello')
  })

  it('falls back to textarea when clipboard API fails', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    })

    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as never)
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as never)
    document.execCommand = vi.fn().mockReturnValue(true)

    const result = await copyToClipboard('fallback text')
    expect(result).toBe(true)
    expect(appendSpy).toHaveBeenCalled()

    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
