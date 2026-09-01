import React, { useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import InvoiceImageDialog from '@/components/InvoiceImageDialog';
import InvoiceFullEditDialog from '@/components/InvoiceFullEditDialog';
import { InvoiceItemsDialog } from '@/components/InvoiceItemsDialog';
import { InvoiceFilesDialog } from '@/components/invoices/InvoiceFilesDialog';
import { PdfExportBanner } from '@/components/invoices/PdfExportBanner';
import { PdfExportDialog } from '@/components/invoices/PdfExportDialog';
import { InvoiceDataExportDialog } from '@/components/invoices/InvoiceDataExportDialog';
import { BulkDeleteDialog } from './BulkDeleteDialog';
import { useInvoiceContext } from '../../context/useInvoiceContext';

export function InvoiceDialogManager() {
  const {
    activeTab,
    selectedCompany,
    categories,
    projects,
    imageDialogOpen,
    setImageDialogOpen,
    editDialogOpen,
    setEditDialogOpen,
    itemsDialogOpen,
    setItemsDialogOpen,
    submittedItemsDialogOpen,
    setSubmittedItemsDialogOpen,
    filesDialogOpen,
    setFilesDialogOpen,
    dataExportDialogOpen,
    setDataExportDialogOpen,
    dataExportFormat,
    dataExportLevel,
    exportableInvoices,
    selectedInvoiceIds,
    selectedSubmittedIds,
    isSubmittedTab,
    selectedInvoice,
    setSelectedInvoice,
    selectedNavInvoice,
    setSelectedNavInvoice,
    selectedSubmittedForItems,
    setSelectedSubmittedForItems,
    pdfExport,
    setInvoiceParam,
    handleDataExportConfirm,
    invalidateInvoiceData,
  } = useInvoiceContext();

  const [, setSearchParams] = useSearchParams();
  const dialogClosingRef = useRef(false);

  const handleCloseFiles = useCallback(
    (open: boolean) => {
      setFilesDialogOpen(open);
      if (!open) {
        dialogClosingRef.current = true;
        setTimeout(() => {
          setSearchParams(
            prev => {
              const next = new URLSearchParams(prev);
              next.delete('action');
              return next;
            },
            { replace: true }
          );
          setTimeout(() => {
            dialogClosingRef.current = false;
          }, 50);
        }, 300);
      }
    },
    [setFilesDialogOpen, setSearchParams]
  );

  return (
    <>
      {/* PDF Export Banner (rendered above card content in layout, or controlled here) */}
      <PdfExportDialog
        open={pdfExport.dialogOpen}
        onClose={pdfExport.closeDialog}
        onExport={pdfExport.startExport}
        isExporting={pdfExport.isExporting}
        isStarting={pdfExport.isStarting}
        initialDirection={activeTab === 'SUBMITTED_INBOUND' ? 'INBOUND' : 'OUTBOUND'}
      />

      {/* Interactive Data Export Dialog (CSV / XLSX / PDF) */}
      <InvoiceDataExportDialog
        open={dataExportDialogOpen}
        onClose={() => setDataExportDialogOpen(false)}
        invoices={exportableInvoices}
        initialSelectedIds={isSubmittedTab ? selectedSubmittedIds : selectedInvoiceIds}
        initialFormat={dataExportFormat}
        initialLevel={dataExportLevel}
        companyName={selectedCompany?.name}
        onExport={handleDataExportConfirm}
      />

      {/* Invoice Files Dialog */}
      <InvoiceFilesDialog open={filesDialogOpen} onOpenChange={handleCloseFiles} />

      {/* Invoice Image Preview Dialog */}
      <InvoiceImageDialog
        invoice={
          selectedInvoice
            ? {
                id: selectedInvoice.id,
                bizonylatsorszam: selectedInvoice.bizonylatsorszam || '',
                image_url: selectedInvoice.image_url,
                melleklet_url: selectedInvoice.melleklet_url,
                elado_nev: selectedInvoice.elado_nev,
                vevo_nev: selectedInvoice.vevo_nev,
              }
            : null
        }
        open={imageDialogOpen}
        onClose={() => {
          setImageDialogOpen(false);
          setSelectedInvoice(null);
          setInvoiceParam(null);
        }}
      />

      {/* Invoice Full Edit Dialog */}
      <InvoiceFullEditDialog
        invoice={selectedInvoice}
        categories={categories}
        projects={projects}
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedInvoice(null);
          setInvoiceParam(null);
        }}
        onSave={invalidateInvoiceData}
      />

      {/* NAV Invoice Items Dialog */}
      {(itemsDialogOpen || selectedNavInvoice) && (
        <InvoiceItemsDialog
          open={itemsDialogOpen}
          onOpenChange={(open) => {
            setItemsDialogOpen(open);
            if (!open) {
              dialogClosingRef.current = true;
              setTimeout(() => {
                setInvoiceParam(null);
                setSelectedNavInvoice(null);
                dialogClosingRef.current = false;
              }, 500);
            }
          }}
          invoiceId={selectedNavInvoice?.id || ''}
          invoiceNumber={selectedNavInvoice?.invoice_number || ''}
          currency={selectedNavInvoice?.currency || 'HUF'}
          source="nav"
          invoiceDate={selectedNavInvoice?.invoice_issue_date || undefined}
          supplierName={selectedNavInvoice?.supplier_name || undefined}
          projectId={selectedNavInvoice?.project_id || undefined}
          invoiceDirection={selectedNavInvoice?.invoice_direction || undefined}
        />
      )}

      {/* Submitted Invoice Items Dialog */}
      {(submittedItemsDialogOpen || selectedSubmittedForItems) && (
        <InvoiceItemsDialog
          open={submittedItemsDialogOpen}
          onOpenChange={(open) => {
            setSubmittedItemsDialogOpen(open);
            if (!open) {
              dialogClosingRef.current = true;
              setTimeout(() => {
                setInvoiceParam(null);
                setSelectedSubmittedForItems(null);
                dialogClosingRef.current = false;
              }, 500);
            }
          }}
          invoiceId={selectedSubmittedForItems?.id || ''}
          invoiceNumber={selectedSubmittedForItems?.bizonylatsorszam || ''}
          currency={selectedSubmittedForItems?.penznem || 'HUF'}
          source="submitted"
          invoiceDate={selectedSubmittedForItems?.kibocsatas_datuma || undefined}
          supplierName={selectedSubmittedForItems?.elado_nev || undefined}
          projectId={selectedSubmittedForItems?.project_id || undefined}
        />
      )}

      {/* Bulk Delete Dialog */}
      <BulkDeleteDialog />
    </>
  );
}
