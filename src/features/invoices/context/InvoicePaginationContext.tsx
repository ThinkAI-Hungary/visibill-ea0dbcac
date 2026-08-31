import React, { createContext, useContext } from 'react';
import type { NavInvoice, SubmittedInvoice } from '../types';

export interface InvoicePaginationContextValue {
  navPageSize: number;
  setNavPageSize: (size: number) => void;
  submittedPageSize: number;
  setSubmittedPageSize: (size: number) => void;
  navCurrentPage: number;
  setNavCurrentPage: (page: number) => void;
  submittedCurrentPage: number;
  setSubmittedCurrentPage: (page: number) => void;
  navTotalPages: number;
  submittedTotalPages: number;
  filteredAndSortedNavInvoices: NavInvoice[];
  filteredAndSortedSubmittedInvoices: SubmittedInvoice[];
  paginatedNavInvoices: NavInvoice[];
  paginatedSubmittedInvoices: SubmittedInvoice[];
  navTotalCount: number;
  submittedTotalCount: number;
}

export const InvoicePaginationContext = createContext<InvoicePaginationContextValue | null>(null);

export function useInvoicePaginationContext(): InvoicePaginationContextValue {
  const context = useContext(InvoicePaginationContext);
  if (!context) {
    throw new Error(
      'useInvoicePaginationContext must be used within an InvoicePaginationProvider or InvoiceProvider'
    );
  }
  return context;
}

export function InvoicePaginationProvider({
  value,
  children,
}: {
  value: InvoicePaginationContextValue;
  children: React.ReactNode;
}) {
  return (
    <InvoicePaginationContext.Provider value={value}>
      {children}
    </InvoicePaginationContext.Provider>
  );
}
