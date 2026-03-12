import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4', 'animate-pulse', className)}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonStatBar() {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6 p-4 rounded-md bg-card border-[3px] border-border shadow-sticker animate-pulse">
      <div className="flex-1 flex items-center gap-4 sm:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="text-center shrink-0">
            <div className="h-7 w-10 bg-muted rounded mx-auto mb-1" />
            <div className="h-3 w-16 bg-muted rounded mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function SkeletonListPage({ count = 4 }: { count?: number }) {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <div className="h-8 w-40 bg-muted rounded mb-2 animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse hidden sm:block" />
          <div className="h-1 w-16 bg-muted rounded-full mt-2" />
        </div>
        <div className="h-11 w-28 bg-muted rounded-lg animate-pulse" />
      </div>

      {/* Filter tabs skeleton */}
      <div className="h-12 bg-muted rounded-lg mb-4 md:mb-6 animate-pulse" />

      {/* List items skeleton */}
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
