import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MediaUpload } from './MediaUpload'

// Mock the media module
vi.mock('@/lib/media', () => ({
  uploadMedia: vi.fn(),
  deleteMedia: vi.fn().mockResolvedValue(true),
  getMediaUrl: vi.fn((filename: string) => `/api/media/${filename}`),
  validateFile: vi.fn().mockReturnValue({ valid: true }),
  ACCEPT_MEDIA: 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm',
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,
  MAX_VIDEO_SIZE: 100 * 1024 * 1024,
}))

// Mock the UploadProgress component
vi.mock('./UploadProgress', () => ({
  UploadProgress: ({ progress, filename }: { progress: number; filename?: string }) => (
    <div data-testid="upload-progress">
      {filename && <span>{filename}</span>}
      <span>{progress}%</span>
    </div>
  ),
}))

const defaultProps = {
  platform: 'twitter' as const,
  maxFiles: 4,
  existingMedia: [] as string[],
  onMediaChange: vi.fn(),
}

describe('MediaUpload - continued', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows fallback "Upload failed" when upload fails without error message', async () => {
    const { uploadMedia } = await import('@/lib/media')
    const mockUpload = vi.mocked(uploadMedia)
    mockUpload.mockResolvedValue({ success: false })

    const { container } = render(<MediaUpload {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await vi.waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })
  })

  it('shows fallback "Invalid file" when validation fails without error message', async () => {
    const { validateFile } = await import('@/lib/media')
    const mockValidate = vi.mocked(validateFile)
    mockValidate.mockReturnValue({ valid: false })

    const { container } = render(<MediaUpload {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['data'], 'bad.bin', { type: 'application/octet-stream' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await vi.waitFor(() => {
      expect(screen.getByText('Invalid file')).toBeInTheDocument()
    })

    // Restore
    mockValidate.mockReturnValue({ valid: true })
  })

  it('calls deleteMedia when removing a file', async () => {
    const { deleteMedia } = await import('@/lib/media')
    const mockDelete = vi.mocked(deleteMedia)

    const onMediaChange = vi.fn()
    render(
      <MediaUpload
        {...defaultProps}
        existingMedia={['removeme.jpg']}
        onMediaChange={onMediaChange}
      />
    )

    const removeButton = screen.getByLabelText('Remove media')
    fireEvent.click(removeButton)

    expect(onMediaChange).toHaveBeenCalledWith([])
    expect(mockDelete).toHaveBeenCalledWith('removeme.jpg')
  })

  it('renders video elements for .mov and .webm files', () => {
    const { container } = render(
      <MediaUpload {...defaultProps} existingMedia={['clip.mov', 'clip.webm']} />
    )
    const videos = container.querySelectorAll('video')
    expect(videos).toHaveLength(2)
    expect(videos[0]).toHaveAttribute('src', '/api/media/clip.mov')
    expect(videos[1]).toHaveAttribute('src', '/api/media/clip.webm')
  })

  it('shows fallback icon when image fails to load', () => {
    render(<MediaUpload {...defaultProps} existingMedia={['broken.jpg']} />)

    const img = screen.getByRole('img')
    fireEvent.error(img)

    // After error, the image should be replaced with the fallback icon
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('shows fallback icon when video fails to load', () => {
    const { container } = render(<MediaUpload {...defaultProps} existingMedia={['broken.mp4']} />)

    const video = container.querySelector('video')!
    fireEvent.error(video)

    // After error, the video should be replaced with the fallback
    expect(container.querySelector('video')).not.toBeInTheDocument()
  })

  it('does not upload when file input change has no files', async () => {
    const { uploadMedia } = await import('@/lib/media')
    const mockUpload = vi.mocked(uploadMedia)

    const { container } = render(<MediaUpload {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(fileInput, { target: { files: [] } })

    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('appends to existing media on successful upload', async () => {
    const { uploadMedia } = await import('@/lib/media')
    const mockUpload = vi.mocked(uploadMedia)
    mockUpload.mockResolvedValue({ success: true, filename: 'new.jpg' })

    const onMediaChange = vi.fn()
    const { container } = render(
      <MediaUpload
        {...defaultProps}
        existingMedia={['existing.jpg']}
        onMediaChange={onMediaChange}
      />
    )

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['data'], 'new.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await vi.waitFor(() => {
      expect(onMediaChange).toHaveBeenCalledWith(['existing.jpg', 'new.jpg'])
    })
  })

  it('uses linkedin styling when platform is linkedin and dragging', () => {
    render(<MediaUpload {...defaultProps} platform="linkedin" maxFiles={4} />)

    const dropZone = screen.getByText('Drag & drop or click to upload').closest('div[class]')!

    fireEvent.dragOver(dropZone)
    expect(dropZone.className).toContain('linkedin')
  })

  it('uses single column grid layout when maxFiles is 1', () => {
    const { container } = render(
      <MediaUpload {...defaultProps} maxFiles={1} existingMedia={['photo.jpg']} />
    )
    // maxFiles=1 uses grid-cols-1 and max-w-xs
    const grid = container.querySelector('.grid')
    expect(grid?.className).toContain('grid-cols-1')
  })

  it('uses two column grid layout when maxFiles > 1', () => {
    const { container } = render(
      <MediaUpload {...defaultProps} maxFiles={4} existingMedia={['photo.jpg']} />
    )
    const grid = container.querySelector('.grid')
    expect(grid?.className).toContain('grid-cols-2')
  })

  it('drops only the first file when multiple files are dropped', async () => {
    const { uploadMedia } = await import('@/lib/media')
    const mockUpload = vi.mocked(uploadMedia)
    mockUpload.mockResolvedValue({ success: true, filename: 'first.jpg' })

    const onMediaChange = vi.fn()
    render(<MediaUpload {...defaultProps} onMediaChange={onMediaChange} />)

    const dropZone = screen.getByText('Drag & drop or click to upload').closest('div[class]')!

    const file1 = new File(['data1'], 'first.jpg', { type: 'image/jpeg' })
    const file2 = new File(['data2'], 'second.jpg', { type: 'image/jpeg' })
    fireEvent.drop(dropZone, { dataTransfer: { files: [file1, file2] } })

    await vi.waitFor(() => {
      expect(mockUpload).toHaveBeenCalledTimes(1)
      expect(mockUpload).toHaveBeenCalledWith(file1, expect.any(Function))
    })
  })

  it('triggers file input click when drop zone is clicked', () => {
    const { container } = render(<MediaUpload {...defaultProps} />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    const clickSpy = vi.spyOn(fileInput, 'click')

    const dropZone = screen.getByText('Drag & drop or click to upload').closest('div[class]')!
    fireEvent.click(dropZone)

    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  it('shows upload progress when upload invokes progress callback', async () => {
    const { uploadMedia } = await import('@/lib/media')
    const mockUpload = vi.mocked(uploadMedia)

    // Mock uploadMedia to invoke the progress callback before resolving
    mockUpload.mockImplementation(async (_file, onProgress) => {
      if (onProgress) {
        onProgress({ loaded: 500, total: 1000, percentage: 50 })
      }
      return { success: true, filename: 'progress.jpg' }
    })

    const onMediaChange = vi.fn()
    const { container } = render(<MediaUpload {...defaultProps} onMediaChange={onMediaChange} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['data'], 'progress.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await vi.waitFor(() => {
      expect(onMediaChange).toHaveBeenCalledWith(['progress.jpg'])
    })

    // Verify uploadMedia was called with a progress callback
    expect(mockUpload).toHaveBeenCalledWith(file, expect.any(Function))
  })
})
