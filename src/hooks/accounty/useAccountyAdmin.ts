/**
 * Accounty Admin hooks — audit log, portal stats, office settings, cegkapu, NAV representations.
 * Split from useAccountyData.ts for maintainability.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

// ── Types ──

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  companyId: string | null;
  companyName: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface PortalStats {
  totalTokens: number;
  activeTokens: number;
  totalVisits: number;
  lastAccessedAt: string | null;
}

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

// ── Audit Log ──

export function useAccountyAuditLog(limit = 20) {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.accountyAuditLog({ limit }),
    queryFn: async (): Promise<AuditLogEntry[]> => {
      const { data, error } = await supabase
        .from('accounty_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((d): AuditLogEntry => ({
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
      details?: Record<string, unknown>;
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

// ── Portal Stats ──

export function useAccountyPortalStats() {
  const { user } = useAuth();

  return useQuery({
    queryKey: queryKeys.accountyPortalStats(),
    queryFn: async (): Promise<PortalStats> => {
      const { data, error } = await supabase
        .from('accounty_portal_tokens')
        .select('*');

      if (error) throw error;

      const tokens = data || [];
      const active = tokens.filter(t => t.is_active);
      const totalVisits = tokens.reduce((sum, t) => sum + (t.visit_count || 0), 0);
      const lastAccessed = tokens
        .filter(t => t.last_accessed_at)
        .sort((a, b) => new Date(b.last_accessed_at!).getTime() - new Date(a.last_accessed_at!).getTime())[0];

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

// ── Office Settings ──

export function useOfficeSettings() {
  return useQuery({
    queryKey: queryKeys.accountyOfficeSettings(),
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
    mutationFn: async (settings: Record<string, unknown>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('accounty_office_settings').upsert({
        user_id: user.id, settings, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.accountyOfficeSettings() }); },
  });
}

// ── Cégkapu Settings ──

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useCegkapuSettings(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountyCegkapuSettings(companyId),
    queryFn: async (): Promise<CegkapuSettings | null> => {
      if (!companyId || !UUID_REGEX.test(companyId)) return null;
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
    enabled: !!companyId && UUID_REGEX.test(companyId),
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
      qc.invalidateQueries({ queryKey: queryKeys.accountyCegkapuSettings(vars.companyId) });
    },
  });
}

// ── NAV Representations ──

export function useNavRepresentations(companyId: string) {
  return useQuery({
    queryKey: queryKeys.accountyNavRepresentations(companyId),
    queryFn: async (): Promise<NavRepresentation[]> => {
      if (!companyId || !UUID_REGEX.test(companyId)) return [];
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
    enabled: !!companyId && UUID_REGEX.test(companyId),
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
      qc.invalidateQueries({ queryKey: queryKeys.accountyNavRepresentations(vars.companyId) });
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
      qc.invalidateQueries({ queryKey: queryKeys.accountyNavRepresentations(companyId) });
    },
  });
}
