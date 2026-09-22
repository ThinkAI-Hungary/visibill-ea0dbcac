import { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FileSpreadsheet, FileText, Search, CheckCircle2, ChevronLeft, ChevronRight, Download, RefreshCw, FileDown, Receipt } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import type { Transaction } from '@/hooks/useTransactionData';

export interface ExportableTransaction extends Transaction {
  matched_invoice_number?: string;
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

interface TransactionDataExportDialogProps {
  open: boolean;
  onClose: () => void;
  transactions: ExportableTransaction[];
  initialSelectedIds?: Set<string>;
  initialFormat?: ExportFormat;
  companyName?: string;
  onExport: (
    selectedTransactions: ExportableTransaction[],
    format: ExportFormat
  ) => Promise<void>;
}

type PeriodPreset = 'all_filtered' | 'current_month' | 'previous_month' | 'current_quarter' | 'previous_quarter' | 'custom';

function getPresetDates(preset: PeriodPreset): { from: string; to: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case 'current_month': {
      const from = new Date(year, month, 1);
      const to = new Date(year, month + 1, 0);
      return {
        from: formatDate(from),
        to: formatDate(to),
        label: `${year}. ${getMonthName(month)}`,
      };
    }
    case 'previous_month': {
      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 0);
      return {
        from: formatDate(from),
        to: formatDate(to),
        label: `${from.getFullYear()}. ${getMonthName(from.getMonth())}`,
      };
    }
    case 'current_quarter': {
      const qStart = Math.floor(month / 3) * 3;
      const qNum = Math.floor(month / 3) + 1;
      const from = new Date(year, qStart, 1);
      const to = new Date(year, qStart + 3, 0);
      return {
        from: formatDate(from),
        to: formatDate(to),
        label: `${year} Q${qNum} (${getMonthName(qStart)} – ${getMonthName(qStart + 2)})`,
      };
    }
    case 'previous_quarter': {
      const currentQStart = Math.floor(month / 3) * 3;
      const prevQStart = currentQStart - 3;
      const prevYear = prevQStart < 0 ? year - 1 : year;
      const adjustedStart = prevQStart < 0 ? prevQStart + 12 : prevQStart;
      const qNum = Math.floor(adjustedStart / 3) + 1;
      const from = new Date(prevYear, adjustedStart, 1);
      const to = new Date(prevYear, adjustedStart + 3, 0);
      return {
        from: formatDate(from),
        to: formatDate(to),
        label: `${prevYear} Q${qNum} (${getMonthName(adjustedStart)} – ${getMonthName(adjustedStart + 2)})`,
      };
    }
    default:
      return { from: '', to: '', label: '' };
  }
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

const MONTH_NAMES = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
];

function getMonthName(month: number): string {
  return MONTH_NAMES[((month % 12) + 12) % 12];
}

const PAGE_SIZE = 6;

export function TransactionDataExportDialog({
  open,
  onClose,
  transactions,
  initialSelectedIds,
  initialFormat = 'xlsx',
  companyName,
  onExport,
}: TransactionDataExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>(initialFormat);
  const [selectedPreset, setSelectedPreset] = useState<PeriodPreset>('all_filtered');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  // Tracks previous open state to only initialize when dialog transitions from closed to open
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setFormat(initialFormat || 'xlsx');
      setSearchQuery('');
      setCurrentPage(1);

      if (initialSelectedIds && initialSelectedIds.size > 0) {
        setSelectedIds(new Set(initialSelectedIds));
      } else {
        setSelectedIds(new Set(transactions.map(t => t.id)));
      }
      setSelectedPreset('all_filtered');
    }
    prevOpenRef.current = open;
  }, [open, initialSelectedIds, initialFormat, transactions]);

  const presetDates = useMemo(() => getPresetDates(selectedPreset), [selectedPreset]);

  // Filter transactions by preset date range + search query
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Date filter
      if (selectedPreset === 'custom') {
        if (customFrom && tx.transaction_date && tx.transaction_date < customFrom) return false;
        if (customTo && tx.transaction_date && tx.transaction_date > customTo) return false;
      } else if (selectedPreset !== 'all_filtered' && presetDates.from && presetDates.to) {
        if (tx.transaction_date && (tx.transaction_date < presetDates.from || tx.transaction_date > presetDates.to)) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const descMatch = (tx.description || '').toLowerCase().includes(q);
        const invMatch = (tx.matched_invoice_number || '').toLowerCase().includes(q);
        const typeMatch = (tx.type || '').toLowerCase().includes(q);
        const amtMatch = String(tx.amount).includes(q);
        if (!descMatch && !invMatch && !typeMatch && !amtMatch) return false;
      }

      return true;
    });
  }, [transactions, selectedPreset, presetDates, customFrom, customTo, searchQuery]);

  // Transactions to be exported (filtered + checked)
  const transactionsToExport = useMemo(() => {
    return filteredTransactions.filter(tx => selectedIds.has(tx.id));
  }, [filteredTransactions, selectedIds]);

  // Totals calculation
  const totalAmount = useMemo(() => {
    return transactionsToExport.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  }, [transactionsToExport]);

  const totalFees = useMemo(() => {
    return transactionsToExport.reduce((sum, tx) => sum + (tx.fee_amount || 0), 0);
  }, [transactionsToExport]);

  // Pagination for modal table list
  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * PAGE_SIZE;
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + PAGE_SIZE);

  // Checkbox helpers inside modal
  const allFilteredSelected = filteredTransactions.length > 0 && filteredTransactions.every(tx => selectedIds.has(tx.id));
  const someFilteredSelected = filteredTransactions.some(tx => selectedIds.has(tx.id));

  const handleToggleSelectAll = (checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      filteredTransactions.forEach(tx => next.add(tx.id));
    } else {
      filteredTransactions.forEach(tx => next.delete(tx.id));
    }
    setSelectedIds(next);
  };

  const handleToggleSingle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleConfirmExport = async () => {
    if (transactionsToExport.length === 0) return;
    setIsExporting(true);
    try {
      await onExport(transactionsToExport, format);
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  const hasPreSelected = initialSelectedIds && initialSelectedIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col bg-card/95 backdrop-blur-md border-border/50 p-6 overflow-hidden">
        <DialogHeader className="border-b border-border pb-4 pr-6">
          <div className="flex items-center gap-3 flex-wrap">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Download className="h-5 w-5 text-primary" />
              Tranzakciók Exportálása
            </DialogTitle>

            {/* Pre-selection badge */}
            {hasPreSelected && (
              <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 gap-1 text-xs py-1 px-2.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {initialSelectedIds.size} db kijelölve az oldalon
              </Badge>
            )}
          </div>
          <DialogDescription className="mt-1 text-xs">
            Válaszd ki az exportálandó tranzakciókat, az időszakot és a kívánt fájlformátumot.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-3">
          {/* Format selector & Preset options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export format picker */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                Fájlformátum
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setFormat('xlsx')}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-semibold transition-all focus:outline-none ${
                    format === 'xlsx'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-border hover:border-emerald-500/40 hover:bg-emerald-500/5'
                  }`}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                  Excel (.xlsx)
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setFormat('csv')}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-semibold transition-all focus:outline-none ${
                    format === 'csv'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'border-border hover:border-blue-500/40 hover:bg-blue-500/5'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  CSV (.csv)
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setFormat('pdf')}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-semibold transition-all focus:outline-none ${
                    format === 'pdf'
                      ? 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'border-border hover:border-rose-500/40 hover:bg-rose-500/5'
                  }`}
                >
                  <FileDown className="h-3.5 w-3.5 text-rose-500" />
                  PDF (.pdf)
                </button>
              </div>
            </div>

            {/* Quick preset selector */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                Időszak szűrő
              </Label>
              <select
                value={selectedPreset}
                onChange={(e) => setSelectedPreset(e.target.value as PeriodPreset)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs font-medium focus:ring-1 focus:ring-primary"
              >
                <option value="all_filtered">Összes szűrt tranzakció ({transactions.length} db)</option>
                <option value="current_month">Aktuális hónap ({getPresetDates('current_month').label})</option>
                <option value="previous_month">Előző hónap ({getPresetDates('previous_month').label})</option>
                <option value="current_quarter">Aktuális negyedév ({getPresetDates('current_quarter').label})</option>
                <option value="previous_quarter">Előző negyedév ({getPresetDates('previous_quarter').label})</option>
                <option value="custom">Egyéni dátumtartomány...</option>
              </select>
            </div>
          </div>

          {/* Custom date range inputs */}
          {selectedPreset === 'custom' && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/20 border border-border">
              <div>
                <Label htmlFor="export-tx-date-from" className="text-xs text-muted-foreground">Dátum -tól</Label>
                <Input
                  id="export-tx-date-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="export-tx-date-to" className="text-xs text-muted-foreground">Dátum -ig</Label>
                <Input
                  id="export-tx-date-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* Transaction search & bulk controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Keresés leírás, összeg vagy számlaszám alapján..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-8 h-8 text-xs bg-background/50"
                />
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleSelectAll(true)}
                  className="h-8 text-[11px] px-2.5"
                >
                  Mindet kijelöl
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleSelectAll(false)}
                  className="h-8 text-[11px] px-2.5 text-muted-foreground hover:text-foreground"
                >
                  Kijelölés törlése
                </Button>
              </div>
            </div>

            {/* Transactions table preview list */}
            <div className="border border-border rounded-lg overflow-hidden bg-background/50">
              <Table className="compact-table w-full">
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-transparent text-[11px]">
                    <TableHead className="w-10 pr-0">
                      <Checkbox
                        checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false}
                        onCheckedChange={(checked) => handleToggleSelectAll(!!checked)}
                      />
                    </TableHead>
                    <TableHead className="w-24">Dátum</TableHead>
                    <TableHead>Leírás</TableHead>
                    <TableHead className="w-36">Kapcsolódó számla</TableHead>
                    <TableHead className="text-right w-24">Díj / Jutalék</TableHead>
                    <TableHead className="text-right w-28">Összeg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTransactions.length > 0 ? (
                    <>
                      {paginatedTransactions.map((tx) => {
                        const isChecked = selectedIds.has(tx.id);
                        return (
                          <TableRow
                            key={tx.id}
                            className={cn(
                              "group text-xs cursor-pointer transition-colors h-[45px]",
                              isChecked
                                ? "bg-primary/10 hover:bg-primary/15"
                                : "hover:bg-muted/30"
                            )}
                            onClick={() => handleToggleSingle(tx.id)}
                          >
                            <TableCell className="pr-0" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => handleToggleSingle(tx.id)}
                              />
                            </TableCell>
                            <TableCell className="text-muted-foreground py-2 whitespace-nowrap">
                              {tx.transaction_date || '–'}
                            </TableCell>
                            <TableCell className="max-w-[180px] truncate py-2" title={tx.description || ''}>
                              <span className="font-medium text-foreground block truncate">
                                {tx.description || '–'}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 whitespace-nowrap">
                              {tx.matched_invoice_number ? (
                                <Badge variant="outline" className="font-mono text-[10px] bg-primary/5 text-primary border-primary/20 gap-1 py-0.5 px-1.5">
                                  <Receipt className="h-2.5 w-2.5" />
                                  {tx.matched_invoice_number}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground/60 italic text-[11px]">–</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums py-2 text-muted-foreground whitespace-nowrap">
                              {tx.fee_amount != null
                                ? `-${formatCurrency(tx.fee_amount, tx.currency || undefined)}`
                                : '–'}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-semibold tabular-nums py-2 whitespace-nowrap",
                              tx.amount >= 0 ? "text-success" : "text-destructive"
                            )}>
                              {formatCurrency(tx.amount || 0, tx.currency || 'HUF')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {paginatedTransactions.length < PAGE_SIZE && (
                        Array.from({ length: PAGE_SIZE - paginatedTransactions.length }).map((_, index) => (
                          <tr key={`placeholder-${index}`} className="h-[45px]">
                            <td colSpan={6} className="px-3 py-1.5 select-none pointer-events-none">&nbsp;</td>
                          </tr>
                        ))
                      )}
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nincs a keresési feltételeknek megfelelő tranzakció.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Table pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-1.5 text-xs text-muted-foreground">
                <span>{filteredTransactions.length} találat • {validCurrentPage}. / {totalPages} oldal</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    disabled={validCurrentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    disabled={validCurrentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer summary & confirm button */}
        <DialogFooter className="border-t border-border pt-4 mt-auto flex-row items-center justify-between sm:justify-between">
          <div className="flex flex-col text-left min-w-[220px]">
            <span className="text-xs font-semibold text-foreground tabular-nums">
              {transactionsToExport.length} db tranzakció kijelölve
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Összérték: {formatCurrency(totalAmount, 'HUF')}
              {totalFees > 0 && ` • Díjak: -${formatCurrency(totalFees, 'HUF')}`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isExporting}>
              Mégse
            </Button>
            <Button
              type="button"
              onClick={handleConfirmExport}
              disabled={transactionsToExport.length === 0 || isExporting}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90 min-w-[140px] justify-center tabular-nums"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Exportálás...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Exportálás
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
