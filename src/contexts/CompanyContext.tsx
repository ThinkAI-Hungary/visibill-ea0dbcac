import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

export interface Company {
  id: string;
  name: string;
  tax_number: string | null;
  address: string | null;
  owner_id: string;
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

const SELECTED_COMPANY_KEY = 'selectedCompanyId';

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompanyState] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = async () => {
    if (!user) {
      setCompanies([]);
      setSelectedCompanyState(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const fetchedCompanies = data || [];
      setCompanies(fetchedCompanies);

      // Restore selected company from localStorage or default to first
      const savedCompanyId = localStorage.getItem(SELECTED_COMPANY_KEY);
      const savedCompany = fetchedCompanies.find(c => c.id === savedCompanyId);
      
      if (savedCompany) {
        setSelectedCompanyState(savedCompany);
      } else if (fetchedCompanies.length > 0) {
        setSelectedCompanyState(fetchedCompanies[0]);
        localStorage.setItem(SELECTED_COMPANY_KEY, fetchedCompanies[0].id);
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const setSelectedCompany = (company: Company | null) => {
    setSelectedCompanyState(company);
    if (company) {
      localStorage.setItem(SELECTED_COMPANY_KEY, company.id);
    } else {
      localStorage.removeItem(SELECTED_COMPANY_KEY);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, [user]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompany,
        setSelectedCompany,
        loading,
        refreshCompanies: fetchCompanies,
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
