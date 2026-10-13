import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Search,
  Check,
  ChevronsUpDown,
  Sparkles,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { formatDateLocale } from '@/lib/locale/formatters';
import {
  TypelessTransaction,
  PresetGlAccount,
  ApproveTransactionPayload,
} from '@/hooks/useTypelessTransactions';

export const TRANSACTION_TYPE_OPTIONS = [
  { value: 'bankköltség', label: 'Bankköltség / Banki díj', defaultPrefix: '532' },
  { value: 'szállítói tranzakció', label: 'Szállítói számlakiegyenlítés', defaultPrefix: '454' },
  { value: 'vevői tranzakció', label: 'Vevői befizetés / Követelés', defaultPrefix: '311' },
  { value: 'járulékok/adók', label: 'Adó és járulék befizetés (NAV)', defaultPrefix: '463' },
  { value: 'bérek', label: 'Munkabér kifizetés', defaultPrefix: '471' },
  { value: 'hiteltörlesztés', label: 'Hitel / Lízing törlesztés', defaultPrefix: '448' },
  { value: 'kamatjóváírás', label: 'Kamatbevétel / Jóváírás', defaultPrefix: '974' },
  { value: 'számlák közötti átvezetés', label: 'Pénztár / Bankközi átvezetés', defaultPrefix: '389' },
  { value: 'manual_expense', label: 'Készpénzes / Egyéb költség', defaultPrefix: '529' },
] as const;

interface RowState {
  type: string;
  glAccountId: string;
  glNumber: string;
}

interface TypelessTransactionsApprovalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactions: TypelessTransaction[];
  presetAccounts: PresetGlAccount[];
  activePresetId?: string | null;
  onApproveSingle: (payload: ApproveTransactionPayload) => Promise<void>;
  onApproveBatch: (payloads: ApproveTransactionPayload[]) => Promise<void>;
  isApproving: boolean;
  isApprovingBatch: boolean;
}

export function TypelessTransactionsApprovalModal({
  open,
  onOpenChange,
  transactions,
  presetAccounts,
  activePresetId,
  onApproveSingle,
  onApproveBatch,
  isApproving,
  isApprovingBatch,
}: TypelessTransactionsApprovalModalProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [userRowOverrides, setUserRowOverrides] = useState<Record<string, Partial<RowState>>>({});
  const [approvingRowId, setApprovingRowId] = useState<string | null>(null);
  const [openGlComboboxId, setOpenGlComboboxId] = useState<string | null>(null);

  // Helper to find best account for a prefix
  const findAccountByPrefix = useCallback((prefix: string): PresetGlAccount | undefined => {
    return (
      presetAccounts.find(a => a.gl_number === prefix || a.gl_number.startsWith(`${prefix}1`)) ||
      presetAccounts.find(a => a.gl_number.startsWith(prefix))
    );
  }, [presetAccounts]);

  // Purely derived row states for each transaction
  const rowStates = useMemo(() => {
    const states: Record<string, RowState> = {};
    for (const tx of transactions) {
      const override = userRowOverrides[tx.id];

      let detectedType = override?.type || '';
      let targetAccount: PresetGlAccount | undefined;

      if (override?.glAccountId) {
        targetAccount = presetAccounts.find(a => a.id === override.glAccountId);
      }

      if (!detectedType) {
        // Check if there was an AI suggestion in classifications
        const aiCls = activePresetId ? tx.gl_classifications?.[activePresetId] : undefined;
        if (aiCls?.gl_account_id) {
          const acc = presetAccounts.find(a => a.id === aiCls.gl_account_id);
          if (acc) {
            targetAccount = targetAccount || acc;
            if (acc.gl_number.startsWith('532')) detectedType = 'bankköltség';
            else if (acc.gl_number.startsWith('454')) detectedType = 'szállítói tranzakció';
            else if (acc.gl_number.startsWith('311')) detectedType = 'vevői tranzakció';
            else if (acc.gl_number.startsWith('463') || acc.gl_number.startsWith('464')) detectedType = 'járulékok/adók';
            else if (acc.gl_number.startsWith('471')) detectedType = 'bérek';
            else if (acc.gl_number.startsWith('448') || acc.gl_number.startsWith('444')) detectedType = 'hiteltörlesztés';
            else if (acc.gl_number.startsWith('974')) detectedType = 'kamatjóváírás';
            else if (acc.gl_number.startsWith('389')) detectedType = 'számlák közötti átvezetés';
          }
        }

        // Heuristic fallback based on description
        if (!detectedType) {
          const desc = (tx.description || '').toLowerCase();
          if (desc.includes('jutalék') || desc.includes('számlavezet') || desc.includes('kártyadíj') || desc.includes('bankköltség') || desc.includes('tranzakciós illeték')) {
            detectedType = 'bankköltség';
            targetAccount = targetAccount || findAccountByPrefix('532');
          } else if (desc.includes('nav') || desc.includes('adó') || desc.includes('járulék')) {
            detectedType = 'járulékok/adók';
            targetAccount = targetAccount || findAccountByPrefix('463');
          } else if (desc.includes('kamat')) {
            detectedType = 'kamatjóváírás';
            targetAccount = targetAccount || findAccountByPrefix('974');
          } else if (desc.includes('átvezetés') || desc.includes('technikai')) {
            detectedType = 'számlák közötti átvezetés';
            targetAccount = targetAccount || findAccountByPrefix('389');
          } else {
            detectedType = 'bankköltség';
            targetAccount = targetAccount || findAccountByPrefix('532');
          }
        }
      }

      states[tx.id] = {
        type: detectedType,
        glAccountId: targetAccount?.id || override?.glAccountId || '',
        glNumber: targetAccount?.gl_number || override?.glNumber || '',
      };
    }
    return states;
  }, [transactions, userRowOverrides, activePresetId, presetAccounts, findAccountByPrefix]);

  const handleTypeChange = (txId: string, newType: string) => {
    const opt = TRANSACTION_TYPE_OPTIONS.find(o => o.value === newType);
    let matchedAcc: PresetGlAccount | undefined;
    if (opt) {
      matchedAcc = findAccountByPrefix(opt.defaultPrefix);
    }

    setUserRowOverrides(prev => ({
      ...prev,
      [txId]: {
        type: newType,
        glAccountId: matchedAcc?.id || prev[txId]?.glAccountId || '',
        glNumber: matchedAcc?.gl_number || prev[txId]?.glNumber || '',
      },
    }));
  };

  const handleGlAccountSelect = (txId: string, account: PresetGlAccount) => {
    setUserRowOverrides(prev => ({
      ...prev,
      [txId]: {
        type: prev[txId]?.type || rowStates[txId]?.type || 'bankköltség',
        glAccountId: account.id,
        glNumber: account.gl_number,
      },
    }));
    setOpenGlComboboxId(null);
  };

  const handleApproveRow = async (txId: string) => {
    const state = rowStates[txId];
    if (!state || !state.type || !state.glAccountId || !state.glNumber) return;

    setApprovingRowId(txId);
    try {
      await onApproveSingle({
        transactionId: txId,
        type: state.type,
        glAccountId: state.glAccountId,
        glNumber: state.glNumber,
      });
    } finally {
      setApprovingRowId(null);
    }
  };

  const filteredTransactions = useMemo(() => {
    if (!searchFilter.trim()) return transactions;
    const q = searchFilter.toLowerCase().trim();
    return transactions.filter(tx =>
      (tx.description || '').toLowerCase().includes(q) ||
      (tx.amount || 0).toString().includes(q) ||
      tx.transaction_date.includes(q)
    );
  }, [transactions, searchFilter]);

  const readyToBatchApprove = useMemo(() => {
    return filteredTransactions
      .map(tx => {
        const s = rowStates[tx.id];
        if (s && s.type && s.glAccountId && s.glNumber) {
          return {
            transactionId: tx.id,
            type: s.type,
            glAccountId: s.glAccountId,
            glNumber: s.glNumber,
          };
        }
        return null;
      })
      .filter((p): p is ApproveTransactionPayload => p !== null);
  }, [filteredTransactions, rowStates]);

  const handleBatchApprove = async () => {
    if (readyToBatchApprove.length === 0) return;
    await onApproveBatch(readyToBatchApprove);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden border-border/80 shadow-2xl">
        <DialogHeader className="p-5 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  <span>Típus nélküli tranzakciók jóváhagyása</span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {transactions.length} db tétel
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Rendelj típust és főkönyvi számlát a tételekhez a hamis kontírozás elkerüléséhez és a főkönyvbe történő feloldáshoz.
                </DialogDescription>
              </div>
            </div>

            {readyToBatchApprove.length > 0 && (
              <Button
                size="sm"
                onClick={handleBatchApprove}
                disabled={isApprovingBatch || isApproving}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs h-8.5 cursor-pointer shrink-0"
              >
                {isApprovingBatch ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Összes jóváhagyása ({readyToBatchApprove.length})</span>
              </Button>
            )}
          </div>

          <div className="mt-3 relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Szűrés leírás, közlemény vagy összeg alapján..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="pl-8 h-8 text-xs bg-background"
            />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {transactions.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">
                Minden tranzakció fel van oldva!
              </h4>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Nincs több jóváhagyásra váró típus nélküli tétel a kiválasztott céghez. A főkönyvi kivonat tiszta és naprakész.
              </p>
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              A szűrési feltételnek nem felel meg egyetlen tétel sem.
            </div>
          ) : (
            filteredTransactions.map(tx => {
              const state = rowStates[tx.id] || { type: '', glAccountId: '', glNumber: '' };
              const isRowBusy = approvingRowId === tx.id || isApprovingBatch;
              const isReady = Boolean(state.type && state.glAccountId && state.glNumber);
              const selectedGl = presetAccounts.find(a => a.id === state.glAccountId);

              return (
                <div
                  key={tx.id}
                  className="rounded-xl border border-border/60 bg-card p-3 shadow-2xs hover:border-border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                >
                  {/* Left: Transaction details */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground text-[11px]">
                        {tx.transaction_date ? formatDateLocale(tx.transaction_date) : '-'}
                      </span>
                      <span
                        className={`font-mono font-bold text-xs ${
                          Number(tx.amount) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {formatCurrency(tx.amount, tx.currency || 'HUF')}
                      </span>
                      {tx.type && (
                        <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                          {tx.type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-[11px] line-clamp-2 leading-relaxed" title={tx.description || ''}>
                      {tx.description || '(Nincs banki közlemény)'}
                    </p>
                  </div>

                  {/* Middle: Type & GL selector controls */}
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 w-full md:w-auto">
                    {/* 1. Type selector */}
                    <div className="w-full sm:w-48">
                      <Select
                        value={state.type}
                        onValueChange={v => handleTypeChange(tx.id, v)}
                        disabled={isRowBusy}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Válassz típust..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 text-xs">
                          {TRANSACTION_TYPE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs">
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* 2. GL Account Combobox */}
                    <div className="w-full sm:w-60">
                      <Popover
                        open={openGlComboboxId === tx.id}
                        onOpenChange={o => setOpenGlComboboxId(o ? tx.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            disabled={isRowBusy}
                            className="h-8 w-full justify-between text-xs font-normal px-2.5 truncate"
                          >
                            <span className="truncate">
                              {selectedGl ? (
                                <span className="font-mono font-semibold">
                                  {selectedGl.gl_number} - {selectedGl.short_name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Főkönyvi szám...</span>
                              )}
                            </span>
                            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0 text-xs" align="start">
                          <Command>
                            <CommandInput placeholder="Keresés főkönyvi számra..." className="h-8 text-xs" />
                            <CommandList className="max-h-52">
                              <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
                                Nincs találat.
                              </CommandEmpty>
                              <CommandGroup>
                                {presetAccounts.map(acc => (
                                  <CommandItem
                                    key={acc.id}
                                    value={`${acc.gl_number} ${acc.short_name}`}
                                    onSelect={() => handleGlAccountSelect(tx.id, acc)}
                                    className="text-xs cursor-pointer"
                                  >
                                    <Check
                                      className={`mr-2 h-3.5 w-3.5 ${
                                        state.glAccountId === acc.id ? 'opacity-100' : 'opacity-0'
                                      }`}
                                    />
                                    <span className="font-mono font-semibold mr-1.5">{acc.gl_number}</span>
                                    <span className="truncate text-muted-foreground">{acc.short_name}</span>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* 3. Action button */}
                    <Button
                      size="sm"
                      onClick={() => handleApproveRow(tx.id)}
                      disabled={!isReady || isRowBusy}
                      className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shrink-0 cursor-pointer w-full sm:w-auto"
                    >
                      {approvingRowId === tx.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      <span>Jóváhagyás</span>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="p-3.5 border-t border-border/60 bg-muted/10 flex sm:justify-between items-center">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>A típus kiválasztásakor az intelligens rendszer automatikusan felajánlja a számlatükör megfelelő számát.</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8"
          >
            Bezárás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
