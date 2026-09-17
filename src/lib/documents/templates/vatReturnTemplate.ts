/**
 * ÁFA bevallás (2665 / 2565 / 2465) template for DocumentEngine.
 * Supports HTML print preview, PDF generation, and ÁNYK XML generation.
 */

import { DocumentDescriptor } from '../core/types';
import { DocumentEngine } from '../core/DocumentEngine';
import { buildVatReturnXml, XmlExportData } from '../../vatReturnXml';

export interface VatReturnData {
  companyName: string;
  companyTaxNumber: string;
  companyAddress: string;
  periodYear: number;
  periodMonth: number;
  frequency: string; // 'H' | 'N' | 'E'
  representativeName?: string;
  phone?: string;
  formRows?: { row_number: string; label: string; section: string; has_base: boolean; has_tax: boolean; is_summary: boolean; sort_order: number }[];
  lines: { row_number: string; base_amount_rounded: number | null; tax_amount_rounded: number | null; is_calculated?: boolean }[];
  mLines?: { partner_name: string; partner_tax_number: string; invoice_count: number; base_amount_rounded: number; tax_amount_rounded: number; tax_5_amount?: number; tax_18_amount?: number; tax_27_amount?: number; invoice_details?: any[] }[];
}

const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];

export function buildVatReturnDescriptor(data: VatReturnData): DocumentDescriptor {
  const periodLabel = data.frequency === 'H'
    ? `${data.periodYear}. ${MONTHS[data.periodMonth - 1]} hó`
    : data.frequency === 'N'
    ? `${data.periodYear}. ${Math.ceil(data.periodMonth / 3)}. negyedév`
    : `${data.periodYear}. év`;

  const formId = `${data.periodYear % 100}65`;

  // Build official ÁNYK XML using the standard AbevJava builder
  const xmlData: XmlExportData = {
    companyName: data.companyName,
    companyTaxNumber: data.companyTaxNumber,
    companyAddress: data.companyAddress,
    periodYear: data.periodYear,
    periodMonth: data.periodMonth,
    frequency: data.frequency,
    representativeName: data.representativeName,
    phone: data.phone,
    lines: data.lines,
    mLines: data.mLines || [],
  };
  const anykXml = buildVatReturnXml(xmlData);

  const tableRows = data.lines.map(l => [
    `${l.row_number}. sor`,
    l.base_amount_rounded != null ? `${new Intl.NumberFormat('hu-HU').format(l.base_amount_rounded)} E Ft` : '-',
    l.tax_amount_rounded != null ? `${new Intl.NumberFormat('hu-HU').format(l.tax_amount_rounded)} E Ft` : '-',
  ]);

  const monthStr = String(data.periodMonth).padStart(2, '0');
  const safeName = (data.companyName || 'Ceg')
    .replace(/\s+/g, '_')
    .replace(/[.,;:/\\?*|"<>!@#$%^&()+=~`{}[\]]/g, '')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '');

  return {
    type: 'vat_return',
    metadata: {
      title: `ÁFA BEVALLÁS (${formId})`,
      subtitle: `${periodLabel} — Adatok ezer forintban (E Ft)`,
      companyName: data.companyName,
      companyTaxNumber: data.companyTaxNumber,
      companyAddress: data.companyAddress,
      period: periodLabel,
      filename: `NAV_${formId}_${data.periodYear}_${monthStr}_${safeName || 'Ceg'}`,
      themeColor: [15, 116, 103],
    },
    sections: [
      {
        type: 'table',
        title: 'Bevallási sorok részletezése',
        headers: ['Sor száma', 'Adóalap (E Ft)', 'Fizetendő / Levonható adó (E Ft)'],
        rows: tableRows,
      },
    ],
    rawPayload: {
      customXml: anykXml,
      anykOptions: {
        formId: `${formId}A`,
        formVersion: '4.0',
        softwareName: 'Visibill / eaisyBooks',
      },
    },
  };
}

export async function exportVatReturnXml(data: VatReturnData): Promise<void> {
  const descriptor = buildVatReturnDescriptor(data);
  await DocumentEngine.export(descriptor, 'xml');
}

export async function exportVatReturnPdf(data: VatReturnData): Promise<void> {
  const descriptor = buildVatReturnDescriptor(data);
  DocumentEngine.previewInNewTab(descriptor);
}

