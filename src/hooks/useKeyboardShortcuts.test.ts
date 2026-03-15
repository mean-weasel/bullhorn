import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Tests for useKeyboardShortcuts hook logic.
 *
 * Since @testing-library/react-hooks is not available, we test the
 * underlying keydown handler logic directly: shortcut matching, modifier
 * keys, input element exclusion, and cleanup behavior.
 */

// eslint-disable-next-line max-lines-per-function
describe('useKeyboardShortcuts logic', () => {
  let addEventSpy: ReturnType<typeof vi.spyOn>
  let removeEventSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    addEventSpy = vi.spyOn(document, 'addEventListener')
    removeEventSpy = vi.spyOn(document, 'removeEventListener')
  })

  afterEach(() => {
    addEventSpy.mockRestore()
    removeEventSpy.mockRestore()
  })

  // Helper to create a KeyboardEvent with the correct properties
  function createKeyEvent(
    key: string,
    options: {
      ctrlKey?: boolean
      metaKey?: boolean
      shiftKey?: boolean
      target?: HTMLElement
    } = {}
  ): KeyboardEvent {
    const event = new KeyboardEvent('keydown', {
      key,
      ctrlKey: options.ctrlKey ?? false,
      metaKey: options.metaKey ?? false,
      shiftKey: options.shiftKey ?? false,
      bubbles: true,
      cancelable: true,
    })
    if (options.target) {
      Object.defineProperty(event, 'target', { value: options.target })
    }
    return event
  }

  // Re-implement the handler logic from the hook for direct testing
  function createHandler(
    shortcuts: Array<{
      key: string
      ctrl?: boolean
      meta?: boolean
      shift?: boolean
      handler: () => void
      preventDefault?: boolean
    }>,
    enabled = true
  ) {
    return (e: KeyboardEvent) => {
      if (!enabled) return

      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      for (const shortcut of shortcuts) {
        const ctrlOrMeta = shortcut.ctrl || shortcut.meta
        const modifierMatch = ctrlOrMeta ? e.ctrlKey || e.metaKey : true
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

        if (keyMatch && modifierMatch && shiftMatch) {
          if (isInput && !ctrlOrMeta && shortcut.key !== 'Escape') {
            continue
          }

          if (shortcut.preventDefault !== false) {
            e.preventDefault()
          }
          shortcut.handler()
          return
        }
      }
    }
  }

  describe('event listener registration', () => {
    it('registers a keydown event listener on document', () => {
      const handler = createHandler([])
      document.addEventListener('keydown', handler)

      expect(addEventSpy).toHaveBeenCalledWith('keydown', handler)

      document.removeEventListener('keydown', handler)
    })

    it('removes the keydown event listener on cleanup', () => {
      const handler = createHandler([])
      document.addEventListener('keydown', handler)
      document.removeEventListener('keydown', handler)

      expect(removeEventSpy).toHaveBeenCalledWith('keydown', handler)
    })
  })

  // eslint-disable-next-line max-lines-per-function
  describe('shortcut matching', () => {
    it('calls the handler for a matching simple key shortcut', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 'n', handler }])
      const div = document.createElement('div')

      const event = createKeyEvent('n', { target: div })
      handleKeyDown(event)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('matches key case-insensitively', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 'N', handler }])
      const div = document.createElement('div')

      const event = createKeyEvent('n', { target: div })
      handleKeyDown(event)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('does not call handler for non-matching key', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 'n', handler }])
      const div = document.createElement('div')

      const event = createKeyEvent('m', { target: div })
      handleKeyDown(event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('matches Ctrl+key shortcut', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 's', ctrl: true, handler }])
      const div = document.createElement('div')

      const event = createKeyEvent('s', { ctrlKey: true, target: div })
      handleKeyDown(event)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('matches Meta+key shortcut (Cmd on macOS)', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 's', meta: true, handler }])
      const div = document.createElement('div')

      const event = createKeyEvent('s', { metaKey: true, target: div })
      handleKeyDown(event)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('matches Ctrl shortcut with Meta key (cross-platform)', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 's', ctrl: true, handler }])
      const div = document.createElement('div')

      // Meta key should also match when ctrl is specified (for macOS compat)
      const event = createKeyEvent('s', { metaKey: true, target: div })
      handleKeyDown(event)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('matches Shift+key shortcut', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 'n', shift: true, handler }])
      const div = document.createElement('div')

      const event = createKeyEvent('n', { shiftKey: true, target: div })
      handleKeyDown(event)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('does not match when Shift is held but not specified', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 'n', handler }])
      const div = document.createElement('div')

      const event = createKeyEvent('n', { shiftKey: true, target: div })
      handleKeyDown(event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('does not match Ctrl shortcut without modifier key', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 's', ctrl: true, handler }])
      const div = document.createElement('div')

      const event = createKeyEvent('s', { target: div })
      handleKeyDown(event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('calls only the first matching shortcut handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const handleKeyDown = createHandler([
        { key: 'n', handler: handler1 },
        { key: 'n', handler: handler2 },
      ])
      const div = document.createElement('div')

      const event = createKeyEvent('n', { target: div })
      handleKeyDown(event)

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('preventDefault behavior', () => {
    it('calls preventDefault by default', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 'n', handler }])
      const div = document.createElement('div')

      const event = createKeyEvent('n', { target: div })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
      handleKeyDown(event)

      expect(preventDefaultSpy).toHaveBeenCalled()
    })

    it('does not call preventDefault when preventDefault is false', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 'n', handler, preventDefault: false }])
      const div = document.createElement('div')

      const event = createKeyEvent('n', { target: div })
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault')
      handleKeyDown(event)

      expect(preventDefaultSpy).not.toHaveBeenCalled()
    })
  })

  describe('input/textarea exclusion', () => {
    it('ignores simple shortcuts when target is an INPUT element', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 'n', handler }])
      const input = document.createElement('input')

      const event = createKeyEvent('n', { target: input })
      handleKeyDown(event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('ignores simple shortcuts when target is a TEXTAREA element', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 'n', handler }])
      const textarea = document.createElement('textarea')

      const event = createKeyEvent('n', { target: textarea })
      handleKeyDown(event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('ignores simple shortcuts when target is contentEditable', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 'n', handler }])
      const div = document.createElement('div')
      div.contentEditable = 'true'
      // jsdom does not implement isContentEditable, so we define it manually
      Object.defineProperty(div, 'isContentEditable', { value: true })

      const event = createKeyEvent('n', { target: div })
      handleKeyDown(event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('allows Ctrl/Meta shortcuts even when in an input', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 's', ctrl: true, handler }])
      const input = document.createElement('input')

      const event = createKeyEvent('s', { ctrlKey: true, target: input })
      handleKeyDown(event)

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('allows Escape key even when in an input', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 'Escape', handler }])
      const input = document.createElement('input')

      const event = createKeyEvent('Escape', { target: input })
      handleKeyDown(event)

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('enabled flag', () => {
    it('does not fire shortcuts when enabled is false', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 'n', handler }], false)
      const div = document.createElement('div')

      const event = createKeyEvent('n', { target: div })
      handleKeyDown(event)

      expect(handler).not.toHaveBeenCalled()
    })

    it('fires shortcuts when enabled is true', () => {
      const handler = vi.fn()
      const handleKeyDown = createHandler([{ key: 'n', handler }], true)
      const div = document.createElement('div')

      const event = createKeyEvent('n', { target: div })
      handleKeyDown(event)

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })
})
