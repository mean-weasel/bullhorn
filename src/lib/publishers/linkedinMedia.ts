const LINKEDIN_API_VERSION = '202501'

export async function uploadLinkedInImage(
  accessToken: string,
  providerAccountId: string,
  imageBuffer: Buffer,
  contentType: string
): Promise<string> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'LinkedIn-Version': LINKEDIN_API_VERSION,
    'X-Restli-Protocol-Version': '2.0.0',
  }

  const initRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: `urn:li:person:${providerAccountId}`,
      },
    }),
  })

  if (!initRes.ok) {
    const err = await initRes.json().catch(() => ({}))
    throw new Error(
      `LinkedIn image init failed: ${(err as { message?: string }).message || initRes.status}`
    )
  }

  const initData = await initRes.json()
  const uploadUrl = initData.value.uploadUrl as string
  const imageUrn = initData.value.image as string

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType,
    },
    body: imageBuffer.buffer.slice(
      imageBuffer.byteOffset,
      imageBuffer.byteOffset + imageBuffer.byteLength
    ) as unknown as ArrayBuffer,
  })

  if (!putRes.ok) {
    throw new Error(`LinkedIn image upload failed: ${putRes.status}`)
  }

  return imageUrn
}
