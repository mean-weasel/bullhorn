import { Skeleton, SkeletonCard, SkeletonStatBar } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 md:p-6 max-w-5xl mx-auto">
      {/* Stats bar skeleton */}
      <SkeletonStatBar />

      {/* Three-column grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {[1, 2, 3].map((section) => (
          <div key={section} className="space-y-3">
            {/* Section heading */}
            <Skeleton className="h-5 w-24 mb-4" />
            {/* Card skeletons */}
            {[1, 2, 3].map((card) => (
              <SkeletonCard key={card} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
