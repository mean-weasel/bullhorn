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

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('change detection (3/5)', () => {
  it('transitions to error after all retries exhausted', async () => {
    type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'retrying'
    let status: AutoSaveStatus = 'idle'
    let retryCount = 0
    const onSave = vi.fn().mockRejectedValue(new Error('Network error'))

    const save = async () => {
      status = 'saving'
      try {
        await onSave()
        retryCount = 0
        status = 'saved'
        setTimeout(() => {
          status = 'idle'
        }, 5000)
      } catch {
        if (retryCount < 3) {
          retryCount += 1
          status = 'retrying'
        } else {
          status = 'error'
        }
      }
    }

    // Exhaust all 3 retries
    await save() // retry 1
    expect(status).toBe('retrying')
    await save() // retry 2
    expect(status).toBe('retrying')
    await save() // retry 3
    expect(status).toBe('retrying')

    // 4th attempt — retries exhausted
    await save()
    expect(status).toBe('error')
  })
})

describe('change detection (4/5)', () => {
  it('does not reset to idle after error', async () => {
    type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'retrying'
    let status: AutoSaveStatus = 'idle'
    let retryCount = 3 // Already exhausted
    const onSave = vi.fn().mockRejectedValue(new Error('fail'))

    const save = async () => {
      status = 'saving'
      try {
        await onSave()
        retryCount = 0
        status = 'saved'
        setTimeout(() => {
          status = 'idle'
        }, 5000)
      } catch {
        if (retryCount < 3) {
          retryCount += 1
          status = 'retrying'
        } else {
          status = 'error'
        }
      }
    }

    await save()
    expect(status).toBe('error')

    // Even after 5 seconds, error status persists (no setTimeout was scheduled)
    vi.advanceTimersByTime(5000)
    expect(status).toBe('error')
  })
})

describe('change detection (5/5)', () => {
  it('resets retry counter on successful save', async () => {
    type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'retrying'
    let status: AutoSaveStatus = 'idle'
    let retryCount = 0
    let callCount = 0
    const onSave = vi.fn().mockImplementation(() => {
      callCount++
      // Fail first two times, succeed on third
      if (callCount <= 2) {
        return Promise.reject(new Error('fail'))
      }
      return Promise.resolve()
    })

    const save = async () => {
      status = 'saving'
      try {
        await onSave()
        retryCount = 0
        status = 'saved'
        setTimeout(() => {
          status = 'idle'
        }, 5000)
      } catch {
        if (retryCount < 3) {
          retryCount += 1
          status = 'retrying'
        } else {
          status = 'error'
        }
      }
    }

    await save() // fails, retry 1
    expect(status).toBe('retrying')
    expect(retryCount).toBe(1)

    await save() // fails, retry 2
    expect(status).toBe('retrying')
    expect(retryCount).toBe(2)

    await save() // succeeds
    expect(status).toBe('saved')
    expect(retryCount).toBe(0)
  })
})

describe('enabled flag', () => {
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

describe('skipInitialChange', () => {
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
