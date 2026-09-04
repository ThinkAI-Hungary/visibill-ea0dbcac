import * as React from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  showStepper?: boolean;
  step?: number | string;
  min?: number | string;
  max?: number | string;
  onValueChange?: (value: number) => void;
  wrapperClassName?: string;
  stepperClassName?: string;
}

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      className,
      wrapperClassName,
      stepperClassName,
      showStepper = true,
      step = 1,
      min,
      max,
      value,
      defaultValue,
      onChange,
      onValueChange,
      disabled,
      readOnly,
      ...props
    },
    ref
  ) => {
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    // Combine external and internal refs
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    const stepTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const stepIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

    const stopStep = () => {
      if (stepTimerRef.current) {
        clearTimeout(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      if (stepIntervalRef.current) {
        clearInterval(stepIntervalRef.current);
        stepIntervalRef.current = null;
      }
    };

    const handleStep = React.useCallback(
      (direction: "up" | "down") => {
        if (!innerRef.current || disabled || readOnly) return;

        const input = innerRef.current;
        const currentStr = input.value ?? (value !== undefined ? String(value) : "");
        const currentNum = currentStr === "" ? 0 : parseFloat(currentStr) || 0;
        const stepNum = typeof step === "number" ? step : parseFloat(String(step)) || 1;
        const minNum = min !== undefined ? (typeof min === "number" ? min : parseFloat(String(min))) : -Infinity;
        const maxNum = max !== undefined ? (typeof max === "number" ? max : parseFloat(String(max))) : Infinity;

        // Calculate precision based on step and current value
        const stepDecimals = (step.toString().split(".")[1] || "").length;
        const currentDecimals = (currentStr.split(".")[1] || "").length;
        const precision = Math.max(stepDecimals, currentDecimals);

        let nextNum = direction === "up" ? currentNum + stepNum : currentNum - stepNum;
        nextNum = Math.min(maxNum, Math.max(minNum, nextNum));
        nextNum = parseFloat(nextNum.toFixed(precision));

        const nextStr = String(nextNum);

        // Native value setter to simulate real input event
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;

        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(input, nextStr);
        } else {
          input.value = nextStr;
        }

        const inputEvent = new Event("input", { bubbles: true });
        input.dispatchEvent(inputEvent);

        const changeEvent = new Event("change", { bubbles: true });
        input.dispatchEvent(changeEvent);

        if (onValueChange) {
          onValueChange(nextNum);
        }
      },
      [disabled, readOnly, value, step, min, max, onValueChange]
    );

    const startStep = (direction: "up" | "down") => {
      handleStep(direction);
      stopStep();
      stepTimerRef.current = setTimeout(() => {
        stepIntervalRef.current = setInterval(() => {
          handleStep(direction);
        }, 75);
      }, 350);
    };

    React.useEffect(() => {
      return () => stopStep();
    }, []);

    return (
      <div
        className={cn(
          "relative flex items-center w-full group",
          wrapperClassName
        )}
      >
        <input
          type="number"
          ref={innerRef}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          disabled={disabled}
          readOnly={readOnly}
          step={step}
          min={min}
          max={max}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 focus:border-primary focus-visible:border-primary",
            /* Hide native spin buttons */
            "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            /* Reserve right space for the stepper buttons */
            showStepper && "pr-6",
            className
          )}
          {...props}
        />
        {showStepper && (
          <div
            className={cn(
              "absolute right-1 top-1 bottom-1 w-4.5 flex flex-col items-center justify-center border-l border-border/40 divide-y divide-border/30 rounded-r select-none pointer-events-auto",
              disabled && "opacity-40 pointer-events-none",
              stepperClassName
            )}
          >
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                startStep("up");
              }}
              onMouseUp={stopStep}
              onMouseLeave={stopStep}
              onTouchStart={(e) => {
                e.preventDefault();
                startStep("up");
              }}
              onTouchEnd={stopStep}
              disabled={disabled || readOnly}
              className="flex-1 w-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted rounded-tr transition-colors disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Érték növelése"
            >
              <ChevronUp className="w-2.5 h-2.5 stroke-[2.5]" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault();
                startStep("down");
              }}
              onMouseUp={stopStep}
              onMouseLeave={stopStep}
              onTouchStart={(e) => {
                e.preventDefault();
                startStep("down");
              }}
              onTouchEnd={stopStep}
              disabled={disabled || readOnly}
              className="flex-1 w-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 active:bg-muted rounded-br transition-colors disabled:opacity-30 disabled:pointer-events-none"
              aria-label="Érték csökkentése"
            >
              <ChevronDown className="w-2.5 h-2.5 stroke-[2.5]" />
            </button>
          </div>
        )}
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";

export { NumberInput };
