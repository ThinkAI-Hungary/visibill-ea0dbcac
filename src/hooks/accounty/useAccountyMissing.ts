/**
 * Accounty Missing Items hooks — queries and mutations.
 * Split from useAccountyData.ts for maintainability.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { AccountyMissingItem, AccountyCompanySummary, fetchAllMissingItems, fetchAllMissingItemsFull, invalidateAccountyCache } from './useAccountyHelpers';

// ── Missing Items (per company, paginated) ──

export function useAccountyMissingItems(companyId: string, page = 0, pageSize = 100) {
  return useQuery({
    queryKey: [...queryKeys.accountyMissingItems(companyId), page, pageSize],
    queryFn: async (): Promise<{ items: AccountyMissingItem[]; totalCount: number }> => {
      // 1. Get total count (server-side, no row transfer)
      const { count, error: countErr } = await supabase
        .from('accounty_missing_items')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .in('status', ['open', 'notified', 'resolved']);

      if (countErr) throw countErr;

      // 2. Fetch only the current page
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error } = await supabase
        .from('accounty_missing_items')
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['open', 'notified', 'resolved'])
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      const items = (data || []).map((item): AccountyMissingItem => ({
        id: item.id,
        companyId: item.company_id,
        category: item.category,
        title: item.title,
        subtitle: item.subtitle,
        source: item.source,
        priority: item.priority,
        status: item.status,
        details: item.details,
        amount: item.amount ? Number(item.amount) : null,
        invoiceNumber: item.invoice_number,
        itemDate: item.item_date,
        resolveRoute: item.resolve_route,
        navInvoiceId: item.nav_invoice_id,
        transactionId: item.transaction_id,
        notificationCount: item.notification_count || 0,
        lastNotifiedAt: item.last_notified_at,
        escalationLevel: item.escalation_level || 0,
        isIgnored: item.is_ignored || false,
        createdAt: item.created_at,
        resolvedAt: item.resolved_at || null,
        uploaded_files: item.uploaded_files || [],
      }));

      return { items, totalCount: count || 0 };
    },
    enabled: !!companyId,
    staleTime: 30_000,
    keepPreviousData: true,
  });
}

// ── Missing Counts (KPI cards) ──

export function useAccountyMissingCounts(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountyMissingCounts(companyId),
    queryFn: async () => {
      // All counts in parallel
      const [totalRes, urgentRes, navRes, amountRes] = await Promise.all([
        supabase
          .from('accounty_missing_items')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .in('status', ['open', 'notified']),
        supabase
          .from('accounty_missing_items')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .in('status', ['open', 'notified'])
          .eq('priority', 'urgent'),
        supabase
          .from('accounty_missing_items')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .in('status', ['open', 'notified'])
          .eq('source', 'nav_detektor'),
        supabase
          .from('accounty_missing_items')
          .select('amount')
          .eq('company_id', companyId)
          .in('status', ['open', 'notified'])
          .not('amount', 'is', null),
      ]);

      const totalAmount = (amountRes.data || []).reduce(
        (sum: number, r: { amount: number | null }) => sum + (Number(r.amount) || 0), 0
      );

      return {
        total: totalRes.count || 0,
        urgent: urgentRes.count || 0,
        nav: navRes.count || 0,
        totalAmount,
      };
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });
}

// ── All Missing Items (across all companies) ──

export function useAccountyAllMissingItems() {
  const { user } = useAuth();
  const userId = user?.id || '';

  return useQuery({
    queryKey: queryKeys.accountyAllMissingItems(userId),
    queryFn: async (): Promise<(AccountyMissingItem & { companyName: string })[]> => {
      // Get role & assignments
      const { data: myAssigns } = await supabase
        .from('accounty_assignments')
        .select('role')
        .eq('accountant_user_id', userId);
      const isAdmin = myAssigns?.some(a => a.role === 'iroda_admin');

      let query = supabase
        .from('accounty_assignments')
        .select('company_id')
        .eq('accountant_user_id', userId);
      
      if (!isAdmin) {
        query = query.eq('is_main_accountant', true);
      }
      
      const { data: assignments, error: assignErr } = await query;

      if (assignErr) throw assignErr;
      if (!assignments || assignments.length === 0) return [];

      const companyIds = assignments.map(a => a.company_id);

      // Get ALL missing items (paginated to bypass PostgREST 1000-row limit)
      const items = await fetchAllMissingItemsFull(companyIds);

      // Get company names
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds);

      const nameMap: Record<string, string> = {};
      (companies || []).forEach(c => { nameMap[c.id] = c.name; });

      return (items || []).map((item) => ({
        id: item.id,
        companyId: item.company_id,
        companyName: nameMap[item.company_id] || 'Ismeretlen',
        category: item.category,
        title: item.title,
        subtitle: item.subtitle,
        source: item.source,
        priority: item.priority,
        status: item.status,
        details: item.details,
        amount: item.amount ? Number(item.amount) : null,
        invoiceNumber: item.invoice_number,
        itemDate: item.item_date,
        resolveRoute: item.resolve_route,
        navInvoiceId: item.nav_invoice_id,
        transactionId: item.transaction_id,
        notificationCount: item.notification_count || 0,
        lastNotifiedAt: item.last_notified_at,
        escalationLevel: item.escalation_level || 0,
        isIgnored: item.is_ignored || false,
        createdAt: item.created_at,
        resolvedAt: item.resolved_at || null,
      }));
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ── Company Summary ──

export function useAccountyCompanySummary() {
  const { user } = useAuth();
  const userId = user?.id || '';

  return useQuery({
    queryKey: queryKeys.accountyCompanySummary(userId),
    queryFn: async (): Promise<AccountyCompanySummary[]> => {
      // 1. Get role & assignments
      const { data: myAssigns } = await supabase
        .from('accounty_assignments')
        .select('role')
        .eq('accountant_user_id', userId);
      const isAdmin = myAssigns?.some(a => a.role === 'iroda_admin');

      let query = supabase
        .from('accounty_assignments')
        .select('company_id')
        .eq('accountant_user_id', userId);
      
      if (!isAdmin) {
        query = query.eq('is_main_accountant', true);
      }
      
      const { data: assignments, error: assignErr } = await query;

      if (assignErr) throw assignErr;
      if (!assignments || assignments.length === 0) return [];

      const companyIds = [...new Set(assignments.map(a => a.company_id))];

      // 2. Get company details
      const { data: companies, error: compErr } = await supabase
        .from('companies')
        .select('id, name, tax_number')
        .in('id', companyIds);

      if (compErr) throw compErr;

      // 3. Get ALL open/notified missing items (paginated)
      const missingItems = await fetchAllMissingItems(companyIds);

      // 4. Aggregate per company
      const companyMap: Record<string, { name: string; taxNumber: string }> = {};
      (companies || []).forEach(c => {
        companyMap[c.id] = { name: c.name, taxNumber: c.tax_number || '' };
      });

      const aggregates: Record<string, AccountyCompanySummary> = {};
      companyIds.forEach((cid: string) => {
        aggregates[cid] = {
          companyId: cid,
          companyName: companyMap[cid]?.name || '',
          companyTaxNumber: companyMap[cid]?.taxNumber || '',
          missingCount: 0,
          criticalCount: 0,
          lastNotifiedAt: null,
          maxNotificationCount: 0,
          totalNotified: 0,
        };
      });

      missingItems.forEach((mi: { company_id: string; priority: string; last_notified_at: string | null; notification_count: number }) => {
        const agg = aggregates[mi.company_id];
        if (!agg) return;
        agg.missingCount++;
        if (mi.priority === 'urgent') agg.criticalCount++;
        if (mi.last_notified_at && (!agg.lastNotifiedAt || mi.last_notified_at > agg.lastNotifiedAt)) {
          agg.lastNotifiedAt = mi.last_notified_at;
        }
        const nc = mi.notification_count || 0;
        if (nc > agg.maxNotificationCount) agg.maxNotificationCount = nc;
        if (nc > 0) agg.totalNotified++;
      });

      return Object.values(aggregates)
        .filter(a => a.companyName && a.companyName !== 'SANDBOX')
        .sort((a, b) => b.missingCount - a.missingCount);
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ── Mutations ──

export function useIgnoreMissingItem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('accounty_missing_items')
        .update({
          status: 'ignored',
          is_ignored: true,
          ignored_at: new Date().toISOString(),
          ignored_by: user?.id,
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAccountyCache(queryClient, 'missing');
    },
  });
}

export function useResolveMissingItem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('accounty_missing_items')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq('id', itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAccountyCache(queryClient, 'missing');
    },
  });
}

export function useAddMissingItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: {
      companyId: string;
      category: 'bejovo' | 'kimeno' | 'bank' | 'ber';
      title: string;
      subtitle?: string;
      priority?: 'urgent' | 'medium' | 'low';
      details?: string;
      amount?: number;
      invoiceNumber?: string;
      itemDate?: string;
    }) => {
      const { error } = await supabase
        .from('accounty_missing_items')
        .insert({
          company_id: item.companyId,
          category: item.category,
          title: item.title,
          subtitle: item.subtitle || null,
          source: 'manual',
          priority: item.priority || 'medium',
          details: item.details || null,
          amount: item.amount || null,
          invoice_number: item.invoiceNumber || null,
          item_date: item.itemDate || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAccountyCache(queryClient, 'missing');
    },
  });
}
