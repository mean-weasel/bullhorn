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
// fetchCampaigns
// ---------------------------------------------------------------------------

describe('fetchCampaigns (1/3)', () => {
  it('should set loading true while fetching', async () => {
    let capturedLoading = false
    mockFetch.mockImplementation(() => {
      capturedLoading = useCampaignsStore.getState().loading
      return Promise.resolve({
        ok: true,
        json: async () => ({ campaigns: [] }),
      })
    })

    await useCampaignsStore.getState().fetchCampaigns()
    expect(capturedLoading).toBe(true)
  })

  it('should populate campaigns on success', async () => {
    const campaigns = [makeCampaign(), makeCampaign({ id: 'camp-2', name: 'Second' })]
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns }),
    })

    await useCampaignsStore.getState().fetchCampaigns()

    const state = useCampaignsStore.getState()
    expect(state.campaigns).toEqual(campaigns)
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('should set initialized after first fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: [] }),
    })

    expect(useCampaignsStore.getState().initialized).toBe(false)
    await useCampaignsStore.getState().fetchCampaigns()
    expect(useCampaignsStore.getState().initialized).toBe(true)
  })
})

describe('fetchCampaigns (2/3)', () => {
  it('should set error on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    await useCampaignsStore.getState().fetchCampaigns()

    const state = useCampaignsStore.getState()
    expect(state.error).toBe('Failed to fetch campaigns')
    expect(state.loading).toBe(false)
  })

  it('should handle network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    await useCampaignsStore.getState().fetchCampaigns()

    expect(useCampaignsStore.getState().error).toBe('Network error')
  })

  it('should default to empty array when response has no campaigns key', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })

    await useCampaignsStore.getState().fetchCampaigns()
    expect(useCampaignsStore.getState().campaigns).toEqual([])
  })

  it('should pass projectId as query param', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaigns: [] }),
    })

    await useCampaignsStore.getState().fetchCampaigns({ projectId: 'proj-42' })

    expect(mockFetch).toHaveBeenCalledWith('/api/campaigns?projectId=proj-42')
  })
})

describe('fetchCampaigns (3/3)', () => {
  it('should deduplicate concurrent calls', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ campaigns: [] }),
    })

    await Promise.all([
      useCampaignsStore.getState().fetchCampaigns(),
      useCampaignsStore.getState().fetchCampaigns(),
    ])

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// addCampaign
// ---------------------------------------------------------------------------

describe('addCampaign', () => {
  it('should POST to /api/campaigns and add to items', async () => {
    const newCampaign = makeCampaign()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaign: newCampaign }),
    })

    const result = await useCampaignsStore
      .getState()
      .addCampaign({ name: 'Test Campaign', description: 'A test campaign' })

    expect(mockFetch).toHaveBeenCalledWith('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Campaign', description: 'A test campaign' }),
    })
    expect(result).toEqual(newCampaign)
    expect(useCampaignsStore.getState().campaigns).toHaveLength(1)
    expect(useCampaignsStore.getState().campaigns[0]).toEqual(newCampaign)
  })

  it('should prepend new campaign to existing list', async () => {
    const existing = makeCampaign({ id: 'existing-1' })
    useCampaignsStore.setState({ campaigns: [existing] })

    const newCampaign = makeCampaign({ id: 'new-1' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaign: newCampaign }),
    })

    await useCampaignsStore.getState().addCampaign({ name: 'New' })

    const campaigns = useCampaignsStore.getState().campaigns
    expect(campaigns).toHaveLength(2)
    expect(campaigns[0].id).toBe('new-1')
    expect(campaigns[1].id).toBe('existing-1')
  })

  it('should set error and throw on failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false })

    await expect(useCampaignsStore.getState().addCampaign({ name: 'Fail' })).rejects.toThrow(
      'Failed to create campaign'
    )

    expect(useCampaignsStore.getState().error).toBe('Failed to create campaign')
    expect(useCampaignsStore.getState().loading).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// updateCampaign / deleteCampaign / getCampaign / getCampaignsByStatus
// ---------------------------------------------------------------------------

describe('updateCampaign', () => {
  it('should PATCH and update the campaign in state', async () => {
    const original = makeCampaign()
    useCampaignsStore.setState({ campaigns: [original] })

    const updated = { ...original, name: 'Updated Name' }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ campaign: updated }),
    })

    await useCampaignsStore.getState().updateCampaign('camp-1', { name: 'Updated Name' })

    expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/camp-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    })
    expect(useCampaignsStore.getState().campaigns[0].name).toBe('Updated Name')
  })

  it('should set error and throw on failure', async () => {
    useCampaignsStore.setState({ campaigns: [makeCampaign()] })
    mockFetch.mockResolvedValueOnce({ ok: false })

    await expect(
      useCampaignsStore.getState().updateCampaign('camp-1', { name: 'Fail' })
    ).rejects.toThrow('Failed to update campaign')

    expect(useCampaignsStore.getState().error).toBe('Failed to update campaign')
  })
})

describe('deleteCampaign', () => {
  it('should DELETE and remove the campaign from state', async () => {
    useCampaignsStore.setState({
      campaigns: [makeCampaign({ id: 'camp-1' }), makeCampaign({ id: 'camp-2' })],
    })

    mockFetch.mockResolvedValueOnce({ ok: true })

    await useCampaignsStore.getState().deleteCampaign('camp-1')

    expect(mockFetch).toHaveBeenCalledWith('/api/campaigns/camp-1', { method: 'DELETE' })
    const campaigns = useCampaignsStore.getState().campaigns
    expect(campaigns).toHaveLength(1)
    expect(campaigns[0].id).toBe('camp-2')
  })

  it('should set error and throw on failure', async () => {
    useCampaignsStore.setState({ campaigns: [makeCampaign()] })
    mockFetch.mockResolvedValueOnce({ ok: false })

    await expect(useCampaignsStore.getState().deleteCampaign('camp-1')).rejects.toThrow(
      'Failed to delete campaign'
    )

    expect(useCampaignsStore.getState().error).toBe('Failed to delete campaign')
  })
})

describe('getCampaign', () => {
  it('should return a campaign by id', () => {
    const campaign = makeCampaign()
    useCampaignsStore.setState({ campaigns: [campaign] })
    expect(useCampaignsStore.getState().getCampaign('camp-1')).toEqual(campaign)
  })

  it('should return undefined for unknown id', () => {
    useCampaignsStore.setState({ campaigns: [makeCampaign()] })
    expect(useCampaignsStore.getState().getCampaign('nonexistent')).toBeUndefined()
  })
})

describe('getCampaignsByStatus', () => {
  it('should filter campaigns by status', () => {
    useCampaignsStore.setState({
      campaigns: [
        makeCampaign({ id: '1', status: 'active' }),
        makeCampaign({ id: '2', status: 'paused' }),
        makeCampaign({ id: '3', status: 'active' }),
      ],
    })

    const active = useCampaignsStore.getState().getCampaignsByStatus('active')
    expect(active).toHaveLength(2)
    expect(active.map((c) => c.id)).toEqual(['1', '3'])
  })

  it('should return all campaigns when no status provided', () => {
    useCampaignsStore.setState({
      campaigns: [makeCampaign({ id: '1' }), makeCampaign({ id: '2' })],
    })

    expect(useCampaignsStore.getState().getCampaignsByStatus()).toHaveLength(2)
  })
})
