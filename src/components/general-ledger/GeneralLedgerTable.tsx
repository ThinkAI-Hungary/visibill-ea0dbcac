import React, { useState, useMemo, forwardRef, useImperativeHandle, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn, fixCharacterEncoding } from '@/lib/utils';
import { ChevronDown, ChevronRight, Maximize2, Minimize2, Loader2, RefreshCw, Edit2, X, Check, ChevronsUpDown, FileText } from 'lucide-react';
import { exportGlExcel, exportGlAnalyticalExcel } from '@/lib/glExport';
import { fetchAllGlBalances, fetchAllGlCategorizedItems, fetchGlItemsForAccount, GlDateBasis, GlPostingStatus, GlSearchResult } from '@/lib/glData';
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
import { useCompany } from '@/contexts/CompanyContext';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { reportError } from '@/lib/errorReporter';

interface LedgerItem {
  id: string; // Fők.szám
  name: string; // Megnevezés
  balance: number; // Összesített Egyenleg
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
}

const formatCurrency = (value: number) => {
  if (value === 0) return '0,00';
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

function cleanIdVal(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export interface GeneralLedgerTableRef {
  expandAllAndPrint: () => void;
  exportExcel: (companyName?: string) => Promise<void>;
  exportAnalyticalExcel: (companyName?: string) => Promise<void>; // F6
  getStats: () => { accountCount: number; leafCount: number; totalDebit: number; totalCredit: number };
  expandAll: () => void;
  collapseAll: () => void;
  navigateToEntity: (result: GlSearchResult) => Promise<void>;
}

interface GeneralLedgerTableProps {
  presetId?: string;
  dateFrom?: string;
  dateTo?: string;
  dateBasis?: GlDateBasis;
  postingStatus?: GlPostingStatus;
  globalSearch?: string;
  isPolling?: boolean; // P4: only poll when AI/import is running
  onStatsChange?: (stats: { accountCount: number; leafCount: number; totalDebit: number; totalCredit: number; classifiedItems: number; totalItems: number }) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  printLayoutMode?: 'synthetic' | 'analytical';
}

interface LoadMoreSentinelRowProps {
  row: LedgerItem;
  hiddenClass: string;
  indentPadding: string;
  onLoadMore: (cid: string) => void;
}

function LoadMoreSentinelRow({ row, hiddenClass, indentPadding, onLoadMore }: LoadMoreSentinelRowProps) {
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
        "grid grid-cols-12 divide-x divide-border/10 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer py-2.5 items-center select-none border-b border-border/20",
        hiddenClass
      )}
    >
      <div className="col-span-2 p-2 flex items-center justify-center">
        {isLoadingMore ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-primary" />
        )}
      </div>
      <div className="col-span-7 py-1 pr-3 text-xs flex items-center gap-2 font-medium text-primary" style={{ paddingLeft: indentPadding }}>
        <span>{isLoadingMore ? 'Következő 100 tétel betöltése...' : row.name}</span>
      </div>
      <div className="col-span-3 p-2 flex justify-end items-center text-[11px] text-muted-foreground pr-4 font-mono">
        {isLoadingMore ? 'Betöltés...' : 'Görgess vagy kattints'}
      </div>
    </div>
  );
}

function GeneralLedgerTableBase(props: GeneralLedgerTableProps, ref: React.ForwardedRef<GeneralLedgerTableRef>) {
  const { presetId, dateFrom, dateTo, dateBasis = 'kibocsatas', postingStatus = 'all', isPolling, onStatsChange, onLoadingChange, printLayoutMode = 'analytical' } = props;
  const { selectedCompany } = useCompany();
  const { session } = useAuth();
  const { toast } = useToast();

  // Dialog states for editing GL classification
  const [editingItem, setEditingItem] = useState<LedgerItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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

  // Cache tree expansion state in localStorage
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`visibill_gl_expanded_${presetId}_${selectedCompany?.id}`);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (e) {}
    return new Set(['1', '13', '14']);
  });
  
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!presetId || !selectedCompany?.id) return;
    try {
      const stored = localStorage.getItem(`visibill_gl_expanded_${presetId}_${selectedCompany.id}`);
      if (stored) {
        setExpandedRowIds(new Set(JSON.parse(stored)));
      } else {
        setExpandedRowIds(new Set(['1', '13', '14']));
      }
    } catch (e) {
      setExpandedRowIds(new Set(['1', '13', '14']));
    }
  }, [presetId, selectedCompany?.id]);

  useEffect(() => {
    if (!presetId || !selectedCompany?.id) return;
    try {
      localStorage.setItem(
        `visibill_gl_expanded_${presetId}_${selectedCompany.id}`,
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

  // On-demand loaded transaction items per account CID: Map<accountCid, LedgerItem[]>
  const [loadedAccountItems, setLoadedAccountItems] = useState<Map<string, LedgerItem[]>>(new Map());
  const [loadingAccountCids, setLoadingAccountCids] = useState<Set<string>>(new Set());
  const [hasMoreAccountCids, setHasMoreAccountCids] = useState<Set<string>>(new Set());
  const [loadingMoreAccountCids, setLoadingMoreAccountCids] = useState<Set<string>>(new Set());

  // Reset loaded account items when filters change
  useEffect(() => {
    setLoadedAccountItems(new Map());
    setLoadingAccountCids(new Set());
    setHasMoreAccountCids(new Set());
    setLoadingMoreAccountCids(new Set());
  }, [presetId, selectedCompany?.id, dateFrom, dateTo, dateBasis, postingStatus]);

  // Filter change detection: whenever filters change, show skeleton until query finishes
  const currentFilterKey = `${presetId}_${selectedCompany?.id}_${dateFrom}_${dateTo}_${dateBasis}_${postingStatus}`;
  const [renderedFilterKey, setRenderedFilterKey] = useState(currentFilterKey);

  const isFilterChanging = currentFilterKey !== renderedFilterKey;
  const isDataLoading = isLoading || isFilterChanging || !presetId || !dbData;

  useEffect(() => {
    if (isFilterChanging && !isFetching) {
      setRenderedFilterKey(currentFilterKey);
    }
  }, [isFilterChanging, isFetching, currentFilterKey]);

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
    setLoadedAccountItems(new Map());
  };


  // NOTE: Realtime subscription for GL tables (transactions, invoice_items,
  // nav_invoices, nav_invoice_items) is handled globally by LiveNotificationProvider.
  // No duplicate channel needed here — it already invalidates the relevant query caches.


  const cleanIdVal = (id: any) => id ? String(id).replace(/\./g, '') : '';

  const handleSaveOverride = async () => {
    const itemsToUpdate = editingItem ? [editingItem] : tableData.filter(d => selectedItemIds.has(d.id));
    if (itemsToUpdate.length === 0 || !selectedNewGL || !selectedCompany?.id || !session?.user.id) return;
    
    setIsSubmitting(true);
    
    const newGlItem = selectedNewGL === 'UNCLASSIFIED' ? null : dbData?.find(gl => gl.gl_account_id === selectedNewGL);
    const newGlNumber = newGlItem?.gl_number || '';

    const payloadItems = itemsToUpdate.map(item => ({
       item_id: item.id.replace('item_', ''),
       source_table: item.sourceTable || '',
       original_gl_account_id: item.originalGlId || null
    }));

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

  // Calculate actual table data
  const tableData = useMemo(() => {
    const cleanId = cleanIdVal;
    
    if (dbData && dbData.length > 0) {
      // Step 1: Pre-calculate hasAccountChildren, hasItemChildren and clean IDs
      const rawData = dbData.map(dbItem => {
        const cid = cleanId(dbItem.gl_number);
        const hasAccountChildren = dbData.some(d => 
          cleanId(d.gl_number).startsWith(cid) && 
          cleanId(d.gl_number) !== cid
        );
        const directItemCount = Number(dbItem.item_count) || 0;
        const hasItemChildren = directItemCount > 0;
        
        return {
          id: String(dbItem.gl_number),
          name: fixCharacterEncoding(dbItem.short_name),
          glAccountId: dbItem.gl_account_id,
          balance: Number(dbItem.total_balance) || 0,
          directFinalBalance: Number(dbItem.final_balance) || 0,
          directTempBalance: Number(dbItem.temp_balance) || 0,
          directItemCount,
          hasChildren: hasAccountChildren || hasItemChildren,
          hasAccountChildren,
          hasItemChildren,
          cid
        };
      });

      // Now roll up sums and split final vs temporary balances for all parent nodes
      let rolledUpData: LedgerItem[] = rawData.map(item => {
        if (item.hasAccountChildren) {
          const descendants = rawData.filter(d => d.cid.startsWith(item.cid));
          let finalBalance = 0;
          let tempBalance = 0;
          descendants.forEach(d => {
            finalBalance += d.directFinalBalance;
            tempBalance += d.directTempBalance;
          });
          const totalBalance = finalBalance + tempBalance;

          return { 
            ...item, 
            balance: totalBalance,
            finalBalance,
            tempBalance
          };
        } else {
          return {
            ...item,
            balance: item.balance,
            finalBalance: item.directFinalBalance,
            tempBalance: item.directTempBalance
          };
        }
      });

      // ── Build hierarchical tree and flatten in depth-first order ──
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

      const childrenMap = new Map<string, LedgerItem[]>();
      const roots: LedgerItem[] = [];

      rolledUpData.forEach(node => {
        let directParent: LedgerItem | null = null;
        rolledUpData.forEach(candidate => {
          if (candidate.cid !== node.cid && node.cid.startsWith(candidate.cid)) {
            if (!directParent || candidate.cid.length > directParent.cid.length) {
              directParent = candidate;
            }
          }
        });

        if (!directParent) {
          roots.push(node);
        } else {
          if (!childrenMap.has(directParent.cid)) {
            childrenMap.set(directParent.cid, []);
          }
          childrenMap.get(directParent.cid)!.push(node);
        }
      });

      const combinedData: LedgerItem[] = [];

      const traverseTree = (node: LedgerItem) => {
        // 1. Emit the account node itself
        combinedData.push(node);

        // 2. Emit direct transaction items booked to this account (if expanded)
        if (expandedRowIds.has(node.id)) {
          if (loadingAccountCids.has(node.cid)) {
            combinedData.push({
              id: `loading_${node.cid}`,
              name: 'Tételek betöltése...',
              balance: 0,
              hasChildren: false,
              cid: `${node.cid}_loading`,
              isItem: true,
              isLoadingRow: true
            });
          } else {
            const directItems = loadedAccountItems.get(node.cid);
            if (directItems && directItems.length > 0) {
              combinedData.push(...directItems);

              // If there are more items to load for this account, emit sentinel load-more row
              if (hasMoreAccountCids.has(node.cid)) {
                const totalItemCount = node.directItemCount || 0;
                combinedData.push({
                  id: `loadmore_${node.cid}`,
                  name: `További 100 tétel betöltése (${directItems.length} / ${totalItemCount > 0 ? totalItemCount : 'több'} megjelenítve)`,
                  balance: 0,
                  hasChildren: false,
                  cid: `${node.cid}_loadmore`,
                  isItem: true,
                  isLoadMoreRow: true,
                  targetCid: node.cid,
                  isLoadingMore: loadingMoreAccountCids.has(node.cid)
                });
              }
            }
          }
        }

        // 3. Emit direct child accounts (sorted by compareGlAccounts)
        const childAccounts = childrenMap.get(node.cid);
        if (childAccounts && childAccounts.length > 0) {
          childAccounts.sort(compareGlAccounts);
          childAccounts.forEach(child => traverseTree(child));
        }
      };

      roots.sort(compareGlAccounts);
      roots.forEach(root => traverseTree(root));

      return combinedData;
    }
    return [];
  }, [dbData, loadedAccountItems, loadingAccountCids, hasMoreAccountCids, loadingMoreAccountCids, expandedRowIds]);

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
    exportExcel: async (companyName?: string) => {
      await exportGlExcel(processedRows, companyName, footerTotals, dateBasis, dateFrom, dateTo);
    },
    exportAnalyticalExcel: async (companyName?: string) => {
      if (!selectedCompany?.id || !presetId || !dbData) return;
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

        const cleanId = cleanIdVal;
        const glIdToCid = new Map<string, string>();
        dbData.forEach(db => {
          if (db.gl_account_id) {
            glIdToCid.set(db.gl_account_id, cleanId(db.gl_number));
          }
        });

        const itemsByGL = new Map<string, LedgerItem[]>();
        allItems.filter(i => !i.is_excluded).forEach(item => {
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
            isTemporary: (!item.gl_account_id || item.gl_account_id === '00000000-0000-0000-0000-000000000000')
          });
        });

        const rawAccounts = dbData.map(dbItem => {
          const cid = cleanId(dbItem.gl_number);
          const hasAccountChildren = dbData.some(d =>
            cleanId(d.gl_number).startsWith(cid) && cleanId(d.gl_number) !== cid
          );
          return {
            id: String(dbItem.gl_number),
            name: fixCharacterEncoding(dbItem.short_name),
            balance: Number(dbItem.total_balance) || 0,
            hasChildren: hasAccountChildren || itemsByGL.has(cid),
            hasAccountChildren,
            hasItemChildren: itemsByGL.has(cid),
            cid
          };
        });

        const compareGlAccounts = (a: any, b: any) => {
          if (a.cid === 'UNCLASSIFIED') return 1;
          if (b.cid === 'UNCLASSIFIED') return -1;
          const isPureDigitsA = /^\d+$/.test(a.cid);
          const isPureDigitsB = /^\d+$/.test(b.cid);
          if (isPureDigitsA && isPureDigitsB) return a.cid.localeCompare(b.cid);
          return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
        };

        const childrenMap = new Map<string, any[]>();
        const roots: any[] = [];
        rawAccounts.forEach(node => {
          let directParent: any = null;
          rawAccounts.forEach(candidate => {
            if (candidate.cid !== node.cid && node.cid.startsWith(candidate.cid)) {
              if (!directParent || candidate.cid.length > directParent.cid.length) {
                directParent = candidate;
              }
            }
          });
          if (!directParent) roots.push(node);
          else {
            if (!childrenMap.has(directParent.cid)) childrenMap.set(directParent.cid, []);
            childrenMap.get(directParent.cid)!.push(node);
          }
        });

        const fullExportRows: any[] = [];
        const traverse = (node: any, depth = 0) => {
          fullExportRows.push({ ...node, depth, isRoot: depth === 0 });
          const directItems = itemsByGL.get(node.cid);
          if (directItems && directItems.length > 0) {
            directItems.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
            directItems.forEach(item => fullExportRows.push({ ...item, depth: depth + 1 }));
          }
          const children = childrenMap.get(node.cid);
          if (children && children.length > 0) {
            children.sort(compareGlAccounts);
            children.forEach(child => traverse(child, depth + 1));
          }
        };

        roots.sort(compareGlAccounts);
        roots.forEach(root => traverse(root, 0));

        await exportGlAnalyticalExcel(fullExportRows, companyName, footerTotals, dateBasis, dateFrom, dateTo);
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
    if (loadedAccountItems.has(targetCid) || loadingAccountCids.has(targetCid)) return;

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

      const mappedItems: LedgerItem[] = items.map(item => {
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
          isTemporary: (!item.gl_account_id || item.gl_account_id === '00000000-0000-0000-0000-000000000000' || item.is_temporary)
        };
      });

      setLoadedAccountItems(prev => {
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
  }, [dbData, selectedCompany?.id, presetId, dateFrom, dateTo, dateBasis, postingStatus, exchangeRates, loadedAccountItems, loadingAccountCids]);

  const fetchMoreAccountItems = useCallback(async (targetCid: string) => {
    if (!dbData || !selectedCompany?.id || !presetId) return;
    if (loadingMoreAccountCids.has(targetCid)) return;

    const currentItems = loadedAccountItems.get(targetCid) || [];
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

      const mappedItems: LedgerItem[] = items.map(item => {
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
          isTemporary: (!item.gl_account_id || item.gl_account_id === '00000000-0000-0000-0000-000000000000' || item.is_temporary)
        };
      });

      setLoadedAccountItems(prev => {
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
  }, [dbData, selectedCompany?.id, presetId, dateFrom, dateTo, dateBasis, postingStatus, exchangeRates, loadedAccountItems, loadingMoreAccountCids]);

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
      } else {
        next.add(id);
      }
      return next;
    });

    if (!isCurrentlyExpanded) {
      const targetRow = tableData.find(d => d.id === id);
      if (targetRow && targetRow.hasItemChildren) {
        fetchAccountItemsOnDemand(targetRow.cid);
      }
    }
  };

  // Load items for any expanded leaf accounts on mount / expand restore
  useEffect(() => {
    if (!dbData || !selectedCompany?.id || !presetId) return;
    expandedRowIds.forEach(id => {
      const row = tableData.find(d => d.id === id);
      if (row && row.hasItemChildren) {
        fetchAccountItemsOnDemand(row.cid);
      }
    });
  }, [expandedRowIds, tableData, dbData, selectedCompany?.id, presetId, fetchAccountItemsOnDemand]);




  // Pre-calculate which categories contain items so we know what to expand during print
  const categoriesWithItems = useMemo(() => {
    const result = new Set<string>();
    const itemNodes = tableData.filter(d => d.isItem);
    const nonItemNodes = tableData.filter(d => !d.isItem);
    
    itemNodes.forEach(item => {
      nonItemNodes.forEach(node => {
        if (item.cid.startsWith(node.cid) && item.cid !== node.cid) {
          result.add(node.id);
        }
      });
    });
    return result;
  }, [tableData]);

  // Determine if a row should be visible based on expanded state of its ancestors
  const processedRows = useMemo(() => {
    const nonItemNodes = tableData.filter(d => !d.isItem);

    return tableData.map(item => {
      // Find all ancestors (only searching through the ~100 category nodes, not all 10,000 items)
      const ancestors = nonItemNodes.filter(a => item.cid.startsWith(a.cid) && a.cid !== item.cid);
      
      const isRoot = ancestors.length === 0 && !item.isItem;
      const depth = ancestors.length;
      
      const isVisibleOnScreen = isRoot || ancestors.every(a => expandedRowIds.has(a.id));
      let isVisibleDuringPrint = isRoot || ancestors.every(a => {
        if (printLayoutMode === 'synthetic') return true;
        return categoriesWithItems.has(a.id);
      });

      if (printLayoutMode === 'synthetic' && item.isItem) {
        isVisibleDuringPrint = false;
      }
      
      return { ...item, isVisibleOnScreen, isVisibleDuringPrint, isRoot, depth };
    });
  }, [expandedRowIds, tableData, categoriesWithItems, printLayoutMode]);

  // Calculate generic footer totals by summing root level items
  const footerTotals = useMemo(() => {
    return tableData.reduce((acc, current) => {
      // Ignore leaf item rows since their balances are already natively rolled up inside their parents
      if (current.isItem) return acc;

      // Find if this item has any regular GL ancestors
      const isRoot = !tableData.some(d => 
        !d.isItem &&
        current.cid.startsWith(d.cid) && 
        d.cid !== current.cid
      );
      
      // we sum only root elements because they already include all children sums
      if (isRoot) {
         return acc + current.balance;
      }
      return acc;
    }, 0);
  }, [tableData]);

  if (isDataLoading) {
    return (
      <div className="w-full flex flex-col h-[65vh] max-h-[800px] bg-card overflow-hidden rounded-md border border-border">
        {/* Header */}
        <div className="bg-muted/80 border-b border-border text-sm font-semibold sticky top-0 z-20 hidden md:block select-none">
          <div className="grid grid-cols-12 divide-x divide-border/50">
            <div className="col-span-2 p-3 text-center text-xs text-foreground uppercase tracking-wider">Fők. szám</div>
            <div className="col-span-7 p-3 text-xs text-foreground uppercase tracking-wider">Megnevezés</div>
            <div className="col-span-3 p-3 text-right text-xs bg-indigo-500/5 text-foreground uppercase tracking-wider">Összesített Egyenleg</div>
          </div>
        </div>
        {/* Skeleton Body */}
        <div className="flex-1 divide-y divide-border/30 overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => {
            const depth = i % 3 === 0 ? 0 : i % 3 === 1 ? 1 : 2;
            const indentPadding = `${0.75 + (depth * 1.5)}rem`;
            return (
              <div key={i} className="grid grid-cols-12 divide-x divide-border/10 p-3 items-center animate-pulse">
                <div className="col-span-2 flex items-center justify-center">
                  <Skeleton className="h-4 w-12 bg-muted/50 rounded" />
                </div>
                <div className="col-span-7 flex items-center gap-2" style={{ paddingLeft: indentPadding }}>
                  <div className="w-4 h-4 shrink-0" />
                  <Skeleton className={cn("h-4 bg-muted/50 rounded", depth === 0 ? 'w-48' : depth === 1 ? 'w-36' : 'w-24')} />
                </div>
                <div className="col-span-3 flex justify-end">
                  <Skeleton className="h-4 w-24 bg-muted/50 rounded" />
                </div>
              </div>
            );
          })}
        </div>
        {/* Skeleton Footer */}
        <div className="shrink-0 grid grid-cols-12 border-t border-border/60 bg-muted/95 backdrop-blur font-bold text-sm">
          <div className="col-span-9 p-3 text-right uppercase tracking-wider text-muted-foreground text-xs">Összesen:</div>
          <div className="col-span-3 p-3 flex items-center justify-end gap-2 pr-4">
            <Skeleton className="h-4 w-24 bg-muted/50 rounded" />
            <Skeleton className="h-6 w-6 rounded-full bg-muted/50" />
          </div>
        </div>
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
                Új számlatükröt választottál. Szeretnéd, hogy az AI automatikusan besorolja a "Besorolatlan" tételeidet ebbe az új struktúrába is?
              </div>
              <div className="flex items-center gap-4 shrink-0 flex-wrap sm:flex-nowrap justify-end w-full sm:w-auto">
                <label className="flex items-center gap-2 text-xs text-indigo-600/80 cursor-pointer print:hidden">
                  <Checkbox 
                    checked={hideBannerNextTime} 
                    onCheckedChange={(checked) => setHideBannerNextTime(!!checked)} 
                    className="w-3.5 h-3.5 border-indigo-400 data-[state=checked]:bg-indigo-500 data-[state=checked]:text-white"
                  />
                  Ne mutasd újra amíg nincs új tétel
                </label>
                <div className="flex items-center gap-2">
                  <Button onClick={handleAiReclassification} disabled={isAiReclassifying} size="sm" className="whitespace-nowrap">
                    {isAiReclassifying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    {isAiReclassifying ? "AI átsorolás folyamatban..." : "Igen, besorolom"}
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
          {selectedItemIds.size > 0 && (
            <div className="px-5 py-3.5 bg-primary/10 border-b border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10 animate-in slide-in-from-top-2 print:hidden">
              <div className="text-sm font-medium text-foreground">
                <span className="font-bold text-primary">{selectedItemIds.size}</span> tétel kijelölve
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={() => {
                  setEditingItem(null);
                  setSelectedNewGL('UNCLASSIFIED'); // Default fallback
                  setSearchQuery('');
                  setIsEditOpen(true);
                }} size="sm">
                  Kijelöltek átsorolása
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedItemIds(new Set())}>
                  Mégse
                </Button>
              </div>
            </div>
          )}
          <div className="flex-1 overflow-auto print:overflow-visible w-full relative">
            <div className="w-full flex flex-col min-h-full pb-2 print:pb-0">
              
              {/* Header */}
              <div className="bg-muted/80 backdrop-blur-md border-b border-border text-sm font-semibold sticky top-0 z-20 hidden md:block select-none shadow-sm">
                <div className="grid grid-cols-12 divide-x divide-border/50">
                  <div className="col-span-2 p-3 text-center text-xs text-foreground uppercase tracking-wider">Fők. szám</div>
                  <div className="col-span-7 p-3 text-xs text-foreground uppercase tracking-wider">Megnevezés</div>
                  <div className="col-span-3 p-3 text-right text-xs bg-indigo-500/5 text-foreground uppercase tracking-wider">Összesített Egyenleg</div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 divide-y divide-border/30">
                {processedRows.length === 0 ? (
                   <div className="p-8 text-center text-muted-foreground">Nem találhatók adatok ehhez a könyvelési sablonhoz.</div>
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
                          "grid grid-cols-12 divide-x divide-border/10 bg-muted/20 animate-pulse items-center",
                          hiddenClass
                        )}
                      >
                        <div className="col-span-2 p-3 flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        </div>
                        <div className="col-span-7 py-3 pr-3 text-sm flex items-center gap-2" style={{ paddingLeft: indentPadding }}>
                          <span className="text-xs text-muted-foreground italic flex items-center gap-2">
                            {row.name}
                          </span>
                        </div>
                        <div className="col-span-3 p-3 flex justify-end items-center" />
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
                      />
                    );
                  }

                  return (
                    <div 
                      key={row.id} 
                      id={`row_${row.id}`}
                      className={cn(
                        "group grid-cols-12 divide-x divide-border/10 transition-colors hover:bg-muted/40",
                        hiddenClass,
                        isRoot && "border-t border-border/50 bg-muted/10 font-medium",
                        row.hasChildren ? "cursor-pointer" : "",
                        highlightedRowId === row.id && "ring-2 ring-primary/80 bg-primary/10 transition-all duration-700 shadow-md"
                      )}
                      onClick={() => toggleRow(row.id, row.hasChildren)}
                    >
                      <div className={cn(
                        "col-span-2 p-3 text-sm flex items-center justify-center font-mono text-muted-foreground border-r border-border/20 gap-3",
                        classBorderColor
                      )}>
                        {row.isItem ? (
                           <>
                             <div className="print:hidden h-full flex items-center" onClick={e => e.stopPropagation()}>
                               {row.sourceTable !== 'acc_journal_lines' && row.sourceTable !== 'journal_entry' ? (
                                 <Checkbox 
                                   checked={selectedItemIds.has(row.id)} 
                                   onCheckedChange={() => toggleItemSelection(row.id)}
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
                      <div className="col-span-7 py-3 pr-3 text-sm flex items-center gap-2" style={{ paddingLeft: indentPadding }}>
                        <div className="w-4 h-4 shrink-0 flex items-center justify-center print:hidden">
                          {row.hasChildren && (
                            <div className="text-muted-foreground/70 hover:text-foreground hover:bg-muted p-0.5 rounded-sm transition-colors">
                               {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            </div>
                          )}
                        </div>
                        <CustomTooltip content={row.name} side="top">
                          <span className={cn("truncate", isRoot ? "uppercase" : "", row.isItem ? "text-muted-foreground italic" : "")}>
                            {row.name}
                          </span>
                        </CustomTooltip>
                        {row.isItem && row.itemType && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-muted whitespace-nowrap text-muted-foreground hidden lg:inline-block">
                            {row.itemType}
                          </span>
                        )}
                        {row.isItem && row.isTemporary && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 font-semibold whitespace-nowrap">
                            Ideiglenes
                          </span>
                        )}
                        {row.isItem && !row.isTemporary && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-semibold whitespace-nowrap">
                            Végleges
                          </span>
                        )}
                      </div>
                      
                      <div className={cn("col-span-3 p-3 flex justify-end items-center gap-4 text-sm tabular-nums font-medium")}>
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
                                 <CustomTooltip content="Végleges egyenleg" side="top">
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
                                 <CustomTooltip content="Ideiglenes egyenleg" side="top">
                                   <span className="text-orange-500 dark:text-orange-400 font-semibold text-xs">
                                     {formatCurrency(row.tempBalance || 0)} <span className="text-[10px] opacity-80">(Ideigl.)</span>
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
                          <CustomTooltip content="Főkönyvi szám módosítása" side="left">
                            <Button
                              variant="ghost" 
                              size="icon" 
                              className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-opacity print:hidden shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingItem(row);
                                // We use originalGlId to pre-fill the form, or UNCLASSIFIED if not mapped
                                setSelectedNewGL(row.originalGlId || 'UNCLASSIFIED');
                                setSearchQuery('');
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
                    <span>Nem könyvelt tételek ({excludedItems.length})</span>
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
                          <CustomTooltip content={item.name} side="top">
                            <div className="col-span-7 truncate">
                              {item.name}
                              {item.itemType && (
                                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 whitespace-nowrap">{item.itemType}</span>
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
            </div>
          </div>

          {/* Fixed Footer at the bottom of the table card */}
          <div className="shrink-0 grid grid-cols-12 border-t border-border/60 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] bg-muted/95 backdrop-blur font-bold text-sm z-20 print:border-t-2">
             <div className="col-span-9 p-3 text-right uppercase tracking-wider text-muted-foreground">Összesen:</div>
             <div className="col-span-3 p-3 text-right tabular-nums text-foreground flex items-center justify-end gap-2 pr-4">
                {isDataLoading ? (
                  <div className="h-4 w-20 animate-pulse bg-muted rounded" />
                ) : (
                  <>
                    {formatCurrency(footerTotals)}
                    <CustomTooltip content="Adatok frissítése" side="top">
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
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handleExpandAll} className="gap-2 cursor-pointer">
          <Maximize2 className="h-4 w-4" />
          <span>Mind kinyitása</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleCollapseAll} className="gap-2 cursor-pointer">
          <Minimize2 className="h-4 w-4" />
          <span>Mind összecsukása</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleRefetchAll} disabled={isFetching} className="gap-2 cursor-pointer">
          <RefreshCw className={cn("h-4 w-4", isFetching ? "animate-spin text-muted-foreground" : "")} />
          <span>{isFetching ? 'Frissítés folyamatban...' : 'Adatok frissítése'}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Kategória módosítása</DialogTitle>
            <DialogDescription>
              {editingItem ? 'Egy tétel módosítása' : `${selectedItemIds.size} tétel csoportos módosítása`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 flex flex-col gap-4 w-full overflow-hidden">
            <div className="bg-muted p-3 rounded-md border text-sm flex items-center justify-between w-full overflow-hidden gap-2">
              <span className="font-medium text-muted-foreground whitespace-nowrap">Új kategória:</span>
              <span className="font-bold text-foreground bg-background px-3 py-1.5 rounded border border-border shadow-sm truncate max-w-full">
                {selectedNewGL === 'UNCLASSIFIED' ? <span className="text-muted-foreground italic">Besorolatlan tétel (Kategória eltávolítva)</span> :
                  (selectedNewGL && dbData
                  ? (() => {
                      const gl = dbData.find(g => g.gl_account_id === selectedNewGL);
                      return gl ? `${gl.gl_number} ${gl.short_name}` : "Válassz a listából...";
                    })()
                  : "Válassz a listából...")}
              </span>
            </div>

            <Command className="rounded-lg border shadow-sm w-full overflow-hidden h-[350px]" shouldFilter={false}>
              <CommandInput 
                placeholder="Keresés főkönyvi szám vagy név alapján..." 
                value={searchQuery}
                onValueChange={setSearchQuery}
                className="w-full"
              />
              <CommandList className="h-[300px] max-h-[300px] overflow-y-auto w-full overflow-x-hidden">
                <CommandEmpty>Nincs találat.</CommandEmpty>
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
                      Besorolatlan (Kategória eltávolítása)
                    </span>
                  </CommandItem>
                  {dbData
                    ?.filter(gl => !searchQuery || `${gl.gl_number} ${gl.short_name}`.toLowerCase().includes(searchQuery.toLowerCase()))
                    .slice()
                    .sort((a,b) => cleanIdVal(a.gl_number).localeCompare(cleanIdVal(b.gl_number)))
                    .map(gl => {
                      const isLeaf = !dbData.some(sub => cleanIdVal(sub.gl_number).startsWith(cleanIdVal(gl.gl_number)) && sub.gl_account_id !== gl.gl_account_id);
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
                            {gl.gl_number} {gl.short_name}
                          </span>
                        </CommandItem>
                      );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSubmitting}>Mégse</Button>
            <Button onClick={handleSaveOverride} disabled={!selectedNewGL || isSubmitting || (editingItem && selectedNewGL === (editingItem.originalGlId || 'UNCLASSIFIED'))}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!selectedLeafAccount} onOpenChange={(open) => { if (!open) setSelectedLeafAccount(null); }}>
        <SheetContent className="sm:max-w-[720px] w-[90vw] overflow-y-auto flex flex-col h-full bg-background border-l">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Naplóbejegyzések: {selectedLeafAccount?.code}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {selectedLeafAccount?.name} – Könyvelési tételek részletes listája az aktív főkönyvből.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {isLoadingEntries ? (
              <div className="flex justify-center items-center h-48 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="ml-2 text-sm">Tételek betöltése...</span>
              </div>
            ) : !journalEntries?.length ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                Nincs könyvelési tétel ehhez a számlaszámhoz az aktív importban.
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
                          <p className="font-semibold text-foreground">{entry.description || 'Névtelen tétel'}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Bizonylatszám: <span className="font-medium text-foreground">{entry.voucher_number || '-'}</span>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground tabular-nums">
                            {formatCurrency(entry.amount)} Ft
                          </p>
                          {entry.foreign_currency && entry.foreign_currency !== 'HUF' && entry.foreign_amount && (
                            <p className="text-[10px] font-medium text-muted-foreground tabular-nums">
                              {Number(entry.foreign_amount).toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {entry.foreign_currency}
                              {entry.exchange_rate ? ` (@${Number(entry.exchange_rate).toLocaleString('hu-HU')} Ft)` : ''}
                            </p>
                          )}
                          <p className={cn(
                            "text-[10px] font-semibold mt-0.5",
                            isDebit ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          )}>
                            {isDebit ? 'Tartozik (Debet)' : 'Követel (Kredit)'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                        <div>
                          <span className="block opacity-75">Partner</span>
                          <span className="font-medium text-foreground truncate block">{entry.partner_name || '-'}</span>
                        </div>
                        <div>
                          <span className="block opacity-75">Ellenszámla</span>
                          <span className="font-medium text-foreground block font-mono">
                            {isDebit ? entry.credit_account : entry.debit_account}
                          </span>
                        </div>
                        <div>
                          <span className="block opacity-75">Kelt / Teljesítés</span>
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
    </>
  );
}

const GeneralLedgerTable = React.memo(forwardRef(GeneralLedgerTableBase));

GeneralLedgerTable.displayName = 'GeneralLedgerTable';

export default GeneralLedgerTable;
