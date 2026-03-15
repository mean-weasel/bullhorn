import { cn } from '@/lib/utils'
import { CloudOff, Check, Loader2 } from 'lucide-react'

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'retrying'

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus
  className?: string
  retry?: () => void
}

// eslint-disable-next-line max-lines-per-function -- borderline, extraction would hurt readability
export function AutoSaveIndicator({ status, className, retry }: AutoSaveIndicatorProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200',
        'border-2 border-border',
        status === 'idle' && 'opacity-0',
        status === 'saving' && 'bg-muted text-muted-foreground opacity-100',
        status === 'saved' &&
          'bg-sticker-green/10 text-sticker-green border-sticker-green/30 opacity-100',
        status === 'retrying' && 'bg-muted text-muted-foreground opacity-100',
        status === 'error' &&
          'bg-destructive/10 text-destructive border-destructive/30 opacity-100',
        className
      )}
    >
      {status === 'saving' && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="w-3.5 h-3.5" />
          <span>Saved!</span>
        </>
      )}
      {status === 'retrying' && (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Retrying...</span>
        </>
      )}
      {status === 'error' && (
        <>
          <CloudOff className="w-3.5 h-3.5" />
          <span>Save failed</span>
          {retry && (
            <button
              type="button"
              onClick={retry}
              className="ml-1 underline underline-offset-2 hover:opacity-80 transition-opacity"
            >
              Retry
            </button>
          )}
        </>
      )}
    </div>
  )
}
