import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function MetricCardSkeleton() {
  return (
    <Card className="relative overflow-hidden h-[180px] flex flex-col">
      <CardHeader className="flex flex-row items-end justify-between space-y-0 pb-2 h-[80px] shrink-0">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent className="flex flex-col flex-1">
        <Skeleton className="h-8 w-32 mb-2" />
        <div className="mt-auto pt-2">
          <Skeleton className="h-3 w-20" />
        </div>
      </CardContent>
    </Card>
  );
}

export function MetricsGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6 items-stretch">
      {Array.from({ length: 6 }).map((_, i) => (
        <MetricCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function VatChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left side - VAT bar chart skeleton */}
          <div>
            <Skeleton className="h-6 w-48 mb-6" />
            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-3 h-10 rounded" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                      </div>
                      <Skeleton className="h-8 w-full rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right side - VAT breakdown tables skeleton */}
          <div>
            <Skeleton className="h-6 w-40 mb-6" />
            
            {/* Outbound table skeleton */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="w-1 h-5 rounded" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>

            {/* Inbound table skeleton */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="w-1 h-5 rounded" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function RevenueChartSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="flex flex-wrap gap-4 mb-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-32" />
          ))}
        </div>
        <div className="h-[350px] w-full flex items-end gap-2 px-8">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <Skeleton 
                className="w-full rounded-t" 
                style={{ height: `${Math.random() * 150 + 50}px` }} 
              />
              <Skeleton className="h-3 w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function InvoiceStatusTablesSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
