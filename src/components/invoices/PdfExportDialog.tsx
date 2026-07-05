import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, BarChart3, Settings, FileDown, AlertTriangle, Loader2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import type { ExportParams } from '@/hooks/usePdfExport';

type InvoiceDirectionTab = 'OUTBOUND' | 'INBOUND';

interface PdfExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (params: ExportParams) => Promise<void>;
  isExporting: boolean;
  /** Whether the EF invoke is in flight */
  isStarting: boolean;
  /** Pre-select a direction tab based on the current InvoicesPage tab */
  initialDirection?: InvoiceDirectionTab;
}

type PeriodPreset = 'current_month' | 'previous_month' | 'current_quarter' | 'previous_quarter' | 'custom';

function getPresetDates(preset: PeriodPreset): { from: string; to: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based

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

export function PdfExportDialog({ open, onClose, onExport, isExporting, isStarting, initialDirection }: PdfExportDialogProps) {
  const { selectedCompany } = useCompany();
  const [selectedPreset, setSelectedPreset] = useState<PeriodPreset>('current_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [invoiceCount, setInvoiceCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [direction, setDirection] = useState<InvoiceDirectionTab>(initialDirection || 'OUTBOUND');

  // Sync direction when dialog opens with a new initialDirection
  useEffect(() => {
    if (open && initialDirection) {
      setDirection(initialDirection);
    }
  }, [open, initialDirection]);

  const presetDates = useMemo(() => getPresetDates(selectedPreset), [selectedPreset]);
  const dateFrom = selectedPreset === 'custom' ? customFrom : presetDates.from;
  const dateTo = selectedPreset === 'custom' ? customTo : presetDates.to;

  // Fetch invoice count when dates or direction change
  useEffect(() => {
    if (!open || !selectedCompany?.id || !dateFrom || !dateTo) {
      setInvoiceCount(null);
      return;
    }

    let cancelled = false;
    setCountLoading(true);

    const fetchCount = async () => {
      const { count, error } = await supabase
        .from('invoices')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id)
        .eq('invoice_direction', direction)
        .gte('kibocsatas_datuma', dateFrom)
        .lte('kibocsatas_datuma', dateTo);

      if (!cancelled) {
        setInvoiceCount(error ? null : (count ?? 0));
        setCountLoading(false);
      }
    };

    const debounce = setTimeout(fetchCount, 300);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [open, selectedCompany?.id, dateFrom, dateTo, direction]);

  const estimatedSizeMB = invoiceCount ? Math.round(invoiceCount * 0.4 * 10) / 10 : null; // ~400KB per invoice avg
  const willSplit = estimatedSizeMB ? estimatedSizeMB > 25 : false;

  const handleExport = () => {
    if (!dateFrom || !dateTo) return;
    onExport({ dateFrom, dateTo, invoiceDirection: direction });
  };

  const presets: { key: PeriodPreset; icon: typeof Calendar; label: string; sublabel: string; fullWidth?: boolean }[] = [
    { key: 'current_month', icon: Calendar, label: 'Aktuális hónap', sublabel: getPresetDates('current_month').label },
    { key: 'previous_month', icon: Calendar, label: 'Előző hónap', sublabel: getPresetDates('previous_month').label },
    { key: 'current_quarter', icon: BarChart3, label: 'Aktuális negyedév', sublabel: getPresetDates('current_quarter').label },
    { key: 'previous_quarter', icon: BarChart3, label: 'Előző negyedév', sublabel: getPresetDates('previous_quarter').label },
    { key: 'custom', icon: Settings, label: 'Egyéni időszak', sublabel: 'Saját dátumtartomány megadása', fullWidth: true },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5 text-primary" />
            PDF Export — Időszak kiválasztás
          </DialogTitle>
          <DialogDescription>
            Válaszd ki, milyen időszak számláit szeretnéd egyetlen PDF-be exportálni.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Direction tabs */}
          <Tabs value={direction} onValueChange={(v) => setDirection(v as InvoiceDirectionTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="OUTBOUND" className="gap-1.5 text-xs">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Beküldött (Kimenő)
              </TabsTrigger>
              <TabsTrigger value="INBOUND" className="gap-1.5 text-xs">
                <ArrowDownLeft className="h-3.5 w-3.5" />
                Beküldött (Bejövő)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Period presets */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
              Időszak
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {presets.map((preset) => {
                const Icon = preset.icon;
                return (
                  <button
                    key={preset.key}
                    onClick={() => setSelectedPreset(preset.key)}
                    className={`
                      flex flex-col gap-0.5 p-3 rounded-md border text-left transition-colors duration-200
                      ${preset.fullWidth ? 'col-span-2' : ''}
                      ${selectedPreset === preset.key
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border hover:border-primary/40 hover:bg-primary/[0.02]'
                      }
                    `}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {preset.label}
                    </span>
                    <span className="text-xs text-muted-foreground pl-6">{preset.sublabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom date range inputs */}
          {selectedPreset === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pdf-date-from" className="text-xs text-muted-foreground">
                  Dátum -tól
                </Label>
                <Input
                  id="pdf-date-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="pdf-date-to" className="text-xs text-muted-foreground">
                  Dátum -ig
                </Label>
                <Input
                  id="pdf-date-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}

          {/* Invoice count info */}
          {dateFrom && dateTo && (
            <div className="flex items-center gap-3 p-3 rounded-md bg-primary/5 border border-primary/15 min-h-[62px]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                <FileDown className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                {countLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Számlák számolása...
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-semibold">
                      {invoiceCount ?? 0} beküldött {direction === 'OUTBOUND' ? 'kimenő' : 'bejövő'} számla
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {dateFrom} – {dateTo}
                      {estimatedSizeMB !== null && ` • Becsült méret: ~${estimatedSizeMB} MB`}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Size warning */}
          {willSplit && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-warning/5 border border-warning/15 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              A becsült méret meghaladja a 25 MB-ot — a PDF automatikusan több fájlba lesz darabolva.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isExporting || isStarting}>
            Mégse
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || isStarting || !dateFrom || !dateTo || invoiceCount === 0}
            className="gap-2"
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Export indítása...
              </>
            ) : isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Feldolgozás...
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Export indítása{invoiceCount ? ` (${invoiceCount} számla)` : ''}
              </>
            )}
          </Button>
        </DialogFooter>

        {/* Loading overlay while EF responds */}
        {isStarting && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-[2px] rounded-lg">
            <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
            <p className="text-sm font-semibold">Export indítása...</p>
            <p className="text-xs text-muted-foreground mt-1">Várakozás a szerver válaszára</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
