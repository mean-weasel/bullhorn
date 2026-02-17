import { useEffect, useCallback } from 'react'

type ShortcutHandler = () => void

interface Shortcut {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  handler: ShortcutHandler
  preventDefault?: boolean
}

interface UseKeyboardShortcutsOptions {
  shortcuts: Shortcut[]
  enabled?: boolean
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      // Don't trigger shortcuts when typing in inputs (except for meta/ctrl shortcuts)
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      for (const shortcut of shortcuts) {
        const ctrlOrMeta = shortcut.ctrl || shortcut.meta
        const modifierMatch = ctrlOrMeta ? e.ctrlKey || e.metaKey : true
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase()

        // Allow ctrl/meta shortcuts even in inputs
        if (keyMatch && modifierMatch && shiftMatch) {
          // Skip if in input and not a modifier shortcut
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
    },
    [shortcuts, enabled]
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
