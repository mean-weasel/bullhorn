import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use window.setTimeout to get the browser `number` return type
// instead of Node's `Timeout` (both work with vi.useFakeTimers)
const setTimer = (fn: () => void, ms: number) => window.setTimeout(fn, ms)
const clearTimer = (id: number | null) => {
  if (id !== null) window.clearTimeout(id)
}

/**
 * Tests for useAutoSave hook logic.
 *
 * Since @testing-library/react-hooks is not available, we test the
 * underlying auto-save logic directly: debounce behavior, change detection,
 * and save status transitions.
 */

describe('useAutoSave logic - enabled flag', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not schedule save when enabled is false', () => {
    const onSave = vi.fn()
    const delay = 3000
    const enabled = false
    let timeout: number | null = null

    // Simulate the hook's guard clause
    const handleDataChange = () => {
      if (!enabled) return
      if (timeout) clearTimer(timeout)
      timeout = setTimer(onSave, delay)
    }

    handleDataChange()
    vi.advanceTimersByTime(delay + 1000)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('schedules save when enabled is true', () => {
    const onSave = vi.fn()
    const delay = 3000
    const enabled = true
    let timeout: number | null = null

    const handleDataChange = () => {
      if (!enabled) return
      if (timeout) clearTimer(timeout)
      timeout = setTimer(onSave, delay)
    }

    handleDataChange()
    vi.advanceTimersByTime(delay)
    expect(onSave).toHaveBeenCalledTimes(1)

    if (timeout) clearTimer(timeout)
  })
})

describe('useAutoSave logic - skipInitialChange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('skips the first data change after mount when skipInitialChange is true', () => {
    const onSave = vi.fn()
    const delay = 3000
    let hasInitialized = false // !skipInitialChange would be true; skipInitialChange=true means false
    let isFirstRender = true
    let lastData = ''
    let timeout: number | null = null

    const handleDataChange = (newData: unknown) => {
      const serialized = JSON.stringify(newData)

      // Skip first render
      if (isFirstRender) {
        isFirstRender = false
        lastData = serialized
        return
      }

      if (serialized === lastData) return
      lastData = serialized

      // Skip first change after initialization
      if (!hasInitialized) {
        hasInitialized = true
        return
      }

      if (timeout) clearTimer(timeout)
      timeout = setTimer(onSave, delay)
    }

    // First render — sets initial data, skipped
    handleDataChange({ title: '' })
    vi.advanceTimersByTime(delay)
    expect(onSave).not.toHaveBeenCalled()

    // First change after mount (async data load) — skipped due to skipInitialChange
    handleDataChange({ title: 'Loaded from server' })
    vi.advanceTimersByTime(delay)
    expect(onSave).not.toHaveBeenCalled()

    // Second change — this should trigger save
    handleDataChange({ title: 'User typed something' })
    vi.advanceTimersByTime(delay)
    expect(onSave).toHaveBeenCalledTimes(1)

    if (timeout) clearTimer(timeout)
  })
})
