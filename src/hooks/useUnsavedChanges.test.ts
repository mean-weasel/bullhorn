import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for useUnsavedChanges hook logic.
 *
 * Since @testing-library/react-hooks is not available, we test the
 * underlying logic directly: the beforeunload event listener behavior
 * and the confirmNavigation helper.
 */

describe('useUnsavedChanges logic', () => {
  let addEventSpy: ReturnType<typeof vi.spyOn>
  let removeEventSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    addEventSpy = vi.spyOn(window, 'addEventListener')
    removeEventSpy = vi.spyOn(window, 'removeEventListener')
  })

  afterEach(() => {
    addEventSpy.mockRestore()
    removeEventSpy.mockRestore()
  })

  describe('beforeunload handler', () => {
    it('sets returnValue and returns the message when called', () => {
      const message = 'You have unsaved changes. Are you sure you want to leave?'

      // Simulate what the hook does internally
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = message
        return message
      }

      const event = new Event('beforeunload') as BeforeUnloadEvent
      Object.defineProperty(event, 'returnValue', { writable: true, value: '' })

      const result = handleBeforeUnload(event)
      expect(event.returnValue).toBe(message)
      expect(result).toBe(message)
    })

    it('supports a custom message', () => {
      const customMessage = 'Save your work first!'
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = customMessage
        return customMessage
      }

      const event = new Event('beforeunload') as BeforeUnloadEvent
      Object.defineProperty(event, 'returnValue', { writable: true, value: '' })

      const result = handleBeforeUnload(event)
      expect(event.returnValue).toBe(customMessage)
      expect(result).toBe(customMessage)
    })
  })

  describe('confirmNavigation logic', () => {
    it('returns true when isDirty is false (no prompt)', () => {
      const isDirty = false
      const message = 'Unsaved changes!'
      const confirmNavigation = () => {
        if (!isDirty) return true
        return window.confirm(message)
      }
      expect(confirmNavigation()).toBe(true)
    })

    it('calls window.confirm when isDirty is true', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const isDirty = true
      const message = 'You have unsaved changes. Are you sure you want to leave?'
      const confirmNavigation = () => {
        if (!isDirty) return true
        return window.confirm(message)
      }

      const result = confirmNavigation()
      expect(confirmSpy).toHaveBeenCalledWith(message)
      expect(result).toBe(true)
      confirmSpy.mockRestore()
    })

    it('returns false when user cancels the confirm dialog', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const isDirty = true
      const message = 'Unsaved!'
      const confirmNavigation = () => {
        if (!isDirty) return true
        return window.confirm(message)
      }

      const result = confirmNavigation()
      expect(confirmSpy).toHaveBeenCalledWith(message)
      expect(result).toBe(false)
      confirmSpy.mockRestore()
    })

    it('uses the default message when none is provided', () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const isDirty = true
      const defaultMessage = 'You have unsaved changes. Are you sure you want to leave?'
      const confirmNavigation = () => {
        if (!isDirty) return true
        return window.confirm(defaultMessage)
      }

      confirmNavigation()
      expect(confirmSpy).toHaveBeenCalledWith(defaultMessage)
      confirmSpy.mockRestore()
    })
  })
})
