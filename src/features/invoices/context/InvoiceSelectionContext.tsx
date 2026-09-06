import React, { createContext, useContext } from 'react';

export interface InvoiceSelectionContextValue {
  selectedInvoiceIds: Set<string>;
  setSelectedInvoiceIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedSubmittedIds: Set<string>;
  setSelectedSubmittedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  activeSelection: Set<string>;
  activeSetSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleSelectAll: () => void;
  toggleSelectRow: (id: string) => void;
  isRowSelected: (id: string) => boolean;
  isAllSelected: boolean;
  clearSelection: () => void;

  expandedRowIds: Set<string>;
  setExpandedRowIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleRowExpanded: (id: string) => void;
  expandAllRows: (ids: string[]) => void;
  collapseAllRows: () => void;
  isAllExpanded: boolean;
}

export const InvoiceSelectionContext = createContext<InvoiceSelectionContextValue | null>(null);

export function useInvoiceSelectionContext(): InvoiceSelectionContextValue {
  const context = useContext(InvoiceSelectionContext);
  if (!context) {
    throw new Error(
      'useInvoiceSelectionContext must be used within an InvoiceSelectionProvider or InvoiceProvider'
    );
  }
  return context;
}

export function InvoiceSelectionProvider({
  value,
  children,
}: {
  value: InvoiceSelectionContextValue;
  children: React.ReactNode;
}) {
  return (
    <InvoiceSelectionContext.Provider value={value}>
      {children}
    </InvoiceSelectionContext.Provider>
  );
}
