/**
 * Centralized Lazy Library Loader for DocumentEngine.
 * Dynamically imports heavy client-side libraries (jsPDF, autoTable, XLSX)
 * only when an export is actually requested.
 */

let pdfLibsPromise: Promise<{ jsPDF: any; autoTable: any }> | null = null;
let xlsxPromise: Promise<any> | null = null;

/**
 * Lazy loads jsPDF and jspdf-autotable concurrently.
 * Memoizes the promise to prevent duplicate network/parsing requests.
 */
export function loadPdfLibraries(): Promise<{ jsPDF: any; autoTable: any }> {
  if (!pdfLibsPromise) {
    pdfLibsPromise = Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]).then(([jsPdfMod, autoTableMod]) => ({
      jsPDF: jsPdfMod.default || jsPdfMod.jsPDF || jsPdfMod,
      autoTable: autoTableMod.default || autoTableMod,
    }));
  }
  return pdfLibsPromise;
}

/**
 * Lazy loads the XLSX library.
 * Memoizes the promise.
 */
export function loadSpreadsheetLibraries(): Promise<any> {
  if (!xlsxPromise) {
    xlsxPromise = import('xlsx').then(mod => mod.default || mod);
  }
  return xlsxPromise;
}
