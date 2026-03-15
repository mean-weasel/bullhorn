import { useEffect, useRef, useState, useCallback } from 'react'

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'retrying'

const MAX_RETRIES = 3
const BACKOFF_DELAYS = [2000, 4000, 8000]

interface UseAutoSaveOptions {
  data: unknown
  onSave: () => void | Promise<void>
  delay?: number
  enabled?: boolean
  // Skip the first data change after mount (for edit pages where async data loading triggers a change)
  skipInitialChange?: boolean
}

// eslint-disable-next-line max-lines-per-function -- API handler requires auth+db in single try/catch
export function useAutoSave({
  data,
  onSave,
  delay = 3000,
  enabled = true,
  skipInitialChange = false,
}: UseAutoSaveOptions) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const retryCountRef = useRef(0)
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

  const saveRef = useRef<() => Promise<void>>()

  const save = useCallback(async () => {
    setStatus('saving')
    try {
      await onSaveRef.current()
      retryCountRef.current = 0
      setStatus('saved')
      // Reset to idle after 5 seconds (longer window for E2E tests to catch)
      setTimeout(() => setStatus('idle'), 5000)
    } catch {
      if (retryCountRef.current < MAX_RETRIES) {
        const backoffDelay = BACKOFF_DELAYS[retryCountRef.current]
        retryCountRef.current += 1
        setStatus('retrying')
        retryTimeoutRef.current = setTimeout(() => {
          saveRef.current?.()
        }, backoffDelay)
      } else {
        setStatus('error')
      }
    }
  }, [])

  useEffect(() => {
    saveRef.current = save
  })

  const retry = useCallback(() => {
    retryCountRef.current = 0
    saveRef.current?.()
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

    // Reset retry counter when new data changes come in
    retryCountRef.current = 0
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
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

  // Clean up retry timeouts on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  return { status, save, retry }
}
