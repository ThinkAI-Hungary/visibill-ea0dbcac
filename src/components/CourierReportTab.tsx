import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RefreshCw, Search, X, CheckCircle2, AlertCircle, MinusCircle, Eye, FileText, Landmark, RotateCcw, Link2, Check, Sparkles, CalendarDays, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useCourierReportData, type CourierReport } from '@/hooks/useCourierReportData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ReportFilesDialog } from '@/components/courier/ReportFilesDialog';

const REPORT_LABELS: Record<string, string> = {
  gls: 'GLS',
  mpl: 'MPL / Posta',
  mixpack: 'Mixpack',
};

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  rowBg: string;
}> = {
  full: {
    label: 'Párosított',
    icon: CheckCircle2,
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    rowBg: 'bg-emerald-100/70 dark:bg-emerald-950/40',
  },
  partial_trx: {
    label: 'Tranzakció ✓',
    icon: AlertCircle,
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    rowBg: 'bg-amber-100/60 dark:bg-amber-950/40',
  },
  partial_nav: {
    label: 'NAV ✓',
    icon: AlertCircle,
    color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    rowBg: 'bg-amber-100/60 dark:bg-amber-950/40',
  },
  unmatched: {
    label: 'Párosítatlan',
    icon: MinusCircle,
    color: 'bg-red-500/10 text-red-600 border-red-500/20',
    rowBg: 'bg-rose-100/60 dark:bg-rose-950/30',
  },
  total: {
    label: 'Összesítő',
    icon: FileText,
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    rowBg: 'bg-blue-50/50 dark:bg-blue-950/20',
  },
};

interface CourierReportTabProps {
  reportType: 'gls' | 'mpl' | 'mixpack';
}

// ── Details dialog for matched invoices ──
interface MatchDetails {
  transaction: any | null;
  navInvoice: any | null;
}

function CourierInvoiceDialog({
  open,
  onOpenChange,
  report,
  handleRematch,
  onManualMatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: CourierReport | null;
  handleRematch: (id: string) => void;
  onManualMatch: () => void;
}) {
  const [details, setDetails] = useState<MatchDetails>({ transaction: null, navInvoice: null });
  const [loading, setLoading] = useState(false);
  const [showManualMatch, setShowManualMatch] = useState(false);
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedNavId, setSelectedNavId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !report) {
      setDetails({ transaction: null, navInvoice: null });
      setShowManualMatch(false);
      setSearch('');
      setSelectedNavId(null);
      return;
    }

    const fetchDetails = async () => {
      setLoading(true);
      const result: MatchDetails = { transaction: null, navInvoice: null };

      if (report.matched_transaction_id) {
        const { data } = await supabase
          .from('transactions')
          .select('id, transaction_date, description, amount, currency, type')
          .eq('id', report.matched_transaction_id)
          .maybeSingle();
        result.transaction = data;
      }

      if (report.matched_nav_invoice_id) {
        const { data } = await supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_issue_date, supplier_name, customer_name, invoice_gross_amount, currency, invoice_direction')
          .eq('id', report.matched_nav_invoice_id)
          .maybeSingle();
        result.navInvoice = data;
      }

      setDetails(result);
      setLoading(false);

      // Auto-open manual match for unmatched reports
      if (!report.matched_nav_invoice_id && report.match_status !== 'total') {
        fetchAvailableInvoices();
        setShowManualMatch(true);
      }
    };

    fetchDetails();
  }, [open, report]);

  const fetchAvailableInvoices = async () => {
    if (!report) return;
    setLoadingAvailable(true);
    try {
      // Search NAV invoices in a ±7 day range around delivery date
      let query = supabase
        .from('nav_invoices')
        .select('id, invoice_number, invoice_issue_date, supplier_name, customer_name, invoice_gross_amount, currency, invoice_direction')
        .eq('company_id', report.company_id)
        .order('invoice_issue_date', { ascending: false })
        .limit(50);

      if (report.delivery_date) {
        const d = new Date(report.delivery_date);
        const from = new Date(d); from.setDate(from.getDate() - 14);
        const to = new Date(d); to.setDate(to.getDate() + 7);
        query = query.gte('invoice_issue_date', from.toISOString().slice(0, 10))
                     .lte('invoice_issue_date', to.toISOString().slice(0, 10));
      }

      const { data, error } = await query;
      if (error) throw error;
      setAvailableInvoices(data || []);
    } catch (err) {
      console.error('Error fetching available invoices:', err);
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleSaveMatch = async () => {
    if (!report || !selectedNavId) return;
    setSaving(true);
    try {
      const matchStatus = report.matched_transaction_id ? 'full' : 'partial_nav';
      const { error } = await supabase
        .from('courier_reports')
        .update({
          matched_nav_invoice_id: selectedNavId,
          match_status: matchStatus,
          match_reason: 'Manual match',
        })
        .eq('id', report.id);
      if (error) throw error;
      toast({ title: 'Számla párosítva!' });
      onManualMatch();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnmatch = async (target: 'nav' | 'trx' | 'both') => {
    if (!report) return;
    setSaving(true);
    try {
      const updates: Record<string, any> = { match_reason: 'Manual unmatch' };

      const clearNav = target === 'nav' || target === 'both';
      const clearTrx = target === 'trx' || target === 'both';

      if (clearNav) updates.matched_nav_invoice_id = null;
      if (clearTrx) updates.matched_transaction_id = null;

      // Determine new status
      const hasNav = !clearNav && !!report.matched_nav_invoice_id;
      const hasTrx = !clearTrx && !!report.matched_transaction_id;
      if (hasNav && hasTrx) updates.match_status = 'full';
      else if (hasTrx) updates.match_status = 'partial_trx';
      else if (hasNav) updates.match_status = 'partial_nav';
      else updates.match_status = 'unmatched';

      const { error } = await supabase
        .from('courier_reports')
        .update(updates)
        .eq('id', report.id);
      if (error) throw error;
      toast({ title: 'Párosítás megszüntetve!' });
      onManualMatch();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const [showUnmatchOptions, setShowUnmatchOptions] = useState(false);

  const filteredInvoices = useMemo(() => {
    if (!search) return availableInvoices;
    const s = search.toLowerCase();
    return availableInvoices.filter(inv =>
      inv.invoice_number?.toLowerCase().includes(s) ||
      inv.supplier_name?.toLowerCase().includes(s) ||
      inv.customer_name?.toLowerCase().includes(s) ||
      inv.invoice_gross_amount?.toString().includes(search)
    );
  }, [availableInvoices, search]);

  const formatAmount = (amount: number | null, currency?: string) => {
    if (amount == null) return '-';
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: currency || 'HUF', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('hu-HU');
  };

  if (!report) return null;
  const statusCfg = STATUS_CONFIG[report.match_status] || STATUS_CONFIG.unmatched;
  const codAmount = Math.abs(report.cod_amount ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Riport sor részletei
          </DialogTitle>
          <DialogDescription>
            Csomagszám: {report.package_number || '-'} — {formatDate(report.delivery_date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {/* Report row info */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Riport adatok</h4>
              <Badge variant="outline" className={cn('text-xs ml-auto', statusCfg.color)}>
                {statusCfg.label}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div className="text-muted-foreground">Címzett</div>
              <div className="font-medium">{report.recipient_name || '-'}</div>
              <div className="text-muted-foreground">Hivatkozás</div>
              <div className="font-mono text-xs">{report.reference_number || '-'}</div>
              <div className="text-muted-foreground">Utánvét összeg</div>
              <div className="font-semibold">{formatAmount(report.cod_amount)}</div>
            </div>
            {/* AI match reason */}
            {report.match_reason && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">AI párosítási indoklás</span>
                  {report.match_confidence != null && (
                    <Badge 
                      variant="outline" 
                      className={cn(
                        'text-[10px] h-4 ml-auto',
                        report.match_confidence >= 0.9 ? 'border-emerald-500/40 text-emerald-600' :
                        report.match_confidence >= 0.7 ? 'border-amber-500/40 text-amber-600' :
                        'border-red-500/40 text-red-600'
                      )}
                    >
                      {Math.round(report.match_confidence * 100)}% konfidencia
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] bg-muted/50 p-2 rounded border border-border/30 text-muted-foreground leading-relaxed">
                  {report.match_reason}
                </p>
              </div>
            )}
          </div>

          {/* Matched transaction */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">Párosított tranzakció</h4>
              {report.matched_transaction_id ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
              ) : (
                <MinusCircle className="h-4 w-4 text-muted-foreground/40 ml-auto" />
              )}
            </div>
            {loading ? (
              <div className="h-12 bg-muted animate-pulse rounded" />
            ) : details.transaction ? (
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                <div className="text-muted-foreground">Dátum</div>
                <div>{formatDate(details.transaction.transaction_date)}</div>
                <div className="text-muted-foreground">Leírás</div>
                <div className="truncate max-w-[200px]" title={details.transaction.description}>{details.transaction.description || '-'}</div>
                <div className="text-muted-foreground">Összeg</div>
                <div className="font-semibold">{formatAmount(details.transaction.amount, details.transaction.currency)}</div>
                <div className="text-muted-foreground">Típus</div>
                <div>{details.transaction.type || '-'}</div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nincs párosított tranzakció</p>
            )}
          </div>

          {/* Matched NAV invoice (when not in manual match mode) */}
          {!showManualMatch && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">Párosított NAV számla</h4>
                {report.matched_nav_invoice_id ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
                ) : (
                  <MinusCircle className="h-4 w-4 text-muted-foreground/40 ml-auto" />
                )}
              </div>
              {loading ? (
                <div className="h-12 bg-muted animate-pulse rounded" />
              ) : details.navInvoice ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <div className="text-muted-foreground">Számlaszám</div>
                  <div className="font-mono text-xs">{details.navInvoice.invoice_number}</div>
                  <div className="text-muted-foreground">Dátum</div>
                  <div>{formatDate(details.navInvoice.invoice_issue_date)}</div>
                  <div className="text-muted-foreground">Partner</div>
                  <div>{details.navInvoice.invoice_direction === 'INBOUND' ? (details.navInvoice.supplier_name || '-') : (details.navInvoice.customer_name || '-')}</div>
                  <div className="text-muted-foreground">Bruttó összeg</div>
                  <div className="font-semibold">{formatAmount(details.navInvoice.invoice_gross_amount, details.navInvoice.currency)}</div>
                  <div className="text-muted-foreground">Irány</div>
                  <div><Badge variant="outline" className="text-xs">{details.navInvoice.invoice_direction === 'INBOUND' ? 'Bejövő' : 'Kimenő'}</Badge></div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nincs párosított NAV számla</p>
              )}
            </div>
          )}

          {/* Manual match picker */}
          {showManualMatch && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <Link2 className="h-4 w-4" />
                  {report.matched_nav_invoice_id ? 'Másik NAV számla' : 'NAV számla párosítás'}
                </h4>
                {report.matched_nav_invoice_id && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowManualMatch(false)}>
                    Vissza
                  </Button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Keresés számlaszám, partner, összeg..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <div className="max-h-[180px] overflow-y-auto border rounded-md">
                {loadingAvailable ? (
                  <div className="flex items-center justify-center h-16">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-16 text-muted-foreground">
                    <FileText className="h-4 w-4 mb-1" />
                    <p className="text-xs">Nincs elérhető számla a dátumtartományban</p>
                  </div>
                ) : (
                  <div className="p-1.5 space-y-1">
                    {filteredInvoices.map(inv => {
                      const isSelected = selectedNavId === inv.id;
                      const isExact = Math.abs((inv.invoice_gross_amount ?? 0) - codAmount) < 1;
                      const partner = inv.invoice_direction === 'INBOUND' ? inv.supplier_name : inv.customer_name;
                      return (
                        <div
                          key={inv.id}
                          className={cn(
                            'cursor-pointer rounded-md p-2 transition-colors border text-xs',
                            isSelected ? 'border-primary bg-primary/10' : 'hover:bg-muted/50 border-transparent',
                            isExact && !isSelected && 'border-emerald-500/30'
                          )}
                          onClick={() => setSelectedNavId(inv.id)}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-mono font-medium">{inv.invoice_number}</p>
                              <p className="text-muted-foreground text-[10px]">{partner || '-'} · {formatDate(inv.invoice_issue_date)}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono font-medium">{formatAmount(inv.invoice_gross_amount, inv.currency)}</p>
                              {isExact && <Badge variant="outline" className="text-[9px] h-4 border-emerald-500/40 text-emerald-600">Egyező összeg</Badge>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {selectedNavId && (
                <Button size="sm" className="w-full text-xs h-8" disabled={saving} onClick={handleSaveMatch}>
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  {saving ? 'Mentés...' : 'Párosítás mentése'}
                </Button>
              )}
            </div>
          )}

          {/* Action buttons */}
          {report.match_status !== 'total' && (
            <div className="space-y-2 pt-2 border-t">
              {/* Unmatch options */}
              {showUnmatchOptions && !showManualMatch && (report.matched_nav_invoice_id || report.matched_transaction_id) && (
                <div className="rounded-md border p-2 space-y-1.5 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Melyik párosítást szeretnéd megszüntetni?</p>
                  {report.matched_transaction_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs h-7"
                      disabled={saving}
                      onClick={() => handleUnmatch('trx')}
                    >
                      <Landmark className="h-3 w-3 mr-1.5" />
                      Tranzakció párosítás törlése
                    </Button>
                  )}
                  {report.matched_nav_invoice_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs h-7"
                      disabled={saving}
                      onClick={() => handleUnmatch('nav')}
                    >
                      <FileText className="h-3 w-3 mr-1.5" />
                      NAV számla párosítás törlése
                    </Button>
                  )}
                  {report.matched_transaction_id && report.matched_nav_invoice_id && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full justify-start text-xs h-7"
                      disabled={saving}
                      onClick={() => handleUnmatch('both')}
                    >
                      <X className="h-3 w-3 mr-1.5" />
                      Mindkettő törlése
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="w-full text-xs h-6" onClick={() => setShowUnmatchOptions(false)}>
                    Mégse
                  </Button>
                </div>
              )}

              <div className="flex justify-end gap-2">
                {!showManualMatch && (report.matched_nav_invoice_id || report.matched_transaction_id) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={saving}
                    onClick={() => setShowUnmatchOptions(!showUnmatchOptions)}
                  >
                    Párosítás megszüntetése
                  </Button>
                )}
                {!showManualMatch && report.match_status !== 'full' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => { fetchAvailableInvoices(); setShowManualMatch(true); }}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                    {report.matched_nav_invoice_id ? 'Másik számla' : 'Manuális párosítás'}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={async () => { await handleRematch(report.id); onOpenChange(false); }}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Auto párosítás
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ──

const CourierReportTab = ({ reportType }: CourierReportTabProps) => {
  // Local date override (undefined = follow global date range)
  const [localDateFrom, setLocalDateFrom] = useState<Date | null | undefined>(undefined);
  const [localDateTo, setLocalDateTo] = useState<Date | null | undefined>(undefined);
  const hasLocalDateOverride = localDateFrom !== undefined || localDateTo !== undefined;

  const {
    selectedCompany,
    filteredReports,
    totalCount,
    totalPages,
    loading,
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    handleSort,
    sortField,
    sortDirection,
    currentPage,
    setCurrentPage,
    pageSize,
    handlePageSizeChange,
    handleSync,
    handleRematch,
  } = useCourierReportData(reportType, localDateFrom, localDateTo);

  // Details dialog state
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<CourierReport | null>(null);

  const handleOpenDetails = (report: CourierReport) => {
    setSelectedReport(report);
    setDetailsOpen(true);
  };

  // Match stats
  const stats = useMemo(() => {
    const items = filteredReports.filter(r => r.row_type !== 'total');
    const matched = items.filter(r => r.match_status === 'full').length;
    const partial = items.filter(r => r.match_status === 'partial_trx' || r.match_status === 'partial_nav').length;
    const unmatched = items.filter(r => r.match_status === 'unmatched').length;
    const total = items.reduce((sum, r) => sum + (r.cod_amount ?? 0), 0);
    return { matched, partial, unmatched, total };
  }, [filteredReports]);

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center h-[30vh]">
        <p className="text-muted-foreground">Válassz egy céget a folytatáshoz</p>
      </div>
    );
  }

  const formatAmount = (amount: number | null) => {
    if (amount == null) return '-';
    return new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('hu-HU');
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold">
                {REPORT_LABELS[reportType]} Riportok
              </CardTitle>
              <CardDescription>
                {totalCount} sor — Párosított: {stats.matched} | Részleges: {stats.partial} | Párosítatlan: {stats.unmatched}
                {stats.total > 0 && ` — Összesen: ${formatAmount(stats.total)}`}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleSync}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Frissítés
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Riport adatok frissítése</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <ReportFilesDialog reportType={reportType} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Keresés (hivatkozás, csomagszám, címzett...)"
                value={filters.search}
                onChange={e => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-9"
              />
            </div>
            <Select
              value={filters.matchStatus}
              onValueChange={v => setFilters(prev => ({ ...prev, matchStatus: v }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Státusz" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Összes státusz</SelectItem>
                <SelectItem value="full">Párosított</SelectItem>
                <SelectItem value="partial_trx">Tranzakció ✓</SelectItem>
                <SelectItem value="partial_nav">NAV ✓</SelectItem>
                <SelectItem value="unmatched">Párosítatlan</SelectItem>
              </SelectContent>
            </Select>

            {/* Local date range override — same design as GlobalDatePicker */}
            <div className="flex items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-7 text-xs px-2.5 justify-start font-normal",
                      hasLocalDateOverride && "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
                    )}
                  >
                    <CalendarDays className="mr-1.5 h-3 w-3" />
                    {localDateFrom
                      ? format(localDateFrom, "yyyy. MMM dd.", { locale: hu })
                      : "Dátum-tól"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={localDateFrom ?? undefined}
                    onSelect={(date) => {
                      setLocalDateFrom(date ?? null);
                    }}
                    disabled={localDateTo ? { after: localDateTo } : undefined}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              <span className="text-xs text-muted-foreground">–</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-7 text-xs px-2.5 justify-start font-normal",
                      hasLocalDateOverride && "bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20"
                    )}
                  >
                    <CalendarDays className="mr-1.5 h-3 w-3" />
                    {localDateTo
                      ? format(localDateTo, "yyyy. MMM dd.", { locale: hu })
                      : "Dátum-ig"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={localDateTo ?? undefined}
                    onSelect={(date) => {
                      setLocalDateTo(date ?? null);
                    }}
                    disabled={localDateFrom ? { before: localDateFrom } : undefined}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>

              {hasLocalDateOverride && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-amber-600"
                  onClick={() => { setLocalDateFrom(undefined); setLocalDateTo(undefined); }}
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Globális
                </Button>
              )}
            </div>

            {(hasActiveFilters || hasLocalDateOverride) && (
              <Button variant="ghost" size="sm" onClick={() => {
                clearFilters();
                setLocalDateFrom(undefined);
                setLocalDateTo(undefined);
              }}>
                <X className="h-4 w-4 mr-1" /> Szűrők törlése
              </Button>
            )}
          </div>

          <UnifiedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            className="mb-3"
          />

          {/* Table */}
          <div className="rounded-md border overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('delivery_date')}>
                    <span className="inline-flex items-center gap-1">
                      Dátum
                      {sortField === 'delivery_date' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Csomagszám</th>
                  <th className="px-3 py-2 text-left font-medium">Hivatkozás</th>
                  <th className="px-3 py-2 text-right font-medium cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('cod_amount')}>
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      Összeg
                      {sortField === 'cod_amount' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Címzett</th>
                  <th className="px-3 py-2 text-center font-medium">Tranzakció</th>
                  <th className="px-3 py-2 text-center font-medium">NAV Számla</th>
                  <th className="px-3 py-2 text-center font-medium">Státusz</th>
                  <th className="px-3 py-2 text-center font-medium">Művelet</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j} className="px-3 py-3">
                          <div className="h-4 bg-muted animate-pulse rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                      {hasActiveFilters ? 'Nincs találat a szűrőkkel' : 'Még nincsenek feltöltött riportok'}
                    </td>
                  </tr>
                ) : (
                  filteredReports.map(row => {
                    const isTotal = row.row_type === 'total' || row.match_status === 'total';
                    const statusCfg = STATUS_CONFIG[row.match_status] || STATUS_CONFIG.unmatched;
                    const StatusIcon = statusCfg.icon;
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-b hover:bg-muted/30 transition-colors',
                          isTotal ? 'bg-blue-50/50 dark:bg-blue-950/20 font-bold' : statusCfg.rowBg,
                        )}
                      >
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.delivery_date)}</td>
                        <td className="px-3 py-2 font-mono text-xs">{row.package_number || '-'}</td>
                        <td className="px-3 py-2 font-mono text-xs max-w-[180px] truncate" title={row.reference_number || ''}>
                          {row.reference_number || '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                          {formatAmount(row.cod_amount)}
                        </td>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={row.recipient_address || ''}>
                          {isTotal ? <span className="text-blue-600 font-bold">Összesítő (Total COD)</span> : (row.recipient_name || row.recipient_address || '-')}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.matched_transaction_id ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                          ) : (
                            <MinusCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isTotal ? (
                            <span className="text-muted-foreground">—</span>
                          ) : row.matched_nav_invoice_id ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                          ) : (
                            <MinusCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge variant="outline" className={cn('text-xs', statusCfg.color)}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusCfg.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => handleOpenDetails(row)}
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Számlák
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Párosított számlák és tranzakciók</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <UnifiedPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
            className="mt-3"
          />
        </CardContent>
      </Card>

      <CourierInvoiceDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        report={selectedReport}
        handleRematch={handleRematch}
        onManualMatch={handleSync}
      />
    </>
  );
};

export default CourierReportTab;
