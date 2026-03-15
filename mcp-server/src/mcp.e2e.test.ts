/* eslint-disable max-lines */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ListToolsResultSchema, CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

// Helper to parse tool response
function parseToolResponse(response: { content: Array<{ type: string; text?: string }> }) {
  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || !textContent.text) {
    throw new Error('No text content in response')
  }
  return JSON.parse(textContent.text)
}

// eslint-disable-next-line max-lines-per-function
describe('MCP Server E2E', () => {
  let client: Client
  let transport: StdioClientTransport
  let apiProcess: ChildProcess

   
  beforeAll(async () => {
    // 1. Build the MCP server first
    await new Promise<void>((resolve, reject) => {
      const build = spawn('npm', ['run', 'build'], {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'pipe',
      })
      build.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`Build failed with code ${code}`))
      })
    })

    // 2. Start API server
    apiProcess = spawn('npm', ['run', 'api:start'], {
      cwd: path.resolve(__dirname, '../..'),
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' },
    })

    // Wait for API server to start
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // 3. Create transport pointing to MCP server
    transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/index.js'],
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, API_URL: 'http://localhost:3001/api' },
      stderr: 'pipe',
    })

    // 4. Create client and connect
    client = new Client({ name: 'mcp-e2e-test-client', version: '1.0.0' }, { capabilities: {} })

    await client.connect(transport)
  }, 30000) // 30s timeout for setup

   
  afterAll(async () => {
    // Close client connection
    if (transport) {
      await transport.close()
    }

    // Kill API server
    if (apiProcess) {
      apiProcess.kill('SIGTERM')
    }
  })

   
  describe('Tool Discovery', () => {
     
    it('should list all available tools', async () => {
      const response = await client.request(
        { method: 'tools/list', params: {} },
        ListToolsResultSchema
      )

      expect(response.tools).toBeDefined()
      expect(response.tools.length).toBeGreaterThan(0)

      // Verify core tools exist
      const toolNames = response.tools.map((t) => t.name)
      expect(toolNames).toContain('create_post')
      expect(toolNames).toContain('list_posts')
      expect(toolNames).toContain('search_posts')
      expect(toolNames).toContain('create_campaign')
      expect(toolNames).toContain('create_reddit_crossposts')
      // Blog draft tools
      expect(toolNames).toContain('create_blog_draft')
      expect(toolNames).toContain('get_blog_draft')
      expect(toolNames).toContain('update_blog_draft')
      expect(toolNames).toContain('delete_blog_draft')
      expect(toolNames).toContain('archive_blog_draft')
      expect(toolNames).toContain('restore_blog_draft')
      expect(toolNames).toContain('list_blog_drafts')
      expect(toolNames).toContain('search_blog_drafts')
      expect(toolNames).toContain('add_image_to_draft')
      expect(toolNames).toContain('get_draft_images')
    })
  })

  // eslint-disable-next-line max-lines-per-function
  describe('Post Operations', () => {
    let createdPostId: string

     
    it('should create a post', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_post',
            arguments: {
              platform: 'twitter',
              content: { text: 'E2E test tweet from MCP' },
            },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.post).toBeDefined()
      expect(result.post.id).toBeDefined()
      expect(result.post.platform).toEqual('twitter')
      expect(result.post.status).toBe('draft')

      createdPostId = result.post.id
    })

     
    it('should list posts', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'list_posts',
            arguments: { limit: 10 },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(Array.isArray(result.posts)).toBe(true)
    })

     
    it('should get a post by id', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'get_post',
            arguments: { id: createdPostId },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.post.id).toBe(createdPostId)
    })

     
    it('should update a post', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'update_post',
            arguments: {
              id: createdPostId,
              notes: 'Updated via E2E test',
            },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.post.notes).toBe('Updated via E2E test')
    })

     
    it('should delete a post with confirmation', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'delete_post',
            arguments: { id: createdPostId, confirmed: true },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
    })

     
    it('should require confirmation for delete_post', async () => {
      // First create a post to delete
      const createResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_post',
            arguments: {
              platform: 'twitter',
              content: { text: 'Post to test deletion confirmation' },
            },
          },
        },
        CallToolResultSchema
      )
      const postId = parseToolResponse(createResponse).post.id

      // Try to delete without confirmation
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'delete_post',
            arguments: { id: postId, confirmed: false },
          },
        },
        CallToolResultSchema
      )

      // Check isError is true
      expect(response.isError).toBe(true)

      // Clean up: delete with confirmation
      await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'delete_post',
            arguments: { id: postId, confirmed: true },
          },
        },
        CallToolResultSchema
      )
    })

     
    it('should require confirmation for archive_post', async () => {
      // First create a post to archive
      const createResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_post',
            arguments: {
              platform: 'twitter',
              content: { text: 'Post to test archive confirmation' },
            },
          },
        },
        CallToolResultSchema
      )
      const postId = parseToolResponse(createResponse).post.id

      // Try to archive without confirmation
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'archive_post',
            arguments: { id: postId, confirmed: false },
          },
        },
        CallToolResultSchema
      )

      // Check isError is true
      expect(response.isError).toBe(true)

      // Clean up: delete with confirmation
      await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'delete_post',
            arguments: { id: postId, confirmed: true },
          },
        },
        CallToolResultSchema
      )
    })

     
    it('should search posts', async () => {
      // First create a post with specific content to search for
      const createResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_post',
            arguments: {
              platform: 'twitter',
              content: { text: 'UniqueSearchableContent12345' },
              notes: 'searchable notes for testing',
            },
          },
        },
        CallToolResultSchema
      )
      const postId = parseToolResponse(createResponse).post.id

      // Search for the post
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'search_posts',
            arguments: { query: 'UniqueSearchableContent12345' },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(Array.isArray(result.posts)).toBe(true)
      expect(result.posts.some((p: { id: string }) => p.id === postId)).toBe(true)

      // Clean up
      await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'delete_post',
            arguments: { id: postId, confirmed: true },
          },
        },
        CallToolResultSchema
      )
    })

     
    it('should search posts by notes', async () => {
      // First create a post with specific notes to search for
      const createResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_post',
            arguments: {
              platform: 'linkedin',
              content: { text: 'Regular content', visibility: 'public' },
              notes: 'UniqueNoteSearch98765',
            },
          },
        },
        CallToolResultSchema
      )
      const postId = parseToolResponse(createResponse).post.id

      // Search for the post by notes
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'search_posts',
            arguments: { query: 'UniqueNoteSearch98765' },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.posts.some((p: { id: string }) => p.id === postId)).toBe(true)

      // Clean up
      await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'delete_post',
            arguments: { id: postId, confirmed: true },
          },
        },
        CallToolResultSchema
      )
    })
  })

  // eslint-disable-next-line max-lines-per-function
  describe('Campaign Operations', () => {
    let campaignId: string
    let postId: string

     
    it('should create a campaign', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_campaign',
            arguments: {
              name: 'E2E Test Campaign',
              description: 'Created via MCP e2e test',
            },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.campaign.name).toBe('E2E Test Campaign')
      expect(result.campaign.status).toBe('draft')

      campaignId = result.campaign.id
    })

     
    it('should list campaigns', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'list_campaigns',
            arguments: {},
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(Array.isArray(result.campaigns)).toBe(true)
      expect(result.campaigns.some((c: { id: string }) => c.id === campaignId)).toBe(true)
    })

     
    it('should get campaign by id', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'get_campaign',
            arguments: { id: campaignId },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.campaign.id).toBe(campaignId)
    })

     
    it('should update a campaign', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'update_campaign',
            arguments: {
              id: campaignId,
              status: 'active',
            },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.campaign.status).toBe('active')
    })

     
    it('should add post to campaign', async () => {
      // First create a post
      const postResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_post',
            arguments: {
              platform: 'linkedin',
              content: { text: 'Campaign post test', visibility: 'public' },
            },
          },
        },
        CallToolResultSchema
      )
      postId = parseToolResponse(postResponse).post.id

      // Add to campaign
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'add_post_to_campaign',
            arguments: {
              campaignId: campaignId,
              postId: postId,
            },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.post.campaignId).toBe(campaignId)
    })

     
    it('should remove post from campaign', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'remove_post_from_campaign',
            arguments: {
              campaignId: campaignId,
              postId: postId,
            },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      // campaignId should be null or undefined after removal
      expect(result.post.campaignId).toBeFalsy()
    })

     
    it('should delete a campaign', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'delete_campaign',
            arguments: { id: campaignId },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
    })
  })

  // eslint-disable-next-line max-lines-per-function
  describe('Reddit Cross-Posting', () => {
     
    it('should create multiple reddit crossposts with shared groupId', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_reddit_crossposts',
            arguments: {
              subreddits: [
                {
                  subreddit: 'test1',
                  title: 'E2E Test Post 1',
                  body: 'Testing cross-post functionality',
                },
                {
                  subreddit: 'test2',
                  title: 'E2E Test Post 2',
                  body: 'Testing cross-post functionality',
                },
              ],
              status: 'draft',
              notes: 'E2E test crossposts',
            },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.posts).toHaveLength(2)

      // Verify both posts have the same groupId
      const groupId = result.posts[0].groupId
      expect(groupId).toBeDefined()
      expect(result.posts[1].groupId).toBe(groupId)

      // Verify groupType
      expect(result.posts[0].groupType).toBe('reddit-crosspost')
      expect(result.posts[1].groupType).toBe('reddit-crosspost')

      // Verify different subreddits (content is directly the platform content, not nested under platform key)
      expect(result.posts[0].content.subreddit).toBe('test1')
      expect(result.posts[1].content.subreddit).toBe('test2')
    })

     
    it('should create crossposts with individual schedules', async () => {
      const now = new Date()
      const schedule1 = new Date(now.getTime() + 3600000).toISOString() // +1 hour
      const schedule2 = new Date(now.getTime() + 7200000).toISOString() // +2 hours

      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_reddit_crossposts',
            arguments: {
              subreddits: [
                {
                  subreddit: 'scheduled1',
                  title: 'Scheduled Post 1',
                  scheduledAt: schedule1,
                },
                {
                  subreddit: 'scheduled2',
                  title: 'Scheduled Post 2',
                  scheduledAt: schedule2,
                },
              ],
              status: 'scheduled',
            },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.posts).toHaveLength(2)

      // Verify different schedules
      expect(result.posts[0].scheduledAt).toBe(schedule1)
      expect(result.posts[1].scheduledAt).toBe(schedule2)
      expect(result.posts[0].status).toBe('scheduled')
      expect(result.posts[1].status).toBe('scheduled')
    })

     
    it('should filter posts by groupId', async () => {
      // First create some crossposts
      const createResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_reddit_crossposts',
            arguments: {
              subreddits: [
                { subreddit: 'filter1', title: 'Filter Test 1' },
                { subreddit: 'filter2', title: 'Filter Test 2' },
              ],
            },
          },
        },
        CallToolResultSchema
      )

      const createResult = parseToolResponse(createResponse)
      const groupId = createResult.posts[0].groupId

      // Now filter by groupId
      const listResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'list_posts',
            arguments: { groupId },
          },
        },
        CallToolResultSchema
      )

      const listResult = parseToolResponse(listResponse)
      expect(listResult.success).toBe(true)
      // Verify all returned posts have the matching groupId
      expect(listResult.posts.length).toBeGreaterThanOrEqual(2)
      expect(listResult.posts.every((p: { groupId: string }) => p.groupId === groupId)).toBe(true)
    })
  })

  // eslint-disable-next-line max-lines-per-function
  describe('Blog Draft Operations', () => {
    let createdDraftId: string

     
    it('should create a blog draft', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_blog_draft',
            arguments: {
              title: 'E2E Test Blog Post',
              content: '# Hello World\n\nThis is a test blog post created via MCP E2E test.',
              date: '2024-06-15',
              notes: 'Private test notes',
            },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.draft).toBeDefined()
      expect(result.draft.id).toBeDefined()
      expect(result.draft.title).toBe('E2E Test Blog Post')
      expect(result.draft.status).toBe('draft')
      expect(result.draft.wordCount).toBeGreaterThan(0)

      createdDraftId = result.draft.id
    })

     
    it('should list blog drafts', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'list_blog_drafts',
            arguments: { limit: 10 },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(Array.isArray(result.drafts)).toBe(true)
    })

     
    it('should get a blog draft by id', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'get_blog_draft',
            arguments: { id: createdDraftId },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.draft.id).toBe(createdDraftId)
      expect(result.draft.title).toBe('E2E Test Blog Post')
    })

     
    it('should update a blog draft', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'update_blog_draft',
            arguments: {
              id: createdDraftId,
              title: 'Updated E2E Test Blog Post',
              content: '# Updated Content\n\nThis content was updated via MCP E2E test.',
            },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.draft.title).toBe('Updated E2E Test Blog Post')
    })

     
    it('should search blog drafts', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'search_blog_drafts',
            arguments: { query: 'Updated E2E Test' },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(Array.isArray(result.drafts)).toBe(true)
      // Should find our updated draft
      expect(result.drafts.some((d: { id: string }) => d.id === createdDraftId)).toBe(true)
    })

     
    it('should archive a blog draft with confirmation', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'archive_blog_draft',
            arguments: {
              id: createdDraftId,
              confirmed: true,
            },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.draft.status).toBe('archived')
    })

     
    it('should restore an archived blog draft', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'restore_blog_draft',
            arguments: { id: createdDraftId },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.draft.status).toBe('draft')
    })

     
    it('should get draft images (empty initially)', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'get_draft_images',
            arguments: { draftId: createdDraftId },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(Array.isArray(result.images)).toBe(true)
      expect(result.images.length).toBe(0)
    })

     
    it('should delete a blog draft with confirmation', async () => {
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'delete_blog_draft',
            arguments: {
              id: createdDraftId,
              confirmed: true,
            },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
    })

     
    it('should require confirmation for delete', async () => {
      // First create a draft to delete
      const createResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_blog_draft',
            arguments: {
              title: 'Draft to Delete',
              content: 'Test content',
            },
          },
        },
        CallToolResultSchema
      )
      const draftId = parseToolResponse(createResponse).draft.id

      // Try to delete without confirmation (confirmed: false)
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'delete_blog_draft',
            arguments: { id: draftId, confirmed: false },
          },
        },
        CallToolResultSchema
      )

      // Should return error when not confirmed
      expect(response.isError).toBe(true)

      // Clean up: delete with confirmation
      await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'delete_blog_draft',
            arguments: { id: draftId, confirmed: true },
          },
        },
        CallToolResultSchema
      )
    })

     
    it('should require confirmation for archive', async () => {
      // First create a draft to archive
      const createResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_blog_draft',
            arguments: {
              title: 'Draft to Archive',
              content: 'Test content',
            },
          },
        },
        CallToolResultSchema
      )
      const draftId = parseToolResponse(createResponse).draft.id

      // Try to archive without confirmation (confirmed: false)
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'archive_blog_draft',
            arguments: { id: draftId, confirmed: false },
          },
        },
        CallToolResultSchema
      )

      // Should return error when not confirmed
      expect(response.isError).toBe(true)

      // Clean up: delete with confirmation
      await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'delete_blog_draft',
            arguments: { id: draftId, confirmed: true },
          },
        },
        CallToolResultSchema
      )
    })

     
    it('should filter drafts by status', async () => {
      // Create a draft
      const createResponse = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'create_blog_draft',
            arguments: {
              title: 'Status Filter Test',
              content: 'Test content for status filter',
            },
          },
        },
        CallToolResultSchema
      )
      const draftId = parseToolResponse(createResponse).draft.id

      // List drafts with status filter
      const response = await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'list_blog_drafts',
            arguments: { status: 'draft' },
          },
        },
        CallToolResultSchema
      )

      const result = parseToolResponse(response)
      expect(result.success).toBe(true)
      expect(result.drafts.every((d: { status: string }) => d.status === 'draft')).toBe(true)

      // Clean up
      await client.request(
        {
          method: 'tools/call',
          params: {
            name: 'delete_blog_draft',
            arguments: { id: draftId, confirmed: true },
          },
        },
        CallToolResultSchema
      )
    })
  })
})
