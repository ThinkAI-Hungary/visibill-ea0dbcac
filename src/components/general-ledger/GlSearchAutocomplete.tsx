import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Loader2, X, BookOpen, FileText, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { searchGlEntities, GlSearchResult } from '@/lib/glData';

export interface GlSearchAutocompleteProps {
  companyId?: string | null;
  presetId?: string | null;
  onSelect: (result: GlSearchResult) => void;
  onClear?: () => void;
  className?: string;
  placeholder?: string;
}

export const GlSearchAutocomplete: React.FC<GlSearchAutocompleteProps> = ({
  companyId,
  presetId,
  onSelect,
  onClear,
  className,
  placeholder = 'Keresés a főkönyvben (szám, név, partner)...',
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Split results into accounts and items
  const { accountResults, itemResults, flatResults } = useMemo(() => {
    const accounts = results.filter((r) => r.entity_type === 'account');
    const items = results.filter((r) => r.entity_type === 'item');
    return {
      accountResults: accounts,
      itemResults: items,
      flatResults: [...accounts, ...items],
    };
  }, [results]);

  // Perform debounced search
  const performSearch = useCallback(
    async (searchTerm: string) => {
      const cleanTerm = searchTerm.trim();
      if (!cleanTerm || cleanTerm.length < 2 || !companyId || !presetId) {
        setResults([]);
        setIsLoading(false);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const data = await searchGlEntities({
          companyId,
          presetId,
          query: cleanTerm,
          limit: 14,
        });
        setResults(data);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch (err) {
        console.error('GlSearchAutocomplete query error:', err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [companyId, presetId]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (val.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      performSearch(val);
    }, 300);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setIsLoading(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (onClear) {
      onClear();
    }
  };

  const handleSelectItem = (item: GlSearchResult) => {
    onSelect(item);
    setIsOpen(false);
    setQuery(item.title);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || flatResults.length === 0) {
      if (e.key === 'ArrowDown' && results.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flatResults.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatResults.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flatResults.length) {
        handleSelectItem(flatResults[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={placeholder}
              className="w-[260px] sm:w-[320px] h-9 pl-9 pr-14 text-xs bg-background transition-all focus-visible:ring-1"
              value={query}
              onChange={handleInputChange}
              onFocus={() => {
                if (results.length > 0 && query.trim().length >= 2) {
                  setIsOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary shrink-0" />}
              {query ? (
                <CustomTooltip content="Keresés törlése" side="top">
                  <button
                    type="button"
                    onClick={handleClear}
                    aria-label="Keresés törlése"
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </CustomTooltip>
              ) : null}
            </div>
          </div>
        </PopoverTrigger>

        {/* Popover Dropdown Results teleported via Portal into body */}
        <PopoverContent
          align="start"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className="w-[360px] sm:w-[440px] max-h-[420px] overflow-y-auto p-0 bg-popover/95 backdrop-blur-md border border-border shadow-2xl rounded-lg z-[100] py-1 divide-y divide-border/40"
        >
          {flatResults.length === 0 && !isLoading && (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Nincs találat a(z) &ldquo;<span className="font-semibold text-foreground">{query}</span>&rdquo; kifejezésre.
            </div>
          )}

          {/* Accounts Group */}
          {accountResults.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  Főkönyvi számlák
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {accountResults.length}
                </Badge>
              </div>
              <div className="space-y-0.5 px-1">
                {accountResults.map((item) => {
                  const itemIndex = flatResults.indexOf(item);
                  const isFocused = selectedIndex === itemIndex;
                  return (
                    <button
                      key={`acc_${item.gl_number}`}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 text-xs transition-colors',
                        isFocused ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/70 text-foreground'
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                          {item.gl_number}
                        </span>
                        <span className="truncate">{item.title}</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Items / Transactions Group */}
          {itemResults.length > 0 && (
            <div className="py-1">
              <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-amber-500" />
                  Tételek és bizonylatok
                </span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {itemResults.length}
                </Badge>
              </div>
              <div className="space-y-0.5 px-1">
                {itemResults.map((item) => {
                  const itemIndex = flatResults.indexOf(item);
                  const isFocused = selectedIndex === itemIndex;
                  return (
                    <button
                      key={`item_${item.entity_id}`}
                      type="button"
                      onClick={() => handleSelectItem(item)}
                      onMouseEnter={() => setSelectedIndex(itemIndex)}
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 rounded-md flex items-center justify-between gap-2 text-xs transition-colors',
                        isFocused ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/70 text-foreground'
                      )}
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground shrink-0">
                            {item.target_gl_number || 'UNCLASS'}
                          </span>
                          <span className="truncate font-medium">{item.title}</span>
                        </div>
                        {item.subtitle && (
                          <span className="text-[11px] text-muted-foreground truncate ml-0.5 mt-0.5">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

