import { cn } from "@/lib/utils";

/**
 * Skeleton — shimmer-animated loading placeholder.
 *
 * Uses a subtle light-sweep (shimmer) animation instead of
 * the default animate-pulse (opacity blink) for a smoother,
 * less fatiguing loading experience.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted animate-shimmer",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
