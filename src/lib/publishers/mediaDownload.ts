import type { SupabaseClient } from '@supabase/supabase-js'

interface MediaDownloadResult {
  buffer: Buffer
  contentType: string
  filename: string
}

function extractFilename(fileUrl: string): string {
  try {
    const url = new URL(fileUrl)
    const segments = url.pathname.split('/').filter(Boolean)
    return segments[segments.length - 1]
  } catch {
    const segments = fileUrl.split('/').filter(Boolean)
    return segments[segments.length - 1] || fileUrl
  }
}

export async function downloadMediaFromStorage(
  supabase: SupabaseClient,
  userId: string,
  fileUrl: string
): Promise<MediaDownloadResult> {
  const filename = extractFilename(fileUrl)
  const storagePath = `${userId}/${filename}`

  const { data: signedData, error: signedError } = await supabase.storage
    .from('media')
    .createSignedUrl(storagePath, 300)

  if (signedError || !signedData?.signedUrl) {
    throw new Error(`Media file not found: ${filename}`)
  }

  const response = await fetch(signedData.signedUrl)
  if (!response.ok) {
    throw new Error(`Failed to download media: ${filename} (${response.status})`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') || 'application/octet-stream'

  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
    filename,
  }
}
