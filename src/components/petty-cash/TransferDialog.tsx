import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowRightLeft, ArrowRight, Loader2, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { PettyCashRegister, SummaryRow } from './types';
import { fmtBalance, roundHuf } from './types';
import { getLocalizedRegisterName } from '@/lib/pettyCashUtils';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registers: PettyCashRegister[];
  companyId: string;
  summary?: SummaryRow[];
}

export default function TransferDialog({
  open,
  onOpenChange,
  registers,
  companyId,
  summary = [],
}: TransferDialogProps) {
  const { t } = useTranslation(['pettyCash', 'common']);
  const qc = useQueryClient();

  const defaultReg = registers.find(r => r.is_default) || registers[0];
  const nonDefaultReg = registers.find(r => !r.is_default) || registers[1] || registers[0];

  // Default source: non-default register (e.g. Üzlettéri), Default target: default register (e.g. Központi)
  const [fromRegisterId, setFromRegisterId] = useState<string>('');
  const [toRegisterId, setToRegisterId] = useState<string>('');
  const [entryDate, setEntryDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<string>('HUF');
  const [description, setDescription] = useState<string>('');

  useEffect(() => {
    if (open && registers.length >= 2) {
      const initialFrom = nonDefaultReg?.id || registers[0]?.id || '';
      const initialTo = defaultReg?.id !== initialFrom ? defaultReg?.id : registers.find(r => r.id !== initialFrom)?.id || '';
      setFromRegisterId(initialFrom);
      setToRegisterId(initialTo);
      setEntryDate(format(new Date(), 'yyyy-MM-dd'));
      setAmount('');
      setCurrency('HUF');
      setDescription('');
    }
  }, [open, registers, defaultReg, nonDefaultReg]);

  const fromRegister = registers.find(r => r.id === fromRegisterId);
  const toRegister = registers.find(r => r.id === toRegisterId);

  // Available currencies from source register
  const availableCurrencies = fromRegister?.currencies || ['HUF'];

  // Current balance of source register
  const fromBalance = useMemo(() => {
    if (!summary.length || !fromRegisterId) return null;
    const row = summary.find(s => s.register_id === fromRegisterId && s.currency === currency);
    return row ? row.current_balance : 0;
  }, [summary, fromRegisterId, currency]);

  // Current balance of target register
  const toBalance = useMemo(() => {
    if (!summary.length || !toRegisterId) return null;
    const row = summary.find(s => s.register_id === toRegisterId && s.currency === currency);
    return row ? row.current_balance : 0;
  }, [summary, toRegisterId, currency]);

  const parsedAmount = parseFloat(amount) || 0;
  const isAmountValid = parsedAmount > 0;
  const isOverBalance = fromBalance !== null && parsedAmount > fromBalance;
  const isLargeAmount = currency === 'HUF' ? parsedAmount > 1_500_000 : parsedAmount > 5_000;

  const handleSwap = () => {
    const prevFrom = fromRegisterId;
    setFromRegisterId(toRegisterId);
    setToRegisterId(prevFrom);
  };

  const transferMutation = useMutation({
    mutationFn: async () => {
      const roundedAmount = roundHuf(parsedAmount, currency);
      const customDesc = description.trim() ? description.trim() : null;

      const { data, error } = await supabase.rpc('create_petty_cash_transfer', {
        p_company_id: companyId,
        p_from_register_id: fromRegisterId,
        p_to_register_id: toRegisterId,
        p_entry_date: entryDate,
        p_amount: roundedAmount,
        p_currency: currency,
        p_description: customDesc,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashEntries(companyId) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(companyId) });
      onOpenChange(false);
      toast({
        title: t('pettyCash:transfer_dialog.success_title', 'Pénztárközi átvezetés rögzítve'),
        description: t('pettyCash:transfer_dialog.success_desc', {
          amount: fmtBalance(parsedAmount, currency),
          from: fromRegister?.name,
          to: toRegister?.name,
          defaultValue: `${fmtBalance(parsedAmount, currency)} sikeresen átvezetve (${fromRegister?.name} ➔ ${toRegister?.name})`,
        }),
      });
    },
    onError: (err: any) => {
      toast({
        title: t('pettyCash:transfer_dialog.error_title', 'Hiba az átvezetés során'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle>{t('pettyCash:transfer_dialog.title', 'Pénztárközi átvezetés')}</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                {t('pettyCash:transfer_dialog.description', 'Készpénz átvezetése két házipénztár között egyidejű kiadás és bevétel könyveléssel.')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Register Selector Flow */}
          <div className="p-3 rounded-lg border border-border/60 bg-muted/20 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] items-center gap-2">
              {/* Source Register */}
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-semibold text-muted-foreground">
                  {t('pettyCash:transfer_dialog.from_label', 'Forrás (Kiadás)')}
                </Label>
                <Select
                  value={fromRegisterId}
                  onValueChange={(val) => {
                    setFromRegisterId(val);
                    if (val === toRegisterId) {
                      const nextTo = registers.find(r => r.id !== val)?.id || '';
                      setToRegisterId(nextTo);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Válassz pénztárat" />
                  </SelectTrigger>
                  <SelectContent>
                    {registers.map(r => (
                      <SelectItem key={r.id} value={r.id} disabled={r.id === toRegisterId}>
                        {getLocalizedRegisterName(r.name, t)} {r.is_default && `(${t('pettyCash:default_badge', 'Alapértelmezett')})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fromBalance !== null && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    Egyenleg: <strong className="font-mono text-foreground">{fmtBalance(fromBalance, currency)}</strong>
                  </p>
                )}
              </div>

              {/* Swap Button */}
              <div className="flex justify-center sm:pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={handleSwap}
                  title="Pénztárak megcserélése"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Target Register */}
              <div className="space-y-1.5 min-w-0">
                <Label className="text-xs font-semibold text-muted-foreground">
                  {t('pettyCash:transfer_dialog.to_label', 'Cél (Bevétel)')}
                </Label>
                <Select
                  value={toRegisterId}
                  onValueChange={(val) => {
                    setToRegisterId(val);
                    if (val === fromRegisterId) {
                      const nextFrom = registers.find(r => r.id !== val)?.id || '';
                      setFromRegisterId(nextFrom);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Válassz pénztárat" />
                  </SelectTrigger>
                  <SelectContent>
                    {registers.map(r => (
                      <SelectItem key={r.id} value={r.id} disabled={r.id === fromRegisterId}>
                        {getLocalizedRegisterName(r.name, t)} {r.is_default && `(${t('pettyCash:default_badge', 'Alapértelmezett')})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {toBalance !== null && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    Egyenleg: <strong className="font-mono text-foreground">{fmtBalance(toBalance, currency)}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Date and Currency */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="transfer-date" className="text-xs font-medium">
                {t('pettyCash:transfer_dialog.date_label', 'Átvezetés dátuma')}
              </Label>
              <Input
                id="transfer-date"
                type="date"
                className="h-9 text-xs"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-currency" className="text-xs font-medium">
                {t('pettyCash:transfer_dialog.currency_label', 'Pénznem')}
              </Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="transfer-currency" className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="transfer-amount" className="text-xs font-medium">
              {t('pettyCash:transfer_dialog.amount_label', 'Átvezetendő összeg')}
            </Label>
            <div className="relative">
              <Input
                id="transfer-amount"
                type="number"
                min="0"
                step="any"
                className={cn(
                  'h-9 font-mono text-sm pr-14',
                  isOverBalance && 'border-amber-500 focus-visible:ring-amber-500'
                )}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <div className="absolute right-3 top-2 text-xs font-medium text-muted-foreground pointer-events-none">
                {currency}
              </div>
            </div>

            {/* Overdraft Warning */}
            {isOverBalance && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Az összeg meghaladja a forrás pénztár jelenlegi egyenlegét!</span>
              </div>
            )}

            {/* Large Amount Warning */}
            {isLargeAmount && !isOverBalance && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span>Nagy összegű készpénzmozgás — kérjük, ellenőrizd a bizonylatot.</span>
              </div>
            )}
          </div>

          {/* Optional Description */}
          <div className="space-y-1.5">
            <Label htmlFor="transfer-desc" className="text-xs font-medium">
              {t('pettyCash:transfer_dialog.desc_label', 'Megjegyzés / Bizonylat szám (opcionális)')}
            </Label>
            <Input
              id="transfer-desc"
              className="h-9 text-xs"
              placeholder={`Pénztárközi átvezetés: ${fromRegister?.name || ''} ➔ ${toRegister?.name || ''}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex sm:justify-between items-center gap-2 pt-2 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={transferMutation.isPending}
          >
            {t('common:cancel', 'Mégse')}
          </Button>

          <Button
            type="button"
            size="sm"
            className="bg-sky-600 hover:bg-sky-500 text-white gap-1.5"
            onClick={() => transferMutation.mutate()}
            disabled={!isAmountValid || fromRegisterId === toRegisterId || transferMutation.isPending}
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('common:saving', 'Mentés...')}
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                {t('pettyCash:transfer_dialog.submit_btn', 'Átvezetés rögzítése')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
