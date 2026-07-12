import React, { useState, useMemo, forwardRef, useImperativeHandle, useEffect, useRef, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Maximize2, Minimize2, Loader2, RefreshCw, Edit2, X, Check, ChevronsUpDown } from 'lucide-react';
import { exportGlExcel, exportGlAnalyticalExcel } from '@/lib/glExport';
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
import { Checkbox } from "@/components/ui/checkbox";
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
  finalBalance?: number;
  tempBalance?: number;
}

const formatCurrency = (value: number) => {
  if (value === 0) return '0,00';
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// F4: Highlight search matches in text
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 dark:bg-yellow-500/40 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export interface GeneralLedgerTableRef {
  expandAllAndPrint: () => void;
  exportExcel: (companyName?: string) => Promise<void>;
  exportAnalyticalExcel: (companyName?: string) => Promise<void>; // F6
  getStats: () => { accountCount: number; leafCount: number; totalDebit: number; totalCredit: number };
  expandAll: () => void;
  collapseAll: () => void;
}

interface GeneralLedgerTableProps {
  presetId?: string;
  dateFrom?: string;
  dateTo?: string;
  globalSearch?: string;
  isPolling?: boolean; // P4: only poll when AI/import is running
  onStatsChange?: (stats: { accountCount: number; leafCount: number; totalDebit: number; totalCredit: number; classifiedItems: number; totalItems: number }) => void;
}

function GeneralLedgerTableBase(props: GeneralLedgerTableProps, ref: React.ForwardedRef<GeneralLedgerTableRef>) {
  const { presetId, dateFrom, dateTo, globalSearch, isPolling, onStatsChange } = props;
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

  // By default, expanded top-level items (length 1) to show some data, 
  // but users can expand/collapse freely. Let's expand '1' to show the tree.
  const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(new Set(['1', '13', '14']));
  
  const [hideBannerNextTime, setHideBannerNextTime] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const { data: exchangeRates } = useExchangeRates();

  // Fetch real data for the preset and company using the new RPC
  const { data: dbData, isLoading, isFetching, refetch: refetchBalances } = useQuery({
    queryKey: ['glBalances', presetId, selectedCompany?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!presetId || !selectedCompany?.id) return [];
      
      // Hit the RPC we created
      const { data, error } = await supabase.rpc('get_gl_balances', {
        p_company_id: selectedCompany.id,
        p_preset_id: presetId,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
        p_exchange_rates: exchangeRates || {}
      });
      
      if (error) {
        reportError({ type: 'db_query', component: 'GeneralLedgerTable', action: 'error', message: 'Error fetching GL balances:', error: error });
        return [];
      }
      
      return data || [];
    },
    enabled: !!presetId && !!selectedCompany?.id && !!exchangeRates,
    refetchInterval: isPolling ? 3000 : false, // P4: conditional polling
    placeholderData: (prev: any) => prev,
  });

  // Fetch detailed items categorized to this company
  const { data: dbItems, isLoading: isLoadingItems, refetch: refetchItems } = useQuery({
    queryKey: ['glItems', selectedCompany?.id, presetId, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase.rpc('get_gl_categorized_items', {
        p_company_id: selectedCompany.id,
        p_preset_id: presetId,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
        p_exchange_rates: exchangeRates || {}
      });
      if (error) {
        reportError({ type: 'db_query', component: 'GeneralLedgerTable', action: 'error', message: 'Error fetching GL items:', error: error });
        return [];
      }
      return data || [];
    },
    enabled: !!selectedCompany?.id && !!presetId && !!exchangeRates,
    refetchInterval: isPolling ? 3000 : false, // P4: conditional polling
    placeholderData: (prev: any) => prev,
  });

  const handleRefetchAll = () => {
    refetchBalances();
    refetchItems();
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
      // Step 1: Pre-calculate hasChildren and clean IDs
      const rawData = dbData.map(dbItem => {
         const cid = cleanId(dbItem.gl_number);
         const hasChildren = dbData.some(d => 
            cleanId(d.gl_number).startsWith(cid) && 
            cleanId(d.gl_number) !== cid
         );
         
         return {
           id: String(dbItem.gl_number),
           name: dbItem.short_name,
           balance: Number(dbItem.total_balance) || 0,
           hasChildren,
           cid
         };
      });

      // Now roll up sums and split final vs temporary balances for all parent nodes
      let rolledUpData: LedgerItem[] = rawData.map(item => {
        // Find ALL descendants in rawData (including self)
        const descendants = rawData.filter(d => d.cid.startsWith(item.cid));
        
        let finalBalance = 0;
        let tempBalance = 0;

        if (dbItems && dbItems.length > 0) {
          const descendantsCids = new Set(descendants.map(d => d.cid));
          dbItems.forEach(dbItem => {
            if (dbItem.is_excluded) return;
            const parentDbItem = dbData.find(db => db.gl_account_id === dbItem.gl_account_id);
            if (parentDbItem) {
              const parentCid = cleanId(parentDbItem.gl_number);
              if (descendantsCids.has(parentCid)) {
                if (dbItem.is_temporary) {
                  tempBalance += Number(dbItem.amount) || 0;
                } else {
                  finalBalance += Number(dbItem.amount) || 0;
                }
              }
            }
          });
        } else {
          finalBalance = item.balance;
        }

        const totalBalance = finalBalance + tempBalance;

        return { 
          ...item, 
          balance: totalBalance,
          finalBalance,
          tempBalance
        };
      });

      if (dbItems && dbItems.length > 0) {
        // Filter out excluded items for the main table
        const activeItems = dbItems.filter(i => !i.is_excluded);

        // Tag GL accounts that have matching items as having children
        rolledUpData = rolledUpData.map(item => {
           const dbRecord = dbData.find(db => cleanId(db.gl_number) === item.cid);
           if (!dbRecord) return item;
           const hasItemChildren = activeItems.some(i => i.gl_account_id === dbRecord.gl_account_id);
           return {
              ...item,
              hasChildren: item.hasChildren || hasItemChildren
           };
        });

        // Group items by their parent account's CID
        const itemsByGL = new Map<string, LedgerItem[]>();

        activeItems.forEach(item => {
           const parentDbItem = dbData.find(db => db.gl_account_id === item.gl_account_id);
           if (!parentDbItem) return;
           const parentCid = cleanId(parentDbItem.gl_number);
           const pseudoCid = `${parentCid}_${item.item_id}`;

           // Create a descriptive name
           let displayDesc = item.description || item.partner || 'Névtelen tétel';
           if (item.partner && item.description && item.partner !== item.description) {
             displayDesc = `${item.partner} - ${item.description}`;
           }

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
             itemType: item.item_type,
             partner: item.partner,
             date: item.item_date,
             sourceTable: item.source_table,
             originalGlId: item.gl_account_id,
             // @ts-ignore
             originalAmount: Number(item.original_amount) || 0,
             // @ts-ignore
             originalCurrency: item.original_currency,
             isTemporary: !!item.is_temporary
           });
        });

        // Interleave the arrays: parent node followed immediately by its direct items
        const combinedData: LedgerItem[] = [];
        rolledUpData.forEach(parent => {
            combinedData.push(parent);
            if (itemsByGL.has(parent.cid)) {
                // Optionally sort items by date within the category
                const parentItems = itemsByGL.get(parent.cid)!;
                parentItems.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
                combinedData.push(...parentItems);
            }
        });

        return combinedData;
      }

      return rolledUpData;
    }
    return [];
  }, [dbData, dbItems]);

  // Separate list of excluded items for the "Nem könyvelt" section
  const excludedItems = useMemo(() => {
    if (!dbItems) return [];
    return dbItems
      .filter(i => i.is_excluded)
      .map(item => {
        let displayDesc = item.description || item.partner || 'Névtelen tétel';
        if (item.partner && item.description && item.partner !== item.description) {
          displayDesc = `${item.partner} - ${item.description}`;
        }
        return {
          id: item.item_id,
          name: displayDesc,
          amount: Number(item.amount) || 0,
          itemType: item.item_type,
          partner: item.partner,
          date: item.item_date,
          sourceTable: item.source_table,
          isExcluded: true
        };
      });
  }, [dbItems]);

  const orphanCount = dbItems?.filter(i => i.gl_account_id === '00000000-0000-0000-0000-000000000000' && !i.is_excluded).length || 0;

  // ── Fire stats callback when tableData changes ──
  useEffect(() => {
    if (!onStatsChange || tableData.length === 0) return;
    const glAccountsOnly = tableData.filter(d => !d.isItem);
    const leaves = glAccountsOnly.filter(d => !d.hasChildren);
    const totalDebit = leaves.filter(d => d.balance > 0).reduce((s, d) => s + d.balance, 0);
    const totalCredit = leaves.filter(d => d.balance < 0).reduce((s, d) => s + Math.abs(d.balance), 0);
    const aiItems = dbItems?.filter(i => i.source_table !== 'journal_entry') || [];
    const totalItemCount = aiItems.length;
    const aiOrphanCount = aiItems.filter(i => i.gl_account_id === '00000000-0000-0000-0000-000000000000' && !i.is_excluded).length;
    const classifiedItemCount = totalItemCount - aiOrphanCount;
    onStatsChange({ accountCount: glAccountsOnly.length, leafCount: leaves.length, totalDebit, totalCredit, classifiedItems: classifiedItemCount, totalItems: totalItemCount });
  }, [tableData, onStatsChange, dbItems, orphanCount]);
  
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

  const hasOrphans = tableData.some(d => d.id === 'ORPHAN');
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
      const orphanCount = dbItems?.filter(i => i.gl_account_id === '00000000-0000-0000-0000-000000000000').length || 0;
      if (orphanCount === 0) return;

      // PGMQ: INSERT into gl_upload_notifications triggers the DB trigger
      // which enqueues the job to the gl_classification_jobs PGMQ queue.
      const { error } = await supabase
        .from('gl_upload_notifications')
        .insert({
          company_id: selectedCompany.id,
          target_preset_id: presetId,
          processing_status: 'pending',
          message: `AI átsorolás indítva (${orphanCount} besorolatlan tétel)`
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
      await exportGlExcel(processedRows, companyName, footerTotals);
    },
    exportAnalyticalExcel: async (companyName?: string) => {
      await exportGlAnalyticalExcel(processedRows, companyName, footerTotals);
    },
    getStats: () => {
      const glAccountsOnly = tableData.filter(d => !d.isItem);
      const leaves = glAccountsOnly.filter(d => !d.hasChildren);
      const totalDebit = leaves.filter(d => d.balance > 0).reduce((s, d) => s + d.balance, 0);
      const totalCredit = leaves.filter(d => d.balance < 0).reduce((s, d) => s + Math.abs(d.balance), 0);
      return { accountCount: glAccountsOnly.length, leafCount: leaves.length, totalDebit, totalCredit };
    },
    expandAll: handleExpandAll,
    collapseAll: handleCollapseAll
  }));

  const handleExpandAll = () => {
    const allWithChildren = tableData.filter(d => d.hasChildren).map(d => d.id);
    setExpandedRowIds(new Set(allWithChildren));
  };

  const handleCollapseAll = () => {
    setExpandedRowIds(new Set([])); // Collapse to only root items
  };

  const toggleRow = (id: string, hasChildren?: boolean) => {
    if (!hasChildren) return;
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const deferredSearch = useDeferredValue(globalSearch);

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
    const lowerQuery = deferredSearch?.toLowerCase().trim() || '';
    const directMatchIds = new Set<string>();
    const matchCids = new Set<string>();
    
    const nonItemNodes = tableData.filter(d => !d.isItem);
    
    if (lowerQuery) {
      tableData.forEach(item => {
        if (
          item.name.toLowerCase().includes(lowerQuery) || 
          (item.partner && item.partner.toLowerCase().includes(lowerQuery)) ||
          item.id.toLowerCase().includes(lowerQuery)
        ) {
          directMatchIds.add(item.id);
          matchCids.add(item.cid);
        }
      });
    }

    const prefixesOfMatches = new Set<string>();
    if (lowerQuery) {
      matchCids.forEach(cid => {
        nonItemNodes.forEach(node => {
          if (cid.startsWith(node.cid) && cid !== node.cid) {
            prefixesOfMatches.add(node.cid);
          }
        });
      });
    }

    return tableData.map(item => {
      // Find all ancestors (only searching through the ~100 category nodes, not all 10,000 items)
      const ancestors = nonItemNodes.filter(a => item.cid.startsWith(a.cid) && a.cid !== item.cid);
      
      const isRoot = ancestors.length === 0 && !item.isItem;
      const depth = ancestors.length;
      
      let isVisibleOnScreen = false;
      let isVisibleDuringPrint = false;

      if (!lowerQuery) {
        isVisibleOnScreen = isRoot || ancestors.every(a => expandedRowIds.has(a.id));
        isVisibleDuringPrint = isRoot || ancestors.every(a => categoriesWithItems.has(a.id));
      } else {
        const isDirectMatch = directMatchIds.has(item.id);
        const ancestorMatches = ancestors.some(a => directMatchIds.has(a.id));
        const descendantMatches = prefixesOfMatches.has(item.cid);

        isVisibleOnScreen = isDirectMatch || ancestorMatches || descendantMatches;
        isVisibleDuringPrint = isVisibleOnScreen;
      }
      
      return { ...item, isVisibleOnScreen, isVisibleDuringPrint, isRoot, depth };
    });
  }, [expandedRowIds, tableData, deferredSearch, categoriesWithItems]);

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

  if (isLoading || isLoadingItems) {
    return (
      <div className="flex justify-center items-center h-[500px] text-muted-foreground w-full">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-3 font-medium">Főkönyvi adatok betöltése...</span>
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
            <div className="w-full flex flex-col min-h-full pb-8 print:pb-0">
              
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

                  return (
                    <div 
                      key={row.id} 
                      className={cn(
                        "group grid-cols-12 divide-x divide-border/10 transition-colors hover:bg-muted/40",
                        hiddenClass,
                        isRoot && "border-t border-border/50 bg-muted/10 font-medium",
                        row.hasChildren ? "cursor-pointer" : ""
                      )}
                      onClick={() => toggleRow(row.id, row.hasChildren)}
                    >
                      <div className="col-span-2 p-3 text-sm flex items-center justify-center font-mono text-muted-foreground border-r border-border/20 gap-3">
                        {row.isItem ? (
                           <>
                             <div className="print:hidden h-full flex items-center" onClick={e => e.stopPropagation()}>
                               <Checkbox 
                                 checked={selectedItemIds.has(row.id)} 
                                 onCheckedChange={() => toggleItemSelection(row.id)}
                               />
                             </div>
                             <span className="text-xs truncate">{row.date ? row.date.substring(0, 10).replace(/-/g, '.') : ''}</span>
                           </>
                        ) : (
                           <span className={cn(
                             "font-semibold",
                             (row.tempBalance && row.tempBalance !== 0 && (!row.finalBalance || row.finalBalance === 0)) 
                               ? "text-orange-500 dark:text-orange-400" 
                               : (row.finalBalance && row.finalBalance !== 0 && (!row.tempBalance || row.tempBalance === 0))
                               ? "text-emerald-600 dark:text-emerald-400"
                               : "text-foreground"
                           )}>
                             {highlightMatch(row.id, deferredSearch)}
                           </span>
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
                        <span className={cn("truncate", isRoot ? "uppercase" : "", row.isItem ? "text-muted-foreground italic" : "")} title={row.name}>
                          {highlightMatch(row.name, deferredSearch)}
                        </span>
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
                      
                      <div className={cn("col-span-3 p-3 flex justify-end items-center gap-4 text-sm tabular-nums font-medium", isNegative ? "text-destructive" : "")}>
                        <div className="flex flex-col items-end">
                          {row.isItem ? (
                            row.isTemporary ? (
                              <span className="text-orange-500 dark:text-orange-400 font-semibold">
                                {row.balance !== 0 ? formatCurrency(row.balance) : ""}
                              </span>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                {row.balance !== 0 ? formatCurrency(row.balance) : ""}
                              </span>
                            )
                          ) : (
                            <div className="flex flex-col items-end gap-0.5">
                              {row.finalBalance !== 0 && (
                                <span className="text-emerald-600 dark:text-emerald-400 font-semibold" title="Végleges egyenleg">
                                  {formatCurrency(row.finalBalance || 0)}
                                </span>
                              )}
                              {row.tempBalance !== 0 && (
                                <span className="text-orange-500 dark:text-orange-400 font-semibold text-xs" title="Ideiglenes egyenleg">
                                  {formatCurrency(row.tempBalance || 0)} <span className="text-[10px] opacity-80">(Ideigl.)</span>
                                </span>
                              )}
                              {(!row.finalBalance || row.finalBalance === 0) && (!row.tempBalance || row.tempBalance === 0) && row.balance !== 0 && (
                                <span>{formatCurrency(row.balance)}</span>
                              )}
                            </div>
                          )}
                          {row.originalCurrency && row.originalCurrency !== 'HUF' && (
                            <span className="text-[10px] text-muted-foreground font-normal leading-tight">
                              ({formatCurrency(row.originalAmount || 0).replace(',00', '')} {row.originalCurrency})
                            </span>
                          )}
                        </div>
                        {row.isItem ? (
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
                <div className="border-t-2 border-amber-400/40 bg-amber-500/5 print:hidden">
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
                          <div className="col-span-7 truncate" title={item.name}>
                            {item.name}
                            {item.itemType && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 whitespace-nowrap">{item.itemType}</span>
                            )}
                          </div>
                          <div className="col-span-3 text-right font-mono tabular-nums font-medium">
                            {item.amount !== 0 ? formatCurrency(item.amount) : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="sticky bottom-0 z-20 grid grid-cols-12 border-t border-border/60 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] bg-muted/95 backdrop-blur font-bold text-sm">
                 <div className="col-span-9 p-3 text-right uppercase tracking-wider text-muted-foreground">Összesen:</div>
                 <div className="col-span-3 p-3 text-right tabular-nums text-foreground flex items-center justify-end gap-2">
                    {formatCurrency(footerTotals)}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleRefetchAll} 
                      disabled={isFetching}
                      className="h-6 w-6 rounded-full"
                      title="Frissítés"
                    >
                      <RefreshCw className={cn("h-3 w-3", isFetching ? "animate-spin" : "")} />
                    </Button>
                 </div>
              </div>

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
    </>
  );
}

const GeneralLedgerTable = React.memo(forwardRef(GeneralLedgerTableBase));

GeneralLedgerTable.displayName = 'GeneralLedgerTable';

export default GeneralLedgerTable;
