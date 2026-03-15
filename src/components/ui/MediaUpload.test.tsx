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

describe('MediaUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the drop zone when no files and not at max', () => {
    render(<MediaUpload {...defaultProps} />)
    expect(screen.getByText('Drag & drop or click to upload')).toBeInTheDocument()
  })

  it('renders file size info text', () => {
    render(<MediaUpload {...defaultProps} />)
    expect(screen.getByText(/Images \(JPG, PNG, GIF, WebP\) up to 10MB/)).toBeInTheDocument()
    expect(screen.getByText(/Videos \(MP4, MOV, WebM\) up to 100MB/)).toBeInTheDocument()
  })

  it('renders existing media previews', () => {
    render(<MediaUpload {...defaultProps} existingMedia={['photo1.jpg', 'photo2.png']} />)
    const images = screen.getAllByRole('img')
    expect(images).toHaveLength(2)
    expect(images[0]).toHaveAttribute('alt', 'Media 1')
    expect(images[1]).toHaveAttribute('alt', 'Media 2')
  })

  it('renders video element for video files', () => {
    const { container } = render(<MediaUpload {...defaultProps} existingMedia={['clip.mp4']} />)
    const video = container.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', '/api/media/clip.mp4')
  })

  it('hides the drop zone when at max files', () => {
    render(
      <MediaUpload {...defaultProps} maxFiles={2} existingMedia={['photo1.jpg', 'photo2.png']} />
    )
    expect(screen.queryByText('Drag & drop or click to upload')).not.toBeInTheDocument()
  })

  it('hides the drop zone when disabled', () => {
    render(<MediaUpload {...defaultProps} disabled />)
    // canAddMore becomes false when disabled, so drop zone is not rendered
    expect(screen.queryByText('Drag & drop or click to upload')).not.toBeInTheDocument()
  })

  it('calls onMediaChange when a file is selected via input', async () => {
    const { uploadMedia } = await import('@/lib/media')
    const mockUpload = vi.mocked(uploadMedia)
    mockUpload.mockResolvedValue({ success: true, filename: 'uploaded.jpg' })

    const onMediaChange = vi.fn()
    const { container } = render(<MediaUpload {...defaultProps} onMediaChange={onMediaChange} />)

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()

    const file = new File(['image-data'], 'test.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    // Wait for async upload to complete
    await vi.waitFor(() => {
      expect(onMediaChange).toHaveBeenCalledWith(['uploaded.jpg'])
    })
  })

  it('shows error for invalid file types', async () => {
    const { validateFile } = await import('@/lib/media')
    const mockValidate = vi.mocked(validateFile)
    mockValidate.mockReturnValue({ valid: false, error: 'File type not supported.' })

    const { container } = render(<MediaUpload {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['data'], 'readme.txt', { type: 'text/plain' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await vi.waitFor(() => {
      expect(screen.getByText('File type not supported.')).toBeInTheDocument()
    })

    // Restore for other tests
    mockValidate.mockReturnValue({ valid: true })
  })

  it('calls onMediaChange with filtered array when removing a file', () => {
    const onMediaChange = vi.fn()
    render(
      <MediaUpload
        {...defaultProps}
        existingMedia={['a.jpg', 'b.jpg', 'c.jpg']}
        onMediaChange={onMediaChange}
      />
    )

    // Remove buttons are titled "Remove media"
    const removeButtons = screen.getAllByLabelText('Remove media')
    expect(removeButtons).toHaveLength(3)

    fireEvent.click(removeButtons[1]) // remove b.jpg
    expect(onMediaChange).toHaveBeenCalledWith(['a.jpg', 'c.jpg'])
  })

  it('shows upload error when upload fails', async () => {
    const { uploadMedia } = await import('@/lib/media')
    const mockUpload = vi.mocked(uploadMedia)
    mockUpload.mockResolvedValue({ success: false, error: 'Network error' })

    const { container } = render(<MediaUpload {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await vi.waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('uploads a file via drag and drop', async () => {
    const { uploadMedia } = await import('@/lib/media')
    const mockUpload = vi.mocked(uploadMedia)
    mockUpload.mockResolvedValue({ success: true, filename: 'dropped.jpg' })

    const onMediaChange = vi.fn()
    render(<MediaUpload {...defaultProps} onMediaChange={onMediaChange} />)

    const dropZone = screen.getByText('Drag & drop or click to upload').closest('div[class]')!

    const file = new File(['image-data'], 'dropped.jpg', { type: 'image/jpeg' })
    const dataTransfer = { files: [file] }

    fireEvent.drop(dropZone, { dataTransfer })

    await vi.waitFor(() => {
      expect(mockUpload).toHaveBeenCalledWith(file, expect.any(Function))
      expect(onMediaChange).toHaveBeenCalledWith(['dropped.jpg'])
    })
  })

  it('ignores drop when at max files', async () => {
    const { uploadMedia } = await import('@/lib/media')
    const mockUpload = vi.mocked(uploadMedia)

    const onMediaChange = vi.fn()
    render(
      <MediaUpload
        {...defaultProps}
        maxFiles={1}
        existingMedia={['full.jpg']}
        onMediaChange={onMediaChange}
      />
    )

    // Drop zone should not be rendered when at max
    expect(screen.queryByText('Drag & drop or click to upload')).not.toBeInTheDocument()
    expect(mockUpload).not.toHaveBeenCalled()
  })

  it('shows dragging state on dragOver and resets on dragLeave', () => {
    render(<MediaUpload {...defaultProps} />)

    const dropZone = screen.getByText('Drag & drop or click to upload').closest('div[class]')!

    fireEvent.dragOver(dropZone)
    expect(screen.getByText('Drop to upload!')).toBeInTheDocument()

    fireEvent.dragLeave(dropZone)
    expect(screen.getByText('Drag & drop or click to upload')).toBeInTheDocument()
  })

  it('dismisses the error when clicking the X button', async () => {
    const { validateFile } = await import('@/lib/media')
    const mockValidate = vi.mocked(validateFile)
    mockValidate.mockReturnValue({ valid: false, error: 'Bad file' })

    const { container } = render(<MediaUpload {...defaultProps} />)
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement

    const file = new File(['data'], 'bad.exe', { type: 'application/octet-stream' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await vi.waitFor(() => {
      expect(screen.getByText('Bad file')).toBeInTheDocument()
    })

    // Click the dismiss button (the X button inside the error message)
    const dismissButton = screen.getByText('Bad file').closest('div')!.querySelector('button')!
    fireEvent.click(dismissButton)

    expect(screen.queryByText('Bad file')).not.toBeInTheDocument()

    // Restore
    mockValidate.mockReturnValue({ valid: true })
  })
})
