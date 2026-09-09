import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface AccountyNavSkeletonProps {
  isCollapsed?: boolean;
  count?: number;
}

export const AccountyNavSkeleton: React.FC<AccountyNavSkeletonProps> = ({
  isCollapsed = false,
  count = 6,
}) => {
  if (isCollapsed) {
    return (
      <div className="flex w-full min-w-0 flex-col items-center gap-2 py-1 animate-in fade-in duration-200">
        {Array.from({ length: count }).map((_, idx) => (
          <Skeleton
            key={idx}
            className="h-8 w-8 rounded-md bg-sidebar-foreground/10 dark:bg-sidebar-foreground/15"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 px-1 py-1 animate-in fade-in duration-200">
      {/* Back button / Group Header Skeleton */}
      <div className="flex items-center gap-2 px-3 py-1.5 h-8 rounded-md border border-border/30 bg-sidebar-foreground/5 mb-1">
        <Skeleton className="h-4 w-4 rounded shrink-0 bg-sidebar-foreground/15" />
        <Skeleton className="h-3 w-32 rounded bg-sidebar-foreground/15" />
      </div>

      {/* Menu Item Rows */}
      <div className="flex flex-col gap-1.5">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 h-9 bg-sidebar-foreground/5"
          >
            <Skeleton className="h-4 w-4 rounded shrink-0 bg-sidebar-foreground/15" />
            <Skeleton
              className="h-3 rounded bg-sidebar-foreground/15"
              style={{ width: `${65 + ((idx * 17) % 30)}%` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default AccountyNavSkeleton;
