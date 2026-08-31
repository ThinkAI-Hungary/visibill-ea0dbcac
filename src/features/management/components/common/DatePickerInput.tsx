import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';

export function DatePickerInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = useRef(false);

  const handleButtonMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Keep focus on input → picker stays open
  };

  const handleButtonClick = () => {
    if (isOpen.current) {
      inputRef.current?.blur(); // Close picker
      isOpen.current = false;
    } else {
      (inputRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.();
      isOpen.current = true;
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={() => { isOpen.current = false; }}
        className="h-7 text-xs w-28 bg-background border border-input rounded-md px-2 pr-6 text-foreground
          [&::-webkit-calendar-picker-indicator]:hidden
          focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
      />
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={handleButtonMouseDown}
        onClick={handleButtonClick}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dátumválasztó megnyitása"
      >
        <Calendar className="h-3 w-3" />
      </button>
    </div>
  );
}
