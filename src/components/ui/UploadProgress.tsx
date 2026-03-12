import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface UploadProgressProps {
  progress: number // 0-100
  filename?: string
  className?: string
}

export function UploadProgress({ progress, filename, className }: UploadProgressProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-4 bg-card rounded-md',
        'border-[3px] border-border shadow-sticker-sm',
        className
      )}
    >
      <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
      <div className="flex-1 min-w-0">
        {filename && (
          <p className="text-xs text-muted-foreground truncate mb-2 font-medium">{filename}</p>
        )}
        <div className="h-2 bg-muted rounded-full overflow-hidden border border-border">
          <div
            className="h-full bg-linear-to-r from-sticker-yellow via-sticker-pink to-sticker-purple transition-all duration-200 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      </div>
      <span className="text-sm text-foreground font-bold tabular-nums">{progress}%</span>
    </div>
  )
}
