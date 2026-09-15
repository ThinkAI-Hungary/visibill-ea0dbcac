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
import { RefreshCw, Search, X, CheckCircle2, AlertCircle, MinusCircle, Eye, FileText, Landmark, RotateCcw, Link2, Check, Sparkles, CalendarDays, ArrowUpDown, ArrowUp, ArrowDown, Trash2, TrendingUp, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getDateFnsLocale, formatDateLocale, formatCurrencyLocale } from '@/lib/locale/formatters';
import { useTranslation } from 'react-i18next';
import { useCourierReportData, type CourierReport } from '@/hooks/useCourierReportData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ReportFilesDialog } from '@/components/courier/ReportFilesDialog';
import { reportError } from '@/lib/errorReporter';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const REPORT_LABELS: Record<string, string> = {
  gls: 'GLS',
  mpl: 'MPL / Posta',
  mixpack: 'Mixpack',
};

function getStatusConfig(t: any): Record<string, {
  label: string;
  icon: typeof CheckCircle2;
  color: string;
  rowBg: string;
}> {
  return {
    full: {
      label: t('transactions:courier_tab.status.full', 'Párosított'),
      icon: CheckCircle2,
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      rowBg: 'bg-emerald-100/70 dark:bg-emerald-950/40',
    },
    partial_trx: {
      label: t('transactions:courier_tab.status.partial_trx', 'Tranzakció ✓'),
      icon: AlertCircle,
      color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      rowBg: 'bg-amber-100/60 dark:bg-amber-950/40',
    },
    partial_nav: {
      label: t('transactions:courier_tab.status.partial_nav', 'NAV ✓'),
      icon: AlertCircle,
      color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      rowBg: 'bg-amber-100/60 dark:bg-amber-950/40',
    },
    unmatched: {
      label: t('transactions:courier_tab.status.unmatched', 'Párosítatlan'),
      icon: MinusCircle,
      color: 'bg-red-500/10 text-red-600 border-red-500/20',
      rowBg: 'bg-rose-100/60 dark:bg-rose-950/30',
    },
    total: {
      label: t('transactions:courier_tab.status.total', 'Összesítő'),
      icon: FileText,
      color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      rowBg: 'bg-blue-50/50 dark:bg-blue-950/20',
    },
  };
}

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
  const { t } = useTranslation(['transactions', 'common']);
  const [details, setDetails] = useState<MatchDetails>({ transaction: null, navInvoice: null });
  const [loading, setLoading] = useState(false);
  const [showManualMatch, setShowManualMatch] = useState(false);
  const [availableInvoices, setAvailableInvoices] = useState<any[]>([]);
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedNavId, setSelectedNavId] = useState<string | null>(null);
  const [serverSearchResults, setServerSearchResults] = useState<any[]>([]);
  const [isSearchingServer, setIsSearchingServer] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !report) {
      setDetails({ transaction: null, navInvoice: null });
      setShowManualMatch(false);
      setSearch('');
      setSelectedNavId(null);
      setServerSearchResults([]);
      setIsSearchingServer(false);
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
      // Search NAV invoices in a ±21 day range around delivery date, prioritizing OUTBOUND (customer sales)
      let query = supabase
        .from('nav_invoices')
        .select('id, invoice_number, invoice_issue_date, supplier_name, customer_name, invoice_gross_amount, currency, invoice_direction')
        .eq('company_id', report.company_id)
        .eq('invoice_direction', 'OUTBOUND')
        .order('invoice_issue_date', { ascending: false })
        .limit(100);

      if (report.delivery_date) {
        const d = new Date(report.delivery_date);
        const from = new Date(d); from.setDate(from.getDate() - 21);
        const to = new Date(d); to.setDate(to.getDate() + 14);
        query = query.gte('invoice_issue_date', from.toISOString().slice(0, 10))
                     .lte('invoice_issue_date', to.toISOString().slice(0, 10));
      }

      const { data, error } = await query;
      if (error) throw error;
      setAvailableInvoices(data || []);
    } catch (err) {
      reportError({ type: 'db_query', component: 'CourierReportTab', action: 'error', message: 'Error fetching available invoices:', error: err });
    } finally {
      setLoadingAvailable(false);
    }
  };

  // Debounced server-side search for invoices by invoice number or partner name
  useEffect(() => {
    if (!report?.company_id) return;
    const term = search.trim();
    if (term.length < 2) {
      setServerSearchResults([]);
      setIsSearchingServer(false);
      return;
    }

    setIsSearchingServer(true);
    const timer = setTimeout(async () => {
      try {
        const cleanTerm = term.replace(/[%_]/g, '\\$&');
        const { data, error } = await supabase
          .from('nav_invoices')
          .select('id, invoice_number, invoice_issue_date, supplier_name, customer_name, invoice_gross_amount, currency, invoice_direction')
          .eq('company_id', report.company_id)
          .or(`invoice_number.ilike.%${cleanTerm}%,customer_name.ilike.%${cleanTerm}%,supplier_name.ilike.%${cleanTerm}%`)
          .order('invoice_issue_date', { ascending: false })
          .limit(50);
        if (!error && data) {
          setServerSearchResults(data);
        }
      } catch (err) {
        console.error('Server search error in CourierInvoiceDialog:', err);
      } finally {
        setIsSearchingServer(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [search, report?.company_id]);

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
      toast({ title: t('transactions:courier_tab.dialog.toast_match_success', 'Számla párosítva!') });
      onManualMatch();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: t('transactions:courier_tab.dialog.toast_error', 'Hiba'), description: err.message, variant: 'destructive' });
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
      toast({ title: t('transactions:courier_tab.dialog.toast_unmatch_success', 'Párosítás megszüntetve!') });
      onManualMatch();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: t('transactions:courier_tab.dialog.toast_error', 'Hiba'), description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const [showUnmatchOptions, setShowUnmatchOptions] = useState(false);

  const filteredInvoices = useMemo(() => {
    const combined: any[] = [];
    const seen = new Set<string>();

    serverSearchResults.forEach(inv => {
      if (!seen.has(inv.id)) {
        seen.add(inv.id);
        combined.push(inv);
      }
    });

    const s = search.toLowerCase().trim();
    availableInvoices.forEach(inv => {
      if (!seen.has(inv.id)) {
        if (!s) {
          seen.add(inv.id);
          combined.push(inv);
        } else {
          const matches =
            inv.invoice_number?.toLowerCase().includes(s) ||
            inv.supplier_name?.toLowerCase().includes(s) ||
            inv.customer_name?.toLowerCase().includes(s) ||
            inv.invoice_gross_amount?.toString().includes(s);
          if (matches) {
            seen.add(inv.id);
            combined.push(inv);
          }
        }
      }
    });

    return combined;
  }, [availableInvoices, serverSearchResults, search]);

  const formatAmount = (amount: number | null, currency?: string) => {
    if (amount == null) return '-';
    return formatCurrencyLocale(amount, currency);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return formatDateLocale(date);
  };

  if (!report) return null;
  const isCompensation = report.row_type === 'compensation' || (!!report.match_reason && report.match_reason.toLowerCase().includes('kompenzáció'));
  const statusConfig = getStatusConfig(t);
  const statusCfg = statusConfig[report.match_status] || statusConfig.unmatched;
  const codAmount = Math.abs(report.cod_amount ?? 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            {isCompensation ? t('transactions:courier_tab.dialog.title_compensation', 'Kompenzációs értesítő részletei') : t('transactions:courier_tab.dialog.title_report', 'Riport sor részletei')}
          </DialogTitle>
          <DialogDescription>
            {isCompensation
              ? t('transactions:courier_tab.dialog.desc_compensation', { number: report.package_number || '-', date: formatDate(report.delivery_date), defaultValue: `Számlaszám: ${report.package_number || '-'} — ${formatDate(report.delivery_date)}` })
              : t('transactions:courier_tab.dialog.desc_report', { number: report.package_number || '-', date: formatDate(report.delivery_date), defaultValue: `Csomagszám: ${report.package_number || '-'} — ${formatDate(report.delivery_date)}` })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          {isCompensation && details.navInvoice && (
            <div className="rounded-lg bg-purple-500/10 border border-purple-500/30 p-3 text-xs text-purple-900 dark:text-purple-200 flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-purple-600 dark:text-purple-400" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-semibold text-purple-950 dark:text-purple-100">
                  {t('transactions:courier_tab.dialog.comp_banner_title', 'GLS Utánvét-kompenzáció (Beszámítás)')}
                </p>
                <p>
                  {t('transactions:courier_tab.dialog.comp_banner_text', {
                    number: details.navInvoice.invoice_number,
                    amount: formatAmount(details.navInvoice.invoice_gross_amount, details.navInvoice.currency),
                    defaultValue: `A futárcég a beszedett utánvétekből kompenzálta ezt a kiállított fuvardíjszámlát (${details.navInvoice.invoice_number}, ${formatAmount(details.navInvoice.invoice_gross_amount, details.navInvoice.currency)}). A számla a számlalistában automatikusan kiegyenlítettként szerepel.`,
                  })}
                </p>
              </div>
            </div>
          )}

          {/* Report row info */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">
                {isCompensation ? t('transactions:courier_tab.dialog.report_data_title_comp', 'Kompenzációs értesítő adatai') : t('transactions:courier_tab.dialog.report_data_title', 'Riport adatok')}
              </h4>
              <Badge variant="outline" className={cn('text-xs ml-auto', statusCfg.color)}>
                {statusCfg.label}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <div className="text-muted-foreground">{isCompensation ? t('transactions:courier_tab.dialog.company_involved', 'Érintett cég') : t('transactions:courier_tab.dialog.recipient', 'Címzett')}</div>
              <div className="font-medium">{report.recipient_name || '-'}</div>
              <div className="text-muted-foreground">{isCompensation ? t('transactions:courier_tab.dialog.compensated_invoice', 'Kompenzált számla') : t('transactions:courier_tab.dialog.reference', 'Hivatkozás')}</div>
              <div className="font-mono text-xs font-semibold">{report.package_number || report.reference_number || '-'}</div>
              <div className="text-muted-foreground">{isCompensation ? t('transactions:courier_tab.dialog.comp_pool_amount', 'Kompenzációs keretösszeg') : t('transactions:courier_tab.dialog.cod_amount', 'Utánvét összeg')}</div>
              <div className="font-semibold">{formatAmount(report.cod_amount)}</div>
            </div>
            {/* AI match reason */}
            {report.match_reason && (
              <div className="mt-2 pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-medium text-muted-foreground">{t('transactions:courier_tab.dialog.ai_reason_title', 'AI párosítási indoklás')}</span>
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
                      {t('transactions:courier_tab.dialog.confidence', { percent: Math.round(report.match_confidence * 100), defaultValue: `${Math.round(report.match_confidence * 100)}% konfidencia` })}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] bg-muted/50 p-2 rounded border border-border/30 text-muted-foreground leading-relaxed">
                  {report.match_reason}
                </p>
              </div>
            )}
          </div>

          {/* Status explanation notice for partial matches */}
          {report.match_status === 'partial_nav' && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  {t('transactions:courier_tab.dialog.status_partial_nav_title', 'NAV számla párosítva · Banki tranzakcióra vár')}
                </p>
                <p>
                  {t('transactions:courier_tab.dialog.status_partial_nav_desc', 'A csomag sikeresen össze van kötve a kiállított NAV számlával. A tétel teljes (zöld) státuszához a futárcég banki gyűjtőjóváírása szükséges.')}
                </p>
                <p className="text-[11px] opacity-90">
                  {t('transactions:courier_tab.dialog.status_partial_nav_tip', 'Tipp: Ha a számlát banki kivonattól függetlenül szeretnéd lezárni, a Számlák menüpontban a számlát lenyitva a „Kézi fizetés” gombbal rögzítheted a kiegyenlítést.')}
                </p>
              </div>
            </div>
          )}
          {report.match_status === 'partial_trx' && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1 leading-relaxed">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  {t('transactions:courier_tab.dialog.status_partial_trx_title', 'Banki tranzakció párosítva · NAV számlára vár')}
                </p>
                <p>
                  {t('transactions:courier_tab.dialog.status_partial_trx_desc', 'A banki utalás párosítva van a csomaghoz. A teljes (zöld) lezáráshoz válaszd ki a hozzá tartozó kiállított NAV számlát a „Számla párosítása” gombra kattintva.')}
                </p>
              </div>
            </div>
          )}

          {/* Matched transaction */}
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Landmark className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold text-sm">{t('transactions:courier_tab.dialog.trx_title', 'Párosított tranzakció')}</h4>
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
                <div className="text-muted-foreground">{t('transactions:courier_tab.dialog.trx_date', 'Dátum')}</div>
                <div>{formatDate(details.transaction.transaction_date)}</div>
                <div className="text-muted-foreground">{t('transactions:courier_tab.dialog.trx_desc', 'Leírás')}</div>
                <div className="truncate max-w-[200px]" title={details.transaction.description}>{details.transaction.description || '-'}</div>
                <div className="text-muted-foreground">{t('transactions:courier_tab.dialog.trx_amount', 'Összeg')}</div>
                <div className="font-semibold">{formatAmount(details.transaction.amount, details.transaction.currency)}</div>
                <div className="text-muted-foreground">{t('transactions:courier_tab.dialog.trx_type', 'Típus')}</div>
                <div>{details.transaction.type || '-'}</div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t('transactions:courier_tab.dialog.trx_none', 'Nincs párosított tranzakció')}</p>
            )}
          </div>

          {/* Matched NAV invoice (when not in manual match mode) */}
          {!showManualMatch && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-semibold text-sm">{t('transactions:courier_tab.dialog.nav_title', 'Párosított NAV számla')}</h4>
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
                  <div className="text-muted-foreground">{t('transactions:courier_tab.dialog.nav_number', 'Számlaszám')}</div>
                  <div className="font-mono text-xs">{details.navInvoice.invoice_number}</div>
                  <div className="text-muted-foreground">{t('transactions:courier_tab.dialog.nav_date', 'Dátum')}</div>
                  <div>{formatDate(details.navInvoice.invoice_issue_date)}</div>
                  <div className="text-muted-foreground">{t('transactions:courier_tab.dialog.nav_partner', 'Partner')}</div>
                  <div>{details.navInvoice.invoice_direction === 'INBOUND' ? (details.navInvoice.supplier_name || '-') : (details.navInvoice.customer_name || '-')}</div>
                  <div className="text-muted-foreground">{t('transactions:courier_tab.dialog.nav_gross', 'Bruttó összeg')}</div>
                  <div className="font-semibold">{formatAmount(details.navInvoice.invoice_gross_amount, details.navInvoice.currency)}</div>
                  <div className="text-muted-foreground">{t('transactions:courier_tab.dialog.nav_direction', 'Irány')}</div>
                  <div><Badge variant="outline" className="text-xs">{details.navInvoice.invoice_direction === 'INBOUND' ? t('transactions:courier_tab.dialog.nav_inbound', 'Bejövő') : t('transactions:courier_tab.dialog.nav_outbound', 'Kimenő')}</Badge></div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{t('transactions:courier_tab.dialog.nav_none', 'Nincs párosított NAV számla')}</p>
              )}
            </div>
          )}

          {/* Manual match picker */}
          {showManualMatch && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm flex items-center gap-1.5">
                  <Link2 className="h-4 w-4" />
                  {report.matched_nav_invoice_id ? t('transactions:courier_tab.dialog.manual_title_change', 'Másik NAV számla') : t('transactions:courier_tab.dialog.manual_title_link', 'NAV számla párosítás')}
                </h4>
                {report.matched_nav_invoice_id && (
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowManualMatch(false)}>
                    {t('transactions:courier_tab.dialog.back', 'Vissza')}
                  </Button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder={t('transactions:courier_tab.dialog.search_placeholder', 'Keresés számlaszám, partner, összeg...')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-8 h-8 text-xs"
                />
                {isSearchingServer && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="max-h-[180px] overflow-y-auto border rounded-md">
                {loadingAvailable ? (
                  <div className="flex items-center justify-center h-16">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                  </div>
                ) : filteredInvoices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-16 text-muted-foreground">
                    <FileText className="h-4 w-4 mb-1" />
                    <p className="text-xs">{t('transactions:courier_tab.dialog.no_invoices', 'Nincs elérhető számla a megadott keresésre vagy időszakban')}</p>
                  </div>
                ) : (
                  <div className="p-1.5 space-y-1">
                    {filteredInvoices.map(inv => {
                      const isSelected = selectedNavId === inv.id;
                      const isExact = Math.abs((inv.invoice_gross_amount ?? 0) - codAmount) <= 2.5;
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
                              {isExact && <Badge variant="outline" className="text-[9px] h-4 border-emerald-500/40 text-emerald-600">{t('transactions:courier_tab.dialog.exact_amount', 'Egyező összeg')}</Badge>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="pt-2">
                <Button
                  size="sm"
                  className="w-full text-xs h-8"
                  disabled={!selectedNavId || saving}
                  onClick={handleSaveMatch}
                >
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                  {saving ? t('transactions:courier_tab.dialog.saving', 'Mentés...') : selectedNavId ? t('transactions:courier_tab.dialog.save_match', 'Párosítás mentése') : t('transactions:courier_tab.dialog.select_invoice_hint', 'Válassz ki egy számlát a párosításhoz')}
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {report.match_status !== 'total' && (
            <div className="space-y-2 pt-2 border-t">
              {/* Unmatch options */}
              {showUnmatchOptions && !showManualMatch && (report.matched_nav_invoice_id || report.matched_transaction_id) && (
                <div className="rounded-md border p-2 space-y-1.5 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('transactions:courier_tab.dialog.unmatch_prompt', 'Melyik párosítást szeretnéd megszüntetni?')}</p>
                  {report.matched_transaction_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs h-7"
                      disabled={saving}
                      onClick={() => handleUnmatch('trx')}
                    >
                      <Landmark className="h-3 w-3 mr-1.5" />
                      {t('transactions:courier_tab.dialog.unmatch_trx', 'Tranzakció párosítás törlése')}
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
                      {t('transactions:courier_tab.dialog.unmatch_nav', 'NAV számla párosítás törlése')}
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
                      {t('transactions:courier_tab.dialog.unmatch_both', 'Mindkettő törlése')}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="w-full text-xs h-6" onClick={() => setShowUnmatchOptions(false)}>
                    {t('transactions:courier_tab.dialog.cancel', 'Mégse')}
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
                    {t('transactions:courier_tab.dialog.unmatch_btn', 'Párosítás megszüntetése')}
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
                    {report.matched_nav_invoice_id ? t('transactions:courier_tab.dialog.change_invoice_btn', 'Másik számla választása') : t('transactions:courier_tab.dialog.link_invoice_btn', 'Számla párosítása')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={async () => { await handleRematch(report.id); onOpenChange(false); }}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  {t('transactions:courier_tab.dialog.auto_match_btn', 'Auto párosítás')}
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
  const { t } = useTranslation(['transactions', 'common']);
  const statusConfig = getStatusConfig(t);

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
    handleRematchAll,
    rematchingAll,
    handleDelete,
  } = useCourierReportData(reportType, localDateFrom, localDateTo);

  // Selection state for bulk delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Only non-total rows are selectable
  const selectableReports = filteredReports;

  const allSelected = selectableReports.length > 0 && selectableReports.every(r => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableReports.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    await handleDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  };

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
        <p className="text-muted-foreground">{t('courier_tab.dialog.select_company_prompt', 'Válassz egy céget a folytatáshoz')}</p>
      </div>
    );
  }

  const formatAmount = (amount: number | null, currency = 'HUF') => {
    if (amount == null) return '-';
    return formatCurrencyLocale(amount, currency);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return formatDateLocale(date);
  };

  return (
    <>
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-4 print:hidden animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
          <div className="bg-primary/10 text-primary p-2 rounded-lg">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums">{totalCount.toLocaleString(getDateFnsLocale().code)}</div>
            <div className="text-[11px] text-muted-foreground">{t('courier_tab.kpis.total_items', 'Összes tétel')}</div>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
          <div className="bg-emerald-500/10 text-emerald-600 p-2 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums text-emerald-600">{stats.matched.toLocaleString(getDateFnsLocale().code)}</div>
            <div className="text-[11px] text-muted-foreground">{t('courier_tab.kpis.matched', 'Párosított')}</div>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
          <div className="bg-amber-500/10 text-amber-600 p-2 rounded-lg">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums text-amber-600">{stats.partial.toLocaleString(getDateFnsLocale().code)}</div>
            <div className="text-[11px] text-muted-foreground">{t('courier_tab.kpis.partial', 'Részleges')}</div>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
          <div className="bg-red-500/10 text-red-500 p-2 rounded-lg">
            <MinusCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums text-red-500">{stats.unmatched.toLocaleString(getDateFnsLocale().code)}</div>
            <div className="text-[11px] text-muted-foreground">{t('courier_tab.kpis.unmatched', 'Párosítatlan')}</div>
          </div>
        </div>
        <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
          <div className="bg-emerald-500/10 text-emerald-600 p-2 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-lg font-bold tabular-nums text-emerald-600">{formatAmount(stats.total)}</div>
            <div className="text-[11px] text-muted-foreground">{t('courier_tab.kpis.total_cod', 'Összes utánvét')}</div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold">
                {t('courier_tab.card_title', { report: REPORT_LABELS[reportType] || reportType.toUpperCase(), defaultValue: `${REPORT_LABELS[reportType]} Riportok` })}
              </CardTitle>
              <CardDescription>
                {t('courier_tab.card_desc', { totalCount, matched: stats.matched, partial: stats.partial, unmatched: stats.unmatched, defaultValue: `${totalCount} sor — Párosított: ${stats.matched} | Részleges: ${stats.partial} | Párosítatlan: ${stats.unmatched}` })}
                {stats.total > 0 && t('courier_tab.card_desc_total', { total: formatAmount(stats.total), defaultValue: ` — Összesen: ${formatAmount(stats.total)}` })}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={handleSync}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {t('courier_tab.actions.refresh', 'Frissítés')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('courier_tab.actions.refresh_tooltip', 'Riport adatok frissítése')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRematchAll}
                      disabled={rematchingAll}
                      className="border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    >
                      <Sparkles className={cn("h-4 w-4 mr-2", rematchingAll && "animate-spin")} />
                      {rematchingAll ? t('courier_tab.actions.rematching', 'Párosítás...') : t('courier_tab.actions.rematch_all', 'Újrapárosítás')}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('courier_tab.actions.rematch_tooltip', 'Összes nyitott tétel automatikus újrapárosítása banki tranzakciókkal és NAV számlákkal')}</TooltipContent>
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
                placeholder={t('courier_tab.filters.search_placeholder', 'Keresés (hivatkozás, csomagszám, címzett...)')}
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
                <SelectValue placeholder={t('courier_tab.filters.status_placeholder', 'Státusz')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('courier_tab.filters.status_all', 'Összes státusz')}</SelectItem>
                <SelectItem value="full">{statusConfig.full.label}</SelectItem>
                <SelectItem value="partial_trx">{statusConfig.partial_trx.label}</SelectItem>
                <SelectItem value="partial_nav">{statusConfig.partial_nav.label}</SelectItem>
                <SelectItem value="unmatched">{statusConfig.unmatched.label}</SelectItem>
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
                      ? format(localDateFrom, "yyyy. MMM dd.", { locale: getDateFnsLocale() })
                      : t('courier_tab.filters.date_from', 'Dátum-tól')}
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
                      ? format(localDateTo, "yyyy. MMM dd.", { locale: getDateFnsLocale() })
                      : t('courier_tab.filters.date_to', 'Dátum-ig')}
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
                  <X className="h-3.5 w-3.5 mr-1" /> {t('courier_tab.filters.global', 'Globális')}
                </Button>
              )}
            </div>

            {(hasActiveFilters || hasLocalDateOverride) && (
              <Button variant="ghost" size="sm" onClick={() => {
                clearFilters();
                setLocalDateFrom(undefined);
                setLocalDateTo(undefined);
              }}>
                <X className="h-4 w-4 mr-1" /> {t('courier_tab.filters.clear_filters', 'Szűrők törlése')}
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

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <span className="text-sm font-medium">
                {t('courier_tab.bulk.selected_count', { count: selectedIds.size, defaultValue: `${selectedIds.size} sor kijelölve` })}
              </span>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                {t('courier_tab.bulk.delete', 'Törlés')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs ml-auto"
                onClick={() => setSelectedIds(new Set())}
              >
                {t('courier_tab.bulk.clear_selection', 'Kijelölés törlése')}
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="rounded-md border overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-2 py-2 text-center w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-3 py-2 text-left font-medium cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('delivery_date')}>
                    <span className="inline-flex items-center gap-1">
                      {t('courier_tab.table.col_date', 'Dátum')}
                      {sortField === 'delivery_date' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">{t('courier_tab.table.col_package', 'Csomagszám / Bizonylat')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('courier_tab.table.col_ref', 'Hivatkozás')}</th>
                  <th className="px-3 py-2 text-right font-medium cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => handleSort('cod_amount')}>
                    <span className="inline-flex items-center justify-end gap-1 w-full">
                      {t('courier_tab.table.col_amount', 'Összeg')}
                      {sortField === 'cod_amount' ? (
                        sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </span>
                  </th>
                  <th className="px-3 py-2 text-left font-medium">{t('courier_tab.table.col_recipient', 'Címzett / Partner')}</th>
                  <th className="px-3 py-2 text-center font-medium">{t('courier_tab.table.col_transaction', 'Tranzakció')}</th>
                  <th className="px-3 py-2 text-center font-medium">{t('courier_tab.table.col_nav_invoice', 'NAV Számla')}</th>
                  <th className="px-3 py-2 text-center font-medium">{t('courier_tab.table.col_status', 'Státusz')}</th>
                  <th className="px-3 py-2 text-center font-medium">{t('courier_tab.table.col_action', 'Művelet')}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-3 py-3">
                          <div className="h-4 bg-muted animate-pulse rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                      {hasActiveFilters ? t('courier_tab.table.empty_filtered', 'Nincs találat a szűrőkkel') : t('courier_tab.table.empty_no_data', 'Még nincsenek feltöltött riportok')}
                    </td>
                  </tr>
                ) : (
                  filteredReports.map(row => {
                    const isTotal = row.row_type === 'total' || row.match_status === 'total';
                    const isCompensation = row.row_type === 'compensation' || (!!row.match_reason && row.match_reason.toLowerCase().includes('kompenzáció'));
                    const statusCfg = statusConfig[row.match_status] || statusConfig.unmatched;
                    const StatusIcon = statusCfg.icon;
                    return (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-b hover:bg-muted/30 transition-colors',
                          isTotal ? 'bg-blue-50/50 dark:bg-blue-950/20 font-bold' : 
                          isCompensation ? 'bg-purple-50/35 dark:bg-purple-950/20' : statusCfg.rowBg,
                        )}
                      >
                      <td className="px-2 py-2 text-center">
                            <Checkbox
                              checked={selectedIds.has(row.id)}
                              onCheckedChange={() => toggleSelect(row.id)}
                            />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.delivery_date)}</td>
                        <td className="px-3 py-2">
                          {isCompensation ? (
                            <div className="flex flex-col gap-1 items-start">
                              <Badge 
                                variant="outline" 
                                className="text-[10px] px-1.5 py-0 h-4 bg-purple-100/90 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border-purple-300 dark:border-purple-700 font-medium"
                              >
                                {t('courier_tab.table.compensation', 'Kompenzáció')}
                              </Badge>
                              <span className="font-mono text-xs font-semibold text-foreground flex items-center gap-1" title="Kompenzált számlaszám">
                                <FileText className="h-3 w-3 text-purple-600 dark:text-purple-400 shrink-0" />
                                {row.package_number || '-'}
                              </span>
                            </div>
                          ) : (
                            <span className="font-mono text-xs">{row.package_number || '-'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs max-w-[180px] truncate" title={row.reference_number || ''}>
                          {isCompensation && (!row.reference_number || row.reference_number === row.package_number) ? (
                            <span className="text-muted-foreground text-[11px] italic">{t('courier_tab.table.offset_invoice', 'Beszámított számla')}</span>
                          ) : (
                            row.reference_number || '-'
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                          {isCompensation && row.matched_nav_invoice?.invoice_gross_amount ? (
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-semibold text-foreground">
                                {formatAmount(row.matched_nav_invoice.invoice_gross_amount, row.matched_nav_invoice.currency || 'HUF')}
                              </span>
                              <span className="text-[10px] text-muted-foreground" title={`A futárcég által beszedett ${formatAmount(row.cod_amount)} utánvét-keretből beszámítva`}>
                                {t('courier_tab.table.from_frame', { amount: formatAmount(row.cod_amount), defaultValue: `keretből: ${formatAmount(row.cod_amount)}` })}
                              </span>
                            </div>
                          ) : (
                            formatAmount(row.cod_amount)
                          )}
                        </td>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={row.recipient_address || row.recipient_name || ''}>
                          {isTotal ? (
                            <span className="text-blue-600 font-bold">{t('courier_tab.table.total_cod', 'Összesítő (Total COD)')}</span>
                          ) : isCompensation ? (
                            <div className="flex flex-col">
                              <span className="text-xs font-medium truncate">
                                {row.matched_nav_invoice?.supplier_name || 'GLS General Logistics'}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate">
                                {row.recipient_name ? t('courier_tab.table.offset_with_name', { name: row.recipient_name, defaultValue: `Beszámítás: ${row.recipient_name}` }) : t('courier_tab.table.offset_general', 'Beszámítás (Kompenzálás)')}
                              </span>
                            </div>
                          ) : (
                            row.recipient_name || row.recipient_address || '-'
                          )}
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
                                  {t('courier_tab.table.details', 'Részletek')}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('courier_tab.table.details_tooltip', 'Párosított számlák és tranzakciók megtekintése, szerkesztése')}</TooltipContent>
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

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('courier_tab.dialog.delete_confirm_title', 'Biztosan törölni szeretnéd?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('courier_tab.dialog.delete_confirm_desc', { count: selectedIds.size, defaultValue: `${selectedIds.size} riport sor véglegesen törlésre kerül. Ez a művelet nem vonható vissza.` })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('courier_tab.dialog.delete_confirm_cancel', 'Mégse')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('courier_tab.dialog.delete_confirm_action', 'Törlés')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CourierReportTab;
