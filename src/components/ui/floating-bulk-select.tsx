import React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

export interface FloatingBulkSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export interface FloatingBulkSelectProps {
  value?: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  icon?: React.ReactNode;
  options: FloatingBulkSelectOption[];
  className?: string;
  popoverWidth?: string;
  disabled?: boolean;
}

export function FloatingBulkSelect({
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  icon,
  options,
  className,
  popoverWidth = 'w-[200px]',
  disabled = false,
}: FloatingBulkSelectProps) {
  const { t } = useTranslation(['common']);
  const effectivePlaceholder = placeholder ?? t('common:floating_bulk_bar.select_placeholder', 'Kiválasztás...');
  const effectiveSearchPlaceholder = searchPlaceholder ?? t('common:floating_bulk_bar.search_placeholder', 'Keresés...');
  const effectiveEmptyText = emptyText ?? t('common:floating_bulk_bar.empty_text', 'Nincs találat');

  const [open, setOpen] = React.useState(false);

  const selectedOption = React.useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  const displayLabel = selectedOption ? selectedOption.label : effectivePlaceholder;
  const isPlaceholder = !selectedOption;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          style={{ outline: 'none' }}
          className={cn(
            'h-9 text-xs w-[145px] sm:w-[160px] shrink-0 justify-between',
            'bg-background border text-foreground font-medium shadow-sm rounded-lg px-2.5',
            open
              ? 'border-primary/80 bg-accent/40 text-foreground'
              : 'border-border/80 hover:border-primary/50 hover:bg-accent/40',
            'data-[state=open]:border-primary/80 data-[state=open]:bg-accent/40',
            'transition-colors duration-150',
            'outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 focus-visible:ring-offset-0',
            '[outline:none!important] focus:[outline:none!important] focus-visible:[outline:none!important]',
            '[box-shadow:none!important] focus:[box-shadow:none!important] focus-visible:[box-shadow:none!important]',
            className
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            {icon && <span className={cn('shrink-0 transition-colors', open ? 'text-primary' : 'text-muted-foreground')}>{icon}</span>}
            <span className={cn('truncate', isPlaceholder && (open ? 'text-foreground/80' : 'text-muted-foreground'))}>
              {displayLabel}
            </span>
          </div>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 ml-1 transition-colors', open ? 'opacity-80 text-primary' : 'opacity-50')} />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        sideOffset={8}
        align="start"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
        }}
        className={cn('z-[10001] p-0 bg-popover border border-border shadow-2xl rounded-lg', popoverWidth)}
      >
        <Command>
          <CommandInput
            placeholder={effectiveSearchPlaceholder}
            className="h-9 text-xs outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
          />
          <CommandList className="max-h-[220px] overflow-y-auto">
            <CommandEmpty className="py-3 text-center text-xs text-muted-foreground">
              {effectiveEmptyText}
            </CommandEmpty>
            <CommandGroup>
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.label} ${opt.value}`}
                    onSelect={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                    className="text-xs flex items-center justify-between cursor-pointer py-1.5 px-2"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <span className={cn('truncate', isSelected && 'font-semibold text-primary')}>
                        {opt.label}
                      </span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-2" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
