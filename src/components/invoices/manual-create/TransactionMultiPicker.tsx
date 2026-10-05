import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CreditCard, ChevronsUpDown, Check, X, Loader2, Plus, ArrowDownRight, ArrowUpRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/locale/formatters';

export interface SelectedTransactionItem {
  id: string;
  amount: number;
  description: string | null;
  transaction_date: string;
  currency: string | null;
  type?: string | null;
  matched_invoice_id?: string | null;
}

interface TransactionMultiPickerProps {
  companyId: string;
  selectedTransactions: SelectedTransactionItem[];
  onToggleTransaction: (tx: SelectedTransactionItem) => void;
  onRemoveTransaction: (id: string) => void;
  invoiceGrossAmount?: number;
  invoiceCurrency?: string;
  disabled?: boolean;
}

export function TransactionMultiPicker({
  companyId,
  selectedTransactions,
  onToggleTransaction,
  onRemoveTransaction,
  invoiceGrossAmount = 0,
  invoiceCurrency = 'HUF',
  disabled = false,
}: TransactionMultiPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showAllTransactions, setShowAllTransactions] = useState(false);

  // Fetch recent company transactions
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions-picker', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, amount, description, transaction_date, currency, type, matched_invoice_id')
        .eq('company_id', companyId)
        .order('transaction_date', { ascending: false })
        .limit(60);

      if (error) throw error;
      return (data || []) as SelectedTransactionItem[];
    },
    enabled: Boolean(companyId) && open,
    staleTime: 30000,
  });

  const selectedIds = useMemo(() => new Set(selectedTransactions.map(t => t.id)), [selectedTransactions]);

  const totalSelectedAmount = useMemo(() => {
    return selectedTransactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
  }, [selectedTransactions]);

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      // 1. Put already selected items first
      const aSelected = selectedIds.has(a.id);
      const bSelected = selectedIds.has(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      // 2. Put unmatched items before matched items
      const aUnmatched = !a.matched_invoice_id;
      const bUnmatched = !b.matched_invoice_id;
      if (aUnmatched && !bUnmatched) return -1;
      if (!aUnmatched && bUnmatched) return 1;

      // 3. Date descending
      const dateA = a.transaction_date || '';
      const dateB = b.transaction_date || '';
      return dateB.localeCompare(dateA);
    });
  }, [transactions, selectedIds]);

  const filteredTransactions = useMemo(() => {
    let list = sortedTransactions;
    // If not searching and not showing all, only show unmatched transactions + selected transactions
    if (!search.trim() && !showAllTransactions) {
      list = list.filter(tx => selectedIds.has(tx.id) || !tx.matched_invoice_id);
    }
    if (!search.trim()) return list;

    const q = search.toLowerCase().trim();
    return sortedTransactions.filter(tx => {
      const desc = (tx.description || '').toLowerCase();
      const amountStr = String(tx.amount || '');
      const dateStr = (tx.transaction_date || '').toLowerCase();
      return desc.includes(q) || amountStr.includes(q) || dateStr.includes(q);
    });
  }, [sortedTransactions, search, showAllTransactions, selectedIds]);

  const displayedTransactions = useMemo(() => {
    return filteredTransactions.slice(0, 20);
  }, [filteredTransactions]);

  const balanceDifference = (invoiceGrossAmount || 0) - totalSelectedAmount;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <CreditCard className="h-3.5 w-3.5 text-primary" />
          Kiegyenlítő banki tranzakció(k) csatolása
        </label>
        {selectedTransactions.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            {selectedTransactions.length} tétel kijelölve • Össz: <strong className="text-foreground">{formatCurrency(totalSelectedAmount, invoiceCurrency)}</strong>
          </span>
        )}
      </div>

      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between h-auto py-2 px-3 text-left font-normal border-dashed border-border/80 hover:border-primary/60 transition-colors"
          >
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span>Tranzakció kiválasztása vagy hozzáadása...</span>
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="w-[500px] p-0 flex flex-col h-[350px] shadow-lg border-border/80"
          align="start"
          sideOffset={6}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <SearchInput
            variant="borderless"
            placeholder="Keresés közlemény vagy összeg szerint..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            autoFocus
            rightElement={
              <span className="text-[10px] text-muted-foreground tabular-nums px-1.5 py-0.5 rounded bg-muted/60">
                {filteredTransactions.length} db
              </span>
            }
          />

          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/40 text-[11px] text-muted-foreground shrink-0">
            <span>
              {showAllTransactions ? 'Összes tranzakció listázva' : 'Csak párosítatlan tranzakciók'}
            </span>
            <button
              type="button"
              onClick={() => setShowAllTransactions(!showAllTransactions)}
              className="text-primary hover:underline font-medium hover:text-primary/80 transition-colors"
            >
              {showAllTransactions ? 'Csak párosítatlanok' : 'Összes mutatása'}
            </button>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-1 divide-y divide-border/20"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {isLoading ? (
              <div className="h-full flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span>Tranzakciók betöltése...</span>
              </div>
            ) : displayedTransactions.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-xs text-muted-foreground">
                <Search className="h-7 w-7 text-muted-foreground/30 mb-2" />
                <span className="font-medium text-foreground/80">Nem található tranzakció</span>
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  {search ? `Nincs találat a(z) "${search}" keresésre.` : 'Nincs megjeleníthető párosítatlan tranzakció.'}
                </span>
              </div>
            ) : (
              displayedTransactions.map((tx) => {
                const isSelected = selectedIds.has(tx.id);
                const isExpense = tx.amount < 0 || tx.type === 'expense';

                return (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => onToggleTransaction(tx)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-md hover:bg-accent/50 transition-colors flex items-center justify-between gap-3 text-xs",
                      isSelected && "bg-primary/10 text-primary font-medium"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {isExpense ? (
                          <ArrowDownRight className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        )}
                        <span className="font-medium text-foreground truncate text-xs">
                          {tx.description || 'Közlemény nélküli tétel'}
                        </span>
                        {tx.matched_invoice_id && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/30 text-amber-500 shrink-0">
                            Párosítva
                          </Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 ml-5">
                        Dátum: {tx.transaction_date || '-'}
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-2">
                      <div className={cn(
                        "font-semibold tabular-nums text-xs",
                        isExpense ? "text-foreground" : "text-emerald-500"
                      )}>
                        {formatCurrency(tx.amount, tx.currency || 'HUF')}
                      </div>
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center",
                        isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border/60"
                      )}>
                        {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {filteredTransactions.length > displayedTransactions.length && (
            <div className="p-2 border-t border-border/40 bg-muted/20 text-center text-[11px] text-muted-foreground shrink-0">
              Még {filteredTransactions.length - displayedTransactions.length} tranzakció • Pontosításhoz használja a fenti keresőt
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Selected transactions pills */}
      {selectedTransactions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedTransactions.map((tx) => (
            <Badge
              key={tx.id}
              variant="secondary"
              className="text-xs py-1 px-2 gap-1.5 bg-muted/60 border border-border/40 font-normal"
            >
              <CreditCard className="h-3 w-3 text-primary shrink-0" />
              <span className="truncate max-w-[180px] font-medium text-foreground">
                {tx.description || 'Tranzakció'}
              </span>
              <span className="font-semibold text-foreground tabular-nums">
                {formatCurrency(tx.amount, tx.currency || 'HUF')}
              </span>
              <button
                type="button"
                onClick={() => onRemoveTransaction(tx.id)}
                className="ml-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Settlement helper note */}
      {selectedTransactions.length > 0 && invoiceGrossAmount > 0 && (
        <div className="text-[11px] p-2 rounded-md bg-muted/30 border border-border/30 flex items-center justify-between">
          <span className="text-muted-foreground">Kiegyenlítés fedezete:</span>
          {Math.abs(balanceDifference) < 1 ? (
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <Check className="h-3 w-3" /> Teljesen kiegyenlítve
            </span>
          ) : balanceDifference > 0 ? (
            <span className="text-blue-500 font-medium">
              Részfizetés (Hátralévő: {formatCurrency(balanceDifference, invoiceCurrency)})
            </span>
          ) : (
            <span className="text-amber-500 font-medium">
              Túlfizetés ({formatCurrency(Math.abs(balanceDifference), invoiceCurrency)})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
