import { Card, CardContent } from '@/components/ui/card';

export function WorkingTimePageSkeleton() {
  return (
    <div className="h-full space-y-4 px-2 py-2">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
        </div>
      </div>

      {/* KPI cards skeleton */}
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="h-4 w-24 bg-muted animate-pulse rounded mb-3" />
              <div className="h-8 w-32 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main content skeleton */}
      <Card className="rounded-xl border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-6 space-y-4">
          <div className="h-5 w-40 bg-muted animate-pulse rounded" />
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-4 py-3 border-b border-border/30"
            >
              <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-36 bg-muted animate-pulse rounded" />
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-4 w-20 bg-muted animate-pulse rounded" />
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
