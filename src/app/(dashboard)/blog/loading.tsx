import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-56 hidden sm:block" />
          <div className="h-1 w-16 bg-muted rounded-full mt-2" />
        </div>
        <Skeleton className="h-11 w-32 rounded-lg" />
      </div>

      {/* Search bar skeleton */}
      <Skeleton className="h-11 w-full rounded-lg mb-4" />

      {/* Filter tabs skeleton */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-full" />
        ))}
      </div>

      {/* Tag filter skeleton */}
      <div className="flex items-center gap-2 mb-6">
        <Skeleton className="h-4 w-4 rounded" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-full" />
        ))}
      </div>

      {/* Draft card skeletons */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
