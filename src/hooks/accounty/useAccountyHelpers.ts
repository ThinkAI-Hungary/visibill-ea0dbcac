/**
 * Shared helpers and types for Accounty hooks.
 * Extracted from useAccountyData.ts to eliminate repeated code across 6+ hooks.
 */
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, QueryClient } from '@tanstack/react-query';
import type { Tables } from '@/integrations/supabase/types';
import { queryKeys } from '@/lib/queryKeys';

// ── Cache Invalidation Helpers ──

/**
 * Centralized invalidation for Accounty mutation callbacks.
 * Replaces 24+ hardcoded queryKey strings with single-call invalidation.
 *
 * Groups:
 *   'missing'  → missing items + all-missing + KPIs + clients
 *   'clients'  → clients + KPIs + company-summary + firm-accountants + all-missing
 *   'deadlines'→ deadlines + KPIs + clients
 */
type InvalidationGroup = 'missing' | 'clients' | 'deadlines';

export function invalidateAccountyCache(
  queryClient: QueryClient,
  groups: InvalidationGroup | InvalidationGroup[],
) {
  const groupList = Array.isArray(groups) ? groups : [groups];
  const keys = new Set<string>();

  for (const g of groupList) {
    switch (g) {
      case 'missing':
        keys.add('accounty-missing-items');
        keys.add('accounty-all-missing-items');
        keys.add('accounty-kpis');
        keys.add('accounty-clients');
        keys.add('accounty-missing-counts');
        break;
      case 'clients':
        keys.add('accounty-clients');
        keys.add('accounty-kpis');
        keys.add('accounty-all-missing-items');
        keys.add('accounty-company-summary');
        keys.add('firm-accountants');
        break;
      case 'deadlines':
        keys.add('accounty-deadlines');
        keys.add('accounty-kpis');
        keys.add('accounty-clients');
        break;
    }
  }

  for (const key of keys) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}
// ── Shared Types ──

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
  ownerId?: string;
  isMainAccountant?: boolean;
  countryCode?: string;
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
  uploaded_files?: string[] | null;
  uploadedFiles?: string[] | null;
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

export interface AccountyAccountant {
  id: string;
  userId: string;
  name: string;
  initial: string;
  clientCount: number;
}

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

// ── Helper Functions ──

/** Compute client status from missing/unprocessed counts */
export function computeStatus(missingCount: number, unprocessedCount: number): 'Rendben' | 'Feldolgozandó' | 'Kritikus' {
  if (missingCount > 3 || unprocessedCount > 10) return 'Kritikus';
  if (missingCount > 0 || unprocessedCount > 0) return 'Feldolgozandó';
  return 'Rendben';
}

/** Compute progress percentage */
export function computeProgress(missingCount: number, totalInvoices: number): number {
  if (totalInvoices === 0 && missingCount === 0) return 100;
  if (totalInvoices === 0) return missingCount > 0 ? 30 : 100;
  const ratio = Math.max(0, 1 - (missingCount / Math.max(totalInvoices, 1)));
  return Math.round(ratio * 100);
}

/** Paginated fetch for missing items (summary columns only) */
export async function fetchAllMissingItems(companyIds: string[], dateFrom?: string, dateTo?: string) {
  const PAGE_SIZE = 1000;
  let allItems: { company_id: string; priority: string; last_notified_at: string | null; notification_count: number }[] = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from('accounty_missing_items')
      .select('company_id, priority, last_notified_at, notification_count')
      .in('company_id', companyIds)
      .in('status', ['open', 'notified']);

    if (dateFrom) {
      query = query.gte('item_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('item_date', dateTo);
    }

    const { data, error } = await query.range(from, to);

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

/** Paginated fetch with ALL columns for detail views */
export async function fetchAllMissingItemsFull(companyIds: string[]) {
  const PAGE_SIZE = 1000;
  let allItems: Tables<'accounty_missing_items'>[] = [];
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

/**
 * Shared hook: get the current user's assigned company IDs + admin flag.
 * Replaces the 6× duplicated assignment-fetching pattern.
 */
export function useMyAssignedCompanyIds() {
  const { user } = useAuth();
  const userId = user?.id || '';

  return useQuery({
    queryKey: queryKeys.accountyMyAssignments(userId),
    queryFn: async (): Promise<{ companyIds: string[]; isAdmin: boolean; firmId: string | null }> => {
      // 0. Check profile & active support impersonations
      const [{ data: profile }, { data: impersonationRows }] = await Promise.all([
        supabase
          .from('profiles')
          .select('role, is_support_admin')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('company_members')
          .select('company_id')
          .eq('user_id', userId)
          .eq('role', 'support_admin' as any),
      ]);

      const isPlatformAdmin = profile?.is_support_admin || profile?.role === 'thinkai' || profile?.role === 'management';
      const impersonatedCompanyIds = (impersonationRows || []).map(r => r.company_id);

      // 1. Get current user's assignments
      const { data: myAssignments, error: assignErr } = await supabase
        .from('accounty_assignments')
        .select('accounting_firm_id, role, company_id, is_main_accountant')
        .eq('accountant_user_id', userId);

      if (assignErr) throw assignErr;

      const safeAssignments = myAssignments || [];
      const adminFirmIds = [...new Set(
        safeAssignments
          .filter(a => a.role === 'iroda_admin')
          .map(a => a.accounting_firm_id)
          .filter((id): id is string => Boolean(id))
      )];
      const isAdmin = isPlatformAdmin || adminFirmIds.length > 0;

      // 2. Direct assignments (all companies assigned to user, whether main accountant or secondary)
      const directCompanyIds = safeAssignments.map(a => a.company_id);

      // 3. Firm companies for all firms where user is iroda_admin
      let firmCompanyIds: string[] = [];
      if (adminFirmIds.length > 0) {
        const { data: firmAssigns, error: firmErr } = await supabase
          .from('accounty_assignments')
          .select('company_id')
          .in('accounting_firm_id', adminFirmIds);
        if (firmErr) throw firmErr;
        firmCompanyIds = (firmAssigns || []).map(a => a.company_id);
      }

      // Combine direct assignments, admin firm companies, and active support impersonations
      let companyIds = [...new Set([
        ...directCompanyIds,
        ...firmCompanyIds,
        ...impersonatedCompanyIds,
      ])];

      // Filter out SANDBOX
      if (companyIds.length > 0) {
        const { data: companies } = await supabase
          .from('companies')
          .select('id, name')
          .in('id', companyIds);
        companyIds = (companies || [])
          .filter(c => c.name !== 'SANDBOX')
          .map(c => c.id);
      }

      const primaryFirmId = adminFirmIds[0] || safeAssignments[0]?.accounting_firm_id || null;
      return { companyIds, isAdmin, firmId: primaryFirmId };
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
