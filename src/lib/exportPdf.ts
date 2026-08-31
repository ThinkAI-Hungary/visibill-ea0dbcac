/**
 * PDF export utility for Accounty pages (Facade).
 * Re-exports and delegates to the unified DocumentEngine under src/lib/documents/.
 */

import { DocumentEngine } from './documents/core/DocumentEngine';
import { PdfDocumentAdapter } from './documents/adapters/PdfDocumentAdapter';
import { buildTableExportDescriptor, GenericTableExportOptions } from './documents/templates/tableExportTemplate';
import { DocumentDescriptor } from './documents/core/types';

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  companyName?: string;
  period?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  footer?: { label: string; value: string | number };
  orientation?: 'portrait' | 'landscape';
}

export async function exportPdf(filename: string, options: PdfExportOptions): Promise<void> {
  const descriptor = buildTableExportDescriptor({
    title: options.title,
    subtitle: options.subtitle,
    companyName: options.companyName,
    period: options.period,
    headers: options.headers,
    rows: options.rows,
    footers: options.footer ? [options.footer] : undefined,
    orientation: options.orientation,
    filename,
  });

  await DocumentEngine.export(descriptor, 'pdf', filename);
}

export async function getPdfBlobUrl(options: PdfExportOptions): Promise<string> {
  const descriptor = buildTableExportDescriptor({
    title: options.title,
    subtitle: options.subtitle,
    companyName: options.companyName,
    period: options.period,
    headers: options.headers,
    rows: options.rows,
    footers: options.footer ? [options.footer] : undefined,
    orientation: options.orientation,
  });

  const blob = await PdfDocumentAdapter.renderToBlob(descriptor);
  return URL.createObjectURL(blob);
}

export async function exportReceiptPdf(
  filename: string,
  data: { title: string; fields: { label: string; value: string }[] }
): Promise<void> {
  const descriptor: DocumentDescriptor = {
    type: 'custom',
    metadata: {
      title: data.title,
      filename,
      themeColor: [59, 130, 246], // Blue
    },
    sections: [
      {
        type: 'key-value',
        items: data.fields.map(f => ({ label: f.label, value: f.value, highlight: true })),
        columnsCount: 2,
      },
    ],
  };

  await DocumentEngine.export(descriptor, 'pdf', filename);
}
