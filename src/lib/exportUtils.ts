/**
 * Shared file export utilities.
 * Consolidates CSV/XLSX export logic used across TransactionsPage and InvoicesPage.
 * XLSX library is dynamically imported only when needed to reduce initial bundle size.
 */
import { toast } from '@/hooks/use-toast';

export async function exportToFile(
  headers: string[],
  data: string[][],
  exportFormat: 'csv' | 'xlsx',
  filename: string,
  toastLabel?: string
) {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const label = toastLabel || filename;

  if (exportFormat === 'csv') {
    const csvContent = [
      headers.join(','),
      ...data.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({ title: `${label} exportálva CSV formátumban` });
  } else {
    // Dynamic import – XLSX is only loaded when user actually exports to XLSX
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, label.slice(0, 31));
    XLSX.writeFile(workbook, `${filename}_${timestamp}.xlsx`);

    toast({ title: `${label} exportálva XLSX formátumban` });
  }
}
