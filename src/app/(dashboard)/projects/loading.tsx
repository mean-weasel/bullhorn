import { Skeleton, SkeletonCard } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <Skeleton className="h-8 w-36 mb-2" />
          <Skeleton className="h-4 w-72 hidden sm:block" />
          <div className="h-1 w-16 bg-muted rounded-full mt-2" />
        </div>
        <Skeleton className="h-11 w-36 rounded-lg" />
      </div>

      {/* Project card skeletons */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
