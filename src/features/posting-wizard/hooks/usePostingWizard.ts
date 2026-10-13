import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useActivePreset } from '@/hooks/useActivePreset';
import type { PostingItem, PostingGroup, PostingSummary, PostingMode, RuleScopeOption, RuleToCreate } from '../types';

export function usePostingWizard(companyId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activePresetId } = useActivePreset(companyId);

  // Pagination / batching state (25 items per batch for snappy instantaneous performance)
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Local overrides (quick reassignment of GL before submitting)
  const [localOverrides, setLocalOverrides] = useState<
    Map<string, { gl_account_id: string; gl_number: string; gl_name: string }>
  >(new Map());

  // Approved items set within the current batch
  const [approvedItemIds, setApprovedItemIds] = useState<Set<string>>(new Set());

  // Currently focused item ID for keyboard navigation
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);

  // Selected item IDs for multi-select (Shift selection)
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Posting mode from companies table
  const { data: companyData, refetch: refetchCompany } = useQuery<{ posting_mode: PostingMode }>({
    queryKey: ['company-posting-mode', companyId],
    queryFn: async () => {
      if (!companyId) return { posting_mode: 'wizard' };
      const { data, error } = await supabase
        .from('companies')
        .select('posting_mode')
        .eq('id', companyId)
        .maybeSingle();

      if (error) throw error;
      return { posting_mode: ((data as any)?.posting_mode || 'wizard') as PostingMode };
    },
    enabled: !!companyId,
    staleTime: 30000,
  });

  const postingMode: PostingMode = companyData?.posting_mode || 'wizard';

  // Fetch pending posting summary (counts & totals)
  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery<PostingSummary>({
    queryKey: ['pending-posting-summary', companyId, activePresetId],
    queryFn: async () => {
      if (!companyId || !activePresetId) {
        return { pending_item_count: 0, pending_invoice_count: 0, total_net_amount: 0, currency: 'HUF' };
      }
      const { data, error } = await (supabase.rpc as any)('get_pending_posting_summary', {
        p_company_id: companyId,
        p_preset_id: activePresetId,
      });

      if (error) throw error;
      return data as PostingSummary;
    },
    enabled: !!companyId && !!activePresetId,
  });

  // Fetch raw pending posting items for the current batch
  const { data: rawItems = [], isLoading: isItemsLoading, refetch: refetchItems } = useQuery<PostingItem[]>({
    queryKey: ['pending-posting-items', companyId, activePresetId, currentPage, pageSize],
    queryFn: async () => {
      if (!companyId || !activePresetId) return [];
      const { data, error } = await (supabase.rpc as any)('get_pending_posting_items', {
        p_company_id: companyId,
        p_preset_id: activePresetId,
        p_limit: pageSize,
        p_offset: currentPage * pageSize,
      });

      if (error) throw error;
      return (data || []) as PostingItem[];
    },
    enabled: !!companyId && !!activePresetId,
  });

  // Fetch all available GL accounts for the quick dropdown
  const { data: glAccounts = [] } = useQuery<Array<{ id: string; gl_number: string; short_name: string }>>({
    queryKey: ['preset-gl-accounts-lookup', activePresetId],
    queryFn: async () => {
      if (!activePresetId) return [];
      const { data, error } = await supabase
        .from('gl_accounts')
        .select('id, gl_number, short_name')
        .eq('preset_id', activePresetId)
        .order('gl_number', { ascending: true });

      if (error) throw error;
      return (data || []) as Array<{ id: string; gl_number: string; short_name: string }>;
    },
    enabled: !!activePresetId,
    staleTime: 60000,
  });

  // Merge raw items with local overrides
  const effectiveItems = useMemo(() => {
    return rawItems.map((item) => {
      const override = localOverrides.get(item.item_id);
      if (override) {
        return {
          ...item,
          suggested_gl_account_id: override.gl_account_id,
          suggested_gl_number: override.gl_number,
          suggested_gl_name: override.gl_name,
        };
      }
      return item;
    });
  }, [rawItems, localOverrides]);

  // Group items by GL number (Inverted grouping) - purely structural, zero state-churning lag
  const groups: PostingGroup[] = useMemo(() => {
    const map = new Map<string, PostingGroup>();

    effectiveItems.forEach((item) => {
      const glNum = item.suggested_gl_number || 'UNCLASSIFIED';
      const glName = item.suggested_gl_name || (glNum === 'UNCLASSIFIED' ? 'Besorolásra vár' : glNum);
      const glAccId = item.suggested_gl_account_id;

      let group = map.get(glNum);
      if (!group) {
        group = {
          gl_number: glNum,
          gl_name: glName,
          gl_account_id: glAccId,
          items: [],
          total_net_amount: 0,
          total_count: 0,
          approved_count: 0,
        };
        map.set(glNum, group);
      }

      group.items.push(item);
      group.total_net_amount += Number(item.net_amount || 0);
      group.total_count += 1;
    });

    // Sort groups by GL number, putting UNCLASSIFIED at the end
    return Array.from(map.values()).sort((a, b) => {
      if (a.gl_number === 'UNCLASSIFIED') return 1;
      if (b.gl_number === 'UNCLASSIFIED') return -1;
      return a.gl_number.localeCompare(b.gl_number, undefined, { numeric: true });
    });
  }, [effectiveItems]);

  // Quick reassign item to another GL account
  const handleQuickReassign = useCallback(
    (itemId: string, newGlAccountId: string) => {
      const matchedGl = glAccounts.find((g) => g.id === newGlAccountId);
      if (!matchedGl) return;

      setLocalOverrides((prev) => {
        const next = new Map(prev);
        next.set(itemId, {
          gl_account_id: matchedGl.id,
          gl_number: matchedGl.gl_number,
          gl_name: matchedGl.short_name,
        });
        return next;
      });

      // Automatically mark as approved upon manual correction
      setApprovedItemIds((prev) => new Set(prev).add(itemId));
    },
    [glAccounts]
  );

  // Toggle single item approval
  const handleToggleItemApproval = useCallback((itemId: string) => {
    setApprovedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // Approve entire group in one click
  const handleApproveGroup = useCallback((group: PostingGroup) => {
    setApprovedItemIds((prev) => {
      const next = new Set(prev);
      group.items.forEach((item) => next.add(item.item_id));
      return next;
    });
    toast({
      title: `${group.gl_number} csoport jóváhagyva`,
      description: `${group.items.length} tétel elfogadva a csoporthoz.`,
    });
  }, [toast]);

  // Approve entire current batch
  const handleApproveAllInBatch = useCallback(() => {
    setApprovedItemIds(new Set(effectiveItems.map((i) => i.item_id)));
    toast({
      title: 'Teljes köteg jóváhagyva',
      description: `Mind a(z) ${effectiveItems.length} tétel elfogadva.`,
    });
  }, [effectiveItems, toast]);

  // Approve batch mutation
  const approveBatchMutation = useMutation({
    mutationFn: async ({
      ruleScope,
      rulesToCreate = [],
    }: {
      ruleScope: RuleScopeOption;
      rulesToCreate?: RuleToCreate[];
    }) => {
      if (!companyId || !activePresetId) throw new Error('Cég vagy preset hiányzik');

      const itemsToApprove = effectiveItems
        .filter((item) => approvedItemIds.has(item.item_id))
        .map((item) => ({
          item_id: item.item_id,
          source_table: item.source_table,
          gl_account_id: item.suggested_gl_account_id,
          gl_number: item.suggested_gl_number,
          reasoning: 'Kontírozás varázsló jóváhagyás',
        }));

      if (itemsToApprove.length === 0) {
        throw new Error('Nincs jóváhagyásra kijelölt tétel a kötegben');
      }

      const { data, error } = await (supabase.rpc as any)('approve_posting_batch', {
        p_company_id: companyId,
        p_preset_id: activePresetId,
        p_items: itemsToApprove,
        p_rules_to_create: rulesToCreate,
        p_rule_scope: ruleScope,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Köteg sikeresen könyvelve!',
        description: `${data?.approved_count || 0} tétel véglegesítve, ${data?.rules_created || 0} új szabály létrehozva.`,
      });

      // Clear batch states and refetch
      setApprovedItemIds(new Set());
      setLocalOverrides(new Map());
      setSelectedItemIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['pending-posting-items'] });
      queryClient.invalidateQueries({ queryKey: ['pending-posting-summary'] });
      queryClient.invalidateQueries({ queryKey: ['gl-categorized-items'] });
      queryClient.invalidateQueries({ queryKey: ['gl-balances'] });
      queryClient.invalidateQueries({ queryKey: ['glCards'] });
      queryClient.invalidateQueries({ queryKey: ['glCardItems'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a köteg jóváhagyásakor',
        description: err.message || 'Ismeretlen hiba történt.',
        variant: 'destructive',
      });
    },
  });

  // Switch posting mode mutation
  const setPostingModeMutation = useMutation({
    mutationFn: async (newMode: PostingMode) => {
      if (!companyId) throw new Error('Cég hiányzik');
      const { data, error } = await (supabase.rpc as any)('set_company_posting_mode', {
        p_company_id: companyId,
        p_posting_mode: newMode,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, newMode) => {
      toast({
        title: 'Működési mód frissítve',
        description:
          newMode === 'wizard'
            ? 'Kontírozás varázsló mód aktív (Könyvelői jóváhagyás kötelező).'
            : 'Automatikus azonnali háttérkontírozás aktív.',
      });
      queryClient.invalidateQueries({ queryKey: ['company-posting-mode', companyId] });
      refetchCompany();
    },
    onError: (err: any) => {
      toast({
        title: 'Nem sikerült módosítani az üzemmódot',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  // Total and batch progress
  const totalPendingInBatch = effectiveItems.length;
  const approvedInBatchCount = effectiveItems.filter((i) => approvedItemIds.has(i.item_id)).length;
  const isBatchFullyApproved = totalPendingInBatch > 0 && approvedInBatchCount === totalPendingInBatch;

  return {
    postingMode,
    summary,
    isSummaryLoading,
    items: effectiveItems,
    groups,
    isItemsLoading,
    glAccounts,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    approvedItemIds,
    focusedItemId,
    setFocusedItemId,
    selectedItemIds,
    setSelectedItemIds,
    handleToggleItemApproval,
    handleApproveGroup,
    handleApproveAllInBatch,
    handleQuickReassign,
    approveBatchMutation,
    setPostingModeMutation,
    totalPendingInBatch,
    approvedInBatchCount,
    isBatchFullyApproved,
    refetchSummary,
    refetchItems,
  };
}
