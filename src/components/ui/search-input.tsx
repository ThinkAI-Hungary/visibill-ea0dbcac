import * as React from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  variant?: "borderless" | "boxed" | "ghost";
  inputSize?: "sm" | "md" | "lg";
  clearable?: boolean;
  onClear?: () => void;
  isLoading?: boolean;
  wrapperClassName?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      wrapperClassName,
      variant = "borderless",
      inputSize = "md",
      clearable = true,
      onClear,
      isLoading = false,
      leftIcon,
      rightElement,
      value,
      onChange,
      disabled,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const hasValue = value !== undefined && value !== null && String(value).length > 0;

    const handleClear = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (onClear) {
        onClear();
      } else if (inputRef.current) {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        if (nativeSetter) {
          nativeSetter.call(inputRef.current, "");
        } else {
          inputRef.current.value = "";
        }
        inputRef.current.dispatchEvent(new Event("input", { bubbles: true }));
        inputRef.current.dispatchEvent(new Event("change", { bubbles: true }));
      }
      inputRef.current?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape" && hasValue) {
        e.stopPropagation();
        handleClear(e as any);
      }
      props.onKeyDown?.(e);
    };

    // Size variants
    const sizeConfig = {
      sm: {
        height: variant === "borderless" ? "h-9" : "h-7",
        text: "text-xs",
        iconSize: "h-3.5 w-3.5",
        px: variant === "borderless" ? "px-2.5" : "px-2",
      },
      md: {
        height: variant === "borderless" ? "h-11" : "h-9",
        text: "text-xs md:text-sm",
        iconSize: "h-4 w-4",
        px: variant === "borderless" ? "px-3" : "px-2.5",
      },
      lg: {
        height: variant === "borderless" ? "h-12" : "h-10",
        text: "text-sm",
        iconSize: "h-4.5 w-4.5",
        px: variant === "borderless" ? "px-4" : "px-3",
      },
    }[inputSize];

    // Variant wrappers
    const variantStyles = {
      borderless: "border-b border-border/80 bg-popover rounded-t-md",
      boxed: "rounded-md border border-input bg-background/50 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all",
      ghost: "bg-transparent border-none",
    }[variant];

    return (
      <div
        className={cn(
          "flex items-center w-full relative transition-colors",
          sizeConfig.height,
          sizeConfig.px,
          variantStyles,
          disabled && "opacity-50 pointer-events-none",
          wrapperClassName
        )}
      >
        {/* Left icon / loading indicator */}
        <div className="shrink-0 mr-2 flex items-center justify-center text-muted-foreground/70">
          {isLoading ? (
            <Loader2 className={cn("animate-spin text-primary", sizeConfig.iconSize)} />
          ) : leftIcon ? (
            leftIcon
          ) : (
            <Search className={sizeConfig.iconSize} />
          )}
        </div>

        {/* The actual input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={onChange}
          disabled={disabled}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex-1 w-full bg-transparent outline-none border-none focus:outline-none focus:ring-0 placeholder:text-muted-foreground disabled:cursor-not-allowed",
            sizeConfig.text,
            className
          )}
          {...props}
        />

        {/* Clear button (X) */}
        {clearable && hasValue && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={handleClear}
            className="shrink-0 p-1 ml-1 text-muted-foreground/60 hover:text-foreground rounded hover:bg-muted/60 transition-colors"
            aria-label="Keresés törlése"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Extra right element (e.g. counter, badge, shortcut) */}
        {rightElement && (
          <div className="shrink-0 ml-1.5 flex items-center">
            {rightElement}
          </div>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

export { SearchInput };
