import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()
const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDelete = vi.fn()

vi.mock('./client.js', () => ({
  BullhornClient: class {
    get = mockGet
    post = mockPost
    patch = mockPatch
    delete = mockDelete
  },
}))

import * as storage from './storage.js'
import { _resetClient } from './storage.js'
import {
  handleCreateCampaign,
  handleListCampaigns,
  handleGetCampaign,
  handleDeleteCampaign,
  handleAddPostToCampaign,
  handleRemovePostFromCampaign,
} from './test-helpers.js'

const s = storage

describe('Campaign Tool Handlers', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPatch.mockReset()
    mockDelete.mockReset()
    _resetClient()
  })

  describe('create_campaign', () => {
    it('should return error when name is empty', async () => {
      const result = await handleCreateCampaign(s, { name: '' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Campaign name is required')
    })

    it('should return error when name is whitespace only', async () => {
      const result = await handleCreateCampaign(s, { name: '   ' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Campaign name is required')
    })

    it('should create campaign with trimmed name', async () => {
      const mockCampaign = { id: 'campaign-1', name: 'Test', status: 'draft' }
      mockPost.mockResolvedValueOnce({ campaign: mockCampaign })

      const result = await handleCreateCampaign(s, { name: '  Test  ' })
      expect(result.isError).toBeUndefined()

      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.campaign).toEqual(mockCampaign)
      expect(mockPost).toHaveBeenCalledWith('/campaigns', {
        name: 'Test',
        description: null,
        status: 'active',
      })
    })

    it('should pass description and status when provided', async () => {
      const mockCampaign = { id: 'campaign-1', name: 'Test', description: 'Desc', status: 'active' }
      mockPost.mockResolvedValueOnce({ campaign: mockCampaign })

      await handleCreateCampaign(s, { name: 'Test', description: 'Desc', status: 'active' })
      expect(mockPost).toHaveBeenCalledWith('/campaigns', {
        name: 'Test',
        description: 'Desc',
        status: 'active',
      })
    })
  })

  describe('list_campaigns', () => {
    it('should return campaigns list', async () => {
      const mockCampaigns = [{ id: 'c1' }, { id: 'c2' }]
      mockGet.mockResolvedValueOnce({ campaigns: mockCampaigns })

      const result = await handleListCampaigns(s, {})
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.count).toBe(2)
      expect(response.campaigns).toEqual(mockCampaigns)
    })

    it('should use default limit of 50', async () => {
      mockGet.mockResolvedValueOnce({ campaigns: [] })
      await handleListCampaigns(s, {})
      expect(mockGet).toHaveBeenCalledWith('/campaigns', { limit: '50' })
    })

    it('should pass custom limit', async () => {
      mockGet.mockResolvedValueOnce({ campaigns: [] })
      await handleListCampaigns(s, { limit: 10 })
      expect(mockGet).toHaveBeenCalledWith('/campaigns', { limit: '10' })
    })
  })

  describe('get_campaign', () => {
    it('should return error when campaign not found', async () => {
      mockGet.mockRejectedValueOnce(new Error('Not found'))
      const result = await handleGetCampaign(s, { id: 'nonexistent' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Campaign with ID nonexistent not found')
    })

    it('should return campaign with posts when found', async () => {
      const mockResult = { campaign: { id: 'c1', name: 'Test' }, posts: [{ id: 'p1' }] }
      mockGet.mockResolvedValueOnce(mockResult)

      const result = await handleGetCampaign(s, { id: 'c1' })
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.campaign).toEqual(mockResult.campaign)
      expect(response.posts).toEqual(mockResult.posts)
    })
  })

  describe('delete_campaign', () => {
    it('should return error when campaign not found', async () => {
      mockDelete.mockRejectedValueOnce(new Error('Not found'))
      const result = await handleDeleteCampaign(s, { id: 'nonexistent' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Campaign with ID nonexistent not found')
    })

    it('should return success message when deleted', async () => {
      mockDelete.mockResolvedValueOnce({})
      const result = await handleDeleteCampaign(s, { id: 'c1' })
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.message).toContain('Campaign c1 deleted')
    })
  })

  describe('add_post_to_campaign', () => {
    it('should return error when campaign or post not found', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Not found'))
      const result = await handleAddPostToCampaign(s, { campaignId: 'c1', postId: 'p1' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Campaign or post not found')
    })

    it('should return updated post when successful', async () => {
      const mockPostData = { id: 'p1', campaignId: 'c1' }
      mockPatch.mockResolvedValueOnce({ post: mockPostData })

      const result = await handleAddPostToCampaign(s, { campaignId: 'c1', postId: 'p1' })
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.post).toEqual(mockPostData)
    })
  })

  describe('remove_post_from_campaign', () => {
    it('should return error when post not found', async () => {
      mockPatch.mockRejectedValueOnce(new Error('Not found'))
      const result = await handleRemovePostFromCampaign(s, { campaignId: 'c1', postId: 'p1' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Post not found')
    })

    it('should return updated post when successful', async () => {
      const mockPostData = { id: 'p1', campaignId: undefined }
      mockPatch.mockResolvedValueOnce({ post: mockPostData })

      const result = await handleRemovePostFromCampaign(s, { campaignId: 'c1', postId: 'p1' })
      const response = JSON.parse(result.content[0].text)
      expect(response.success).toBe(true)
      expect(response.post).toEqual(mockPostData)
    })
  })
})
