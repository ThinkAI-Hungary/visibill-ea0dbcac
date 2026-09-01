/**
 * ÁFA bevallás (2665 / 2565 / 2465) template for DocumentEngine.
 * Supports HTML print preview, PDF generation, and ÁNYK XML generation.
 */

import { DocumentDescriptor } from '../core/types';
import { DocumentEngine } from '../core/DocumentEngine';

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

  const formId = `${data.periodYear % 100}65`;

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
    '01_0001_adoszam_torzs': taxNum8,
    '01_0002_adoszam_afa': taxNumVat,
    '01_0003_adoszam_megye': taxNumCounty,
    '01_0004_adoszam_teljes': data.companyTaxNumber,
    '01_0006_adozo_nev': data.companyName,
    '01_0007_szekhely_cim': data.companyAddress,
    '01_0010_adoev': data.periodYear,
    '01_0011_idoszak_tol': periodFrom,
    '01_0012_idoszak_ig': periodTo,
    '01_0013_gyakorisag': data.frequency,
  };

  data.lines.forEach(line => {
    if (line.base_amount_rounded != null) {
      anykFields[`sor_${line.row_number}_alap`] = line.base_amount_rounded;
    }
    if (line.tax_amount_rounded != null) {
      anykFields[`sor_${line.row_number}_ado`] = line.tax_amount_rounded;
    }
  });

  if (data.mLines && data.mLines.length > 0) {
    anykFields['M_partner_osszesen'] = data.mLines.length;
    data.mLines.forEach((m, idx) => {
      const pIdx = idx + 1;
      anykFields[`M_${pIdx}_0001_adoszam`] = m.partner_tax_number;
      anykFields[`M_${pIdx}_0002_nev`] = m.partner_name;
      anykFields[`M_${pIdx}_0003_szamlak_szama`] = m.invoice_count;
      anykFields[`M_${pIdx}_0004_alap`] = m.base_amount_rounded;
      anykFields[`M_${pIdx}_0005_afa`] = m.tax_amount_rounded;
      if (m.tax_5_amount != null) anykFields[`M_${pIdx}_0006_afa_5`] = m.tax_5_amount;
      if (m.tax_18_amount != null) anykFields[`M_${pIdx}_0007_afa_18`] = m.tax_18_amount;
      if (m.tax_27_amount != null) anykFields[`M_${pIdx}_0008_afa_27`] = m.tax_27_amount;
    });
  }

  const currentDate = new Date().toISOString().substring(0, 10);
  anykFields['03_0001_nyilatkozat_adat_valos'] = 1;
  anykFields['03_0002_kelt_hely'] = 'Budapest';
  anykFields['03_0003_kelt_datum'] = currentDate;

  const tableRows = data.lines.map(l => [
    `${l.row_number}. sor`,
    l.base_amount_rounded != null ? `${new Intl.NumberFormat('hu-HU').format(l.base_amount_rounded)} E Ft` : '-',
    l.tax_amount_rounded != null ? `${new Intl.NumberFormat('hu-HU').format(l.tax_amount_rounded)} E Ft` : '-',
  ]);

  const monthStr = String(data.periodMonth).padStart(2, '0');
  const safeName = (data.companyName || 'Ceg').replace(/\s+/g, '_');

  return {
    type: 'vat_return',
    metadata: {
      title: `ÁFA BEVALLÁS (${formId})`,
      subtitle: `${periodLabel} — Adatok ezer forintban (E Ft)`,
      companyName: data.companyName,
      companyTaxNumber: data.companyTaxNumber,
      companyAddress: data.companyAddress,
      period: periodLabel,
      filename: `NAV_${formId}_${data.periodYear}_${monthStr}_${safeName}`,
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
        formId,
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
