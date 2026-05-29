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
        .in('status', ['open', 'notified'])
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
    mutationFn: async (companyId: string) => {
      const token = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

      const { data, error } = await supabase
        .from('accounty_portal_tokens')
        .insert({
          company_id: companyId,
          token,
          created_by: user?.id,
          expires_at: expiresAt.toISOString(),
        })
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
        .select('id, bizonylatsorszam, elado_nev, vevo_nev, kibocsatas_datuma, brutto_vegosszeg, afa_osszeg_osszesen, adoalap_osszesen, statusz, invoice_direction')
        .eq('company_id', companyId)
        .order('kibocsatas_datuma', { ascending: false })
        .limit(500);
      if (err1) console.warn('[CompanyInvoices] uploaded error:', err1);

      // 2. NAV invoices
      const { data: navData, error: err2 } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, supplier_name, customer_name, invoice_issue_date, invoice_gross_amount, invoice_vat_amount, invoice_direction')
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
      // Get all assignments
      const { data: assignments } = await supabase
        .from('accounty_assignments')
        .select('accountant_user_id, company_id') as any;
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

      return results.sort((a, b) => b.closingPct - a.closingPct);
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
