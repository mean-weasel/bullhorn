import { readFileSync } from 'fs'
import path from 'path'

/** POST JSON to an endpoint, return parsed response. Throws on non-2xx. */
async function postJson(
  url: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok) {
    throw new Error(`${res.status} ${url}: ${body.error || JSON.stringify(body)}`)
  }
  return body
}

/** PATCH JSON to an endpoint, return parsed response. */
async function patchJson(
  url: string,
  data: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  const body = await res.json()
  if (!res.ok) {
    throw new Error(`${res.status} ${url}: ${body.error || JSON.stringify(body)}`)
  }
  return body
}

export async function resetDatabase(apiBase: string): Promise<void> {
  const res = await fetch(`${apiBase}/posts/reset`, { method: 'POST' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`Reset failed: ${res.status} — ${body.error || res.statusText}`)
  }
}

export async function createProject(
  apiBase: string,
  data: Record<string, unknown>
): Promise<string> {
  const body = await postJson(`${apiBase}/projects`, data)
  return (body as { project: { id: string } }).project.id
}

export async function createCampaign(
  apiBase: string,
  data: Record<string, unknown>
): Promise<string> {
  const body = await postJson(`${apiBase}/campaigns`, data)
  return (body as { campaign: { id: string } }).campaign.id
}

export async function createPost(apiBase: string, data: Record<string, unknown>): Promise<string> {
  const body = await postJson(`${apiBase}/posts`, data)
  return (body as { post: { id: string } }).post.id
}

export async function createBlogDraft(
  apiBase: string,
  data: Record<string, unknown>
): Promise<string> {
  const body = await postJson(`${apiBase}/blog-drafts`, data)
  return (body as { draft: { id: string } }).draft.id
}

export async function createLaunchPost(
  apiBase: string,
  data: Record<string, unknown>
): Promise<string> {
  const body = await postJson(`${apiBase}/launch-posts`, data)
  return (body as { launchPost: { id: string } }).launchPost.id
}

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
  await patchJson(`${apiBase}/posts/${postId}`, {
    content: { ...post.content, mediaUrls: [...existingMedia, filename] },
  })
}
