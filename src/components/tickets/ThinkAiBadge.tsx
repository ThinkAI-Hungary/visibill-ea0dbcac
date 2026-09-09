import React from "react";

interface ThinkAiBadgeProps {
  className?: string;
  size?: "xs" | "sm" | "md";
  iconOnly?: boolean;
}

export function ThinkAiIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={`${className} shrink-0`}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M 0 0 L 118 0 L 107 21 L 68 21 L 52 57 L 58.5 117 L 28 57 L 44 21 L 10 21 Z"
        className="fill-foreground"
      />
      <path
        d="M 78 35 L 101 35 L 78 80 L 67 57 Z"
        className="fill-primary"
        style={{ fill: "hsl(var(--primary))" }}
      />
    </svg>
  );
}

/**
 * ThinkAiBadge — Letisztult, keret nélküli márkajelzés a ThinkAI support felhasználók mellé.
 * Geometrikus SVG ThinkAI monogram + Think_Ai szöveg, ahol az alsó vonás ("_") a téma primary színe.
 * Az `iconOnly` prop használatával csak a "T" ikon jelenik meg.
 */
export function ThinkAiBadge({ className = "", size = "sm", iconOnly = false }: ThinkAiBadgeProps) {
  const iconSizeClasses = {
    xs: "h-3.5 w-3.5",
    sm: "h-4 w-4",
    md: "h-4.5 w-4.5",
  }[size];

  const textSizeClasses = {
    xs: "text-[11px]",
    sm: "text-xs",
    md: "text-sm",
  }[size];

  if (iconOnly) {
    return (
      <span
        className={`inline-flex items-center select-none shrink-0 align-middle ${className}`}
        title="ThinkAI"
      >
        <ThinkAiIcon className={iconSizeClasses} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 select-none shrink-0 align-middle ${className}`}
      title="ThinkAI Support"
    >
      <svg
        className={`${iconSizeClasses} shrink-0`}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M 0 0 L 118 0 L 107 21 L 68 21 L 52 57 L 58.5 117 L 28 57 L 44 21 L 10 21 Z"
          className="fill-foreground"
        />
        <path
          d="M 78 35 L 101 35 L 78 80 L 67 57 Z"
          className="fill-primary"
          style={{ fill: "hsl(var(--primary))" }}
        />
      </svg>
      <span className={`${textSizeClasses} font-bold tracking-wider text-foreground`}>
        THINK_AI
      </span>
    </span>
  );
}
