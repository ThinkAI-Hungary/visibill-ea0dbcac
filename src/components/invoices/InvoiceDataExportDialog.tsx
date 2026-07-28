import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, BarChart3, Settings, FileSpreadsheet, FileText, Search, CheckCircle2, ChevronLeft, ChevronRight, Download, Filter, RefreshCw } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';

export interface ExportableInvoice {
  id: string;
  invoice_number: string;
  direction: 'INBOUND' | 'OUTBOUND';
  partner_name: string;
  partner_tax_number?: string;
  issue_date: string;
  delivery_date?: string;
  net_amount: number;
  gross_amount: number;
  vat_amount: number;
  currency: string;
  paid?: boolean;
  submitted?: boolean;
  category_name?: string;
  project_name?: string;
  image_url?: string;
  melleklet_url?: string;
  source: 'nav' | 'submitted';
}

export type ExportLevel = 'summary' | 'itemized_posting';

interface InvoiceDataExportDialogProps {
  open: boolean;
  onClose: () => void;
  invoices: ExportableInvoice[];
  initialSelectedIds: Set<string>;
  initialFormat?: 'csv' | 'xlsx' | 'pdf';
  initialLevel?: ExportLevel;
  companyName?: string;
  onExport: (selectedInvoices: ExportableInvoice[], format: 'csv' | 'xlsx' | 'pdf', exportLevel: ExportLevel) => Promise<void>;
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

export function InvoiceDataExportDialog({
  open,
  onClose,
  invoices,
  initialSelectedIds,
  initialFormat = 'xlsx',
  initialLevel = 'summary',
  companyName,
  onExport,
}: InvoiceDataExportDialogProps) {
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'pdf'>(initialFormat);
  const [exportLevel, setExportLevel] = useState<ExportLevel>(initialLevel);
  const [selectedPreset, setSelectedPreset] = useState<PeriodPreset>('all_filtered');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  // Sync format & pre-selected IDs when dialog opens
  useEffect(() => {
    if (open) {
      setFormat(initialFormat);
      setExportLevel(initialLevel || 'summary');
      setSearchQuery('');
      setCurrentPage(1);

      if (initialSelectedIds && initialSelectedIds.size > 0) {
        setSelectedIds(new Set(initialSelectedIds));
        setSelectedPreset('all_filtered');
      } else {
        setSelectedIds(new Set(invoices.map(inv => inv.id)));
        setSelectedPreset('all_filtered');
      }
    }
  }, [open, initialSelectedIds, initialFormat, initialLevel, invoices]);

  const presetDates = useMemo(() => getPresetDates(selectedPreset), [selectedPreset]);

  // Filter invoices by preset date range + search query
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Date filter
      if (selectedPreset === 'custom') {
        if (customFrom && inv.issue_date && inv.issue_date < customFrom) return false;
        if (customTo && inv.issue_date && inv.issue_date > customTo) return false;
      } else if (selectedPreset !== 'all_filtered' && presetDates.from && presetDates.to) {
        if (inv.issue_date && (inv.issue_date < presetDates.from || inv.issue_date > presetDates.to)) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = inv.invoice_number.toLowerCase().includes(q);
        const partnerMatch = (inv.partner_name || '').toLowerCase().includes(q);
        const grossMatch = String(inv.gross_amount).includes(q);
        if (!numMatch && !partnerMatch && !grossMatch) return false;
      }

      return true;
    });
  }, [invoices, selectedPreset, presetDates, customFrom, customTo, searchQuery]);

  // Invoices to be exported (filtered + checked)
  const invoicesToExport = useMemo(() => {
    return filteredInvoices.filter(inv => selectedIds.has(inv.id));
  }, [filteredInvoices, selectedIds]);

  // Totals calculation
  const totalGrossAmount = useMemo(() => {
    return invoicesToExport.reduce((sum, inv) => sum + (inv.gross_amount || 0), 0);
  }, [invoicesToExport]);

  // Pagination for modal table list
  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE) || 1;
  const validCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (validCurrentPage - 1) * PAGE_SIZE;
  const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + PAGE_SIZE);

  // Checkbox helpers inside modal
  const allFilteredSelected = filteredInvoices.length > 0 && filteredInvoices.every(inv => selectedIds.has(inv.id));
  const someFilteredSelected = filteredInvoices.some(inv => selectedIds.has(inv.id));

  const handleToggleSelectAll = (checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      filteredInvoices.forEach(inv => next.add(inv.id));
    } else {
      filteredInvoices.forEach(inv => next.delete(inv.id));
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
    if (invoicesToExport.length === 0) return;
    setIsExporting(true);
    try {
      await onExport(invoicesToExport, format, exportLevel);
      onClose();
    } finally {
      setIsExporting(false);
    }
  };

  const hasPreSelected = initialSelectedIds && initialSelectedIds.size > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col bg-card/95 backdrop-blur-md border-border/50 p-6 overflow-hidden">
        <DialogHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Download className="h-5 w-5 text-primary" />
              Számlák Exportálása
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
            Válaszd ki az exportálandó számlákat, az időszakot, az adatszintet és a kívánt fájlformátumot.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-3">
          {/* Export Level Selector (Fejléc vs Tételes Kontírozott) */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              Exportálási Adatszint
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setExportLevel('summary')}
                className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all focus:outline-none ${
                  exportLevel === 'summary'
                    ? 'border-primary bg-primary/10 text-foreground font-semibold'
                    : 'border-border hover:border-primary/40 hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold">Fejléces Összesítő</span>
                </div>
                <span className="text-[10px] text-muted-foreground/80 font-normal">
                  Számlánként 1 sor (Fejléc adatok, bruttó/nettó/ÁFA összegek)
                </span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setExportLevel('itemized_posting')}
                className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all focus:outline-none ${
                  exportLevel === 'itemized_posting'
                    ? 'border-emerald-500 bg-emerald-500/10 text-foreground font-semibold'
                    : 'border-border hover:border-emerald-500/40 hover:bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Tételes Kontírozott (NAV Audit)</span>
                </div>
                <span className="text-[10px] text-muted-foreground/80 font-normal">
                  Tételenkénti kontírozás + Tartozik (T) & Követel (K) főkönyvi számok
                </span>
              </button>
            </div>
          </div>

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
                  <Download className="h-3.5 w-3.5 text-rose-500" />
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
                <option value="all_filtered">Összes szűrt számla ({invoices.length} db)</option>
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
                <Label htmlFor="export-date-from" className="text-xs text-muted-foreground">Dátum -tól</Label>
                <Input
                  id="export-date-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="export-date-to" className="text-xs text-muted-foreground">Dátum -ig</Label>
                <Input
                  id="export-date-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>
          )}

          {/* Invoice search & bulk controls */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Keresés bizonylatszám, partner vagy összeg alapján..."
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

            {/* Invoices table list */}
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
                    <TableHead className="w-28">Biz.szám</TableHead>
                    <TableHead className="w-24">Dátum</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead className="text-right w-28">Bruttó összeg</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedInvoices.length > 0 ? (
                    <>
                      {paginatedInvoices.map((inv) => {
                        const isChecked = selectedIds.has(inv.id);
                        return (
                          <TableRow
                            key={inv.id}
                            className={cn(
                              "group text-xs cursor-pointer transition-colors h-[45px]",
                              isChecked
                                ? "bg-primary/10 hover:bg-primary/15"
                                : "hover:bg-muted/30"
                            )}
                            onClick={() => handleToggleSingle(inv.id)}
                          >
                            <TableCell className="pr-0" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => handleToggleSingle(inv.id)}
                              />
                            </TableCell>
                            <TableCell className="font-semibold truncate max-w-[120px] py-2" title={inv.invoice_number}>
                              {inv.invoice_number}
                            </TableCell>
                            <TableCell className="text-muted-foreground py-2">{inv.issue_date}</TableCell>
                            <TableCell className="truncate max-w-[160px] py-2" title={inv.partner_name}>
                              {inv.partner_name || '–'}
                            </TableCell>
                            <TableCell className="text-right font-semibold tabular-nums py-2">
                              {formatCurrency(inv.gross_amount || 0, inv.currency || 'HUF')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {paginatedInvoices.length < PAGE_SIZE && (
                        Array.from({ length: PAGE_SIZE - paginatedInvoices.length }).map((_, index) => (
                          <tr key={`placeholder-${index}`} className="h-[45px]">
                            <td colSpan={5} className="px-3 py-1.5 select-none pointer-events-none">&nbsp;</td>
                          </tr>
                        ))
                      )}
                    </>
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nincs a keresési feltételeknek megfelelő számla.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Table pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-2 py-1.5 text-xs text-muted-foreground">
                <span>{filteredInvoices.length} találat • {validCurrentPage}. / {totalPages} oldal</span>
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
              {invoicesToExport.length} db számla kijelölve
            </span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Bruttó összérték: {formatCurrency(totalGrossAmount, 'HUF')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isExporting}>
              Mégse
            </Button>
            <Button
              type="button"
              onClick={handleConfirmExport}
              disabled={invoicesToExport.length === 0 || isExporting}
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
