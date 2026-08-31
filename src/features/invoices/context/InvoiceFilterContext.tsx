import React, { createContext, useContext } from 'react';
import type { InvoiceFilters, InvoiceKpiSummary, KpiFilterType } from '../types';

export interface InvoiceFilterContextValue {
  filters: InvoiceFilters;
  setFilters: React.Dispatch<React.SetStateAction<InvoiceFilters>>;
  clearFilters: () => void;
  hasStandardFilters: boolean;
  hasAnyActiveFilter: boolean;
  clearAllFilters: () => void;
  kpiFilter: KpiFilterType;
  setKpiFilter: (kpi: KpiFilterType) => void;
  toggleKpiFilter: (kpi: KpiFilterType) => void;
  invoiceKpis: InvoiceKpiSummary | null;
  isKpisLoading: boolean;
  sortField: string;
  sortDirection: 'asc' | 'desc';
  handleSort: (field: string) => void;
}

export const InvoiceFilterContext = createContext<InvoiceFilterContextValue | null>(null);

export function useInvoiceFilterContext(): InvoiceFilterContextValue {
  const context = useContext(InvoiceFilterContext);
  if (!context) {
    throw new Error('useInvoiceFilterContext must be used within an InvoiceFilterProvider or InvoiceProvider');
  }
  return context;
}

export function InvoiceFilterProvider({
  value,
  children,
}: {
  value: InvoiceFilterContextValue;
  children: React.ReactNode;
}) {
  return (
    <InvoiceFilterContext.Provider value={value}>
      {children}
    </InvoiceFilterContext.Provider>
  );
}
