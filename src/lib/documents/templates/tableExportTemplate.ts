/**
 * Generic Table Export Template for DocumentEngine.
 * Handles analytical table exports across InvoicesPage, TransactionsPage,
 * GeneralLedger, Partners, etc. to PDF, CSV, and XLSX.
 */

import { DocumentDescriptor, TableColumn } from '../core/types';
import { DocumentEngine } from '../core/DocumentEngine';
import { toast } from '@/hooks/use-toast';

export interface GenericTableExportOptions {
  title: string;
  subtitle?: string;
  companyName?: string;
  period?: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
  columns?: TableColumn[];
  footers?: { label: string; value: string | number }[];
  orientation?: 'portrait' | 'landscape';
  filename?: string;
}

export function buildTableExportDescriptor(options: GenericTableExportOptions): DocumentDescriptor {
  return {
    type: 'table_export',
    metadata: {
      title: options.title,
      subtitle: options.subtitle,
      companyName: options.companyName,
      period: options.period,
      filename: options.filename || options.title.toLowerCase().replace(/[^a-z0-9_-]/gi, '_'),
      orientation: options.orientation || (options.headers.length > 6 ? 'landscape' : 'portrait'),
      themeColor: [15, 116, 103],
    },
    sections: [
      {
        type: 'table',
        headers: options.headers,
        rows: options.rows,
        footers: options.footers,
      },
    ],
  };
}

/**
 * Exports a generic table dataset to PDF, CSV, or XLSX format and triggers browser download with a toast.
 */
export async function exportTableDocument(
  options: GenericTableExportOptions,
  format: 'pdf' | 'csv' | 'xlsx',
  toastLabel?: string
): Promise<void> {
  const descriptor = buildTableExportDescriptor(options);
  const result = await DocumentEngine.export(descriptor, format);

  if (result.success) {
    const label = toastLabel || options.title;
    toast({ title: `${label} sikeresen exportálva (${format.toUpperCase()})` });
  }
}
