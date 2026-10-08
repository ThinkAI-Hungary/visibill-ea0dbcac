import React, { useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronsUpDown, Check, X, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PartnerOption {
  id: string;
  name: string;
  tax_number?: string | null;
}

interface JournalLinePartnerPickerProps {
  id?: string;
  selectedPartnerId: string | null | undefined;
  onSelectPartner?: (partnerId: string | null) => void;
  onChange?: (partnerId: string | null) => void;
  partners: PartnerOption[];
  isRequired?: boolean;
  disabled?: boolean;
}

export const JournalLinePartnerPicker: React.FC<JournalLinePartnerPickerProps> = ({
  id,
  selectedPartnerId,
  onSelectPartner,
  onChange,
  partners,
  isRequired = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSelectPartner = (partnerId: string | null) => {
    onSelectPartner?.(partnerId);
    onChange?.(partnerId);
  };

  const currentPartner = useMemo(() => {
    if (!selectedPartnerId || selectedPartnerId === 'none') return null;
    return partners.find(p => p.id === selectedPartnerId) || null;
  }, [partners, selectedPartnerId]);

  const normalizeText = (text: string) =>
    (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  const filteredPartners = useMemo(() => {
    const q = normalizeText(searchQuery.trim());
    if (!q) return partners.slice(0, 50);
    return partners
      .filter(p => normalizeText(p.name).includes(q) || (p.tax_number && p.tax_number.includes(q)))
      .slice(0, 50);
  }, [partners, searchQuery]);

  return (
    <div className="relative flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "h-8 text-xs font-normal justify-between w-full min-w-[140px] px-2",
              !currentPartner && isRequired && "border-amber-500/50 bg-amber-500/5 text-amber-900 dark:text-amber-300",
              !currentPartner && !isRequired && "text-muted-foreground",
              currentPartner && "text-foreground font-medium"
            )}
          >
            <div className="flex items-center gap-1.5 truncate">
              <User className={cn("w-3 h-3 shrink-0", isRequired ? "text-amber-500" : "text-muted-foreground")} />
              <span className="truncate">
                {currentPartner ? currentPartner.name : (isRequired ? 'Partner kötelező *' : 'Nincs partner')}
              </span>
            </div>
            <ChevronsUpDown className="w-3 h-3 opacity-50 shrink-0 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Partner keresése név vagy adószám..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="text-xs h-8"
            />
            <CommandList className="max-h-[220px]">
              <CommandEmpty className="py-2.5 text-center text-xs text-muted-foreground">
                Nincs találat.
              </CommandEmpty>
              <CommandGroup>
                {!isRequired && (
                  <CommandItem
                    value="none"
                    onSelect={() => {
                      handleSelectPartner(null);
                      setOpen(false);
                    }}
                    className="text-xs flex items-center justify-between italic text-muted-foreground cursor-pointer"
                  >
                    <span>— Nincs partner —</span>
                    {!currentPartner && <Check className="w-3.5 h-3.5 text-primary" />}
                  </CommandItem>
                )}
                {filteredPartners.map(p => {
                  const isSelected = currentPartner?.id === p.id;
                  return (
                    <CommandItem
                      key={p.id}
                      value={p.id}
                      onSelect={() => {
                        handleSelectPartner(p.id);
                        setOpen(false);
                      }}
                      className="text-xs flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex flex-col min-w-0 pr-2">
                        <span className="truncate font-medium">{p.name}</span>
                        {p.tax_number && (
                          <span className="text-[10px] text-muted-foreground font-mono">{p.tax_number}</span>
                        )}
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {currentPartner && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 ml-1 text-muted-foreground hover:text-foreground shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            handleSelectPartner(null);
          }}
          title="Partner eltávolítása a sorból"
        >
          <X className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
};

export default JournalLinePartnerPicker;
