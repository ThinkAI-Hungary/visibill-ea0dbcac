import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  message?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullPage?: boolean;
}

export function LoadingSpinner({ 
  message = "Betöltés...", 
  className,
  size = "md",
  fullPage = true 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-4",
    lg: "h-12 w-12 border-4"
  };

  const spinner = (
    <div className="text-center">
      <div 
        className={cn(
          "inline-block animate-spin rounded-full border-solid border-primary border-r-transparent",
          sizeClasses[size]
        )}
      />
      {message && <p className="mt-2 text-muted-foreground">{message}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className={cn(
        "flex-1 flex items-center justify-center bg-background min-h-[200px]",
        className
      )}>
        {spinner}
      </div>
    );
  }

  return spinner;
}
