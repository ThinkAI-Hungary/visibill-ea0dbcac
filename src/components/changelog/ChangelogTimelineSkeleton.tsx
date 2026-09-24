import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const ChangelogTimelineSkeleton: React.FC = () => {
  return (
    <div className="flex-1 min-h-0 h-full overflow-hidden pr-3 sm:pr-6">
      <div className="relative border-l-2 border-border/40 ml-3 sm:ml-36 space-y-8 pb-12 pt-2">
        {[1, 2, 3].map((item) => (
          <div key={item} className="relative pl-6 sm:pl-8">
            {/* Left Date Skeleton (Desktop) */}
            <div className="sm:absolute sm:-left-36 sm:w-28 sm:text-right top-0.5 space-y-1.5 hidden sm:block">
              <Skeleton className="h-4 w-16 ml-auto rounded" />
              <Skeleton className="h-3 w-20 ml-auto rounded opacity-60" />
            </div>

            {/* Timeline Bullet Dot Skeleton */}
            <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-muted border-4 border-background" />

            {/* Entry Card Skeleton */}
            <div className="rounded-xl border border-border/60 bg-card/40 p-5 sm:p-6 space-y-4 shadow-xs">
              {/* Badges row */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <Skeleton className="h-4 w-16 rounded" />
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <Skeleton className="h-6 w-3/4 rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
              </div>

              {/* Highlights List Bullets */}
              <div className="space-y-2.5 pt-3 border-t border-border/40">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-5/6 rounded" />
                </div>
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-4/6 rounded" />
                </div>
                <div className="flex items-center gap-2.5">
                  <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                  <Skeleton className="h-4 w-3/4 rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
