import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FileDown, BookOpen, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useDateRange } from '@/contexts/DateRangeContext';
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
}

export default function CashClosingDialog({
  open, onOpenChange, entries, registers, registerMap,
}: CashClosingDialogProps) {
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const [selectedRegister, setSelectedRegister] = useState<string>('all');

  // Filter entries for the selected register
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

  // Group by currency for summary
  const currencySummary = useMemo(() => {
    const m: Record<string, { income: number; expense: number; count: number }> = {};
    filteredEntries.forEach(e => {
      if (!m[e.currency]) m[e.currency] = { income: 0, expense: 0, count: 0 };
      m[e.currency].count++;
      if (e.amount >= 0) m[e.currency].income += e.amount;
      else m[e.currency].expense += e.amount;
    });
    return Object.entries(m).sort(([a], [b]) => a === 'HUF' ? -1 : b === 'HUF' ? 1 : a.localeCompare(b));
  }, [filteredEntries]);

  const registerName = selectedRegister === 'all'
    ? 'Összes pénztár'
    : (registerMap[selectedRegister]?.name || '?');

  // F4: PDF export — generate a printable cash book
  const handleExportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rows = filteredEntries.map((e, idx) => {
      const regName = registerMap[e.register_id]?.name || '';
      const dateStr = e.entry_date ? format(new Date(e.entry_date), 'yyyy.MM.dd.') : '';
      const receiptType = e.amount >= 0 ? 'B' : 'K';
      const receiptNo = `${receiptType}-${String(idx + 1).padStart(3, '0')}`;
      const income = e.amount >= 0 ? roundHuf(e.amount, e.currency).toLocaleString('hu-HU') : '';
      const expense = e.amount < 0 ? roundHuf(Math.abs(e.amount), e.currency).toLocaleString('hu-HU') : '';

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
      const net = roundHuf(s.income + s.expense, cur);
      return `<tr>
        <td><strong>${cur}</strong></td>
        <td class="right">${s.count} tétel</td>
        <td class="right green">${roundHuf(s.income, cur).toLocaleString('hu-HU')}</td>
        <td class="right red">${roundHuf(Math.abs(s.expense), cur).toLocaleString('hu-HU')}</td>
        <td class="right" style="font-weight:700">${net.toLocaleString('hu-HU')}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Pénztárzárás — ${registerName}</title>
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
  .summary { margin-top: 12px; border: 1px solid #ddd; border-radius: 4px; padding: 12px; background: #fafafa; }
  .summary h2 { font-size: 13px; margin: 0 0 8px 0; }
  @media print { body { margin: 10mm; } }
</style></head><body>
  <h1>📋 Pénztárzárás — ${registerName}</h1>
  <div class="meta">Időszak: ${dateFromFormatted} – ${dateToFormatted} | Generálva: ${format(new Date(), 'yyyy.MM.dd. HH:mm')}</div>

  <table>
    <thead><tr>
      <th>Sorszám</th><th>Dátum</th><th>Pénztár</th><th>Típus</th><th>Leírás</th>
      <th class="right">Bevétel</th><th class="right">Kiadás</th><th class="right">Valuta</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="summary">
    <h2>Összesítés</h2>
    <table>
      <thead><tr><th>Valuta</th><th class="right">Tételek</th><th class="right">Bevétel</th><th class="right">Kiadás</th><th class="right">Nettó</th></tr></thead>
      <tbody>${summaryRows}</tbody>
    </table>
  </div>
</body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 300);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" /> Pénztárzárás
          </DialogTitle>
          <DialogDescription>
            Összesítő az aktuális időszakban ({dateFromFormatted} – {dateToFormatted})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Register filter */}
          <div className="flex items-center gap-3">
            <Label className="text-sm shrink-0">Pénztár:</Label>
            <Select value={selectedRegister} onValueChange={setSelectedRegister}>
              <SelectTrigger className="w-48 h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Összes pénztár</SelectItem>
                {registers.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {currencySummary.map(([cur, s]) => {
              const net = roundHuf(s.income + s.expense, cur);
              return (
                <Card key={cur} className={cn(
                  'transition-all',
                  net < 0 && 'border-destructive/30'
                )}>
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">{cur}</Badge>
                      <span className="text-xs text-muted-foreground">{s.count} tétel</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-500 font-medium tabular-nums">
                        {fmtBalance(roundHuf(s.income, cur), cur)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm">
                      <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                      <span className="text-destructive font-medium tabular-nums">
                        {fmtBalance(roundHuf(s.expense, cur), cur)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm pt-1 border-t border-border/40">
                      <Wallet className="w-3.5 h-3.5 text-primary" />
                      <span className={cn('font-bold tabular-nums', net >= 0 ? 'text-foreground' : 'text-destructive')}>
                        {fmtBalance(net, cur)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {currencySummary.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              Nincs tétel az aktuális időszakban
            </div>
          )}

          {/* Entry list */}
          {filteredEntries.length > 0 && (
            <div className="max-h-64 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-xs">#</TableHead>
                    <TableHead className="text-xs">Dátum</TableHead>
                    <TableHead className="text-xs">Típus</TableHead>
                    <TableHead className="text-xs">Leírás</TableHead>
                    <TableHead className="text-right text-xs">Összeg</TableHead>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Bezárás</Button>
          <Button onClick={handleExportPdf} disabled={filteredEntries.length === 0}>
            <FileDown className="w-4 h-4 mr-2" /> PDF nyomtatás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
