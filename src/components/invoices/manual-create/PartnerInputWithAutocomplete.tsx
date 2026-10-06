import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search-input';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import { ChevronsUpDown, Check, Building2, X, Plus, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PartnerOption {
  id: string;
  name: string;
  tax_number?: string | null;
  partner_type?: string | null;
}

interface PartnerInputWithAutocompleteProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSelectPartner?: (partner: PartnerOption) => void;
  partners: PartnerOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  filterType?: 'customer' | 'supplier' | 'all';
}

export function PartnerInputWithAutocomplete({
  id,
  value,
  onChange,
  onSelectPartner,
  partners = [],
  placeholder = 'Partner neve...',
  disabled = false,
  className,
  filterType = 'all',
}: PartnerInputWithAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setSearch(value || '');
    }
  };

  // Filter partners according to filterType and search text
  const filteredPartners = useMemo(() => {
    let pool = partners;
    if (filterType === 'customer') {
      pool = partners.filter(p => !p.partner_type || p.partner_type === 'customer' || p.partner_type === 'both');
    } else if (filterType === 'supplier') {
      pool = partners.filter(p => !p.partner_type || p.partner_type === 'supplier' || p.partner_type === 'both');
    }

    const q = search.trim().toLowerCase();
    if (!q) return pool;

    return pool.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.tax_number && p.tax_number.toLowerCase().includes(q))
    );
  }, [partners, filterType, search]);

  const hasExactMatch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return false;
    return filteredPartners.some(p => p.name.toLowerCase() === q);
  }, [filteredPartners, search]);

  const handleSelect = (partner: PartnerOption) => {
    onChange(partner.name);
    onSelectPartner?.(partner);
    setOpen(false);
  };

  const handleUseCustom = (customName: string) => {
    onChange(customName);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <Popover open={open && !disabled} onOpenChange={handleOpenChange}>
        <PopoverAnchor asChild>
          <div className="relative flex items-center w-full">
            <Input
              ref={inputRef}
              id={id}
              value={value}
              onChange={(e) => {
                onChange(e.target.value);
                setSearch(e.target.value);
                if (!open) handleOpenChange(true);
              }}
              onFocus={() => {
                if (!open) handleOpenChange(true);
              }}
              onClick={() => {
                if (!open) handleOpenChange(true);
              }}
              placeholder={placeholder}
              disabled={disabled}
              className="pr-16 text-xs h-8 w-full"
              autoComplete="off"
            />
            <div className="absolute right-1 flex items-center gap-0.5">
              {value && !disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleClear}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  title="Mező törlése"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled}
                onClick={() => handleOpenChange(!open)}
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                title="Partnertörzs lista megnyitása"
              >
                <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </div>
          </div>
        </PopoverAnchor>

        <PopoverContent
          className="w-[420px] p-0 flex flex-col h-[320px] shadow-lg border-border/80"
          align="start"
          sideOffset={6}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onPointerDownOutside={(e) => {
            if (containerRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            if (containerRef.current?.contains(e.target as Node)) {
              e.preventDefault();
            }
          }}
        >
          <SearchInput
            variant="borderless"
            placeholder="Keresés partner neve vagy adószáma alapján..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            autoFocus
            rightElement={
              <span className="text-[10px] text-muted-foreground tabular-nums px-1.5 py-0.5 rounded bg-muted/60">
                {filteredPartners.length} db
              </span>
            }
          />

          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/40 text-[11px] text-muted-foreground shrink-0">
            <span>Partnertörzs ({filteredPartners.length})</span>
            {filterType !== 'all' && (
              <Badge variant="outline" className="text-[9px] h-4 py-0 px-1 border-muted">
                {filterType === 'customer' ? 'Vevők' : 'Szállítók'}
              </Badge>
            )}
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-1 divide-y divide-border/20"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {/* If custom query is entered that doesn't match an existing partner */}
            {search.trim() && !hasExactMatch && (
              <button
                type="button"
                onClick={() => handleUseCustom(search.trim())}
                className="w-full text-left p-2 rounded-md hover:bg-primary/10 transition-colors flex items-center justify-between group mb-1"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Plus className="h-3.5 w-3.5 text-primary shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-primary truncate">
                      Új partner használata: "{search.trim()}"
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Nem található a törzsben, rögzítés ezzel a névvel
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] h-4 py-0 px-1 border-primary/40 text-primary">
                  Új partner
                </Badge>
              </button>
            )}

            {filteredPartners.length === 0 && !search.trim() ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                <Building2 className="h-7 w-7 text-muted-foreground/30 mb-2" />
                <span className="font-medium text-foreground/80">Nincsenek partnerek a listában</span>
              </div>
            ) : filteredPartners.length === 0 && search.trim() ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                <Search className="h-7 w-7 text-muted-foreground/30 mb-2" />
                <span className="font-medium text-foreground/80">Nincs találat a partnertörzsben</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  "{search.trim()}" néven nem található partner. Kattints a fenti gombra az új név használatához.
                </span>
              </div>
            ) : (
              filteredPartners.map((partner) => {
                const isSelected = partner.name.toLowerCase() === value.trim().toLowerCase();
                return (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={() => handleSelect(partner)}
                    className={cn(
                      "w-full text-left p-2 rounded-md hover:bg-accent/60 transition-colors flex items-center justify-between gap-2 text-xs",
                      isSelected && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <div className="flex flex-col min-w-0 truncate">
                        <span className="truncate font-medium text-foreground">{partner.name}</span>
                        {partner.tax_number && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Adószám: {partner.tax_number}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
