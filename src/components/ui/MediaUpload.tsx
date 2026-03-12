import { useState, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { X, Image as ImageIcon, Film, AlertCircle } from 'lucide-react'
import { UploadProgress } from './UploadProgress'
import {
  uploadMedia,
  deleteMedia,
  getMediaUrl,
  validateFile,
  ACCEPT_MEDIA,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  type UploadProgress as UploadProgressType,
} from '@/lib/media'

interface MediaUploadProps {
  platform: 'twitter' | 'linkedin'
  maxFiles: number // 4 for Twitter, 1 for LinkedIn
  existingMedia: string[]
  onMediaChange: (media: string[]) => void
  disabled?: boolean
  className?: string
}

export function MediaUpload({
  platform,
  maxFiles,
  existingMedia,
  onMediaChange,
  disabled = false,
  className,
}: MediaUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgressType | null>(null)
  const [uploadFilename, setUploadFilename] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canAddMore = existingMedia.length < maxFiles && !uploading && !disabled

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (canAddMore) {
        setIsDragging(true)
      }
    },
    [canAddMore]
  )

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleFileUpload = useCallback(
    async (file: File) => {
      setError(null)

      // Validate file
      const validation = validateFile(file)
      if (!validation.valid) {
        setError(validation.error || 'Invalid file')
        return
      }

      setUploading(true)
      setUploadFilename(file.name)
      setUploadProgress({ loaded: 0, total: file.size, percentage: 0 })

      const result = await uploadMedia(file, (progress) => {
        setUploadProgress(progress)
      })

      setUploading(false)
      setUploadProgress(null)
      setUploadFilename(null)

      if (result.success && result.filename) {
        onMediaChange([...existingMedia, result.filename])
      } else {
        setError(result.error || 'Upload failed')
      }
    },
    [existingMedia, onMediaChange]
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (!canAddMore) return

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        await handleFileUpload(files[0])
      }
    },
    [canAddMore, handleFileUpload]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        await handleFileUpload(files[0])
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [handleFileUpload]
  )

  const handleRemove = async (index: number) => {
    const filename = existingMedia[index]
    // Optimistically remove from UI
    const newMedia = existingMedia.filter((_, i) => i !== index)
    onMediaChange(newMedia)

    // Try to delete from server (don't block on this)
    deleteMedia(filename).catch(() => {
      // Ignore delete errors - file might already be gone
    })
  }

  const handleDropZoneClick = () => {
    if (canAddMore) {
      fileInputRef.current?.click()
    }
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm border-2 border-destructive/30">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto p-1 hover:bg-destructive/20 rounded"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Existing media previews */}
      {existingMedia.length > 0 && (
        <div className={cn('grid gap-3', maxFiles === 1 ? 'grid-cols-1 max-w-xs' : 'grid-cols-2')}>
          {existingMedia.map((filename, idx) => (
            <MediaPreviewItem
              key={filename}
              filename={filename}
              index={idx}
              onRemove={() => handleRemove(idx)}
            />
          ))}
        </div>
      )}

      {/* Upload progress */}
      {uploading && uploadProgress && (
        <UploadProgress
          progress={uploadProgress.percentage}
          filename={uploadFilename || undefined}
        />
      )}

      {/* Drop zone / upload button */}
      {canAddMore && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleDropZoneClick}
          className={cn(
            'border-[3px] border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200',
            'shadow-sticker-sm',
            isDragging
              ? platform === 'twitter'
                ? 'border-twitter bg-twitter/10'
                : 'border-linkedin bg-linkedin/10'
              : 'border-border hover:border-primary bg-card',
            'hover:translate-y-[-2px] hover:shadow-[5px_5px_0_hsl(var(--border))]',
            disabled && 'opacity-50 cursor-not-allowed hover:translate-y-0'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT_MEDIA}
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
          <div className="text-4xl mb-3">{isDragging ? '📥' : '📸'}</div>
          <p className="text-sm font-bold">
            {isDragging ? 'Drop to upload!' : 'Drag & drop or click to upload'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Images (JPG, PNG, GIF, WebP) up to {MAX_IMAGE_SIZE / (1024 * 1024)}MB
          </p>
          <p className="text-xs text-muted-foreground">
            Videos (MP4, MOV, WebM) up to {MAX_VIDEO_SIZE / (1024 * 1024)}MB
          </p>
        </div>
      )}
    </div>
  )
}

interface MediaPreviewItemProps {
  filename: string
  index: number
  onRemove: () => void
}

function MediaPreviewItem({ filename, index, onRemove }: MediaPreviewItemProps) {
  const [hasError, setHasError] = useState(false)
  const url = getMediaUrl(filename)
  const isVideo =
    filename.endsWith('.mp4') || filename.endsWith('.mov') || filename.endsWith('.webm')

  return (
    <div className="relative group">
      <div className="aspect-video rounded-md overflow-hidden bg-muted border-[3px] border-border shadow-sticker-sm">
        {hasError ? (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            {isVideo ? <Film className="w-8 h-8" /> : <ImageIcon className="w-8 h-8" />}
          </div>
        ) : isVideo ? (
          <video
            src={url}
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
            controls
            muted
            playsInline
          />
        ) : (
          <img
            src={url}
            alt={`Media ${index + 1}`}
            className="w-full h-full object-cover"
            onError={() => setHasError(true)}
          />
        )}
      </div>
      <button
        onClick={onRemove}
        aria-label="Remove media"
        className={cn(
          'absolute -top-2 -right-2 p-1.5 rounded-full',
          'bg-destructive text-white border-2 border-border',
          'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 transition-opacity',
          'shadow-sticker-hover',
          'hover:-translate-y-px hover:shadow-sticker-sm'
        )}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  )
}
