import { Skeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg border-[3px] border-border shadow-[6px_6px_0_hsl(var(--border))] p-8">
          <div className="text-center mb-8">
            <Skeleton className="w-16 h-16 mx-auto mb-4 rounded-lg" />
            <Skeleton className="h-8 w-40 mx-auto mb-2" />
            <Skeleton className="h-4 w-56 mx-auto" />
          </div>
          <div className="space-y-5">
            <div>
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
            <div>
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}
