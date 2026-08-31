/**
 * Public barrel export for the Unified DocumentEngine.
 */

// Core
export * from './core/types';
export * from './core/DocumentEngine';
export * from './core/libraryLoader';
export * from './core/downloadHelper';

// Encoding & XML
export * from './encoding/hungarianEncoding';
export * from './encoding/xmlSanitizer';

// Adapters
export * from './adapters/PdfDocumentAdapter';
export * from './adapters/XmlDocumentAdapter';
export * from './adapters/SpreadsheetAdapter';
export * from './adapters/HtmlPreviewAdapter';

// Templates
export * from './templates/payslipTemplate';
export * from './templates/cashReceiptTemplate';
export * from './templates/payrollReportsTemplate';
export * from './templates/vatReturnTemplate';
export * from './templates/annualReportTemplate';
export * from './templates/tableExportTemplate';
