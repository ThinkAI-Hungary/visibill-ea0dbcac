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
export async function fetchAllMissingItems(companyIds: string[]) {
  const PAGE_SIZE = 1000;
  let allItems: { company_id: string; priority: string; last_notified_at: string | null; notification_count: number }[] = [];
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
      // 1. Get current user's assignments to determine firm and role
      const { data: myAssignments } = await supabase
        .from('accounty_assignments')
        .select('accounting_firm_id, role, company_id, is_main_accountant')
        .eq('accountant_user_id', userId);

      if (!myAssignments || myAssignments.length === 0) {
        return { companyIds: [], isAdmin: false, firmId: null };
      }

      const firmId = myAssignments[0]?.accounting_firm_id || null;
      const isAdmin = myAssignments.some(a => a.role === 'iroda_admin');

      let companyIds: string[];
      if (isAdmin && firmId) {
        // Admin sees all firm companies
        const { data, error } = await supabase
          .from('accounty_assignments')
          .select('company_id')
          .eq('accounting_firm_id', firmId);
        if (error) throw error;
        companyIds = [...new Set((data || []).map(a => a.company_id))];
      } else {
        // Non-admin: only main accountant companies
        companyIds = myAssignments
          .filter(a => a.is_main_accountant)
          .map(a => a.company_id);
      }

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

      return { companyIds, isAdmin, firmId };
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}
