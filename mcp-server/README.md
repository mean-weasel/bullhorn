# @mean-weasel/bullhorn-mcp

MCP server for [Bullhorn](https://bullhorn.to) — manage social media posts, campaigns, projects, blog drafts, and launch posts from Claude Code or any MCP client.

> **[Full documentation](https://bullhorn.to/docs/mcp)** — setup guide, tool reference, and examples.

## Quick Start

```bash
npx @mean-weasel/bullhorn-mcp
```

Requires `BULLHORN_API_KEY` in your environment. Create one at **Settings → API Keys** in the Bullhorn app.

## Claude Code Setup

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "bullhorn": {
      "command": "npx",
      "args": ["-y", "@mean-weasel/bullhorn-mcp"],
      "env": {
        "BULLHORN_API_URL": "https://bullhorn.to"
      }
    }
  }
}
```

Set `BULLHORN_API_KEY` in your shell environment or via dotenv.

For local development, point to your dev server:

```json
{
  "mcpServers": {
    "bullhorn": {
      "command": "node",
      "args": ["mcp-server/dist/index.js"],
      "env": {
        "BULLHORN_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BULLHORN_API_KEY` | Yes | — | API key from Settings → API Keys |
| `BULLHORN_API_URL` | No | `https://bullhorn.to` | API base URL |

## Rate Limits

API requests are rate-limited to **10 requests per 10 seconds** per API key using a sliding window algorithm. If exceeded, requests return HTTP 429 with a `Retry-After` header.

## Plan Limits

Resource creation is subject to plan limits:

| Resource | Free Plan | Pro Plan |
|----------|-----------|----------|
| Posts | 50 | 500 |
| Campaigns | 5 | 50 |
| Projects | 3 | 20 |
| Blog Drafts | 10 | 100 |
| Launch Posts | 10 | 100 |
| Storage | 50 MB | 2 GB |

When a limit is reached, creation tools return an error with the current usage.

## Tool Examples

### Create a Twitter Post
```json
{
  "tool": "create_post",
  "arguments": {
    "platform": "twitter",
    "content": { "text": "Launching our new feature today!" },
    "status": "draft"
  }
}
```

### Create a LinkedIn Post
```json
{
  "tool": "create_post",
  "arguments": {
    "platform": "linkedin",
    "content": {
      "text": "Excited to announce our Series A funding!",
      "visibility": "public"
    },
    "status": "scheduled",
    "scheduledAt": "2026-03-01T09:00:00Z"
  }
}
```

### Create a Reddit Post
```json
{
  "tool": "create_post",
  "arguments": {
    "platform": "reddit",
    "content": {
      "subreddit": "SideProject",
      "title": "Show r/SideProject: I built a social media scheduler",
      "body": "After 6 months of development..."
    },
    "status": "draft"
  }
}
```

### Create Reddit Crossposts
```json
{
  "tool": "create_reddit_crossposts",
  "arguments": {
    "subreddits": ["SideProject", "startups", "webdev"],
    "title": "Show: I built Bullhorn",
    "body": "A social media post scheduler...",
    "status": "draft"
  }
}
```

## Available Tools

### Posts
| Tool | Description |
|------|-------------|
| `create_post` | Create a new post (Twitter, LinkedIn, Reddit) |
| `get_post` | Get a post by ID |
| `update_post` | Update an existing post |
| `delete_post` | Permanently delete a post |
| `archive_post` | Archive a post (soft delete) |
| `restore_post` | Restore an archived post |
| `list_posts` | List posts with filters |
| `search_posts` | Search posts by content |
| `create_reddit_crossposts` | Create cross-posts to multiple subreddits |

### Campaigns
| Tool | Description |
|------|-------------|
| `create_campaign` | Create a new campaign |
| `get_campaign` | Get campaign with its posts |
| `update_campaign` | Update a campaign |
| `delete_campaign` | Delete a campaign |
| `list_campaigns` | List campaigns with filters |
| `add_post_to_campaign` | Link a post to a campaign |
| `remove_post_from_campaign` | Unlink a post from a campaign |

### Projects
| Tool | Description |
|------|-------------|
| `create_project` | Create a project with brand kit |
| `get_project` | Get a project by ID |
| `update_project` | Update project details |
| `delete_project` | Delete a project |
| `list_projects` | List all projects |
| `get_project_campaigns` | Get project with campaigns |
| `get_project_analytics` | Get project analytics |
| `add_account_to_project` | Add social account to project |
| `remove_account_from_project` | Remove account from project |
| `get_project_accounts` | List project accounts |
| `move_campaign_to_project` | Move campaign between projects |
| `list_campaigns_by_project` | List campaigns in a project |

### Blog Drafts
| Tool | Description |
|------|-------------|
| `create_blog_draft` | Create a blog draft |
| `get_blog_draft` | Get a draft with full content |
| `update_blog_draft` | Update a draft |
| `delete_blog_draft` | Permanently delete a draft |
| `archive_blog_draft` | Archive a draft |
| `restore_blog_draft` | Restore an archived draft |
| `list_blog_drafts` | List drafts with filters |
| `search_blog_drafts` | Search drafts by content |
| `add_image_to_draft` | Add image to a draft |
| `get_draft_images` | List draft images |

### Media
| Tool | Description |
|------|-------------|
| `upload_media` | Upload an image or video file (JPG, PNG, GIF, WebP, MP4, MOV, WebM) |
| `list_media` | List all uploaded media files |
| `delete_media` | Delete an uploaded media file by filename |

### Launch Posts
| Tool | Description |
|------|-------------|
| `create_launch_post` | Create a launch post |
| `get_launch_post` | Get a launch post by ID |
| `update_launch_post` | Update a launch post |
| `delete_launch_post` | Delete a launch post |
| `list_launch_posts` | List launch posts with filters |

## API Key Scopes

API keys can be scoped to limit access. When creating a key without specifying scopes, all scopes are granted by default.

| Scope | Access |
|-------|--------|
| `posts:read` | List, get, search posts |
| `posts:write` | Create, update, delete, archive, restore posts |
| `campaigns:read` | List, get campaigns and their posts |
| `campaigns:write` | Create, update, delete campaigns; add/remove posts |
| `projects:read` | List, get projects, campaigns, and accounts |
| `projects:write` | Create, update, delete projects; manage accounts and logos |
| `blog:read` | List, get, search blog drafts and images |
| `blog:write` | Create, update, delete, archive, restore drafts; add images |
| `launches:read` | List, get launch posts |
| `launches:write` | Create, update, delete launch posts |
| `media:write` | Upload media files |
| `analytics:read` | Read project analytics |

## Tool Scope Requirements

Each tool requires specific API key scope(s). If your key lacks a required scope, you'll get a `Forbidden` error with details on which scope is needed.

| Tool | Required Scope(s) |
|------|-------------------|
| `create_post`, `update_post`, `delete_post`, `archive_post`, `restore_post`, `create_reddit_crossposts` | `posts:write` |
| `get_post`, `list_posts`, `search_posts` | `posts:read` |
| `create_campaign`, `update_campaign`, `delete_campaign`, `add_post_to_campaign`, `remove_post_from_campaign` | `campaigns:write` |
| `get_campaign`, `list_campaigns` | `campaigns:read` |
| `create_project`, `update_project`, `delete_project`, `add_account_to_project`, `remove_account_from_project` | `projects:write` |
| `get_project`, `list_projects`, `get_project_campaigns`, `get_project_accounts`, `list_campaigns_by_project` | `projects:read` |
| `move_campaign_to_project` | `projects:write` + `campaigns:write` |
| `get_project_analytics` | `projects:read` + `analytics:read` |
| `create_blog_draft`, `update_blog_draft`, `delete_blog_draft`, `archive_blog_draft`, `restore_blog_draft`, `add_image_to_draft` | `blog:write` |
| `get_blog_draft`, `list_blog_drafts`, `search_blog_drafts`, `get_draft_images` | `blog:read` |
| `create_launch_post`, `update_launch_post`, `delete_launch_post` | `launches:write` |
| `get_launch_post`, `list_launch_posts` | `launches:read` |
| `upload_media`, `list_media`, `delete_media` | `media:write` |

## Troubleshooting

### "Unauthorized" error

Your API key is invalid, expired, or revoked.

- Verify the key starts with `bh_` and is at least 20 characters
- Check that `BULLHORN_API_KEY` is set in your environment
- Create a new key at **Settings → API Keys** if the old one was revoked or expired

### "Forbidden" error

Your API key is valid but lacks the required scope for the operation.

- The error message tells you which scope(s) are needed
- Create a new key with the required scopes, or use a full-access key (all scopes)
- Scopes are set when creating the key and cannot be changed after creation

### Rate limited (HTTP 429)

You've exceeded 10 requests per 10 seconds.

- Wait for the `Retry-After` duration before retrying
- Space out requests when doing bulk operations
- Consider batching reads (e.g., `list_posts` with filters instead of many `get_post` calls)

### "Operation failed" error

An internal server error occurred. This is usually transient.

- Retry the operation after a few seconds
- If it persists, check that the Bullhorn service is available at your `BULLHORN_API_URL`
- Check your API key hasn't been revoked

## Development

```bash
npm run dev    # Run with tsx (development)
npm run build  # Build for production
npm start      # Run built version
npm test       # Run tests
```

## License

MIT
