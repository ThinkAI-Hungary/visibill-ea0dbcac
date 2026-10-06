import { MLine, VatFrequency } from '../types';
import {
  resolveCorrectionDetails,
  detectCorrectionType,
  RawInvoiceCandidate,
  ResolvedCorrectionDetails,
} from './vatCorrectionResolver';

export interface Nav65M02RowItem {
  rowNumber: number; // 1..36
  invoiceNumber: string;
  fulfillmentDate: string; // YYYYMMDD
  fulfillmentDateFormatted: string; // YYYY.MM.DD
  baseAmountHuf: number;
  taxAmountHuf: number;
  vat5Huf: number;
  vat18Huf: number;
  vat27Huf: number;
  proRataHuf: number;
  isAdvanceDiff: boolean; // Előleg különbözet jelölése ('X')
}

export interface Nav65M02PageData {
  pageNumber: number; // 1-indexed
  totalPages: number;
  items: Nav65M02RowItem[];
  pageBaseTotalHuf: number;
  pageTaxTotalHuf: number;
  pageVat5TotalHuf: number;
  pageVat18TotalHuf: number;
  pageVat27TotalHuf: number;
  pageProRataTotalHuf: number;
}

export interface Nav65M02KRowItem {
  rowNumber: number; // 1..36
  modInvoiceNumber: string;
  rowType: 'E' | 'KT';
  originalInvoiceNumber: string;
  issueDate: string; // YYYYMMDD
  issueDateFormatted: string; // YYYY.MM.DD
  fulfillmentDate: string; // YYYYMMDD
  fulfillmentDateFormatted: string; // YYYY.MM.DD
  baseAmountHuf: number;
  taxAmountHuf: number;
  vat5Huf: number;
  vat18Huf: number;
  vat27Huf: number;
  proRataHuf: number;
  isStorno: boolean;
}

export interface Nav65M02KPageData {
  pageNumber: number; // 1-indexed
  totalPages: number;
  items: Nav65M02KRowItem[]; // Up to 36 rows (18 pairs of E and KT)
  pageBaseTotalHuf: number;
  pageTaxTotalHuf: number;
  pageVat5TotalHuf: number;
  pageVat18TotalHuf: number;
  pageVat27TotalHuf: number;
  pageProRataTotalHuf: number;
}

export interface Nav65MFolapSummaryRow {
  invoiceCount: number;
  baseEft: number;
  taxEft: number;
  vat5Eft: number;
  vat18Eft: number;
  vat27Eft: number;
  proRataEft: number;
}

export interface Nav65MPartnerSheetData {
  partnerId: string;
  partnerName: string;
  partnerTaxNumber: string;
  partnerTax8: string;
  companyName: string;
  companyTaxNumber: string;
  companyTax8: string;
  companyVatCode: string;
  companyCountyCode: string;
  periodYear: number;
  periodMonth: number;
  frequency: VatFrequency | string;
  periodFrom: string; // YYYY.MM.DD
  periodTo: string;   // YYYY.MM.DD
  periodFromYear: string;
  periodFromMonth: string;
  periodFromDay: string;
  periodToYear: string;
  periodToMonth: string;
  periodToDay: string;

  // 2665M Főlap adatok (eFt)
  folap: {
    row04: Nav65MFolapSummaryRow; // Normál számlák
    row05: Nav65MFolapSummaryRow; // Korrekciós számlák
    row07: Nav65MFolapSummaryRow; // Összesen (04 + 05)
  };

  // 2665M-02 alapszámlák lapjai
  normalPages: Nav65M02PageData[];

  // 2665M-02-K korrekciós lapok
  correctionPages: Nav65M02KPageData[];

  // Összes nyomtatandó A4-es oldal száma ehhez a partnerhez
  totalSheetsCount: number;
}

/**
 * Calculates period boundary dates based on year, month, and frequency.
 */
export function getPeriodDates(
  year: number,
  month: number,
  frequency: VatFrequency | string
): {
  periodFrom: string;
  periodTo: string;
  fromYear: string;
  fromMonth: string;
  fromDay: string;
  toYear: string;
  toMonth: string;
  toDay: string;
} {
  const yStr = String(year);
  let fMonth = '01';
  let tMonth = '12';
  let fDay = '01';
  let tDay = '31';

  if (frequency === 'H') {
    const mStr = String(month).padStart(2, '0');
    fMonth = mStr;
    tMonth = mStr;
    fDay = '01';
    const lastDay = new Date(year, month, 0).getDate();
    tDay = String(lastDay).padStart(2, '0');
  } else if (frequency === 'N') {
    const startM = (month - 1) * 3 + 1;
    const endM = startM + 2;
    fMonth = String(startM).padStart(2, '0');
    tMonth = String(endM).padStart(2, '0');
    fDay = '01';
    const lastDay = new Date(year, endM, 0).getDate();
    tDay = String(lastDay).padStart(2, '0');
  }

  return {
    periodFrom: `${yStr}.${fMonth}.${fDay}`,
    periodTo: `${yStr}.${tMonth}.${tDay}`,
    fromYear: yStr,
    fromMonth: fMonth,
    fromDay: fDay,
    toYear: yStr,
    toMonth: tMonth,
    toDay: tDay,
  };
}

/**
 * Formats a raw date string into YYYYMMDD and YYYY.MM.DD
 */
function cleanDate(rawDate?: string | null, fallbackDate = '20260101'): { raw: string; formatted: string } {
  if (!rawDate) return { raw: fallbackDate, formatted: `${fallbackDate.slice(0, 4)}.${fallbackDate.slice(4, 6)}.${fallbackDate.slice(6, 8)}` };
  const digits = String(rawDate).replace(/\D/g, '');
  if (digits.length >= 8) {
    const ymd = digits.slice(0, 8);
    return {
      raw: ymd,
      formatted: `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`,
    };
  }
  return { raw: fallbackDate, formatted: fallbackDate };
}

/**
 * Generates the complete, authentic NAV 2665M partner dataset:
 * - 2665M Főlap summary
 * - 2665M-02 itemized pages (36 rows / page)
 * - 2665M-02-K correction pages (18 pairs = 36 rows / page)
 */
export function buildNav65MPartnerSheets(
  partner: MLine,
  selectedCompany: any,
  year: number,
  month: number,
  frequency: VatFrequency | string,
  rawInvoices: any[] = []
): Nav65MPartnerSheetData {
  const dates = getPeriodDates(year, month, frequency);

  // Normalize partner tax number (clean 8-digit base)
  const rawPartnerTax = partner.partner_tax_number || '';
  const partnerTaxClean = rawPartnerTax.replace(/\D/g, '');
  const partnerTax8 = partnerTaxClean.slice(0, 8);

  // Normalize company tax number
  const rawCompTax = selectedCompany?.tax_number || '';
  const compTaxClean = rawCompTax.replace(/\D/g, '');
  const companyTax8 = compTaxClean.slice(0, 8) || '00000000';
  const companyVatCode = compTaxClean.slice(8, 9) || '2';
  const companyCountyCode = compTaxClean.slice(9, 11) || '08';

  // Gather raw candidate invoices for this partner
  const candidates: RawInvoiceCandidate[] =
    rawInvoices.length > 0
      ? rawInvoices
      : Array.isArray((partner as any).invoice_details) && (partner as any).invoice_details.length > 0
      ? (partner as any).invoice_details
      : [];

  const normalInvoicesList: Nav65M02RowItem[] = [];
  const correctionPairsList: { eRow: Nav65M02KRowItem; ktRow: Nav65M02KRowItem }[] = [];

  // If we have detailed invoices, resolve them one by one
  if (candidates.length > 0) {
    candidates.forEach((cand) => {
      const resolved = resolveCorrectionDetails(cand, candidates);
      const invNum = cand.invoice_number || cand.bizonylatsorszam || 'SZAMLA-01';
      const fulfillment = cleanDate(cand.invoice_delivery_date || cand.teljesites_datuma || cand.delivery_date, dates.fromYear + dates.fromMonth + dates.fromDay);
      const issue = cleanDate(cand.invoice_issue_date || cand.kibocsatas_datuma || cand.issue_date, dates.fromYear + dates.fromMonth + dates.fromDay);

      const rawNet = Number(cand.invoice_net_amount ?? cand.adoalap_osszesen ?? cand.net ?? cand.net_amount ?? 0);
      const rawVat = Number(cand.invoice_vat_amount ?? cand.afa_osszeg_osszesen ?? cand.vat ?? cand.vat_amount ?? 0);

      const net = Math.round(rawNet);
      const vat = Math.round(rawVat);
      const absNet = Math.abs(net);
      const absVat = Math.abs(vat);
      const rate = absNet > 0 && absVat > 0 ? Math.round((absVat / absNet) * 100) : 27;

      if (!resolved.isCorrection) {
        // Normal invoice for 2665M-02
        normalInvoicesList.push({
          rowNumber: 0, // Will be indexed per page
          invoiceNumber: invNum,
          fulfillmentDate: fulfillment.raw,
          fulfillmentDateFormatted: fulfillment.formatted,
          baseAmountHuf: net,
          taxAmountHuf: vat,
          vat5Huf: rate === 5 ? vat : 0,
          vat18Huf: rate === 18 ? vat : 0,
          vat27Huf: rate === 27 || (rate !== 5 && rate !== 18) ? vat : 0,
          proRataHuf: 0,
          isAdvanceDiff: Boolean(cand.elolegszamla_hivatkozas),
        });
      } else {
        // Correction/storno invoice for 2665M-02-K
        const origNum = resolved.originalInvoiceNumber || cand.original_invoice_number || 'KORÁBBI SZÁMLA';
        const origFulfillment = cleanDate(resolved.originalFulfillmentDate, fulfillment.raw);
        const origIssue = cleanDate(resolved.originalIssueDate, issue.raw);

        const origNet = Math.abs(Math.round(resolved.originalNet || net));
        const origVat = Math.abs(Math.round(resolved.originalVat || vat));
        const origRate = origNet > 0 && origVat > 0 ? Math.round((origVat / origNet) * 100) : 27;

        const corrNet = Math.round(resolved.correctionNet);
        const corrVat = Math.round(resolved.correctionVat);
        const corrRate = Math.abs(corrNet) > 0 && Math.abs(corrVat) > 0 ? Math.round((Math.abs(corrVat) / Math.abs(corrNet)) * 100) : 27;

        const isStorno = resolved.corrType === 'Sztornó' || corrNet < 0;

        correctionPairsList.push({
          eRow: {
            rowNumber: 0,
            modInvoiceNumber: invNum,
            rowType: 'E',
            originalInvoiceNumber: origNum,
            issueDate: origIssue.raw,
            issueDateFormatted: origIssue.formatted,
            fulfillmentDate: origFulfillment.raw,
            fulfillmentDateFormatted: origFulfillment.formatted,
            baseAmountHuf: origNet,
            taxAmountHuf: origVat,
            vat5Huf: origRate === 5 ? origVat : 0,
            vat18Huf: origRate === 18 ? origVat : 0,
            vat27Huf: origRate === 27 || (origRate !== 5 && origRate !== 18) ? origVat : 0,
            proRataHuf: 0,
            isStorno: false,
          },
          ktRow: {
            rowNumber: 0,
            modInvoiceNumber: invNum,
            rowType: 'KT',
            originalInvoiceNumber: origNum,
            issueDate: issue.raw,
            issueDateFormatted: issue.formatted,
            fulfillmentDate: fulfillment.raw,
            fulfillmentDateFormatted: fulfillment.formatted,
            baseAmountHuf: corrNet,
            taxAmountHuf: corrVat,
            vat5Huf: corrRate === 5 ? corrVat : 0,
            vat18Huf: corrRate === 18 ? corrVat : 0,
            vat27Huf: corrRate === 27 || (corrRate !== 5 && corrRate !== 18) ? corrVat : 0,
            proRataHuf: 0,
            isStorno: isStorno,
          },
        });
      }
    });
  } else {
    // If no candidate line items exist, synthesize 1 normal line matching partner aggregate
    const aggregateNet = Math.round(partner.base_amount_rounded || 0);
    const aggregateVat = Math.round(partner.tax_amount_rounded || 0);
    const vat5 = Math.round(partner.tax_5_amount || 0);
    const vat18 = Math.round(partner.tax_18_amount || 0);
    const vat27 = Math.round(partner.tax_27_amount || (aggregateVat - vat5 - vat18));

    normalInvoicesList.push({
      rowNumber: 1,
      invoiceNumber: `SZ-${dates.fromYear}${dates.fromMonth}-01`,
      fulfillmentDate: `${dates.toYear}${dates.toMonth}${dates.toDay}`,
      fulfillmentDateFormatted: dates.periodTo,
      baseAmountHuf: aggregateNet,
      taxAmountHuf: aggregateVat,
      vat5Huf: vat5,
      vat18Huf: vat18,
      vat27Huf: vat27,
      proRataHuf: 0,
      isAdvanceDiff: false,
    });
  }

  // Chunk normal invoices into 36 items per 2665M-02 page
  const ITEMS_PER_02_PAGE = 36;
  const normalPagesCount = Math.max(1, Math.ceil(normalInvoicesList.length / ITEMS_PER_02_PAGE));
  const normalPages: Nav65M02PageData[] = [];

  for (let p = 0; p < normalPagesCount; p++) {
    const slice = normalInvoicesList.slice(p * ITEMS_PER_02_PAGE, (p + 1) * ITEMS_PER_02_PAGE);
    const indexedItems: Nav65M02RowItem[] = slice.map((it, idx) => ({
      ...it,
      rowNumber: idx + 1,
    }));

    const pageBase = indexedItems.reduce((acc, it) => acc + it.baseAmountHuf, 0);
    const pageTax = indexedItems.reduce((acc, it) => acc + it.taxAmountHuf, 0);
    const pageVat5 = indexedItems.reduce((acc, it) => acc + it.vat5Huf, 0);
    const pageVat18 = indexedItems.reduce((acc, it) => acc + it.vat18Huf, 0);
    const pageVat27 = indexedItems.reduce((acc, it) => acc + it.vat27Huf, 0);
    const pageProRata = indexedItems.reduce((acc, it) => acc + it.proRataHuf, 0);

    normalPages.push({
      pageNumber: p + 1,
      totalPages: normalPagesCount,
      items: indexedItems,
      pageBaseTotalHuf: pageBase,
      pageTaxTotalHuf: pageTax,
      pageVat5TotalHuf: pageVat5,
      pageVat18TotalHuf: pageVat18,
      pageVat27TotalHuf: pageVat27,
      pageProRataTotalHuf: pageProRata,
    });
  }

  // Chunk correction pairs into 18 pairs (36 rows) per 2665M-02-K page
  const PAIRS_PER_02K_PAGE = 18;
  const corrPagesCount = correctionPairsList.length > 0 ? Math.ceil(correctionPairsList.length / PAIRS_PER_02K_PAGE) : 0;
  const correctionPages: Nav65M02KPageData[] = [];

  for (let p = 0; p < corrPagesCount; p++) {
    const pairSlice = correctionPairsList.slice(p * PAIRS_PER_02K_PAGE, (p + 1) * PAIRS_PER_02K_PAGE);
    const pageRows: Nav65M02KRowItem[] = [];

    pairSlice.forEach((pair, pairIdx) => {
      const rowEIndex = pairIdx * 2 + 1;
      const rowKTIndex = pairIdx * 2 + 2;

      pageRows.push({
        ...pair.eRow,
        rowNumber: rowEIndex,
      });
      pageRows.push({
        ...pair.ktRow,
        rowNumber: rowKTIndex,
      });
    });

    // 37. sor "Összesen": sum of KT rows (actual effect of corrections)
    const ktRows = pageRows.filter((r) => r.rowType === 'KT');
    const pageBase = ktRows.reduce((acc, r) => acc + r.baseAmountHuf, 0);
    const pageTax = ktRows.reduce((acc, r) => acc + r.taxAmountHuf, 0);
    const pageVat5 = ktRows.reduce((acc, r) => acc + r.vat5Huf, 0);
    const pageVat18 = ktRows.reduce((acc, r) => acc + r.vat18Huf, 0);
    const pageVat27 = ktRows.reduce((acc, r) => acc + r.vat27Huf, 0);
    const pageProRata = ktRows.reduce((acc, r) => acc + r.proRataHuf, 0);

    correctionPages.push({
      pageNumber: p + 1,
      totalPages: corrPagesCount,
      items: pageRows,
      pageBaseTotalHuf: pageBase,
      pageTaxTotalHuf: pageTax,
      pageVat5TotalHuf: pageVat5,
      pageVat18TotalHuf: pageVat18,
      pageVat27TotalHuf: pageVat27,
      pageProRataTotalHuf: pageProRata,
    });
  }

  // Compute 2665M Főlap totals (in thousands of HUF: eFt)
  const normalTotalBaseHuf = normalPages.reduce((acc, p) => acc + p.pageBaseTotalHuf, 0);
  const normalTotalTaxHuf = normalPages.reduce((acc, p) => acc + p.pageTaxTotalHuf, 0);
  const normalTotalVat5Huf = normalPages.reduce((acc, p) => acc + p.pageVat5TotalHuf, 0);
  const normalTotalVat18Huf = normalPages.reduce((acc, p) => acc + p.pageVat18TotalHuf, 0);
  const normalTotalVat27Huf = normalPages.reduce((acc, p) => acc + p.pageVat27TotalHuf, 0);
  const normalTotalProRataHuf = normalPages.reduce((acc, p) => acc + p.pageProRataTotalHuf, 0);

  const corrTotalBaseHuf = correctionPages.reduce((acc, p) => acc + p.pageBaseTotalHuf, 0);
  const corrTotalTaxHuf = correctionPages.reduce((acc, p) => acc + p.pageTaxTotalHuf, 0);
  const corrTotalVat5Huf = correctionPages.reduce((acc, p) => acc + p.pageVat5TotalHuf, 0);
  const corrTotalVat18Huf = correctionPages.reduce((acc, p) => acc + p.pageVat18TotalHuf, 0);
  const corrTotalVat27Huf = correctionPages.reduce((acc, p) => acc + p.pageVat27TotalHuf, 0);
  const corrTotalProRataHuf = correctionPages.reduce((acc, p) => acc + p.pageProRataTotalHuf, 0);

  const grandBaseHuf = normalTotalBaseHuf + corrTotalBaseHuf;
  const grandTaxHuf = normalTotalTaxHuf + corrTotalTaxHuf;
  const grandVat5Huf = normalTotalVat5Huf + corrTotalVat5Huf;
  const grandVat18Huf = normalTotalVat18Huf + corrTotalVat18Huf;
  const grandVat27Huf = normalTotalVat27Huf + corrTotalVat27Huf;
  const grandProRataHuf = normalTotalProRataHuf + corrTotalProRataHuf;

  const row04Count = normalInvoicesList.length;
  const row05Count = correctionPairsList.length;

  const folap = {
    row04: {
      invoiceCount: row04Count,
      baseEft: Math.round(normalTotalBaseHuf / 1000),
      taxEft: Math.round(normalTotalTaxHuf / 1000),
      vat5Eft: Math.round(normalTotalVat5Huf / 1000),
      vat18Eft: Math.round(normalTotalVat18Huf / 1000),
      vat27Eft: Math.round(normalTotalVat27Huf / 1000),
      proRataEft: Math.round(normalTotalProRataHuf / 1000),
    },
    row05: {
      invoiceCount: row05Count,
      baseEft: Math.round(corrTotalBaseHuf / 1000),
      taxEft: Math.round(corrTotalTaxHuf / 1000),
      vat5Eft: Math.round(corrTotalVat5Huf / 1000),
      vat18Eft: Math.round(corrTotalVat18Huf / 1000),
      vat27Eft: Math.round(corrTotalVat27Huf / 1000),
      proRataEft: Math.round(corrTotalProRataHuf / 1000),
    },
    row07: {
      invoiceCount: row04Count + row05Count,
      baseEft: Math.round(grandBaseHuf / 1000),
      taxEft: Math.round(grandTaxHuf / 1000),
      vat5Eft: Math.round(grandVat5Huf / 1000),
      vat18Eft: Math.round(grandVat18Huf / 1000),
      vat27Eft: Math.round(grandVat27Huf / 1000),
      proRataEft: Math.round(grandProRataHuf / 1000),
    },
  };

  // Total printable sheets: 1 (Főlap) + N (02 pages) + M (02-K pages)
  const totalSheetsCount = 1 + normalPages.length + correctionPages.length;

  return {
    partnerId: partner.id || partnerTax8,
    partnerName: partner.partner_name || 'Ismeretlen partner',
    partnerTaxNumber: partner.partner_tax_number || '',
    partnerTax8,
    companyName: selectedCompany?.name || '',
    companyTaxNumber: selectedCompany?.tax_number || '',
    companyTax8,
    companyVatCode,
    companyCountyCode,
    periodYear: year,
    periodMonth: month,
    frequency,
    periodFrom: dates.periodFrom,
    periodTo: dates.periodTo,
    periodFromYear: dates.fromYear,
    periodFromMonth: dates.fromMonth,
    periodFromDay: dates.fromDay,
    periodToYear: dates.toYear,
    periodToMonth: dates.toMonth,
    periodToDay: dates.toDay,
    folap,
    normalPages,
    correctionPages,
    totalSheetsCount,
  };
}
