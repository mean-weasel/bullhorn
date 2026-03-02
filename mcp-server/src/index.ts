#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { validatePostContent } from './validation.js'
import {
  createPost,
  getPost,
  updatePost,
  deletePost,
  archivePost,
  restorePost,
  listPosts,
  searchPosts,
  // Publish workflow functions
  listDuePosts,
  listUpcomingPosts,
  getPostMedia,
  createCampaign,
  getCampaign,
  updateCampaign,
  deleteCampaign,
  listCampaigns,
  addPostToCampaign,
  removePostFromCampaign,
  // Blog draft functions
  createBlogDraft,
  getBlogDraft,
  updateBlogDraft,
  deleteBlogDraft,
  archiveBlogDraft,
  restoreBlogDraft,
  listBlogDrafts,
  searchBlogDrafts,
  addImageToBlogDraft,
  getDraftImages,
  uploadMedia,
  listMediaFiles,
  deleteMediaFile,
  // Project functions
  createProject,
  getProject,
  updateProject,
  deleteProject,
  listProjects,
  getProjectWithCampaigns,
  getProjectAnalytics,
  addAccountToProject,
  removeAccountFromProject,
  getProjectAccounts,
  moveCampaignToProject,
  listCampaignsByProject,
  // Launch post functions
  createLaunchPost,
  getLaunchPost,
  updateLaunchPost,
  deleteLaunchPost,
  listLaunchPosts,
  type Platform,
  type PostStatus,
  type Post,
  type Campaign,
  type CampaignStatus,
  type GroupType,
  type BlogDraft,
  type BlogDraftStatus,
  type Project,
  type LaunchPost,
  type LaunchPlatform,
} from './storage.js'

// Create MCP server
const server = new Server(
  {
    name: 'bullhorn',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// Tool definitions
const TOOLS = [
  {
    name: 'create_post',
    description: 'Create a new social media post draft or scheduled post for a single platform',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['twitter', 'linkedin', 'reddit'],
          description: 'Target platform for the post',
        },
        content: {
          type: 'object',
          description:
            'Content for the post. Structure depends on platform: twitter={text, mediaUrls?}, linkedin={text, visibility?, mediaUrl?}, reddit={subreddit, title, body?, url?, flairText?}',
        },
        scheduledAt: {
          type: 'string',
          description: 'ISO 8601 datetime for scheduling (optional)',
        },
        status: {
          type: 'string',
          enum: ['draft', 'scheduled'],
          description: 'Post status (default: draft)',
        },
        notes: {
          type: 'string',
          description: 'Private notes about this post (not published)',
        },
        campaignId: {
          type: 'string',
          description: 'Campaign ID to link this post to (optional)',
        },
        groupId: {
          type: 'string',
          description: 'Group ID for linking related posts (optional)',
        },
        groupType: {
          type: 'string',
          enum: ['reddit-crosspost'],
          description: 'Type of grouping (optional)',
        },
      },
      required: ['platform', 'content'],
    },
  },
  {
    name: 'get_post',
    description: 'Get a single post by ID',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Post ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_post',
    description: 'Update an existing post',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Post ID to update' },
        platform: {
          type: 'string',
          enum: ['twitter', 'linkedin', 'reddit'],
          description: 'Target platform for the post',
        },
        content: {
          type: 'object',
          description: 'Updated content for the platform',
        },
        scheduledAt: {
          type: 'string',
          description: 'ISO 8601 datetime for scheduling',
        },
        status: {
          type: 'string',
          enum: ['draft', 'scheduled', 'published'],
          description: 'Post status',
        },
        notes: {
          type: 'string',
          description: 'Private notes about this post (not published)',
        },
        campaignId: {
          type: 'string',
          description: 'Campaign ID to link this post to',
        },
        groupId: {
          type: 'string',
          description: 'Group ID for linking related posts',
        },
        groupType: {
          type: 'string',
          enum: ['reddit-crosspost'],
          description: 'Type of grouping',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_post',
    description:
      'Permanently delete a post. This action cannot be undone. Please confirm with the user before calling this.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Post ID to delete' },
        confirmed: {
          type: 'boolean',
          description: 'Set to true to confirm deletion. Required to prevent accidental deletions.',
        },
      },
      required: ['id', 'confirmed'],
    },
  },
  {
    name: 'archive_post',
    description:
      'Archive a post (soft delete). Archived posts can be restored. Please confirm with the user before calling this.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Post ID to archive' },
        confirmed: {
          type: 'boolean',
          description: 'Set to true to confirm archival.',
        },
      },
      required: ['id', 'confirmed'],
    },
  },
  {
    name: 'restore_post',
    description: 'Restore an archived post back to draft status',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Post ID to restore' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_posts',
    description: 'List posts with optional filters',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['all', 'draft', 'scheduled', 'published', 'failed', 'archived'],
          description: 'Filter by status (default: all)',
        },
        platform: {
          type: 'string',
          enum: ['twitter', 'linkedin', 'reddit'],
          description: 'Filter by platform',
        },
        campaignId: {
          type: 'string',
          description: 'Filter by campaign ID',
        },
        groupId: {
          type: 'string',
          description: 'Filter by group ID (e.g., to get all posts in a Reddit crosspost group)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of posts to return (default: 50)',
        },
      },
    },
  },
  {
    name: 'search_posts',
    description:
      'Search posts by content, notes, platform, or campaign name. Excludes archived posts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description:
            'Search query to match against post content, notes, platform, or campaign name',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 50)',
        },
      },
      required: ['query'],
    },
  },
  // Publish workflow tools
  {
    name: 'get_due_posts',
    description:
      'Get posts that are due for publishing. Returns posts with status "ready" (already transitioned by cron) or posts with status "scheduled" where scheduledAt <= now (not yet transitioned). Lightweight response with preview text.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['twitter', 'linkedin', 'reddit'],
          description: 'Filter by platform (optional)',
        },
      },
    },
  },
  {
    name: 'get_post_for_publish',
    description:
      'Get full post content pre-formatted for the target platform. Returns everything needed to publish: text, thread chunks (Twitter), visibility (LinkedIn), subreddit + title + body (Reddit), and media URLs.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        postId: {
          type: 'string',
          description: 'The post ID to retrieve for publishing',
        },
      },
      required: ['postId'],
    },
  },
  {
    name: 'mark_post_published',
    description:
      'Mark a post as published after it has been posted externally (via browser, Share Sheet, or manual copy). Optionally record the published URL and platform post ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        postId: {
          type: 'string',
          description: 'The post ID to mark as published',
        },
        publishedUrl: {
          type: 'string',
          description: 'URL of the published post (optional)',
        },
        platformPostId: {
          type: 'string',
          description: 'Platform-specific post ID (optional)',
        },
      },
      required: ['postId'],
    },
  },
  {
    name: 'get_upcoming_schedule',
    description:
      'Get posts scheduled for the next N hours (default: 24). Useful for planning publishing sessions. Returns posts with status "scheduled" that are due within the time window.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        hours: {
          type: 'number',
          description: 'Number of hours to look ahead (default: 24, max: 168)',
        },
      },
    },
  },
  {
    name: 'download_post_media',
    description:
      'Get temporary download URLs for media files attached to a post. URLs expire after 1 hour. Use these to download images/videos for uploading to the target platform.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        postId: {
          type: 'string',
          description: 'The post ID to get media for',
        },
      },
      required: ['postId'],
    },
  },
  // Campaign management tools
  {
    name: 'create_campaign',
    description: 'Create a new campaign to organize related social media posts',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Campaign name',
        },
        description: {
          type: 'string',
          description: 'Campaign description (optional)',
        },
        status: {
          type: 'string',
          enum: ['active', 'paused', 'completed', 'archived'],
          description: 'Campaign status (default: active)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_campaigns',
    description: 'List campaigns with optional status filter',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['all', 'active', 'paused', 'completed', 'archived'],
          description: 'Filter by status (default: all)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of campaigns to return (default: 50)',
        },
      },
    },
  },
  {
    name: 'get_campaign',
    description: 'Get a single campaign by ID, including its associated posts',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Campaign ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_campaign',
    description: 'Update an existing campaign',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Campaign ID to update' },
        name: { type: 'string', description: 'New campaign name' },
        description: { type: 'string', description: 'New campaign description' },
        status: {
          type: 'string',
          enum: ['active', 'paused', 'completed', 'archived'],
          description: 'New campaign status',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_campaign',
    description:
      'Delete a campaign. Posts linked to the campaign will have their campaignId cleared but will not be deleted.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Campaign ID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_post_to_campaign',
    description: 'Link an existing post to a campaign',
    inputSchema: {
      type: 'object' as const,
      properties: {
        campaignId: { type: 'string', description: 'Campaign ID' },
        postId: { type: 'string', description: 'Post ID to add to the campaign' },
      },
      required: ['campaignId', 'postId'],
    },
  },
  {
    name: 'remove_post_from_campaign',
    description: 'Unlink a post from a campaign (does not delete the post)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        campaignId: { type: 'string', description: 'Campaign ID' },
        postId: { type: 'string', description: 'Post ID to remove from the campaign' },
      },
      required: ['campaignId', 'postId'],
    },
  },
  // Reddit cross-posting tool
  {
    name: 'create_reddit_crossposts',
    description:
      'Create multiple Reddit posts to different subreddits with a shared groupId. Each subreddit can have its own title, body, and schedule time.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        subreddits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              subreddit: { type: 'string', description: 'Subreddit name (without r/)' },
              title: {
                type: 'string',
                description: 'Post title for this subreddit (max 300 chars)',
              },
              body: { type: 'string', description: 'Post body text (optional)' },
              url: { type: 'string', description: 'Link URL for link posts (optional)' },
              flairText: {
                type: 'string',
                description: 'Flair text for this subreddit (optional)',
              },
              scheduledAt: {
                type: 'string',
                description: 'ISO 8601 datetime for scheduling this specific post (optional)',
              },
            },
            required: ['subreddit', 'title'],
          },
          description: 'Array of subreddit configurations',
        },
        defaultScheduledAt: {
          type: 'string',
          description: 'Default ISO 8601 datetime for posts without a specific scheduledAt',
        },
        status: {
          type: 'string',
          enum: ['draft', 'scheduled'],
          description: 'Status for all posts (default: draft)',
        },
        notes: {
          type: 'string',
          description: 'Private notes about this cross-post group',
        },
        campaignId: {
          type: 'string',
          description: 'Optional campaign ID to link all posts to',
        },
      },
      required: ['subreddits'],
    },
  },
  // Blog draft management tools
  {
    name: 'create_blog_draft',
    description:
      'Create a new blog post draft with markdown content. Claude will help write the content from scratch or based on a topic/outline.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Blog post title',
        },
        content: {
          type: 'string',
          description: 'Markdown content for the blog post body',
        },
        date: {
          type: 'string',
          description: 'Publication date (ISO 8601 format, optional)',
        },
        scheduledAt: {
          type: 'string',
          description: 'ISO 8601 datetime for scheduling (optional)',
        },
        status: {
          type: 'string',
          enum: ['draft', 'scheduled'],
          description: 'Draft status (default: draft)',
        },
        notes: {
          type: 'string',
          description: 'Private notes about this draft (not published)',
        },
        campaignId: {
          type: 'string',
          description: 'Campaign ID to link this draft to (optional)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'get_blog_draft',
    description: 'Get a single blog draft by ID with full content',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Blog draft ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_blog_draft',
    description:
      'Update an existing blog draft. Can update title, content, date, notes, status, or campaign.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Blog draft ID to update' },
        title: { type: 'string', description: 'New title' },
        content: { type: 'string', description: 'New markdown content' },
        date: { type: 'string', description: 'Publication date (ISO 8601)' },
        scheduledAt: { type: 'string', description: 'Schedule datetime (ISO 8601)' },
        status: {
          type: 'string',
          enum: ['draft', 'scheduled', 'published'],
          description: 'Draft status',
        },
        notes: { type: 'string', description: 'Private notes' },
        campaignId: { type: 'string', description: 'Campaign ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_blog_draft',
    description:
      'Permanently delete a blog draft. This action cannot be undone. Please confirm with the user before calling this.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Blog draft ID to delete' },
        confirmed: {
          type: 'boolean',
          description: 'Set to true to confirm deletion. Required to prevent accidental deletions.',
        },
      },
      required: ['id', 'confirmed'],
    },
  },
  {
    name: 'archive_blog_draft',
    description:
      'Archive a blog draft (soft delete). Archived drafts can be restored. Please confirm with the user before calling this.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Blog draft ID to archive' },
        confirmed: {
          type: 'boolean',
          description: 'Set to true to confirm archival.',
        },
      },
      required: ['id', 'confirmed'],
    },
  },
  {
    name: 'restore_blog_draft',
    description: 'Restore an archived blog draft back to draft status',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Blog draft ID to restore' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_blog_drafts',
    description:
      'List blog drafts with optional filters. Returns title, status, and date for each draft.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['all', 'draft', 'scheduled', 'published', 'archived'],
          description: 'Filter by status (default: all)',
        },
        campaignId: {
          type: 'string',
          description: 'Filter by campaign ID',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of drafts to return (default: 50)',
        },
      },
    },
  },
  {
    name: 'search_blog_drafts',
    description: 'Search blog drafts by content, title, or notes',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default: 50)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'add_image_to_draft',
    description:
      'Copy an image from a file path to the blog media folder and attach it to a draft. Returns markdown syntax to embed the image.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        draftId: {
          type: 'string',
          description: 'Blog draft ID to add the image to',
        },
        sourcePath: {
          type: 'string',
          description: 'Full path to the source image file (e.g., /Users/name/Pictures/image.png)',
        },
      },
      required: ['draftId', 'sourcePath'],
    },
  },
  {
    name: 'get_draft_images',
    description: 'Get list of images attached to a blog draft',
    inputSchema: {
      type: 'object' as const,
      properties: {
        draftId: {
          type: 'string',
          description: 'Blog draft ID',
        },
      },
      required: ['draftId'],
    },
  },
  // ==================
  // Media upload tool
  // ==================
  {
    name: 'upload_media',
    description:
      'Upload an image or video file. Returns a URL for use in post mediaUrls (Twitter) or mediaUrl (LinkedIn). Supported formats: JPG, PNG, GIF, WebP, MP4, MOV, WebM. Max 10MB images, 100MB videos.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filePath: {
          type: 'string',
          description: 'Full path to the file on disk (e.g., /Users/name/Pictures/photo.jpg)',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'list_media',
    description:
      'List all uploaded media files. Returns filename, URL, size, mimetype, and creation date for each file.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'delete_media',
    description:
      'Delete a previously uploaded media file by filename. The filename is the UUID-based name returned by upload_media (e.g., "550e8400-e29b-41d4-a716-446655440000.jpg").',
    inputSchema: {
      type: 'object' as const,
      properties: {
        filename: {
          type: 'string',
          description: 'The filename to delete (UUID-based name from upload_media)',
        },
      },
      required: ['filename'],
    },
  },
  // ==================
  // Project tools
  // ==================
  {
    name: 'create_project',
    description:
      'Create a new project to organize campaigns. Projects can have a brand kit (hashtags, colors, logo) and preferred social accounts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Project name (required)',
        },
        description: {
          type: 'string',
          description: 'Project description (optional)',
        },
        hashtags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Default hashtags for posts in this project (optional)',
        },
        brandColors: {
          type: 'object',
          description: 'Brand colors object with primary, secondary, accent keys (optional)',
        },
        logoUrl: {
          type: 'string',
          description: 'URL to project logo (optional)',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'get_project',
    description: 'Get a project by ID, including its brand kit and settings',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Project ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_project',
    description: 'Update a project name, description, or brand kit',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Project ID to update' },
        name: { type: 'string', description: 'New project name' },
        description: { type: 'string', description: 'New description' },
        hashtags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Updated default hashtags',
        },
        brandColors: {
          type: 'object',
          description: 'Updated brand colors',
        },
        logoUrl: { type: 'string', description: 'Updated logo URL' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_project',
    description:
      'Delete a project. Campaigns in the project will become unassigned (not deleted). Please confirm with the user before calling this.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Project ID to delete' },
        confirmed: {
          type: 'boolean',
          description: 'Set to true to confirm deletion',
        },
      },
      required: ['id', 'confirmed'],
    },
  },
  {
    name: 'list_projects',
    description: 'List all projects with optional pagination',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of projects to return (default: 50)',
        },
        offset: {
          type: 'number',
          description: 'Number of projects to skip (for pagination)',
        },
      },
    },
  },
  {
    name: 'get_project_campaigns',
    description: 'Get a project with all its campaigns',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Project ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_project_analytics',
    description: 'Get rolled-up analytics for a project (campaign count, post counts by status)',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Project ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'add_account_to_project',
    description: 'Associate a social account with a project as a preferred account',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string', description: 'Project ID' },
        accountId: { type: 'string', description: 'Social account ID to add' },
      },
      required: ['projectId', 'accountId'],
    },
  },
  {
    name: 'remove_account_from_project',
    description: 'Remove a social account association from a project',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string', description: 'Project ID' },
        accountId: { type: 'string', description: 'Social account ID to remove' },
      },
      required: ['projectId', 'accountId'],
    },
  },
  {
    name: 'get_project_accounts',
    description: 'Get all social accounts associated with a project',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectId: { type: 'string', description: 'Project ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'move_campaign_to_project',
    description:
      'Move a campaign to a different project or make it unassigned. Note: project defaults will not apply retroactively to existing posts.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        campaignId: { type: 'string', description: 'Campaign ID to move' },
        targetProjectId: {
          type: 'string',
          description: 'Target project ID, or null/omit to make unassigned',
        },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'list_campaigns_by_project',
    description:
      'List campaigns filtered by project. Use projectId=null to get unassigned campaigns.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        projectId: {
          type: 'string',
          description: 'Project ID to filter by, or "unassigned" for campaigns without a project',
        },
        status: {
          type: 'string',
          enum: ['all', 'active', 'paused', 'completed', 'archived'],
          description: 'Filter by status (default: all)',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of campaigns to return',
        },
      },
      required: ['projectId'],
    },
  },
  // ==================
  // Launch post tools
  // ==================
  {
    name: 'create_launch_post',
    description: 'Create a new launch post for tracking a product launch on a specific platform',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: [
            'hacker_news_show',
            'hacker_news_ask',
            'hacker_news_link',
            'product_hunt',
            'dev_hunt',
            'beta_list',
            'indie_hackers',
          ],
          description: 'Target launch platform',
        },
        title: { type: 'string', description: 'Launch post title' },
        url: { type: 'string', description: 'URL for the launch post (optional)' },
        description: { type: 'string', description: 'Description (optional)' },
        platformFields: {
          type: 'object',
          description: 'Platform-specific fields (optional)',
        },
        campaignId: { type: 'string', description: 'Campaign ID (optional)' },
        scheduledAt: { type: 'string', description: 'ISO 8601 schedule datetime (optional)' },
        notes: { type: 'string', description: 'Private notes (optional)' },
        status: {
          type: 'string',
          enum: ['draft', 'scheduled', 'posted'],
          description: 'Status (default: draft)',
        },
      },
      required: ['platform', 'title'],
    },
  },
  {
    name: 'get_launch_post',
    description: 'Get a single launch post by ID',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Launch post ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_launch_post',
    description: 'Update an existing launch post',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Launch post ID to update' },
        platform: {
          type: 'string',
          enum: [
            'hacker_news_show',
            'hacker_news_ask',
            'hacker_news_link',
            'product_hunt',
            'dev_hunt',
            'beta_list',
            'indie_hackers',
          ],
          description: 'Updated platform',
        },
        title: { type: 'string', description: 'Updated title' },
        url: { type: 'string', description: 'Updated URL' },
        description: { type: 'string', description: 'Updated description' },
        platformFields: { type: 'object', description: 'Updated platform-specific fields' },
        campaignId: { type: 'string', description: 'Campaign ID' },
        scheduledAt: { type: 'string', description: 'Schedule datetime' },
        notes: { type: 'string', description: 'Private notes' },
        status: {
          type: 'string',
          enum: ['draft', 'scheduled', 'posted'],
          description: 'Updated status',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_launch_post',
    description: 'Delete a launch post. Please confirm with the user before calling this.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Launch post ID to delete' },
        confirmed: {
          type: 'boolean',
          description: 'Set to true to confirm deletion',
        },
      },
      required: ['id', 'confirmed'],
    },
  },
  {
    name: 'list_launch_posts',
    description: 'List launch posts with optional filters',
    inputSchema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: [
            'hacker_news_show',
            'hacker_news_ask',
            'hacker_news_link',
            'product_hunt',
            'dev_hunt',
            'beta_list',
            'indie_hackers',
          ],
          description: 'Filter by platform',
        },
        status: {
          type: 'string',
          enum: ['all', 'draft', 'scheduled', 'posted'],
          description: 'Filter by status (default: all)',
        },
        campaignId: { type: 'string', description: 'Filter by campaign ID' },
        limit: { type: 'number', description: 'Max results (default: 50)' },
      },
    },
  },
]

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS }
})

// Scope requirements for each tool — used for early validation
const TOOL_SCOPES: Record<string, string[]> = {
  // Posts
  create_post: ['posts:write'],
  get_post: ['posts:read'],
  update_post: ['posts:write'],
  delete_post: ['posts:write'],
  archive_post: ['posts:write'],
  restore_post: ['posts:write'],
  list_posts: ['posts:read'],
  search_posts: ['posts:read'],
  get_due_posts: ['posts:read'],
  get_post_for_publish: ['posts:read'],
  mark_post_published: ['posts:write'],
  get_upcoming_schedule: ['posts:read'],
  download_post_media: ['posts:read', 'media:write'],
  create_reddit_crossposts: ['posts:write'],
  // Campaigns
  create_campaign: ['campaigns:write'],
  get_campaign: ['campaigns:read'],
  update_campaign: ['campaigns:write'],
  delete_campaign: ['campaigns:write'],
  list_campaigns: ['campaigns:read'],
  add_post_to_campaign: ['campaigns:write'],
  remove_post_from_campaign: ['campaigns:write'],
  // Blog drafts
  create_blog_draft: ['blog:write'],
  get_blog_draft: ['blog:read'],
  update_blog_draft: ['blog:write'],
  delete_blog_draft: ['blog:write'],
  archive_blog_draft: ['blog:write'],
  restore_blog_draft: ['blog:write'],
  list_blog_drafts: ['blog:read'],
  search_blog_drafts: ['blog:read'],
  add_image_to_draft: ['blog:write'],
  get_draft_images: ['blog:read'],
  // Media
  upload_media: ['media:write'],
  list_media: ['media:write'],
  delete_media: ['media:write'],
  // Projects
  create_project: ['projects:write'],
  get_project: ['projects:read'],
  update_project: ['projects:write'],
  delete_project: ['projects:write'],
  list_projects: ['projects:read'],
  get_project_campaigns: ['projects:read'],
  get_project_analytics: ['projects:read', 'analytics:read'],
  add_account_to_project: ['projects:write'],
  remove_account_from_project: ['projects:write'],
  get_project_accounts: ['projects:read'],
  move_campaign_to_project: ['projects:write', 'campaigns:write'],
  list_campaigns_by_project: ['projects:read'],
  // Launch posts
  create_launch_post: ['launches:write'],
  get_launch_post: ['launches:read'],
  update_launch_post: ['launches:write'],
  delete_launch_post: ['launches:write'],
  list_launch_posts: ['launches:read'],
}

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  const startTime = Date.now()
  console.error(`[mcp] START tool=${name}`)

  try {
    switch (name) {
      case 'create_post': {
        const { platform, content, scheduledAt, status, notes, campaignId, groupId, groupType } =
          args as {
            platform: Platform
            content: Post['content']
            scheduledAt?: string
            status?: 'draft' | 'scheduled'
            notes?: string
            campaignId?: string
            groupId?: string
            groupType?: GroupType
          }

        const validPlatforms = ['twitter', 'linkedin', 'reddit']
        if (!platform || !validPlatforms.includes(platform)) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: platform is required and must be one of: twitter, linkedin, reddit',
              },
            ],
            isError: true,
          }
        }

        if (!content || typeof content !== 'object') {
          return {
            content: [{ type: 'text', text: 'Error: content is required' }],
            isError: true,
          }
        }

        const contentError = validatePostContent(
          platform,
          content as unknown as Record<string, unknown>
        )
        if (contentError) {
          return {
            content: [{ type: 'text', text: `Error: ${contentError}` }],
            isError: true,
          }
        }

        const post = await createPost({
          platform,
          content,
          scheduledAt: scheduledAt || null,
          status: status || 'draft',
          notes,
          campaignId,
          groupId,
          groupType,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, post }, null, 2),
            },
          ],
        }
      }

      case 'get_post': {
        const { id } = args as { id: string }
        const post = await getPost(id)

        if (!post) {
          return {
            content: [{ type: 'text', text: `Error: Post with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, post }, null, 2),
            },
          ],
        }
      }

      case 'update_post': {
        const { id, ...updates } = args as { id: string } & Partial<Post>

        if (updates.platform && updates.content) {
          const contentError = validatePostContent(
            updates.platform,
            updates.content as unknown as Record<string, unknown>
          )
          if (contentError) {
            return {
              content: [{ type: 'text', text: `Error: ${contentError}` }],
              isError: true,
            }
          }
        }

        const post = await updatePost(id, updates)

        if (!post) {
          return {
            content: [{ type: 'text', text: `Error: Post with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, post }, null, 2),
            },
          ],
        }
      }

      case 'delete_post': {
        const { id, confirmed } = args as { id: string; confirmed: boolean }

        if (!confirmed) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Deletion not confirmed. Please set confirmed=true after confirming with the user.',
              },
            ],
            isError: true,
          }
        }

        const success = await deletePost(id)

        if (!success) {
          return {
            content: [{ type: 'text', text: `Error: Post with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: true, message: `Post ${id} permanently deleted` },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'archive_post': {
        const { id, confirmed } = args as { id: string; confirmed: boolean }

        if (!confirmed) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Archive not confirmed. Please set confirmed=true after confirming with the user.',
              },
            ],
            isError: true,
          }
        }

        const post = await archivePost(id)

        if (!post) {
          return {
            content: [{ type: 'text', text: `Error: Post with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, post }, null, 2),
            },
          ],
        }
      }

      case 'restore_post': {
        const { id } = args as { id: string }
        const post = await restorePost(id)

        if (!post) {
          return {
            content: [{ type: 'text', text: `Error: Post with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, post }, null, 2),
            },
          ],
        }
      }

      case 'list_posts': {
        const { status, platform, campaignId, groupId, limit } = args as {
          status?: PostStatus | 'all'
          platform?: Platform
          campaignId?: string
          groupId?: string
          limit?: number
        }

        const posts = await listPosts({
          status,
          platform,
          campaignId,
          groupId,
          limit: limit || 50,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, count: posts.length, posts }, null, 2),
            },
          ],
        }
      }

      case 'search_posts': {
        const { query, limit } = args as { query: string; limit?: number }

        if (!query || query.trim() === '') {
          return {
            content: [{ type: 'text', text: 'Error: search query is required' }],
            isError: true,
          }
        }

        const posts = await searchPosts(query, { limit: limit || 50 })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, count: posts.length, posts }, null, 2),
            },
          ],
        }
      }

      // Publish workflow handlers
      case 'get_due_posts': {
        const { platform } = args as { platform?: string }
        const posts = await listDuePosts(platform ? { platform: platform as Platform } : undefined)
        return {
          content: [
            {
              type: 'text',
              text:
                posts.length === 0
                  ? 'No posts are currently due for publishing.'
                  : JSON.stringify(posts, null, 2),
            },
          ],
        }
      }

      case 'get_post_for_publish': {
        const { postId } = args as { postId: string }
        if (!postId) {
          return {
            content: [{ type: 'text', text: 'Error: postId is required' }],
            isError: true,
          }
        }
        const post = await getPost(postId)
        if (!post) {
          return {
            content: [{ type: 'text', text: `Post ${postId} not found` }],
            isError: true,
          }
        }

        const content = post.content as unknown as Record<string, unknown>
        let formatted: Record<string, unknown>

        switch (post.platform) {
          case 'twitter': {
            const text = (content.text as string) || ''
            const chunks: string[] = []
            if (text.length <= 280) {
              chunks.push(text)
            } else {
              let remaining = text
              while (remaining.length > 0) {
                if (remaining.length <= 280) {
                  chunks.push(remaining)
                  break
                }
                let breakPoint = remaining.lastIndexOf(' ', 280)
                if (breakPoint === -1) breakPoint = 280
                chunks.push(remaining.slice(0, breakPoint))
                remaining = remaining.slice(breakPoint).trimStart()
              }
            }
            formatted = {
              platform: 'twitter',
              text,
              threadChunks: chunks,
              mediaUrls: content.mediaUrls || [],
            }
            break
          }
          case 'linkedin':
            formatted = {
              platform: 'linkedin',
              text: content.text || '',
              visibility: content.visibility || 'public',
              mediaUrls: content.mediaUrl ? [content.mediaUrl] : [],
            }
            break
          case 'reddit':
            formatted = {
              platform: 'reddit',
              subreddit: content.subreddit || '',
              title: content.title || '',
              body: content.body || '',
              flairText: content.flairText || null,
              mediaUrls: content.mediaUrls || [],
            }
            break
          default:
            formatted = { platform: post.platform, ...content }
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }],
        }
      }

      case 'mark_post_published': {
        const { postId, publishedUrl, platformPostId } = args as {
          postId: string
          publishedUrl?: string
          platformPostId?: string
        }
        if (!postId) {
          return {
            content: [{ type: 'text', text: 'Error: postId is required' }],
            isError: true,
          }
        }

        const publishResult: Record<string, unknown> = {
          success: true,
          publishedAt: new Date().toISOString(),
          method: 'external',
        }
        if (publishedUrl) publishResult.postUrl = publishedUrl
        if (platformPostId) publishResult.postId = platformPostId

        const updated = await updatePost(postId, {
          status: 'published',
          publishResult: publishResult as unknown as Post['publishResult'],
        })

        if (!updated) {
          return {
            content: [{ type: 'text', text: `Post ${postId} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  postId: updated.id,
                  status: 'published',
                  publishedAt: publishResult.publishedAt,
                  publishedUrl: publishedUrl || null,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_upcoming_schedule': {
        const { hours } = args as { hours?: number }
        const upcoming = await listUpcomingPosts(hours || 24)
        return {
          content: [
            {
              type: 'text',
              text:
                upcoming.length === 0
                  ? `No posts scheduled in the next ${hours || 24} hours.`
                  : JSON.stringify(upcoming, null, 2),
            },
          ],
        }
      }

      case 'download_post_media': {
        const { postId } = args as { postId: string }
        if (!postId) {
          return {
            content: [{ type: 'text', text: 'Error: postId is required' }],
            isError: true,
          }
        }
        const media = await getPostMedia(postId)
        if (media.length === 0) {
          return {
            content: [{ type: 'text', text: 'No media files attached to this post.' }],
          }
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(media, null, 2) }],
        }
      }

      // Campaign management handlers
      case 'create_campaign': {
        const { name, description, status } = args as {
          name: string
          description?: string
          status?: CampaignStatus
        }

        if (!name || name.trim() === '') {
          return {
            content: [{ type: 'text', text: 'Error: Campaign name is required' }],
            isError: true,
          }
        }

        const campaign = await createCampaign({
          name: name.trim(),
          description,
          status: status || 'active',
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, campaign }, null, 2),
            },
          ],
        }
      }

      case 'list_campaigns': {
        const { status, limit } = args as {
          status?: CampaignStatus | 'all'
          limit?: number
        }

        const campaigns = await listCampaigns({
          status,
          limit: limit || 50,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, count: campaigns.length, campaigns }, null, 2),
            },
          ],
        }
      }

      case 'get_campaign': {
        const { id } = args as { id: string }
        const result = await getCampaign(id)

        if (!result) {
          return {
            content: [{ type: 'text', text: `Error: Campaign with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, ...result }, null, 2),
            },
          ],
        }
      }

      case 'update_campaign': {
        const { id, ...updates } = args as { id: string } & Partial<Campaign>
        const campaign = await updateCampaign(id, updates)

        if (!campaign) {
          return {
            content: [{ type: 'text', text: `Error: Campaign with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, campaign }, null, 2),
            },
          ],
        }
      }

      case 'delete_campaign': {
        const { id } = args as { id: string }
        const success = await deleteCampaign(id)

        if (!success) {
          return {
            content: [{ type: 'text', text: `Error: Campaign with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, message: `Campaign ${id} deleted` }, null, 2),
            },
          ],
        }
      }

      case 'add_post_to_campaign': {
        const { campaignId, postId } = args as { campaignId: string; postId: string }
        const post = await addPostToCampaign(campaignId, postId)

        if (!post) {
          return {
            content: [{ type: 'text', text: 'Error: Campaign or post not found' }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, post }, null, 2),
            },
          ],
        }
      }

      case 'remove_post_from_campaign': {
        const { campaignId, postId } = args as { campaignId: string; postId: string }
        const post = await removePostFromCampaign(campaignId, postId)

        if (!post) {
          return {
            content: [{ type: 'text', text: 'Error: Post not found' }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, post }, null, 2),
            },
          ],
        }
      }

      // Reddit cross-posting handler
      case 'create_reddit_crossposts': {
        const { subreddits, defaultScheduledAt, status, notes, campaignId } = args as {
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

        if (!subreddits || subreddits.length === 0) {
          return {
            content: [{ type: 'text', text: 'Error: At least one subreddit is required' }],
            isError: true,
          }
        }

        // Validate all subreddits have titles
        for (const sub of subreddits) {
          if (!sub.subreddit || !sub.title) {
            return {
              content: [
                { type: 'text', text: 'Error: Each subreddit entry requires subreddit and title' },
              ],
              isError: true,
            }
          }
        }

        // Generate a shared groupId for all posts
        const groupId = crypto.randomUUID()
        const createdPosts: Post[] = []

        for (const sub of subreddits) {
          const post = await createPost({
            platform: 'reddit',
            content: {
              subreddit: sub.subreddit,
              title: sub.title,
              body: sub.body,
              url: sub.url,
              flairText: sub.flairText,
            },
            scheduledAt: sub.scheduledAt || defaultScheduledAt || null,
            status: status || 'draft',
            notes,
            campaignId,
            groupId,
            groupType: 'reddit-crosspost',
          })
          createdPosts.push(post)
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  groupId,
                  count: createdPosts.length,
                  posts: createdPosts,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      // Blog draft handlers
      case 'create_blog_draft': {
        const { title, content, date, scheduledAt, status, notes, campaignId } = args as {
          title: string
          content?: string
          date?: string
          scheduledAt?: string
          status?: 'draft' | 'scheduled'
          notes?: string
          campaignId?: string
        }

        if (!title || title.trim() === '') {
          return {
            content: [{ type: 'text', text: 'Error: title is required' }],
            isError: true,
          }
        }

        const draft = await createBlogDraft({
          title: title.trim(),
          content: content || '',
          date: date || null,
          scheduledAt: scheduledAt || null,
          status: status || 'draft',
          notes,
          campaignId,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, draft }, null, 2),
            },
          ],
        }
      }

      case 'get_blog_draft': {
        const { id } = args as { id: string }
        const draft = await getBlogDraft(id)

        if (!draft) {
          return {
            content: [{ type: 'text', text: `Error: Blog draft with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, draft }, null, 2),
            },
          ],
        }
      }

      case 'update_blog_draft': {
        const { id, ...updates } = args as { id: string } & Partial<BlogDraft>
        const draft = await updateBlogDraft(id, updates)

        if (!draft) {
          return {
            content: [{ type: 'text', text: `Error: Blog draft with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, draft }, null, 2),
            },
          ],
        }
      }

      case 'delete_blog_draft': {
        const { id, confirmed } = args as { id: string; confirmed: boolean }

        if (!confirmed) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Deletion not confirmed. Please set confirmed=true after confirming with the user.',
              },
            ],
            isError: true,
          }
        }

        const success = await deleteBlogDraft(id)

        if (!success) {
          return {
            content: [{ type: 'text', text: `Error: Blog draft with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: true, message: `Blog draft ${id} permanently deleted` },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'archive_blog_draft': {
        const { id, confirmed } = args as { id: string; confirmed: boolean }

        if (!confirmed) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Archive not confirmed. Please set confirmed=true after confirming with the user.',
              },
            ],
            isError: true,
          }
        }

        const draft = await archiveBlogDraft(id)

        if (!draft) {
          return {
            content: [{ type: 'text', text: `Error: Blog draft with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, draft }, null, 2),
            },
          ],
        }
      }

      case 'restore_blog_draft': {
        const { id } = args as { id: string }
        const draft = await restoreBlogDraft(id)

        if (!draft) {
          return {
            content: [{ type: 'text', text: `Error: Blog draft with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, draft }, null, 2),
            },
          ],
        }
      }

      case 'list_blog_drafts': {
        const { status, campaignId, limit } = args as {
          status?: BlogDraftStatus | 'all'
          campaignId?: string
          limit?: number
        }

        const drafts = await listBlogDrafts({
          status,
          campaignId,
          limit: limit || 50,
        })

        // Return simplified list (title, status, date, id)
        const simplifiedDrafts = drafts.map((d) => ({
          id: d.id,
          title: d.title,
          status: d.status,
          date: d.date,
          wordCount: d.wordCount,
          updatedAt: d.updatedAt,
        }))

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: true, count: drafts.length, drafts: simplifiedDrafts },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'search_blog_drafts': {
        const { query, limit } = args as { query: string; limit?: number }

        if (!query || query.trim() === '') {
          return {
            content: [{ type: 'text', text: 'Error: search query is required' }],
            isError: true,
          }
        }

        const drafts = await searchBlogDrafts(query, { limit: limit || 50 })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, count: drafts.length, drafts }, null, 2),
            },
          ],
        }
      }

      case 'add_image_to_draft': {
        const { draftId, sourcePath } = args as { draftId: string; sourcePath: string }

        if (!draftId || !sourcePath) {
          return {
            content: [{ type: 'text', text: 'Error: draftId and sourcePath are required' }],
            isError: true,
          }
        }

        const result = await addImageToBlogDraft(draftId, sourcePath)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  filename: result.filename,
                  size: result.size,
                  mimetype: result.mimetype,
                  markdown: result.markdown,
                  message: `Image added. Use this markdown to embed it: ${result.markdown}`,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_draft_images': {
        const { draftId } = args as { draftId: string }

        if (!draftId) {
          return {
            content: [{ type: 'text', text: 'Error: draftId is required' }],
            isError: true,
          }
        }

        const images = await getDraftImages(draftId)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  count: images.length,
                  images,
                  markdownRefs: images.map((img) => `![image](/api/blog-media/${img})`),
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'upload_media': {
        const { filePath } = args as { filePath: string }

        if (!filePath) {
          return {
            content: [{ type: 'text', text: 'Error: filePath is required' }],
            isError: true,
          }
        }

        const uploadResult = await uploadMedia(filePath)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  filename: uploadResult.filename,
                  url: uploadResult.url,
                  message: `File uploaded. Use this URL in post content: mediaUrls: ["${uploadResult.url}"] (Twitter) or mediaUrl: "${uploadResult.url}" (LinkedIn).`,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'list_media': {
        const files = await listMediaFiles()

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, count: files.length, files }, null, 2),
            },
          ],
        }
      }

      case 'delete_media': {
        const { filename } = args as { filename: string }

        if (!filename) {
          return {
            content: [{ type: 'text', text: 'Error: filename is required' }],
            isError: true,
          }
        }

        await deleteMediaFile(filename)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: true, message: `File "${filename}" deleted.` },
                null,
                2
              ),
            },
          ],
        }
      }

      // ==================
      // Project handlers
      // ==================

      case 'create_project': {
        const { name, description, hashtags, brandColors, logoUrl } = args as {
          name: string
          description?: string
          hashtags?: string[]
          brandColors?: Record<string, string>
          logoUrl?: string
        }

        if (!name || typeof name !== 'string' || name.trim() === '') {
          return {
            content: [{ type: 'text', text: 'Error: name is required' }],
            isError: true,
          }
        }

        const result = await createProject({
          name: name.trim(),
          description,
          hashtags,
          brandColors,
          logoUrl,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  project: result.project,
                  atLimit: result.atLimit,
                  message: result.atLimit
                    ? 'Project created. Note: You have reached the soft limit of 3 projects.'
                    : 'Project created successfully.',
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_project': {
        const { id } = args as { id: string }
        const project = await getProject(id)

        if (!project) {
          return {
            content: [{ type: 'text', text: `Error: Project with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, project }, null, 2),
            },
          ],
        }
      }

      case 'update_project': {
        const { id, ...updates } = args as { id: string } & Partial<Project>
        const project = await updateProject(id, updates)

        if (!project) {
          return {
            content: [{ type: 'text', text: `Error: Project with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, project }, null, 2),
            },
          ],
        }
      }

      case 'delete_project': {
        const { id, confirmed } = args as { id: string; confirmed: boolean }

        if (!confirmed) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Deletion not confirmed. Please set confirmed=true after confirming with the user.',
              },
            ],
            isError: true,
          }
        }

        const result = await deleteProject(id)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  message: `Project deleted. ${result.campaignsDeleted} campaigns became unassigned.`,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'list_projects': {
        const { limit, offset } = args as { limit?: number; offset?: number }
        const result = await listProjects({ limit: limit || 50, offset })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  ...result,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_project_campaigns': {
        const { id } = args as { id: string }
        const result = await getProjectWithCampaigns(id)

        if (!result) {
          return {
            content: [{ type: 'text', text: `Error: Project with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  project: result.project,
                  campaigns: result.campaigns,
                  campaignCount: result.campaigns.length,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_project_analytics': {
        const { id } = args as { id: string }
        const analytics = await getProjectAnalytics(id)

        if (!analytics) {
          return {
            content: [{ type: 'text', text: `Error: Project with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, analytics }, null, 2),
            },
          ],
        }
      }

      case 'add_account_to_project': {
        const { projectId, accountId } = args as { projectId: string; accountId: string }

        if (!projectId || !accountId) {
          return {
            content: [{ type: 'text', text: 'Error: projectId and accountId are required' }],
            isError: true,
          }
        }

        const association = await addAccountToProject(projectId, accountId)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  association,
                  message: 'Account added to project.',
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'remove_account_from_project': {
        const { projectId, accountId } = args as { projectId: string; accountId: string }

        if (!projectId || !accountId) {
          return {
            content: [{ type: 'text', text: 'Error: projectId and accountId are required' }],
            isError: true,
          }
        }

        const success = await removeAccountFromProject(projectId, accountId)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success,
                  message: success ? 'Account removed from project.' : 'Association not found.',
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'get_project_accounts': {
        const { projectId } = args as { projectId: string }

        if (!projectId) {
          return {
            content: [{ type: 'text', text: 'Error: projectId is required' }],
            isError: true,
          }
        }

        const accounts = await getProjectAccounts(projectId)

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  accounts,
                  count: accounts.length,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'move_campaign_to_project': {
        const { campaignId, targetProjectId } = args as {
          campaignId: string
          targetProjectId?: string
        }

        if (!campaignId) {
          return {
            content: [{ type: 'text', text: 'Error: campaignId is required' }],
            isError: true,
          }
        }

        const campaign = await moveCampaignToProject(campaignId, targetProjectId || null)

        if (!campaign) {
          return {
            content: [{ type: 'text', text: `Error: Campaign with ID ${campaignId} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  campaign,
                  message: targetProjectId
                    ? `Campaign moved to project. Note: Project defaults will not apply retroactively to existing posts.`
                    : 'Campaign is now unassigned.',
                },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'list_campaigns_by_project': {
        const { projectId, status, limit } = args as {
          projectId: string
          status?: CampaignStatus | 'all'
          limit?: number
        }

        if (!projectId) {
          return {
            content: [{ type: 'text', text: 'Error: projectId is required' }],
            isError: true,
          }
        }

        const filterProjectId = projectId === 'unassigned' ? null : projectId
        const campaigns = await listCampaignsByProject(filterProjectId, { status, limit })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: true,
                  campaigns,
                  count: campaigns.length,
                },
                null,
                2
              ),
            },
          ],
        }
      }

      // ==================
      // Launch post handlers
      // ==================

      case 'create_launch_post': {
        const {
          platform,
          title,
          url,
          description,
          platformFields,
          campaignId,
          scheduledAt,
          notes,
          status,
        } = args as {
          platform: string
          title: string
          url?: string
          description?: string
          platformFields?: Record<string, unknown>
          campaignId?: string
          scheduledAt?: string
          notes?: string
          status?: string
        }

        if (!platform || !title) {
          return {
            content: [{ type: 'text', text: 'Error: platform and title are required' }],
            isError: true,
          }
        }

        const launchPost = await createLaunchPost({
          platform: platform as LaunchPlatform,
          title,
          url,
          description,
          platformFields,
          campaignId,
          scheduledAt,
          notes,
          status,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, launchPost }, null, 2),
            },
          ],
        }
      }

      case 'get_launch_post': {
        const { id } = args as { id: string }
        const launchPost = await getLaunchPost(id)

        if (!launchPost) {
          return {
            content: [{ type: 'text', text: `Error: Launch post with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, launchPost }, null, 2),
            },
          ],
        }
      }

      case 'update_launch_post': {
        const { id, ...updates } = args as { id: string } & Partial<LaunchPost>
        const launchPost = await updateLaunchPost(id, updates)

        if (!launchPost) {
          return {
            content: [{ type: 'text', text: `Error: Launch post with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, launchPost }, null, 2),
            },
          ],
        }
      }

      case 'delete_launch_post': {
        const { id, confirmed } = args as { id: string; confirmed: boolean }

        if (!confirmed) {
          return {
            content: [
              {
                type: 'text',
                text: 'Error: Deletion not confirmed. Please set confirmed=true after confirming with the user.',
              },
            ],
            isError: true,
          }
        }

        const success = await deleteLaunchPost(id)

        if (!success) {
          return {
            content: [{ type: 'text', text: `Error: Launch post with ID ${id} not found` }],
            isError: true,
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: true, message: `Launch post ${id} deleted` },
                null,
                2
              ),
            },
          ],
        }
      }

      case 'list_launch_posts': {
        const { platform, status, campaignId, limit } = args as {
          platform?: LaunchPlatform
          status?: string
          campaignId?: string
          limit?: number
        }

        const launchPosts = await listLaunchPosts({
          platform,
          status,
          campaignId,
          limit: limit || 50,
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { success: true, count: launchPosts.length, launchPosts },
                null,
                2
              ),
            },
          ],
        }
      }

      default:
        return {
          content: [{ type: 'text', text: `Error: Unknown tool ${name}` }],
          isError: true,
        }
    }
  } catch (error) {
    console.error(`[mcp] Tool error (${name}):`, error)
    const message = error instanceof Error ? error.message : ''
    let safeMessage: string
    if (message === 'Unauthorized') {
      safeMessage = 'Unauthorized. Check that your API key is valid and not expired.'
    } else if (message === 'Forbidden') {
      const scopes = TOOL_SCOPES[name]
      safeMessage = scopes
        ? `Forbidden. The "${name}" tool requires scope(s): ${scopes.join(', ')}. Update your API key permissions at https://bullhorn.to/settings.`
        : 'Forbidden. Your API key lacks the required permissions for this operation.'
    } else {
      safeMessage = 'Operation failed. Please try again or check your API key permissions.'
    }
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${safeMessage}`,
        },
      ],
      isError: true,
    }
  } finally {
    const duration = Date.now() - startTime
    console.error(`[mcp] END tool=${name} duration=${duration}ms`)
  }
})

// Start server
async function main() {
  if (!process.env.BULLHORN_API_KEY) {
    console.error(
      'Error: BULLHORN_API_KEY is required.\n' +
        'Create one at https://bullhorn.to/settings → API Keys.'
    )
    process.exit(1)
  }

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Bullhorn MCP Server running on stdio')
}

main().catch(console.error)
