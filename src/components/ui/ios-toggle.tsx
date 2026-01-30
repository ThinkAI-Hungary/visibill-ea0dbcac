import * as React from "react";
import { cn } from "@/lib/utils";

export interface IosToggleProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  labelPosition?: "left" | "right";
  className?: string;
  "aria-label"?: string;
}

const IosToggle = React.forwardRef<HTMLButtonElement, IosToggleProps>(
  (
    {
      checked = false,
      onCheckedChange,
      disabled = false,
      label,
      labelPosition = "right",
      className,
      "aria-label": ariaLabel,
      ...props
    },
    ref
  ) => {
    const handleClick = () => {
      if (!disabled && onCheckedChange) {
        onCheckedChange(!checked);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClick();
      }
    };

    const toggle = (
      <button
        ref={ref}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || label}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          // Base styles - iOS-style dimensions
          "relative inline-flex h-[32px] w-[52px] shrink-0 cursor-pointer items-center rounded-full",
          // Transition for smooth animation
          "transition-all duration-300 ease-in-out",
          // Background colors based on state
          checked
            ? "bg-primary"
            : "bg-muted-foreground/30",
          // Focus styles (accessible)
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // Hover effect
          !disabled && "hover:opacity-90",
          // Disabled state
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
        {...props}
      >
        {/* The sliding thumb/knob */}
        <span
          className={cn(
            // Thumb base styles
            "pointer-events-none absolute block h-[26px] w-[26px] rounded-full bg-white shadow-lg",
            // iOS-style shadow
            "shadow-[0_2px_4px_rgba(0,0,0,0.2)]",
            // Transition for slide animation
            "transition-transform duration-300 ease-in-out",
            // Position based on checked state
            checked
              ? "translate-x-[23px]"
              : "translate-x-[3px]"
          )}
        />
      </button>
    );

    if (!label) return toggle;

    return (
      <div className={cn("flex items-center gap-3", labelPosition === "left" && "flex-row-reverse")}>
        {toggle}
        <span
          className={cn(
            "text-sm font-medium select-none",
            disabled ? "text-muted-foreground" : "text-foreground cursor-pointer"
          )}
          onClick={!disabled ? handleClick : undefined}
        >
          {label}
        </span>
      </div>
    );
  }
);

IosToggle.displayName = "IosToggle";

export { IosToggle };
