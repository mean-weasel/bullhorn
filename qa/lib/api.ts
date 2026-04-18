import { readFileSync } from 'fs'
import path from 'path'

/** Send JSON to an endpoint, return parsed response. Throws on non-2xx. */
async function fetchJson(
  url: string,
  method: 'POST' | 'PATCH',
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(`${res.status} ${url}: ${body?.error || res.statusText}`)
  }
  return await res.json()
}

/** Create a resource via POST and return its ID from the response. */
function createResource(
  endpoint: string,
  responseKey: string
): (apiBase: string, data: Record<string, unknown>) => Promise<string> {
  return async (apiBase, data) => {
    const body = await fetchJson(`${apiBase}/${endpoint}`, 'POST', data)
    return (body as Record<string, { id: string }>)[responseKey].id
  }
}

/**
 * Reset all QA data via /api/posts/reset. Deletes posts, campaigns,
 * projects, blog drafts, and launch posts for the test user.
 */
export async function resetDatabase(apiBase: string): Promise<void> {
  const res = await fetch(`${apiBase}/posts/reset`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Reset failed: ${res.status} — ${body.error || res.statusText}`)
  }
}

export const createProject = createResource('projects', 'project')
export const createCampaign = createResource('campaigns', 'campaign')
export const createPost = createResource('posts', 'post')
export const createBlogDraft = createResource('blog-drafts', 'draft')
export const createLaunchPost = createResource('launch-posts', 'launchPost')

/** Upload a media file and attach it to a post's content. */
export async function uploadAndAttachMedia(
  apiBase: string,
  postId: string,
  filePath: string
): Promise<void> {
  const absolutePath = path.resolve(filePath)
  const fileBuffer = readFileSync(absolutePath)
  const fileName = path.basename(absolutePath)
  const ext = path.extname(fileName).toLowerCase()

  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
  }
  const mimeType = mimeTypes[ext] || 'application/octet-stream'

  const blob = new Blob([fileBuffer], { type: mimeType })
  const formData = new FormData()
  formData.append('file', blob, fileName)

  const uploadRes = await fetch(`${apiBase}/media/upload`, {
    method: 'POST',
    body: formData,
  })
  if (!uploadRes.ok) {
    const body = await uploadRes.json().catch(() => ({}))
    throw new Error(
      `Media upload failed: ${uploadRes.status} — ${body.error || uploadRes.statusText}`
    )
  }

  const { filename } = (await uploadRes.json()) as { filename: string }

  // Fetch the current post to get its content, then patch with media
  const getRes = await fetch(`${apiBase}/posts/${postId}`)
  if (!getRes.ok) throw new Error(`Failed to fetch post ${postId}`)
  const { post } = (await getRes.json()) as { post: { content: Record<string, unknown> } }

  const existingMedia = (post.content.mediaUrls as string[]) || []
  await fetchJson(`${apiBase}/posts/${postId}`, 'PATCH', {
    content: { ...post.content, mediaUrls: [...existingMedia, filename] },
  })
}
