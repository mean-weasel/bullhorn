import { describe, it, expect, vi, beforeEach } from 'vitest'
import { clearInFlightRequests } from './requestDedup'
import { PLAN_LIMITS } from './limits'

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
global.fetch = mockFetch

import { usePlanStore } from './planStore'

beforeEach(() => {
  mockFetch.mockReset()
  clearInFlightRequests()
  usePlanStore.getState().reset()
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeFreePlanResponse = (overrides = {}) => ({
  plan: 'free',
  limits: {
    posts: { current: 5, limit: PLAN_LIMITS.free.posts },
    campaigns: { current: 2, limit: PLAN_LIMITS.free.campaigns },
    projects: { current: 1, limit: PLAN_LIMITS.free.projects },
    blogDrafts: { current: 3, limit: PLAN_LIMITS.free.blogDrafts },
    launchPosts: { current: 0, limit: PLAN_LIMITS.free.launchPosts },
    apiKeys: { current: 1, limit: PLAN_LIMITS.free.apiKeys },
  },
  storage: { usedBytes: 1024 * 1024, limitBytes: PLAN_LIMITS.free.storageBytes },
  ...overrides,
})

const makeProPlanResponse = (overrides = {}) => ({
  plan: 'pro',
  limits: {
    posts: { current: 50, limit: PLAN_LIMITS.pro.posts },
    campaigns: { current: 10, limit: PLAN_LIMITS.pro.campaigns },
    projects: { current: 5, limit: PLAN_LIMITS.pro.projects },
    blogDrafts: { current: 20, limit: PLAN_LIMITS.pro.blogDrafts },
    launchPosts: { current: 15, limit: PLAN_LIMITS.pro.launchPosts },
    apiKeys: { current: 5, limit: PLAN_LIMITS.pro.apiKeys },
  },
  storage: { usedBytes: 100 * 1024 * 1024, limitBytes: PLAN_LIMITS.pro.storageBytes },
  ...overrides,
})

// ---------------------------------------------------------------------------
// fetchPlan
// ---------------------------------------------------------------------------

describe('usePlanStore', () => {
  describe('fetchPlan', () => {
    it('should set loading true while fetching', async () => {
      let capturedLoading = false
      mockFetch.mockImplementation(() => {
        capturedLoading = usePlanStore.getState().loading
        return Promise.resolve({
          ok: true,
          json: async () => makeFreePlanResponse(),
        })
      })

      await usePlanStore.getState().fetchPlan()
      expect(capturedLoading).toBe(true)
    })

    it('should populate plan data on success (free tier)', async () => {
      const planData = makeFreePlanResponse()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => planData,
      })

      await usePlanStore.getState().fetchPlan()

      const state = usePlanStore.getState()
      expect(state.plan).toBe('free')
      expect(state.limits.posts).toEqual({ current: 5, limit: PLAN_LIMITS.free.posts })
      expect(state.limits.campaigns).toEqual({ current: 2, limit: PLAN_LIMITS.free.campaigns })
      expect(state.storage.usedBytes).toBe(1024 * 1024)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.initialized).toBe(true)
    })

    it('should populate plan data on success (pro tier)', async () => {
      const planData = makeProPlanResponse()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => planData,
      })

      await usePlanStore.getState().fetchPlan()

      const state = usePlanStore.getState()
      expect(state.plan).toBe('pro')
      expect(state.limits.posts.limit).toBe(PLAN_LIMITS.pro.posts)
      expect(state.storage.limitBytes).toBe(PLAN_LIMITS.pro.storageBytes)
    })

    it('should set initialized after first fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeFreePlanResponse(),
      })

      expect(usePlanStore.getState().initialized).toBe(false)
      await usePlanStore.getState().fetchPlan()
      expect(usePlanStore.getState().initialized).toBe(true)
    })

    it('should set error on failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false })

      await usePlanStore.getState().fetchPlan()

      const state = usePlanStore.getState()
      expect(state.error).toBe('Failed to fetch plan')
      expect(state.loading).toBe(false)
    })

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await usePlanStore.getState().fetchPlan()

      expect(usePlanStore.getState().error).toBe('Network error')
    })

    it('should call /api/plan endpoint', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makeFreePlanResponse(),
      })

      await usePlanStore.getState().fetchPlan()

      expect(mockFetch).toHaveBeenCalledWith('/api/plan')
    })

    it('should deduplicate concurrent calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeFreePlanResponse(),
      })

      await Promise.all([usePlanStore.getState().fetchPlan(), usePlanStore.getState().fetchPlan()])

      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  // ---------------------------------------------------------------------------
  // isAtLimit
  // ---------------------------------------------------------------------------

  describe('isAtLimit', () => {
    it('should return true when current equals limit', () => {
      usePlanStore.setState({
        limits: {
          posts: { current: 50, limit: 50 },
          campaigns: { current: 0, limit: 5 },
          projects: { current: 0, limit: 3 },
          blogDrafts: { current: 0, limit: 10 },
          launchPosts: { current: 0, limit: 10 },
          apiKeys: { current: 0, limit: 5 },
        },
      })

      expect(usePlanStore.getState().isAtLimit('posts')).toBe(true)
    })

    it('should return true when current exceeds limit', () => {
      usePlanStore.setState({
        limits: {
          posts: { current: 55, limit: 50 },
          campaigns: { current: 0, limit: 5 },
          projects: { current: 0, limit: 3 },
          blogDrafts: { current: 0, limit: 10 },
          launchPosts: { current: 0, limit: 10 },
          apiKeys: { current: 0, limit: 5 },
        },
      })

      expect(usePlanStore.getState().isAtLimit('posts')).toBe(true)
    })

    it('should return false when current is below limit', () => {
      usePlanStore.setState({
        limits: {
          posts: { current: 5, limit: 50 },
          campaigns: { current: 0, limit: 5 },
          projects: { current: 0, limit: 3 },
          blogDrafts: { current: 0, limit: 10 },
          launchPosts: { current: 0, limit: 10 },
          apiKeys: { current: 0, limit: 5 },
        },
      })

      expect(usePlanStore.getState().isAtLimit('posts')).toBe(false)
    })

    it('should check each resource type independently', () => {
      usePlanStore.setState({
        limits: {
          posts: { current: 5, limit: 50 },
          campaigns: { current: 5, limit: 5 },
          projects: { current: 3, limit: 3 },
          blogDrafts: { current: 0, limit: 10 },
          launchPosts: { current: 10, limit: 10 },
          apiKeys: { current: 0, limit: 5 },
        },
      })

      expect(usePlanStore.getState().isAtLimit('posts')).toBe(false)
      expect(usePlanStore.getState().isAtLimit('campaigns')).toBe(true)
      expect(usePlanStore.getState().isAtLimit('projects')).toBe(true)
      expect(usePlanStore.getState().isAtLimit('blogDrafts')).toBe(false)
      expect(usePlanStore.getState().isAtLimit('launchPosts')).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // incrementCount
  // ---------------------------------------------------------------------------

  describe('incrementCount', () => {
    it('should increment the current count for a resource', () => {
      usePlanStore.setState({
        limits: {
          posts: { current: 5, limit: 50 },
          campaigns: { current: 2, limit: 5 },
          projects: { current: 1, limit: 3 },
          blogDrafts: { current: 0, limit: 10 },
          launchPosts: { current: 0, limit: 10 },
          apiKeys: { current: 0, limit: 5 },
        },
      })

      usePlanStore.getState().incrementCount('posts')

      expect(usePlanStore.getState().limits.posts.current).toBe(6)
      // other resources unchanged
      expect(usePlanStore.getState().limits.campaigns.current).toBe(2)
    })

    it('should increment even beyond the limit', () => {
      usePlanStore.setState({
        limits: {
          posts: { current: 50, limit: 50 },
          campaigns: { current: 0, limit: 5 },
          projects: { current: 0, limit: 3 },
          blogDrafts: { current: 0, limit: 10 },
          launchPosts: { current: 0, limit: 10 },
          apiKeys: { current: 0, limit: 5 },
        },
      })

      usePlanStore.getState().incrementCount('posts')

      expect(usePlanStore.getState().limits.posts.current).toBe(51)
    })
  })

  // ---------------------------------------------------------------------------
  // decrementCount
  // ---------------------------------------------------------------------------

  describe('decrementCount', () => {
    it('should decrement the current count for a resource', () => {
      usePlanStore.setState({
        limits: {
          posts: { current: 5, limit: 50 },
          campaigns: { current: 2, limit: 5 },
          projects: { current: 1, limit: 3 },
          blogDrafts: { current: 3, limit: 10 },
          launchPosts: { current: 0, limit: 10 },
          apiKeys: { current: 0, limit: 5 },
        },
      })

      usePlanStore.getState().decrementCount('campaigns')

      expect(usePlanStore.getState().limits.campaigns.current).toBe(1)
      // other resources unchanged
      expect(usePlanStore.getState().limits.posts.current).toBe(5)
    })

    it('should not go below zero', () => {
      usePlanStore.setState({
        limits: {
          posts: { current: 0, limit: 50 },
          campaigns: { current: 0, limit: 5 },
          projects: { current: 0, limit: 3 },
          blogDrafts: { current: 0, limit: 10 },
          launchPosts: { current: 0, limit: 10 },
          apiKeys: { current: 0, limit: 5 },
        },
      })

      usePlanStore.getState().decrementCount('posts')

      expect(usePlanStore.getState().limits.posts.current).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('should reset state to initial values', () => {
      usePlanStore.setState({
        plan: 'pro',
        limits: {
          posts: { current: 100, limit: 500 },
          campaigns: { current: 20, limit: 50 },
          projects: { current: 10, limit: 20 },
          blogDrafts: { current: 50, limit: 100 },
          launchPosts: { current: 25, limit: 100 },
          apiKeys: { current: 10, limit: 25 },
        },
        storage: { usedBytes: 500000000, limitBytes: PLAN_LIMITS.pro.storageBytes },
        loading: true,
        error: 'some error',
        initialized: true,
      })

      usePlanStore.getState().reset()

      const state = usePlanStore.getState()
      expect(state.plan).toBe('free')
      expect(state.limits.posts).toEqual({ current: 0, limit: PLAN_LIMITS.free.posts })
      expect(state.storage).toEqual({
        usedBytes: 0,
        limitBytes: PLAN_LIMITS.free.storageBytes,
      })
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(state.initialized).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------

  describe('initial state', () => {
    it('should start with free plan defaults', () => {
      usePlanStore.getState().reset()
      const state = usePlanStore.getState()

      expect(state.plan).toBe('free')
      expect(state.limits.posts.limit).toBe(PLAN_LIMITS.free.posts)
      expect(state.limits.campaigns.limit).toBe(PLAN_LIMITS.free.campaigns)
      expect(state.limits.projects.limit).toBe(PLAN_LIMITS.free.projects)
      expect(state.limits.blogDrafts.limit).toBe(PLAN_LIMITS.free.blogDrafts)
      expect(state.limits.launchPosts.limit).toBe(PLAN_LIMITS.free.launchPosts)
      expect(state.storage.limitBytes).toBe(PLAN_LIMITS.free.storageBytes)
    })

    it('should start with zero current counts', () => {
      usePlanStore.getState().reset()
      const state = usePlanStore.getState()

      expect(state.limits.posts.current).toBe(0)
      expect(state.limits.campaigns.current).toBe(0)
      expect(state.limits.projects.current).toBe(0)
      expect(state.limits.blogDrafts.current).toBe(0)
      expect(state.limits.launchPosts.current).toBe(0)
      expect(state.storage.usedBytes).toBe(0)
    })
  })
})
