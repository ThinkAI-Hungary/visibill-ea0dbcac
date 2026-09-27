import { useState, useMemo } from 'react';
import { useScopedNavigate } from '@/lib/navigation';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  CreditCard,
  FileQuestion,
  Upload,
  ArrowDownLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Receipt,
  FileCheck2,
} from 'lucide-react';
import { format } from 'date-fns';
import { getDateFnsLocale, getActiveLocale } from '@/lib/locale/formatters';
import { cn, formatCurrency } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

interface NavInvoice {
  id: string;
  invoice_number: string;
  invoice_issue_date: string | null;
  invoice_delivery_date: string | null;
  supplier_tax_number: string | null;
  supplier_name: string | null;
  invoice_net_amount: number | null;
  invoice_gross_amount: number | null;
  invoice_vat_amount: number | null;
  currency: string | null;
  transaction_id: string | null;
  submitted: boolean | null;
}

interface Partner {
  tax_number: string;
  name: string;
}

const fetchAllInboundInvoices = async (companyId: string, mode: 'payable' | 'missing') => {
  if (mode === 'payable') {
    const PAGE_SIZE = 1000;
    const items: NavInvoice[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabase.rpc('get_filtered_nav_invoices', {
        p_company_id: companyId,
        p_date_from: '1970-01-01',
        p_date_to: '2099-12-31',
        p_direction: 'INBOUND',
        p_kpi_filter: 'unmatched',
        p_page: page,
        p_page_size: PAGE_SIZE,
      });
      if (error) throw error;
      const rows = (data || []) as unknown as NavInvoice[];
      items.push(...rows);
      if (rows.length < PAGE_SIZE) break;
      page++;
    }
    const nonZero = items.filter((inv) => Math.abs(Number(inv.invoice_gross_amount) || 0) > 0);
    nonZero.sort((a, b) => (b.invoice_issue_date || '').localeCompare(a.invoice_issue_date || ''));
    return nonZero;
  }

  const PAGE_SIZE = 1000;
  const all: NavInvoice[] = [];
  let from = 0;

  while (true) {
    const query = supabase
      .from('nav_invoices')
      .select('id, invoice_number, invoice_issue_date, invoice_delivery_date, supplier_tax_number, supplier_name, invoice_net_amount, invoice_gross_amount, invoice_vat_amount, currency, transaction_id, submitted')
      .eq('company_id', companyId)
      .eq('invoice_direction', 'INBOUND')
      .or('submitted.is.null,submitted.eq.false')
      .order('invoice_issue_date', { ascending: false });

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;

    const page = (data || []) as NavInvoice[];
    all.push(...page);

    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  // 1. Filter out 0 Ft invoices (stornos / administrative adjustments where no voucher is expected)
  const nonZero = all.filter((inv) => Math.abs(Number(inv.invoice_gross_amount) || 0) > 0);

  // 2. Cross-check against uploaded invoices to eliminate false-positives caused by OCR or whitespace differences
  const { data: uploadedRows, error: uploadedError } = await supabase
    .from('invoices')
    .select('bizonylatsorszam')
    .eq('company_id', companyId);

  if (uploadedError) {
    console.error('Error fetching uploaded invoices for cross-check:', uploadedError);
    return nonZero;
  }

  const normalizeInv = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const uploadedSet = new Set(
    (uploadedRows || [])
      .map((r) => normalizeInv(r.bizonylatsorszam || ''))
      .filter(Boolean)
  );

  const strictlyMissing = nonZero.filter(
    (inv) => !uploadedSet.has(normalizeInv(inv.invoice_number || ''))
  );

  return strictlyMissing;
};

const InvoiceStatusTables = () => {
  const { t } = useTranslation(['dashboard', 'common']);
  const scopedNavigate = useScopedNavigate();
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<'payable' | 'missing'>('payable');
  const [visibleCount, setVisibleCount] = useState(25);

  const companyId = selectedCompany?.id;

  const { data: payableInvoices = [], isLoading: loadingPayable } = useQuery({
    queryKey: ['invoiceStatusPayable', companyId],
    queryFn: () => fetchAllInboundInvoices(companyId!, 'payable'),
    enabled: !!companyId,
  });

  const { data: missingInvoices = [], isLoading: loadingMissing } = useQuery({
    queryKey: ['invoiceStatusMissing', companyId],
    queryFn: () => fetchAllInboundInvoices(companyId!, 'missing'),
    enabled: !!companyId,
  });

  const { data: partners = [] } = useQuery({
    queryKey: ['invoiceStatusPartners', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('tax_number, name')
        .eq('company_id', companyId!);
      if (error) throw error;
      return (data || []) as Partner[];
    },
    enabled: !!companyId,
  });

  const loading = loadingPayable || loadingMissing;

  const getPartnerName = (taxNumber: string | null, fallbackName: string | null): string => {
    if (fallbackName && fallbackName.trim() !== '') return fallbackName;
    if (!taxNumber) return '-';
    const partner = partners.find((p) => p.tax_number === taxNumber);
    return partner?.name || taxNumber;
  };

  const isHr = getActiveLocale() === 'hr';
  const dateFormatPattern = isHr ? 'dd.MM.yyyy.' : 'yyyy. MM. dd.';

  const payableTotal = useMemo(
    () => payableInvoices.reduce((sum, inv) => sum + (inv.invoice_gross_amount || 0), 0),
    [payableInvoices]
  );
  const missingCount = missingInvoices.length;

  const activeInvoices = activeTab === 'payable' ? payableInvoices : missingInvoices;

  return (
    <Card className="h-[520px] flex flex-col overflow-hidden border-border/80 shadow-card">
      {/* Header matching 3-card grid visual rhythm */}
      <CardHeader className="px-5 py-3.5 border-b border-border/40 shrink-0 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold leading-tight text-foreground">
                {t('dashboard:inbound_status.title', 'Bejövő számlák állapota')}
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {t('dashboard:inbound_status.description', 'Fizetési kötelezettségek & hiányzó bizonylatok')}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs font-medium"
            onClick={() => scopedNavigate(activeTab === 'missing' ? 'upload' : 'invoices')}
          >
            {activeTab === 'missing'
              ? t('dashboard:inbound_status.submit', 'Beküldés')
              : t('dashboard:inbound_status.view_invoices', 'Számlák')}
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* Modern pill tab switcher with badge count pills */}
      <div className="px-4 pt-2.5 pb-2 shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-lg">
          <button
            type="button"
            data-tab="payable"
            onClick={() => {
              setActiveTab('payable');
              setVisibleCount(25);
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
              activeTab === 'payable'
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>{t('dashboard:inbound_status.payable', 'Fizetendő')}</span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-semibold",
                activeTab === 'payable'
                  ? "bg-destructive/10 text-destructive"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {payableInvoices.length}
            </span>
          </button>
          <button
            type="button"
            data-tab="missing"
            onClick={() => {
              setActiveTab('missing');
              setVisibleCount(25);
            }}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
              activeTab === 'missing'
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileQuestion className="h-3.5 w-3.5" />
            <span>{t('dashboard:inbound_status.missing', 'Hiányzó')}</span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-semibold",
                missingCount > 0
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {missingCount}
            </span>
          </button>
        </div>
      </div>

      {/* Stat Strip: Financial highlights */}
      <div className="px-4 py-2 border-y border-border/30 bg-muted/20 shrink-0 flex items-center justify-between text-xs">
        {activeTab === 'payable' ? (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">
                {t('dashboard:inbound_status.payable_amount', 'Fizetendő összeg:')}
              </span>
              <span className="font-semibold text-destructive tabular-nums">
                {formatCurrency(payableTotal)}
              </span>
            </div>
            <span className="text-muted-foreground text-[11px] tabular-nums">
              {payableInvoices.length} {t('dashboard:inbound_status.more_invoices_count', 'db számla')}
            </span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">
                {t('dashboard:inbound_status.missing_notice_label', 'Beküldésre vár:')}
              </span>
              <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                {missingCount} {t('dashboard:inbound_status.pieces', 'db számlakép')}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => scopedNavigate('upload')}
              className="h-6 px-2 text-[11px] gap-1 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              <Upload className="h-3 w-3" />
              {t('dashboard:inbound_status.submit', 'Beküldés')}
            </Button>
          </>
        )}
      </div>

      {/* Scrollable List Body */}
      <CardContent className="flex-1 p-0 pb-1 overflow-hidden min-h-0">
        {loading ? (
          <div className="h-full flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activeInvoices.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
            <FileCheck2 className="h-10 w-10 mx-auto mb-2 opacity-30 text-success" />
            <p className="text-sm font-semibold text-foreground">
              {t('dashboard:inbound_status.empty', 'Nincs megjeleníthető számla')}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
              {t('dashboard:inbound_status.empty_desc', 'Minden bejövő számla rendezve van vagy nem érkezett új tétel.')}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-full px-3 py-1 [&>div>div[style]]:!block">
            <div className="divide-y divide-border/30 w-full min-w-0 pb-1">
              {activeInvoices.slice(0, visibleCount).map((inv) => {
                const partnerName = getPartnerName(inv.supplier_tax_number, inv.supplier_name);
                const isMissingTab = activeTab === 'missing';

                return (
                  <div
                    key={inv.id}
                    onClick={() => {
                      if (isMissingTab) {
                        scopedNavigate('upload');
                      } else {
                        scopedNavigate(`invoices/inbound_nav?invoice=${inv.id}`);
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between py-2 px-1.5 sm:px-2 rounded-lg hover:bg-muted/40 transition-colors group cursor-pointer w-full max-w-full overflow-hidden gap-2",
                      isMissingTab && "bg-amber-500/[0.03] dark:bg-amber-950/[0.15]"
                    )}
                  >
                    {/* Left: Direction / Status Icon & metadata */}
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-xs font-semibold transition-transform group-hover:scale-105",
                          "bg-info-subtle text-info border border-info/20"
                        )}
                        title={t('common:labels.inbound', 'Bejövő számla')}
                      >
                        <ArrowDownLeft className="h-3.5 w-3.5" />
                      </div>

                      <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
                          <span className="font-semibold text-xs sm:text-sm truncate text-foreground group-hover:text-primary transition-colors block">
                            {inv.invoice_number}
                          </span>
                        </div>
                        <p
                          className="text-xs text-muted-foreground truncate w-full block"
                          title={`${partnerName}${inv.supplier_tax_number ? ` • ${inv.supplier_tax_number}` : ''}`}
                        >
                          <span>{partnerName}</span>
                          {inv.supplier_tax_number && (
                            <span className="opacity-70"> • {inv.supplier_tax_number}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Gross amount, Date & Action CTA */}
                    <div className="shrink-0 text-right ml-auto flex items-center gap-2">
                      <div className="flex flex-col items-end">
                        <span className="text-xs sm:text-sm font-semibold tabular-nums text-destructive">
                          -{formatCurrency(Math.abs(inv.invoice_gross_amount || 0), inv.currency || undefined)}
                        </span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {inv.invoice_issue_date
                            ? format(new Date(inv.invoice_issue_date), dateFormatPattern, { locale: getDateFnsLocale() })
                            : '-'}
                        </span>
                      </div>

                      {isMissingTab && (
                        <Button
                          size="sm"
                          className="h-7 px-2 text-xs font-medium gap-1 bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700 shadow-sm shrink-0 transition-all opacity-90 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            scopedNavigate('upload');
                          }}
                        >
                          <Upload className="h-3 w-3" />
                          <span className="hidden sm:inline">
                            {t('dashboard:inbound_status.submit', 'Feltöltés')}
                          </span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* Card Footer */}
      <div className="px-4 py-2.5 border-t border-border/40 bg-muted/15 shrink-0 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {activeInvoices.length > visibleCount ? (
            <button
              type="button"
              className="hover:text-foreground font-medium underline underline-offset-2 transition-colors"
              onClick={() => setVisibleCount((prev) => prev + 25)}
            >
              {t('dashboard:inbound_status.more_invoices', {
                count: activeInvoices.length - visibleCount,
                defaultValue: `+ ${activeInvoices.length - visibleCount} további számla`,
              })}
            </button>
          ) : (
            `${activeInvoices.length} ${t('dashboard:inbound_status.items', 'db számla')}`
          )}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary-subtle gap-1 font-medium"
          onClick={() => scopedNavigate(activeTab === 'missing' ? 'upload' : 'invoices')}
        >
          {t('dashboard:inbound_status.open_all', 'Összes megtekintése')}
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
};

export default InvoiceStatusTables;
