import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// ── Types ──

export interface AccountyClient {
  id: string;
  companyId: string;
  name: string;
  taxNumber: string | null;
  status: 'Rendben' | 'Feldolgozandó' | 'Kritikus';
  unprocessedCount: number;
  missingCount: number;
  deadlineDate: string | null;
  progress: number;
  assignedToMe: boolean;
  isPrimary: boolean;
  accountantRole: 'senior' | 'junior';
}

export interface AccountyMissingItem {
  id: string;
  companyId: string;
  companyName?: string;
  category: 'bejovo' | 'kimeno' | 'bank' | 'ber';
  title: string;
  subtitle: string | null;
  source: string;
  priority: 'urgent' | 'medium' | 'low';
  status: 'open' | 'notified' | 'resolved' | 'ignored';
  details: string | null;
  amount: number | null;
  invoiceNumber: string | null;
  itemDate: string | null;
  resolveRoute: string | null;
  navInvoiceId: string | null;
  transactionId: string | null;
  notificationCount: number;
  lastNotifiedAt: string | null;
  escalationLevel: number;
  isIgnored: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AccountyDeadline {
  id: string;
  companyId: string;
  companyName?: string;
  deadlineType: string;
  title: string | null;
  dueDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  isManualOverride: boolean;
  notes: string | null;
}

export interface AccountyKpis {
  totalClients: number;
  unprocessedInvoices: number;
  missingItems: number;
  upcomingDeadlines: number;
  criticalClients: number;
  todayDeadlines: number;
}

export interface AccountyTaxProfile {
  id: string;
  companyId: string;
  vatFrequency: 'monthly' | 'quarterly' | 'yearly';
  contributionFrequency: 'monthly' | 'quarterly' | 'yearly';
  isKata: boolean;
  isKiva: boolean;
  taxGroup: string | null;
  navSynced: boolean;
}

// ── Helper: compute status from counts ──
function computeStatus(missingCount: number, unprocessedCount: number): 'Rendben' | 'Feldolgozandó' | 'Kritikus' {
  if (missingCount > 3 || unprocessedCount > 10) return 'Kritikus';
  if (missingCount > 0 || unprocessedCount > 0) return 'Feldolgozandó';
  return 'Rendben';
}

// ── Helper: compute progress (simplified) ──
function computeProgress(missingCount: number, totalInvoices: number): number {
  if (totalInvoices === 0 && missingCount === 0) return 100;
  if (totalInvoices === 0) return missingCount > 0 ? 30 : 100;
  const ratio = Math.max(0, 1 - (missingCount / Math.max(totalInvoices, 1)));
  return Math.round(ratio * 100);
}

// ══════════════════════════════════════════════════════════════
// useAccountyClients – Fetches companies assigned to this accountant
// ══════════════════════════════════════════════════════════════

export function useAccountyClients() {
  const { user } = useAuth();
  const userId = user?.id || '';

  return useQuery({
    queryKey: queryKeys.accountyClients(userId),
    queryFn: async (): Promise<AccountyClient[]> => {
      // 1. Get all assignments for this accountant
      const { data: assignments, error: assignErr } = await supabase
        .from('accounty_assignments')
        .select('company_id, role, is_primary')
        .eq('accountant_user_id', userId);

      if (assignErr) throw assignErr;
      if (!assignments || assignments.length === 0) return [];

      const companyIds = assignments.map((a: any) => a.company_id);

      // 2. Get company details (companies RLS includes accounty_assignments policy)
      const { data: companies, error: compErr } = await supabase
        .from('companies')
        .select('id, name, tax_number')
        .in('id', companyIds);

      if (compErr) throw compErr;

      // 3. Get missing items counts per company (count-only, no row limit issue)
      const missingCountMap: Record<string, number> = {};
      for (const cid of companyIds) {
        const { count, error: countErr } = await supabase
          .from('accounty_missing_items')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', cid)
          .in('status', ['open', 'notified']);
        if (countErr) throw countErr;
        missingCountMap[cid] = count || 0;
      }

      // 4. Get nearest deadline per company
      const { data: deadlines, error: deadErr } = await supabase
        .from('accounty_deadlines')
        .select('company_id, due_date')
        .in('company_id', companyIds)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true });

      if (deadErr) throw deadErr;


      const deadlineMap: Record<string, string> = {};
      (deadlines || []).forEach((d: any) => {
        if (!deadlineMap[d.company_id]) {
          deadlineMap[d.company_id] = d.due_date;
        }
      });

      const assignmentMap: Record<string, any> = {};
      assignments.forEach((a: any) => {
        assignmentMap[a.company_id] = a;
      });

      // 5. Build client list (exclude SANDBOX — duplikált test adatok)
      return (companies || []).filter(c => c.name !== 'SANDBOX').map((company): AccountyClient => {
        const assignment = assignmentMap[company.id];
        const missingCount = missingCountMap[company.id] || 0;
        const unprocessedCount = 0; // Will be calculated from invoices later
        const progress = computeProgress(missingCount, 0);

        return {
          id: company.id,
          companyId: company.id,
          name: company.name,
          taxNumber: company.tax_number,
          status: computeStatus(missingCount, unprocessedCount),
          unprocessedCount,
          missingCount,
          deadlineDate: deadlineMap[company.id] || null,
          progress,
          assignedToMe: true,
          isPrimary: assignment?.is_primary || false,
          accountantRole: assignment?.role || 'junior',
        };
      });
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ══════════════════════════════════════════════════════════════
// useAccountyMissingItems – Missing items for a specific company
// ══════════════════════════════════════════════════════════════

export function useAccountyMissingItems(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountyMissingItems(companyId),
    queryFn: async (): Promise<AccountyMissingItem[]> => {
      const { data, error } = await supabase
        .from('accounty_missing_items')
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['open', 'notified', 'resolved'])
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((item: any): AccountyMissingItem => ({
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
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });
}

// ══════════════════════════════════════════════════════════════
// useAccountyAllMissingItems – All missing items across all assigned companies
// ══════════════════════════════════════════════════════════════

export function useAccountyAllMissingItems() {
  const { user } = useAuth();
  const userId = user?.id || '';

  return useQuery({
    queryKey: queryKeys.accountyAllMissingItems(userId),
    queryFn: async (): Promise<(AccountyMissingItem & { companyName: string })[]> => {
      // Get assignments first
      const { data: assignments, error: assignErr } = await supabase
        .from('accounty_assignments')
        .select('company_id')
        .eq('accountant_user_id', userId);

      if (assignErr) throw assignErr;
      if (!assignments || assignments.length === 0) return [];

      const companyIds = assignments.map((a: any) => a.company_id);

      // Get ALL missing items (paginated to bypass PostgREST 1000-row limit)
      const items = await fetchAllMissingItemsFull(companyIds);

      // Get company names (companies RLS includes accounty_assignments policy)
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds);

      const nameMap: Record<string, string> = {};
      (companies || []).forEach((c: any) => { nameMap[c.id] = c.name; });

      return (items || []).map((item: any) => ({
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

// ══════════════════════════════════════════════════════════════
// useAccountyCompanySummary – Per-company missing item aggregates
// ══════════════════════════════════════════════════════════════

export interface AccountyCompanySummary {
  companyId: string;
  companyName: string;
  companyTaxNumber: string;
  missingCount: number;
  criticalCount: number;
  lastNotifiedAt: string | null;
  maxNotificationCount: number;
  totalNotified: number;
}

// Helper: paginated fetch to get ALL rows (bypasses PostgREST 1000-row limit)
async function fetchAllMissingItems(companyIds: string[]) {
  const PAGE_SIZE = 1000;
  let allItems: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('accounty_missing_items')
      .select('company_id, priority, last_notified_at, notification_count')
      .in('company_id', companyIds)
      .in('status', ['open', 'notified'])
      .range(from, to);

    if (error) throw error;
    if (data && data.length > 0) {
      allItems = allItems.concat(data);
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
    page++;
  }
  return allItems;
}

// Helper: paginated fetch with ALL columns for detail views
async function fetchAllMissingItemsFull(companyIds: string[]) {
  const PAGE_SIZE = 1000;
  let allItems: any[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('accounty_missing_items')
      .select('*')
      .in('company_id', companyIds)
      .in('status', ['open', 'notified'])
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;
    if (data && data.length > 0) {
      allItems = allItems.concat(data);
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
    page++;
  }
  return allItems;
}

export function useAccountyCompanySummary() {
  const { user } = useAuth();
  const userId = user?.id || '';

  return useQuery({
    queryKey: ['accounty-company-summary', userId],
    queryFn: async (): Promise<AccountyCompanySummary[]> => {
      // 1. Get assignments for this accountant
      const { data: assignments, error: assignErr } = await supabase
        .from('accounty_assignments')
        .select('company_id')
        .eq('accountant_user_id', userId);

      if (assignErr) throw assignErr;
      if (!assignments || assignments.length === 0) return [];

      const companyIds = [...new Set(assignments.map((a: any) => a.company_id))];

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
      (companies || []).forEach((c: any) => {
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

      missingItems.forEach((mi: any) => {
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

// ══════════════════════════════════════════════════════════════
// useAccountyDeadlines – All deadlines for assigned companies
// ══════════════════════════════════════════════════════════════

export function useAccountyDeadlines() {
  const { user } = useAuth();
  const userId = user?.id || '';

  return useQuery({
    queryKey: queryKeys.accountyDeadlines(userId),
    queryFn: async (): Promise<AccountyDeadline[]> => {
      // Get assignments
      const { data: assignments, error: assignErr } = await supabase
        .from('accounty_assignments')
        .select('company_id')
        .eq('accountant_user_id', userId);

      if (assignErr) throw assignErr;
      if (!assignments || assignments.length === 0) return [];

      const companyIds = assignments.map((a: any) => a.company_id);

      // Get deadlines
      const { data: deadlines, error } = await supabase
        .from('accounty_deadlines')
        .select('*')
        .in('company_id', companyIds)
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Get company names
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds);

      const nameMap: Record<string, string> = {};
      (companies || []).forEach(c => { nameMap[c.id] = c.name; });

      return (deadlines || [])
        .filter((d: any) => nameMap[d.company_id] && nameMap[d.company_id] !== 'SANDBOX')
        .map((d: any): AccountyDeadline => ({
        id: d.id,
        companyId: d.company_id,
        companyName: nameMap[d.company_id] || 'Ismeretlen',
        deadlineType: d.deadline_type,
        title: d.title,
        dueDate: d.due_date,
        status: d.status,
        isManualOverride: d.is_manual_override || false,
        notes: d.notes,
      }));
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ══════════════════════════════════════════════════════════════
// useAccountyKpis – Aggregated KPIs across all assigned companies
// ══════════════════════════════════════════════════════════════

export function useAccountyKpis() {
  const { user } = useAuth();
  const userId = user?.id || '';

  return useQuery({
    queryKey: queryKeys.accountyKpis(userId),
    queryFn: async (): Promise<AccountyKpis> => {
      // Get assignments
      const { data: assignments, error: assignErr } = await supabase
        .from('accounty_assignments')
        .select('company_id')
        .eq('accountant_user_id', userId);

      if (assignErr) throw assignErr;
      if (!assignments || assignments.length === 0) {
        return { totalClients: 0, unprocessedInvoices: 0, missingItems: 0, upcomingDeadlines: 0, criticalClients: 0, todayDeadlines: 0 };
      }

      const allCompanyIds = assignments.map((a: any) => a.company_id);

      // Exclude SANDBOX
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', allCompanyIds);
      const companyIds = (companies || [])
        .filter(c => c.name !== 'SANDBOX')
        .map(c => c.id);
      const totalClients = companyIds.length;

      // Count open missing items
      const { count: missingCount, error: missingErr } = await supabase
        .from('accounty_missing_items')
        .select('id', { count: 'exact', head: true })
        .in('company_id', companyIds)
        .in('status', ['open', 'notified']);

      if (missingErr) throw missingErr;

      // Count upcoming deadlines (within 7 days)
      const now = new Date();
      const weekFromNow = new Date(now);
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      const nowStr = now.toISOString().split('T')[0];
      const weekStr = weekFromNow.toISOString().split('T')[0];

      const { count: deadlineCount, error: deadErr } = await supabase
        .from('accounty_deadlines')
        .select('id', { count: 'exact', head: true })
        .in('company_id', companyIds)
        .in('status', ['pending', 'in_progress'])
        .gte('due_date', nowStr)
        .lte('due_date', weekStr);

      if (deadErr) throw deadErr;

      // Count critical clients (urgent priority open items)
      const { count: criticalCount } = await supabase
        .from('accounty_missing_items')
        .select('company_id', { count: 'exact', head: true })
        .in('company_id', companyIds)
        .eq('priority', 'urgent')
        .in('status', ['open', 'notified']);

      // Count today's deadlines
      const { count: todayCount } = await supabase
        .from('accounty_deadlines')
        .select('id', { count: 'exact', head: true })
        .in('company_id', companyIds)
        .in('status', ['pending', 'in_progress'])
        .eq('due_date', nowStr);

      return {
        totalClients,
        unprocessedInvoices: 0,
        missingItems: missingCount || 0,
        upcomingDeadlines: deadlineCount || 0,
        criticalClients: criticalCount || 0,
        todayDeadlines: todayCount || 0,
      };
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

// ══════════════════════════════════════════════════════════════
// useAccountyTaxProfile – Tax profile for a specific company
// ══════════════════════════════════════════════════════════════

export function useAccountyTaxProfile(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountyTaxProfile(companyId),
    queryFn: async (): Promise<AccountyTaxProfile | null> => {
      const { data, error } = await supabase
        .from('accounty_tax_profiles')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: (data).id,
        companyId: (data).company_id,
        vatFrequency: (data).vat_frequency || 'monthly',
        contributionFrequency: (data).contribution_frequency || 'monthly',
        isKata: (data).is_kata || false,
        isKiva: (data).is_kiva || false,
        taxGroup: (data).tax_group,
        navSynced: (data).nav_synced || false,
      };
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

// ══════════════════════════════════════════════════════════════
// useAccountyPortalTokens – Portal tokens for a company
// ══════════════════════════════════════════════════════════════

export function useAccountyPortalTokens(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountyPortalTokens(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_portal_tokens')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        companyId: t.company_id,
        token: t.token,
        expiresAt: t.expires_at,
        isActive: t.is_active,
        lastUsedAt: t.last_used_at,
        createdAt: t.created_at,
      }));
    },
    enabled: !!companyId,
  });
}

// ══════════════════════════════════════════════════════════════
// MUTATIONS
// ══════════════════════════════════════════════════════════════

// Ignore a missing item
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
      queryClient.invalidateQueries({ queryKey: ['accounty-missing-items'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-all-missing-items'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-clients'] });
    },
  });
}

// Resolve a missing item
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
      queryClient.invalidateQueries({ queryKey: ['accounty-missing-items'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-all-missing-items'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-clients'] });
    },
  });
}

// Add a manual missing item
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
      queryClient.invalidateQueries({ queryKey: ['accounty-missing-items'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-all-missing-items'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-clients'] });
    },
  });
}

// Generate a portal token
export function useGeneratePortalToken() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: string | { companyId: string; requestedItemIds?: string[] }) => {
      const companyId = typeof params === 'string' ? params : params.companyId;
      const requestedItemIds = typeof params === 'string' ? undefined : params.requestedItemIds;
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      const insertPayload: any = {
        company_id: companyId,
        token,
        created_by: user?.id,
        expires_at: expiresAt.toISOString(),
      };
      if (requestedItemIds && requestedItemIds.length > 0) {
        insertPayload.requested_item_ids = requestedItemIds;
      }

      const { data, error } = await supabase
        .from('accounty_portal_tokens')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;
      return { token: (data).token, expiresAt: (data).expires_at };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounty-portal-tokens'] });
    },
  });
}

// Complete a deadline
export function useCompleteDeadline() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deadlineId: string) => {
      const { error } = await supabase
        .from('accounty_deadlines')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
        })
        .eq('id', deadlineId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounty-deadlines'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['accounty-clients'] });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// useAccountyCommunicationPrefs – Read communication preferences
// ══════════════════════════════════════════════════════════════

export interface AccountyCommunicationPrefs {
  id?: string;
  companyId: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  channelEmail: boolean;
  channelViber: boolean;
  channelSms: boolean;
  channelPhone: boolean;
  preferredLanguage: string;
  reminderFrequency: 'low' | 'normal' | 'high';
  autoReminder: boolean;
  gdprOptedIn: boolean;
  gdprOptedInAt: string | null;
}

export function useAccountyCommunicationPrefs(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountyCommunicationPrefs(companyId),
    queryFn: async (): Promise<AccountyCommunicationPrefs | null> => {
      const { data, error } = await supabase
        .from('accounty_communication_preferences')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const d = data as any;
      return {
        id: d.id,
        companyId: d.company_id,
        contactName: d.contact_name,
        contactEmail: d.contact_email,
        contactPhone: d.contact_phone,
        channelEmail: d.channel_email ?? true,
        channelViber: d.channel_viber ?? false,
        channelSms: d.channel_sms ?? false,
        channelPhone: d.channel_phone ?? false,
        preferredLanguage: d.preferred_language || 'hu',
        reminderFrequency: d.reminder_frequency || 'normal',
        autoReminder: d.auto_reminder ?? true,
        gdprOptedIn: d.gdpr_opted_in ?? false,
        gdprOptedInAt: d.gdpr_opted_in_at || null,
      };
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

// ══════════════════════════════════════════════════════════════
// useUpsertCommunicationPrefs – Save communication preferences
// ══════════════════════════════════════════════════════════════

export function useUpsertCommunicationPrefs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prefs: {
      companyId: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      channelEmail?: boolean;
      channelViber?: boolean;
      channelSms?: boolean;
      channelPhone?: boolean;
      preferredLanguage?: string;
      reminderFrequency?: 'low' | 'normal' | 'high';
      autoReminder?: boolean;
    }) => {
      const { error } = await supabase
        .from('accounty_communication_preferences')
        .upsert({
          company_id: prefs.companyId,
          contact_name: prefs.contactName || null,
          contact_email: prefs.contactEmail || null,
          contact_phone: prefs.contactPhone || null,
          channel_email: prefs.channelEmail ?? true,
          channel_viber: prefs.channelViber ?? false,
          channel_sms: prefs.channelSms ?? false,
          channel_phone: prefs.channelPhone ?? false,
          preferred_language: prefs.preferredLanguage || 'hu',
          reminder_frequency: prefs.reminderFrequency || 'normal',
          auto_reminder: prefs.autoReminder ?? true,
        } as any, { onConflict: 'company_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounty-communication-prefs'] });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// useUpsertTaxProfile – Save tax profile
// ══════════════════════════════════════════════════════════════

export function useUpsertTaxProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: {
      companyId: string;
      vatFrequency?: 'monthly' | 'quarterly' | 'yearly';
      contributionFrequency?: 'monthly' | 'quarterly' | 'yearly';
      isKata?: boolean;
      isKiva?: boolean;
      taxGroup?: string;
    }) => {
      const { error } = await supabase
        .from('accounty_tax_profiles')
        .upsert({
          company_id: profile.companyId,
          vat_frequency: profile.vatFrequency || 'monthly',
          contribution_frequency: profile.contributionFrequency || 'monthly',
          is_kata: profile.isKata ?? false,
          is_kiva: profile.isKiva ?? false,
          tax_group: profile.taxGroup || null,
        } as any, { onConflict: 'company_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounty-tax-profile'] });
    },
  });
}

// ── Company Invoices (real Supabase data) ──

export type InvoiceStatus = 'Új' | 'Kontírozásra vár' | 'Kontírozott' | 'Exportálva' | 'Problémás';

export interface CompanyInvoice {
  id: string;
  invoiceNumber: string;
  partnerName: string;
  date: string;
  grossAmount: number;
  vatAmount: number;
  status: InvoiceStatus;
  type: 'bejovo' | 'kimeno';
  isReverseCharge?: boolean;
  reverseChargeCategory?: string | null;
}

const mapDbStatus = (s: string | null): InvoiceStatus => {
  switch (s) {
    case 'feldolgozas_alatt': return 'Új';
    case 'feldolgozott': return 'Kontírozott';
    case 'kifizetve': return 'Exportálva';
    case 'keses': return 'Problémás';
    case 'torolt': return 'Problémás';
    default: return 'Kontírozásra vár';
  }
};

export function useCompanyInvoices(companyId: string) {
  return useQuery({
    queryKey: ['company-invoices', companyId],
    queryFn: async (): Promise<CompanyInvoice[]> => {
      // 1. Uploaded invoices (bizonylatsorszam = was szamlaszam, renamed in migration)
      const { data: uploaded, error: err1 } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, elado_nev, vevo_nev, kibocsatas_datuma, brutto_vegosszeg, afa_osszeg_osszesen, adoalap_osszesen, statusz, invoice_direction, forditott_adozas, reverse_charge_category')
        .eq('company_id', companyId)
        .order('kibocsatas_datuma', { ascending: false })
        .limit(500);
      if (err1) console.warn('[CompanyInvoices] uploaded error:', err1);

      // 2. NAV invoices
      const { data: navData, error: err2 } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, supplier_name, customer_name, invoice_issue_date, invoice_gross_amount, invoice_vat_amount, invoice_direction, is_reverse_charge, reverse_charge_category')
        .eq('company_id', companyId)
        .order('invoice_issue_date', { ascending: false })
        .limit(500);
      if (err2) console.warn('[CompanyInvoices] nav error:', err2);

      const results: CompanyInvoice[] = [];

      // Map uploaded invoices
      for (const inv of (uploaded || [])) {
        const isInbound = inv.invoice_direction === 'INBOUND';
        results.push({
          id: inv.id,
          invoiceNumber: inv.bizonylatsorszam || '-',
          partnerName: isInbound ? (inv.elado_nev || '-') : (inv.vevo_nev || '-'),
          date: inv.kibocsatas_datuma
            ? new Date(inv.kibocsatas_datuma).toLocaleDateString('hu-HU')
            : '-',
          grossAmount: Number(inv.brutto_vegosszeg) || 0,
          vatAmount: Number(inv.afa_osszeg_osszesen) || 0,
          status: mapDbStatus(inv.statusz),
          type: isInbound ? 'bejovo' : 'kimeno',
          isReverseCharge: inv.forditott_adozas === true,
          reverseChargeCategory: inv.reverse_charge_category || null,
        });
      }

      // Map NAV invoices (these have direction)
      for (const nav of (navData || [])) {
        const isInbound = nav.invoice_direction === 'INBOUND';
        results.push({
          id: nav.id,
          invoiceNumber: nav.invoice_number || '-',
          partnerName: isInbound ? (nav.supplier_name || '-') : (nav.customer_name || '-'),
          date: nav.invoice_issue_date
            ? new Date(nav.invoice_issue_date).toLocaleDateString('hu-HU')
            : '-',
          grossAmount: Number(nav.invoice_gross_amount) || 0,
          vatAmount: Number(nav.invoice_vat_amount) || 0,
          status: 'Feldolgozott',
          type: isInbound ? 'bejovo' : 'kimeno',
          isReverseCharge: (nav as any).is_reverse_charge === true,
          reverseChargeCategory: (nav as any).reverse_charge_category || null,
        });
      }

      // Sort by date descending
      results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      return results;
    },
    enabled: !!companyId,
  });
}

// ── Kanban status persistence ──

const kanbanStatusMap: Record<string, string> = {
  'Rendben': 'aktiv',
  'Feldolgozandó': 'feldolgozando',
  'Kritikus': 'kritikus',
};

const kanbanStatusReverse: Record<string, string> = {
  'aktiv': 'Rendben',
  'feldolgozando': 'Feldolgozandó',
  'kritikus': 'Kritikus',
};

export { kanbanStatusReverse };

export function useUpdateKanbanStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ assignmentId, status }: { assignmentId: string; status: string }) => {
      const dbStatus = kanbanStatusMap[status] || 'aktiv';
      const { error } = await supabase
        .from('accounty_assignments')
        .update({ kanban_status: dbStatus })
        .eq('id', assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounty-clients'] });
    },
  });
}

// ── Accountant profiles (real data from profiles + assignments) ──

export interface AccountyAccountant {
  id: string;
  userId: string;
  name: string;
  initial: string;
  clientCount: number;
}

export function useAccountyAccountants() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['accounty-accountants'],
    queryFn: async (): Promise<AccountyAccountant[]> => {
      // Get all unique accountant_user_ids from assignments
      const { data: assignments, error: aErr } = await supabase
        .from('accounty_assignments')
        .select('accountant_user_id, id') as any;
      if (aErr) throw aErr;
      if (!assignments || assignments.length === 0) return [];

      // Count clients per accountant
      const countMap: Record<string, number> = {};
      const userIds = new Set<string>();
      for (const a of assignments) {
        const uid = a.accountant_user_id;
        userIds.add(uid);
        countMap[uid] = (countMap[uid] || 0) + 1;
      }

      // Fetch profiles for those user IDs
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', Array.from(userIds));
      if (pErr) throw pErr;

      const profileMap: Record<string, string> = {};
      for (const p of (profiles || [])) {
        profileMap[p.user_id] = p.name || 'Névtelen';
      }

      return Array.from(userIds).map((uid) => {
        const name = profileMap[uid] || 'Névtelen';
        return {
          id: uid,
          userId: uid,
          name,
          initial: name.charAt(0).toUpperCase(),
          clientCount: countMap[uid] || 0,
        };
      });
    },
    enabled: !!user,
  });
}

// ── Report data (typed per report) ──

export interface ReportRow {
  clientName: string;
  taxNumber: string;
  status: string;
  missingCount: number;
  unprocessedCount: number;
  nextDeadline: string;
}

export interface InvoiceReportRow {
  invoiceNumber: string;
  partnerName: string;
  date: string;
  direction: string;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  currency: string;
  clientName: string;
}

export interface FullReportData {
  clients: ReportRow[];
  invoices: InvoiceReportRow[];
}

export function useAccountyReportData(): ReportRow[] {
  const { data: clients } = useAccountyClients();
  return (clients || []).map((c) => ({
    clientName: c.name,
    taxNumber: c.taxNumber || '',
    status: c.status,
    missingCount: c.missingCount,
    unprocessedCount: c.unprocessedCount,
    nextDeadline: c.deadlineDate
      ? new Date(c.deadlineDate).toLocaleDateString('hu-HU')
      : '–',
  }));
}

export function useAccountyFullReportData() {
  const { user } = useAuth();
  const clientRows = useAccountyReportData();

  const invoiceQuery = useQuery({
    queryKey: ['accounty-report-invoices'],
    queryFn: async (): Promise<InvoiceReportRow[]> => {
      // Get all company_ids this user is assigned to
      const { data: assignments } = await supabase
        .from('accounty_assignments')
        .select('company_id') as any;
      if (!assignments || assignments.length === 0) return [];

      const companyIds = assignments.map((a: any) => a.company_id);

      // Get company names
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds);
      const companyMap: Record<string, string> = {};
      for (const c of (companies || [])) {
        if (c.name === 'SANDBOX') continue; // exclude duplikált test adatok
        companyMap[c.id] = c.name;
      }

      const results: InvoiceReportRow[] = [];

      for (const cid of companyIds) {
        if (!companyMap[cid]) continue; // skip SANDBOX or unknown companies
        // 1. Uploaded invoices (bizonylatsorszam = was szamlaszam)
        const { data: uploaded } = await supabase
          .from('invoices')
          .select('bizonylatsorszam, elado_nev, vevo_nev, kibocsatas_datuma, afa_osszeg_osszesen, adoalap_osszesen, brutto_vegosszeg, invoice_direction, company_id, penznem')
          .eq('company_id', cid)
          .order('kibocsatas_datuma', { ascending: false })
          .limit(100);

        for (const inv of (uploaded || [])) {
          const isInbound = inv.invoice_direction === 'INBOUND';
          const gross = Number(inv.brutto_vegosszeg) || 0;
          const vat = Number(inv.afa_osszeg_osszesen) || 0;
          const net = Number(inv.adoalap_osszesen) || (gross - vat);
          results.push({
            invoiceNumber: inv.bizonylatsorszam || '-',
            partnerName: isInbound ? (inv.elado_nev || '-') : (inv.vevo_nev || '-'),
            date: inv.kibocsatas_datuma ? new Date(inv.kibocsatas_datuma).toLocaleDateString('hu-HU') : '-',
            direction: isInbound ? 'Bejövő' : 'Kimenő',
            netAmount: net,
            vatAmount: vat,
            grossAmount: gross,
            currency: (inv.penznem === 'HUF' || !inv.penznem) ? 'Ft' : inv.penznem,
            clientName: companyMap[inv.company_id!] || '-',
          });
        }

        // 2. NAV invoices (has direction)
        const { data: navBatch } = await supabase
          .from('nav_invoices')
          .select('invoice_number, supplier_name, customer_name, invoice_issue_date, invoice_net_amount, invoice_vat_amount, invoice_gross_amount, invoice_direction, company_id, currency')
          .eq('company_id', cid)
          .order('invoice_issue_date', { ascending: false })
          .limit(100);

        for (const nav of (navBatch || [])) {
          const isInbound = nav.invoice_direction === 'INBOUND';
          const gross = Number(nav.invoice_gross_amount) || 0;
          const vat = Number(nav.invoice_vat_amount) || 0;
          const net = Number(nav.invoice_net_amount) || (gross - vat);
          results.push({
            invoiceNumber: nav.invoice_number || '-',
            partnerName: isInbound ? (nav.supplier_name || '-') : (nav.customer_name || '-'),
            date: nav.invoice_issue_date ? new Date(nav.invoice_issue_date).toLocaleDateString('hu-HU') : '-',
            direction: isInbound ? 'Bejövő' : 'Kimenő',
            netAmount: net,
            vatAmount: vat,
            grossAmount: gross,
            currency: (nav.currency === 'HUF' || !nav.currency) ? 'Ft' : nav.currency,
            clientName: companyMap[nav.company_id!] || '-',
          });
        }
      }

      return results;
    },
    enabled: !!user,
  });

  return {
    clients: clientRows,
    invoices: invoiceQuery.data || [],
  } as FullReportData;
}

// ══════════════════════════════════════════════════════════════
// useAccountyMonthlyTrend – 6-month trend for dashboard chart
// ══════════════════════════════════════════════════════════════

export interface MonthlyTrendPoint {
  month: string;       // e.g. "Jan", "Feb"
  szamlak: number;     // total invoices that month
  hianyzok: number;    // missing items created that month
  zaras: number;       // closing % (invoices / (invoices + missing) * 100)
}

export function useAccountyMonthlyTrend() {
  const { user } = useAuth();
  const userId = user?.id || '';

  return useQuery({
    queryKey: ['accounty-monthly-trend', userId],
    queryFn: async (): Promise<MonthlyTrendPoint[]> => {
      // Get assigned companies (excl SANDBOX)
      const { data: assignments } = await supabase
        .from('accounty_assignments')
        .select('company_id')
        .eq('accountant_user_id', userId);
      if (!assignments || assignments.length === 0) return [];

      const allIds = assignments.map((a: any) => a.company_id);
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', allIds);
      const companyIds = (companies || []).filter(c => c.name !== 'SANDBOX').map(c => c.id);
      if (companyIds.length === 0) return [];

      const now = new Date();
      const months: MonthlyTrendPoint[] = [];
      const monthNames = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec'];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStart = d.toISOString().split('T')[0];
        const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const monthEnd = nextMonth.toISOString().split('T')[0];
        const label = monthNames[d.getMonth()];

        // Count invoices in this month (by kibocsatas_datuma)
        const { count: invCount } = await supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .in('company_id', companyIds)
          .gte('kibocsatas_datuma', monthStart)
          .lt('kibocsatas_datuma', monthEnd);

        // Count NAV invoices in this month
        const { count: navCount } = await supabase
          .from('nav_invoices')
          .select('id', { count: 'exact', head: true })
          .in('company_id', companyIds)
          .gte('invoice_issue_date', monthStart)
          .lt('invoice_issue_date', monthEnd);

        // Count missing items created this month
        const { count: missingCount } = await supabase
          .from('accounty_missing_items')
          .select('id', { count: 'exact', head: true })
          .in('company_id', companyIds)
          .gte('created_at', monthStart)
          .lt('created_at', monthEnd);

        const totalInv = (invCount || 0) + (navCount || 0);
        const totalMissing = missingCount || 0;
        const zaras = totalInv + totalMissing > 0
          ? Math.round((totalInv / (totalInv + totalMissing)) * 100)
          : 0;

        months.push({ month: label, szamlak: totalInv, hianyzok: totalMissing, zaras });
      }

      return months;
    },
    enabled: !!userId,
    staleTime: 5 * 60_000, // 5 min — heavy query
  });
}

// ══════════════════════════════════════════════════════════════
// useAccountyColleagueStats – Per-accountant performance stats
// ══════════════════════════════════════════════════════════════

export interface ColleagueStat {
  name: string;
  initial: string;
  assigned: number;
  closed: number;
  inProgress: number;
  missing: number;
  closingPct: number;
  avgDays: number;
  efficiency: 'Kiváló' | 'Jó' | 'Fejlesztendő';
}

export function useAccountyColleagueStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['accounty-colleague-stats'],
    queryFn: async (): Promise<ColleagueStat[]> => {
      // First get the current user's firm
      const { data: myAssignment } = await supabase
        .from('accounty_assignments')
        .select('accounting_firm_id')
        .eq('accountant_user_id', user!.id)
        .limit(1)
        .single();

      const firmId = myAssignment?.accounting_firm_id;
      if (!firmId) return [];

      // Get all assignments for THIS firm only
      const { data: assignments } = await supabase
        .from('accounty_assignments')
        .select('accountant_user_id, company_id')
        .eq('accounting_firm_id', firmId) as any;
      if (!assignments || assignments.length === 0) return [];

      // Get company names to exclude SANDBOX
      const allCompanyIds = [...new Set(assignments.map((a: any) => a.company_id))] as string[];
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', allCompanyIds);
      const sandboxIds = new Set((companies || []).filter(c => c.name === 'SANDBOX').map(c => c.id));

      // Group by accountant (exclude SANDBOX assignments)
      const accountantCompanies: Record<string, string[]> = {};
      for (const a of assignments) {
        if (sandboxIds.has(a.company_id)) continue;
        if (!accountantCompanies[a.accountant_user_id]) accountantCompanies[a.accountant_user_id] = [];
        accountantCompanies[a.accountant_user_id].push(a.company_id);
      }

      const accountantIds = Object.keys(accountantCompanies);

      // Get profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', accountantIds);
      const nameMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { nameMap[p.user_id] = p.name || 'Névtelen'; });

      const results: ColleagueStat[] = [];

      for (const uid of accountantIds) {
        const coIds = accountantCompanies[uid];
        const name = nameMap[uid] || 'Névtelen';

        // Missing items (open/notified)
        const { count: missingOpen } = await supabase
          .from('accounty_missing_items')
          .select('id', { count: 'exact', head: true })
          .in('company_id', coIds)
          .in('status', ['open', 'notified']);

        // Resolved items
        const { count: resolved } = await supabase
          .from('accounty_missing_items')
          .select('id', { count: 'exact', head: true })
          .in('company_id', coIds)
          .eq('status', 'resolved');

        // Completed deadlines
        const { count: completedDeadlines } = await supabase
          .from('accounty_deadlines')
          .select('id', { count: 'exact', head: true })
          .in('company_id', coIds)
          .eq('status', 'completed');

        // In-progress deadlines
        const { count: inProgressDeadlines } = await supabase
          .from('accounty_deadlines')
          .select('id', { count: 'exact', head: true })
          .in('company_id', coIds)
          .eq('status', 'in_progress');

        const assigned = coIds.length;
        const closed = completedDeadlines || 0;
        const inProgress = inProgressDeadlines || 0;
        const missing = missingOpen || 0;
        const totalHandled = (resolved || 0) + missing;
        const closingPct = totalHandled > 0 ? Math.round(((resolved || 0) / totalHandled) * 100) : 0;

        // Efficiency rating
        let efficiency: ColleagueStat['efficiency'] = 'Fejlesztendő';
        if (closingPct >= 80) efficiency = 'Kiváló';
        else if (closingPct >= 50) efficiency = 'Jó';

        results.push({
          name,
          initial: name.charAt(0).toUpperCase(),
          assigned,
          closed,
          inProgress,
          missing,
          closingPct,
          avgDays: 0, // Need timestamp tracking for accurate calc
          efficiency,
        });
      }

      return results
        .filter(r => r.name !== 'Sandbox' && r.name !== 'Névtelen')
        .sort((a, b) => b.closingPct - a.closingPct);
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
}

// ══════════════════════════════════════════════════════════════
// useAccountyAuditLog – Recent audit log entries
// ══════════════════════════════════════════════════════════════

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  companyId: string | null;
  companyName: string | null;
  details: Record<string, any>;
  createdAt: string;
}

export function useAccountyAuditLog(limit = 20) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['accounty-audit-log', limit],
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data, error } = await supabase
        .from('accounty_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((d: any): AuditLogEntry => ({
        id: d.id,
        userId: d.user_id,
        userName: d.user_name || 'Ismeretlen',
        action: d.action,
        entityType: d.entity_type,
        entityId: d.entity_id,
        companyId: d.company_id,
        companyName: d.company_name,
        details: d.details || {},
        createdAt: d.created_at,
      }));
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

// ══════════════════════════════════════════════════════════════
// useLogAuditEvent – Write an audit log entry
// ══════════════════════════════════════════════════════════════

export function useLogAuditEvent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: {
      action: string;
      entityType: string;
      entityId?: string;
      companyId?: string;
      companyName?: string;
      details?: Record<string, any>;
    }) => {
      const { error } = await supabase
        .from('accounty_audit_log')
        .insert({
          user_id: user?.id,
          user_name: user?.user_metadata?.name || user?.email || 'Ismeretlen',
          action: event.action,
          entity_type: event.entityType,
          entity_id: event.entityId || null,
          company_id: event.companyId || null,
          company_name: event.companyName || null,
          details: event.details || {},
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounty-audit-log'] });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// useAccountyPortalStats – Portal usage statistics
// ══════════════════════════════════════════════════════════════

export interface PortalStats {
  totalTokens: number;
  activeTokens: number;
  totalVisits: number;
  lastAccessedAt: string | null;
}

export function useAccountyPortalStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['accounty-portal-stats'],
    queryFn: async (): Promise<PortalStats> => {
      const { data, error } = await supabase
        .from('accounty_portal_tokens')
        .select('*');

      if (error) throw error;

      const tokens = (data || []) as any[];
      const active = tokens.filter(t => t.is_active);
      const totalVisits = tokens.reduce((sum: number, t: any) => sum + (t.visit_count || 0), 0);
      const lastAccessed = tokens
        .filter((t: any) => t.last_accessed_at)
        .sort((a: any, b: any) => new Date(b.last_accessed_at).getTime() - new Date(a.last_accessed_at).getTime())[0];

      return {
        totalTokens: tokens.length,
        activeTokens: active.length,
        totalVisits,
        lastAccessedAt: lastAccessed?.last_accessed_at || null,
      };
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

// ── Cégkapu / KÜNY Settings ──

export interface CegkapuSettings {
  id: string;
  companyId: string;
  tarhelyType: 'cegkapu' | 'kuny';
  tarhelyId: string;
  tarhelyStatus: 'active' | 'error' | 'unknown';
  tarhelyCompanyName: string;
  capacityUsed: number;
  capacityTotal: number;
  signerName: string;
  signerKauType: 'ugyfelkapu_plus' | 'dap' | 'eszig';
  signerKauId: string;
  signerVerified: boolean;
  pollingFrequency: '15' | '30' | '60';
  autoReceipt: boolean;
  lastSync: string | null;
}

export function useCegkapuSettings(companyId: string) {
  return useQuery({
    queryKey: ['cegkapu-settings', companyId],
    queryFn: async (): Promise<CegkapuSettings | null> => {
      const { data, error } = await supabase
        .from('accounty_cegkapu_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        companyId: data.company_id,
        tarhelyType: data.tarhely_type,
        tarhelyId: data.tarhely_id || '',
        tarhelyStatus: data.tarhely_status,
        tarhelyCompanyName: data.tarhely_company_name || '',
        capacityUsed: data.capacity_used || 0,
        capacityTotal: data.capacity_total || 100,
        signerName: data.signer_name || '',
        signerKauType: data.signer_kau_type || 'ugyfelkapu_plus',
        signerKauId: data.signer_kau_id || '',
        signerVerified: data.signer_verified || false,
        pollingFrequency: data.polling_frequency || '15',
        autoReceipt: data.auto_receipt !== false,
        lastSync: data.last_sync,
      };
    },
    enabled: !!companyId,
  });
}

export function useUpsertCegkapuSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Omit<CegkapuSettings, 'id'>) => {
      const { error } = await supabase
        .from('accounty_cegkapu_settings')
        .upsert({
          company_id: settings.companyId,
          tarhely_type: settings.tarhelyType,
          tarhely_id: settings.tarhelyId,
          tarhely_status: settings.tarhelyStatus,
          tarhely_company_name: settings.tarhelyCompanyName,
          capacity_used: settings.capacityUsed,
          capacity_total: settings.capacityTotal,
          signer_name: settings.signerName,
          signer_kau_type: settings.signerKauType,
          signer_kau_id: settings.signerKauId,
          signer_verified: settings.signerVerified,
          polling_frequency: settings.pollingFrequency,
          auto_receipt: settings.autoReceipt,
          last_sync: settings.lastSync,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'company_id' });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['cegkapu-settings', vars.companyId] });
    },
  });
}

// ── NAV Representations ──

export interface NavRepresentation {
  id: string;
  companyId: string;
  repType: 'person' | 'organization';
  name: string;
  taxId: string;
  scope: 'all' | 'payroll' | 'custom';
  scopeDetails: string | null;
  startDate: string;
  endDate: string | null;
  status: 'active' | 'expired' | 'revoked';
  registrationNumber: string | null;
}

export function useNavRepresentations(companyId: string) {
  return useQuery({
    queryKey: ['nav-representations', companyId],
    queryFn: async (): Promise<NavRepresentation[]> => {
      const { data, error } = await supabase
        .from('accounty_nav_representations')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id,
        companyId: r.company_id,
        repType: r.rep_type,
        name: r.name,
        taxId: r.tax_id,
        scope: r.scope,
        scopeDetails: r.scope_details,
        startDate: r.start_date,
        endDate: r.end_date,
        status: r.status,
        registrationNumber: r.registration_number,
      }));
    },
    enabled: !!companyId,
  });
}

export function useAddNavRepresentation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rep: Omit<NavRepresentation, 'id'>) => {
      const { error } = await supabase
        .from('accounty_nav_representations')
        .insert({
          company_id: rep.companyId,
          rep_type: rep.repType,
          name: rep.name,
          tax_id: rep.taxId,
          scope: rep.scope,
          scope_details: rep.scopeDetails,
          start_date: rep.startDate,
          end_date: rep.endDate,
          status: rep.status,
          registration_number: rep.registrationNumber,
        });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['nav-representations', vars.companyId] });
    },
  });
}

export function useRevokeNavRepresentation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase
        .from('accounty_nav_representations')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => {
      qc.invalidateQueries({ queryKey: ['nav-representations', companyId] });
    },
  });
}

// ── Retention Rules ──

export interface RetentionRule {
  id: string;
  companyId: string;
  docType: string;
  retentionYears: number;
  legalBasis: string;
  autoDelete: boolean;
}

const DEFAULT_RETENTION_RULES: Omit<RetentionRule, 'id' | 'companyId'>[] = [
  { docType: 'Munkaszerződés', retentionYears: 3, legalBasis: 'Mt. 286. §', autoDelete: false },
  { docType: 'Bérjegyzék', retentionYears: 8, legalBasis: 'Sztv. 169. §', autoDelete: true },
  { docType: 'TAJ-kártya másolat', retentionYears: 3, legalBasis: 'Mt. 286. §', autoDelete: true },
  { docType: 'Adóelőleg-nyilatkozat', retentionYears: 5, legalBasis: 'Art. 78. §', autoDelete: true },
  { docType: 'Bevallási XML', retentionYears: 8, legalBasis: 'Sztv. 169. §', autoDelete: false },
  { docType: 'Kilépő dokumentumok', retentionYears: 3, legalBasis: 'Mt. 286. §', autoDelete: false },
  { docType: 'Nyugdíj-releváns iratok', retentionYears: 50, legalBasis: 'Tny. törvény', autoDelete: false },
  { docType: 'GDPR hozzájárulás', retentionYears: 5, legalBasis: 'GDPR 7. cikk', autoDelete: true },
];

export function useRetentionRules(companyId: string) {
  return useQuery({
    queryKey: ['retention-rules', companyId],
    queryFn: async (): Promise<RetentionRule[]> => {
      const { data, error } = await supabase
        .from('accounty_retention_rules')
        .select('*')
        .eq('company_id', companyId)
        .order('doc_type');
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id,
        companyId: r.company_id,
        docType: r.doc_type,
        retentionYears: r.retention_years,
        legalBasis: r.legal_basis || '',
        autoDelete: r.auto_delete || false,
      }));
    },
    enabled: !!companyId,
  });
}

export function useSeedRetentionRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (companyId: string) => {
      const rows = DEFAULT_RETENTION_RULES.map(r => ({
        company_id: companyId,
        doc_type: r.docType,
        retention_years: r.retentionYears,
        legal_basis: r.legalBasis,
        auto_delete: r.autoDelete,
      }));
      const { error } = await supabase
        .from('accounty_retention_rules')
        .upsert(rows, { onConflict: 'company_id,doc_type' });
      if (error) throw error;
    },
    onSuccess: (_, companyId) => {
      qc.invalidateQueries({ queryKey: ['retention-rules', companyId] });
    },
  });
}

export function useUpdateRetentionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: RetentionRule) => {
      const { error } = await supabase
        .from('accounty_retention_rules')
        .update({
          retention_years: rule.retentionYears,
          legal_basis: rule.legalBasis,
          auto_delete: rule.autoDelete,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rule.id);
      if (error) throw error;
      return rule.companyId;
    },
    onSuccess: (companyId) => {
      qc.invalidateQueries({ queryKey: ['retention-rules', companyId] });
    },
  });
}

export function useAddRetentionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Omit<RetentionRule, 'id'>) => {
      const { error } = await supabase
        .from('accounty_retention_rules')
        .insert({
          company_id: rule.companyId,
          doc_type: rule.docType,
          retention_years: rule.retentionYears,
          legal_basis: rule.legalBasis,
          auto_delete: rule.autoDelete,
        });
      if (error) throw error;
      return rule.companyId;
    },
    onSuccess: (companyId) => {
      qc.invalidateQueries({ queryKey: ['retention-rules', companyId] });
    },
  });
}

export function useDeleteRetentionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase
        .from('accounty_retention_rules')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => {
      qc.invalidateQueries({ queryKey: ['retention-rules', companyId] });
    },
  });
}

// ── Data Contracts ──

export interface DataContract {
  id: string;
  companyId: string;
  partnerName: string;
  fileName: string;
  fileUrl: string;
  uploadDate: string;
  validUntil: string | null;
  status: 'active' | 'expired';
}

export function useDataContracts(companyId: string) {
  return useQuery({
    queryKey: ['data-contracts', companyId],
    queryFn: async (): Promise<DataContract[]> => {
      const { data, error } = await supabase
        .from('accounty_data_contracts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(c => ({
        id: c.id,
        companyId: c.company_id,
        partnerName: c.partner_name,
        fileName: c.file_name || '',
        fileUrl: c.file_url || '',
        uploadDate: c.upload_date,
        validUntil: c.valid_until,
        status: c.status,
      }));
    },
    enabled: !!companyId,
  });
}

export function useAddDataContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contract: Omit<DataContract, 'id'>) => {
      const { error } = await supabase
        .from('accounty_data_contracts')
        .insert({
          company_id: contract.companyId,
          partner_name: contract.partnerName,
          file_name: contract.fileName,
          file_url: contract.fileUrl,
          upload_date: contract.uploadDate,
          valid_until: contract.validUntil,
          status: contract.status,
        });
      if (error) throw error;
      return contract.companyId;
    },
    onSuccess: (companyId) => {
      qc.invalidateQueries({ queryKey: ['data-contracts', companyId] });
    },
  });
}

export function useDeleteDataContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId, fileUrl }: { id: string; companyId: string; fileUrl?: string }) => {
      // Delete file from storage if exists
      if (fileUrl) {
        await supabase.storage.from('accounty_contracts').remove([fileUrl]);
      }
      // Delete DB row
      const { error } = await supabase
        .from('accounty_data_contracts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (companyId) => {
      qc.invalidateQueries({ queryKey: ['data-contracts', companyId] });
    },
  });
}

// ── Sites ──

export interface Site {
  id: string;
  companyId: string;
  code: string;
  name: string;
  address: string;
  mainActivity: string;
  headcount: number;
}

export function useSites(companyId: string) {
  return useQuery({
    queryKey: ['sites', companyId],
    queryFn: async (): Promise<Site[]> => {
      const { data, error } = await supabase
        .from('accounty_sites')
        .select('*')
        .eq('company_id', companyId)
        .order('code');
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, companyId: r.company_id, code: r.code, name: r.name,
        address: r.address || '', mainActivity: r.main_activity || '', headcount: r.headcount || 0,
      }));
    },
    enabled: !!companyId,
  });
}

export function useAddSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (site: Omit<Site, 'id'>) => {
      const { error } = await supabase.from('accounty_sites').insert({
        company_id: site.companyId, code: site.code, name: site.name,
        address: site.address, main_activity: site.mainActivity, headcount: site.headcount,
      });
      if (error) throw error;
      return site.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: ['sites', cid] }); },
  });
}

export function useUpdateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (site: Site) => {
      const { error } = await supabase.from('accounty_sites').update({
        code: site.code, name: site.name, address: site.address,
        main_activity: site.mainActivity, headcount: site.headcount, updated_at: new Date().toISOString(),
      }).eq('id', site.id);
      if (error) throw error;
      return site.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: ['sites', cid] }); },
  });
}

export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase.from('accounty_sites').delete().eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: ['sites', cid] }); },
  });
}

// ── Cost Centers ──

export interface CostCenter {
  id: string;
  companyId: string;
  parentId: string | null;
  code: string;
  name: string;
  responsible: string;
  headcount: number;
  children?: CostCenter[];
}

export function useCostCenters(companyId: string) {
  return useQuery({
    queryKey: ['cost-centers', companyId],
    queryFn: async (): Promise<CostCenter[]> => {
      const { data, error } = await supabase
        .from('accounty_cost_centers')
        .select('*')
        .eq('company_id', companyId)
        .order('code');
      if (error) throw error;
      const flat = (data || []).map(r => ({
        id: r.id, companyId: r.company_id, parentId: r.parent_id,
        code: r.code, name: r.name, responsible: r.responsible || '', headcount: r.headcount || 0,
      }));
      // Build tree
      const map = new Map<string, CostCenter>();
      flat.forEach(n => map.set(n.id, { ...n, children: [] }));
      const roots: CostCenter[] = [];
      flat.forEach(n => {
        const node = map.get(n.id)!;
        if (n.parentId && map.has(n.parentId)) {
          map.get(n.parentId)!.children!.push(node);
        } else {
          roots.push(node);
        }
      });
      return roots;
    },
    enabled: !!companyId,
  });
}

export function useAddCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cc: Omit<CostCenter, 'id' | 'children'>) => {
      const { error } = await supabase.from('accounty_cost_centers').insert({
        company_id: cc.companyId, parent_id: cc.parentId, code: cc.code,
        name: cc.name, responsible: cc.responsible, headcount: cc.headcount,
      });
      if (error) throw error;
      return cc.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: ['cost-centers', cid] }); },
  });
}

export function useUpdateCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cc: CostCenter) => {
      const { error } = await supabase.from('accounty_cost_centers').update({
        code: cc.code, name: cc.name, responsible: cc.responsible,
        headcount: cc.headcount, parent_id: cc.parentId, updated_at: new Date().toISOString(),
      }).eq('id', cc.id);
      if (error) throw error;
      return cc.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: ['cost-centers', cid] }); },
  });
}

export function useDeleteCostCenter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase.from('accounty_cost_centers').delete().eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: ['cost-centers', cid] }); },
  });
}

// ── Departments ──

export interface Department {
  id: string;
  companyId: string;
  siteId: string | null;
  name: string;
  manager: string;
  headcount: number;
}

export function useDepartments(companyId: string) {
  return useQuery({
    queryKey: ['departments', companyId],
    queryFn: async (): Promise<Department[]> => {
      const { data, error } = await supabase
        .from('accounty_departments')
        .select('*')
        .eq('company_id', companyId)
        .order('name');
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, companyId: r.company_id, siteId: r.site_id,
        name: r.name, manager: r.manager || '', headcount: r.headcount || 0,
      }));
    },
    enabled: !!companyId,
  });
}

export function useAddDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dept: Omit<Department, 'id'>) => {
      const { error } = await supabase.from('accounty_departments').insert({
        company_id: dept.companyId, site_id: dept.siteId, name: dept.name,
        manager: dept.manager, headcount: dept.headcount,
      });
      if (error) throw error;
      return dept.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: ['departments', cid] }); },
  });
}

export function useUpdateDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dept: Department) => {
      const { error } = await supabase.from('accounty_departments').update({
        site_id: dept.siteId, name: dept.name, manager: dept.manager,
        headcount: dept.headcount, updated_at: new Date().toISOString(),
      }).eq('id', dept.id);
      if (error) throw error;
      return dept.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: ['departments', cid] }); },
  });
}

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId }: { id: string; companyId: string }) => {
      const { error } = await supabase.from('accounty_departments').delete().eq('id', id);
      if (error) throw error;
      return companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: ['departments', cid] }); },
  });
}

// ── Year-End Tasks ──

export interface YearEndTask {
  id: string;
  companyId: string;
  year: number;
  title: string;
  subtitle: string;
  category: string;
  iconName: string;
  color: string;
  deadline: string | null;
  status: 'done' | 'in_progress' | 'pending' | 'blocked';
  legalRef: string;
  checklist: { item: string; done: boolean }[];
  outputLabel: string;
  sortOrder: number;
}

export function useYearEndTasks(companyId: string, year: number) {
  return useQuery({
    queryKey: ['year-end-tasks', companyId, year],
    queryFn: async (): Promise<YearEndTask[]> => {
      const { data, error } = await supabase
        .from('accounty_year_end_tasks')
        .select('*')
        .eq('company_id', companyId)
        .eq('year', year)
        .order('sort_order');
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, companyId: r.company_id, year: r.year, title: r.title,
        subtitle: r.subtitle || '', category: r.category || 'general',
        iconName: r.icon_name || 'FileText', color: r.color || 'from-blue-500 to-indigo-500',
        deadline: r.deadline, status: r.status, legalRef: r.legal_ref || '',
        checklist: (r.checklist as any) || [], outputLabel: r.output_label || '', sortOrder: r.sort_order || 0,
      }));
    },
    enabled: !!companyId,
  });
}

export function useAddYearEndTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: Omit<YearEndTask, 'id'>) => {
      const { error } = await supabase.from('accounty_year_end_tasks').insert({
        company_id: task.companyId, year: task.year, title: task.title, subtitle: task.subtitle,
        category: task.category, icon_name: task.iconName, color: task.color,
        deadline: task.deadline, status: task.status, legal_ref: task.legalRef,
        checklist: task.checklist, output_label: task.outputLabel, sort_order: task.sortOrder,
      });
      if (error) throw error;
      return { companyId: task.companyId, year: task.year };
    },
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: ['year-end-tasks', k.companyId, k.year] }); },
  });
}

export function useUpdateYearEndTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: YearEndTask) => {
      const { error } = await supabase.from('accounty_year_end_tasks').update({
        title: task.title, subtitle: task.subtitle, status: task.status,
        checklist: task.checklist, updated_at: new Date().toISOString(),
      }).eq('id', task.id);
      if (error) throw error;
      return { companyId: task.companyId, year: task.year };
    },
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: ['year-end-tasks', k.companyId, k.year] }); },
  });
}

export function useDeleteYearEndTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId, year }: { id: string; companyId: string; year: number }) => {
      const { error } = await supabase.from('accounty_year_end_tasks').delete().eq('id', id);
      if (error) throw error;
      return { companyId, year };
    },
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: ['year-end-tasks', k.companyId, k.year] }); },
  });
}

export function useSeedYearEndTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, year }: { companyId: string; year: number }) => {
      const defaults = [
        { title: 'M30 Jövedelemigazolás', subtitle: 'Munkáltatói igazolás kiküldése minden dolgozónak', icon_name: 'FileText', color: 'from-blue-500 to-indigo-500', deadline: `${year + 1}-01-31`, legal_ref: 'Szja tv. 46. § (4)', checklist: [{ item: 'Éves jövedelem adatok véglegesítése', done: false }, { item: 'Családi kedvezmény összesítés', done: false }, { item: 'M30 PDF generálás', done: false }], sort_order: 1 },
        { title: 'Szabadság átvitel', subtitle: 'Ki nem vett szabadságnapok átvezetése', icon_name: 'Calendar', color: 'from-emerald-500 to-teal-500', deadline: `${year + 1}-01-15`, legal_ref: 'Mt. 123. § (5)', checklist: [{ item: 'Maradék szabadságnapok lekérdezése', done: false }, { item: 'Átviteli korlát ellenőrzés', done: false }, { item: 'Szabadságkeret frissítés', done: false }], sort_order: 2 },
        { title: 'Cafeteria záró rendezés', subtitle: 'SZÉP kártya és juttatások éves zárása', icon_name: 'Gift', color: 'from-pink-500 to-rose-500', deadline: `${year}-12-31`, legal_ref: 'Szja tv. 71. §', checklist: [{ item: 'Cafeteria keret felhasználás ellenőrzése', done: false }, { item: 'SZÉP kártya egyenleg záró kimutatás', done: false }], sort_order: 3 },
        { title: 'Rehabilitációs hozzájárulás', subtitle: 'Éves rehabilitációs hozzájárulás bevallás', icon_name: 'Shield', color: 'from-amber-500 to-orange-500', deadline: `${year + 1}-03-31`, legal_ref: 'Mmtv. 23. §', checklist: [{ item: 'Stat. létszám kiszámítása', done: false }, { item: 'Kötelező foglalkoztatási arány ellenőrzése', done: false }, { item: 'REHAB bevallás beküldése', done: false }], sort_order: 4 },
        { title: '2658 Éves összesítő bevallás', subtitle: 'Éves összesítő járulékbevallás', icon_name: 'Briefcase', color: 'from-cyan-500 to-blue-500', deadline: `${year + 1}-02-25`, legal_ref: 'Art. 50. §', checklist: [{ item: 'Havi bevallások egyeztetése', done: false }, { item: 'XML generálás és beküldés', done: false }], sort_order: 5 },
        { title: 'Minimálbér-emelés előkészítés', subtitle: 'Következő évi minimálbér átvezetés', icon_name: 'TrendingUp', color: 'from-green-500 to-emerald-500', deadline: `${year + 1}-01-01`, legal_ref: 'Mt. 153. §', checklist: [{ item: 'Új minimálbér rögzítése', done: false }, { item: 'Érintett munkavállalók azonosítása', done: false }, { item: 'Szerződésmódosítások előkészítése', done: false }], sort_order: 6 },
      ];
      const { error } = await supabase.from('accounty_year_end_tasks').insert(
        defaults.map(d => ({ ...d, company_id: companyId, year, status: 'pending', output_label: '' }))
      );
      if (error) throw error;
      return { companyId, year };
    },
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: ['year-end-tasks', k.companyId, k.year] }); },
  });
}

// ── Office Settings ──

export function useOfficeSettings() {
  return useQuery({
    queryKey: ['office-settings'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('accounty_office_settings')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.settings || {};
    },
  });
}

export function useUpsertOfficeSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Record<string, any>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('accounty_office_settings').upsert({
        user_id: user.id, settings, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['office-settings'] }); },
  });
}

// ── Employee Jobs ──

export interface EmployeeJob {
  id: string;
  companyId: string;
  employeeId: string;
  jobCode: string;
  jobCodeLabel: string;
  seqNum: number;
  position: string;
  feor: string;
  weeklyHours: number;
  startDate: string;
  endDate: string | null;
  baseSalary: number;
  status: 'active' | 'terminated' | 'suspended';
  insured: boolean;
  minimumBase: boolean;
  employer: string;
}

export function useEmployeeJobs(companyId: string, employeeId: string) {
  return useQuery({
    queryKey: ['employee-jobs', companyId, employeeId],
    queryFn: async (): Promise<EmployeeJob[]> => {
      // Read from accounty_employments — the single source of truth for jobs
      const { data, error } = await supabase
        .from('accounty_employments')
        .select('*')
        .eq('employee_id', employeeId)
        .order('start_date');
      if (error) throw error;
      return (data || []).map((e: any, i: number) => ({
        id: e.id,
        companyId: companyId,
        employeeId: e.employee_id,
        jobCode: e.job_code || '',
        jobCodeLabel: e.employment_type || e.job_code || '',
        seqNum: i + 1,
        position: e.job_title || '',
        feor: e.feor_code || '',
        weeklyHours: e.weekly_hours || 40,
        startDate: e.start_date,
        endDate: e.end_date || '',
        baseSalary: e.base_salary || 0,
        status: e.status || 'active',
        insured: true,
        minimumBase: false,
        employer: '',
      }));
    },
    enabled: !!companyId && !!employeeId,
  });
}

export function useAddEmployeeJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (job: Omit<EmployeeJob, 'id'>) => {
      const { error } = await supabase.from('accounty_employments').insert({
        employee_id: job.employeeId,
        company_id: job.companyId,
        employment_type: job.jobCodeLabel || job.jobCode,
        job_code: job.jobCode,
        job_title: job.position,
        feor_code: job.feor,
        weekly_hours: job.weeklyHours,
        start_date: job.startDate,
        end_date: job.endDate || null,
        base_salary: job.baseSalary,
        status: job.status,
      });
      if (error) throw error;
      return { companyId: job.companyId, employeeId: job.employeeId };
    },
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: ['employee-jobs', k.companyId, k.employeeId] }); },
  });
}

export function useDeleteEmployeeJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, companyId, employeeId }: { id: string; companyId: string; employeeId: string }) => {
      const { error } = await supabase.from('accounty_employments').delete().eq('id', id);
      if (error) throw error;
      return { companyId, employeeId };
    },
    onSuccess: (k) => { qc.invalidateQueries({ queryKey: ['employee-jobs', k.companyId, k.employeeId] }); },
  });
}

// ── Job Modifications ──

export function useAddJobModification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mods: { companyId: string; employeeId: string; changeType: string; effectiveDate: string; oldValue: string; newValue: string; reason: string; generate08e: boolean }[]) => {
      // 1. Find the active employment for this employee
      const { data: empRows } = await supabase
        .from('accounty_employments')
        .select('id')
        .eq('employee_id', mods[0].employeeId)
        .eq('status', 'active')
        .limit(1);
      const employmentId = empRows?.[0]?.id;

      // 2. Apply each modification to the actual employment record
      for (const mod of mods) {
        const updatePayload: Record<string, unknown> = {};
        switch (mod.changeType) {
          case 'worktime': updatePayload.weekly_hours = Number(mod.newValue) || 40; break;
          case 'feor': updatePayload.feor_code = mod.newValue; break;
          case 'salary': updatePayload.base_salary = Number(mod.newValue) || 0; break;
          case 'position': updatePayload.job_title = mod.newValue; break;
          case 'costcenter': updatePayload.cost_center = mod.newValue; break;
          // 'site' needs location_id lookup - store as text for now
          case 'site': break;
        }

        if (employmentId && Object.keys(updatePayload).length > 0) {
          const { error: updateErr } = await supabase
            .from('accounty_employments')
            .update(updatePayload)
            .eq('id', employmentId);
          if (updateErr) throw updateErr;
        }
      }

      // 3. Log the modifications (best effort - may fail on FK constraints)
      const logRows = mods.map(m => ({
        company_id: m.companyId, employee_id: m.employeeId,
        change_type: m.changeType, effective_date: m.effectiveDate,
        old_value: m.oldValue, new_value: m.newValue, reason: m.reason, generate_08e: m.generate08e,
      }));
      await supabase.from('accounty_job_modifications').insert(logRows);

      return { companyId: mods[0].companyId, employeeId: mods[0].employeeId };
    },
    onSuccess: (ctx) => {
      qc.invalidateQueries({ queryKey: ['payroll', 'employments', ctx.employeeId] });
      qc.invalidateQueries({ queryKey: ['payroll', 'employees'] });
    },
  });
}

// ── Declarations ──
// NOTE: accounty_declarations table (from 20260529_accounty_payroll_schema.sql)
// uses employee_id (not company_id). We query via employees → company join.

export interface Declaration {
  id: string;
  employeeId: string;
  type: string;
  status: 'active' | 'expired' | 'revoked';
  validFrom: string;
  validUntil: string | null;
  data: Record<string, any>;
  filedAt: string | null;
}

export function useDeclarations(companyId: string) {
  return useQuery({
    queryKey: ['declarations', companyId],
    queryFn: async (): Promise<Declaration[]> => {
      // First get employee IDs for this company
      const { data: emps, error: empErr } = await supabase
        .from('accounty_employees')
        .select('id')
        .eq('company_id', companyId);
      if (empErr) throw empErr;
      const empIds = (emps || []).map(e => e.id);
      if (empIds.length === 0) return [];

      const { data, error } = await supabase
        .from('accounty_declarations')
        .select('*')
        .in('employee_id', empIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id,
        employeeId: r.employee_id,
        type: r.declaration_type,
        status: r.status,
        validFrom: r.valid_from,
        validUntil: r.valid_until,
        data: r.parameters || {},
        filedAt: r.created_at,
      }));
    },
    enabled: !!companyId,
  });
}

export function useAddDeclaration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (decl: { employeeId: string; type: string; validFrom: string; validUntil?: string; parameters?: Record<string, any>; companyId: string }) => {
      const { error } = await supabase.from('accounty_declarations').insert({
        employee_id: decl.employeeId,
        declaration_type: decl.type,
        valid_from: decl.validFrom,
        valid_until: decl.validUntil || null,
        parameters: decl.parameters || {},
      });
      if (error) throw error;
      return decl.companyId;
    },
    onSuccess: (cid) => { qc.invalidateQueries({ queryKey: ['declarations', cid] }); },
  });
}

// ── Filings ──
// NOTE: accounty_filings table (from 20260529_accounty_payroll_schema.sql)
// uses period_year/period_month, not a single 'period' text field.

export interface Filing {
  id: string;
  companyId: string;
  filingType: string;
  period: string; // derived: "YYYY-MM"
  status: string;
  data: Record<string, any>;
  submittedAt: string | null;
}

export function useFilings(companyId: string, filingType?: string) {
  return useQuery({
    queryKey: ['filings', companyId, filingType],
    queryFn: async (): Promise<Filing[]> => {
      let q = supabase.from('accounty_filings').select('*').eq('company_id', companyId);
      if (filingType) q = q.ilike('filing_type', filingType);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id,
        companyId: r.company_id,
        filingType: r.filing_type,
        period: `${r.period_year}-${String(r.period_month || 1).padStart(2, '0')}`,
        status: r.status,
        data: r.xml_data ? { xml: r.xml_data } : {},
        submittedAt: r.submitted_at,
      }));
    },
    enabled: !!companyId,
  });
}

// ── Transfers ──

export interface Transfer {
  id: string;
  companyId: string;
  employeeId: string | null;
  employeeName: string;
  bankAccount: string;
  netSalary: number;
  period: string;
  status: 'pending' | 'approved' | 'sent';
}

export function useTransfers(companyId: string, period?: string) {
  return useQuery({
    queryKey: ['transfers', companyId, period],
    queryFn: async (): Promise<Transfer[]> => {
      let q = supabase.from('accounty_transfers').select('*').eq('company_id', companyId);
      if (period) q = q.eq('period', period);
      const { data, error } = await q.order('employee_name');
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, companyId: r.company_id, employeeId: r.employee_id,
        employeeName: r.employee_name || '', bankAccount: r.bank_account || '',
        netSalary: r.net_salary || 0, period: r.period, status: r.status,
      }));
    },
    enabled: !!companyId,
  });
}

// ── Documents ──

export interface AccountyDocument {
  id: string;
  companyId: string;
  employeeId: string | null;
  title: string;
  docType: string;
  status: 'pending' | 'generated' | 'sent' | 'archived';
  fileUrl: string;
  period: string;
  generatedAt: string | null;
}

export function useAccountyDocuments(companyId: string, docType?: string) {
  return useQuery({
    queryKey: ['accounty-documents', companyId, docType],
    queryFn: async (): Promise<AccountyDocument[]> => {
      let q = supabase.from('accounty_documents').select('*').eq('company_id', companyId);
      if (docType && docType !== 'all') q = q.eq('doc_type', docType);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(r => ({
        id: r.id, companyId: r.company_id, employeeId: r.employee_id,
        title: r.title, docType: r.doc_type, status: r.status,
        fileUrl: r.file_url || '', period: r.period || '',
        generatedAt: r.generated_at,
      }));
    },
    enabled: !!companyId,
  });
}

export function useGenerateDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ companyId, docType }: { companyId: string; docType: string }) => {
      // 1. Get latest cycle
      const { data: cycles } = await supabase
        .from('accounty_payroll_cycles')
        .select('id, year, month')
        .eq('company_id', companyId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1);

      if (!cycles || cycles.length === 0) throw new Error('Nincs számfejtési ciklus a céghez.');
      const currentCycle = cycles[0];
      const period = `${currentCycle.year}-${String(currentCycle.month).padStart(2, '0')}`;

      // 2. Get calculations
      const { data: calculations } = await supabase
        .from('accounty_payroll_calculations')
        .select('*, accounty_employments(employee_id)')
        .eq('cycle_id', currentCycle.id);

      if (!calculations || calculations.length === 0) {
        throw new Error('Nincsenek számfejtési adatok a legutóbbi ciklushoz.');
      }

      const typesToGenerate = docType === 'all' 
        ? ['payslip', 'transfer', 'e-payslip', 'cash', 'garnishment', 'cafeteria', 'summary', 'certificate']
        : [docType];

      const docs = [];
      for (const t of typesToGenerate) {
        // Company-level documents
        if (['summary', 'cash', 'cafeteria', 'garnishment', 'certificate'].includes(t)) {
          let title = '';
          if (t === 'summary') title = 'Munkáltatói összesítő';
          if (t === 'cash') title = 'Készpénzes kifizetési lista';
          if (t === 'cafeteria') title = 'Cafeteria feltöltési fájlok';
          if (t === 'garnishment') title = 'Letiltások jegyzéke';
          if (t === 'certificate') title = 'Igazolások';
          
          docs.push({
            company_id: companyId,
            employee_id: null,
            title: `${title} - ${period}`,
            doc_type: t,
            status: 'generated',
            period,
            generated_at: new Date().toISOString()
          });
        } else {
          // Employee-level documents
          for (const calc of calculations) {
            const meta = calc.metadata as any;
            const empName = meta?.employee_name || 'Ismeretlen';
            const empId = (calc.accounty_employments as any)?.employee_id || meta?.employee_id;

            if (!empId) {
              console.warn('Skipping calculation due to missing employee_id', calc.id);
              continue;
            }

            let title = '';
            if (t === 'payslip') title = `${empName} - Bérjegyzék`;
            if (t === 'transfer') title = `${empName} - Utalási lista`;
            if (t === 'e-payslip') title = `${empName} - E-bérjegyzék`;

            docs.push({
              company_id: companyId,
              employee_id: empId,
              title: title,
              doc_type: t,
              status: 'generated',
              period,
              generated_at: new Date().toISOString()
            });
          }
        }
      }

      // Delete existing to avoid duplicates
      await supabase.from('accounty_documents').delete().eq('company_id', companyId).eq('period', period).in('doc_type', typesToGenerate);

      const { error } = await supabase.from('accounty_documents').insert(docs);
      if (error) throw error;

      // If generating transfers, also populate accounty_transfers table
      if (typesToGenerate.includes('transfer')) {
        // Clean existing transfers for this period
        await supabase.from('accounty_transfers').delete().eq('company_id', companyId).eq('period', period);
        
        const transferRecords = calculations.map(calc => {
          const meta = calc.metadata as any;
          const empName = meta?.employee_name || 'Ismeretlen';
          const empId = (calc.accounty_employments as any)?.employee_id || meta?.employee_id;
          return {
            company_id: companyId,
            employee_id: empId || null,
            employee_name: empName,
            bank_account: meta?.bank_account || '',
            net_salary: calc.net_salary || 0,
            period,
            status: 'approved',
          };
        }).filter(t => t.net_salary > 0);

        if (transferRecords.length > 0) {
          await supabase.from('accounty_transfers').insert(transferRecords);
        }
      }

      return { companyId, docType };
    },
    onSuccess: (vars) => {
      qc.invalidateQueries({ queryKey: ['accounty-documents', vars.companyId] });
      qc.invalidateQueries({ queryKey: ['transfers', vars.companyId] });
      if (vars.docType !== 'all') {
        qc.invalidateQueries({ queryKey: ['accounty-documents', vars.companyId, vars.docType] });
      }
    }
  });
}
