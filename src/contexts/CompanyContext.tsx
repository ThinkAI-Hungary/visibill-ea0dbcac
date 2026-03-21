import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { STORAGE_KEYS } from '@/lib/constants';
import { queryKeys } from '@/lib/queryKeys';

export interface Company {
  id: string;
  name: string;
  tax_number: string | null;
  address: string | null;
  owner_id: string;
  share_token?: string | null;
  created_at: string;
  updated_at: string;
}

interface CompanyContextType {
  companies: Company[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  loading: boolean;
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

  const { data: companies = [], isLoading } = useQuery({
    queryKey: queryKeys.companies(user?.id || ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, tax_number, address, owner_id, share_token, created_at, updated_at')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as Company[];
    },
    enabled: !!user,
  });

  // When companies load (or change), restore the selected company
  useEffect(() => {
    if (companies.length === 0) {
      if (!user) setSelectedCompanyState(null);
      return;
    }

    // If we already have a selectedCompany that still exists, keep it
    if (selectedCompany && companies.some(c => c.id === selectedCompany.id)) {
      // Update to the latest version of the company object (name/tax changes)
      const updated = companies.find(c => c.id === selectedCompany.id);
      if (updated && (updated.name !== selectedCompany.name || updated.tax_number !== selectedCompany.tax_number)) {
        setSelectedCompanyState(updated);
      }
      return;
    }

    // Restore from localStorage or default to first
    const savedId = localStorage.getItem(SELECTED_COMPANY_KEY);
    const saved = companies.find(c => c.id === savedId);

    if (saved) {
      setSelectedCompanyState(saved);
    } else {
      setSelectedCompanyState(companies[0]);
      localStorage.setItem(SELECTED_COMPANY_KEY, companies[0].id);
    }
  }, [companies, user]);

  const setSelectedCompany = useCallback((company: Company | null) => {
    setSelectedCompanyState(company);
    if (company) {
      localStorage.setItem(SELECTED_COMPANY_KEY, company.id);
    } else {
      localStorage.removeItem(SELECTED_COMPANY_KEY);
    }
  }, []);

  const refreshCompanies = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.companies(user?.id || '') });
  }, [queryClient, user?.id]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompany,
        setSelectedCompany,
        loading: isLoading,
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
