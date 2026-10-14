import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '@/contexts/CompanyContext';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, fixCharacterEncoding } from '@/lib/utils';
import { Search, Download, Loader2, BookOpen, ArrowUpDown, AlertCircle, RefreshCw } from 'lucide-react';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { exportToFile } from '@/lib/exportUtils';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { fetchGlJournalItemsPaged, GlDateBasis, GlPostingStatus } from '@/lib/glData';
import { useTranslation } from 'react-i18next';
import { getLocalizedGlAccountName, getLocalizedGlItemType } from '@/lib/glUtils';
import { useCompanyJurisdiction } from '@/hooks/useCompanyJurisdiction';
import { reportError } from '@/lib/errorReporter';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  F7: JOURNAL VIEW (Naplófőkönyv)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface JournalViewProps {
  presetId?: string;
  dateFrom?: string;
  dateTo?: string;
  dateBasis?: GlDateBasis;
  postingStatus?: GlPostingStatus;
}

export const TYPE_LABELS: Record<string, string> = {
  invoice_items: 'Számla',
  invoice: 'Számla',
  invoices: 'Számla',
  nav_invoice_items: 'NAV Számla',
  nav_invoice: 'NAV Számla',
  nav_invoices: 'NAV Számla',
  acc_journal_lines: 'Naplótétel',
  journal_entry: 'XML Naplótétel',
  gl_journal_entries: 'XML Naplótétel',
  transactions: 'Banki tranzakció',
  transaction: 'Banki tranzakció',
  petty_cash: 'Házipénztár',
  cash_transactions: 'Készpénz',
  payroll_records: 'Bérszámfejtés',
};

export function getLogicalTypeLabel(sourceTable?: string | null, itemType?: string | null, t?: any): string {
  let raw = '';
  if (sourceTable && TYPE_LABELS[sourceTable]) {
    raw = TYPE_LABELS[sourceTable];
  } else if (itemType && TYPE_LABELS[itemType]) {
    raw = TYPE_LABELS[itemType];
  } else if (itemType) {
    const lower = itemType.toLowerCase();
    if (lower.includes('nav')) raw = 'NAV Számla';
    else if (lower.includes('számla') || lower.includes('költség') || lower.includes('bevétel')) raw = 'Számla';
    else if (lower.includes('bank') || lower.includes('tranzakció')) raw = 'Banki tranzakció';
    else if (lower.includes('xml')) raw = 'XML Naplótétel';
    else if (lower.includes('napló') || lower.includes('nyitó') || lower.includes('záró') || lower.includes('vegyes')) raw = 'Naplótétel';
    else raw = itemType;
  } else if (sourceTable) {
    raw = sourceTable
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  } else {
    raw = 'Egyéb';
  }
  return getLocalizedGlItemType(raw, t);
}

export default function JournalView({ presetId, dateFrom, dateTo, dateBasis = 'kibocsatas', postingStatus = 'all' }: JournalViewProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const { isCroatia, defaultCurrency } = useCompanyJurisdiction();
  const currencyLabel = defaultCurrency === 'HUF' ? 'Ft' : defaultCurrency;
  const { selectedCompany } = useCompany();
  const { data: exchangeRates } = useExchangeRates();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [isExporting, setIsExporting] = useState(false);
  const pageSize = 50;

  // 300ms debounce for server-side search input to prevent query hammering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(isCroatia ? 'hr-HR' : 'hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

  // Server-side paginated and aggregated items query (protects against statement timeout 57014)
  const {
    data: pagedData,
    isLoading,
    isFetching,
    isError,
    error: itemsError,
    refetch,
  } = useQuery({
    queryKey: [
      'glJournalItemsPaged',
      selectedCompany?.id,
      presetId,
      dateFrom,
      dateTo,
      dateBasis,
      postingStatus,
      debouncedSearch,
      typeFilter,
      sortDir,
      currentPage,
      pageSize,
    ],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId) return null;
      try {
        return await fetchGlJournalItemsPaged({
          companyId: selectedCompany.id,
          presetId,
          dateFrom,
          dateTo,
          dateBasis,
          postingStatus,
          exchangeRates: exchangeRates || {},
          search: debouncedSearch,
          typeFilter,
          sortDir,
          page: currentPage,
          pageSize,
        });
      } catch (error) {
        reportError({
          type: 'db_query',
          severity: 'error',
          component: 'JournalView',
          action: 'fetchGlJournalItemsPaged',
          message: error instanceof Error ? error.message : 'Ismeretlen hiba a naplófőkönyvi tételek lekérdezésekor',
          error,
          context: {
            companyId: selectedCompany.id,
            presetId,
            dateFrom,
            dateTo,
            dateBasis,
            postingStatus,
            search: debouncedSearch,
            typeFilter,
            sortDir,
            page: currentPage,
          },
        });
        throw error;
      }
    },
    enabled: !!selectedCompany?.id && !!presetId && !!exchangeRates,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const totalCount = pagedData?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const totals = useMemo(() => {
    const debit = pagedData?.totalDebit ?? 0;
    const credit = pagedData?.totalCredit ?? 0;
    return { debit, credit, net: debit - credit };
  }, [pagedData?.totalDebit, pagedData?.totalCredit]);

  // Enrich returned items with localized names and human-friendly labels
  const enrichedItems = useMemo(() => {
    return (pagedData?.items || []).map((item) => {
      const isUnclassified =
        !item.gl_number ||
        item.gl_number === 'UNCLASSIFIED' ||
        item.gl_account_id === '00000000-0000-0000-0000-000000000000' ||
        item.gl_number === '—';

      const glNumber = isUnclassified
        ? t('accounting:general_ledger.unclassified', 'Besorolatlan')
        : item.gl_number;

      const rawName = isUnclassified
        ? t('accounting:general_ledger.unclassified', 'Besorolatlan tétel')
        : (item.gl_name || t('accounting:general_ledger.unclassified', 'Besorolatlan tétel'));

      const glName = isUnclassified
        ? rawName
        : getLocalizedGlAccountName(glNumber, fixCharacterEncoding(rawName), t);

      const logicalType = getLogicalTypeLabel(item.source_table, item.item_type, t);

      return {
        ...item,
        gl_number: glNumber,
        gl_name: glName,
        is_unclassified: isUnclassified,
        logical_type: logicalType,
      };
    });
  }, [pagedData?.items, t]);

  // Standard type filter options
  const typeFilterOptions = useMemo(() => [
    { value: 'invoice_items', label: getLogicalTypeLabel('invoice_items', null, t) },
    { value: 'nav_invoice_items', label: getLogicalTypeLabel('nav_invoice_items', null, t) },
    { value: 'acc_journal_lines', label: getLogicalTypeLabel('acc_journal_lines', null, t) },
    { value: 'journal_entry', label: getLogicalTypeLabel('journal_entry', null, t) },
    { value: 'transactions', label: getLogicalTypeLabel('transactions', null, t) },
    { value: 'invoices_vat', label: 'ÁFA tétel' },
    { value: 'invoices_partner', label: 'Partner tétel' },
  ], [t]);

  const handleExport = async () => {
    if (!selectedCompany?.id || !presetId) return;
    setIsExporting(true);
    try {
      // Fetch up to 10,000 filtered rows for export
      const exportData = await fetchGlJournalItemsPaged({
        companyId: selectedCompany.id,
        presetId,
        dateFrom,
        dateTo,
        dateBasis,
        postingStatus,
        exchangeRates: exchangeRates || {},
        search: debouncedSearch,
        typeFilter,
        sortDir,
        page: 1,
        pageSize: 10000,
      });

      const basisLabel = dateBasis === 'teljesites' ? 'Teljesítés' : 'Kibocsátás';
      const headers = [
        `${t('accounting:general_ledger.journal_view.col_date', 'Dátum')} (${basisLabel})`,
        t('accounting:general_ledger.journal_view.col_partner', 'Partner'),
        t('accounting:general_ledger.journal_view.col_description', 'Leírás'),
        t('accounting:general_ledger.table.gl_account', 'Főkönyvi szám'),
        t('accounting:general_ledger.table.name', 'Főkönyvi megnevezés'),
        t('accounting:general_ledger.journal_view.col_type', 'Típus'),
        `${t('accounting:general_ledger.journal_view.col_debit', 'Tartozik')} (${currencyLabel})`,
        `${t('accounting:general_ledger.journal_view.col_credit', 'Követel')} (${currencyLabel})`,
      ];
      const rows = exportData.items.map((item) => {
        const isUnclass = item.gl_number === 'UNCLASSIFIED' || !item.gl_number;
        const glNum = isUnclass ? t('accounting:general_ledger.unclassified', 'Besorolatlan') : item.gl_number;
        const glNm = isUnclass ? t('accounting:general_ledger.unclassified', 'Besorolatlan tétel') : getLocalizedGlAccountName(item.gl_number, fixCharacterEncoding(item.gl_name), t);
        const logicalType = getLogicalTypeLabel(item.source_table, item.item_type, t);
        return [
          item.item_date ? item.item_date.substring(0, 10) : '',
          item.partner || '',
          item.description || '',
          glNum,
          glNm,
          logicalType,
          item.amount > 0 ? item.amount.toString() : '',
          item.amount < 0 ? Math.abs(item.amount).toString() : '',
        ];
      });
      const rangePart = (dateFrom && dateTo) ? `_${dateFrom}_${dateTo}` : '';
      const fileSuffix = dateBasis === 'teljesites' ? `naplofokonyv${rangePart}_teljesites_alapjan` : `naplofokonyv${rangePart}_kibocsatas_alapjan`;
      await exportToFile(headers, rows, 'xlsx', fileSuffix);
      toast({ title: t('accounting:general_ledger.journal_view.export_toast', 'Naplófőkönyv exportálva') });
    } catch (err: any) {
      toast({ title: 'Hiba az exportálás során', description: err?.message, variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('accounting:general_ledger.journal_view.search_placeholder', 'Keresés (partner, leírás, főkönyvi szám...)')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder={t('accounting:general_ledger.journal_view.type_placeholder', 'Típus')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('accounting:general_ledger.journal_view.all_types', 'Összes típus')}</SelectItem>
            {typeFilterOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={handleExport}
          disabled={isLoading || isError || totalCount === 0 || isExporting}
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {t('accounting:general_ledger.toolbar.export', 'Export')}
        </Button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/40 px-4 py-2 rounded-lg">
        {isLoading ? (
          <Skeleton className="h-4 w-64 bg-muted/50 rounded" />
        ) : isError ? (
          <span className="text-destructive font-medium flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {t('accounting:general_ledger.journal_view.summary_error', 'A tételek betöltése nem sikerült')}
          </span>
        ) : (
          <>
            <span>{totalCount} {t('accounting:general_ledger.journal_view.items_count', 'tétel')}</span>
            <span>|</span>
            <span className="text-emerald-600 font-medium">{t('accounting:general_ledger.journal_view.debit', 'Tartozik:')} {formatCurrency(totals.debit)} {currencyLabel}</span>
            <span className="text-destructive font-medium">{t('accounting:general_ledger.journal_view.credit', 'Követel:')} {formatCurrency(totals.credit)} {currencyLabel}</span>
            <span className={cn('font-bold', totals.net >= 0 ? 'text-foreground' : 'text-destructive')}>
              {t('accounting:general_ledger.journal_view.net', 'Nettó:')} {formatCurrency(totals.net)} {currencyLabel}
            </span>
            {isFetching && !isLoading && (
              <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground/70">
                <Loader2 className="w-3 h-3 animate-spin" />
                Frissítés...
              </span>
            )}
          </>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        {/* Header */}
        <div className="grid grid-cols-12 bg-muted/80 border-b text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
          <button
            type="button"
            className="col-span-1 p-3 text-center flex items-center justify-center gap-1 hover:text-foreground transition-colors"
            onClick={() => {
              setSortDir(d => d === 'asc' ? 'desc' : 'asc');
              setCurrentPage(1);
            }}
          >
            {t('accounting:general_ledger.journal_view.col_date', 'Dátum')} <ArrowUpDown className="w-3 h-3" />
          </button>
          <div className="col-span-2 p-3">{t('accounting:general_ledger.journal_view.col_partner', 'Partner')}</div>
          <div className="col-span-3 p-3">{t('accounting:general_ledger.journal_view.col_description', 'Leírás')}</div>
          <div className="col-span-2 p-3 text-center">{t('accounting:general_ledger.table.gl_account', 'Fők. szám')}</div>
          <div className="col-span-1 p-3 text-center">{t('accounting:general_ledger.journal_view.col_type', 'Típus')}</div>
          <div className="col-span-1 p-3 text-right">{t('accounting:general_ledger.journal_view.col_debit', 'Tartozik')}</div>
          <div className="col-span-1 p-3 text-right">{t('accounting:general_ledger.journal_view.col_credit', 'Követel')}</div>
          <div className="col-span-1 p-3 text-right">{t('accounting:general_ledger.journal_view.col_balance', 'Egyenleg')}</div>
        </div>

        {/* Body */}
        <div className="divide-y divide-border/30 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 text-sm p-3 items-center animate-pulse">
                <div className="col-span-1 text-center">
                  <Skeleton className="h-4 w-16 mx-auto bg-muted/50 rounded" />
                </div>
                <div className="col-span-2">
                  <Skeleton className="h-4 w-28 bg-muted/50 rounded" />
                </div>
                <div className="col-span-3">
                  <Skeleton className="h-4 w-36 bg-muted/50 rounded" />
                </div>
                <div className="col-span-2 text-center">
                  <Skeleton className="h-5 w-16 mx-auto bg-muted/50 rounded" />
                </div>
                <div className="col-span-1 text-center">
                  <Skeleton className="h-5 w-12 mx-auto bg-muted/50 rounded" />
                </div>
                <div className="col-span-1 text-right">
                  <Skeleton className="h-4 w-20 ml-auto bg-muted/50 rounded" />
                </div>
                <div className="col-span-1 text-right">
                  <Skeleton className="h-4 w-20 ml-auto bg-muted/50 rounded" />
                </div>
                <div className="col-span-1 text-right">
                  <Skeleton className="h-4 w-20 ml-auto bg-muted/50 rounded" />
                </div>
              </div>
            ))
          ) : isError ? (
            <div className="py-12 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-sm font-semibold text-foreground">
                  {t('accounting:general_ledger.journal_view.error_title', 'Hiba történt a könyvelési tételek betöltése közben')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {(itemsError as Error)?.message || t('accounting:general_ledger.journal_view.error_desc', 'Nem sikerült lekérdezni a könyvelési tételeket az adatbázisból.')}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isLoading}
                className="mt-2 gap-2"
              >
                <RefreshCw className={cn("w-4 h-4", (isLoading || isFetching) && "animate-spin")} />
                {t('common:retry', 'Újrapróbálás')}
              </Button>
            </div>
          ) : enrichedItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
              <BookOpen className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-sm">{t('accounting:general_ledger.journal_view.no_items', 'Nincs naplófőkönyvi tétel a kiválasztott időszakban')}</p>
            </div>
          ) : (
            enrichedItems.map((item, idx) => {
              const debit = item.amount > 0 ? item.amount : 0;
              const credit = item.amount < 0 ? Math.abs(item.amount) : 0;
              const uniqueKey = `${item.source_table}_${item.item_id}_${item.gl_account_id || 'unclass'}_${item.item_type || ''}_${idx}`;
              return (
                <div key={uniqueKey} className="grid grid-cols-12 text-sm hover:bg-muted/30 transition-colors">
                  <div className="col-span-1 p-2.5 text-center font-mono text-xs tabular-nums text-muted-foreground">
                    {item.item_date ? item.item_date.substring(0, 10).replace(/-/g, '.') : '—'}
                  </div>
                  <CustomTooltip content={item.partner}>
                    <div className="col-span-2 p-2.5 truncate text-sm font-medium">
                      {item.partner || '—'}
                    </div>
                  </CustomTooltip>
                  <CustomTooltip content={item.description}>
                    <div className="col-span-3 p-2.5 truncate text-sm text-muted-foreground">
                      {item.description || '—'}
                    </div>
                  </CustomTooltip>
                  <div className="col-span-2 p-2.5 text-center">
                    <CustomTooltip content={item.gl_name}>
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded cursor-help">
                        {item.gl_number}
                      </span>
                    </CustomTooltip>
                  </div>
                  <div className="col-span-1 p-2.5 text-center">
                    <CustomTooltip content={item.item_type && item.item_type !== item.logical_type ? item.item_type : undefined}>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/5 text-primary/70 font-medium cursor-help">
                        {item.logical_type}
                      </span>
                    </CustomTooltip>
                  </div>
                  <div className={cn('col-span-1 p-2.5 text-right tabular-nums', debit > 0 && 'text-emerald-600 font-medium')}>
                    {debit > 0 ? `${formatCurrency(debit)} ${currencyLabel}` : ''}
                  </div>
                  <div className={cn('col-span-1 p-2.5 text-right tabular-nums', credit > 0 && 'text-destructive font-medium')}>
                    {credit > 0 ? `${formatCurrency(credit)} ${currencyLabel}` : ''}
                  </div>
                  <div className={cn('col-span-1 p-2.5 text-right tabular-nums font-medium', item.amount < 0 ? 'text-destructive' : '')}>
                    {formatCurrency(item.amount)} {currencyLabel}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {totalPages > 1 && (
        <UnifiedPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalCount}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={() => {}}
        />
      )}
    </div>
  );
}
