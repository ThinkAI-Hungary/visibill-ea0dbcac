/**
 * 2665 ÁFA bevallás template for DocumentEngine.
 * Supports HTML print preview, PDF generation, and ÁNYK XML generation.
 */

import { DocumentDescriptor } from '../core/types';
import { DocumentEngine } from '../core/DocumentEngine';
import { escapeXml, buildAnykEnvelope, buildXmlTag } from '../encoding/xmlSanitizer';
import { downloadString } from '../core/downloadHelper';

export interface VatReturnData {
  companyName: string;
  companyTaxNumber: string;
  companyAddress: string;
  periodYear: number;
  periodMonth: number;
  frequency: string; // 'H' | 'N' | 'E'
  formRows?: { row_number: string; label: string; section: string; has_base: boolean; has_tax: boolean; is_summary: boolean; sort_order: number }[];
  lines: { row_number: string; base_amount_rounded: number | null; tax_amount_rounded: number | null; is_calculated?: boolean }[];
  mLines?: { partner_name: string; partner_tax_number: string; invoice_count: number; base_amount_rounded: number; tax_amount_rounded: number; tax_5_amount?: number; tax_18_amount?: number; tax_27_amount?: number }[];
}

const MONTHS = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];

export function buildVatReturnDescriptor(data: VatReturnData): DocumentDescriptor {
  const periodLabel = data.frequency === 'H'
    ? `${data.periodYear}. ${MONTHS[data.periodMonth - 1]} hó`
    : data.frequency === 'N'
    ? `${data.periodYear}. ${Math.ceil(data.periodMonth / 3)}. negyedév`
    : `${data.periodYear}. év`;

  const lineMap = new Map(data.lines.map(l => [l.row_number, l]));

  // Build ÁNYK XML Payload
  const taxParts = (data.companyTaxNumber || '').split('-');
  const taxNum8 = taxParts[0] || '';
  const taxNumVat = taxParts[1] || '';
  const taxNumCounty = taxParts[2] || '';

  let periodFrom = '';
  let periodTo = '';
  if (data.frequency === 'H') {
    periodFrom = `${data.periodYear}-${String(data.periodMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(data.periodYear, data.periodMonth, 0).getDate();
    periodTo = `${data.periodYear}-${String(data.periodMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else if (data.frequency === 'N') {
    const startMonth = (data.periodMonth - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    periodFrom = `${data.periodYear}-${String(startMonth).padStart(2, '0')}-01`;
    const lastDay = new Date(data.periodYear, endMonth, 0).getDate();
    periodTo = `${data.periodYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  } else {
    periodFrom = `${data.periodYear}-01-01`;
    periodTo = `${data.periodYear}-12-31`;
  }

  const anykFields: Record<string, any> = {
    '01_adoszam_torzs': taxNum8,
    '01_adoszam_afa': taxNumVat,
    '01_adoszam_megye': taxNumCounty,
    '01_nev': data.companyName,
    '01_idoszak_tol': periodFrom,
    '01_idoszak_ig': periodTo,
    '01_gyakorisag': data.frequency,
  };

  data.lines.forEach(line => {
    if (line.base_amount_rounded != null) {
      anykFields[`sor_${line.row_number}_alap`] = line.base_amount_rounded;
    }
    if (line.tax_amount_rounded != null) {
      anykFields[`sor_${line.row_number}_ado`] = line.tax_amount_rounded;
    }
  });

  const tableRows = data.lines.map(l => [
    `${l.row_number}. sor`,
    l.base_amount_rounded != null ? `${new Intl.NumberFormat('hu-HU').format(l.base_amount_rounded)} E Ft` : '-',
    l.tax_amount_rounded != null ? `${new Intl.NumberFormat('hu-HU').format(l.tax_amount_rounded)} E Ft` : '-',
  ]);

  return {
    type: 'vat_return',
    metadata: {
      title: 'ÁFA BEVALLÁS (2665)',
      subtitle: `${periodLabel} — Adatok ezer forintban (E Ft)`,
      companyName: data.companyName,
      companyTaxNumber: data.companyTaxNumber,
      companyAddress: data.companyAddress,
      period: periodLabel,
      filename: `2665_afa_${data.periodYear}_${data.periodMonth}`,
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
      anykOptions: {
        formId: '2665',
        formVersion: '1.0',
        softwareName: 'Visibill / eaisyBooks',
      },
      fields: anykFields,
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
