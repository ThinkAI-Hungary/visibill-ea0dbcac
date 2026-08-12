import { type CompanyInvoice } from '@/hooks/accounty/useAccountyClients';

/**
 * Exports the selected invoices in RLB60 CSV text import format.
 * Semicolon-delimited, UTF-8 BOM, standard Hungarian Chart of Accounts defaults.
 */
export function exportToRLB60(invoices: CompanyInvoice[]) {
  const bom = '\uFEFF';
  const headers = [
    'Bizonylatszám',
    'Partner név',
    'Dátum',
    'Teljesítés',
    'Esedékesség',
    'Irány',
    'Nettó érték',
    'ÁFA kulcs',
    'ÁFA érték',
    'Bruttó érték',
    'Pénznem',
    'Tartozik főkönyv (T)',
    'Követel főkönyv (K)'
  ].join(';');

  const rows = invoices.map(inv => {
    const net = inv.grossAmount - inv.vatAmount;
    const vatPercent = inv.grossAmount > 0 && inv.vatAmount > 0 
      ? Math.round((inv.vatAmount / net) * 100) 
      : 0;

    // Use dynamic glNumber from eaisybill template mapping if available
    const isExpense = inv.type === 'bejovo';
    const debitAccount = isExpense ? (inv.glNumber || '511') : '311'; // custom expense code vs domestic debtors
    const creditAccount = isExpense ? '454' : (inv.glNumber || '911'); // domestic suppliers vs custom revenue code

    const dateStr = inv.rawDate ? inv.rawDate.slice(0, 10) : '';

    return [
      inv.invoiceNumber,
      inv.partnerName,
      dateStr,
      dateStr, // Teljesítés default to date
      dateStr, // Esedékesség default to date
      inv.type === 'bejovo' ? 'BEJÖVŐ' : 'KIMENŐ',
      net.toFixed(2),
      `${vatPercent}%`,
      inv.vatAmount.toFixed(2),
      inv.grossAmount.toFixed(2),
      inv.currency,
      debitAccount,
      creditAccount
    ].join(';');
  });

  const content = bom + [headers, ...rows].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rlb60_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports the selected invoices in Kulcs-Soft structured XML format.
 */
export function exportToKulcsSoft(invoices: CompanyInvoice[]) {
  const xmlLines: string[] = [];
  xmlLines.push('<?xml version="1.0" encoding="utf-8"?>');
  xmlLines.push('<Szamlak>');

  invoices.forEach(inv => {
    const net = inv.grossAmount - inv.vatAmount;
    const vatPercent = inv.grossAmount > 0 && inv.vatAmount > 0 
      ? Math.round((inv.vatAmount / net) * 100) 
      : 0;

    const isExpense = inv.type === 'bejovo';
    const debitAccount = isExpense ? (inv.glNumber || '511') : '311';
    const creditAccount = isExpense ? '454' : (inv.glNumber || '911');
    const vatAccount = isExpense ? '466' : '467'; // Deductible vs Payable VAT
    const dateStr = inv.rawDate ? inv.rawDate.slice(0, 10) : '';

    xmlLines.push('  <Szamla>');
    xmlLines.push('    <Fejlec>');
    xmlLines.push(`      <Bizonylatszam>${escapeXml(inv.invoiceNumber)}</Bizonylatszam>`);
    xmlLines.push(`      <Partnernev>${escapeXml(inv.partnerName)}</Partnernev>`);
    xmlLines.push(`      <Kelt>${dateStr}</Kelt>`);
    xmlLines.push(`      <Teljesites>${dateStr}</Teljesites>`);
    xmlLines.push(`      <Esedekesseg>${dateStr}</Esedekesseg>`);
    xmlLines.push(`      <Irany>${isExpense ? 'BEJOVO' : 'KIMENO'}</Irany>`);
    xmlLines.push(`      <Deviza>${inv.currency}</Deviza>`);
    xmlLines.push(`      <Netto>${net.toFixed(2)}</Netto>`);
    xmlLines.push(`      <Afa>${inv.vatAmount.toFixed(2)}</Afa>`);
    xmlLines.push(`      <Brutto>${inv.grossAmount.toFixed(2)}</Brutto>`);
    xmlLines.push('    </Fejlec>');
    xmlLines.push('    <Tetelek>');
    xmlLines.push('      <Tetel>');
    xmlLines.push(`        <Megnevezes>${isExpense ? 'Vásárolt anyag/szolgáltatás' : 'Termékértékesítés/Szolgáltatás'}</Megnevezes>`);
    xmlLines.push(`        <Netto>${net.toFixed(2)}</Netto>`);
    xmlLines.push(`        <AfaKulcs>${vatPercent}</AfaKulcs>`);
    xmlLines.push(`        <Afa>${inv.vatAmount.toFixed(2)}</Afa>`);
    xmlLines.push(`        <Brutto>${inv.grossAmount.toFixed(2)}</Brutto>`);
    xmlLines.push(`        <FokonyvT>${debitAccount}</FokonyvT>`);
    xmlLines.push(`        <FokonyvK>${creditAccount}</FokonyvK>`);
    if (inv.vatAmount > 0) {
      xmlLines.push(`        <AfaFokonyv>${vatAccount}</AfaFokonyv>`);
    }
    xmlLines.push('      </Tetel>');
    xmlLines.push('    </Tetelek>');
    xmlLines.push('  </Szamla>');
  });

  xmlLines.push('</Szamlak>');

  const content = xmlLines.join('\r\n');
  const blob = new Blob([content], { type: 'application/xml;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kulcssoft_export_${new Date().toISOString().slice(0, 10)}.xml`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Exports the selected invoices in Novitax semicolon-separated CSV format.
 * Includes partner tax numbers, dates, vat rates, accounts, and amounts.
 */
export function exportToNovitax(invoices: CompanyInvoice[]) {
  const bom = '\uFEFF';
  const headers = [
    'Bizonylatszám',
    'Partner név',
    'Partner adószám',
    'Kelt',
    'Teljesítés',
    'Esedékesség',
    'Irány',
    'Nettó érték',
    'ÁFA kulcs',
    'ÁFA érték',
    'Bruttó érték',
    'Pénznem',
    'Tartozik főkönyv (T)',
    'Követel főkönyv (K)',
    'ÁFA főkönyv'
  ].join(';');

  const rows = invoices.map(inv => {
    const net = inv.grossAmount - inv.vatAmount;
    const vatPercent = inv.grossAmount > 0 && inv.vatAmount > 0 
      ? Math.round((inv.vatAmount / net) * 100) 
      : 0;

    const isExpense = inv.type === 'bejovo';
    const debitAccount = isExpense ? (inv.glNumber || '511') : '311';
    const creditAccount = isExpense ? '454' : (inv.glNumber || '911');
    const vatAccount = inv.vatAmount > 0 ? (isExpense ? '466' : '467') : '';

    const dateStr = inv.rawDate ? inv.rawDate.slice(0, 10) : '';

    return [
      inv.invoiceNumber,
      inv.partnerName,
      inv.partnerTaxNumber || '',
      dateStr,
      dateStr,
      dateStr,
      inv.type === 'bejovo' ? 'BEJÖVŐ' : 'KIMENŐ',
      net.toFixed(2),
      `${vatPercent}%`,
      inv.vatAmount.toFixed(2),
      inv.grossAmount.toFixed(2),
      inv.currency,
      debitAccount,
      creditAccount,
      vatAccount
    ].join(';');
  });

  const content = bom + [headers, ...rows].join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `novitax_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

