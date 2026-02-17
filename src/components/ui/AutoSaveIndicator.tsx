import { cn } from '@/lib/utils'
import { CloudOff, Check, Loader2 } from 'lucide-react'

type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus
  className?: string
}

export function AutoSaveIndicator({ status, className }: AutoSaveIndicatorProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all duration-200',
        'border-2 border-border',
        status === 'idle' && 'opacity-0',
        status === 'saving' && 'bg-muted text-muted-foreground opacity-100',
        status === 'saved' &&
          'bg-sticker-green/10 text-sticker-green border-sticker-green/30 opacity-100',
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
      {status === 'error' && (
        <>
          <CloudOff className="w-3.5 h-3.5" />
          <span>Failed to save</span>
        </>
      )}
    </div>
  )
}
