import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { PdfExportBanner } from '@/components/invoices/PdfExportBanner';
import { InvoiceHeader } from './components/header/InvoiceHeader';
import { InvoiceTabSelector } from './components/filters/InvoiceTabSelector';
import { InvoiceKpiCards } from './components/header/InvoiceKpiCards';
import { InvoiceTableContainer } from './components/table/InvoiceTableContainer';
import { InvoiceBulkActionsBar } from './components/actions/InvoiceBulkActionsBar';
import { InvoiceDialogManager } from './components/dialogs/InvoiceDialogManager';
import { useInvoiceContext } from './context/useInvoiceContext';
import type { InvoiceTab } from './types';

export function InvoicesFeature() {
  const { activeTab, setActiveTab, pdfExport } = useInvoiceContext();

  return (
    <div className="h-full bg-background page-animate">
      <main className="w-full max-w-none px-4 py-4">
        <Card>
          <InvoiceHeader />

          {/* PDF Export Banner — between header and content */}
          {pdfExport.showBanner && pdfExport.activeJob && (
            <div className="px-6 pb-2">
              <PdfExportBanner
                job={pdfExport.activeJob}
                progress={pdfExport.progress}
                onCancel={pdfExport.cancelExport}
                onDismiss={pdfExport.dismissBanner}
                onRetryDownload={pdfExport.retryDownload}
              />
            </div>
          )}

          <CardContent className="space-y-6">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InvoiceTab)}>
              <InvoiceTabSelector />
              <InvoiceKpiCards />
              <InvoiceTableContainer />
            </Tabs>
          </CardContent>
        </Card>
      </main>

      {/* Floating Bulk Actions Bar */}
      <InvoiceBulkActionsBar />

      {/* Modal & Dialog Manager */}
      <InvoiceDialogManager />
    </div>
  );
}
