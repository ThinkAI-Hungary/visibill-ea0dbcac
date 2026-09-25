import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FileDown, BookOpen, TrendingUp, TrendingDown, Wallet, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDateRange } from '@/contexts/DateRangeContext';
import { getActiveLocale } from '@/lib/locale/formatters';
import { useCompanyAccountingRule } from '@/hooks/useAccountingPolicy';
import type { PettyCashEntry, PettyCashRegister } from './types';
import { fmtBalance, fmtAmount, SOURCE_LABELS, roundHuf } from './types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CASH CLOSING DIALOG (F4)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface CashClosingDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entries: PettyCashEntry[];
  registers: PettyCashRegister[];
  registerMap: Record<string, PettyCashRegister>;
  companyId?: string;
}

export default function CashClosingDialog({
  open, onOpenChange, entries, registers, registerMap, companyId,
}: CashClosingDialogProps) {
  const { t } = useTranslation(['pettyCash', 'common']);
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const [selectedRegister, setSelectedRegister] = useState<string>('all');

  // Accounting policy rule for petty cash daily balance ceiling
  const { value: dailyMaxBalanceRule } = useCompanyAccountingRule(
    companyId,
    'petty_cash_daily_max_balance',
    { amount: 1500000 }
  );
  const dailyMaxLimit = Number(dailyMaxBalanceRule?.amount) || 1500000;

  // Filter entries for the selected register in the active period
  const filteredEntries = useMemo(() => {
    let result = entries;
    if (selectedRegister !== 'all') {
      result = result.filter(e => e.register_id === selectedRegister);
    }
    // Sort chronologically
    return [...result].sort((a, b) =>
      a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)
    );
  }, [entries, selectedRegister]);

  // Query configured opening balances for the company's registers
  const { data: openingBalances = [] } = useQuery({
    queryKey: ['cash-closing-opening-balances', companyId],
    queryFn: async () => {
      if (!companyId || registers.length === 0) return [];
      const { data, error } = await supabase
        .from('petty_cash_opening_balances')
        .select('*')
        .in('register_id', registers.map(r => r.id));
      if (error) {
        console.error('Error fetching opening balances for cash closing:', error);
        return [];
      }
      return data || [];
    },
    enabled: open && !!companyId && registers.length > 0,
  });

  // Query prior entries (before dateFromFormatted) to calculate opening balance at period start
  const { data: priorEntries = [] } = useQuery({
    queryKey: ['cash-closing-prior-entries', companyId, dateFromFormatted],
    queryFn: async () => {
      if (!companyId || !dateFromFormatted) return [];
      const { data, error } = await supabase
        .from('petty_cash_entries')
        .select('register_id, currency, amount, entry_date')
        .eq('company_id', companyId)
        .lt('entry_date', dateFromFormatted);
      if (error) {
        console.error('Error fetching prior entries for cash closing:', error);
        return [];
      }
      return data || [];
    },
    enabled: open && !!companyId && !!dateFromFormatted,
  });

  // Group by currency with full accounting calculation:
  // Opening Balance + Period Income - Period Expense = Period Net Turnover
  // Closing Balance = Opening Balance + Period Net Turnover
  const currencySummary = useMemo(() => {
    const targetRegIds = selectedRegister === 'all'
      ? new Set(registers.map(r => r.id))
      : new Set([selectedRegister]);

    const currencies = new Set<string>();
    filteredEntries.forEach(e => currencies.add(e.currency));
    openingBalances
      .filter(ob => targetRegIds.has(ob.register_id))
      .forEach(ob => currencies.add(ob.currency));
    priorEntries
      .filter(pe => targetRegIds.has(pe.register_id))
      .forEach(pe => currencies.add(pe.currency));

    if (currencies.size === 0 && registers.length > 0) {
      registers.forEach(r => r.currencies.forEach(c => currencies.add(c)));
    }
    if (currencies.size === 0) {
      currencies.add('HUF');
    }

    const m: Record<string, {
      opening: number;
      income: number;
      expense: number;
      net: number;
      closing: number;
      count: number;
    }> = {};

    currencies.forEach(cur => {
      // 1. Configured initial opening balance
      const relevantOpenings = openingBalances.filter(ob =>
        targetRegIds.has(ob.register_id) && ob.currency === cur
      );
      const configuredOpening = relevantOpenings.reduce((sum, ob) => sum + (Number(ob.amount) || 0), 0);

      // 2. Entries occurring before the start date (dateFromFormatted)
      const relevantPrior = priorEntries.filter(pe =>
        targetRegIds.has(pe.register_id) && pe.currency === cur
      );
      const priorSum = relevantPrior.reduce((sum, pe) => sum + (Number(pe.amount) || 0), 0);

      const opening = roundHuf(configuredOpening + priorSum, cur);

      // 3. Current period entries
      const periodForCur = filteredEntries.filter(e => e.currency === cur);
      let income = 0;
      let expense = 0;
      periodForCur.forEach(e => {
        if (e.amount >= 0) income += e.amount;
        else expense += e.amount;
      });

      const net = roundHuf(income + expense, cur);
      const closing = roundHuf(opening + net, cur);

      m[cur] = {
        opening,
        income: roundHuf(income, cur),
        expense: roundHuf(expense, cur),
        net,
        closing,
        count: periodForCur.length,
      };
    });

    return Object.entries(m).sort(([a], [b]) => a === 'HUF' ? -1 : b === 'HUF' ? 1 : a.localeCompare(b));
  }, [registers, selectedRegister, openingBalances, priorEntries, filteredEntries]);

  const registerName = selectedRegister === 'all'
    ? t('pettyCash:closing_dialog.all_registers')
    : (registerMap[selectedRegister]?.name || '?');

  // F4: PDF export — generate a printable cash book
  const handleExportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const numLocale = getActiveLocale() === 'hr' ? 'hr-HR' : 'hu-HU';

    const rows = filteredEntries.map((e, idx) => {
      const regName = registerMap[e.register_id]?.name || '';
      const dateStr = e.entry_date ? format(new Date(e.entry_date), 'yyyy.MM.dd.') : '';
      const receiptType = e.amount >= 0 ? 'B' : 'K';
      const receiptNo = `${receiptType}-${String(idx + 1).padStart(3, '0')}`;
      const income = e.amount >= 0 ? roundHuf(e.amount, e.currency).toLocaleString(numLocale) : '';
      const expense = e.amount < 0 ? roundHuf(Math.abs(e.amount), e.currency).toLocaleString(numLocale) : '';

      return `<tr>
        <td class="mono">${receiptNo}</td>
        <td>${dateStr}</td>
        <td>${regName}</td>
        <td>${SOURCE_LABELS[e.source_type] || e.source_type}</td>
        <td>${e.description || '—'}</td>
        <td class="right green">${income}</td>
        <td class="right red">${expense}</td>
        <td class="right">${e.currency}</td>
      </tr>`;
    }).join('');

    const summaryRows = currencySummary.map(([cur, s]) => {
      return `<tr>
        <td><strong>${cur}</strong></td>
        <td class="right font-semibold">${roundHuf(s.opening, cur).toLocaleString(numLocale)}</td>
        <td class="right">${t('pettyCash:closing_dialog.items_count', { count: s.count })}</td>
        <td class="right green">${roundHuf(s.income, cur).toLocaleString(numLocale)}</td>
        <td class="right red">${roundHuf(Math.abs(s.expense), cur).toLocaleString(numLocale)}</td>
        <td class="right" style="font-weight:600">${s.net >= 0 ? '+' : ''}${roundHuf(s.net, cur).toLocaleString(numLocale)}</td>
        <td class="right" style="font-weight:700">${roundHuf(s.closing, cur).toLocaleString(numLocale)}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${t('pettyCash:closing_dialog.pdf.page_title', { register: registerName })}</title>
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; margin: 20px; color: #1a1a1a; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { color: #666; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #f5f5f5; padding: 6px 8px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ddd; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
  .right { text-align: right; }
  .green { color: #16a34a; }
  .red { color: #dc2626; }
  .mono { font-family: 'Courier New', monospace; font-size: 10px; }
  .summary { margin-top: 16px; border: 1px solid #ddd; border-radius: 4px; padding: 12px; background: #fafafa; }
  .summary h2 { font-size: 13px; margin: 0 0 8px 0; }
  @media print { body { margin: 10mm; } }
</style></head><body>
  <h1>📋 ${t('pettyCash:closing_dialog.pdf.page_title', { register: registerName })}</h1>
  <div class="meta">${t('pettyCash:closing_dialog.pdf.period', { from: dateFromFormatted, to: dateToFormatted })} | ${t('pettyCash:closing_dialog.pdf.generated_at', { date: format(new Date(), 'yyyy.MM.dd. HH:mm') })}</div>

  <div class="summary" style="margin-top: 0; margin-bottom: 16px;">
    <h2>${t('pettyCash:closing_dialog.pdf.summary.title', 'Időszaki összesítés')}</h2>
    <table>
      <thead><tr>
        <th>${t('pettyCash:closing_dialog.pdf.summary.currency', 'Pénznem')}</th>
        <th class="right">${t('pettyCash:closing_dialog.pdf.summary.opening', 'Nyitó egyenleg')}</th>
        <th class="right">${t('pettyCash:closing_dialog.pdf.summary.items', 'Tételek')}</th>
        <th class="right">${t('pettyCash:closing_dialog.pdf.summary.income', 'Bevétel (+)')}</th>
        <th class="right">${t('pettyCash:closing_dialog.pdf.summary.expense', 'Kiadás (-)')}</th>
        <th class="right">${t('pettyCash:closing_dialog.pdf.summary.net', 'Időszaki forgalom')}</th>
        <th class="right">${t('pettyCash:closing_dialog.pdf.summary.closing', 'Záró egyenleg')}</th>
      </tr></thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </div>

  <table>
    <thead><tr>
      <th>${t('pettyCash:closing_dialog.pdf.table.sequence')}</th>
      <th>${t('pettyCash:closing_dialog.pdf.table.date')}</th>
      <th>${t('pettyCash:closing_dialog.pdf.table.register')}</th>
      <th>${t('pettyCash:closing_dialog.pdf.table.type')}</th>
      <th>${t('pettyCash:closing_dialog.pdf.table.description')}</th>
      <th class="right">${t('pettyCash:closing_dialog.pdf.table.income')}</th>
      <th class="right">${t('pettyCash:closing_dialog.pdf.table.expense')}</th>
      <th class="right">${t('pettyCash:closing_dialog.pdf.table.currency')}</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> {t('pettyCash:closing_dialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('pettyCash:closing_dialog.description', { from: dateFromFormatted, to: dateToFormatted })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Register filter */}
          <div className="flex items-center gap-3">
            <Label className="text-sm shrink-0">{t('pettyCash:closing_dialog.register_label')}</Label>
            <Select value={selectedRegister} onValueChange={setSelectedRegister}>
              <SelectTrigger className="w-48 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('pettyCash:closing_dialog.all_registers')}</SelectItem>
                {registers.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Detailed summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {currencySummary.map(([cur, s]) => {
              return (
                <Card key={cur} className={cn(
                  'transition-all border',
                  s.closing < 0 && 'border-destructive/40 bg-destructive/5'
                )}>
                  <CardContent className="p-3.5 space-y-2">
                    <div className="flex items-center justify-between pb-1 border-b border-border/50">
                      <Badge variant="outline" className="text-xs font-bold">{cur}</Badge>
                      <span className="text-xs text-muted-foreground">{t('pettyCash:closing_dialog.items_count', { count: s.count })}</span>
                    </div>

                    {/* Opening Balance */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{t('pettyCash:closing_dialog.opening_balance', 'Nyitó egyenleg')}</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {fmtBalance(s.opening, cur)}
                      </span>
                    </div>

                    {/* Period Income */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>{t('pettyCash:closing_dialog.period_income', 'Időszaki bevétel (+)')}</span>
                      </div>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                        {fmtBalance(s.income, cur)}
                      </span>
                    </div>

                    {/* Period Expense */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1 text-destructive">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>{t('pettyCash:closing_dialog.period_expense', 'Időszaki kiadás (-)')}</span>
                      </div>
                      <span className="text-destructive font-medium tabular-nums">
                        {fmtBalance(s.expense, cur)}
                      </span>
                    </div>

                    {/* Period Turnover (Net) */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                      <span className="text-muted-foreground">{t('pettyCash:closing_dialog.period_turnover', 'Időszaki forgalom')}</span>
                      <span className={cn('font-semibold tabular-nums', s.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                        {fmtAmount(s.net, cur)}
                      </span>
                    </div>

                    {/* Closing Balance */}
                    <div className="flex items-center justify-between text-sm pt-1.5 border-t border-border font-bold">
                      <div className="flex items-center gap-1.5">
                        <Wallet className="w-4 h-4 text-primary" />
                        <span>{t('pettyCash:closing_dialog.closing_balance', 'Záró egyenleg')}</span>
                      </div>
                      <span className={cn('tabular-nums font-bold text-base', s.closing >= 0 ? 'text-foreground' : 'text-destructive')}>
                        {fmtBalance(s.closing, cur)}
                      </span>
                    </div>

                    {/* Accounting Policy Daily Cash Limit Check */}
                    {cur === 'HUF' && s.closing > dailyMaxLimit && (
                      <div className="flex items-start gap-1.5 p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] mt-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <span className="font-semibold">{t('pettyCash:closing_dialog.policy_limit_exceeded', 'Számviteli politika figyelmeztetés')}:</span>
                          <p className="mt-0.5">
                            {t('pettyCash:closing_dialog.policy_limit_desc', {
                              limit: dailyMaxLimit.toLocaleString('hu-HU'),
                              defaultValue: `A záró készpénzállomány meghaladja a szabályzat szerinti napi maximumot (${dailyMaxLimit.toLocaleString('hu-HU')} Ft)!`,
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {currencySummary.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              {t('pettyCash:closing_dialog.empty')}
            </div>
          )}

          {/* Entry list */}
          {filteredEntries.length > 0 && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-xs">{t('pettyCash:closing_dialog.table.index')}</TableHead>
                    <TableHead className="text-xs">{t('pettyCash:closing_dialog.table.date')}</TableHead>
                    <TableHead className="text-xs">{t('pettyCash:closing_dialog.table.type')}</TableHead>
                    <TableHead className="text-xs">{t('pettyCash:closing_dialog.table.description')}</TableHead>
                    <TableHead className="text-right text-xs">{t('pettyCash:closing_dialog.table.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((e, idx) => (
                    <TableRow key={e.id} className="text-xs">
                      <TableCell className="font-mono text-[10px] text-muted-foreground">
                        {e.amount >= 0 ? 'B' : 'K'}-{String(idx + 1).padStart(3, '0')}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {e.entry_date ? format(new Date(e.entry_date), 'MM.dd.') : '—'}
                      </TableCell>
                      <TableCell>{SOURCE_LABELS[e.source_type] || e.source_type}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{e.description || '—'}</TableCell>
                      <TableCell className={cn(
                        'text-right font-medium tabular-nums',
                        e.amount >= 0 ? 'text-emerald-500' : 'text-destructive'
                      )}>
                        {fmtAmount(e.amount, e.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('pettyCash:closing_dialog.close')}</Button>
          <Button onClick={handleExportPdf} disabled={filteredEntries.length === 0 && currencySummary.every(s => s[1].opening === 0)}>
            <FileDown className="w-4 h-4 mr-2" /> {t('pettyCash:closing_dialog.print_pdf')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
