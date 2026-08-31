import React, { useEffect } from 'react';
import { InvoiceProvider, InvoicesFeature } from '@/features/invoices';

const InvoicesPage: React.FC = () => {
  // Always scroll to the top of the page when navigating to InvoicesPage
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  return (
    <InvoiceProvider>
      <InvoicesFeature />
    </InvoiceProvider>
  );
};

export default InvoicesPage;
