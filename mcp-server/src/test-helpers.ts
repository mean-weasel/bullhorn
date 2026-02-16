import type * as storage from './storage.js'

export type ToolResult = {
  content: { type: string; text: string }[]
  isError?: boolean
}

function ok(data: Record<string, unknown>): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ success: true, ...data }, null, 2) }] }
}

function err(msg: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true }
}

export async function handleCreateCampaign(
  s: typeof storage,
  args: { name: string; description?: string; status?: storage.CampaignStatus }
): Promise<ToolResult> {
  if (!args.name || args.name.trim() === '') return err('Campaign name is required')
  const campaign = await s.createCampaign({
    name: args.name.trim(),
    description: args.description,
    status: args.status || 'active',
  })
  return ok({ campaign })
}

export async function handleListCampaigns(
  s: typeof storage,
  args: { status?: storage.CampaignStatus | 'all'; limit?: number }
): Promise<ToolResult> {
  const campaigns = await s.listCampaigns({ status: args.status, limit: args.limit || 50 })
  return ok({ count: campaigns.length, campaigns })
}

export async function handleGetCampaign(
  s: typeof storage,
  args: { id: string }
): Promise<ToolResult> {
  const result = await s.getCampaign(args.id)
  if (!result) return err(`Campaign with ID ${args.id} not found`)
  return ok({ ...result })
}

export async function handleDeleteCampaign(
  s: typeof storage,
  args: { id: string }
): Promise<ToolResult> {
  const success = await s.deleteCampaign(args.id)
  if (!success) return err(`Campaign with ID ${args.id} not found`)
  return ok({ message: `Campaign ${args.id} deleted` })
}

export async function handleAddPostToCampaign(
  s: typeof storage,
  args: { campaignId: string; postId: string }
): Promise<ToolResult> {
  const post = await s.addPostToCampaign(args.campaignId, args.postId)
  if (!post) return err('Campaign or post not found')
  return ok({ post })
}

export async function handleRemovePostFromCampaign(
  s: typeof storage,
  args: { campaignId: string; postId: string }
): Promise<ToolResult> {
  const post = await s.removePostFromCampaign(args.campaignId, args.postId)
  if (!post) return err('Post not found')
  return ok({ post })
}

export async function handleCreateRedditCrossposts(
  s: typeof storage,
  args: {
    subreddits: Array<{
      subreddit: string
      title: string
      body?: string
      url?: string
      flairText?: string
      scheduledAt?: string
    }>
    defaultScheduledAt?: string
    status?: 'draft' | 'scheduled'
    notes?: string
    campaignId?: string
  }
): Promise<ToolResult> {
  if (!args.subreddits || args.subreddits.length === 0) {
    return err('At least one subreddit is required')
  }
  for (const sub of args.subreddits) {
    if (!sub.subreddit || !sub.title) {
      return err('Each subreddit entry requires subreddit and title')
    }
  }

  const groupId = 'test-group-id'
  const createdPosts: storage.Post[] = []

  for (const sub of args.subreddits) {
    const post = await s.createPost({
      platform: 'reddit' as storage.Platform,
      content: {
        subreddit: sub.subreddit,
        title: sub.title,
        body: sub.body,
        url: sub.url,
        flairText: sub.flairText,
      },
      scheduledAt: sub.scheduledAt || args.defaultScheduledAt || null,
      status: args.status || 'draft',
      notes: args.notes,
      campaignId: args.campaignId,
      groupId,
      groupType: 'reddit-crosspost',
    })
    createdPosts.push(post)
  }

  return ok({ groupId, count: createdPosts.length, posts: createdPosts })
}
