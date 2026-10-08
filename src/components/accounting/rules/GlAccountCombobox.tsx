import React, { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { GlAccountOption } from '@/hooks/useAutoAccountingRules';

interface GlAccountComboboxProps {
  value: string | null;
  onChange: (value: string | null) => void;
  accounts: GlAccountOption[];
  placeholder?: string;
  recommendedNumbers?: string[];
  disabled?: boolean;
  className?: string;
}

export const GlAccountCombobox: React.FC<GlAccountComboboxProps> = ({
  value,
  onChange,
  accounts,
  placeholder = 'Válassz főkönyvi számlát...',
  recommendedNumbers = [],
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false);

  const selectedAccount = useMemo(() => {
    if (!value) return null;
    return accounts.find((acc) => acc.id === value) || null;
  }, [value, accounts]);

  const recommendedMatches = useMemo(() => {
    if (!recommendedNumbers.length) return [];
    return accounts.filter((acc) =>
      recommendedNumbers.some((num) => acc.gl_number.startsWith(num))
    );
  }, [accounts, recommendedNumbers]);

  return (
    <div className={cn('flex items-center gap-1.5 w-full', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between font-normal h-9 bg-background/60 hover:bg-background border-border/70"
          >
            {selectedAccount ? (
              <span className="flex items-center gap-2 truncate">
                <span className="font-mono font-semibold text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                  {selectedAccount.gl_number}
                </span>
                <span className="truncate text-foreground text-xs">{selectedAccount.short_name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[380px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Keresés számlaszám vagy név szerint..." className="text-xs h-9" />
            <CommandList className="max-h-[280px]">
              <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                Nem található megfelelő főkönyvi számla.
              </CommandEmpty>

              {/* Recommended section if any */}
              {recommendedMatches.length > 0 && (
                <CommandGroup heading="Ajánlott számlaszámok">
                  {recommendedMatches.map((acc) => (
                    <CommandItem
                      key={`rec-${acc.id}`}
                      value={`${acc.gl_number} ${acc.short_name}`}
                      onSelect={() => {
                        onChange(acc.id);
                        setOpen(false);
                      }}
                      className="text-xs cursor-pointer"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-3.5 w-3.5 text-primary',
                          value === acc.id ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className="font-mono font-bold mr-2 text-primary">{acc.gl_number}</span>
                      <span className="truncate text-foreground">{acc.short_name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* All accounts */}
              <CommandGroup heading="Minden elérhető számla">
                {accounts.map((acc) => (
                  <CommandItem
                    key={acc.id}
                    value={`${acc.gl_number} ${acc.short_name}`}
                    onSelect={() => {
                      onChange(acc.id);
                      setOpen(false);
                    }}
                    className="text-xs cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-3.5 w-3.5 text-primary',
                        value === acc.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="font-mono font-semibold mr-2">{acc.gl_number}</span>
                    <span className="truncate">{acc.short_name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {value && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
          onClick={() => onChange(null)}
          title="Számlaszám törlése"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
};
