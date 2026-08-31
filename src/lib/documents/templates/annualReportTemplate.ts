/**
 * Annual Report (Éves beszámoló) template for DocumentEngine.
 */

import { DocumentDescriptor } from '../core/types';
import { DocumentEngine } from '../core/DocumentEngine';
import { formatHungarianNumber } from '../encoding/hungarianEncoding';
import { escapeXml } from '../encoding/xmlSanitizer';

export interface AnnualReportData {
  companyName: string;
  companyAddress?: string;
  companyTaxNumber?: string;
  fiscalYear: number;
  representativeName: string;
  representativeRole: string;
  reportDate: string;
  frozenBsData: any[];
  frozenPnlData: any[];
  notesSections: { section_key: string; text: string; title?: string; is_custom?: boolean }[];
  notesTemplates: { section_key: string; section_title: string; default_text: string }[];
  netIncome: number;
  dividendAmount: number;
  retainedEarnings: number;
  dividendResolutionDate: string;
  assetMovement?: { total: number; active: number; disposed: number; totalAcquisition: number; activeAcquisition: number };
  salaryMetrics?: { headcount: number; totalWages: number; totalContrib: number; total: number };
  equityRows?: any[];
}

export function buildAnnualReportDescriptor(data: AnnualReportData): DocumentDescriptor {
  const bsRows = (data.frozenBsData || []).map(r => [
    r.row_code || '',
    r.name || '',
    formatHungarianNumber(Math.round((Number(r.prior_year_balance) || 0) / 1000)),
    formatHungarianNumber(Math.round((Number(r.current_balance) || 0) / 1000)),
  ]);

  const pnlRows = (data.frozenPnlData || []).map(r => [
    r.row_code || '',
    r.name || '',
    formatHungarianNumber(Math.round((Number(r.prior_year_balance) || 0) / 1000)),
    formatHungarianNumber(Math.round((Number(r.current_balance) || 0) / 1000)),
  ]);

  return {
    type: 'annual_report',
    metadata: {
      title: `ÉVES BESZÁMOLÓ (${data.fiscalYear}. üzleti év)`,
      subtitle: `${data.companyName} — Adatok ezer forintban (E Ft)`,
      companyName: data.companyName,
      companyTaxNumber: data.companyTaxNumber,
      companyAddress: data.companyAddress,
      generatedAt: data.reportDate,
      author: `${data.representativeName} (${data.representativeRole})`,
      filename: `beszamolo_${data.fiscalYear}_${data.companyName.replace(/[^a-z0-9]/gi, '_')}`,
      themeColor: [15, 116, 103],
    },
    sections: [
      {
        type: 'table',
        title: '1. MÉRLEG',
        headers: ['Sor', 'Megnevezés', 'Előző év (E Ft)', 'Tárgyév (E Ft)'],
        rows: bsRows,
      },
      {
        type: 'table',
        title: '2. EREDMÉNYKIMUTATÁS',
        headers: ['Sor', 'Megnevezés', 'Előző év (E Ft)', 'Tárgyév (E Ft)'],
        rows: pnlRows,
      },
      {
        type: 'text',
        title: '3. VEZETŐI ZÁRADÉK ÉS ALÁÍRÁS',
        style: 'signature',
        content: `Készítette: ${data.representativeName} (${data.representativeRole})\nKelt: ${data.reportDate}\nAláírás: ___________________________`,
      },
    ],
  };
}

export function generateAnnualReportPdf(data: AnnualReportData): void {
  const descriptor = buildAnnualReportDescriptor(data);
  DocumentEngine.previewInNewTab(descriptor);
}

export function generateAnnualReportPreviewUrl(data: AnnualReportData): string {
  const descriptor = buildAnnualReportDescriptor(data);
  return DocumentEngine.createPreviewUrl(descriptor);
}
