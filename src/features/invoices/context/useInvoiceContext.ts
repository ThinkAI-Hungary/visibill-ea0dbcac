import { useContext } from 'react';
import { InvoiceContext, type InvoiceContextValue } from './InvoiceContext';

export function useInvoiceContext(): InvoiceContextValue {
  const context = useContext(InvoiceContext);
  if (!context) {
    throw new Error('useInvoiceContext must be used within an InvoiceProvider');
  }
  return context;
}
