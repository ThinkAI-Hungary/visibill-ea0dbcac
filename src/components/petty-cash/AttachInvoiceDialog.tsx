import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Calendar,
  Building2,
  X,
  ArrowRightLeft,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { PettyCashEntry, fmtAmount, roundHuf } from './types';
import { formatDateLocale } from '@/lib/locale/formatters';
import { cn } from '@/lib/utils';
import { queryKeys } from '@/lib/queryKeys';

interface OpenInvoiceItem {
  id: string;
  bizonylatsorszam: string;
  invoice_direction: string;
  partner_name: string;
  elado_nev?: string;
  vevo_nev?: string;
  elado_vat_id?: string;
  vevo_vat_id?: string;
  brutto_vegosszeg: number;
  kibocsatas_datuma?: string;
  fizetesi_hatarido?: string;
  penznem?: string;
}

interface AttachInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: PettyCashEntry;
  onSuccess?: () => void;
}

export function AttachInvoiceDialog({
  open,
  onOpenChange,
  entry,
  onSuccess,
}: AttachInvoiceDialogProps) {
  const { t } = useTranslation(['pettyCash', 'common']);
  const qc = useQueryClient();

  const isExpense = entry.amount < 0;
  const absEntryAmount = Math.abs(entry.amount);

  // Direction filter tab
  const [filterDirection, setFilterDirection] = useState<'all' | 'INBOUND' | 'OUTBOUND'>(
    isExpense ? 'INBOUND' : 'OUTBOUND'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Fetch open unpaid invoices for this company (excluding invoices already attached to other cash entries)
  const { data: openInvoices = [], isLoading } = useQuery({
    queryKey: ['open-settlement-invoices', entry.company_id],
    queryFn: async () => {
      const [invRes, pceRes] = await Promise.all([
        (supabase as any)
          .from('invoices')
          .select(
            'id, bizonylatsorszam, invoice_direction, vevo_nev, elado_nev, vevo_vat_id, elado_vat_id, brutto_vegosszeg, kibocsatas_datuma, fizetesi_hatarido, penznem'
          )
          .eq('company_id', entry.company_id)
          .eq('fizetve', false)
          .is('transaction_id', null)
          .not('exclude_from_accounting', 'is', true)
          .order('fizetesi_hatarido', { ascending: true }),
        (supabase as any)
          .from('petty_cash_entries')
          .select('source_id')
          .eq('company_id', entry.company_id)
          .eq('source_table', 'invoices')
          .not('source_id', 'is', null)
          .neq('id', entry.id)
          .neq('status', 'cancelled'),
      ]);

      if (invRes.error) throw invRes.error;

      const attachedInvoiceIds = new Set(
        (pceRes.data || []).map((p: any) => p.source_id).filter(Boolean)
      );

      return (invRes.data || [])
        .filter((inv: any) => !attachedInvoiceIds.has(inv.id))
        .map((inv: any) => ({
          ...inv,
          partner_name:
            inv.invoice_direction?.toUpperCase() === 'INBOUND'
              ? inv.elado_nev || 'Ismeretlen szállító'
              : inv.vevo_nev || 'Ismeretlen vevő',
        })) as OpenInvoiceItem[];
    },
    enabled: !!entry.company_id && open,
  });

  // Intelligent auto-detection of invoice from description or exact amount
  const autoMatchId = useMemo(() => {
    if (!openInvoices.length) return null;

    // 1. Match by description containing the invoice number
    if (entry.description) {
      const descUpper = entry.description.toUpperCase().trim();
      const byNum = openInvoices.find(
        (inv) =>
          inv.bizonylatsorszam &&
          descUpper.includes(inv.bizonylatsorszam.toUpperCase().trim())
      );
      if (byNum) return byNum.id;
    }

    // 2. Fallback: match by exact amount in matching direction
    const matchingDirection = isExpense ? 'INBOUND' : 'OUTBOUND';
    const byAmount = openInvoices.filter(
      (inv) =>
        inv.invoice_direction?.toUpperCase() === matchingDirection &&
        Math.abs(Number(inv.brutto_vegosszeg) || 0) === absEntryAmount
    );
    if (byAmount.length === 1) return byAmount[0].id;

    return null;
  }, [openInvoices, entry.description, absEntryAmount, isExpense]);

  // When dialog opens, initialize selection with auto-match if found
  useEffect(() => {
    if (open) {
      setFilterDirection(isExpense ? 'INBOUND' : 'OUTBOUND');
      setSearchQuery('');
      setSelectedInvoiceId(autoMatchId || null);
    }
  }, [open, autoMatchId, isExpense]);

  // Filtered & sorted invoice list
  const filteredInvoices = useMemo(() => {
    let list = openInvoices;

    if (filterDirection !== 'all') {
      list = list.filter(
        (inv) => inv.invoice_direction?.toUpperCase() === filterDirection
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (inv) =>
          (inv.bizonylatsorszam && inv.bizonylatsorszam.toLowerCase().includes(q)) ||
          (inv.partner_name && inv.partner_name.toLowerCase().includes(q)) ||
          (inv.brutto_vegosszeg && String(inv.brutto_vegosszeg).includes(q))
      );
    }

    // Prioritize auto-matched invoice at the top
    return [...list].sort((a, b) => {
      if (a.id === autoMatchId) return -1;
      if (b.id === autoMatchId) return 1;
      return 0;
    });
  }, [openInvoices, filterDirection, searchQuery, autoMatchId]);

  const selectedInvoice = useMemo(
    () => openInvoices.find((inv) => inv.id === selectedInvoiceId),
    [openInvoices, selectedInvoiceId]
  );

  const inboundCount = useMemo(
    () => openInvoices.filter((i) => i.invoice_direction?.toUpperCase() === 'INBOUND').length,
    [openInvoices]
  );
  const outboundCount = useMemo(
    () => openInvoices.filter((i) => i.invoice_direction?.toUpperCase() === 'OUTBOUND').length,
    [openInvoices]
  );

  // Mutation to attach invoice
  const attachMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoiceId || !selectedInvoice) {
        throw new Error('Nincs számla kiválasztva!');
      }

      // Try RPC first
      const { error: rpcError } = await (supabase.rpc as any)(
        'link_petty_cash_entry_to_invoice',
        {
          p_company_id: entry.company_id,
          p_entry_id: entry.id,
          p_invoice_id: selectedInvoiceId,
        }
      );

      if (rpcError) {
        console.warn('RPC link_petty_cash_entry_to_invoice failed or not present, applying atomic client update:', rpcError);

        // Client-side fallback:
        // 1. Update petty cash entry
        const { error: entryErr } = await (supabase as any)
          .from('petty_cash_entries')
          .update({
            source_table: 'invoices',
            source_id: selectedInvoiceId,
            source_type: 'invoice_settlement',
          })
          .eq('id', entry.id)
          .eq('company_id', entry.company_id);

        if (entryErr) throw entryErr;

        // 2. Update invoice status
        const { error: invErr } = await (supabase as any)
          .from('invoices')
          .update({
            fizetve: true,
            is_manual_payment: true,
            manual_payment_date: entry.entry_date,
            manual_payment_type: 'cash',
            manual_payment_note: 'Házipénztár bizonylathoz kapcsolva',
          })
          .eq('id', selectedInvoiceId)
          .eq('company_id', entry.company_id);

        if (invErr) throw invErr;
      }

      return selectedInvoice;
    },
    onSuccess: (inv) => {
      // Invalidate relevant React Query caches
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashEntries(entry.company_id) });
      qc.invalidateQueries({ queryKey: queryKeys.pettyCashSummary(entry.company_id) });
      qc.invalidateQueries({ queryKey: ['petty-cash-entry-source', 'invoices', inv.id] });
      qc.invalidateQueries({ queryKey: ['petty-cash-entry-source'] });
      qc.invalidateQueries({ queryKey: ['open-settlement-invoices', entry.company_id] });
      qc.invalidateQueries({ queryKey: ['invoices'] });

      toast({
        title: t('pettyCash:toasts.attach_success_title', 'Számla sikeresen hozzárendelve!'),
        description: t(
          'pettyCash:toasts.attach_success_desc',
          'A {{invoice}} számla össze lett kapcsolva ezzel a pénztári tétellel.',
          { invoice: inv.bizonylatsorszam }
        ),
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (err: any) => {
      toast({
        title: t('common:error', 'Hiba'),
        description: err.message || 'Nem sikerült a számla hozzárendelése.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 gap-4">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {t('pettyCash:details.attach_dialog_title', 'Számla hozzárendelése pénztári tételhez')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t(
              'pettyCash:details.attach_dialog_desc',
              'Válaszd ki azt a nyitott számlát, amelyhez ezt a készpénzes tételt hozzá szeretnéd rendelni.'
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Selected Petty Cash Entry Summary Card */}
        <div className="p-3.5 bg-muted/40 rounded-lg border border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">
                {entry.description || t('pettyCash:details.manual_standalone')}
              </span>
              <Badge
                variant={isExpense ? 'destructive' : 'default'}
                className="text-[10px] px-1.5 py-0 h-4 font-mono"
              >
                {isExpense ? 'Kiadás' : 'Bevétel'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {entry.entry_date}
              </span>
              <span>•</span>
              <span className="font-mono font-medium text-foreground">
                {entry.line_no ? `#${entry.line_no}` : ''}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
              Pénztári összeg
            </span>
            <span
              className={cn(
                'font-mono font-bold text-sm',
                isExpense ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
              )}
            >
              {fmtAmount(entry.amount, entry.currency)}
            </span>
          </div>
        </div>

        {/* Filter controls & Search */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            {/* Direction tabs */}
            <div className="inline-flex items-center rounded-lg bg-muted/50 p-1 border border-border/40 text-xs">
              <button
                type="button"
                onClick={() => setFilterDirection('all')}
                className={cn(
                  'px-2.5 py-1 rounded-md transition-all font-medium',
                  filterDirection === 'all'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Összes ({openInvoices.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterDirection('INBOUND')}
                className={cn(
                  'px-2.5 py-1 rounded-md transition-all font-medium',
                  filterDirection === 'INBOUND'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Szállítók ({inboundCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterDirection('OUTBOUND')}
                className={cn(
                  'px-2.5 py-1 rounded-md transition-all font-medium',
                  filterDirection === 'OUTBOUND'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Vevők ({outboundCount})
              </button>
            </div>

            {/* Quick search input */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Keresés sorszám, partner..."
                className="h-8 pl-8 pr-7 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Invoice Selection List */}
        <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[340px] pr-1 space-y-2 border border-border/50 rounded-lg p-2 bg-muted/10">
          {isLoading ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>Számlák betöltése...</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground text-center px-4">
              <AlertCircle className="w-6 h-6 text-muted-foreground/60" />
              <p className="font-medium">Nincs a szűrésnek megfelelő nyitott számla.</p>
              <p className="text-[11px] text-muted-foreground/80">
                {searchQuery
                  ? 'Próbáld törölni a keresőkifejezést.'
                  : 'Minden számla ki van fizetve ennél a cégnél, vagy már hozzá van rendelve tranzakcióhoz.'}
              </p>
            </div>
          ) : (
            filteredInvoices.map((inv) => {
              const isSelected = selectedInvoiceId === inv.id;
              const isAutoMatch = autoMatchId === inv.id;
              const invAmount = Number(inv.brutto_vegosszeg) || 0;
              const isExactAmount = Math.abs(invAmount) === absEntryAmount;

              return (
                <div
                  key={inv.id}
                  onClick={() => setSelectedInvoiceId(inv.id)}
                  className={cn(
                    'p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between gap-3',
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-500 shadow-sm ring-1 ring-blue-500/20'
                      : 'bg-card border-border/50 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Radio indicator */}
                    <div
                      className={cn(
                        'w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-all',
                        isSelected
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-muted-foreground/40'
                      )}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-foreground">
                          {inv.bizonylatsorszam}
                        </span>
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                          {inv.invoice_direction?.toUpperCase() === 'INBOUND' ? 'Szállító' : 'Vevő'}
                        </Badge>
                        {isAutoMatch && (
                          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] px-1.5 py-0 h-4 gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            {entry.description?.toUpperCase().includes(inv.bizonylatsorszam.toUpperCase())
                              ? 'Leírás alapján felismerve'
                              : 'Összeg alapján ajánlott'}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-muted-foreground text-[11px] truncate">
                        <span className="flex items-center gap-1 truncate">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span className="truncate">{inv.partner_name}</span>
                        </span>
                        {inv.kibocsatas_datuma && (
                          <span className="shrink-0">
                            Kelt: {formatDateLocale(inv.kibocsatas_datuma, 'yyyy. MM. dd.')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-foreground block">
                      {fmtAmount(invAmount, inv.penznem || 'HUF')}
                    </span>
                    {!isExactAmount ? (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">
                        Különbözet: {fmtAmount(absEntryAmount - invAmount, inv.penznem || 'HUF')}
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Egyező összeg
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Selected info banner & Action buttons */}
        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/40">
          <div className="text-xs text-muted-foreground w-full sm:w-auto truncate">
            {selectedInvoice ? (
              <span className="flex items-center gap-1.5 text-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Kiválasztva: <strong>{selectedInvoice.bizonylatsorszam}</strong> ({selectedInvoice.partner_name})
                </span>
              </span>
            ) : (
              <span>Válassz egy számlát a listából.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={attachMutation.isPending}
            >
              Mégse
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => attachMutation.mutate()}
              disabled={!selectedInvoiceId || attachMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
            >
              {attachMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Hozzárendelés...</span>
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Számla hozzárendelése</span>
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
