import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useBlogDraftsStore } from './blogDrafts'
import { clearInFlightRequests } from './requestDedup'
import type { BlogDraft } from './blogDrafts'

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
// archiveDraft
// ---------------------------------------------------------------------------

describe('archiveDraft', () => {
  it('should POST to archive endpoint and update draft in state', async () => {
    useBlogDraftsStore.setState({ drafts: [makeDraft()] })

    const archived = makeDraft({ status: 'archived' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ draft: archived }),
    })

    await useBlogDraftsStore.getState().archiveDraft('draft-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/blog-drafts/draft-1/archive', {
      method: 'POST',
    })
    expect(useBlogDraftsStore.getState().drafts[0].status).toBe('archived')
  })

  it('should set error and throw on failure', async () => {
    useBlogDraftsStore.setState({ drafts: [makeDraft()] })
    mockFetch.mockResolvedValueOnce({ ok: false })

    await expect(useBlogDraftsStore.getState().archiveDraft('draft-1')).rejects.toThrow(
      'Failed to archive blog draft'
    )

    expect(useBlogDraftsStore.getState().error).toBe('Failed to archive blog draft')
  })
})

// ---------------------------------------------------------------------------
// restoreDraft
// ---------------------------------------------------------------------------

describe('restoreDraft', () => {
  it('should POST to restore endpoint and update draft in state', async () => {
    useBlogDraftsStore.setState({ drafts: [makeDraft({ status: 'archived' })] })

    const restored = makeDraft({ status: 'draft' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ draft: restored }),
    })

    await useBlogDraftsStore.getState().restoreDraft('draft-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/blog-drafts/draft-1/restore', {
      method: 'POST',
    })
    expect(useBlogDraftsStore.getState().drafts[0].status).toBe('draft')
  })

  it('should set error and throw on failure', async () => {
    useBlogDraftsStore.setState({ drafts: [makeDraft({ status: 'archived' })] })
    mockFetch.mockResolvedValueOnce({ ok: false })

    await expect(useBlogDraftsStore.getState().restoreDraft('draft-1')).rejects.toThrow(
      'Failed to restore blog draft'
    )

    expect(useBlogDraftsStore.getState().error).toBe('Failed to restore blog draft')
  })
})

// ---------------------------------------------------------------------------
// getDraft / getDraftsByStatus / searchDrafts
// ---------------------------------------------------------------------------

describe('getDraft', () => {
  it('should return a draft by id', () => {
    const draft = makeDraft()
    useBlogDraftsStore.setState({ drafts: [draft] })
    expect(useBlogDraftsStore.getState().getDraft('draft-1')).toEqual(draft)
  })

  it('should return undefined for unknown id', () => {
    useBlogDraftsStore.setState({ drafts: [makeDraft()] })
    expect(useBlogDraftsStore.getState().getDraft('nonexistent')).toBeUndefined()
  })
})

describe('getDraftsByStatus', () => {
  it('should filter drafts by status', () => {
    useBlogDraftsStore.setState({
      drafts: [
        makeDraft({ id: '1', status: 'draft' }),
        makeDraft({ id: '2', status: 'published' }),
        makeDraft({ id: '3', status: 'draft' }),
      ],
    })

    const result = useBlogDraftsStore.getState().getDraftsByStatus('draft')
    expect(result).toHaveLength(2)
    expect(result.map((d) => d.id)).toEqual(['1', '3'])
  })

  it('should return all drafts when no status provided', () => {
    useBlogDraftsStore.setState({
      drafts: [makeDraft({ id: '1' }), makeDraft({ id: '2' })],
    })

    expect(useBlogDraftsStore.getState().getDraftsByStatus()).toHaveLength(2)
  })
})

describe('searchDrafts', () => {
  it('should call search API with encoded query', async () => {
    const results = [makeDraft({ id: 'found-1' })]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ drafts: results }),
    })

    const found = await useBlogDraftsStore.getState().searchDrafts('test query')

    expect(mockFetch).toHaveBeenCalledWith('/api/blog-drafts/search?q=test%20query')
    expect(found).toEqual(results)
  })

  it('should return empty array on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    const result = await useBlogDraftsStore.getState().searchDrafts('fail')
    expect(result).toEqual([])
  })

  it('should return empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await useBlogDraftsStore.getState().searchDrafts('error')
    expect(result).toEqual([])
  })

  it('should default to empty array when response has no drafts key', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    const result = await useBlogDraftsStore.getState().searchDrafts('empty')
    expect(result).toEqual([])
  })
})
