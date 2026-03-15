'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_PREFIX = 'bullhorn-draft-'
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const DEBOUNCE_MS = 1000

interface StoredDraft<T> {
  data: T
  savedAt: string
}

interface UseLocalDraftReturn<T> {
  draft: T | null
  hasDraft: boolean
  saveDraft: (data: T) => void
  clearDraft: () => void
}

function getStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`
}

function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(getStorageKey(key))
    if (!raw) return null

    const parsed: StoredDraft<T> = JSON.parse(raw)
    const savedAt = new Date(parsed.savedAt).getTime()

    if (Date.now() - savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(getStorageKey(key))
      return null
    }

    return parsed.data
  } catch {
    try {
      localStorage.removeItem(getStorageKey(key))
    } catch {
      // ignore cleanup failure
    }
    return null
  }
}

function writeDraft<T>(key: string, data: T): void {
  try {
    const stored: StoredDraft<T> = {
      data,
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(getStorageKey(key), JSON.stringify(stored))
  } catch {
    // Quota exceeded or private browsing — silently ignore
  }
}

function removeDraft(key: string): void {
  try {
    localStorage.removeItem(getStorageKey(key))
  } catch {
    // Private browsing — silently ignore
  }
}

export function useLocalDraft<T>(key: string): UseLocalDraftReturn<T> {
  const [draft, setDraft] = useState<T | null>(() => readDraft<T>(key))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const saveDraft = useCallback(
    (data: T) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        writeDraft(key, data)
        setDraft(data)
      }, DEBOUNCE_MS)
    },
    [key]
  )

  const clearDraft = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    removeDraft(key)
    setDraft(null)
  }, [key])

  return {
    draft,
    hasDraft: draft !== null,
    saveDraft,
    clearDraft,
  }
}
