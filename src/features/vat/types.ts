export interface TaxValidationResult {
  isValid: boolean;
  isForeign?: boolean;
  vatCode?: string;
  reason: string;
  severity: 'success' | 'warning' | 'error' | 'info';
  status?: 'active' | 'exempt' | 'invalid';
}

export interface VatCode {
  id: string;
  company_id: string;
  code: string;
  label: string;
  vat_percent: number;
  direction: 'OUTBOUND' | 'INBOUND';
  is_deductible: boolean;
  is_reverse_charge: boolean;
  is_eu: boolean;
  target_rows: { row: string; col: 'base' | 'tax' }[];
  sort_order: number;
}

export interface FormRow {
  row_number: string;
  country_code?: string;
  section: string;
  page: string;
  label: string;
  has_base: boolean;
  has_tax: boolean;
  is_summary: boolean;
  sort_order: number;
}

export interface ReturnLine {
  row_number: string;
  base_amount: number;
  tax_amount: number;
  base_amount_rounded: number;
  tax_amount_rounded: number;
  is_calculated: boolean;
  source_vat_codes: string[] | null;
}

export interface MLine {
  id: string;
  partner_name: string;
  partner_tax_number: string;
  invoice_count: number;
  base_amount?: number | null;
  tax_amount?: number | null;
  base_amount_rounded: number;
  tax_amount_rounded: number;
  tax_5_amount: number;
  tax_18_amount: number;
  tax_27_amount: number;
  invoice_details: any[];
}

export interface A60Line {
  id: string;
  vat_return_id: string;
  company_id: string;
  category: A60ItemCategory;
  country_code: string | null;
  partner_vat_number: string;
  partner_name: string | null;
  invoice_count: number;
  base_amount: number;
  base_amount_rounded: number;
  invoice_details: any[];
  created_at?: string;
  updated_at?: string;
}

export interface XmlValidationCheck {
  id: string;
  name: string;
  status: 'pending' | 'success' | 'error';
  message: string;
}

export type A60ItemCategory = 'goods_out' | 'goods_in' | 'services_out' | 'services_in';

export interface A60InvoiceItem {
  id: string;
  invoice_number: string;
  invoice_direction: 'OUTBOUND' | 'INBOUND';
  partner_name: string;
  partner_tax_number: string;
  country_code?: string;
  invoice_delivery_date: string;
  invoice_net_amount: number;
  currency: string;
  amountEft: number;
  category: A60ItemCategory;
  isService: boolean;
  defaultIsService?: boolean;
  hasTaxNumber: boolean;
  isValidFormat: boolean;
  source_table?: 'nav_invoices' | 'invoices';
}

export interface A60CalculationsResult {
  // 1. Közösségi Termékértékesítés (Kimenő) -> 02. sor
  goodsOutSum: number;
  expectedGoodsOut: number;
  goodsOutMismatch: boolean;

  // 2. Közösségi Termékbeszerzés (Bejövő) -> 11-16. sorok
  goodsInSum: number;
  expectedGoodsIn: number;
  goodsInMismatch: boolean;

  // 3. Közösségi Szolgáltatásnyújtás (Kimenő) -> 91-92. sorok
  servicesOutSum: number;
  expectedServicesOut: number;
  servicesOutMismatch: boolean;

  // 4. Közösségi Szolgáltatás igénybevétele (Bejövő) -> 18. sor
  servicesInSum: number;
  expectedServicesIn: number;
  servicesInMismatch: boolean;

  // Backward-compatible aliases
  goodsSum: number;
  servicesSum: number;
  expectedGoods: number;
  expectedServices: number;
  goodsMismatch: boolean;
  servicesMismatch: boolean;

  itemsList: A60InvoiceItem[];
  taxErrors: string[];
  isValid: boolean;
}

export interface DeadlineInfo {
  daysLeft: number;
  dateFormatted: string;
}

export type VatFrequency = 'H' | 'N' | 'E';

export const MONTHS = [
  'Január',
  'Február',
  'Március',
  'Április',
  'Május',
  'Június',
  'Július',
  'Augusztus',
  'Szeptember',
  'Október',
  'November',
  'December',
];

export const formatThousands = (
  v: number | string | null | undefined,
  options?: { decimals?: number; fallback?: string }
): string => {
  if (v === null || v === undefined || v === '') return options?.fallback ?? '0';
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s+/g, '').replace(',', '.'));
  if (isNaN(n)) return options?.fallback ?? '0';
  const isNegative = n < 0;
  const absNum = Math.abs(n);
  if (options?.decimals !== undefined) {
    const parts = absNum.toFixed(options.decimals).split('.');
    const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    const formatted = parts.length > 1 ? `${intPart},${parts[1]}` : intPart;
    return `${isNegative ? '-' : ''}${formatted}`;
  }
  const rounded = Math.round(absNum).toString();
  const formatted = rounded.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${isNegative ? '-' : ''}${formatted}`;
};

export const fmtEft = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s+/g, '').replace(',', '.'));
  if (isNaN(n)) return '—';
  return `${formatThousands(n)} eFt`;
};

export const fmtEur = (v: number | string | null | undefined): string => {
  if (v === null || v === undefined || v === '') return '—';
  const n = typeof v === 'number' ? v : Number(String(v).replace(/\s+/g, '').replace(',', '.'));
  if (isNaN(n)) return '—';
  return `${formatThousands(n, { decimals: 2 })} €`;
};

export const fmtVatAmount = (v: number | string | null | undefined, isCroatia: boolean): string => {
  return isCroatia ? fmtEur(v) : fmtEft(v);
};

export interface VatProRataSettings {
  id?: string;
  company_id: string;
  accounting_year: number;
  method: 'PREVIOUS_YEAR_9A' | 'CUMULATIVE_9B';
  prev_year_ratio: number;
  current_final_ratio?: number | null;
  is_finalized?: boolean;
  non_deductible_gl_account_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VatProRataPeriod {
  id?: string;
  company_id: string;
  accounting_year: number;
  period_month: number;
  taxable_revenue: number;
  exempt_revenue: number;
  non_taxable_subsidies: number;
  raw_ratio: number;
  rounded_ratio: number;
  pro_rata_base_amount: number;
  pro_rata_input_vat: number;
  deductible_vat: number;
  non_deductible_vat: number;
  created_at?: string;
  updated_at?: string;
}

export { formatVatRate } from '@/lib/utils';

export interface VatSteelItemSummary {
  id: string;
  invoice_id: string;
  invoice_number: string;
  partner_name: string;
  partner_tax_number: string;
  delivery_date: string;
  product_code: string; // VTSZ (vámtarifaszám)
  line_description: string;
  net_amount: number;
  net_weight_kg: number;
}

export type VatScope = 'all' | 'with_image';

/**
 * Proforma / díjbekérő típusok halmaza, amelyek nem minősülnek adóügyi számlának,
 * nincs adófizetési vagy levonási kötelezettségük, és nem szerepelhetnek az ÁFA bevallásban,
 * illetve a NAV Online Számla (OSA) keresztellenőrzésben.
 */
export const PROFORMA_INVOICE_TYPES = new Set([
  'dijbekero_proforma',
  'dijbekero',
  'proforma',
  'garanciajegy',
]);

/**
 * Megállapítja, hogy egy bizonylat díjbekérő (proforma) vagy nem-számla jellegű dokumentum-e.
 */
export function isProformaInvoice(inv: {
  invoice_type?: string | null;
  bizonylatsorszam?: string | null;
  invoice_number?: string | null;
} | null | undefined): boolean {
  if (!inv) return false;
  const type = (inv.invoice_type || '').toLowerCase().trim();
  if (PROFORMA_INVOICE_TYPES.has(type)) {
    return true;
  }
  const sorszam = (inv.bizonylatsorszam || inv.invoice_number || '').trim().toLowerCase();
  if (
    sorszam.includes('proforma') ||
    sorszam.includes('dijbekero') ||
    sorszam.includes('díjbekérő') ||
    sorszam.startsWith('díj') ||
    sorszam.startsWith('dij') ||
    sorszam.startsWith('pro-') ||
    sorszam.startsWith('pro_') ||
    sorszam.startsWith('pro/') ||
    sorszam.includes('/pred/') ||
    sorszam.startsWith('pred/') ||
    sorszam.includes('predracun') ||
    sorszam.includes('predračun')
  ) {
    return true;
  }
  return false;
}

/**
 * Megállapítja, hogy egy partner vagy adószám alanyi adómentes (AAM) státuszú-e.
 * A magyar adószámok 9. karaktere az áfa-kód:
 * '1' = Alanyi adómentes vagy kizárólag tárgyi adómentes / mentes tevékenység.
 * Az alanyi adómentes partnerek után nem gyakorolható adólevonási jog, számláik
 * nem képezik a belföldi 65M összesítő jelentés részét.
 */
export function isAamPartnerOrTaxNumber(
  taxNumber?: string | null,
  partnerName?: string | null
): boolean {
  if (taxNumber) {
    const raw = taxNumber.replace(/\D/g, '');
    // Magyar 11 jegyű adószám: XXXXXXXX-Y-ZZ, ahol Y a 9. jegy (index 8)
    if (raw.length >= 9 && raw[8] === '1') {
      return true;
    }
    // Kötőjeles formátum ellenőrzése: pl. 12345678-1-42
    const parts = taxNumber.split('-');
    if (parts.length >= 2 && parts[1].trim() === '1') {
      return true;
    }
  }

  if (partnerName) {
    const name = partnerName.toLowerCase();
    if (name.includes('alanyi adómentes') || name.includes('alanyi mentes') || name.includes('(aam)')) {
      return true;
    }
  }

  return false;
}

/**
 * Megállapítja, hogy a partner vagy számla biztosító intézet, illetve biztosítási szolgáltatás-e.
 * Az Áfa tv. 86. § (1) bekezdés a) pontja szerint a biztosítási tevékenység tárgyi adómentes,
 * a biztosítási díjak a biztosítási adó hatálya alá tartoznak, nem levonható áfás ügyletek,
 * így a 65M lapon nem szerepelhetnek.
 */
export function isInsurancePartnerOrInvoice(
  partnerName?: string | null,
  itemOrInvoiceDesc?: string | null,
  invoiceNumber?: string | null
): boolean {
  if (partnerName) {
    const name = partnerName.toLowerCase();
    if (
      name.includes('biztosító') ||
      name.includes('biztositó') ||
      name.includes('biztosítás') ||
      name.includes('biztositas') ||
      name.includes('insurance') ||
      name.includes('allianz') ||
      name.includes('generali') ||
      name.includes('groupama') ||
      name.includes('uniqa') ||
      name.includes('aegon') ||
      name.includes('k&h biztosító') ||
      name.includes('posta biztosító') ||
      name.includes('signal iduna') ||
      name.includes('colonnade') ||
      name.includes('cig pannónia') ||
      name.includes('cig pannonia') ||
      name.includes('grawe')
    ) {
      return true;
    }
  }

  if (itemOrInvoiceDesc) {
    const desc = itemOrInvoiceDesc.toLowerCase();
    if (
      desc.includes('készülékbiztosítás') ||
      desc.includes('keszulekbiztositas') ||
      desc.includes('felelősségbiztosítás') ||
      desc.includes('felelossegbiztositas') ||
      desc.includes('vagyonbiztosítás') ||
      desc.includes('vagyonbiztositas') ||
      desc.includes('gépjármű-felelősségbiztosítás') ||
      desc.includes('kgfb') ||
      desc.includes('casco') ||
      desc.includes('életbiztosítás') ||
      desc.includes('eletbiztositas') ||
      desc.includes('balesetbiztosítás') ||
      desc.includes('utasbiztosítás') ||
      desc.includes('biztosítási díj') ||
      desc.includes('biztositasi dij')
    ) {
      return true;
    }
  }

  if (invoiceNumber) {
    const invNum = invoiceNumber.toLowerCase();
    if (invNum.startsWith('kötvény') || invNum.startsWith('kotveny') || invNum.includes('policy')) {
      return true;
    }
  }

  return false;
}

/**
 * Univerzális védelmi őr (Guard): megállapítja, hogy az adott partnernek vagy számlának
 * tiltott-e bekerülnie az ÁFA 65M belföldi összesítő jelentésbe.
 * Kizárt tételek:
 * 1. Díjbekérők, proforma és garanciajegyek (nem minősülnek adóügyi számlának).
 * 2. Alanyi adómentes partnerek / számlák (9. jegy = '1', nincs levonható áfa).
 * 3. Biztosítók, biztosítási kötvények és díjak (biztosítási adó, mentes).
 * 4. Olyan 0 Ft-os belföldi számlák, amelyek nem fordított adózásúak.
 */
export function shouldExcludeFromMLine(item: {
  partner_tax_number?: string | null;
  partner_name?: string | null;
  invoice_number?: string | null;
  bizonylatsorszam?: string | null;
  invoice_type?: string | null;
  tax_amount?: number | null;
  vat_amount?: number | null;
  tax_amount_rounded?: number | null;
  vat?: number | null;
  is_reverse_charge?: boolean | null;
  description?: string | null;
  item_description?: string | null;
  invoice_details?: any[];
} | null | undefined): boolean {
  if (!item) return false;

  // 1. Díjbekérő vizsgálat
  if (isProformaInvoice(item)) {
    return true;
  }

  // 2. Alanyi adómentes (AAM) partner / számla vizsgálat
  if (isAamPartnerOrTaxNumber(item.partner_tax_number, item.partner_name)) {
    return true;
  }

  // 3. Biztosítás / biztosító vizsgálat
  if (isInsurancePartnerOrInvoice(item.partner_name, item.description || item.item_description, item.invoice_number || item.bizonylatsorszam)) {
    return true;
  }

  // 4. Nulla forintos adótartalom (ha nem belföldi fordított adózású tétel)
  let invoiceDetailsTax = 0;
  if ('invoice_details' in (item as any) && Array.isArray((item as any).invoice_details)) {
    for (const d of (item as any).invoice_details) {
      invoiceDetailsTax += Math.abs(Number(d.vat ?? d.tax ?? 0));
    }
  }
  const tax = Number(item.tax_amount ?? item.vat_amount ?? (item as any).vat ?? item.tax_amount_rounded ?? 0) + invoiceDetailsTax;
  if (tax <= 0 && !item.is_reverse_charge) {
    // Ha az adószám nem éri el a 8 számjegyet vagy ismeretlen és 0 az áfa, szintén kizárandó
    return true;
  }

  return false;
}





