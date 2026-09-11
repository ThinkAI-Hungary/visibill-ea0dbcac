import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X, ChevronsUpDown, Check, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { type GlAccountRow } from '@/lib/glData';

export interface PayrollGlAccountSelectorProps {
  value: string;
  allAccounts: GlAccountRow[];
  isLoading?: boolean;
  preferredClass: '5' | '4';
  defaultLabel: string;
  onSelect: (accountId: string) => void;
  disabled?: boolean;
  className?: string;
}

const normalizeText = (text?: string | null): string => {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

export const PayrollGlAccountSelector: React.FC<PayrollGlAccountSelectorProps> = ({
  value,
  allAccounts,
  isLoading = false,
  preferredClass,
  defaultLabel,
  onSelect,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [displayLimit, setDisplayLimit] = useState(100);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayLimit(100);
  }, [searchQuery, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [open]);

  // Find currently selected account
  const selectedAccount = useMemo(() => {
    if (!value) return null;
    return allAccounts.find(a => a.id === value || a.gl_number === value) || null;
  }, [allAccounts, value]);

  // Accounts by classes
  const { class5Accounts, class4Accounts, otherAccounts } = useMemo(() => {
    const c5: GlAccountRow[] = [];
    const c4: GlAccountRow[] = [];
    const others: GlAccountRow[] = [];

    allAccounts.forEach(a => {
      const num = a.gl_number || '';
      if (num.startsWith('5')) {
        c5.push(a);
      } else if (num.startsWith('4')) {
        c4.push(a);
      } else {
        others.push(a);
      }
    });

    const sortFn = (x: GlAccountRow, y: GlAccountRow) => (x.gl_number || '').localeCompare(y.gl_number || '');
    c5.sort(sortFn);
    c4.sort(sortFn);
    others.sort(sortFn);

    return { class5Accounts: c5, class4Accounts: c4, otherAccounts: others };
  }, [allAccounts]);

  // Filtered accounts when searching
  const filteredAccounts = useMemo(() => {
    const query = normalizeText(searchQuery);
    if (!query) return [];

    const terms = query.split(/\s+/).filter(Boolean);

    const matches = allAccounts.filter(a => {
      const numNorm = normalizeText(a.gl_number);
      const nameNorm = normalizeText(a.short_name || a.description);
      const combined = `${numNorm} ${nameNorm}`;
      return terms.every(t => combined.includes(t));
    });

    // Sort: exact number matches or startsWith first
    matches.sort((a, b) => {
      const aNum = normalizeText(a.gl_number);
      const bNum = normalizeText(b.gl_number);

      const aExact = aNum === query;
      const bExact = bNum === query;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aStarts = aNum.startsWith(query);
      const bStarts = bNum.startsWith(query);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return (a.gl_number || '').localeCompare(b.gl_number || '');
    });

    return matches;
  }, [allAccounts, searchQuery]);

  const handleChoose = (account: GlAccountRow) => {
    onSelect(account.id);
    setOpen(false);
  };

  const primaryGroup = preferredClass === '5'
    ? { title: '5-ös számlaosztály (Költségnemek - Ajánlott)', accounts: class5Accounts, badgeClass: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20' }
    : { title: '4-es számlaosztály (Kötelezettségek - Ajánlott)', accounts: class4Accounts, badgeClass: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20' };

  const secondaryGroup = preferredClass === '5'
    ? { title: '4-es számlaosztály (Kötelezettségek)', accounts: class4Accounts, badgeClass: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20' }
    : { title: '5-ös számlaosztály (Költségnemek)', accounts: class5Accounts, badgeClass: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20' };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          title={selectedAccount ? `${selectedAccount.gl_number} — ${selectedAccount.short_name || selectedAccount.description}` : defaultLabel}
          className={cn(
            'h-8 rounded-md px-2.5 py-1 text-xs border transition-all flex items-center justify-between gap-2 text-left cursor-pointer select-none',
            'bg-background hover:bg-muted/60 text-foreground border-input',
            'hover:border-primary/60 data-[state=open]:border-primary',
            'outline-none focus:outline-none focus-visible:outline-none active:outline-none',
            '[outline:none!important] focus:[outline:none!important] focus-visible:[outline:none!important] active:[outline:none!important]',
            'ring-0 focus:ring-0 focus-visible:ring-0 active:ring-0 ring-offset-0',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
          style={{ outline: 'none', outlineOffset: 0, boxShadow: 'none' }}
        >
          <span className="truncate flex-1 flex items-center gap-1.5 min-w-0">
            {isLoading && allAccounts.length === 0 ? (
              <span className="flex items-center gap-1 text-muted-foreground font-normal">
                <Loader2 className="w-3 h-3 animate-spin inline" /> Betöltés...
              </span>
            ) : selectedAccount ? (
              <>
                <span
                  className={cn(
                    'font-mono font-bold text-[11px] px-1.5 py-0.5 rounded border shrink-0',
                    selectedAccount.gl_number?.startsWith('5')
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                      : selectedAccount.gl_number?.startsWith('4')
                      ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                      : 'bg-muted text-muted-foreground border-border'
                  )}
                >
                  {selectedAccount.gl_number}
                </span>
                <span className="font-medium text-foreground truncate text-xs">
                  {selectedAccount.short_name || selectedAccount.description}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground font-normal truncate">{defaultLabel}</span>
            )}
          </span>
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-60 shrink-0 text-muted-foreground ml-1" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[360px] sm:w-[440px] p-0 bg-popover text-popover-foreground border border-border shadow-xl rounded-lg overflow-hidden z-[1200]"
      >
        {/* Search Bar Header */}
        <div className="flex items-center border-b border-border px-3 py-2 bg-muted/40">
          <Search className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Keresés szám vagy név alapján (pl. 541, bér)..."
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 text-muted-foreground hover:text-foreground rounded outline-none focus:outline-none"
              style={{ outline: 'none' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Account List Area */}
        <div className="max-h-[300px] overflow-y-auto p-1.5 space-y-2">
          {isLoading && allAccounts.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span>Főkönyvi számlák betöltése...</span>
            </div>
          ) : searchQuery.trim() !== '' ? (
            // Search Results Mode
            filteredAccounts.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Nem található számla a következőre: <span className="text-foreground font-mono font-semibold">"{searchQuery}"</span>
              </div>
            ) : (
              <div>
                <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Találatok</span>
                  <span className="font-mono text-muted-foreground">{filteredAccounts.length} találat</span>
                </div>
                <div className="space-y-0.5 mt-1">
                  {filteredAccounts.slice(0, displayLimit).map((acc) => {
                    const isSelected = selectedAccount?.id === acc.id;
                    const isC5 = acc.gl_number?.startsWith('5');
                    const isC4 = acc.gl_number?.startsWith('4');

                    return (
                      <div
                        key={acc.id}
                        onClick={() => handleChoose(acc)}
                        className={cn(
                          'px-2 py-1.5 rounded-md text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors',
                          isSelected
                            ? 'bg-accent text-accent-foreground font-semibold'
                            : 'text-foreground hover:bg-muted/70'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className={cn(
                              'font-mono font-bold px-1.5 py-0.5 rounded text-[11px] shrink-0 border',
                              isC5
                                ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20'
                                : isC4
                                ? 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/20'
                                : 'text-muted-foreground bg-muted border-border'
                            )}
                          >
                            {acc.gl_number}
                          </span>
                          <span className="truncate">{acc.short_name || acc.description}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />}
                      </div>
                    );
                  })}
                  {filteredAccounts.length > displayLimit && (
                    <button
                      type="button"
                      onClick={() => setDisplayLimit(prev => prev + 100)}
                      className="w-full py-2 text-center text-xs font-semibold text-primary hover:text-primary/80 hover:bg-muted/50 rounded-md transition-colors outline-none focus:outline-none"
                      style={{ outline: 'none' }}
                    >
                      További 100 találat megjelenítése (még {filteredAccounts.length - displayLimit} találat)...
                    </button>
                  )}
                </div>
              </div>
            )
          ) : (
            // Grouped Browse Mode (Empty Search)
            <div className="space-y-3">
              {/* Primary Group */}
              {primaryGroup.accounts.length > 0 && (
                <div>
                  <div className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>{primaryGroup.title}</span>
                    <span className="font-mono text-muted-foreground text-[9px]">{primaryGroup.accounts.length} számla</span>
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {primaryGroup.accounts.map((acc) => {
                      const isSelected = selectedAccount?.id === acc.id;
                      return (
                        <div
                          key={acc.id}
                          onClick={() => handleChoose(acc)}
                          className={cn(
                            'px-2 py-1.5 rounded-md text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors',
                            isSelected
                              ? 'bg-accent text-accent-foreground font-semibold'
                              : 'text-foreground hover:bg-muted/70'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={cn('font-mono font-bold px-1.5 py-0.5 rounded text-[11px] shrink-0 border', primaryGroup.badgeClass)}>
                              {acc.gl_number}
                            </span>
                            <span className="truncate">{acc.short_name || acc.description}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Secondary Group */}
              {secondaryGroup.accounts.length > 0 && (
                <div>
                  <div className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>{secondaryGroup.title}</span>
                    <span className="font-mono text-muted-foreground text-[9px]">{secondaryGroup.accounts.length} számla</span>
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {secondaryGroup.accounts.map((acc) => {
                      const isSelected = selectedAccount?.id === acc.id;
                      return (
                        <div
                          key={acc.id}
                          onClick={() => handleChoose(acc)}
                          className={cn(
                            'px-2 py-1.5 rounded-md text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors',
                            isSelected
                              ? 'bg-accent text-accent-foreground font-semibold'
                              : 'text-foreground hover:bg-muted/70'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className={cn('font-mono font-bold px-1.5 py-0.5 rounded text-[11px] shrink-0 border', secondaryGroup.badgeClass)}>
                              {acc.gl_number}
                            </span>
                            <span className="truncate">{acc.short_name || acc.description}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Other Accounts */}
              {otherAccounts.length > 0 && (
                <div>
                  <div className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>Egyéb számlaosztályok</span>
                    <span className="font-mono text-muted-foreground text-[9px]">{otherAccounts.length} számla</span>
                  </div>
                  <div className="space-y-0.5 mt-1">
                    {otherAccounts.map((acc) => {
                      const isSelected = selectedAccount?.id === acc.id;
                      return (
                        <div
                          key={acc.id}
                          onClick={() => handleChoose(acc)}
                          className={cn(
                            'px-2 py-1.5 rounded-md text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors',
                            isSelected
                              ? 'bg-accent text-accent-foreground font-semibold'
                              : 'text-foreground hover:bg-muted/70'
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-mono font-bold px-1.5 py-0.5 rounded text-[11px] shrink-0 text-muted-foreground bg-muted border border-border">
                              {acc.gl_number}
                            </span>
                            <span className="truncate">{acc.short_name || acc.description}</span>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="px-3 py-1.5 border-t border-border bg-muted/40 text-[10px] text-muted-foreground flex items-center justify-between">
          <span>Összes számla: <strong className="font-mono text-foreground">{allAccounts.length}</strong></span>
          <span className="text-muted-foreground text-[9px]">Gépeljen a gyors szűréshez</span>
        </div>
      </PopoverContent>
    </Popover>
  );
};
