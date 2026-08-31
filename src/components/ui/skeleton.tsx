import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton — shimmer-animated loading placeholder.
 *
 * Uses a subtle light-sweep (shimmer) animation instead of
 * the default animate-pulse (opacity blink) for a smoother,
 * less fatiguing loading experience.
 */
const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden rounded-md bg-muted animate-shimmer",
          className
        )}
        {...props}
      />
    );
  }
);
Skeleton.displayName = "Skeleton";

export { Skeleton };

