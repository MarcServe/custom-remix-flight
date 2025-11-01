import { Skeleton } from "@/components/ui/skeleton";

export function LeadCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-3 md:p-4">
      <div className="flex gap-3 md:gap-4">
        {/* Icon skeleton */}
        <Skeleton className="w-10 h-10 md:w-12 md:h-12 rounded-lg shrink-0" />
        
        {/* Content skeleton */}
        <div className="flex-1 space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          
          {/* Description */}
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          
          {/* Completeness bar */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between">
              <Skeleton className="h-2.5 w-24" />
              <Skeleton className="h-2.5 w-8" />
            </div>
            <Skeleton className="h-1.5 w-full" />
          </div>
          
          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
