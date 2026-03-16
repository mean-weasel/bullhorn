type MediaCategory = 'tweet_image' | 'tweet_video' | 'tweet_gif'

const UPLOAD_BASE = 'https://upload.x.com/2/media/upload'
const CHUNK_SIZE = 5 * 1024 * 1024
const MAX_POLL_SECONDS = 60

async function apiRequest(
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...options.headers,
    },
  })
}

export async function uploadTwitterMedia(
  accessToken: string,
  mediaBuffer: Buffer,
  contentType: string,
  category: MediaCategory
): Promise<string> {
  // 1. INITIALIZE
  const initRes = await apiRequest(`${UPLOAD_BASE}/initialize`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      total_bytes: mediaBuffer.length,
      media_type: contentType,
      media_category: category,
    }),
  })

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}))
    throw new Error(
      `Twitter media INIT failed: ${(err as { detail?: string }).detail || initRes.status}`
    )
  }

  const { id: mediaId } = (await initRes.json()) as { id: string }

  // 2. APPEND
  const totalChunks = Math.ceil(mediaBuffer.length / CHUNK_SIZE)
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, mediaBuffer.length)
    const chunkBytes = mediaBuffer.slice(start, end)
    const chunkArray = new Uint8Array(chunkBytes)

    const formData = new FormData()
    formData.append('segment_index', String(i))
    formData.append('media_data', new Blob([chunkArray]))

    const appendRes = await apiRequest(`${UPLOAD_BASE}/${mediaId}/append`, accessToken, {
      method: 'POST',
      body: formData,
    })

    if (!appendRes.ok) {
      const err = await appendRes.json().catch(() => ({}))
      throw new Error(
        `Twitter media APPEND failed (chunk ${i}): ${(err as { detail?: string }).detail || appendRes.status}`
      )
    }
  }

  // 3. FINALIZE
  const finalRes = await apiRequest(`${UPLOAD_BASE}/${mediaId}/finalize`, accessToken, {
    method: 'POST',
  })

  if (!finalRes.ok) {
    const err = await finalRes.json().catch(() => ({}))
    throw new Error(
      `Twitter media FINALIZE failed: ${(err as { detail?: string }).detail || finalRes.status}`
    )
  }

  const finalData = (await finalRes.json()) as { id: string; processing_info?: ProcessingInfo }

  // 4. POLL for async processing
  if (finalData.processing_info) {
    await pollProcessing(mediaId, accessToken, finalData.processing_info)
  }

  return mediaId
}

interface ProcessingInfo {
  state: 'pending' | 'in_progress' | 'succeeded' | 'failed'
  check_after_secs?: number
  error?: { message: string }
}

async function pollProcessing(
  mediaId: string,
  accessToken: string,
  initial: ProcessingInfo
): Promise<void> {
  let info = initial
  const deadline = Date.now() + MAX_POLL_SECONDS * 1000

  while (info.state !== 'succeeded') {
    if (info.state === 'failed') {
      throw new Error(`Twitter media processing failed: ${info.error?.message || 'Unknown error'}`)
    }
    if (Date.now() > deadline) {
      throw new Error('Twitter media processing timed out')
    }

    const waitMs = (info.check_after_secs || 5) * 1000
    await new Promise((resolve) => setTimeout(resolve, waitMs))

    const statusRes = await apiRequest(`${UPLOAD_BASE}/${mediaId}`, accessToken)
    if (!statusRes.ok) {
      throw new Error(`Twitter media STATUS check failed: ${statusRes.status}`)
    }

    const statusData = (await statusRes.json()) as { id: string; processing_info: ProcessingInfo }
    info = statusData.processing_info
  }
}
