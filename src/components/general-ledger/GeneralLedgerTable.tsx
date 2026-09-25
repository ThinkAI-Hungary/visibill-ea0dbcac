import React, { useState, useMemo, forwardRef, useImperativeHandle, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn, fixCharacterEncoding } from '@/lib/utils';
import { getLocalizedGlAccountName, getLocalizedGlItemType, getLocalizedGlItemDescription } from '@/lib/glUtils';
import { useCompanyJurisdiction } from '@/hooks/useCompanyJurisdiction';
import { ChevronDown, ChevronRight, Maximize2, Minimize2, Loader2, RefreshCw, Edit2, X, Check, ChevronsUpDown, FileText, Search, ArrowRightLeft } from 'lucide-react';
import { exportGlExcel, exportGlAnalyticalExcel } from '@/lib/glExport';
import { fetchAllGlBalances, fetchAllGlCategorizedItems, fetchGlItemsForAccount, GlDateBasis, GlPostingStatus, GlSearchResult } from '@/lib/glData';
import { GlItemGroupingMode, enrichGlItemsWithInvoiceMeta, groupLedgerItemsByInvoice } from '@/lib/glInvoiceGrouping';
export type { GlItemGroupingMode };
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from '@/components/ui/skeleton';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useAuth } from '@/contexts/AuthContext';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Button } from "@/components/ui/button";
import { FloatingBulkBar } from '@/components/ui/floating-bulk-bar';
import { useCompany } from '@/contexts/CompanyContext';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { reportError } from '@/lib/errorReporter';

import { formatNumberLocale } from '@/lib/locale/formatters';

interface LedgerItem {
  id: string; // Fők.szám
  name: string; // Megnevezés
  balance: number; // Összesített Egyenleg
  debitTurnover?: number; // Tartozik forgalom
  creditTurnover?: number; // Követel forgalom
  hasChildren?: boolean;
  hasAccountChildren?: boolean;
  hasItemChildren?: boolean;
  cid: string;
  isItem?: boolean;
  itemType?: string;
  partner?: string | null;
  date?: string | null;
  sourceTable?: string;
  originalGlId?: string | null;
  originalAmount?: number;
  originalCurrency?: string;
  isExcluded?: boolean;
  isTemporary?: boolean;
  itemCount?: number;
  finalBalance?: number;
  tempBalance?: number;
  directFinalBalance?: number;
  directTempBalance?: number;
  directItemCount?: number;
  glAccountId?: string | null;
  isLoadingRow?: boolean;
  isLoadMoreRow?: boolean;
  targetCid?: string;
  isLoadingMore?: boolean;
  ancestorIds?: string[];
  depth?: number;
  isRoot?: boolean;
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  groupedCount?: number;
  groupedItemIds?: string[];
  groupedDescriptions?: string[];
}

const formatCurrency = (value: number) => {
  if (value === 0) return '0,00';
  return formatNumberLocale(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

function cleanIdVal(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().replace(/\./g, '');
}

export interface GeneralLedgerTableRef {
  expandAllAndPrint: () => void;
  exportExcel: (companyName?: string, options?: { excludeZeroRows?: boolean }) => Promise<void>;
  exportAnalyticalExcel: (companyName?: string, options?: { excludeZeroRows?: boolean }) => Promise<void>; // F6
  getStats: () => { accountCount: number; leafCount: number; totalDebit: number; totalCredit: number };
  expandAll: () => void;
  collapseAll: () => void;
  navigateToEntity: (result: GlSearchResult) => Promise<void>;
}

export type GlViewGranularity = 'kontirok' | 'teteles';

interface GeneralLedgerTableProps {
  presetId?: string;
  dateFrom?: string;
  dateTo?: string;
  dateBasis?: GlDateBasis;
  postingStatus?: GlPostingStatus;
  hideZeroBalances?: boolean;
  globalSearch?: string;
  searchQuery?: string;
  searchResults?: GlSearchResult[];
  isPolling?: boolean; // P4: only poll when AI/import is running
  onStatsChange?: (stats: { accountCount: number; leafCount: number; totalDebit: number; totalCredit: number; classifiedItems: number; totalItems: number }) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  printLayoutMode?: 'synthetic' | 'analytical';
  viewLayout?: 'summary' | 'classic';
  viewGranularity?: GlViewGranularity;
  itemGrouping?: GlItemGroupingMode;
}

interface LoadMoreSentinelRowProps {
  row: LedgerItem;
  hiddenClass: string;
  indentPadding: string;
  onLoadMore: (cid: string) => void;
  viewLayout?: 'summary' | 'classic';
  gridColsClass?: string;
}

function LoadMoreSentinelRow({ row, hiddenClass, indentPadding, onLoadMore, viewLayout = 'summary', gridColsClass = 'grid-cols-12' }: LoadMoreSentinelRowProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const targetCid = row.targetCid!;
  const isLoadingMore = !!row.isLoadingMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore(targetCid);
        }
      },
      { rootMargin: '250px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [targetCid, isLoadingMore, onLoadMore]);

  return (
    <div
      ref={sentinelRef}
      onClick={() => !isLoadingMore && onLoadMore(targetCid)}
      className={cn(
        "grid divide-x divide-border/10 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer py-2.5 items-center select-none border-b border-border/20",
        gridColsClass,
        hiddenClass
      )}
    >
      <div className={cn(viewLayout === 'classic' ? "p-2" : "col-span-2 p-2", "flex items-center justify-center")}>
        {isLoadingMore ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-primary" />
        )}
      </div>
      <div className={cn(viewLayout === 'classic' ? "col-span-3 py-1 pr-3" : "col-span-7 py-1 pr-3", "text-xs flex items-center gap-2 font-medium text-primary")} style={{ paddingLeft: indentPadding }}>
        <span>{isLoadingMore ? t('accounting:general_ledger.load_more.loading_more', 'Következő 100 tétel betöltése...') : row.name}</span>
      </div>
      <div className={cn(viewLayout === 'classic' ? "col-span-2 p-2" : "col-span-3 p-2", "flex justify-end items-center text-[11px] text-muted-foreground pr-4 font-mono")}>
        {isLoadingMore ? t('accounting:general_ledger.load_more.loading', 'Betöltés...') : t('accounting:general_ledger.load_more.scroll_or_click', 'Görgess vagy kattints')}
      </div>
    </div>
  );
}

function GeneralLedgerTableBase(props: GeneralLedgerTableProps, ref: React.ForwardedRef<GeneralLedgerTableRef>) {
  const { t } = useTranslation(['accounting', 'common']);
  const {
    presetId,
    dateFrom,
    dateTo,
    dateBasis = 'kibocsatas',
    postingStatus = 'all',
    hideZeroBalances = false,
    searchQuery = '',
    searchResults = [],
    isPolling,
    onStatsChange,
    onLoadingChange,
    printLayoutMode = 'analytical',
    viewLayout = 'summary',
    viewGranularity = 'kontirok',
    itemGrouping = 'by_invoice',
  } = props;
  const { selectedCompany } = useCompany();
  const { isCroatia, defaultCurrency } = useCompanyJurisdiction();
  const currencyLabel = defaultCurrency === 'HUF' ? 'Ft' : defaultCurrency;
  const { session } = useAuth();
  const { toast } = useToast();

  // Dialog states for editing GL classification
  const [editingItem, setEditingItem] = useState<LedgerItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [dialogSearchQuery, setDialogSearchQuery] = useState('');
  const [selectedNewGL, setSelectedNewGL] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAiReclassifying, setIsAiReclassifying] = useState(false);
  const [dismissedBannerForPreset, setDismissedBannerForPreset] = useState<string | null>(null);
  
  // Track if the user explicitly switched presets during this session
  const previousPresetIdRef = useRef<string | undefined>(presetId);
  const [hasSwitchedPreset, setHasSwitchedPreset] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Determine if an actual switch happened (not just initial data load)
    if (previousPresetIdRef.current && presetId && presetId !== previousPresetIdRef.current) {
      setHasSwitchedPreset(true);
      setDismissedBannerForPreset(null); // Reset dismissal on switch
    }
    if (presetId) {
      previousPresetIdRef.current = presetId;
    }
  }, [presetId]);

  const DEFAULT_EXPANDED_IDS = ['1', '2', '3', '31', '311', '4', '45', '454', '46', '466', '5', '8', '9', 'UNCLASSIFIED'];

  // Cache tree expansion state in localStorage
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`visibill_gl_expanded_v2_${presetId}_${selectedCompany?.id}`);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (e) {}
    return new Set(DEFAULT_EXPANDED_IDS);
  });
  
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!presetId || !selectedCompany?.id) return;
    try {
      const stored = localStorage.getItem(`visibill_gl_expanded_v2_${presetId}_${selectedCompany.id}`);
      if (stored) {
        setExpandedRowIds(new Set(JSON.parse(stored)));
      } else {
        setExpandedRowIds(new Set(DEFAULT_EXPANDED_IDS));
      }
    } catch (e) {
      setExpandedRowIds(new Set(DEFAULT_EXPANDED_IDS));
    }
  }, [presetId, selectedCompany?.id]);

  useEffect(() => {
    if (!presetId || !selectedCompany?.id) return;
    try {
      localStorage.setItem(
        `visibill_gl_expanded_v2_${presetId}_${selectedCompany.id}`,
        JSON.stringify(Array.from(expandedRowIds))
      );
    } catch (e) {}
  }, [expandedRowIds, presetId, selectedCompany?.id]);
  
  const [hideBannerNextTime, setHideBannerNextTime] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const { data: exchangeRates } = useExchangeRates();

  // Fetch real data for the preset and company using the new RPC (paginated)
  const { data: dbData, isLoading, isFetching, refetch: refetchBalances } = useQuery({
    queryKey: ['glBalances', presetId, selectedCompany?.id, dateFrom, dateTo, dateBasis, postingStatus],
    queryFn: async () => {
      if (!presetId || !selectedCompany?.id) return [];
      
      try {
        return await fetchAllGlBalances({
          companyId: selectedCompany.id,
          presetId,
          dateFrom,
          dateTo,
          dateBasis,
          postingStatus,
          exchangeRates: exchangeRates || {},
        });
      } catch (error: any) {
        reportError({ type: 'db_query', component: 'GeneralLedgerTable', action: 'error', message: 'Error fetching GL balances:', error });
        return [];
      }
    },
    enabled: !!presetId && !!selectedCompany?.id && !!exchangeRates,
    refetchInterval: isPolling ? 3000 : false, // P4: conditional polling
    placeholderData: isPolling ? (prev: any) => prev : undefined,
  });

  // Batch categorized items query for 'teteles' mode (prevents N+1 on-demand fetches)
  const { data: batchCategorizedItems, isLoading: isBatchItemsLoading } = useQuery({
    queryKey: ['glCategorizedItems', presetId, selectedCompany?.id, dateFrom, dateTo, dateBasis, postingStatus],
    queryFn: async () => {
      if (!presetId || !selectedCompany?.id) return [];
      try {
        const raw = await fetchAllGlCategorizedItems({
          companyId: selectedCompany.id,
          presetId,
          dateFrom,
          dateTo,
          dateBasis,
          postingStatus,
          exchangeRates: exchangeRates || {},
        });
        return await enrichGlItemsWithInvoiceMeta(raw);
      } catch (error: any) {
        reportError({ type: 'db_query', component: 'GeneralLedgerTable', action: 'error', message: 'Error fetching categorized GL items:', error });
        return [];
      }
    },
    enabled: viewGranularity === 'teteles' && !!presetId && !!selectedCompany?.id,
    staleTime: 60 * 1000,
  });

  const rawBatchItemsByGL = useMemo(() => {
    if (!batchCategorizedItems || batchCategorizedItems.length === 0 || !dbData) return null;
    const cleanId = cleanIdVal;
    const glIdToCid = new Map<string, string>();
    dbData.forEach(d => {
      if (d.gl_account_id) {
        glIdToCid.set(d.gl_account_id, cleanId(d.gl_number));
      }
    });

    const itemsMap = new Map<string, LedgerItem[]>();
    batchCategorizedItems.filter(i => !i.is_excluded).forEach(item => {
      const isUnclass = !item.gl_account_id || item.gl_account_id === '00000000-0000-0000-0000-000000000000';
      const parentCid = isUnclass ? 'UNCLASSIFIED' : glIdToCid.get(item.gl_account_id);
      if (!parentCid) return;
      const pseudoCid = `${parentCid}_${item.item_id}`;

      let displayDesc = item.description || item.partner || 'Névtelen tétel';
      if (item.partner && item.description && item.partner !== item.description) {
        displayDesc = `${item.partner} - ${item.description}`;
      }
      displayDesc = fixCharacterEncoding(displayDesc);

      if (!itemsMap.has(parentCid)) {
        itemsMap.set(parentCid, []);
      }
      itemsMap.get(parentCid)!.push({
        id: `item_${item.item_id}`,
        name: displayDesc,
        balance: Number(item.amount) || 0,
        hasChildren: false,
        cid: pseudoCid,
        isItem: true,
        itemType: fixCharacterEncoding(item.item_type),
        partner: fixCharacterEncoding(item.partner),
        date: item.item_date,
        sourceTable: item.source_table,
        originalGlId: item.gl_account_id,
        originalAmount: Number(item.original_amount) || 0,
        originalCurrency: item.original_currency,
        isTemporary: (!item.gl_account_id || item.gl_account_id === '00000000-0000-0000-0000-000000000000' || item.is_temporary),
        invoiceId: item.invoice_id || null,
        invoiceNumber: item.invoice_number || null,
      });
    });
    return itemsMap;
  }, [batchCategorizedItems, dbData]);

  const batchItemsByGL = useMemo(() => {
    if (!rawBatchItemsByGL) return null;
    const groupedMap = new Map<string, LedgerItem[]>();
    rawBatchItemsByGL.forEach((items, cid) => {
      groupedMap.set(cid, groupLedgerItemsByInvoice(items, itemGrouping));
    });
    return groupedMap;
  }, [rawBatchItemsByGL, itemGrouping]);

  // Keep track of user's expansion state when toggling between kontirok and teteles modes
  const savedKontirokExpandedRef = useRef<Set<string> | null>(null);
  const prevViewGranularityRef = useRef<GlViewGranularity>(viewGranularity);

  useEffect(() => {
    const isGranularityChange = prevViewGranularityRef.current !== viewGranularity;
    prevViewGranularityRef.current = viewGranularity;

    if (viewGranularity === 'teteles') {
      if (isGranularityChange) {
        if (!savedKontirokExpandedRef.current) {
          savedKontirokExpandedRef.current = new Set(expandedRowIds);
        }
        if (dbData && dbData.length > 0) {
          const allAccountIds = dbData.map(d => String(d.gl_number));
          setExpandedRowIds(new Set(allAccountIds));
        }
      }
    } else {
      if (isGranularityChange && savedKontirokExpandedRef.current) {
        setExpandedRowIds(savedKontirokExpandedRef.current);
        savedKontirokExpandedRef.current = null;
      }
    }
  }, [viewGranularity, dbData]);

  // On-demand loaded transaction items per account CID: Map<accountCid, LedgerItem[]>
  const [loadedRawAccountItems, setLoadedRawAccountItems] = useState<Map<string, LedgerItem[]>>(new Map());
  const [loadingAccountCids, setLoadingAccountCids] = useState<Set<string>>(new Set());
  const [hasMoreAccountCids, setHasMoreAccountCids] = useState<Set<string>>(new Set());
  const [loadingMoreAccountCids, setLoadingMoreAccountCids] = useState<Set<string>>(new Set());

  // Consolidated items according to itemGrouping mode ('by_invoice' vs 'detailed')
  const loadedAccountItems = useMemo(() => {
    const groupedMap = new Map<string, LedgerItem[]>();
    loadedRawAccountItems.forEach((items, cid) => {
      groupedMap.set(cid, groupLedgerItemsByInvoice(items, itemGrouping));
    });
    return groupedMap;
  }, [loadedRawAccountItems, itemGrouping]);

  // Reset loaded account items when filters change
  useEffect(() => {
    setLoadedRawAccountItems(new Map());
    setLoadingAccountCids(new Set());
    setHasMoreAccountCids(new Set());
    setLoadingMoreAccountCids(new Set());
  }, [presetId, selectedCompany?.id, dateFrom, dateTo, dateBasis, postingStatus]);

  // Filter change detection: whenever filters change, show skeleton until query finishes
  const currentFilterKey = `${presetId}_${selectedCompany?.id}_${dateFrom}_${dateTo}_${dateBasis}_${postingStatus}_${viewGranularity}`;
  const [renderedFilterKey, setRenderedFilterKey] = useState(currentFilterKey);

  const isFilterChanging = currentFilterKey !== renderedFilterKey;
  const isDataLoading = isLoading || (viewGranularity === 'teteles' && isBatchItemsLoading && !batchCategorizedItems) || isFilterChanging || !presetId || !dbData;

  useEffect(() => {
    if (isFilterChanging && !isFetching && !isBatchItemsLoading) {
      setRenderedFilterKey(currentFilterKey);
    }
  }, [isFilterChanging, isFetching, isBatchItemsLoading, currentFilterKey]);

  useEffect(() => {
    onLoadingChange?.(isDataLoading);
  }, [isDataLoading, onLoadingChange]);


  const [selectedLeafAccount, setSelectedLeafAccount] = useState<{ code: string; name: string } | null>(null);

  const { data: journalEntries, isLoading: isLoadingEntries } = useQuery({
    queryKey: ['glJournalEntries', selectedCompany?.id, presetId, selectedLeafAccount?.code],
    queryFn: async () => {
      if (!selectedCompany?.id || !presetId || !selectedLeafAccount?.code) return [];

      // Find active import first
      const { data: importData } = await supabase
        .from('gl_audit_imports')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .eq('preset_id', presetId)
        .eq('processing_status', 'completed')
        .eq('dry_run', false)
        .order('imported_at', { ascending: false })
        .limit(1);

      const activeImportId = importData?.[0]?.id;
      if (!activeImportId) return [];

      // Fetch entries for this account and import
      const { data, error } = await supabase
        .from('gl_journal_entries')
        .select('*')
        .eq('import_id', activeImportId)
        .or(`debit_account.eq.${selectedLeafAccount.code},credit_account.eq.${selectedLeafAccount.code}`)
        .order('voucher_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedLeafAccount && !!selectedCompany?.id && !!presetId,
  });

  const handleRefetchAll = () => {
    refetchBalances();
    setLoadedRawAccountItems(new Map());
  };


  // NOTE: Realtime subscription for GL tables (transactions, invoice_items,
  // nav_invoices, nav_invoice_items) is handled globally by LiveNotificationProvider.
  // No duplicate channel needed here — it already invalidates the relevant query caches.

  const handleSaveOverride = async () => {
    const itemsToUpdate = editingItem ? [editingItem] : tableData.filter(d => selectedItemIds.has(d.id) || (d.groupedItemIds && d.groupedItemIds.some(gid => selectedItemIds.has(gid))));
    if (itemsToUpdate.length === 0 || !selectedNewGL || !selectedCompany?.id || !session?.user.id) return;
    
    setIsSubmitting(true);
    
    const newGlItem = selectedNewGL === 'UNCLASSIFIED' ? null : dbData?.find(gl => gl.gl_account_id === selectedNewGL);
    const newGlNumber = newGlItem?.gl_number || '';

    const payloadItems: { item_id: string; source_table: string; original_gl_account_id: string | null }[] = [];
    const seenItemIds = new Set<string>();

    itemsToUpdate.forEach(item => {
      if (item.groupedItemIds && item.groupedItemIds.length > 0) {
        item.groupedItemIds.forEach(gid => {
          const rawId = gid.replace('item_', '');
          if (!seenItemIds.has(rawId)) {
            seenItemIds.add(rawId);
            payloadItems.push({
              item_id: rawId,
              source_table: item.sourceTable || '',
              original_gl_account_id: item.originalGlId || null
            });
          }
        });
      } else {
        const rawId = item.id.replace('item_', '');
        if (!seenItemIds.has(rawId)) {
          seenItemIds.add(rawId);
          payloadItems.push({
            item_id: rawId,
            source_table: item.sourceTable || '',
            original_gl_account_id: item.originalGlId || null
          });
        }
      }
    });

    const { data, error } = await supabase.rpc('override_gl_classifications_batch', {
       p_items: payloadItems,
       p_new_gl_account_id: selectedNewGL === 'UNCLASSIFIED' ? null : selectedNewGL,
       p_company_id: selectedCompany.id,
       p_user_id: session.user.id,
       p_preset_id: presetId as string,
       p_new_gl_number: newGlNumber
    });
    
    setIsSubmitting(false);
    
    if (error || data === false) {
       const errMsg = error?.message || "SQL Exception (csendben elfojtva). Ellenőrizd a függvényt.";
       reportError({ type: 'db_query', component: 'GeneralLedgerTable', action: 'error', message: 'Hiba módosításkor:', error: error || "SQL Exception caught inside RPC. Check logs." });
       toast({ title: 'Hiba a mentés során', description: errMsg, variant: 'destructive' });
    } else {
       toast({ title: 'Sikeres módosítás', description: `${itemsToUpdate.length} tétel sikeresen felülírva.`, className: 'bg-green-50 text-green-900 border-green-200' });
       setIsEditOpen(false);
       setSelectedItemIds(new Set());
       handleRefetchAll();
    }
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const normalizeText = useCallback((text: string) =>
    (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
  []);

  // Calculate actual table data
  const tableData = useMemo(() => {
    const cleanId = cleanIdVal;
    
    if (dbData && dbData.length > 0) {
      // Step 1: Pre-calculate raw nodes and index in Map for O(1) prefix lookup
      const nodeMap = new Map<string, LedgerItem>();
      const rawData: LedgerItem[] = dbData.map(dbItem => {
        const cid = cleanId(dbItem.gl_number);
        const directItemCount = Number(dbItem.item_count) || 0;
        const hasItemChildren = directItemCount > 0;
        
        const item: LedgerItem = {
          id: String(dbItem.gl_number),
          name: getLocalizedGlAccountName(dbItem.gl_number, fixCharacterEncoding(dbItem.short_name), t, isCroatia),
          glAccountId: dbItem.gl_account_id,
          balance: Number(dbItem.total_balance) || 0,
          debitTurnover: 0,
          creditTurnover: 0,
          directFinalBalance: Number(dbItem.final_balance) || 0,
          directTempBalance: Number(dbItem.temp_balance) || 0,
          directItemCount,
          hasChildren: false,
          hasAccountChildren: false,
          hasItemChildren,
          cid
        };
        nodeMap.set(cid, item);
        return item;
      });

      // Step 2: Build parent-child tree hierarchy in O(N) using prefix search in nodeMap
      const directParentMap = new Map<string, LedgerItem>();
      const childrenMap = new Map<string, LedgerItem[]>();
      const roots: LedgerItem[] = [];

      rawData.forEach(node => {
        let directParent: LedgerItem | null = null;
        if (node.cid !== 'UNCLASSIFIED') {
          for (let len = node.cid.length - 1; len >= 1; len--) {
            const prefix = node.cid.slice(0, len);
            const candidate = nodeMap.get(prefix);
            if (candidate) {
              directParent = candidate;
              break;
            }
          }
        }

        if (!directParent) {
          roots.push(node);
        } else {
          directParentMap.set(node.cid, directParent);
          if (!childrenMap.has(directParent.cid)) {
            childrenMap.set(directParent.cid, []);
          }
          childrenMap.get(directParent.cid)!.push(node);
        }
      });

      // Step 3: Flag nodes with account children and precalculate depth / ancestor IDs
      rawData.forEach(node => {
        const hasAccountChildren = (childrenMap.get(node.cid)?.length ?? 0) > 0;
        node.hasAccountChildren = hasAccountChildren;
        const hasBatchItems = batchItemsByGL ? (batchItemsByGL.get(node.cid)?.length ?? 0) > 0 : false;
        node.hasChildren = hasAccountChildren || !!node.hasItemChildren || hasBatchItems;
      });

      // Step 4: Fast balance & turnover rollup in O(N) by traversing ancestors
      rawData.forEach(node => {
        node.finalBalance = node.directFinalBalance || 0;
        node.tempBalance = node.directTempBalance || 0;
        if (!node.hasAccountChildren) {
          node.debitTurnover = node.balance > 0 ? node.balance : 0;
          node.creditTurnover = node.balance < 0 ? Math.abs(node.balance) : 0;
        } else {
          node.debitTurnover = 0;
          node.creditTurnover = 0;
        }
      });

      rawData.forEach(d => {
        let ancestor = directParentMap.get(d.cid);
        while (ancestor) {
          ancestor.finalBalance = (ancestor.finalBalance || 0) + (d.directFinalBalance || 0);
          ancestor.tempBalance = (ancestor.tempBalance || 0) + (d.directTempBalance || 0);
          if (!d.hasAccountChildren) {
            if (d.balance > 0) {
              ancestor.debitTurnover = (ancestor.debitTurnover || 0) + d.balance;
            }
            if (d.balance < 0) {
              ancestor.creditTurnover = (ancestor.creditTurnover || 0) + Math.abs(d.balance);
            }
          }
          ancestor = directParentMap.get(ancestor.cid);
        }
      });

      rawData.forEach(node => {
        node.balance = (node.finalBalance || 0) + (node.tempBalance || 0);
      });

      // Step 5: Precalculate ancestor IDs, depth, and isRoot for instant visibility checks
      const ancestorIdsMap = new Map<string, string[]>();
      const getAncestorIds = (cid: string): string[] => {
        if (ancestorIdsMap.has(cid)) return ancestorIdsMap.get(cid)!;
        const parent = directParentMap.get(cid);
        if (!parent) {
          ancestorIdsMap.set(cid, []);
          return [];
        }
        const ancestors = [parent.id, ...getAncestorIds(parent.cid)];
        ancestorIdsMap.set(cid, ancestors);
        return ancestors;
      };

      rawData.forEach(node => {
        const aIds = getAncestorIds(node.cid);
        node.ancestorIds = aIds;
        node.depth = aIds.length;
        node.isRoot = aIds.length === 0;
      });

      // ── Hierarchical search filter computation ──
      const isSearchActive = !!searchQuery && searchQuery.trim().length > 0;
      let visibleAccountCids: Set<string> | null = null;
      const directMatchAccountCids = new Set<string>();
      const itemMatchAccountCids = new Set<string>();

      if (isSearchActive) {
        const normQ = normalizeText(searchQuery.trim());
        const cleanQ = cleanId(searchQuery);

        // 1. Check account numbers and names
        rawData.forEach(node => {
          const normName = normalizeText(node.name);
          const normNum = normalizeText(node.id);
          const cid = node.cid;
          if (
            (cleanQ && (cid === cleanQ || cid.startsWith(cleanQ) || cid.includes(cleanQ))) ||
            normNum.includes(normQ) ||
            normName.includes(normQ)
          ) {
            directMatchAccountCids.add(cid);
          }
        });

        // 2. Check searchResults (from backend DB search)
        searchResults.forEach(res => {
          const targetGl = res.target_gl_number || res.gl_number;
          if (targetGl) {
            const cid = targetGl === 'UNCLASSIFIED' ? 'UNCLASSIFIED' : cleanId(targetGl);
            if (cid) {
              if (res.entity_type === 'account') {
                directMatchAccountCids.add(cid);
              } else {
                itemMatchAccountCids.add(cid);
              }
            }
          }
        });

        // 3. Check loadedAccountItems
        loadedAccountItems.forEach((items, cid) => {
          const hasMatchingItem = items.some(it => {
            const normItemName = normalizeText(it.name);
            const normPartner = normalizeText(it.partner || '');
            const normType = normalizeText(it.itemType || '');
            const dateStr = it.date || '';
            const amountStr = String(it.balance || '');
            return normItemName.includes(normQ) ||
                   normPartner.includes(normQ) ||
                   normType.includes(normQ) ||
                   dateStr.includes(normQ) ||
                   amountStr.includes(normQ);
          });
          if (hasMatchingItem) {
            itemMatchAccountCids.add(cid);
          }
        });

        // All matched account CIDs
        const allMatched = new Set<string>([...directMatchAccountCids, ...itemMatchAccountCids]);

        // If an account is directly matched, all of its descendant accounts are also visible
        if (directMatchAccountCids.size > 0) {
          rawData.forEach(d => {
            if (!allMatched.has(d.cid)) {
              let curr = directParentMap.get(d.cid);
              while (curr) {
                if (directMatchAccountCids.has(curr.cid)) {
                  allMatched.add(d.cid);
                  break;
                }
                curr = directParentMap.get(curr.cid);
              }
            }
          });
        }

        // Build visible set including all ancestor paths in O(depth)
        visibleAccountCids = new Set<string>();
        allMatched.forEach(cid => {
          visibleAccountCids!.add(cid);
          let curr = directParentMap.get(cid);
          while (curr) {
            visibleAccountCids!.add(curr.cid);
            curr = directParentMap.get(curr.cid);
          }
        });
      }

      // ── Zero balances filter computation in O(depth) ──
      let activeAccountCids: Set<string> | null = null;
      if (hideZeroBalances) {
        activeAccountCids = new Set<string>();

        const isDirectlyActive = (d: LedgerItem) => {
          const hasDirectItems = (d.directItemCount !== undefined && d.directItemCount > 0) ||
            ((loadedAccountItems.get(d.cid)?.length ?? 0) > 0);
          const hasDirectBalance = Math.abs(d.directFinalBalance || 0) > 0.001 ||
            Math.abs(d.directTempBalance || 0) > 0.001 ||
            (!d.hasAccountChildren && Math.abs(d.balance || 0) > 0.001);
          const hasTurnover = !d.hasAccountChildren && (
            (d.debitTurnover !== undefined && d.debitTurnover > 0.001) ||
            (d.creditTurnover !== undefined && d.creditTurnover > 0.001)
          );
          return hasDirectItems || hasDirectBalance || hasTurnover;
        };

        rawData.forEach(d => {
          if (isDirectlyActive(d)) {
            activeAccountCids!.add(d.cid);
            let curr = directParentMap.get(d.cid);
            while (curr) {
              activeAccountCids!.add(curr.cid);
              curr = directParentMap.get(curr.cid);
            }
          }
        });

        // If search returned matches, also ensure their parent tree is active
        if (searchResults && searchResults.length > 0) {
          searchResults.forEach(res => {
            const targetGl = res.target_gl_number || res.gl_number;
            if (targetGl) {
              const cid = targetGl === 'UNCLASSIFIED' ? 'UNCLASSIFIED' : cleanId(targetGl);
              if (cid) {
                activeAccountCids!.add(cid);
                let curr = directParentMap.get(cid);
                while (curr) {
                  activeAccountCids!.add(curr.cid);
                  curr = directParentMap.get(curr.cid);
                }
              }
            }
          });
        }
      }

      // ── Flatten tree in depth-first order ──
      const compareGlAccounts = (a: LedgerItem, b: LedgerItem) => {
        if (a.cid === 'UNCLASSIFIED') return 1;
        if (b.cid === 'UNCLASSIFIED') return -1;

        const isPureDigitsA = /^\d+$/.test(a.cid);
        const isPureDigitsB = /^\d+$/.test(b.cid);

        if (isPureDigitsA && isPureDigitsB) {
          return a.cid.localeCompare(b.cid);
        }

        return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
      };

      const combinedData: LedgerItem[] = [];

      const traverseTree = (node: LedgerItem) => {
        // If hideZeroBalances is active and this node is not in activeAccountCids, skip it!
        if (activeAccountCids && !activeAccountCids.has(node.cid)) {
          return;
        }

        // If search is active and this node is not in visibleAccountCids, skip it!
        if (visibleAccountCids && !visibleAccountCids.has(node.cid)) {
          return;
        }

        // Filter child accounts by active and search visibility
        const childAccounts = childrenMap.get(node.cid);
        const visibleChildAccounts = childAccounts
          ? childAccounts.filter(c => {
              if (activeAccountCids && !activeAccountCids.has(c.cid)) return false;
              if (visibleAccountCids && !visibleAccountCids.has(c.cid)) return false;
              return true;
            })
          : [];

        const isTetelesMode = viewGranularity === 'teteles';
        const hasVisibleAccountChildren = visibleChildAccounts.length > 0;
        const hasBatchItems = isTetelesMode && batchItemsByGL ? (batchItemsByGL.get(node.cid)?.length ?? 0) > 0 : false;
        const nodeToEmit = hideZeroBalances
          ? {
              ...node,
              hasAccountChildren: hasVisibleAccountChildren,
              hasChildren: hasVisibleAccountChildren || node.hasItemChildren || hasBatchItems
            }
          : {
              ...node,
              hasChildren: node.hasAccountChildren || node.hasItemChildren || hasBatchItems
            };

        // 1. Emit the account node itself
        combinedData.push(nodeToEmit);

        // Check if node is expanded and all its ancestors are expanded
        const isNodeAncestorsExpanded = !node.ancestorIds || node.ancestorIds.length === 0 || node.ancestorIds.every(id => expandedRowIds.has(id));
        const isNodeExpanded = isSearchActive 
          ? (visibleAccountCids ? visibleAccountCids.has(node.cid) : true) 
          : (isPrinting ? true : (expandedRowIds.has(node.id) && isNodeAncestorsExpanded));

        // 2. Emit direct transaction items booked to this account ONLY if node and its ancestors are expanded
        const shouldExpandItems = isSearchActive 
          ? (itemMatchAccountCids.has(node.cid) || (directMatchAccountCids.has(node.cid) && node.hasItemChildren) || expandedRowIds.has(node.id))
          : (isNodeExpanded && isNodeAncestorsExpanded);

        if (shouldExpandItems) {
          const itemAncestors = [node.id, ...(node.ancestorIds || [])];
          const itemDepth = (node.depth || 0) + 1;

          const isBatchLoadingThisNode = isTetelesMode && isBatchItemsLoading && (!batchItemsByGL || !batchItemsByGL.has(node.cid)) && (node.directItemCount ?? 0) > 0;

          if (isBatchLoadingThisNode || (!isTetelesMode && loadingAccountCids.has(node.cid))) {
            combinedData.push({
              id: `loading_${node.cid}`,
              name: t('accounting:general_ledger.loading_items', 'Tételek betöltése...'),
              balance: 0,
              hasChildren: false,
              cid: `${node.cid}_loading`,
              isItem: true,
              isLoadingRow: true,
              ancestorIds: itemAncestors,
              depth: itemDepth,
              isRoot: false
            });
          } else {
            let directItems = (isTetelesMode && batchItemsByGL)
              ? (batchItemsByGL.get(node.cid) || [])
              : (loadedAccountItems.get(node.cid) || []);

            // If search is active, inject any searchResults for this account that might not yet be in directItems
            if (isSearchActive && searchResults.length > 0) {
              const matchingSearchResults = searchResults.filter(r => {
                if (r.entity_type !== 'item') return false;
                const targetGl = r.target_gl_number || r.gl_number;
                const targetCid = targetGl === 'UNCLASSIFIED' ? 'UNCLASSIFIED' : cleanId(targetGl);
                return targetCid === node.cid;
              });

              if (matchingSearchResults.length > 0) {
                const existingIds = new Set(directItems.map(it => it.id));
                const injected: LedgerItem[] = [];
                matchingSearchResults.forEach(r => {
                  const itemId = `item_${r.entity_id.replace('item_', '')}`;
                  if (!existingIds.has(itemId)) {
                    let displayDesc = r.title || 'Névtelen tétel';
                    if (r.subtitle && !displayDesc.includes(r.subtitle)) {
                      displayDesc = `${displayDesc} - ${r.subtitle}`;
                    }
                    injected.push({
                      id: itemId,
                      name: fixCharacterEncoding(displayDesc),
                      balance: Number(r.amount) || 0,
                      hasChildren: false,
                      cid: `${node.cid}_${r.entity_id}`,
                      isItem: true,
                      itemType: fixCharacterEncoding(r.item_type || ''),
                      partner: fixCharacterEncoding(r.title),
                      date: r.item_date || null,
                      sourceTable: r.source_table || null,
                      originalGlId: null,
                      originalAmount: Number(r.amount) || 0,
                      originalCurrency: r.currency || 'HUF',
                      isTemporary: node.cid === 'UNCLASSIFIED',
                      ancestorIds: itemAncestors,
                      depth: itemDepth,
                      isRoot: false
                    });
                  }
                });
                if (injected.length > 0) {
                  directItems = [...injected, ...directItems];
                }
              }
            }

            // Filter directItems if search is active and account was not a direct name/number match
            let displayedItems = directItems;
            if (isSearchActive) {
              const normQ = normalizeText(searchQuery.trim());
              const isDirectAcc = directMatchAccountCids.has(node.cid);
              if (!isDirectAcc) {
                displayedItems = directItems.filter(it => {
                  const normItemName = normalizeText(it.name);
                  const normPartner = normalizeText(it.partner || '');
                  const normType = normalizeText(it.itemType || '');
                  const dateStr = it.date || '';
                  const amountStr = String(it.balance || '');
                  return normItemName.includes(normQ) ||
                         normPartner.includes(normQ) ||
                         normType.includes(normQ) ||
                         dateStr.includes(normQ) ||
                         amountStr.includes(normQ);
                });
              }
            }

            if (displayedItems.length > 0) {
              displayedItems.forEach(it => {
                combinedData.push({
                  ...it,
                  ancestorIds: itemAncestors,
                  depth: itemDepth,
                  isRoot: false
                });
              });

              // If there are more items to load for this account, emit sentinel load-more row (only when not searching and not in teteles batch mode)
              if (!isTetelesMode && !isSearchActive && hasMoreAccountCids.has(node.cid)) {
                const totalItemCount = node.directItemCount || 0;
                combinedData.push({
                  id: `loadmore_${node.cid}`,
                  name: t('accounting:general_ledger.load_more.label', {
                    current: directItems.length,
                    total: totalItemCount > 0 ? totalItemCount : t('accounting:general_ledger.load_more.more', 'több'),
                    defaultValue: `További 100 tétel betöltése (${directItems.length} / ${totalItemCount > 0 ? totalItemCount : 'több'} megjelenítve)`
                  }),
                  balance: 0,
                  hasChildren: false,
                  cid: `${node.cid}_loadmore`,
                  isItem: true,
                  isLoadMoreRow: true,
                  targetCid: node.cid,
                  isLoadingMore: loadingMoreAccountCids.has(node.cid),
                  ancestorIds: itemAncestors,
                  depth: itemDepth,
                  isRoot: false
                });
              }
            }
          }
        }

        // 3. Emit direct child accounts (sorted by compareGlAccounts)
        if (visibleChildAccounts.length > 0) {
          visibleChildAccounts.sort(compareGlAccounts);
          visibleChildAccounts.forEach(child => traverseTree(child));
        }
      };

      roots.sort(compareGlAccounts);
      roots.forEach(root => traverseTree(root));

      return combinedData;
    }
    return [];
  }, [dbData, loadedAccountItems, loadingAccountCids, hasMoreAccountCids, loadingMoreAccountCids, expandedRowIds, searchQuery, searchResults, hideZeroBalances, normalizeText, t, viewGranularity, batchItemsByGL, isBatchItemsLoading]);

  const orphanItem = dbData?.find(d => d.gl_number === 'UNCLASSIFIED');
  const orphanCount = orphanItem ? Number(orphanItem.item_count || 0) : 0;

  // Separate list of excluded items for the "Nem könyvelt" section
  const { data: excludedItems = [] } = useQuery({
    queryKey: ['glExcludedItems', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, elado_nev, vevo_nev, brutto_vegosszeg, kibocsatas_datuma, invoice_type')
        .eq('company_id', selectedCompany.id)
        .eq('exclude_from_accounting', true);

      if (error || !data) return [];
      return data.map(item => {
        const partner = item.elado_nev || item.vevo_nev || '';
        return {
          id: item.id,
          name: fixCharacterEncoding(partner || item.bizonylatsorszam || 'Névtelen tétel'),
          amount: Number(item.brutto_vegosszeg) || 0,
          itemType: fixCharacterEncoding(item.invoice_type || 'számla'),
          partner: fixCharacterEncoding(partner),
          date: item.kibocsatas_datuma,
          sourceTable: 'invoices',
          isExcluded: true
        };
      });
    },
    enabled: !!selectedCompany?.id,
    staleTime: 5 * 60 * 1000
  });

  // ── Fire stats callback when tableData changes ──
  useEffect(() => {
    if (!onStatsChange || tableData.length === 0 || !dbData) return;
    const glAccountsOnly = tableData.filter(d => !d.isItem);
    const leaves = glAccountsOnly.filter(d => !d.hasAccountChildren);
    const totalDebit = leaves.filter(d => d.balance > 0).reduce((s, d) => s + d.balance, 0);
    const totalCredit = leaves.filter(d => d.balance < 0).reduce((s, d) => s + Math.abs(d.balance), 0);
    const totalItemCount = dbData.reduce((s, d) => s + Number(d.item_count || 0), 0);
    const classifiedItemCount = Math.max(0, totalItemCount - orphanCount);
    onStatsChange({ accountCount: glAccountsOnly.length, leafCount: leaves.length, totalDebit, totalCredit, classifiedItems: classifiedItemCount, totalItems: totalItemCount });
  }, [tableData, onStatsChange, dbData, orphanCount]);

  // Calculate generic footer totals by summing root level items in O(N)
  const footerTotals = useMemo(() => {
    return tableData.reduce((acc, current) => {
      // Ignore leaf item rows since their balances are already natively rolled up inside their parents
      if (current.isItem || !current.isRoot) return acc;
      return acc + current.balance;
    }, 0);
  }, [tableData]);

  // Calculate classic 4-column totals (turnover Debit/Credit, balance Debit/Credit)
  const classicTotals = useMemo(() => {
    const glAccountsOnly = tableData.filter(d => !d.isItem);
    const leaves = glAccountsOnly.filter(d => !d.hasAccountChildren);
    const turnoverDebit = leaves.filter(d => d.balance > 0).reduce((s, d) => s + d.balance, 0);
    const turnoverCredit = leaves.filter(d => d.balance < 0).reduce((s, d) => s + Math.abs(d.balance), 0);
    const balanceDebit = turnoverDebit;
    const balanceCredit = turnoverCredit;
    return { turnoverDebit, turnoverCredit, balanceDebit, balanceCredit };
  }, [tableData]);


  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);
  
  // Parse localStorage to check if banner was dismissed for this preset
  const localBannerState = useMemo(() => {
    if (!presetId) return null;
    try {
      const stored = localStorage.getItem(`visibill_hide_ai_banner_${presetId}`);
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return null;
  }, [presetId]);

  const isPermanentlyHidden = localBannerState?.hidden && localBannerState?.orphanCount >= orphanCount;

  const hasOrphans = orphanCount > 0;
  // Banner ONLY shows if: there are orphans AND the user actually switched templates AND they haven't dismissed it
  const isBannerVisible = hasOrphans && hasSwitchedPreset && dismissedBannerForPreset !== presetId && !isPermanentlyHidden;

  const handleDismissBanner = () => {
    if (hideBannerNextTime && presetId) {
      localStorage.setItem(`visibill_hide_ai_banner_${presetId}`, JSON.stringify({
        hidden: true,
        orphanCount: orphanCount
      }));
    }
    setDismissedBannerForPreset(presetId);
  };

  const handleAiReclassification = async () => {
    if (!presetId || !selectedCompany?.id) return;
    setIsAiReclassifying(true);
    
    try {
      const targetOrphanCount = orphanCount;
      if (targetOrphanCount === 0) return;

      // PGMQ: INSERT into gl_upload_notifications triggers the DB trigger
      // which enqueues the job to the gl_classification_jobs PGMQ queue.
      const { error } = await supabase
        .from('gl_upload_notifications')
        .insert({
          company_id: selectedCompany.id,
          target_preset_id: presetId,
          processing_status: 'pending',
          message: `AI átsorolás indítva (${targetOrphanCount} besorolatlan tétel)`
        });

      if (error) {
        reportError({ type: 'db_query', component: 'GeneralLedgerTable', action: 'error', message: 'GL queue insert hiba:', error: error });
      } else {
        handleRefetchAll();
      }
    } catch (e) {
      reportError({ type: 'db_query', component: 'GeneralLedgerTable', action: 'error', message: 'Hiba az AI átsorolás közben:', error: e });
    } finally {
      setIsAiReclassifying(false);
    }
  };

  useImperativeHandle(ref, () => ({
    expandAllAndPrint: () => {
      setIsPrinting(true);
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 300);
    },
    exportExcel: async (companyName?: string, options?: { excludeZeroRows?: boolean }) => {
      const shouldExcludeZero = options?.excludeZeroRows !== undefined ? options.excludeZeroRows : hideZeroBalances;
      const rows = shouldExcludeZero
        ? processedRows.filter(r => Math.abs(r.balance || 0) > 0.001)
        : processedRows;
      await exportGlExcel(rows, companyName, classicTotals, dateBasis, dateFrom, dateTo, { excludeZeroRows: shouldExcludeZero });
    },
    exportAnalyticalExcel: async (companyName?: string, options?: { excludeZeroRows?: boolean }) => {
      if (!selectedCompany?.id || !presetId || !dbData) return;
      const shouldExcludeZero = options?.excludeZeroRows !== undefined ? options.excludeZeroRows : hideZeroBalances;
      toast({ title: 'Exportálás folyamatban...', description: 'Analitikus tételek lekérése az Excelhez.' });
      try {
        const allItems = await fetchAllGlCategorizedItems({
          companyId: selectedCompany.id,
          presetId,
          dateFrom,
          dateTo,
          dateBasis,
          postingStatus,
          exchangeRates: exchangeRates || {},
        });
        const enrichedItems = await enrichGlItemsWithInvoiceMeta(allItems);

        const cleanId = cleanIdVal;
        const glIdToCid = new Map<string, string>();
        dbData.forEach(db => {
          if (db.gl_account_id) {
            glIdToCid.set(db.gl_account_id, cleanId(db.gl_number));
          }
        });

        const itemsByGL = new Map<string, LedgerItem[]>();
        enrichedItems.filter(i => !i.is_excluded).forEach(item => {
          const isUnclass = !item.gl_account_id || item.gl_account_id === '00000000-0000-0000-0000-000000000000';
          const parentCid = isUnclass ? 'UNCLASSIFIED' : glIdToCid.get(item.gl_account_id);
          if (!parentCid) return;
          const pseudoCid = `${parentCid}_${item.item_id}`;

          let displayDesc = item.description || item.partner || 'Névtelen tétel';
          if (item.partner && item.description && item.partner !== item.description) {
            displayDesc = `${item.partner} - ${item.description}`;
          }
          displayDesc = fixCharacterEncoding(displayDesc);

          if (!itemsByGL.has(parentCid)) {
            itemsByGL.set(parentCid, []);
          }
          itemsByGL.get(parentCid)!.push({
            id: `item_${item.item_id}`,
            name: displayDesc,
            balance: Number(item.amount) || 0,
            hasChildren: false,
            cid: pseudoCid,
            isItem: true,
            itemType: fixCharacterEncoding(item.item_type),
            partner: fixCharacterEncoding(item.partner),
            date: item.item_date,
            sourceTable: item.source_table,
            originalGlId: item.gl_account_id,
            originalAmount: Number(item.original_amount) || 0,
            originalCurrency: item.original_currency,
            isTemporary: (!item.gl_account_id || item.gl_account_id === '00000000-0000-0000-0000-000000000000'),
            invoiceId: item.invoice_id || null,
            invoiceNumber: item.invoice_number || null,
          });
        });

        const nodeMap = new Map<string, any>();
        const rawAccounts = dbData.map(dbItem => {
          const cid = cleanId(dbItem.gl_number);
          const item = {
            id: String(dbItem.gl_number),
            name: getLocalizedGlAccountName(dbItem.gl_number, fixCharacterEncoding(dbItem.short_name), t, isCroatia),
            balance: Number(dbItem.total_balance) || 0,
            hasChildren: itemsByGL.has(cid),
            hasAccountChildren: false,
            hasItemChildren: itemsByGL.has(cid),
            cid
          };
          nodeMap.set(cid, item);
          return item;
        });

        const compareGlAccounts = (a: any, b: any) => {
          if (a.cid === 'UNCLASSIFIED') return 1;
          if (b.cid === 'UNCLASSIFIED') return -1;
          const isPureDigitsA = /^\d+$/.test(a.cid);
          const isPureDigitsB = /^\d+$/.test(b.cid);
          if (isPureDigitsA && isPureDigitsB) return a.cid.localeCompare(b.cid);
          return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
        };

        const directParentMap = new Map<string, any>();
        const childrenMap = new Map<string, any[]>();
        const roots: any[] = [];
        rawAccounts.forEach(node => {
          let directParent: any = null;
          if (node.cid !== 'UNCLASSIFIED') {
            for (let len = node.cid.length - 1; len >= 1; len--) {
              const prefix = node.cid.slice(0, len);
              const candidate = nodeMap.get(prefix);
              if (candidate) {
                directParent = candidate;
                break;
              }
            }
          }
          if (!directParent) roots.push(node);
          else {
            directParentMap.set(node.cid, directParent);
            if (!childrenMap.has(directParent.cid)) childrenMap.set(directParent.cid, []);
            childrenMap.get(directParent.cid)!.push(node);
          }
        });

        rawAccounts.forEach(node => {
          const hasAccChildren = (childrenMap.get(node.cid)?.length ?? 0) > 0;
          node.hasAccountChildren = hasAccChildren;
          node.hasChildren = hasAccChildren || node.hasItemChildren;
        });

        const fullExportRows: any[] = [];
        let activeExportCids: Set<string> | null = null;
        if (shouldExcludeZero) {
          activeExportCids = new Set<string>();
          rawAccounts.forEach(acc => {
            const hasItems = itemsByGL.has(acc.cid) && (itemsByGL.get(acc.cid)?.length ?? 0) > 0;
            const hasBalance = Math.abs(acc.balance || 0) > 0.001;
            if (hasItems || hasBalance) {
              activeExportCids!.add(acc.cid);
              let curr = directParentMap.get(acc.cid);
              while (curr) {
                activeExportCids!.add(curr.cid);
                curr = directParentMap.get(curr.cid);
              }
            }
          });
        }

        const traverse = (node: any, depth = 0) => {
          if (activeExportCids && !activeExportCids.has(node.cid)) {
            return;
          }
          fullExportRows.push({ ...node, depth, isRoot: depth === 0 });
          const rawItems = itemsByGL.get(node.cid);
          const directItems = rawItems ? groupLedgerItemsByInvoice(rawItems, itemGrouping) : [];
          if (directItems && directItems.length > 0) {
            directItems.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
            directItems.forEach(item => fullExportRows.push({ ...item, depth: depth + 1 }));
          }
          const children = childrenMap.get(node.cid);
          const visibleChildren = children
            ? children.filter(c => !activeExportCids || activeExportCids.has(c.cid))
            : [];
          if (visibleChildren.length > 0) {
            visibleChildren.sort(compareGlAccounts);
            visibleChildren.forEach(child => traverse(child, depth + 1));
          }
        };

        roots.sort(compareGlAccounts);
        roots.forEach(root => traverse(root, 0));

        await exportGlAnalyticalExcel(fullExportRows, companyName, classicTotals, dateBasis, dateFrom, dateTo, { excludeZeroRows: shouldExcludeZero });
        toast({ title: 'Sikeres exportálás', description: 'Az analitikus Excel fájl elkészült.', className: 'bg-green-50 text-green-900 border-green-200' });
      } catch (err: any) {
        reportError({ type: 'db_query', component: 'GeneralLedgerTable', action: 'error', message: 'Export error:', error: err });
        toast({ title: 'Exportálási hiba', description: err.message, variant: 'destructive' });
      }
    },
    getStats: () => {
      const glAccountsOnly = tableData.filter(d => !d.isItem);
      const leaves = glAccountsOnly.filter(d => !d.hasAccountChildren);
      const totalDebit = leaves.filter(d => d.balance > 0).reduce((s, d) => s + d.balance, 0);
      const totalCredit = leaves.filter(d => d.balance < 0).reduce((s, d) => s + Math.abs(d.balance), 0);
      return { accountCount: glAccountsOnly.length, leafCount: leaves.length, totalDebit, totalCredit };
    },
    expandAll: handleExpandAll,
    collapseAll: handleCollapseAll,
    navigateToEntity: (result: GlSearchResult) => handleNavigateToEntity(result),
  }));

  const handleExpandAll = () => {
    const allWithChildren = tableData.filter(d => d.hasChildren).map(d => d.id);
    setExpandedRowIds(new Set(allWithChildren));
  };

  const handleCollapseAll = () => {
    setExpandedRowIds(new Set([])); // Collapse to only root items
  };

  const fetchAccountItemsOnDemand = useCallback(async (targetCid: string) => {
    if (!dbData || !selectedCompany?.id || !presetId) return;
    if (loadedRawAccountItems.has(targetCid) || loadingAccountCids.has(targetCid)) return;

    setLoadingAccountCids(prev => new Set(prev).add(targetCid));
    try {
      const cleanId = cleanIdVal;
      const glAccountId = targetCid === 'UNCLASSIFIED'
        ? '00000000-0000-0000-0000-000000000000'
        : (dbData.find(d => cleanId(d.gl_number) === targetCid)?.gl_account_id || null);

      const isPagedAccount = targetCid === 'UNCLASSIFIED' || (dbData.find(d => cleanId(d.gl_number) === targetCid)?.item_count ?? 0) > 100;

      const items = await fetchGlItemsForAccount({
        companyId: selectedCompany.id,
        presetId,
        glAccountId,
        dateFrom,
        dateTo,
        dateBasis,
        postingStatus,
        exchangeRates: exchangeRates || {},
        limit: isPagedAccount ? 100 : null,
        offset: 0,
      });

      const enriched = await enrichGlItemsWithInvoiceMeta(items);

      const mappedItems: LedgerItem[] = enriched.map(item => {
        const isUnclass = !item.gl_account_id || item.gl_account_id === '00000000-0000-0000-0000-000000000000';
        const parentCid = isUnclass ? 'UNCLASSIFIED' : targetCid;
        const pseudoCid = `${parentCid}_${item.item_id}`;

        let displayDesc = item.description || item.partner || 'Névtelen tétel';
        if (item.partner && item.description && item.partner !== item.description) {
          displayDesc = `${item.partner} - ${item.description}`;
        }
        displayDesc = fixCharacterEncoding(displayDesc);

        return {
          id: `item_${item.item_id}`,
          name: displayDesc,
          balance: Number(item.amount) || 0,
          hasChildren: false,
          cid: pseudoCid,
          isItem: true,
          itemType: fixCharacterEncoding(item.item_type),
          partner: fixCharacterEncoding(item.partner),
          date: item.item_date,
          sourceTable: item.source_table,
          originalGlId: item.gl_account_id,
          originalAmount: Number(item.original_amount) || 0,
          originalCurrency: item.original_currency,
          isTemporary: (!item.gl_account_id || item.gl_account_id === '00000000-0000-0000-0000-000000000000' || item.is_temporary),
          invoiceId: item.invoice_id || null,
          invoiceNumber: item.invoice_number || null,
        };
      });

      setLoadedRawAccountItems(prev => {
        const next = new Map(prev);
        next.set(targetCid, mappedItems);
        return next;
      });

      if (isPagedAccount && items.length === 100) {
        setHasMoreAccountCids(prev => new Set(prev).add(targetCid));
      } else {
        setHasMoreAccountCids(prev => {
          const next = new Set(prev);
          next.delete(targetCid);
          return next;
        });
      }
    } catch (error) {
      reportError({ type: 'db_query', component: 'GeneralLedgerTable', action: 'error', message: 'Error fetching account items:', error });
    } finally {
      setLoadingAccountCids(prev => {
        const next = new Set(prev);
        next.delete(targetCid);
        return next;
      });
    }
  }, [dbData, selectedCompany?.id, presetId, dateFrom, dateTo, dateBasis, postingStatus, exchangeRates, loadedRawAccountItems, loadingAccountCids]);

  const fetchMoreAccountItems = useCallback(async (targetCid: string) => {
    if (!dbData || !selectedCompany?.id || !presetId) return;
    if (loadingMoreAccountCids.has(targetCid)) return;

    const currentItems = loadedRawAccountItems.get(targetCid) || [];
    setLoadingMoreAccountCids(prev => new Set(prev).add(targetCid));

    try {
      const cleanId = cleanIdVal;
      const glAccountId = targetCid === 'UNCLASSIFIED'
        ? '00000000-0000-0000-0000-000000000000'
        : (dbData.find(d => cleanId(d.gl_number) === targetCid)?.gl_account_id || null);

      const items = await fetchGlItemsForAccount({
        companyId: selectedCompany.id,
        presetId,
        glAccountId,
        dateFrom,
        dateTo,
        dateBasis,
        postingStatus,
        exchangeRates: exchangeRates || {},
        limit: 100,
        offset: currentItems.length,
      });

      const enriched = await enrichGlItemsWithInvoiceMeta(items);

      const mappedItems: LedgerItem[] = enriched.map(item => {
        const isUnclass = !item.gl_account_id || item.gl_account_id === '00000000-0000-0000-0000-000000000000';
        const parentCid = isUnclass ? 'UNCLASSIFIED' : targetCid;
        const pseudoCid = `${parentCid}_${item.item_id}`;

        let displayDesc = item.description || item.partner || 'Névtelen tétel';
        if (item.partner && item.description && item.partner !== item.description) {
          displayDesc = `${item.partner} - ${item.description}`;
        }
        displayDesc = fixCharacterEncoding(displayDesc);

        return {
          id: `item_${item.item_id}`,
          name: displayDesc,
          balance: Number(item.amount) || 0,
          hasChildren: false,
          cid: pseudoCid,
          isItem: true,
          itemType: fixCharacterEncoding(item.item_type),
          partner: fixCharacterEncoding(item.partner),
          date: item.item_date,
          sourceTable: item.source_table,
          originalGlId: item.gl_account_id,
          originalAmount: Number(item.original_amount) || 0,
          originalCurrency: item.original_currency,
          isTemporary: (!item.gl_account_id || item.gl_account_id === '00000000-0000-0000-0000-000000000000' || item.is_temporary),
          invoiceId: item.invoice_id || null,
          invoiceNumber: item.invoice_number || null,
        };
      });

      setLoadedRawAccountItems(prev => {
        const next = new Map(prev);
        const existing = prev.get(targetCid) || [];
        next.set(targetCid, [...existing, ...mappedItems]);
        return next;
      });

      if (items.length < 100) {
        setHasMoreAccountCids(prev => {
          const next = new Set(prev);
          next.delete(targetCid);
          return next;
        });
      }
    } catch (error) {
      reportError({ type: 'db_query', component: 'GeneralLedgerTable', action: 'error', message: 'Error fetching more account items:', error });
    } finally {
      setLoadingMoreAccountCids(prev => {
        const next = new Set(prev);
        next.delete(targetCid);
        return next;
      });
    }
  }, [dbData, selectedCompany?.id, presetId, dateFrom, dateTo, dateBasis, postingStatus, exchangeRates, loadedRawAccountItems, loadingMoreAccountCids]);

  const handleNavigateToEntity = useCallback(async (result: GlSearchResult) => {
    const targetGl = result.target_gl_number || result.gl_number;
    const cleanId = cleanIdVal;
    const targetCid = targetGl === 'UNCLASSIFIED' ? 'UNCLASSIFIED' : cleanId(targetGl);

    // 1. Expand all ancestors leading to targetCid
    const accountsToExpand = new Set<string>();
    tableData.filter(d => !d.isItem).forEach(node => {
      if (targetCid.startsWith(node.cid)) {
        accountsToExpand.add(node.id);
      }
    });

    // 2. If it's an item, expand the parent account as well
    if (result.entity_type === 'item') {
      const parentNode = tableData.find(d => !d.isItem && (cleanId(d.id) === targetCid || d.cid === targetCid));
      if (parentNode) {
        accountsToExpand.add(parentNode.id);
      } else {
        accountsToExpand.add(targetGl);
      }
    }

    setExpandedRowIds(prev => new Set([...prev, ...accountsToExpand]));

    // 3. If item, ensure items for this account are fetched on demand
    const expectedItemId = `item_${result.entity_id}`;
    if (result.entity_type === 'item' && targetCid) {
      if (!loadedAccountItems.has(targetCid)) {
        await fetchAccountItemsOnDemand(targetCid);
      }
      // Ensure the selected search result is guaranteed to be in the rendered list even if it was beyond the first 100 items
      setLoadedAccountItems(prev => {
        const next = new Map(prev);
        const existingList = next.get(targetCid) || [];
        const alreadyPresent = existingList.some(it => it.id === expectedItemId);
        if (!alreadyPresent) {
          const parentCid = targetCid;
          const pseudoCid = `${parentCid}_${result.entity_id}`;
          let displayDesc = result.title || 'Névtelen tétel';
          if (result.subtitle && !displayDesc.includes(result.subtitle)) {
            displayDesc = `${displayDesc} - ${result.subtitle}`;
          }
          const injectedItem: LedgerItem = {
            id: expectedItemId,
            name: fixCharacterEncoding(displayDesc),
            balance: Number(result.amount) || 0,
            hasChildren: false,
            cid: pseudoCid,
            isItem: true,
            itemType: fixCharacterEncoding(result.item_type || ''),
            partner: fixCharacterEncoding(result.title),
            date: result.item_date || null,
            sourceTable: result.source_table || null,
            originalGlId: null,
            originalAmount: Number(result.amount) || 0,
            originalCurrency: result.currency || 'HUF',
            isTemporary: targetCid === 'UNCLASSIFIED',
          };
          next.set(targetCid, [injectedItem, ...existingList]);
        }
        return next;
      });
    }

    // 4. Set highlight on the row
    const targetRowId = result.entity_type === 'account' ? result.gl_number : expectedItemId;
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
    setHighlightedRowId(targetRowId);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedRowId(null);
    }, 4500);

    // 5. Smooth scroll into view
    const scrollToTarget = () => {
      const el = document.getElementById(`row_${targetRowId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
      }
      return false;
    };

    if (!scrollToTarget()) {
      setTimeout(() => {
        if (!scrollToTarget()) {
          setTimeout(scrollToTarget, 300);
        }
      }, 120);
    }
  }, [tableData, loadedAccountItems, fetchAccountItemsOnDemand]);

  const toggleRow = (id: string, hasChildren?: boolean) => {
    if (!hasChildren) return;
    const isCurrentlyExpanded = expandedRowIds.has(id);
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (isCurrentlyExpanded) {
        next.delete(id);
        // Also prune all descendant IDs from expandedRowIds so child accounts don't keep ghost open state
        tableData.forEach(d => {
          if (!d.isItem && d.ancestorIds?.includes(id)) {
            next.delete(d.id);
          }
        });
      } else {
        next.add(id);
      }
      return next;
    });

    if (!isCurrentlyExpanded && viewGranularity !== 'teteles') {
      const targetRow = tableData.find(d => d.id === id);
      if (targetRow && targetRow.hasItemChildren) {
        fetchAccountItemsOnDemand(targetRow.cid);
      }
    }
  };

  // Load items for any expanded leaf accounts on mount / expand restore
  useEffect(() => {
    if (viewGranularity === 'teteles') return; // In teteles mode, batch query handles all items! Avoid N+1 requests!
    if (!dbData || !selectedCompany?.id || !presetId) return;
    expandedRowIds.forEach(id => {
      const row = tableData.find(d => d.id === id);
      if (row && row.hasItemChildren) {
        fetchAccountItemsOnDemand(row.cid);
      }
    });
  }, [viewGranularity, expandedRowIds, tableData, dbData, selectedCompany?.id, presetId, fetchAccountItemsOnDemand]);

  // When searchResults contains item matches for accounts that haven't loaded items yet, fetch them
  useEffect(() => {
    if (viewGranularity === 'teteles') return; // In teteles mode, batch query handles all items! Avoid N+1 requests!
    if (!searchQuery.trim() || searchResults.length === 0 || !dbData || !selectedCompany?.id || !presetId) return;

    searchResults.forEach(res => {
      if (res.entity_type === 'item') {
        const targetGl = res.target_gl_number || res.gl_number;
        const targetCid = targetGl === 'UNCLASSIFIED' ? 'UNCLASSIFIED' : cleanIdVal(targetGl);
        if (targetCid && !loadedAccountItems.has(targetCid) && !loadingAccountCids.has(targetCid)) {
          fetchAccountItemsOnDemand(targetCid);
        }
      }
    });
  }, [searchQuery, searchResults, dbData, selectedCompany?.id, presetId, loadedAccountItems, loadingAccountCids, fetchAccountItemsOnDemand]);




  // Pre-calculate which categories contain items so we know what to expand during print in O(N)
  const categoriesWithItems = useMemo(() => {
    const result = new Set<string>();
    tableData.forEach(item => {
      if (item.isItem && item.ancestorIds) {
        item.ancestorIds.forEach(id => result.add(id));
      }
    });
    return result;
  }, [tableData]);

  // Determine if a row should be visible based on expanded state of its ancestors in O(1) per row
  const processedRows = useMemo(() => {
    const isSearchActive = !!searchQuery && searchQuery.trim().length > 0;

    return tableData.map(item => {
      const isRoot = !!item.isRoot;
      const depth = item.depth || 0;
      
      const isVisibleOnScreen = isRoot || isSearchActive || (
        item.ancestorIds && item.ancestorIds.length > 0
          ? item.ancestorIds.every(id => expandedRowIds.has(id))
          : false
      );
      let isVisibleDuringPrint = isRoot || (
        item.ancestorIds ? item.ancestorIds.every(id => {
          if (printLayoutMode === 'synthetic') return true;
          return categoriesWithItems.has(id);
        }) : true
      );

      if (printLayoutMode === 'synthetic' && item.isItem) {
        isVisibleDuringPrint = false;
      }
      
      return { ...item, isVisibleOnScreen, isVisibleDuringPrint, isRoot, depth };
    });
  }, [expandedRowIds, tableData, categoriesWithItems, printLayoutMode, searchQuery]);

  // Calculate total amount for currently selected items
  const selectedItemsSum = useMemo(() => {
    if (selectedItemIds.size === 0) return 0;
    return tableData
      .filter(d => selectedItemIds.has(d.id))
      .reduce((sum, item) => sum + (item.balance || 0), 0);
  }, [tableData, selectedItemIds]);

  const gridColsClass = viewLayout === 'classic'
    ? "grid-cols-[100px_minmax(200px,1fr)_120px_120px_120px_120px]"
    : "grid-cols-12";

  if (isDataLoading) {
    return (
      <div className="w-full flex flex-col h-[65vh] max-h-[800px] bg-card overflow-hidden rounded-md border border-border">
        {/* Header */}
        <div className="bg-muted/80 border-b border-border text-sm font-semibold sticky top-0 z-20 hidden md:block select-none">
          {viewLayout === 'classic' ? (
            <div className={cn("grid divide-x divide-border/50", gridColsClass)}>
              <div className="p-3 text-center text-xs text-foreground uppercase tracking-wider">{t('accounting:general_ledger.table.gl_account', 'Fők. szám')}</div>
              <div className="p-3 text-xs text-foreground uppercase tracking-wider">{t('accounting:general_ledger.table.name', 'Megnevezés')}</div>
              <div className="p-3 text-right text-xs uppercase tracking-wider">{t('accounting:general_ledger.table.turnover_debit', 'Forgalom T')}</div>
              <div className="p-3 text-right text-xs uppercase tracking-wider">{t('accounting:general_ledger.table.turnover_credit', 'Forgalom K')}</div>
              <div className="p-3 text-right text-xs bg-indigo-500/5 uppercase tracking-wider">{t('accounting:general_ledger.table.balance_debit', 'Egyenleg T')}</div>
              <div className="p-3 text-right text-xs bg-indigo-500/5 uppercase tracking-wider">{t('accounting:general_ledger.table.balance_credit', 'Egyenleg K')}</div>
            </div>
          ) : (
            <div className="grid grid-cols-12 divide-x divide-border/50">
              <div className="col-span-2 p-3 text-center text-xs text-foreground uppercase tracking-wider">{t('accounting:general_ledger.table.gl_account', 'Fők. szám')}</div>
              <div className="col-span-8 p-3 text-xs text-foreground uppercase tracking-wider">{t('accounting:general_ledger.table.name', 'Megnevezés')}</div>
              <div className="col-span-2 p-3 text-right text-xs bg-indigo-500/5 text-foreground uppercase tracking-wider">{t('accounting:general_ledger.table.total_balance', 'Összesített Egyenleg')}</div>
            </div>
          )}
        </div>
        {/* Skeleton Body */}
        <div className="flex-1 divide-y divide-border/30 overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => {
            const depth = i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2;
            const indentPadding = `${0.75 + (depth * 1.5)}rem`;
            return viewLayout === 'classic' ? (
              <div key={i} className={cn("grid divide-x divide-border/10 p-3 items-center animate-pulse", gridColsClass)}>
                <div className="flex items-center justify-center">
                  <Skeleton className="h-4 w-12 bg-muted/50 rounded" />
                </div>
                <div className="flex items-center gap-2" style={{ paddingLeft: indentPadding }}>
                  <div className="w-4 h-4 shrink-0" />
                  <Skeleton className={cn("h-4 bg-muted/50 rounded", depth === 0 ? 'w-48' : depth === 1 ? 'w-36' : 'w-24')} />
                </div>
                <div className="flex justify-end">
                  <Skeleton className="h-4 w-16 bg-muted/50 rounded" />
                </div>
                <div className="flex justify-end">
                  <Skeleton className="h-4 w-16 bg-muted/50 rounded" />
                </div>
                <div className="flex justify-end">
                  <Skeleton className="h-4 w-16 bg-muted/50 rounded" />
                </div>
                <div className="flex justify-end">
                  <Skeleton className="h-4 w-16 bg-muted/50 rounded" />
                </div>
              </div>
            ) : (
              <div key={i} className="grid grid-cols-12 divide-x divide-border/10 p-3 items-center animate-pulse">
                <div className="col-span-2 flex items-center justify-center">
                  <Skeleton className="h-4 w-12 bg-muted/50 rounded" />
                </div>
                <div className="col-span-8 flex items-center gap-2" style={{ paddingLeft: indentPadding }}>
                  <div className="w-4 h-4 shrink-0" />
                  <Skeleton className={cn("h-4 bg-muted/50 rounded", depth === 0 ? 'w-48' : depth === 1 ? 'w-36' : 'w-24')} />
                </div>
                <div className="col-span-2 flex justify-end">
                  <Skeleton className="h-4 w-24 bg-muted/50 rounded" />
                </div>
              </div>
            );
          })}
        </div>
        {/* Skeleton Footer */}
        {viewLayout === 'classic' ? (
          <div className={cn("shrink-0 grid border-t border-border/60 bg-muted/95 backdrop-blur font-bold text-xs sm:text-sm divide-x divide-border/40", gridColsClass)}>
            <div className="p-3 text-center uppercase tracking-wider text-muted-foreground">Σ</div>
            <div className="p-3 text-right uppercase tracking-wider text-muted-foreground">{t('accounting:general_ledger.table.total', 'Összesen:')}</div>
            <div className="p-3 flex justify-end"><Skeleton className="h-4 w-16 bg-muted/50 rounded" /></div>
            <div className="p-3 flex justify-end"><Skeleton className="h-4 w-16 bg-muted/50 rounded" /></div>
            <div className="p-3 flex justify-end"><Skeleton className="h-4 w-16 bg-muted/50 rounded" /></div>
            <div className="p-3 flex items-center justify-end gap-2 pr-2">
              <Skeleton className="h-4 w-16 bg-muted/50 rounded" />
              <Skeleton className="h-6 w-6 rounded-full bg-muted/50" />
            </div>
          </div>
        ) : (
          <div className="shrink-0 grid grid-cols-12 border-t border-border/60 bg-muted/95 backdrop-blur font-bold text-sm">
            <div className="col-span-10 p-3 text-right uppercase tracking-wider text-muted-foreground text-xs">{t('accounting:general_ledger.table.total', 'Összesen:')}</div>
            <div className="col-span-2 p-3 flex items-center justify-end gap-2 pr-4">
              <Skeleton className="h-4 w-24 bg-muted/50 rounded" />
              <Skeleton className="h-6 w-6 rounded-full bg-muted/50" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="w-full flex flex-col print:block h-[65vh] print:h-auto max-h-[800px] print:max-h-none bg-card overflow-hidden print:overflow-visible rounded-md border border-border print:border-none">
          {isBannerVisible && (
            <div className="px-5 py-3.5 bg-indigo-500/10 border-b border-indigo-500/20 flex flex-col sm:flex-row items-center justify-between gap-4 relative">
              <div className="text-sm text-indigo-700 dark:text-indigo-400 font-medium pr-6 flex-1">
                {t('accounting:general_ledger.reclassify_banner.title', 'Új számlatükröt választottál. Szeretnéd, hogy az AI automatikusan besorolja a "Besorolatlan" tételeidet ebbe az új struktúrába is?')}
              </div>
              <div className="flex items-center gap-4 shrink-0 flex-wrap sm:flex-nowrap justify-end w-full sm:w-auto">
                <label className="flex items-center gap-2 text-xs text-indigo-600/80 cursor-pointer print:hidden">
                  <Checkbox 
                    checked={hideBannerNextTime} 
                    onCheckedChange={(checked) => setHideBannerNextTime(!!checked)} 
                    className="w-3.5 h-3.5 border-indigo-400 data-[state=checked]:bg-indigo-500 data-[state=checked]:text-white"
                  />
                  {t('accounting:general_ledger.reclassify_banner.hide_checkbox', 'Ne mutasd újra amíg nincs új tétel')}
                </label>
                <div className="flex items-center gap-2">
                  <Button onClick={handleAiReclassification} disabled={isAiReclassifying} size="sm" className="whitespace-nowrap">
                    {isAiReclassifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {isAiReclassifying ? t('accounting:general_ledger.reclassify_banner.in_progress', 'AI átsorolás folyamatban...') : t('accounting:general_ledger.reclassify_banner.confirm_btn', 'Igen, besorolom')}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-500/20"
                    onClick={handleDismissBanner}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto print:overflow-visible w-full relative">
            <div className={cn("w-full flex flex-col min-h-full pb-2 print:pb-0", viewLayout === 'classic' && "min-w-[840px]")}>
              
              {/* Header */}
              <div className="bg-muted/80 backdrop-blur-md border-b border-border text-sm font-semibold sticky top-0 z-20 hidden md:block select-none shadow-sm">
                {viewLayout === 'classic' ? (
                  <div className={cn("grid divide-x divide-border/50", gridColsClass)}>
                    <div className="p-3 text-center text-xs text-foreground uppercase tracking-wider">{t('accounting:general_ledger.table.gl_account', 'Fők. szám')}</div>
                    <div className="p-3 text-xs text-foreground uppercase tracking-wider">{t('accounting:general_ledger.table.name', 'Megnevezés')}</div>
                    <div className="p-3 text-right text-xs uppercase tracking-wider">{t('accounting:general_ledger.table.turnover_debit', 'Forgalom T')}</div>
                    <div className="p-3 text-right text-xs uppercase tracking-wider">{t('accounting:general_ledger.table.turnover_credit', 'Forgalom K')}</div>
                    <div className="p-3 text-right text-xs bg-indigo-500/5 uppercase tracking-wider">{t('accounting:general_ledger.table.balance_debit', 'Egyenleg T')}</div>
                    <div className="p-3 text-right text-xs bg-indigo-500/5 uppercase tracking-wider">{t('accounting:general_ledger.table.balance_credit', 'Egyenleg K')}</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-12 divide-x divide-border/50">
                    <div className="col-span-2 p-3 text-center text-xs text-foreground uppercase tracking-wider">{t('accounting:general_ledger.table.gl_account', 'Fők. szám')}</div>
                    <div className="col-span-8 p-3 text-xs text-foreground uppercase tracking-wider">{t('accounting:general_ledger.table.name', 'Megnevezés')}</div>
                    <div className="col-span-2 p-3 text-right text-xs bg-indigo-500/5 text-foreground uppercase tracking-wider">{t('accounting:general_ledger.table.total_balance', 'Összesített Egyenleg')}</div>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="flex-1 divide-y divide-border/30">
                {processedRows.length === 0 ? (
                   searchQuery.trim() ? (
                     <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                       <Search className="w-8 h-8 opacity-40 text-muted-foreground" />
                       <div>
                         <p className="text-sm font-medium text-foreground">
                           {t('accounting:general_ledger.search_no_results.title', { query: searchQuery, defaultValue: `Nincs találat a(z) „${searchQuery}” keresési kifejezésre a főkönyvben.` })}
                         </p>
                         <p className="text-xs text-muted-foreground mt-1">{t('accounting:general_ledger.search_no_results.hint', 'Próbálj más számlaszámra, névre vagy partnerre keresni.')}</p>
                       </div>
                     </div>
                   ) : (
                     <div className="p-8 text-center text-muted-foreground">{t('accounting:general_ledger.table.no_data', 'Nem találhatók adatok ehhez a könyvelési sablonhoz.')}</div>
                   )
                ) : processedRows.map((row) => {
                  const shouldRender = isPrinting ? (row as any).isVisibleDuringPrint : row.isVisibleOnScreen;
                  if (!shouldRender) return null;

                  const isRoot = row.isRoot;
                  const isExpanded = expandedRowIds.has(row.id);
                  const isNegative = row.balance < 0;
                  const indentPadding = `${0.75 + (row.depth * 1.5)}rem`;
                  
                  const hiddenClass = !row.isVisibleOnScreen && isPrinting ? "hidden print:grid" : "grid";
                  const classChar = !row.isItem && row.id ? row.id[0] : '';
                  const classBorderColor = 
                    row.isItem ? ''
                    : ['1', '2', '3'].includes(classChar) ? 'border-l-4 border-l-blue-500 dark:border-l-blue-400'
                    : classChar === '4' ? 'border-l-4 border-l-purple-500 dark:border-l-purple-400'
                    : ['5', '8'].includes(classChar) ? 'border-l-4 border-l-red-500 dark:border-l-red-400'
                    : classChar === '9' ? 'border-l-4 border-l-emerald-500 dark:border-l-emerald-400'
                    : '';
                  if (row.isLoadingRow) {
                    return (
                      <div
                        key={row.id}
                        className={cn(
                          "grid divide-x divide-border/10 bg-muted/20 animate-pulse items-center",
                          gridColsClass,
                          hiddenClass
                        )}
                      >
                        <div className={cn(viewLayout === 'classic' ? "p-3" : "col-span-2 p-3", "flex items-center justify-center")}>
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        </div>
                        <div className={cn(viewLayout === 'classic' ? "py-3 pr-3" : "col-span-8 py-3 pr-3", "text-sm flex items-center gap-2")} style={{ paddingLeft: indentPadding }}>
                          <span className="text-xs text-muted-foreground italic flex items-center gap-2">
                            {row.name}
                          </span>
                        </div>
                        {viewLayout === 'classic' ? (
                          <>
                            <div className="p-3" />
                            <div className="p-3" />
                            <div className="p-3" />
                            <div className="p-3" />
                          </>
                        ) : (
                          <div className="col-span-2 p-3 flex justify-end items-center" />
                        )}
                      </div>
                    );
                  }

                  if (row.isLoadMoreRow && row.targetCid) {
                    return (
                      <LoadMoreSentinelRow
                        key={row.id}
                        row={row}
                        hiddenClass={hiddenClass}
                        indentPadding={indentPadding}
                        onLoadMore={fetchMoreAccountItems}
                        viewLayout={viewLayout}
                        gridColsClass={gridColsClass}
                      />
                    );
                  }

                  return (
                    <div 
                      key={row.id} 
                      id={`row_${row.id}`}
                      className={cn(
                        "group divide-x divide-border/10 transition-colors hover:bg-muted/40",
                        gridColsClass,
                        hiddenClass,
                        isRoot && "border-t border-border/50 bg-muted/10 font-medium",
                        row.hasChildren ? "cursor-pointer" : "",
                        highlightedRowId === row.id && "ring-2 ring-primary/80 bg-primary/10 transition-all duration-700 shadow-md"
                      )}
                      onClick={() => toggleRow(row.id, row.hasChildren)}
                    >
                      <div className={cn(
                        "p-3 text-sm flex items-center justify-center font-mono text-muted-foreground border-r border-border/20 gap-3",
                        viewLayout !== 'classic' && "col-span-2",
                        classBorderColor
                      )}>
                        {row.isItem ? (
                           <>
                             <div className="print:hidden h-full flex items-center" onClick={e => e.stopPropagation()}>
                               {row.sourceTable !== 'acc_journal_lines' && row.sourceTable !== 'journal_entry' ? (
                                 <Checkbox 
                                   checked={
                                     row.groupedItemIds && row.groupedItemIds.length > 0
                                       ? row.groupedItemIds.every(id => selectedItemIds.has(id))
                                       : selectedItemIds.has(row.id)
                                   } 
                                   onCheckedChange={() => {
                                     if (row.groupedItemIds && row.groupedItemIds.length > 0) {
                                       const allSelected = row.groupedItemIds.every(id => selectedItemIds.has(id));
                                       setSelectedItemIds(prev => {
                                         const next = new Set(prev);
                                         row.groupedItemIds!.forEach(id => {
                                           if (allSelected) next.delete(id);
                                           else next.add(id);
                                         });
                                         return next;
                                       });
                                     } else {
                                       toggleItemSelection(row.id);
                                     }
                                   }}
                                 />
                               ) : (
                                 <div className="w-4" />
                               )}
                             </div>
                             <span className="text-xs truncate">{row.date ? row.date.substring(0, 10).replace(/-/g, '.') : ''}</span>
                           </>
                        ) : (
                           !row.hasAccountChildren ? (
                             <span 
                               className={cn(
                                 "font-semibold cursor-pointer hover:underline text-primary transition-colors",
                                 (row.tempBalance && row.tempBalance !== 0 && (!row.finalBalance || row.finalBalance === 0)) 
                                   ? "text-orange-500 dark:text-orange-400 hover:text-orange-600" 
                                   : ""
                               )}
                               onClick={(e) => {
                                 e.stopPropagation();
                                 setSelectedLeafAccount({ code: row.id, name: row.name });
                               }}
                             >
                               {row.id}
                             </span>
                           ) : (
                             <span className={cn(
                               "font-semibold",
                               (row.tempBalance && row.tempBalance !== 0 && (!row.finalBalance || row.finalBalance === 0)) 
                                 ? "text-orange-500 dark:text-orange-400" 
                                 : "text-foreground"
                             )}>
                               {row.id}
                             </span>
                           )
                        )}
                      </div>
                      <div className={cn("py-3 pr-3 text-sm flex items-center gap-2 min-w-0", viewLayout !== 'classic' && "col-span-8")} style={{ paddingLeft: indentPadding }}>
                        <div className="w-4 h-4 shrink-0 flex items-center justify-center print:hidden">
                          {row.hasChildren && (
                            <div className="text-muted-foreground/70 hover:text-foreground hover:bg-muted p-0.5 rounded-sm transition-colors">
                               {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </div>
                          )}
                        </div>
                        <CustomTooltip 
                          content={
                            row.groupedDescriptions && row.groupedDescriptions.length > 1 ? (
                              <div className="space-y-1 max-w-sm">
                                <p className="font-semibold text-xs border-b border-border/40 pb-1">{row.name}</p>
                                <div className="max-h-48 overflow-y-auto space-y-1 text-[11px] text-muted-foreground">
                                  {row.groupedDescriptions.map((desc, idx) => (
                                    <div key={idx} className="flex items-start gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0 mt-1" />
                                      <span className="break-words">{desc}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              row.isItem ? getLocalizedGlItemDescription(row.name, t) : row.name
                            )
                          } 
                          side="top"
                        >
                          <span className={cn("break-words min-w-0 font-medium leading-normal", isRoot ? "uppercase font-semibold text-foreground" : "", row.isItem ? "text-muted-foreground italic" : "")}>
                            {row.isItem ? getLocalizedGlItemDescription(row.name, t) : row.name}
                          </span>
                        </CustomTooltip>
                        {row.isItem && row.groupedCount && row.groupedCount > 1 && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold whitespace-nowrap border border-primary/20">
                            {row.groupedCount} {t('accounting:general_ledger.grouped_items_badge', 'tétel')}
                          </span>
                        )}
                        {row.isItem && row.itemType && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted whitespace-nowrap text-muted-foreground hidden lg:inline-block">
                            {getLocalizedGlItemType(row.itemType, t)}
                          </span>
                        )}
                        {row.isItem && row.isTemporary && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 font-semibold whitespace-nowrap">
                            {t('accounting:general_ledger.status.temporary', 'Ideiglenes')}
                          </span>
                        )}
                        {row.isItem && !row.isTemporary && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold whitespace-nowrap">
                            {t('accounting:general_ledger.status.final', 'Végleges')}
                          </span>
                        )}
                      </div>
                      
                      {viewLayout === 'classic' ? (
                        <>
                          {/* Forgalom Tartozik */}
                          <div className="p-3 text-right text-xs sm:text-sm tabular-nums font-mono flex items-center justify-end">
                            {row.isItem ? (
                              row.balance > 0 ? (
                                <span className={row.isTemporary ? "text-orange-500 dark:text-orange-400 font-medium" : "text-emerald-600 dark:text-emerald-400 font-medium"}>
                                  {formatCurrency(row.balance)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )
                            ) : (
                              (row.debitTurnover || 0) > 0 ? (
                                <span className="font-semibold text-foreground">
                                  {formatCurrency(row.debitTurnover || 0)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )
                            )}
                          </div>

                          {/* Forgalom Követel */}
                          <div className="p-3 text-right text-xs sm:text-sm tabular-nums font-mono flex items-center justify-end">
                            {row.isItem ? (
                              row.balance < 0 ? (
                                <span className={row.isTemporary ? "text-orange-500 dark:text-orange-400 font-medium" : "text-rose-600 dark:text-rose-400 font-medium"}>
                                  {formatCurrency(Math.abs(row.balance))}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )
                            ) : (
                              (row.creditTurnover || 0) > 0 ? (
                                <span className="font-semibold text-foreground">
                                  {formatCurrency(row.creditTurnover || 0)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )
                            )}
                          </div>

                          {/* Egyenleg Tartozik */}
                          <div className="p-3 text-right text-xs sm:text-sm tabular-nums font-mono bg-indigo-500/5 flex items-center justify-end">
                            {row.balance > 0 ? (
                              <span className={cn(
                                "font-semibold",
                                row.isItem && row.isTemporary ? "text-orange-500 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"
                              )}>
                                {formatCurrency(row.balance)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </div>

                          {/* Egyenleg Követel + Edit button */}
                          <div className="p-3 text-right text-xs sm:text-sm tabular-nums font-mono bg-indigo-500/5 flex items-center justify-end gap-2 pr-2">
                            {row.balance < 0 ? (
                              <span className={cn(
                                "font-semibold",
                                row.isItem && row.isTemporary ? "text-orange-500 dark:text-orange-400" : "text-rose-600 dark:text-rose-400"
                              )}>
                                {formatCurrency(Math.abs(row.balance))}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                            {row.isItem && row.sourceTable !== 'acc_journal_lines' && row.sourceTable !== 'journal_entry' ? (
                              <CustomTooltip content={t('accounting:general_ledger.tooltips.edit_gl', 'Főkönyvi szám módosítása')} side="left">
                                <Button
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity print:hidden shrink-0"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingItem(row);
                                    setSelectedNewGL(row.originalGlId || 'UNCLASSIFIED');
                                    setDialogSearchQuery('');
                                    setIsEditOpen(true);
                                  }}
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                              </CustomTooltip>
                            ) : (
                              <div className="w-6 h-6 shrink-0 print:hidden" />
                            )}
                          </div>
                        </>
                      ) : (
                        <div className={cn("col-span-2 p-3 flex justify-end items-center gap-4 text-sm tabular-nums font-medium")}>
                           <div className="flex flex-col items-end">
                             {row.isItem ? (
                               row.isTemporary ? (
                                 <span className="text-orange-500 dark:text-orange-400 font-semibold">
                                   {row.balance !== 0 ? formatCurrency(row.balance) : ""}
                                 </span>
                               ) : (
                                 <span className={cn(
                                   "font-semibold",
                                   row.balance > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                 )}>
                                   {row.balance !== 0 ? formatCurrency(row.balance) : ""}
                                 </span>
                               )
                             ) : (
                               <div className="flex flex-col items-end gap-0.5">
                                 {row.finalBalance !== 0 && (
                                   <CustomTooltip content={t('accounting:general_ledger.tooltips.final_balance', 'Végleges egyenleg')} side="top">
                                     <span 
                                       className={cn(
                                         "font-semibold",
                                         row.finalBalance > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                       )} 
                                     >
                                       {formatCurrency(row.finalBalance || 0)}
                                     </span>
                                   </CustomTooltip>
                                 )}
                                 {row.tempBalance !== 0 && (
                                   <CustomTooltip content={t('accounting:general_ledger.tooltips.temp_balance', 'Ideiglenes egyenleg')} side="top">
                                     <span className="text-orange-500 dark:text-orange-400 font-semibold text-xs">
                                       {formatCurrency(row.tempBalance || 0)} <span className="text-[10px] opacity-80">{t('accounting:general_ledger.status.temp_badge', '(Ideigl.)')}</span>
                                     </span>
                                   </CustomTooltip>
                                 )}
                                 {(!row.finalBalance || row.finalBalance === 0) && (!row.tempBalance || row.tempBalance === 0) && row.balance !== 0 && (
                                   <span className={cn(
                                     "font-semibold",
                                     row.balance > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                   )}>
                                     {formatCurrency(row.balance)}
                                   </span>
                                 )}
                               </div>
                             )}
                            {row.originalCurrency && row.originalCurrency !== 'HUF' && (
                              <span className="text-[10px] text-muted-foreground font-normal leading-tight">
                                ({formatCurrency(row.originalAmount || 0).replace(',00', '')} {row.originalCurrency})
                              </span>
                            )}
                          </div>
                          {row.isItem && row.sourceTable !== 'acc_journal_lines' && row.sourceTable !== 'journal_entry' ? (
                            <CustomTooltip content={t('accounting:general_ledger.tooltips.edit_gl', 'Főkönyvi szám módosítása')} side="left">
                              <Button
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity print:hidden shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingItem(row);
                                  // We use originalGlId to pre-fill the form, or UNCLASSIFIED if not mapped
                                  setSelectedNewGL(row.originalGlId || 'UNCLASSIFIED');
                                  setDialogSearchQuery('');
                                  setIsEditOpen(true);
                                }}
                              >
                                <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </CustomTooltip>
                          ) : (
                            // Placeholder to keep spacing identical even when there's no edit button
                            <div className="w-6 h-6 shrink-0 print:hidden" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Excluded items section */}
              {excludedItems.length > 0 && (
                <div className="border-t border-amber-500/20 bg-amber-500/5">
                  <button
                    type="button"
                    onClick={() => setExpandedRowIds(prev => {
                      const next = new Set(prev);
                      if (next.has('__excluded__')) next.delete('__excluded__');
                      else next.add('__excluded__');
                      return next;
                    })}
                    className="w-full px-5 py-2.5 flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                  >
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", expandedRowIds.has('__excluded__') && "rotate-180")} />
                    <span>{t('accounting:general_ledger.table.unposted_items', { count: excludedItems.length, defaultValue: `Nem könyvelt tételek (${excludedItems.length})` })}</span>
                    <span className="ml-auto font-mono tabular-nums">
                      {formatCurrency(excludedItems.reduce((s, i) => s + i.amount, 0))}
                    </span>
                  </button>
                  {expandedRowIds.has('__excluded__') && (
                    <div className="divide-y divide-amber-200/30">
                      {excludedItems.map(item => (
                        <div key={item.id} className="grid grid-cols-12 px-5 py-1.5 text-xs text-amber-800/70 dark:text-amber-400/70 hover:bg-amber-500/10 transition-colors">
                          <div className="col-span-2 font-mono tabular-nums text-center">
                            {item.date ? item.date.substring(0, 10).replace(/-/g, '.') : ''}
                          </div>
                          <CustomTooltip content={getLocalizedGlItemDescription(item.name, t)} side="top">
                            <div className="col-span-7 truncate">
                              {getLocalizedGlItemDescription(item.name, t)}
                              {item.itemType && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 whitespace-nowrap">{getLocalizedGlItemType(item.itemType, t)}</span>
                              )}
                            </div>
                          </CustomTooltip>
                          <div className="col-span-3 text-right font-mono tabular-nums font-medium">
                            {item.amount !== 0 ? formatCurrency(item.amount) : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sticky Footer at the bottom of the table card */}
              {viewLayout === 'classic' ? (
                <div className={cn("sticky bottom-0 shrink-0 grid border-t border-border/60 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] bg-muted/95 backdrop-blur font-bold text-xs sm:text-sm divide-x divide-border/40 z-20 print:border-t-2 mt-auto", gridColsClass)}>
                  <div className="p-3 text-center uppercase tracking-wider text-muted-foreground font-mono">Σ</div>
                  <div className="p-3 text-right uppercase tracking-wider text-muted-foreground">{t('accounting:general_ledger.table.total', 'Összesen:')}</div>
                  <div className="p-3 text-right tabular-nums font-mono">
                    {formatCurrency(classicTotals.turnoverDebit)}
                  </div>
                  <div className="p-3 text-right tabular-nums font-mono">
                    {formatCurrency(classicTotals.turnoverCredit)}
                  </div>
                  <div className="p-3 text-right tabular-nums font-mono bg-indigo-500/5">
                    {formatCurrency(classicTotals.balanceDebit)}
                  </div>
                  <div className="p-3 text-right tabular-nums font-mono bg-indigo-500/5 flex items-center justify-end gap-2 pr-2">
                    <span>{formatCurrency(classicTotals.balanceCredit)}</span>
                    <CustomTooltip content={t('accounting:general_ledger.tooltips.refresh', 'Adatok frissítése')} side="top">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleRefetchAll} 
                        disabled={isFetching}
                        className="h-6 w-6 rounded-full shrink-0"
                      >
                        <RefreshCw className={cn("h-3 w-3", isFetching ? "animate-spin" : "")} />
                      </Button>
                    </CustomTooltip>
                  </div>
                </div>
              ) : (
                <div className="sticky bottom-0 shrink-0 grid grid-cols-12 border-t border-border/60 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] bg-muted/95 backdrop-blur font-bold text-sm z-20 print:border-t-2 mt-auto">
                   <div className="col-span-10 p-3 text-right uppercase tracking-wider text-muted-foreground">{t('accounting:general_ledger.table.total', 'Összesen:')}</div>
                   <div className="col-span-2 p-3 text-right tabular-nums text-foreground flex items-center justify-end gap-2 pr-4">
                      {isDataLoading ? (
                        <div className="h-4 w-20 animate-pulse bg-muted rounded" />
                      ) : (
                        <>
                          {formatCurrency(footerTotals)}
                          <CustomTooltip content={t('accounting:general_ledger.tooltips.refresh', 'Adatok frissítése')} side="top">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={handleRefetchAll} 
                              disabled={isFetching}
                              className="h-6 w-6 rounded-full"
                            >
                              <RefreshCw className={cn("h-3 w-3", isFetching ? "animate-spin" : "")} />
                            </Button>
                          </CustomTooltip>
                        </>
                      )}
                   </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleExpandAll} className="gap-2 cursor-pointer">
          <Maximize2 className="h-4 w-4" />
          <span>{t('accounting:general_ledger.context_menu.expand_all')}</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCollapseAll} className="gap-2 cursor-pointer">
          <Minimize2 className="h-4 w-4" />
          <span>{t('accounting:general_ledger.context_menu.collapse_all')}</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleRefetchAll} disabled={isFetching} className="gap-2 cursor-pointer">
          <RefreshCw className={cn("h-4 w-4", isFetching ? "animate-spin text-muted-foreground" : "")} />
          <span>{isFetching ? t('accounting:general_ledger.context_menu.refreshing') : t('accounting:general_ledger.context_menu.refresh')}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem 
                ? t('accounting:general_ledger.edit_category_modal.single_title', 'Főkönyvi szám módosítása') 
                : t('accounting:general_ledger.edit_category_modal.bulk_title', 'Átkontírozás másik számlára')}
            </DialogTitle>
            <DialogDescription>
              {editingItem 
                ? t('accounting:general_ledger.edit_category_modal.single_desc', 'Egy tétel módosítása') 
                : t('accounting:general_ledger.edit_category_modal.bulk_desc', { count: selectedItemIds.size, defaultValue: `${selectedItemIds.size} kijelölt tétel tömeges átkontírozása másik főkönyvi számra` })}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 flex flex-col gap-4 w-full overflow-hidden">
            <div className="bg-muted p-3 rounded-md border text-sm flex items-center justify-between w-full overflow-hidden gap-2">
              <span className="font-medium text-muted-foreground whitespace-nowrap">{t('accounting:general_ledger.edit_category_modal.new_category')}</span>
              <span className="font-bold text-foreground bg-background px-3 py-1.5 rounded border border-border shadow-sm truncate max-w-full">
                {selectedNewGL === 'UNCLASSIFIED' ? <span className="text-muted-foreground italic">{t('accounting:general_ledger.edit_category_modal.unclassified_removed')}</span> :
                  (selectedNewGL && dbData
                  ? (() => {
                      const gl = dbData.find(g => g.gl_account_id === selectedNewGL);
                      return gl ? `${gl.gl_number} ${getLocalizedGlAccountName(gl.gl_number, gl.short_name, t, isCroatia)}` : t('accounting:general_ledger.edit_category_modal.choose_from_list');
                    })()
                  : t('accounting:general_ledger.edit_category_modal.choose_from_list'))}
              </span>
            </div>

            <Command className="rounded-lg border shadow-sm w-full overflow-hidden h-[350px]" shouldFilter={false}>
              <CommandInput 
                placeholder={t('accounting:general_ledger.edit_category_modal.search_placeholder')} 
                value={dialogSearchQuery}
                onValueChange={setDialogSearchQuery}
                className="w-full"
              />
              <CommandList className="h-[300px] max-h-[300px] overflow-y-auto w-full overflow-x-hidden">
                <CommandEmpty>{t('accounting:general_ledger.edit_category_modal.no_results')}</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    key="unclassified"
                    value="besorolatlan uncategorized eltavolitas nincs"
                    onSelect={() => setSelectedNewGL('UNCLASSIFIED')}
                    className="cursor-pointer py-2 w-full overflow-hidden flex items-center mb-1 text-muted-foreground bg-muted/30"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        selectedNewGL === 'UNCLASSIFIED' ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className={cn("truncate block w-full", selectedNewGL === 'UNCLASSIFIED' ? "font-bold text-foreground" : "font-medium")}>
                      {t('accounting:general_ledger.edit_category_modal.unclassified_option')}
                    </span>
                  </CommandItem>
                  {dbData
                    ?.filter(gl => {
                      if (!dialogSearchQuery) return true;
                      const q = dialogSearchQuery.toLowerCase();
                      const locName = getLocalizedGlAccountName(gl.gl_number, gl.short_name, t, isCroatia);
                      return `${gl.gl_number} ${gl.short_name}`.toLowerCase().includes(q) ||
                             `${gl.gl_number} ${locName}`.toLowerCase().includes(q);
                    })
                    .slice()
                    .sort((a,b) => cleanIdVal(a.gl_number).localeCompare(cleanIdVal(b.gl_number)))
                    .map(gl => {
                      const clean = cleanIdVal(gl.gl_number);
                      const isLeaf = clean.length >= 3 || !dbData.some(sub => cleanIdVal(sub.gl_number).startsWith(clean) && sub.gl_account_id !== gl.gl_account_id);
                      if (!isLeaf) return null;
                      
                      return (
                        <CommandItem
                          key={gl.gl_account_id}
                          value={`${gl.gl_number} ${gl.short_name}`}
                          onSelect={() => setSelectedNewGL(gl.gl_account_id)}
                          className="cursor-pointer py-2 w-full overflow-hidden flex items-center"
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 text-primary shrink-0",
                              selectedNewGL === gl.gl_account_id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className={cn("truncate block w-full", selectedNewGL === gl.gl_account_id ? "font-bold text-foreground" : "")}>
                            {gl.gl_number} {getLocalizedGlAccountName(gl.gl_number, gl.short_name, t, isCroatia)}
                          </span>
                        </CommandItem>
                      );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSubmitting}>{t('accounting:general_ledger.edit_category_modal.cancel')}</Button>
            <Button onClick={handleSaveOverride} disabled={!selectedNewGL || isSubmitting || (editingItem && selectedNewGL === (editingItem.originalGlId || 'UNCLASSIFIED'))}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingItem 
                ? t('accounting:general_ledger.edit_category_modal.save', 'Mentés') 
                : t('accounting:general_ledger.edit_category_modal.execute_bulk', 'Átkontírozás végrehajtása')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedLeafAccount} onOpenChange={(open) => { if (!open) setSelectedLeafAccount(null); }}>
        <SheetContent className="sm:max-w-[720px] w-[90vw] overflow-y-auto flex flex-col h-full bg-background border-l">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {t('accounting:general_ledger.entries_sheet.title', { code: selectedLeafAccount?.code })}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {t('accounting:general_ledger.entries_sheet.desc', { name: selectedLeafAccount?.name })}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {isLoadingEntries ? (
              <div className="flex justify-center items-center h-48 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-sm">{t('accounting:general_ledger.entries_sheet.loading')}</span>
              </div>
            ) : !journalEntries?.length ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                {t('accounting:general_ledger.entries_sheet.no_entries')}
              </div>
            ) : (
              <div className="space-y-3">
                {journalEntries.map((entry: any) => {
                  const isDebit = entry.debit_account === selectedLeafAccount?.code;
                  return (
                    <div 
                      key={entry.id} 
                      className="border rounded-xl p-4 bg-card hover:bg-muted/30 transition-all text-xs space-y-2.5 relative overflow-hidden"
                    >
                      <div className={cn(
                        "absolute top-0 left-0 bottom-0 w-1",
                        isDebit ? "bg-emerald-500" : "bg-rose-500"
                      )} />
                      
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-foreground">{entry.description || t('accounting:general_ledger.entries_sheet.untitled_item')}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {t('accounting:general_ledger.entries_sheet.doc_id', { num: entry.voucher_number || '-' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground tabular-nums">
                            {formatCurrency(entry.amount)} {currencyLabel}
                          </p>
                          {entry.foreign_currency && entry.foreign_currency !== defaultCurrency && entry.foreign_amount && (
                            <p className="text-[10px] font-medium text-muted-foreground tabular-nums">
                              {formatNumberLocale(Number(entry.foreign_amount), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {entry.foreign_currency}
                              {entry.exchange_rate ? ` (@${formatNumberLocale(Number(entry.exchange_rate))} ${currencyLabel})` : ''}
                            </p>
                          )}
                          <p className={cn(
                            "text-[10px] font-semibold mt-0.5",
                            isDebit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          )}>
                            {isDebit ? t('accounting:general_ledger.entries_sheet.debit') : t('accounting:general_ledger.entries_sheet.credit')}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                        <div>
                          <span className="block opacity-75">{t('accounting:general_ledger.entries_sheet.partner')}</span>
                          <span className="font-medium text-foreground truncate block">{entry.partner_name || '-'}</span>
                        </div>
                        <div>
                          <span className="block opacity-75">{t('accounting:general_ledger.entries_sheet.contra_gl')}</span>
                          <span className="font-medium text-foreground block font-mono">
                            {isDebit ? entry.credit_account : entry.debit_account}
                          </span>
                        </div>
                        <div>
                          <span className="block opacity-75">{t('accounting:general_ledger.entries_sheet.date_fulfillment')}</span>
                          <span className="font-medium text-foreground block">
                            {entry.voucher_date?.replace(/-/g, '.')} / {entry.service_date?.replace(/-/g, '.')}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <FloatingBulkBar
        open={selectedItemIds.size > 0}
        count={selectedItemIds.size}
        itemUnit="tétel"
        details={
          <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-muted-foreground">
            <span>Összeg:</span>
            <span className="font-semibold text-foreground">{formatCurrency(selectedItemsSum)}</span>
          </div>
        }
        hideSaveButton={true}
        onCancel={() => setSelectedItemIds(new Set())}
        cancelLabel={t('accounting:general_ledger.bulk.clear_selection', 'Kijelölés törlése')}
      >
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setEditingItem(null);
            setSelectedNewGL('UNCLASSIFIED');
            setDialogSearchQuery('');
            setIsEditOpen(true);
          }}
        >
          <ArrowRightLeft className="w-4 h-4" />
          {t('accounting:general_ledger.bulk.reclassify_btn', 'Átkontírozás másik számlára')}
        </Button>
      </FloatingBulkBar>
    </>
  );
}

const GeneralLedgerTable = React.memo(forwardRef(GeneralLedgerTableBase));

GeneralLedgerTable.displayName = 'GeneralLedgerTable';

export default GeneralLedgerTable;
