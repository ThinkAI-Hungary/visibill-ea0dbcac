import { Skeleton } from '@/components/ui/skeleton';

/**
 * Financial page skeleton with header, KPI cards, and content sections.
 * Used for P&L, Balance Sheet, VAT Return loading states.
 */
export function FinancialPageSkeleton({ title = 'Betöltés...' }: { title?: string }) {
  return (
    <div className="container max-w-7xl py-6 space-y-6 animate-in fade-in duration-200">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-32 rounded" />
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>

      {/* Title */}
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-4 w-96 rounded" />
      </div>

      {/* Tabs */}
      <Skeleton className="h-10 w-64 rounded-lg" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-20 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Content sections */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border rounded-xl overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-48 rounded" />
                <Skeleton className="h-5 w-10 rounded-full" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
