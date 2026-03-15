import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-64 hidden sm:block" />
          <div className="h-1 w-16 bg-muted rounded-full mt-2" />
        </div>
        <Skeleton className="h-11 w-28 rounded-lg" />
      </div>

      {/* Search bar skeleton */}
      <Skeleton className="h-11 w-full rounded-md mb-4" />

      {/* Filter tabs skeleton */}
      <Skeleton className="h-12 w-full rounded-md mb-4 md:mb-6" />

      {/* Post card skeletons */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
