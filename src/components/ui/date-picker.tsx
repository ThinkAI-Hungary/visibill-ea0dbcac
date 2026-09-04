import * as React from 'react';
import { format, parse, isValid } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  value?: string | Date | null;
  onChange?: (dateString: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  popoverClassName?: string;
  formatStr?: string;
  clearable?: boolean;
  id?: string;
  minDate?: Date;
  maxDate?: Date;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Válassz dátumot',
  disabled = false,
  className,
  popoverClassName,
  formatStr = 'yyyy. MM. dd.',
  clearable = false,
  id,
  minDate,
  maxDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse value to Date object
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    if (value instanceof Date) return isValid(value) ? value : undefined;
    if (typeof value === 'string') {
      // Try ISO YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        const parsed = parse(value.slice(0, 10), 'yyyy-MM-dd', new Date());
        return isValid(parsed) ? parsed : undefined;
      }
      const parsed = new Date(value);
      return isValid(parsed) ? parsed : undefined;
    }
    return undefined;
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange?.('');
    } else {
      const yyyyMmDd = format(date, 'yyyy-MM-dd');
      onChange?.(yyyyMmDd);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal h-10 px-3 py-2 text-sm bg-background border border-input hover:bg-accent/50 outline-none focus:outline-none focus:ring-0 focus-visible:ring-0 focus:border-primary focus-visible:border-primary transition-colors',
            !selectedDate && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-primary shrink-0 opacity-80" />
          <span className="flex-1 truncate">
            {selectedDate ? (
              format(selectedDate, formatStr, { locale: hu })
            ) : (
              <span>{placeholder}</span>
            )}
          </span>
          {clearable && selectedDate && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onChange?.('');
                }
              }}
              className="ml-1 p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Dátum törlése"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-auto p-0 border border-border/60 shadow-xl rounded-xl z-[1200]", popoverClassName)} align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={(date) => {
            if (minDate && date < minDate) return true;
            if (maxDate && date > maxDate) return true;
            return false;
          }}
          locale={hu}
          initialFocus
          className="rounded-xl p-3"
        />
      </PopoverContent>
    </Popover>
  );
}
