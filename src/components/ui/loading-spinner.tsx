import { cn } from "@/lib/utils";
import { useEffect } from "react";

interface LoadingSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  fullPage?: boolean;
  message?: string;
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
  className,
  size = "lg",
  fullPage = true,
  message
}: LoadingSpinnerProps) {

  useEffect(() => {
    removeInitialLoader();
  }, []);

  const sizeClasses = {
    sm: "h-6 w-6 border-2",
    md: "h-8 w-8 border-4",
    lg: "h-10 w-10 border-4"
  };

  const spinner = (
    <div
      className={cn(
        "inline-block animate-spin rounded-full border-solid border-primary border-r-transparent",
        sizeClasses[size]
      )}
    />
  );

  if (fullPage) {
    return (
      <div
        className={cn("fixed inset-0 z-[9999] flex items-center justify-center", className)}
        style={{ backgroundColor: 'var(--initial-bg)' }}
      >
        {spinner}
      </div>
    );
  }

  return spinner;
}
