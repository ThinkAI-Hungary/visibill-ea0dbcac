import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from './ManagementSkeleton';

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card className="border-border/50 bg-card/50">
        <CardContent className="flex items-center gap-4 p-5">
          <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
          <div className="space-y-2.5 flex-1 overflow-hidden">
            <Skeleton className="h-7 w-2/3" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-1/2" />
              {sub && <Skeleton className="h-2 w-3/4 opacity-50" />}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="transition-colors duration-200">
      <CardContent className="flex items-start gap-4 p-5">
        <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 border border-primary/20 shrink-0 mt-0.5">
          <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{label}</p>
          {sub && <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
