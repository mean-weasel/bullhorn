import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useBlogDraftsStore } from './blogDrafts'
import { clearInFlightRequests } from './requestDedup'
import type { BlogDraft } from './blogDrafts'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
  clearInFlightRequests()
  useBlogDraftsStore.setState({
    drafts: [],
    loading: false,
    error: null,
    initialized: false,
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeDraft = (overrides: Partial<BlogDraft> = {}): BlogDraft => ({
  id: 'draft-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  scheduledAt: null,
  status: 'draft',
  title: 'Test Draft',
  date: null,
  content: 'Some content',
  wordCount: 2,
  images: [],
  tags: [],
  ...overrides,
})

// ---------------------------------------------------------------------------
// fetchDrafts — success cases
// ---------------------------------------------------------------------------

describe('fetchDrafts success', () => {
  it('should set loading true while fetching', async () => {
    let capturedLoading = false
    mockFetch.mockImplementation(() => {
      capturedLoading = useBlogDraftsStore.getState().loading
      return Promise.resolve({
        ok: true,
        json: async () => ({ drafts: [] }),
      })
    })

    await useBlogDraftsStore.getState().fetchDrafts()
    expect(capturedLoading).toBe(true)
  })

  it('should populate drafts on success', async () => {
    const drafts = [makeDraft(), makeDraft({ id: 'draft-2', title: 'Second' })]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ drafts }),
    })

    await useBlogDraftsStore.getState().fetchDrafts()

    const state = useBlogDraftsStore.getState()
    expect(state.drafts).toEqual(drafts)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('should set initialized after first fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ drafts: [] }),
    })

    expect(useBlogDraftsStore.getState().initialized).toBe(false)
    await useBlogDraftsStore.getState().fetchDrafts()
    expect(useBlogDraftsStore.getState().initialized).toBe(true)
  })

  it('should deduplicate concurrent calls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ drafts: [] }),
    })

    await Promise.all([
      useBlogDraftsStore.getState().fetchDrafts(),
      useBlogDraftsStore.getState().fetchDrafts(),
    ])

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// fetchDrafts — error / edge cases
// ---------------------------------------------------------------------------

describe('fetchDrafts errors', () => {
  it('should set error on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    await useBlogDraftsStore.getState().fetchDrafts()

    const state = useBlogDraftsStore.getState()
    expect(state.error).toBe('Failed to fetch blog drafts')
    expect(state.loading).toBe(false)
  })

  it('should handle network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await useBlogDraftsStore.getState().fetchDrafts()
    expect(useBlogDraftsStore.getState().error).toBe('Network error')
  })

  it('should default to empty array when response has no drafts key', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    await useBlogDraftsStore.getState().fetchDrafts()
    expect(useBlogDraftsStore.getState().drafts).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// addDraft
// ---------------------------------------------------------------------------

describe('addDraft (1/2)', () => {
  it('should POST to /api/blog-drafts and add to items', async () => {
    const newDraft = makeDraft()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ draft: newDraft }),
    })

    const result = await useBlogDraftsStore.getState().addDraft({
      title: 'Test Draft',
      content: 'Some content',
      status: 'draft',
      scheduledAt: null,
      date: null,
    })

    expect(mockFetch).toHaveBeenCalledWith('/api/blog-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.any(String),
    })
    expect(result).toEqual(newDraft)
    expect(useBlogDraftsStore.getState().drafts).toHaveLength(1)
  })

  it('should prepend new draft to existing list', async () => {
    useBlogDraftsStore.setState({ drafts: [makeDraft({ id: 'existing' })] })

    const newDraft = makeDraft({ id: 'new-1' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ draft: newDraft }),
    })

    await useBlogDraftsStore.getState().addDraft({
      title: 'New',
      content: '',
      status: 'draft',
      scheduledAt: null,
      date: null,
    })

    const drafts = useBlogDraftsStore.getState().drafts
    expect(drafts).toHaveLength(2)
    expect(drafts[0].id).toBe('new-1')
    expect(drafts[1].id).toBe('existing')
  })
})

describe('addDraft (2/2)', () => {
  it('should set error and throw on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    await expect(
      useBlogDraftsStore.getState().addDraft({
        title: 'Fail',
        content: '',
        status: 'draft',
        scheduledAt: null,
        date: null,
      })
    ).rejects.toThrow('Failed to create blog draft')

    expect(useBlogDraftsStore.getState().error).toBe('Failed to create blog draft')
    expect(useBlogDraftsStore.getState().loading).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// updateDraft / deleteDraft
// ---------------------------------------------------------------------------

describe('updateDraft', () => {
  it('should PATCH and update the draft in state', async () => {
    useBlogDraftsStore.setState({ drafts: [makeDraft()] })

    const updated = makeDraft({ title: 'Updated Title' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ draft: updated }),
    })

    await useBlogDraftsStore.getState().updateDraft('draft-1', { title: 'Updated Title' })

    expect(mockFetch).toHaveBeenCalledWith('/api/blog-drafts/draft-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Title' }),
    })
    expect(useBlogDraftsStore.getState().drafts[0].title).toBe('Updated Title')
  })

  it('should set error and throw on failure', async () => {
    useBlogDraftsStore.setState({ drafts: [makeDraft()] })
    mockFetch.mockResolvedValueOnce({ ok: false })

    await expect(
      useBlogDraftsStore.getState().updateDraft('draft-1', { title: 'Fail' })
    ).rejects.toThrow('Failed to update blog draft')

    expect(useBlogDraftsStore.getState().error).toBe('Failed to update blog draft')
  })
})

describe('deleteDraft', () => {
  it('should DELETE and remove the draft from state', async () => {
    useBlogDraftsStore.setState({
      drafts: [makeDraft({ id: 'draft-1' }), makeDraft({ id: 'draft-2' })],
    })

    mockFetch.mockResolvedValueOnce({ ok: true })

    await useBlogDraftsStore.getState().deleteDraft('draft-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/blog-drafts/draft-1', { method: 'DELETE' })
    const drafts = useBlogDraftsStore.getState().drafts
    expect(drafts).toHaveLength(1)
    expect(drafts[0].id).toBe('draft-2')
  })

  it('should set error and throw on failure', async () => {
    useBlogDraftsStore.setState({ drafts: [makeDraft()] })
    mockFetch.mockResolvedValueOnce({ ok: false })

    await expect(useBlogDraftsStore.getState().deleteDraft('draft-1')).rejects.toThrow(
      'Failed to delete blog draft'
    )

    expect(useBlogDraftsStore.getState().error).toBe('Failed to delete blog draft')
  })
})
