import { Skeleton } from '@/components/ui/skeleton';

export function AssetDetailSkeleton() {
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden p-5 space-y-6 min-w-0">
      {/* Header Skeleton */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-7 w-3/4 max-w-[280px] rounded-md" />
          <Skeleton className="h-4 w-40 rounded-md" />
        </div>
        <Skeleton className="h-8 w-24 rounded-md shrink-0" />
      </div>

      {/* Metadata Grid Skeleton (2 columns) */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3.5">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className="space-y-1">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-4 w-32 rounded" />
          </div>
        ))}
      </div>

      {/* Dual Depreciation Cards Skeleton */}
      <div className="space-y-3 pt-1">
        <Skeleton className="h-4 w-44 rounded" />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border/50 p-4 space-y-3 bg-muted/20">
            <Skeleton className="h-4 w-28 rounded" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-5 w-24 rounded" />
            </div>
            <Skeleton className="h-6 w-full rounded" />
          </div>
          <div className="rounded-xl border border-border/50 p-4 space-y-3 bg-muted/20">
            <Skeleton className="h-4 w-28 rounded" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-5 w-24 rounded" />
            </div>
            <Skeleton className="h-6 w-full rounded" />
          </div>
        </div>
      </div>

      {/* Action Tabs & Timeline Skeleton */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
        <div className="space-y-2.5">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
