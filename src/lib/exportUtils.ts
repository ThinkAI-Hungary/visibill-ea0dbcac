/**
 * Shared file export utilities (Facade).
 * Re-exports and delegates to the unified DocumentEngine under src/lib/documents/.
 */
import { exportTableDocument, exportMultiTableDocument, type MultiTableExportOptions } from './documents/templates/tableExportTemplate';

export { exportMultiTableDocument };
export type { MultiTableExportOptions };

export async function exportToFile(
  headers: string[],
  data: (string | number | boolean | null | undefined)[][],
  exportFormat: 'csv' | 'xlsx' | 'pdf',
  filename: string,
  toastLabel?: string
): Promise<void> {
  await exportTableDocument(
    {
      title: toastLabel || filename,
      headers,
      rows: data,
      filename,
    },
    exportFormat,
    toastLabel
  );
}
