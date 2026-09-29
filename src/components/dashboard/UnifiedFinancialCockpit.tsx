import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  FileQuestion,
  CreditCard,
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  Upload,
  ChevronRight,
  Search,
  X,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useScopedNavigate } from '@/lib/navigation';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { InvoiceItemsDialog } from '@/components/InvoiceItemsDialog';
import { TransactionDetailsDialog } from '@/components/TransactionDetailsDialog';
import { cn, formatCurrency } from '@/lib/utils';
import { getActiveLocale } from '@/lib/locale/formatters';

export type CockpitTab = 'missing' | 'payable' | 'bank' | 'receivables';

export const PAGE_SIZE = 50;

export interface NavInvoiceItem {
  id: string;
  invoice_number: string;
  invoice_direction: string | null;
  invoice_issue_date: string | null;
  invoice_delivery_date: string | null;
  supplier_tax_number?: string | null;
  supplier_name: string | null;
  customer_name: string | null;
  invoice_net_amount?: number | null;
  invoice_gross_amount: number | null;
  invoice_vat_amount?: number | null;
  currency: string | null;
  payment_method?: string | null;
  transaction_id?: string | null;
  submitted?: boolean | null;
  total_count?: number | string | null;
}

export interface BankTransactionItem {
  id: string;
  transaction_date: string;
  amount: number;
  description: string | null;
  currency: string | null;
  type: string | null;
  matched_invoice_id?: string | null;
  confidence_score?: number | null;
  is_verified?: boolean | null;
  match_type?: string | null;
  reason?: string | null;
  created_at?: string | null;
  company_id?: string | null;
  gl_account_id?: string | null;
}

interface Partner {
  tax_number: string;
  name: string;
}

interface FetchNavResult {
  items: NavInvoiceItem[];
  totalCount: number;
}

interface FetchTransactionsResult {
  items: BankTransactionItem[];
  totalCount: number;
}

interface FetchMissingResult {
  items: NavInvoiceItem[];
  totalCount: number;
}

interface NavAggregatesResult {
  inboundUnpaidGross: number;
  outboundUnpaidGross: number;
}

// ── Skeletons ──
export function CockpitRowSkeleton() {
  return (
    <div
      data-testid="cockpit-row-skeleton"
      className="flex items-center justify-between py-2 px-2 rounded-md gap-2"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Skeleton className="w-6 h-6 rounded-md shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-2/5 max-w-[180px] rounded" />
          <Skeleton className="h-2.5 w-3/5 max-w-[240px] rounded" />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right space-y-1.5">
          <Skeleton className="h-3.5 w-20 ml-auto rounded" />
          <Skeleton className="h-2.5 w-14 ml-auto rounded" />
        </div>
        <Skeleton className="w-4 h-4 rounded shrink-0 opacity-40" />
      </div>
    </div>
  );
}

// ── Data Fetching Helpers ──

// Fetch a single page of unmatched NAV invoices (p_page_size: 50)
const fetchNavInvoicesPage = async (
  companyId: string,
  dateFrom: string,
  dateTo: string,
  direction: 'INBOUND' | 'OUTBOUND',
  page: number
): Promise<FetchNavResult> => {
  const { data, error } = await supabase.rpc('get_filtered_nav_invoices', {
    p_company_id: companyId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
    p_direction: direction,
    p_kpi_filter: 'unmatched',
    p_page: page,
    p_page_size: PAGE_SIZE,
  });

  if (error) throw error;
  const rows = (data || []) as unknown as (NavInvoiceItem & { total_count?: number | string })[];
  const totalCount =
    rows.length > 0 && rows[0].total_count !== undefined && rows[0].total_count !== null
      ? Number(rows[0].total_count)
      : rows.length;

  const items: NavInvoiceItem[] = rows.map((r) => ({
    id: r.id,
    invoice_number: r.invoice_number,
    invoice_direction: r.invoice_direction,
    invoice_issue_date: r.invoice_issue_date,
    invoice_delivery_date: r.invoice_delivery_date,
    supplier_tax_number: r.supplier_tax_number,
    supplier_name: r.supplier_name,
    customer_name: r.customer_name,
    invoice_net_amount: r.invoice_net_amount,
    invoice_gross_amount: r.invoice_gross_amount,
    invoice_vat_amount: r.invoice_vat_amount,
    currency: r.currency,
    payment_method: r.payment_method,
    transaction_id: r.transaction_id,
    submitted: r.submitted,
  }));

  // Filter 0 Ft administrative records
  const nonZero = items.filter((inv) => Math.abs(Number(inv.invoice_gross_amount) || 0) > 0);
  return { items: nonZero, totalCount };
};

// Fetch batch of missing vouchers (range [from, to])
const fetchMissingVouchersBatch = async (
  companyId: string,
  from: number,
  to: number
): Promise<FetchMissingResult> => {
  const query = supabase
    .from('nav_invoices')
    .select(
      'id, invoice_number, invoice_issue_date, invoice_delivery_date, supplier_tax_number, supplier_name, customer_name, invoice_net_amount, invoice_gross_amount, invoice_vat_amount, currency, transaction_id, submitted, invoice_direction',
      { count: 'exact' }
    )
    .eq('company_id', companyId)
    .eq('invoice_direction', 'INBOUND')
    .or('submitted.is.null,submitted.eq.false')
    .order('invoice_issue_date', { ascending: false });

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;

  const rawRows = (data || []) as NavInvoiceItem[];
  const nonZero = rawRows.filter((inv) => Math.abs(Number(inv.invoice_gross_amount) || 0) > 0);

  // Cross-check against uploaded invoices to eliminate OCR whitespace false-positives
  const { data: uploadedRows, error: uploadedError } = await supabase
    .from('invoices')
    .select('bizonylatsorszam')
    .eq('company_id', companyId);

  if (uploadedError) {
    console.error('Error fetching uploaded invoices for cross-check:', uploadedError);
    return { items: nonZero, totalCount: count || nonZero.length };
  }

  const normalizeInv = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const uploadedSet = new Set(
    (uploadedRows || [])
      .map((r) => normalizeInv(r.bizonylatsorszam || ''))
      .filter(Boolean)
  );

  const filtered = nonZero.filter(
    (inv) => !uploadedSet.has(normalizeInv(inv.invoice_number || ''))
  );

  const totalCount =
    count !== null && count !== undefined
      ? Math.max(0, count - (nonZero.length - filtered.length))
      : filtered.length;

  return { items: filtered, totalCount };
};

// Fetch batch of unmatched transactions (range [from, to])
const fetchUnmatchedTransactionsBatch = async (
  companyId: string,
  dateFrom: string,
  dateTo: string,
  from: number,
  to: number
): Promise<FetchTransactionsResult> => {
  const { data, count, error } = await supabase
    .from('transactions')
    .select(
      'id, transaction_date, amount, description, currency, type, matched_invoice_id, confidence_score, is_verified, match_type, reason, created_at, company_id, gl_account_id',
      { count: 'exact' }
    )
    .eq('company_id', companyId)
    .is('matched_invoice_id', null)
    .not('match_type', 'eq', 'no_match_category')
    .not('match_type', 'eq', 'no_invoice')
    .not('match_type', 'eq', 'invoice_missing')
    .not(
      'type',
      'in',
      '("atm készpénzfelvét","pénztári kp felvét","pénztári kp befizetés","kp befizetés atm-en keresztül","bankköltség","járulékok/adók")'
    )
    .gte('transaction_date', dateFrom)
    .lte('transaction_date', dateTo)
    .order('transaction_date', { ascending: false })
    .range(from, to);

  if (error) throw error;
  const items = (data || []) as BankTransactionItem[];
  const totalCount = count !== null && count !== undefined ? count : items.length;
  return { items, totalCount };
};

// Fetch aggregates for accurate total gross calculations (unpaid supplier & customer amounts)
const fetchNavAggregates = async (
  companyId: string,
  dateFrom: string,
  dateTo: string
): Promise<NavAggregatesResult | null> => {
  try {
    const { data, error } = await supabase.rpc('get_nav_invoice_aggregates', {
      p_company_id: companyId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });
    if (error) {
      return null;
    }
    let inboundUnpaidGross = 0;
    let outboundUnpaidGross = 0;
    (data || []).forEach((agg: any) => {
      const gross = Number(agg.unpaid_gross || 0);
      if (agg.invoice_direction === 'INBOUND') {
        inboundUnpaidGross += gross;
      } else if (agg.invoice_direction === 'OUTBOUND') {
        outboundUnpaidGross += gross;
      }
    });
    return { inboundUnpaidGross, outboundUnpaidGross };
  } catch {
    return null;
  }
};

export default function UnifiedFinancialCockpit() {
  const { t } = useTranslation(['dashboard', 'common']);
  const queryClient = useQueryClient();
  const scopedNavigate = useScopedNavigate();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const companyId = selectedCompany?.id || '';

  const [activeTab, setActiveTab] = useState<CockpitTab>('missing');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<NavInvoiceItem | null>(null);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<BankTransactionItem | null>(null);
  const [isTxDialogOpen, setIsTxDialogOpen] = useState(false);

  // Progressive infinite scroll extension states
  const [extraMissingItems, setExtraMissingItems] = useState<NavInvoiceItem[]>([]);
  const [isLoadingMoreMissing, setIsLoadingMoreMissing] = useState(false);

  const [extraPayableItems, setExtraPayableItems] = useState<NavInvoiceItem[]>([]);
  const [isLoadingMorePayable, setIsLoadingMorePayable] = useState(false);

  const [extraBankItems, setExtraBankItems] = useState<BankTransactionItem[]>([]);
  const [isLoadingMoreBank, setIsLoadingMoreBank] = useState(false);

  const [extraReceivablesItems, setExtraReceivablesItems] = useState<NavInvoiceItem[]>([]);
  const [isLoadingMoreReceivables, setIsLoadingMoreReceivables] = useState(false);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const isHr = getActiveLocale() === 'hr';
  const dateFormatPattern = isHr ? 'dd.MM.yyyy.' : 'yyyy. MM. dd.';

  // Reset appended extra items on company or date range shift
  useEffect(() => {
    setExtraMissingItems([]);
    setExtraPayableItems([]);
    setExtraBankItems([]);
    setExtraReceivablesItems([]);
  }, [companyId, dateFromFormatted, dateToFormatted]);

  // 1. Initial Missing Vouchers query (page 1: 50 items)
  const {
    data: initialMissingData,
    isLoading: missingLoading,
  } = useQuery({
    queryKey: ['cockpitMissingVouchers', companyId],
    queryFn: () => fetchMissingVouchersBatch(companyId, 0, PAGE_SIZE - 1),
    enabled: !!companyId,
  });

  // 2. Initial Inbound (Payable) query (page 1: 50 items)
  const {
    data: initialPayableData,
    isLoading: payableLoading,
  } = useQuery({
    queryKey: ['cockpitPayableInvoices', companyId, dateFromFormatted, dateToFormatted],
    queryFn: () => fetchNavInvoicesPage(companyId, dateFromFormatted, dateToFormatted, 'INBOUND', 1),
    enabled: !!companyId,
  });

  // 3. Initial Bank Transactions query (page 1: 50 items)
  const {
    data: initialBankData,
    isLoading: bankLoading,
  } = useQuery({
    queryKey: ['cockpitBankTransactions', companyId, dateFromFormatted, dateToFormatted],
    queryFn: () =>
      fetchUnmatchedTransactionsBatch(companyId, dateFromFormatted, dateToFormatted, 0, PAGE_SIZE - 1),
    enabled: !!companyId,
  });

  // 4. Initial Outbound (Receivables) query (page 1: 50 items)
  const {
    data: initialReceivablesData,
    isLoading: receivablesLoading,
  } = useQuery({
    queryKey: ['cockpitReceivablesInvoices', companyId, dateFromFormatted, dateToFormatted],
    queryFn: () =>
      fetchNavInvoicesPage(companyId, dateFromFormatted, dateToFormatted, 'OUTBOUND', 1),
    enabled: !!companyId,
  });

  // 5. NAV aggregates (for exact gross totals across all pages)
  const { data: navAggregates } = useQuery({
    queryKey: ['cockpitNavAggregates', companyId, dateFromFormatted, dateToFormatted],
    queryFn: () => fetchNavAggregates(companyId, dateFromFormatted, dateToFormatted),
    enabled: !!companyId,
  });

  // 6. Fetch partners for tax number resolution
  const { data: partners = [] } = useQuery({
    queryKey: ['invoiceStatusPartners', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('tax_number, name')
        .eq('company_id', companyId);
      if (error) throw error;
      return (data || []) as Partner[];
    },
    enabled: !!companyId,
  });

  const getPartnerName = (taxNumber?: string | null, fallbackName?: string | null): string => {
    if (fallbackName && fallbackName.trim() !== '') return fallbackName;
    if (!taxNumber) return '-';
    const partner = partners.find((p) => p.tax_number === taxNumber);
    return partner?.name || taxNumber;
  };

  // ── Combined lists and totals ──
  const allMissingItems = useMemo(
    () => [...(initialMissingData?.items || []), ...extraMissingItems],
    [initialMissingData?.items, extraMissingItems]
  );
  const missingTotalCount = initialMissingData?.totalCount ?? allMissingItems.length;
  const hasMoreMissing = allMissingItems.length < missingTotalCount;

  const allPayableItems = useMemo(
    () => [...(initialPayableData?.items || []), ...extraPayableItems],
    [initialPayableData?.items, extraPayableItems]
  );
  const payableTotalCount = initialPayableData?.totalCount ?? allPayableItems.length;
  const hasMorePayable = allPayableItems.length < payableTotalCount;
  const payablePage = 1 + Math.floor(extraPayableItems.length / PAGE_SIZE);

  const allBankItems = useMemo(
    () => [...(initialBankData?.items || []), ...extraBankItems],
    [initialBankData?.items, extraBankItems]
  );
  const bankTotalCount = initialBankData?.totalCount ?? allBankItems.length;
  const hasMoreBank = allBankItems.length < bankTotalCount;

  const allReceivablesItems = useMemo(
    () => [...(initialReceivablesData?.items || []), ...extraReceivablesItems],
    [initialReceivablesData?.items, extraReceivablesItems]
  );
  const receivablesTotalCount = initialReceivablesData?.totalCount ?? allReceivablesItems.length;
  const hasMoreReceivables = allReceivablesItems.length < receivablesTotalCount;
  const receivablesPage = 1 + Math.floor(extraReceivablesItems.length / PAGE_SIZE);

  // Exact gross totals: use aggregates if available, otherwise compute from loaded items
  const payableGrossTotal = useMemo(() => {
    if (navAggregates && navAggregates.inboundUnpaidGross > 0) {
      return navAggregates.inboundUnpaidGross;
    }
    return allPayableItems.reduce((sum, inv) => sum + Math.abs(inv.invoice_gross_amount || 0), 0);
  }, [navAggregates, allPayableItems]);

  const receivablesGrossTotal = useMemo(() => {
    if (navAggregates && navAggregates.outboundUnpaidGross > 0) {
      return navAggregates.outboundUnpaidGross;
    }
    return allReceivablesItems.reduce((sum, inv) => sum + Math.abs(inv.invoice_gross_amount || 0), 0);
  }, [navAggregates, allReceivablesItems]);

  // Loading state of active tab
  const isCurrentTabInitialLoading = useMemo(() => {
    switch (activeTab) {
      case 'missing':
        return missingLoading && !initialMissingData;
      case 'payable':
        return payableLoading && !initialPayableData;
      case 'bank':
        return bankLoading && !initialBankData;
      case 'receivables':
        return receivablesLoading && !initialReceivablesData;
    }
  }, [
    activeTab,
    missingLoading,
    initialMissingData,
    payableLoading,
    initialPayableData,
    bankLoading,
    initialBankData,
    receivablesLoading,
    initialReceivablesData,
  ]);

  const currentTabHasMore = useMemo(() => {
    switch (activeTab) {
      case 'missing':
        return hasMoreMissing;
      case 'payable':
        return hasMorePayable;
      case 'bank':
        return hasMoreBank;
      case 'receivables':
        return hasMoreReceivables;
    }
  }, [activeTab, hasMoreMissing, hasMorePayable, hasMoreBank, hasMoreReceivables]);

  const currentTabIsLoadingMore = useMemo(() => {
    switch (activeTab) {
      case 'missing':
        return isLoadingMoreMissing;
      case 'payable':
        return isLoadingMorePayable;
      case 'bank':
        return isLoadingMoreBank;
      case 'receivables':
        return isLoadingMoreReceivables;
    }
  }, [
    activeTab,
    isLoadingMoreMissing,
    isLoadingMorePayable,
    isLoadingMoreBank,
    isLoadingMoreReceivables,
  ]);

  // Format date helper
  const formatDateSafe = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), dateFormatPattern);
    } catch {
      return dateStr;
    }
  };

  // Filter items based on activeTab and searchQuery
  const q = searchQuery.toLowerCase().trim();

  const filteredMissing = useMemo(() => {
    if (!q) return allMissingItems;
    return allMissingItems.filter((inv) => {
      const num = (inv.invoice_number || '').toLowerCase();
      const supp = (inv.supplier_name || '').toLowerCase();
      const tax = (inv.supplier_tax_number || '').toLowerCase();
      return num.includes(q) || supp.includes(q) || tax.includes(q);
    });
  }, [allMissingItems, q]);

  const filteredPayable = useMemo(() => {
    if (!q) return allPayableItems;
    return allPayableItems.filter((inv) => {
      const num = (inv.invoice_number || '').toLowerCase();
      const supp = (inv.supplier_name || '').toLowerCase();
      return num.includes(q) || supp.includes(q);
    });
  }, [allPayableItems, q]);

  const filteredBank = useMemo(() => {
    if (!q) return allBankItems;
    return allBankItems.filter((tx) => {
      const desc = (tx.description || '').toLowerCase();
      const type = (tx.type || '').toLowerCase();
      const amt = String(tx.amount || '');
      return desc.includes(q) || type.includes(q) || amt.includes(q);
    });
  }, [allBankItems, q]);

  const filteredReceivables = useMemo(() => {
    if (!q) return allReceivablesItems;
    return allReceivablesItems.filter((inv) => {
      const num = (inv.invoice_number || '').toLowerCase();
      const cust = (inv.customer_name || '').toLowerCase();
      return num.includes(q) || cust.includes(q);
    });
  }, [allReceivablesItems, q]);

  // Active list count for header badge
  const activeBadgeCount = useMemo(() => {
    if (q) {
      switch (activeTab) {
        case 'missing':
          return filteredMissing.length;
        case 'payable':
          return filteredPayable.length;
        case 'bank':
          return filteredBank.length;
        case 'receivables':
          return filteredReceivables.length;
      }
    }
    switch (activeTab) {
      case 'missing':
        return missingTotalCount;
      case 'payable':
        return payableTotalCount;
      case 'bank':
        return bankTotalCount;
      case 'receivables':
        return receivablesTotalCount;
    }
  }, [
    q,
    activeTab,
    filteredMissing.length,
    filteredPayable.length,
    filteredBank.length,
    filteredReceivables.length,
    missingTotalCount,
    payableTotalCount,
    bankTotalCount,
    receivablesTotalCount,
  ]);

  const activeListLength = useMemo(() => {
    switch (activeTab) {
      case 'missing':
        return filteredMissing.length;
      case 'payable':
        return filteredPayable.length;
      case 'bank':
        return filteredBank.length;
      case 'receivables':
        return filteredReceivables.length;
    }
  }, [
    activeTab,
    filteredMissing.length,
    filteredPayable.length,
    filteredBank.length,
    filteredReceivables.length,
  ]);

  // Optimistic Infinite Scroll trigger
  const handleLoadMore = useCallback(async () => {
    if (currentTabIsLoadingMore || !currentTabHasMore || searchQuery.trim() !== '') return;

    switch (activeTab) {
      case 'bank': {
        setIsLoadingMoreBank(true);
        try {
          const from = allBankItems.length;
          const to = from + PAGE_SIZE - 1;
          const res = await fetchUnmatchedTransactionsBatch(
            companyId,
            dateFromFormatted,
            dateToFormatted,
            from,
            to
          );
          if (res.items.length > 0) {
            setExtraBankItems((prev) => [...prev, ...res.items]);
          }
        } catch (err) {
          console.error('Failed to load more bank transactions:', err);
        } finally {
          setIsLoadingMoreBank(false);
        }
        break;
      }
      case 'payable': {
        setIsLoadingMorePayable(true);
        try {
          const nextPage = payablePage + 1;
          const res = await fetchNavInvoicesPage(
            companyId,
            dateFromFormatted,
            dateToFormatted,
            'INBOUND',
            nextPage
          );
          if (res.items.length > 0) {
            setExtraPayableItems((prev) => [...prev, ...res.items]);
          }
        } catch (err) {
          console.error('Failed to load more payable invoices:', err);
        } finally {
          setIsLoadingMorePayable(false);
        }
        break;
      }
      case 'receivables': {
        setIsLoadingMoreReceivables(true);
        try {
          const nextPage = receivablesPage + 1;
          const res = await fetchNavInvoicesPage(
            companyId,
            dateFromFormatted,
            dateToFormatted,
            'OUTBOUND',
            nextPage
          );
          if (res.items.length > 0) {
            setExtraReceivablesItems((prev) => [...prev, ...res.items]);
          }
        } catch (err) {
          console.error('Failed to load more receivables invoices:', err);
        } finally {
          setIsLoadingMoreReceivables(false);
        }
        break;
      }
      case 'missing': {
        setIsLoadingMoreMissing(true);
        try {
          const from = allMissingItems.length;
          const to = from + PAGE_SIZE - 1;
          const res = await fetchMissingVouchersBatch(companyId, from, to);
          if (res.items.length > 0) {
            setExtraMissingItems((prev) => [...prev, ...res.items]);
          }
        } catch (err) {
          console.error('Failed to load more missing vouchers:', err);
        } finally {
          setIsLoadingMoreMissing(false);
        }
        break;
      }
    }
  }, [
    currentTabIsLoadingMore,
    currentTabHasMore,
    searchQuery,
    activeTab,
    allBankItems.length,
    companyId,
    dateFromFormatted,
    dateToFormatted,
    payablePage,
    receivablesPage,
    allMissingItems.length,
  ]);

  // Infinite Scroll Observer on bottom sentinel
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const target = sentinelRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (
          entry &&
          entry.isIntersecting &&
          currentTabHasMore &&
          !currentTabIsLoadingMore &&
          !searchQuery.trim()
        ) {
          handleLoadMore();
        }
      },
      { rootMargin: '250px' }
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [currentTabHasMore, currentTabIsLoadingMore, searchQuery, handleLoadMore]);

  // Contextual primary header action
  const handlePrimaryAction = () => {
    switch (activeTab) {
      case 'missing':
        scopedNavigate('upload');
        break;
      case 'payable':
        scopedNavigate('invoices/inbound_nav');
        break;
      case 'bank':
        scopedNavigate('transactions');
        break;
      case 'receivables':
        scopedNavigate('invoices/outbound_nav');
        break;
    }
  };

  // Row action click handler: open itemized detail dialog
  const handleRowAction = (type: 'invoice' | 'tx', item: NavInvoiceItem | BankTransactionItem) => {
    if (type === 'invoice') {
      setSelectedInvoice(item as NavInvoiceItem);
      setIsInvoiceDialogOpen(true);
    } else {
      setSelectedTx(item as BankTransactionItem);
      setIsTxDialogOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      {/* 4 Interactive KPI Switcher Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Missing Vouchers (Urgent Action) */}
        <button
          type="button"
          data-testid="cockpit-tile-missing"
          onClick={() => setActiveTab('missing')}
          className={cn(
            "text-left p-3.5 rounded-xl border transition-all duration-200 relative overflow-hidden bg-card flex flex-col justify-between group",
            activeTab === 'missing'
              ? "border-destructive/60 bg-destructive/[0.03] shadow-card ring-1 ring-destructive/30"
              : "border-border/70 hover:border-border hover:shadow-sm"
          )}
        >
          <div
            className={cn(
              "absolute top-0 left-0 right-0 h-0.5 transition-colors",
              activeTab === 'missing' ? "bg-destructive" : "bg-transparent group-hover:bg-destructive/40"
            )}
          />
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              {t('dashboard:cockpit.missing_vouchers', 'Hiányzó bizonylatok')}
            </span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 transition-colors",
                missingTotalCount > 0
                  ? "bg-destructive/15 text-destructive border border-destructive/25"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {t('dashboard:cockpit.urgent_action', 'Sürgős')}
            </span>
          </div>
          <div className="text-2xl font-bold font-heading text-destructive tabular-nums tracking-tight">
            {missingLoading && !initialMissingData ? (
              <Skeleton className="h-7 w-16 rounded" />
            ) : (
              <>
                {missingTotalCount} <span className="text-sm font-normal text-muted-foreground">db</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate mt-1">
            {t('dashboard:cockpit.missing_sub', 'NAV-ban van, de nem található számlakép')}
          </div>
        </button>

        {/* 2. Unpaid Suppliers (Liquidity) */}
        <button
          type="button"
          data-testid="cockpit-tile-payable"
          onClick={() => setActiveTab('payable')}
          className={cn(
            "text-left p-3.5 rounded-xl border transition-all duration-200 relative overflow-hidden bg-card flex flex-col justify-between group",
            activeTab === 'payable'
              ? "border-amber-500/60 bg-amber-500/[0.03] shadow-card ring-1 ring-amber-500/30"
              : "border-border/70 hover:border-border hover:shadow-sm"
          )}
        >
          <div
            className={cn(
              "absolute top-0 left-0 right-0 h-0.5 transition-colors",
              activeTab === 'payable' ? "bg-amber-500" : "bg-transparent group-hover:bg-amber-500/40"
            )}
          />
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              {t('dashboard:cockpit.unpaid_suppliers', 'Kifizetetlen szállítók')}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 shrink-0">
              {t('dashboard:cockpit.liquidity', 'Likviditás')}
            </span>
          </div>
          <div className="text-xl md:text-2xl font-bold font-heading text-foreground tabular-nums tracking-tight truncate">
            {payableLoading && !initialPayableData ? (
              <Skeleton className="h-7 w-28 rounded" />
            ) : (
              formatCurrency(payableGrossTotal)
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate mt-1">
            {payableTotalCount}{' '}
            {t('dashboard:cockpit.inbound_unpaid_sub', 'db bejövő számla párosított banki tranzakció nélkül')}
          </div>
        </button>

        {/* 3. Unmatched Bank Movements (Reconciliation) */}
        <button
          type="button"
          data-testid="cockpit-tile-bank"
          onClick={() => setActiveTab('bank')}
          className={cn(
            "text-left p-3.5 rounded-xl border transition-all duration-200 relative overflow-hidden bg-card flex flex-col justify-between group",
            activeTab === 'bank'
              ? "border-primary/60 bg-primary/[0.03] shadow-card ring-1 ring-primary/30"
              : "border-border/70 hover:border-border hover:shadow-sm"
          )}
        >
          <div
            className={cn(
              "absolute top-0 left-0 right-0 h-0.5 transition-colors",
              activeTab === 'bank' ? "bg-primary" : "bg-transparent group-hover:bg-primary/40"
            )}
          />
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              {t('dashboard:cockpit.unmatched_bank', 'Párosítatlan bank')}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-primary/15 text-primary border border-primary/25 shrink-0">
              {t('dashboard:cockpit.reconciliation', 'Egyeztetés')}
            </span>
          </div>
          <div className="text-2xl font-bold font-heading text-foreground tabular-nums tracking-tight">
            {bankLoading && !initialBankData ? (
              <Skeleton className="h-7 w-16 rounded" />
            ) : (
              <>
                {bankTotalCount} <span className="text-sm font-normal text-muted-foreground">db</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate mt-1">
            {t('dashboard:cockpit.bank_sub', 'Kivonaton szerepel, nincs számlapár')}
          </div>
        </button>

        {/* 4. Receivables (Claims / Outbound Unpaid) */}
        <button
          type="button"
          data-testid="cockpit-tile-receivables"
          onClick={() => setActiveTab('receivables')}
          className={cn(
            "text-left p-3.5 rounded-xl border transition-all duration-200 relative overflow-hidden bg-card flex flex-col justify-between group",
            activeTab === 'receivables'
              ? "border-emerald-500/60 bg-emerald-500/[0.03] shadow-card ring-1 ring-emerald-500/30"
              : "border-border/70 hover:border-border hover:shadow-sm"
          )}
        >
          <div
            className={cn(
              "absolute top-0 left-0 right-0 h-0.5 transition-colors",
              activeTab === 'receivables' ? "bg-emerald-500" : "bg-transparent group-hover:bg-emerald-500/40"
            )}
          />
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              {t('dashboard:cockpit.receivables', 'Kintlévőség (Vevők)')}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0">
              {t('dashboard:cockpit.claim', 'Követelés')}
            </span>
          </div>
          <div className="text-xl md:text-2xl font-bold font-heading text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight truncate">
            {receivablesLoading && !initialReceivablesData ? (
              <Skeleton className="h-7 w-28 rounded" />
            ) : (
              formatCurrency(receivablesGrossTotal)
            )}
          </div>
          <div className="text-[11px] text-muted-foreground truncate mt-1">
            {receivablesTotalCount}{' '}
            {t('dashboard:cockpit.receivables_sub', 'db kimenő számla vár kifizetésre')}
          </div>
        </button>
      </div>

      {/* Unified Main Card */}
      <Card className="flex flex-col overflow-hidden border-border/80 shadow-card">
        {/* Dynamic Action Toolbar */}
        <div className="px-4 py-3 border-b border-border/40 bg-card flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Left Title & Status Indicator */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={cn(
                "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-sm",
                activeTab === 'missing' && "bg-destructive/10 text-destructive",
                activeTab === 'payable' && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                activeTab === 'bank' && "bg-primary/10 text-primary",
                activeTab === 'receivables' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {activeTab === 'missing' && <FileQuestion className="h-4 w-4" />}
              {activeTab === 'payable' && <CreditCard className="h-4 w-4" />}
              {activeTab === 'bank' && <Landmark className="h-4 w-4" />}
              {activeTab === 'receivables' && <ArrowUpRight className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground truncate">
                  {activeTab === 'missing' &&
                    t('dashboard:cockpit.missing_vouchers_title', 'Hiányzó bizonylatok (NAV számlák csatolmány nélkül)')}
                  {activeTab === 'payable' &&
                    t('dashboard:cockpit.unpaid_suppliers_title', 'Kifizetetlen szállítói számlák (Banki kifizetésre vár)')}
                  {activeTab === 'bank' &&
                    t('dashboard:cockpit.unmatched_bank_title', 'Párosítatlan banki mozgások (Számlapár nélkül)')}
                  {activeTab === 'receivables' &&
                    t('dashboard:cockpit.receivables_title', 'Kintlévőségek (Vevői számlák kifizetésre várva)')}
                </h3>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground tabular-nums shrink-0">
                  {activeBadgeCount} {t('dashboard:unmatched_items.items', 'tétel')}
                </span>
              </div>
            </div>
          </div>

          {/* Right Controls: Search + Contextual Action */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('dashboard:cockpit.search_placeholder', 'Gyorskeresés partnerre vagy számra...')}
                className="w-full h-8 pl-8 pr-7 text-xs rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Primary Action Button */}
            <Button
              size="sm"
              data-testid="cockpit-header-action-btn"
              onClick={handlePrimaryAction}
              className={cn(
                "h-8 text-xs font-semibold gap-1.5 shrink-0 shadow-sm",
                activeTab === 'missing' && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                activeTab === 'payable' && "bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500",
                activeTab === 'bank' && "bg-primary text-primary-foreground hover:bg-primary/90",
                activeTab === 'receivables' && "bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              {activeTab === 'missing' && (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  <span>{t('dashboard:cockpit.batch_upload', 'Bizonylatfeltöltés')}</span>
                </>
              )}
              {activeTab === 'payable' && (
                <>
                  <CreditCard className="h-3.5 w-3.5" />
                  <span>{t('dashboard:cockpit.pay_or_match', 'Párosítás')}</span>
                </>
              )}
              {activeTab === 'bank' && (
                <>
                  <Landmark className="h-3.5 w-3.5" />
                  <span>{t('dashboard:cockpit.pay_or_match', 'Párosítás')}</span>
                </>
              )}
              {activeTab === 'receivables' && (
                <>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>{t('dashboard:cockpit.pay_or_match', 'Párosítás')}</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Dense List Body (ScrollArea with fixed height) */}
        <CardContent className="p-0 flex-1 overflow-hidden min-h-[380px] max-h-[460px]">
          {isCurrentTabInitialLoading ? (
            /* Tab Loading Skeleton Rows */
            <div data-testid="cockpit-skeleton-list" className="p-3 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <CockpitRowSkeleton key={i} />
              ))}
            </div>
          ) : activeListLength === 0 ? (
            /* Empty State */
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground my-8">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {searchQuery
                  ? t('common:no_results', 'Nincs találat a keresésre.')
                  : activeTab === 'missing'
                  ? t('dashboard:cockpit.no_missing', 'Minden NAV számlához fel van töltve bizonylat!')
                  : activeTab === 'payable'
                  ? t('dashboard:cockpit.no_payable', 'Nincsenek kifizetetlen szállítói számlák.')
                  : activeTab === 'bank'
                  ? t('dashboard:cockpit.no_bank_unmatched', 'Minden banki tranzakció párosítva van!')
                  : t('dashboard:cockpit.no_receivables', 'Nincsenek kifizetetlen vevői számlák.')}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                {searchQuery
                  ? t('common:try_different_search', 'Próbálkozz más kifejezéssel vagy töröld a keresést.')
                  : t('dashboard:unmatched_items.empty_desc', 'Nincsenek nyitott teendők ebben a kategóriában.')}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[440px] px-3 py-1 [&>div>div[style]]:!block">
              <div className="divide-y divide-border/30 w-full min-w-0 pb-1">
                {/* 1. Missing Vouchers List */}
                {activeTab === 'missing' &&
                  filteredMissing.map((inv) => {
                    const partnerName = getPartnerName(inv.supplier_tax_number, inv.supplier_name);
                    return (
                      <div
                        key={inv.id}
                        data-testid="cockpit-row"
                        onClick={() => handleRowAction('invoice', inv)}
                        className="flex items-center justify-between py-2 px-2 hover:bg-muted/40 rounded-md transition-colors cursor-pointer group gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex items-center justify-center shrink-0 text-xs">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors block">
                              {inv.invoice_number}
                            </span>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {partnerName} {inv.supplier_tax_number ? `• ${inv.supplier_tax_number}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-semibold tabular-nums text-foreground">
                              {formatCurrency(inv.invoice_gross_amount || 0)}
                            </div>
                            <div className="text-[10px] text-muted-foreground tabular-nums">
                              {inv.invoice_delivery_date
                                ? `Fiz. hat.: ${formatDateSafe(inv.invoice_delivery_date)}`
                                : formatDateSafe(inv.invoice_issue_date)}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    );
                  })}

                {/* 2. Unpaid Suppliers List */}
                {activeTab === 'payable' &&
                  filteredPayable.map((inv) => {
                    const partnerName = inv.supplier_name || '-';
                    return (
                      <div
                        key={inv.id}
                        data-testid="cockpit-row"
                        onClick={() => handleRowAction('invoice', inv)}
                        className="flex items-center justify-between py-2 px-2 hover:bg-muted/40 rounded-md transition-colors cursor-pointer group gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 text-xs">
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors block">
                              {inv.invoice_number}
                            </span>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {partnerName} {inv.payment_method ? `• ${inv.payment_method}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-semibold tabular-nums text-foreground">
                              {formatCurrency(inv.invoice_gross_amount || 0)}
                            </div>
                            <div className="text-[10px] text-muted-foreground tabular-nums">
                              {formatDateSafe(inv.invoice_issue_date)}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    );
                  })}

                {/* 3. Unmatched Bank Movements List */}
                {activeTab === 'bank' &&
                  filteredBank.map((tx) => {
                    const isExpense = (tx.amount || 0) < 0;
                    return (
                      <div
                        key={tx.id}
                        data-testid="cockpit-row"
                        onClick={() => handleRowAction('tx', tx)}
                        className="flex items-center justify-between py-2 px-2 hover:bg-muted/40 rounded-md transition-colors cursor-pointer group gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 text-xs">
                            <Landmark className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors block">
                              {tx.description || t('dashboard:unmatched_items.transactions', 'Tranzakció')}
                            </span>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {formatDateSafe(tx.transaction_date)} {tx.type ? `• ${tx.type}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div
                              className={cn(
                                "text-xs font-semibold tabular-nums",
                                isExpense ? "text-foreground" : "text-emerald-600 dark:text-emerald-400"
                              )}
                            >
                              {formatCurrency(tx.amount || 0)}
                            </div>
                            <div className="text-[10px] text-muted-foreground tabular-nums">
                              {formatDateSafe(tx.transaction_date)}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    );
                  })}

                {/* 4. Receivables (Customer Invoices) List */}
                {activeTab === 'receivables' &&
                  filteredReceivables.map((inv) => {
                    const partnerName = inv.customer_name || '-';
                    return (
                      <div
                        key={inv.id}
                        data-testid="cockpit-row"
                        onClick={() => handleRowAction('invoice', inv)}
                        className="flex items-center justify-between py-2 px-2 hover:bg-muted/40 rounded-md transition-colors cursor-pointer group gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 text-xs">
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors block">
                              {inv.invoice_number}
                            </span>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {partnerName} {inv.payment_method ? `• ${inv.payment_method}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(inv.invoice_gross_amount || 0)}
                            </div>
                            <div className="text-[10px] text-muted-foreground tabular-nums">
                              {formatDateSafe(inv.invoice_issue_date)}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    );
                  })}

                {/* Optimistic Load More Skeleton Feedback */}
                {currentTabIsLoadingMore && (
                  <div data-testid="cockpit-loading-more-skeleton" className="pt-1 pb-1 space-y-1">
                    <CockpitRowSkeleton />
                    <CockpitRowSkeleton />
                  </div>
                )}

                {/* Bottom Sentinel for Progressive Infinite Scroll */}
                <div ref={sentinelRef} className="h-4 w-full pointer-events-none" />
              </div>
            </ScrollArea>
          )}
        </CardContent>

        {/* Card Footer: Pro Tip & Direct Deep-link */}
        <div className="px-4 py-2.5 border-t border-border/40 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs shrink-0">
          <span className="text-[11px] text-muted-foreground">
            {t('dashboard:cockpit.tip', 'Tipp: A feltöltött PDF-ekből és képekből az AI automatikusan kinyeri a tételeket és összepárosítja a NAV adatokkal.')}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrimaryAction}
            className="h-6 px-2 text-[11px] font-medium text-foreground hover:text-primary gap-1 shrink-0 self-end sm:self-auto"
          >
            <span>{t('dashboard:cockpit.view_all', 'Részletes táblázat megnyitása')}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </Card>

      {/* Itemized Detail Dialogs */}
      {selectedInvoice && (
        <InvoiceItemsDialog
          open={isInvoiceDialogOpen}
          onOpenChange={(open) => {
            setIsInvoiceDialogOpen(open);
            if (!open) setSelectedInvoice(null);
          }}
          invoiceId={selectedInvoice.id}
          invoiceNumber={selectedInvoice.invoice_number}
          currency={selectedInvoice.currency || 'HUF'}
          source="nav"
          invoiceDate={selectedInvoice.invoice_issue_date || undefined}
          supplierName={selectedInvoice.supplier_name || selectedInvoice.customer_name || undefined}
          invoiceDirection={
            selectedInvoice.invoice_direction || (activeTab === 'receivables' ? 'OUTBOUND' : 'INBOUND')
          }
        />
      )}

      {selectedTx && (
        <TransactionDetailsDialog
          open={isTxDialogOpen}
          onOpenChange={(open) => {
            setIsTxDialogOpen(open);
            if (!open) setSelectedTx(null);
          }}
          transaction={selectedTx as any}
          companyId={companyId}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ['cockpitBankTransactions', companyId] });
            queryClient.invalidateQueries({ queryKey: ['cockpitPayableInvoices', companyId] });
            queryClient.invalidateQueries({ queryKey: ['cockpitReceivablesInvoices', companyId] });
            queryClient.invalidateQueries({ queryKey: ['cockpitMissingVouchers', companyId] });
            queryClient.invalidateQueries({ queryKey: ['cockpitNavAggregates', companyId] });
            queryClient.invalidateQueries({ queryKey: ['unmatchedTransactions', companyId] });
            queryClient.invalidateQueries({ queryKey: ['unmatchedNavInvoices', companyId] });
            queryClient.invalidateQueries({ queryKey: ['invoiceStatusMissing', companyId] });
          }}
        />
      )}
    </div>
  );
}
