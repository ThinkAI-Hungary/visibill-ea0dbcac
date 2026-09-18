import * as React from 'react';
import { format, parse, isValid } from 'date-fns';
import { hu } from 'date-fns/locale';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function parseFlexibleDate(raw: string): Date | null {
  if (!raw) return null;
  const s = raw.trim().replace(/\s+/g, ' ');

  // 1. 8 digits: YYYYMMDD
  if (/^\d{8}$/.test(s)) {
    const y = parseInt(s.substring(0, 4), 10);
    const m = parseInt(s.substring(4, 6), 10) - 1;
    const d = parseInt(s.substring(6, 8), 10);
    const dObj = new Date(y, m, d);
    if (dObj.getFullYear() === y && dObj.getMonth() === m && dObj.getDate() === d) return dObj;
  }

  // 2. 4 digits: MMDD with current year
  if (/^\d{4}$/.test(s)) {
    const y = new Date().getFullYear();
    const m = parseInt(s.substring(0, 2), 10) - 1;
    const d = parseInt(s.substring(2, 4), 10);
    const dObj = new Date(y, m, d);
    if (dObj.getFullYear() === y && dObj.getMonth() === m && dObj.getDate() === d) return dObj;
  }

  // 3. Delimited: dot, dash, slash
  const cleaned = s.replace(/\.$/, '');
  const parts = cleaned.split(/[-./\s]+/).filter(Boolean);
  if (parts.length === 3) {
    const [p1, p2, p3] = parts;
    if (p1.length === 4) {
      const y = parseInt(p1, 10);
      const m = parseInt(p2, 10) - 1;
      const d = parseInt(p3, 10);
      const dObj = new Date(y, m, d);
      if (dObj.getFullYear() === y && dObj.getMonth() === m && dObj.getDate() === d) return dObj;
    }
  } else if (parts.length === 2) {
    const y = new Date().getFullYear();
    const m = parseInt(parts[0], 10) - 1;
    const d = parseInt(parts[1], 10);
    const dObj = new Date(y, m, d);
    if (dObj.getFullYear() === y && dObj.getMonth() === m && dObj.getDate() === d) return dObj;
  }

  const parsed = new Date(s);
  if (isValid(parsed) && !isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

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
  name?: string;
  required?: boolean;
  minDate?: Date;
  maxDate?: Date;
  min?: string | Date;
  max?: string | Date;
  allowInput?: boolean;
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
  name,
  required,
  minDate,
  maxDate,
  min,
  max,
  allowInput = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const effectiveMinDate = React.useMemo(() => {
    const m = minDate || min;
    if (!m) return undefined;
    if (m instanceof Date) return isValid(m) ? m : undefined;
    if (typeof m === 'string') {
      const parsed = parse(m.slice(0, 10), 'yyyy-MM-dd', new Date());
      return isValid(parsed) ? parsed : undefined;
    }
    return undefined;
  }, [minDate, min]);

  const effectiveMaxDate = React.useMemo(() => {
    const m = maxDate || max;
    if (!m) return undefined;
    if (m instanceof Date) return isValid(m) ? m : undefined;
    if (typeof m === 'string') {
      const parsed = parse(m.slice(0, 10), 'yyyy-MM-dd', new Date());
      return isValid(parsed) ? parsed : undefined;
    }
    return undefined;
  }, [maxDate, max]);

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

  const [inputText, setInputText] = React.useState<string>(() => {
    if (!selectedDate) return '';
    return format(selectedDate, 'yyyy-MM-dd');
  });

  React.useEffect(() => {
    if (selectedDate) {
      setInputText(format(selectedDate, 'yyyy-MM-dd'));
    } else {
      setInputText('');
    }
  }, [selectedDate]);

  const commitParsedDate = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      onChange?.('');
      return;
    }
    const parsed = parseFlexibleDate(trimmed);
    if (parsed && isValid(parsed)) {
      const ymd = format(parsed, 'yyyy-MM-dd');
      setInputText(ymd);
      onChange?.(ymd);
    } else if (selectedDate) {
      setInputText(format(selectedDate, 'yyyy-MM-dd'));
    } else {
      setInputText('');
      onChange?.('');
    }
  };

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      setInputText('');
      onChange?.('');
    } else {
      const yyyyMmDd = format(date, 'yyyy-MM-dd');
      setInputText(yyyyMmDd);
      onChange?.(yyyyMmDd);
    }
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputText('');
    onChange?.('');
  };

  if (allowInput) {
    return (
      <div className={cn("relative flex items-center w-full", className)}>
        <Input
          id={id}
          name={name}
          disabled={disabled}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onBlur={() => commitParsedDate(inputText)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitParsedDate(inputText);
            }
          }}
          placeholder={placeholder || 'éééé-hh-nn'}
          className="pr-9 font-mono text-xs h-10 w-full"
          autoComplete="off"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              className="absolute right-0.5 h-8 w-8 text-muted-foreground hover:text-foreground"
              title="Naptár megnyitása"
            >
              <CalendarIcon className="h-4 w-4 text-primary" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className={cn("w-auto p-0 border border-border/60 shadow-xl rounded-xl z-[1200]", popoverClassName)} align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              disabled={(date) => {
                if (effectiveMinDate && date < effectiveMinDate) return true;
                if (effectiveMaxDate && date > effectiveMaxDate) return true;
                return false;
              }}
              locale={hu}
              initialFocus
              className="rounded-xl p-3"
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

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
            if (effectiveMinDate && date < effectiveMinDate) return true;
            if (effectiveMaxDate && date > effectiveMaxDate) return true;
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
