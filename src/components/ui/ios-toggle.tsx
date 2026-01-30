import * as React from "react";
import { cn } from "@/lib/utils";

export interface IosToggleProps {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  onLabel?: string;
  offLabel?: string;
  className?: string;
  "aria-label"?: string;
}

const IosToggle = React.forwardRef<HTMLButtonElement, IosToggleProps>(
  (
    {
      checked = false,
      onCheckedChange,
      disabled = false,
      onLabel = "Fizetve",
      offLabel = "Nyitott",
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

    return (
      <button
        ref={ref}
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel || (checked ? onLabel : offLabel)}
        disabled={disabled}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          // Base styles - compact dimensions
          "relative inline-flex h-[22px] w-[56px] shrink-0 cursor-pointer items-center rounded-full",
          // Transition for smooth animation
          "transition-all duration-200 ease-in-out",
          // Background colors based on state - green for ON, orange for OFF
          checked
            ? "bg-success"
            : "bg-warning",
          // Focus styles (accessible)
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          // Hover effect
          !disabled && "hover:opacity-90",
          // Disabled state
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
        {...props}
      >
        {/* Label text inside the toggle - positioned to avoid knob overlap */}
        <span
          className={cn(
            "absolute text-[9px] font-semibold uppercase tracking-tight transition-opacity duration-200",
            checked 
              ? "left-[5px] text-success-foreground" 
              : "right-[5px] text-warning-foreground"
          )}
        >
          {checked ? onLabel : offLabel}
        </span>
        
        {/* The sliding thumb/knob */}
        <span
          className={cn(
            // Thumb base styles - smaller knob
            "pointer-events-none absolute block h-[16px] w-[16px] rounded-full bg-white shadow-sm",
            // Transition for slide animation
            "transition-transform duration-200 ease-in-out",
            // Position based on checked state
            checked
              ? "translate-x-[37px]"
              : "translate-x-[3px]"
          )}
        />
      </button>
    );
  }
);

IosToggle.displayName = "IosToggle";

export { IosToggle };
