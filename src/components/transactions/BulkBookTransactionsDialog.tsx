import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ClipboardCheck, ChevronsUpDown, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useQueryClient } from '@tanstack/react-query';
import { formatCurrency, cn } from '@/lib/utils';
import type { Transaction } from '@/hooks/useTransactionData';

interface GlAccountItem {
  id: string;
  gl_number: string;
  short_name: string;
  description?: string;
}

interface BulkBookTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTransactions: Transaction[];
  glAccounts: GlAccountItem[];
  presetId?: string | null;
  onSuccess?: () => void;
}

export function BulkBookTransactionsDialog({
  open,
  onOpenChange,
  selectedTransactions,
  glAccounts,
  presetId,
  onSuccess,
}: BulkBookTransactionsDialogProps) {
  const { session } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedGlId, setSelectedGlId] = useState('');
  const [glSearchQuery, setGlSearchQuery] = useState('');
  const [glComboOpen, setGlComboOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const cleanGlNum = (num: any) => (num ? String(num).replace(/\./g, '') : '');

  // Filter leaf GL accounts
  const leafGlAccounts = useMemo(() => {
    return glAccounts
      .filter(gl => {
        const queryMatch =
          !glSearchQuery ||
          `${gl.gl_number} ${gl.short_name}`.toLowerCase().includes(glSearchQuery.toLowerCase());
        if (!queryMatch) return false;
        const isLeaf = !glAccounts.some(
          sub => cleanGlNum(sub.gl_number).startsWith(cleanGlNum(gl.gl_number)) && sub.id !== gl.id
        );
        return isLeaf;
      })
      .sort((a, b) => cleanGlNum(a.gl_number).localeCompare(cleanGlNum(b.gl_number)));
  }, [glAccounts, glSearchQuery]);

  const selectedGlItem = useMemo(
    () => glAccounts.find(g => g.id === selectedGlId),
    [glAccounts, selectedGlId]
  );

  // Calculate totals
  const totalAmount = useMemo(() => {
    return selectedTransactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }, [selectedTransactions]);

  const handleBook = async () => {
    if (!selectedGlId || !selectedGlItem || !session?.user?.id || !presetId || !selectedCompany?.id) {
      toast({
        title: 'Hiányzó adatok',
        description: 'Kérjük, válasszon ki egy érvényes főkönyvi számot a könyveléshez.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      // Step 1: Batch JSONB override in RPC
      const rpcItems = selectedTransactions.map(tx => ({
        item_id: tx.id,
        source_table: 'transactions',
        original_gl_account_id: tx.gl_account_id || null,
      }));

      const { error: rpcError } = await supabase.rpc('override_gl_classifications_batch', {
        p_items: rpcItems,
        p_new_gl_account_id: selectedGlId,
        p_company_id: selectedCompany.id,
        p_user_id: session.user.id,
        p_preset_id: presetId,
        p_new_gl_number: selectedGlItem.gl_number,
      });
      if (rpcError) throw rpcError;

      // Step 2: Base transaction fields update
      const txIds = selectedTransactions.map(t => t.id);
      const { error: txError } = await supabase
        .from('transactions')
        .update({
          gl_account_id: selectedGlId,
          gl_is_manually_overridden: true,
          is_verified: true,
          matched_invoice_id: null,
          match_type: null,
        })
        .in('id', txIds);
      if (txError) throw txError;

      // Step 3: Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });

      toast({
        title: 'Sikeres tömeges kontírozás!',
        description: `${selectedTransactions.length} db tranzakció lekönyvelve a(z) ${selectedGlItem.gl_number} ${selectedGlItem.short_name} számlára.`,
        className: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      console.error('Error in bulk booking:', err);
      toast({
        title: 'Hiba a tömeges kontírozáskor',
        description: err.message || 'Nem sikerült lekönyvelni a kijelölt tranzakciókat.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-[680px] w-[95vw] p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground text-lg">
            <ClipboardCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            Tranzakciók tömeges kontírozása
          </DialogTitle>
          <DialogDescription className="text-xs">
            Közvetlen főkönyvi hozzárendelés {selectedTransactions.length} db kijelölt banki tételhez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 min-w-0 w-full">
          {/* Summary Box */}
          <div className="p-4 rounded-lg border bg-muted/40 space-y-3 min-w-0 w-full">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Kijelölt tranzakciók száma:</span>
              <span className="font-bold text-foreground text-sm">{selectedTransactions.length} db</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Összesített összeg:</span>
              <span className={cn("font-bold font-mono text-sm", totalAmount < 0 ? "text-destructive" : "text-emerald-600")}>
                {formatCurrency(totalAmount)}
              </span>
            </div>

            {/* List of selected items */}
            <div className="pt-2 border-t border-border/40 max-h-40 overflow-y-auto space-y-2 pr-1 min-w-0 w-full">
              {selectedTransactions.slice(0, 6).map(tx => (
                <div key={tx.id} className="p-2.5 rounded-md bg-background/70 border border-border/30 flex items-center justify-between gap-3 min-w-0 w-full">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate" title={tx.description || ''}>
                      {tx.description || 'Névtelen tranzakció'}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {tx.transaction_date || ''} • {tx.type || 'Tranzakció'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn("font-mono font-bold text-xs whitespace-nowrap", tx.amount < 0 ? "text-destructive" : "text-emerald-600")}>
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                </div>
              ))}
              {selectedTransactions.length > 6 && (
                <p className="text-[10px] text-muted-foreground/80 italic text-center pt-1">
                  ...és további {selectedTransactions.length - 6} db tétel
                </p>
              )}
            </div>
          </div>

          {/* GL Account Selector */}
          <div className="space-y-2 min-w-0 w-full">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cél főkönyvi szám kiválasztása *
            </label>

            <Popover open={glComboOpen} onOpenChange={setGlComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={glComboOpen}
                  className="justify-between w-full font-medium h-10 px-3 min-w-0"
                >
                  <span className="truncate min-w-0 flex-1 text-left">
                    {selectedGlItem
                      ? `${selectedGlItem.gl_number} ${selectedGlItem.short_name}`
                      : 'Válassz főkönyvi számot a listából...'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-0 z-[1200]" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Keresés számlaszám vagy név alapján..."
                    value={glSearchQuery}
                    onValueChange={setGlSearchQuery}
                  />
                  <CommandList className="max-h-60">
                    <CommandEmpty>Nincs találat a számlatükörben.</CommandEmpty>
                    <CommandGroup>
                      {leafGlAccounts.map(gl => (
                        <CommandItem
                          key={gl.id}
                          value={`${gl.gl_number} ${gl.short_name}`}
                          onSelect={() => {
                            setSelectedGlId(gl.id);
                            setGlComboOpen(false);
                          }}
                          className="cursor-pointer"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 text-emerald-600 shrink-0",
                              selectedGlId === gl.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="font-mono font-bold mr-2 text-emerald-700 dark:text-emerald-400 shrink-0">
                            {gl.gl_number}
                          </span>
                          <span className="truncate min-w-0 flex-1">{gl.short_name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Mégse
          </Button>
          <Button
            onClick={handleBook}
            disabled={!selectedGlId || saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
            Kontírozás jóváhagyása
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
