/**
 * Accounty Client hooks — client list, KPIs, kanban, accountants.
 * Split from useAccountyData.ts for maintainability.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { reportError } from '@/lib/errorReporter';

// DB Row type aliases for readability
type AssignmentRow = Tables<'accounty_assignments'>;
type MissingItemRow = Pick<Tables<'accounty_missing_items'>, 'company_id'>;
type DeadlineRow = Pick<Tables<'accounty_deadlines'>, 'company_id' | 'due_date'>;
type CompanyRow = Pick<Tables<'companies'>, 'id' | 'name' | 'tax_number'>;
import {
  AccountyClient,
  AccountyKpis,
  AccountyAccountant,
  AccountyTaxProfile,
  computeStatus,
  computeProgress,
  invalidateAccountyCache,
  useMyAssignedCompanyIds,
} from './useAccountyHelpers';

// ── Clients ──

export function useAccountyClients() {
  const { user } = useAuth();
  const userId = user?.id || '';
  const { data: myAssignsData, isPending: myAssignsPending } = useMyAssignedCompanyIds();
  const companyIds = myAssignsData?.companyIds || [];
  const isAdmin = myAssignsData?.isAdmin || false;
  const firmId = myAssignsData?.firmId;

  const queryResult = useQuery({
    queryKey: queryKeys.accountyClients(userId),
    queryFn: async (): Promise<AccountyClient[]> => {
      if (companyIds.length === 0) return [];

      // Fetch assignments (all firm assignments for admin, otherwise only own/assigned)
      let assignments: AssignmentRow[] = [];
      if (isAdmin && firmId) {
        const { data, error } = await supabase
          .from('accounty_assignments')
          .select('*')
          .eq('accounting_firm_id', firmId);
        if (error) throw error;
        assignments = data || [];
      } else {
        const { data, error } = await supabase
          .from('accounty_assignments')
          .select('*')
          .in('company_id', companyIds);
        if (error) throw error;
        assignments = data || [];
      }

      if (assignments.length === 0) return [];

      // Group assignments by company
      const companyAssignments: Record<string, AssignmentRow[]> = {};
      assignments.forEach(a => {
        if (!companyAssignments[a.company_id]) companyAssignments[a.company_id] = [];
        companyAssignments[a.company_id].push(a);
      });

      const uniqueCompanyIds = Object.keys(companyAssignments);

      // Get company details
      const { data: companies, error: compErr } = await supabase
        .from('companies')
        .select('id, name, tax_number')
        .in('id', uniqueCompanyIds);

      if (compErr) throw compErr;

      // Get missing items counts per company (single query — replaces N+1 loop)
      const missingCountMap: Record<string, number> = {};
      const { data: openMissingItems, error: countErr } = await supabase
        .from('accounty_missing_items')
        .select('company_id')
        .in('company_id', uniqueCompanyIds)
        .in('status', ['open', 'notified']);
      if (countErr) {
        // Silent fail — missing counts will be 0
        reportError({ type: 'db_query', component: 'useAccountyClients', action: 'missing_counts', message: countErr.message, error: countErr });
      } else {
        (openMissingItems || []).forEach((r: MissingItemRow) => {
          missingCountMap[r.company_id] = (missingCountMap[r.company_id] || 0) + 1;
        });
      }

      // Get nearest deadline per company
      const { data: deadlines, error: deadErr } = await supabase
        .from('accounty_deadlines')
        .select('company_id, due_date')
        .in('company_id', uniqueCompanyIds)
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true });

      if (deadErr) throw deadErr;

      const deadlineMap: Record<string, string> = {};
      (deadlines || []).forEach((d: DeadlineRow) => {
        if (!deadlineMap[d.company_id]) {
          deadlineMap[d.company_id] = d.due_date;
        }
      });

      // Build client list
      const clientsList = (companies || []).filter(c => c.name !== 'SANDBOX').map((company): AccountyClient => {
        const assignsForComp = companyAssignments[company.id] || [];
        // Main accountant is the one with is_main_accountant=true, fallback to is_primary or first
        const mainAccountantAssign = assignsForComp.find(a => a.is_main_accountant) 
          || assignsForComp.find(a => a.is_primary) 
          || assignsForComp[0];
        const isMainAccountantForMe = assignsForComp.some(a => a.accountant_user_id === userId && a.is_main_accountant);

        const assignedToMe = isAdmin 
          ? assignsForComp.some(a => a.accountant_user_id === userId)
          : isMainAccountantForMe;
        const missingCount = missingCountMap[company.id] || 0;
        const unprocessedCount = 0;
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
          assignedToMe,
          isPrimary: mainAccountantAssign?.is_primary || false,
          accountantRole: mainAccountantAssign?.role || 'junior',
          ownerId: mainAccountantAssign?.accountant_user_id || '1',
          isMainAccountant: isMainAccountantForMe,
        };
      });

      // Non-admin users: only show companies where they are the main accountant
      if (!isAdmin) {
        return clientsList.filter(c => c.isMainAccountant);
      }
      return clientsList;
    },
    enabled: !!userId && !!myAssignsData,
    staleTime: 30_000,
  });

  return {
    ...queryResult,
    isLoading: queryResult.isLoading || myAssignsPending,
  };
}

/**
 * Convenience hook to get a single AccountyClient by its company id.
 * Internally derives its data from `useAccountyClients` so no extra DB call is made.
 */
export function useAccountyClient(companyId: string | undefined) {
  const clientsQuery = useAccountyClients();
  const client = companyId
    ? clientsQuery.data?.find(c => c.id === companyId) ?? null
    : null;

  return {
    data: client,
    isLoading: clientsQuery.isLoading,
    error: clientsQuery.error,
  };
}


// ── KPIs ──

export function useAccountyKpis() {
  const { user } = useAuth();
  const userId = user?.id || '';
  const { data: myAssignsData } = useMyAssignedCompanyIds();
  const companyIds = myAssignsData?.companyIds || [];

  return useQuery({
    queryKey: queryKeys.accountyKpis(userId),
    queryFn: async (): Promise<AccountyKpis> => {
      if (companyIds.length === 0) {
        return { totalClients: 0, unprocessedInvoices: 0, missingItems: 0, upcomingDeadlines: 0, criticalClients: 0, todayDeadlines: 0 };
      }

      const totalClients = companyIds.length;

      const now = new Date();
      const weekFromNow = new Date(now);
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      const nowStr = now.toISOString().split('T')[0];
      const weekStr = weekFromNow.toISOString().split('T')[0];

      const { data, error } = await supabase.rpc('get_accounty_dashboard_kpis', {
        p_company_ids: companyIds,
        p_now_date: nowStr,
        p_week_date: weekStr,
      });

      if (error) throw error;
      const kpis = data?.[0] || { missing_items: 0, upcoming_deadlines: 0, critical_clients: 0, today_deadlines: 0 };

      return {
        totalClients,
        unprocessedInvoices: 0,
        missingItems: Number(kpis.missing_items) || 0,
        upcomingDeadlines: Number(kpis.upcoming_deadlines) || 0,
        criticalClients: Number(kpis.critical_clients) || 0,
        todayDeadlines: Number(kpis.today_deadlines) || 0,
      };
    },
    enabled: !!userId && !!myAssignsData,
    staleTime: 30_000,
  });
}

// ── Tax Profile ──

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
        }, { onConflict: 'company_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounty-tax-profile'] });
    },
  });
}

// ── Portal Tokens ──

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
      return (data || []).map(t => ({
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

      const insertPayload: Record<string, unknown> = {
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

// ── Communication Preferences ──

export function useAccountyCommunicationPrefs(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountyCommunicationPrefs(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounty_communication_preferences')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        companyId: data.company_id,
        contactName: data.contact_name,
        contactEmail: data.contact_email,
        contactPhone: data.contact_phone,
        channelEmail: data.channel_email ?? true,
        channelViber: data.channel_viber ?? false,
        channelSms: data.channel_sms ?? false,
        channelPhone: data.channel_phone ?? false,
        preferredLanguage: data.preferred_language || 'hu',
        reminderFrequency: data.reminder_frequency || 'normal',
        autoReminder: data.auto_reminder ?? true,
        gdprOptedIn: data.gdpr_opted_in ?? false,
        gdprOptedInAt: data.gdpr_opted_in_at || null,
      };
    },
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

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
      gdprOptedIn?: boolean;
    }) => {
      const upsertData: Record<string, unknown> = {
        company_id: prefs.companyId,
        contact_name: prefs.contactName || null,
        contact_email: prefs.contactEmail || null,
        contact_phone: prefs.contactPhone || null,
        channel_email: prefs.channelEmail ?? false,
        channel_viber: prefs.channelViber ?? false,
        channel_sms: prefs.channelSms ?? false,
        channel_phone: prefs.channelPhone ?? false,
        preferred_language: prefs.preferredLanguage || 'hu',
        reminder_frequency: prefs.reminderFrequency || 'normal',
        auto_reminder: prefs.autoReminder ?? false,
      };

      if (prefs.gdprOptedIn !== undefined) {
        upsertData.gdpr_opted_in = prefs.gdprOptedIn;
        if (prefs.gdprOptedIn) {
          upsertData.gdpr_opted_in_at = new Date().toISOString();
        }
      }

      const { error } = await supabase
        .from('accounty_communication_preferences')
        .upsert(upsertData, { onConflict: 'company_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounty-communication-prefs'] });
    },
  });
}

// ── Kanban ──

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
      invalidateAccountyCache(queryClient, 'clients');
    },
  });
}

// ── Accountants ──

export function useAccountyAccountants() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.accountyAccountants(),
    queryFn: async (): Promise<AccountyAccountant[]> => {
      // Get all unique accountant_user_ids from assignments
      const { data: assignments, error: aErr } = await supabase
        .from('accounty_assignments')
        .select('accountant_user_id, id');
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

// ── Update Client Owner ──

export function useUpdateClientOwner() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { companyId: string; newOwnerId: string; oldOwnerId: string }) => {
      if (!user) throw new Error("User not authenticated");

      // Get user's accounting firm ID
      const { data: myAssignments } = await supabase
        .from('accounty_assignments')
        .select('accounting_firm_id')
        .eq('accountant_user_id', user.id)
        .limit(1);

      const firmId = myAssignments?.[0]?.accounting_firm_id || null;

      // 1. Clear is_main_accountant on ALL assignments for this company
      const { error: clearErr } = await supabase
        .from('accounty_assignments')
        .update({ is_main_accountant: false })
        .eq('company_id', params.companyId)
        .eq('is_main_accountant', true);
      if (clearErr) throw clearErr;

      // 2. Check if the new owner already has an assignment for this company
      const { data: existingAssign } = await supabase
        .from('accounty_assignments')
        .select('id')
        .eq('company_id', params.companyId)
        .eq('accountant_user_id', params.newOwnerId)
        .limit(1);

      if (existingAssign && existingAssign.length > 0) {
        // Set is_main_accountant on existing assignment
        const { error: updateErr } = await supabase
          .from('accounty_assignments')
          .update({ is_main_accountant: true })
          .eq('id', existingAssign[0].id);
        if (updateErr) throw updateErr;
      } else {
        // Create new assignment with is_main_accountant = true
        const { error: insertErr } = await supabase
          .from('accounty_assignments')
          .insert({
            company_id: params.companyId,
            accountant_user_id: params.newOwnerId,
            accounting_firm_id: firmId,
            role: 'könyvelő',
            is_primary: true,
            is_main_accountant: true,
          });
        if (insertErr) throw insertErr;
      }
    },
    onSuccess: () => {
      invalidateAccountyCache(queryClient, 'clients');
    },
  });
}

// ── Company Invoices ──

export type InvoiceStatus = 'Új' | 'Kontírozásra vár' | 'Kontírozott' | 'Exportálva' | 'Problémás';

export interface CompanyInvoice {
  id: string;
  invoiceNumber: string;
  partnerName: string;
  date: string;
  rawDate: string;
  grossAmount: number;
  vatAmount: number;
  status: InvoiceStatus;
  type: 'bejovo' | 'kimeno';
  isReverseCharge?: boolean;
  reverseChargeCategory?: string | null;
  currency: string;
  imageUrl?: string | null;
  mellekletUrl?: string | null;
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
    queryKey: queryKeys.accountyCompanyInvoices(companyId),
    queryFn: async (): Promise<CompanyInvoice[]> => {
      // 1. Uploaded invoices
      const { data: uploaded, error: err1 } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, elado_nev, vevo_nev, kibocsatas_datuma, brutto_vegosszeg, afa_osszeg_osszesen, adoalap_osszesen, statusz, invoice_direction, forditott_adozas, reverse_charge_category, penznem, image_url, melleklet_url')
        .eq('company_id', companyId)
        .order('kibocsatas_datuma', { ascending: false })
        .limit(500);
      if (err1) reportError({ type: 'db_query', component: 'useCompanyInvoices', action: 'uploaded', message: err1.message, error: err1 });

      // 2. NAV invoices
      const { data: navData, error: err2 } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, supplier_name, customer_name, invoice_issue_date, invoice_gross_amount, invoice_vat_amount, invoice_direction, is_reverse_charge, reverse_charge_category, currency')
        .eq('company_id', companyId)
        .order('invoice_issue_date', { ascending: false })
        .limit(500);
      if (err2) reportError({ type: 'db_query', component: 'useCompanyInvoices', action: 'nav', message: err2.message, error: err2 });

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
          rawDate: inv.kibocsatas_datuma || '',
          grossAmount: Number(inv.brutto_vegosszeg) || 0,
          vatAmount: Number(inv.afa_osszeg_osszesen) || 0,
          status: mapDbStatus(inv.statusz),
          type: isInbound ? 'bejovo' : 'kimeno',
          isReverseCharge: inv.forditott_adozas === true,
          reverseChargeCategory: inv.reverse_charge_category || null,
          currency: inv.penznem || 'HUF',
          imageUrl: inv.image_url,
          mellekletUrl: inv.melleklet_url,
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
          rawDate: nav.invoice_issue_date || '',
          grossAmount: Number(nav.invoice_gross_amount) || 0,
          vatAmount: Number(nav.invoice_vat_amount) || 0,
          status: 'Feldolgozott' as InvoiceStatus,
          type: isInbound ? 'bejovo' : 'kimeno',
          isReverseCharge: nav.is_reverse_charge === true,
          reverseChargeCategory: nav.reverse_charge_category || null,
          currency: nav.currency || 'HUF',
        });
      }

      // Sort by date descending
      results.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      return results;
    },
    enabled: !!companyId,
  });
}
