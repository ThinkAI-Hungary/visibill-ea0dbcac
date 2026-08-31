/**
 * Annual Report PDF generator (Facade).
 * Re-exports and delegates to the unified DocumentEngine under src/lib/documents/.
 */

export {
  type AnnualReportData,
  buildAnnualReportDescriptor,
  generateAnnualReportPdf,
  generateAnnualReportPreviewUrl,
} from './documents/templates/annualReportTemplate';
