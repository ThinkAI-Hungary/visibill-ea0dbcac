import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface LoadingSpinnerProps {
  message?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  fullPage?: boolean;
}

/** Remove the static HTML loader injected by index.html */
function removeInitialLoader() {
  const el = document.getElementById("initial-loader");
  if (el) {
    el.classList.add("fade-out");
    setTimeout(() => el.remove(), 220);
  }
}

export function LoadingSpinner({ 
  message = "Betöltés...", 
  className,
  size = "md",
  fullPage = true 
}: LoadingSpinnerProps) {

  // On first render, remove the static HTML loader so only React's version stays
  useEffect(() => {
    removeInitialLoader();
  }, []);

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
      {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
    </div>
  );

  if (fullPage) {
    return (
      <div className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background",
        className
      )}>
        {spinner}
      </div>
    );
  }

  return spinner;
}
