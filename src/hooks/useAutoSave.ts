import { useEffect, useRef, useState, useCallback } from 'react'

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UseAutoSaveOptions {
  data: unknown
  onSave: () => void | Promise<void>
  delay?: number
  enabled?: boolean
  // Skip the first data change after mount (for edit pages where async data loading triggers a change)
  skipInitialChange?: boolean
}

export function useAutoSave({
  data,
  onSave,
  delay = 3000,
  enabled = true,
  skipInitialChange = false,
}: UseAutoSaveOptions) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastDataRef = useRef<string>('')
  const isFirstRender = useRef(true)
  const hasInitialized = useRef(!skipInitialChange) // Pre-initialize if not skipping
  // Use ref for onSave to avoid effect re-runs when callback reference changes
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  })

  // Serialize data for comparison
  const serializedData = JSON.stringify(data)

  const save = useCallback(async () => {
    setStatus('saving')
    try {
      await onSaveRef.current()
      setStatus('saved')
      // Reset to idle after 5 seconds (longer window for E2E tests to catch)
      setTimeout(() => setStatus('idle'), 5000)
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    // Skip first render and mark that we've seen initial data
    if (isFirstRender.current) {
      isFirstRender.current = false
      lastDataRef.current = serializedData
      return
    }

    // Skip if disabled
    if (!enabled) return

    // Skip if data hasn't changed
    if (serializedData === lastDataRef.current) return

    // Update last data
    lastDataRef.current = serializedData

    // Skip the first data change after mount (this handles async data loading)
    // Only trigger auto-save after the component has fully initialized
    if (!hasInitialized.current) {
      hasInitialized.current = true
      return
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout
    timeoutRef.current = setTimeout(save, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [serializedData, delay, enabled, save])

  return { status, save }
}
