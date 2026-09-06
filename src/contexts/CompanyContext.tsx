import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { STORAGE_KEYS } from '@/lib/constants';
import { queryKeys } from '@/lib/queryKeys';
import { safeStorage } from '@/lib/storage';
import { reportError } from '@/lib/errorReporter';

export type VatRegime = 'normal' | 'penzforgalmi' | 'alanyi_mentes';

export interface Company {
  id: string;
  name: string;
  tax_number: string | null;
  address: string | null;
  description?: string | null;
  primary_teaor?: string | null;
  owner_id: string;
  share_token?: string | null;
  vat_regime?: VatRegime;
  vat_regime_effective_from?: string | null;
  created_at: string;
  updated_at: string;
}

interface CompanyContextType {
  companies: Company[];
  eaisybillCompanyIds: string[];
  eaisybooksCompanyIds: string[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  loading: boolean;
  isInitialLoading: boolean;
  refreshCompanies: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

const SELECTED_COMPANY_KEY = STORAGE_KEYS.SELECTED_COMPANY_ID;

/**
 * CompanyProvider — now uses TanStack Query internally (P1-3).
 *
 * Benefits over the old useEffect + useState pattern:
 *   - Automatic caching: switching tabs / remounting doesn't refetch
 *   - Deduplication: multiple mounts only fire one request
 *   - Background refetch: stale data is replaced silently
 *   - Global staleTime (5 min) applies automatically
 */
export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCompany, setSelectedCompanyState] = useState<Company | null>(null);

  const { data: queryData, isPending, isFetching } = useQuery({
    queryKey: queryKeys.companies(user?.id || ''),
    queryFn: async () => {
      // 1. Get company IDs from company_members (eaisybill members)
      const { data: memberData, error: memberError } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', user!.id);

      if (memberError) throw memberError;

      const memberIds = (memberData || []).map(m => m.company_id);

      // 2. Check if user is an iroda_admin in accounty
      const { data: roleData } = await supabase
        .from('accounty_assignments')
        .select('role')
        .eq('accountant_user_id', user!.id);

      const isAccountyAdmin = roleData?.some((r: any) => r.role === 'iroda_admin');

      // 3. Get company IDs from accounty_assignments
      //    Admin: all assignments. Non-admin: only is_main_accountant=true
      let assignmentQuery = supabase
        .from('accounty_assignments')
        .select('company_id')
        .eq('accountant_user_id', user!.id);

      if (!isAccountyAdmin) {
        assignmentQuery = assignmentQuery.eq('is_main_accountant', true);
      }

      const { data: assignmentData, error: assignmentError } = await assignmentQuery;

      if (assignmentError && assignmentError.code !== 'PGRST116') {
        // Ignore "table not found" — it might not exist in all setups
        reportError({ type: 'db_query', severity: 'warning', component: 'CompanyContext', action: 'warn', message: 'accounty_assignments query error', error: assignmentError });
      }

      // 4. Merge & deduplicate company IDs
      const assignmentIds = (assignmentData || []).map(a => a.company_id);
      const allCompanyIds = [...new Set([...memberIds, ...assignmentIds])];

      if (allCompanyIds.length === 0) {
        return { companies: [] as Company[], eaisybillCompanyIds: [] as string[], eaisybooksCompanyIds: [] as string[] };
      }

      // 5. Fetch company details — try with vat_regime columns first,
      //    fall back to base columns if migration hasn't been deployed yet
      let data: any[] | null = null;
      let error: any = null;

      const result = await supabase
        .from('companies')
        .select('id, name, tax_number, address, description, primary_teaor, owner_id, share_token, vat_regime, vat_regime_effective_from, created_at, updated_at')
        .in('id', allCompanyIds)
        .order('created_at', { ascending: true });

      data = result.data;
      error = result.error;

      // Fallback: if optional columns (vat_regime, description, primary_teaor) don't exist yet, retry without them
      if (error && (error.message?.includes('vat_regime') || error.message?.includes('description') || error.message?.includes('primary_teaor') || error.code === '42703' || error.code === 'PGRST204')) {
        const fallback = await supabase
          .from('companies')
          .select('id, name, tax_number, address, owner_id, share_token, created_at, updated_at')
          .in('id', allCompanyIds)
          .order('created_at', { ascending: true });
        data = fallback.data;
        error = fallback.error;
      }

      if (error) throw error;
      return {
        companies: (data || []) as Company[],
        eaisybillCompanyIds: memberIds,
        eaisybooksCompanyIds: assignmentIds,
      };
    },

    enabled: !!user,
  });

  const companies = queryData?.companies || [];
  const eaisybillCompanyIds = queryData?.eaisybillCompanyIds || [];
  const eaisybooksCompanyIds = queryData?.eaisybooksCompanyIds || [];

  // True while we have a user but the companies query hasn't resolved yet.
  // This prevents premature "no company" decisions (onboarding redirect).
  const isInitialLoading = !!user && isPending;
  const isCompanyLoading = isInitialLoading || (!!user && isFetching && companies.length === 0);

  // When companies load (or change), restore the selected company
  useEffect(() => {
    if (companies.length === 0) {
      setSelectedCompanyState(null);
      return;
    }

    // If we already have a selectedCompany that still exists, keep it
    if (selectedCompany && companies.some(c => c.id === selectedCompany.id)) {
      // Update to the latest version of the company object (name/tax/vat_regime changes)
      const updated = companies.find(c => c.id === selectedCompany.id);
      if (updated && (updated.name !== selectedCompany.name || updated.tax_number !== selectedCompany.tax_number || updated.vat_regime !== selectedCompany.vat_regime)) {
        setSelectedCompanyState(updated);
      }
      return;
    }

    // Restore from localStorage or default to first
    const savedId = safeStorage.getItem(SELECTED_COMPANY_KEY);
    const saved = companies.find(c => c.id === savedId);

    if (saved) {
      setSelectedCompanyState(saved);
    } else {
      setSelectedCompanyState(companies[0]);
      safeStorage.setItem(SELECTED_COMPANY_KEY, companies[0].id);
    }
  }, [companies, user]);

  const setSelectedCompany = useCallback((company: Company | null) => {
    setSelectedCompanyState(company);
    if (company) {
      safeStorage.setItem(SELECTED_COMPANY_KEY, company.id);
    } else {
      safeStorage.removeItem(SELECTED_COMPANY_KEY);
    }
  }, []);

  const refreshCompanies = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.companies(user?.id || '') });
  }, [queryClient, user?.id]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        eaisybillCompanyIds,
        eaisybooksCompanyIds,
        selectedCompany,
        setSelectedCompany,
        loading: isCompanyLoading,
        isInitialLoading,
        refreshCompanies,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};
