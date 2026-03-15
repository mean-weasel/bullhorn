import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCampaignsStore } from './campaigns'
import { clearInFlightRequests } from './requestDedup'
import type { Campaign } from './posts'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => {
  mockFetch.mockReset()
  clearInFlightRequests()
  useCampaignsStore.setState({
    campaigns: [],
    loading: false,
    error: null,
    initialized: false,
  })
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeCampaign = (overrides: Partial<Campaign> = {}): Campaign => ({
  id: 'camp-1',
  name: 'Test Campaign',
  description: 'A test campaign',
  status: 'active' as const,
  projectId: 'proj-1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
})

// ---------------------------------------------------------------------------
// getCampaignsByProject
// ---------------------------------------------------------------------------

describe('getCampaignsByProject', () => {
  it('should filter campaigns by projectId', () => {
    useCampaignsStore.setState({
      campaigns: [
        makeCampaign({ id: '1', projectId: 'proj-1' }),
        makeCampaign({ id: '2', projectId: 'proj-2' }),
        makeCampaign({ id: '3', projectId: 'proj-1' }),
      ],
    })

    const result = useCampaignsStore.getState().getCampaignsByProject('proj-1')
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toEqual(['1', '3'])
  })

  it('should return unassigned campaigns when projectId is null', () => {
    useCampaignsStore.setState({
      campaigns: [
        makeCampaign({ id: '1', projectId: 'proj-1' }),
        makeCampaign({ id: '2', projectId: undefined }),
      ],
    })

    const result = useCampaignsStore.getState().getCampaignsByProject(null)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })
})

// ---------------------------------------------------------------------------
// getCampaignWithPosts
// ---------------------------------------------------------------------------

describe('getCampaignWithPosts', () => {
  it('should fetch campaign detail with posts', async () => {
    const campaign = makeCampaign()
    const posts = [{ id: 'post-1', content: { text: 'hello' } }]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaign, posts }),
    })

    const result = await useCampaignsStore.getState().getCampaignWithPosts('camp-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/camp-1')
    expect(result).toEqual({ campaign, posts })
  })

  it('should return undefined on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    const result = await useCampaignsStore.getState().getCampaignWithPosts('camp-1')
    expect(result).toBeUndefined()
  })

  it('should return undefined on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const result = await useCampaignsStore.getState().getCampaignWithPosts('camp-1')
    expect(result).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// addPostToCampaign
// ---------------------------------------------------------------------------

describe('addPostToCampaign', () => {
  it('should POST to the campaign posts endpoint', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    await useCampaignsStore.getState().addPostToCampaign('camp-1', 'post-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/camp-1/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId: 'post-1' }),
    })
  })

  it('should set error and throw on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    await expect(
      useCampaignsStore.getState().addPostToCampaign('camp-1', 'post-1')
    ).rejects.toThrow('Failed to add post to campaign')

    expect(useCampaignsStore.getState().error).toBe('Failed to add post to campaign')
  })
})

// ---------------------------------------------------------------------------
// removePostFromCampaign
// ---------------------------------------------------------------------------

describe('removePostFromCampaign', () => {
  it('should DELETE the post from the campaign', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })

    await useCampaignsStore.getState().removePostFromCampaign('camp-1', 'post-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/camp-1/posts/post-1', {
      method: 'DELETE',
    })
  })

  it('should set error and throw on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    await expect(
      useCampaignsStore.getState().removePostFromCampaign('camp-1', 'post-1')
    ).rejects.toThrow('Failed to remove post from campaign')
  })
})

// ---------------------------------------------------------------------------
// moveCampaignToProject
// ---------------------------------------------------------------------------

describe('moveCampaignToProject', () => {
  it('should PATCH campaign with new projectId', async () => {
    useCampaignsStore.setState({ campaigns: [makeCampaign()] })

    const updated = makeCampaign({ projectId: 'proj-2' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaign: updated }),
    })

    await useCampaignsStore.getState().moveCampaignToProject('camp-1', 'proj-2')

    expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/camp-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: 'proj-2' }),
    })
    expect(useCampaignsStore.getState().campaigns[0].projectId).toBe('proj-2')
  })

  it('should set error and throw on failure', async () => {
    useCampaignsStore.setState({ campaigns: [makeCampaign()] })
    mockFetch.mockResolvedValueOnce({ ok: false })

    await expect(
      useCampaignsStore.getState().moveCampaignToProject('camp-1', 'proj-2')
    ).rejects.toThrow('Failed to move campaign to project')

    expect(useCampaignsStore.getState().error).toBe('Failed to move campaign to project')
  })
})
