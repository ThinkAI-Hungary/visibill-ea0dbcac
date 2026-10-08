import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isReverseChargeVatRate, normalizeVatRatePercent } from '@/lib/utils';
import type { VatFrequency } from '../types';

export interface SteelItemRecord {
  id: string;
  sourceTable: 'nav_invoice_items' | 'invoice_items';
  invoiceId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  invoiceNumber: string;
  partnerName: string;
  partnerTaxNumber: string;
  deliveryDate: string;
  lineNumber: number;
  lineDescription: string;
  productCode: string | null;
  quantity: number | null;
  unitOfMeasure: string | null;
  netAmount: number;
  vatRate: string | null;
  netWeightKg: number | null;
  productName?: string;
  vtsz?: string;
}

export function isSteelCandidate(item: {
  product_code?: string | null;
  net_weight_kg?: number | null;
  vat_rate?: string | null;
  line_description?: string | null;
  fad_category?: string | null;
}): boolean {
  const rateStr = (item.vat_rate || '').trim().toUpperCase();
  const normPercent = normalizeVatRatePercent(rateStr);
  const isRC = isReverseChargeVatRate(rateStr);

  // 1. Straight positive VAT check (27%, 18%, 5%, 0.27 etc.) is NOT reverse charge.
  // Áfa tv. 6/B. melléklet and NAV 2665-07 / 2665-08 declarations apply EXCLUSIVELY
  // to domestic reverse charge (belföldi fordított adózás, 142. § (1) i)).
  if (normPercent != null && normPercent > 0 && !isRC) {
    return false;
  }

  // 2. Explicit non-reverse-charge exemptions (TAM, AAM, KBAET, etc.)
  if (['AAM', 'TAM', 'KBAET', 'ATHK', 'EUK', 'AHK'].some(code => rateStr === code || rateStr.startsWith(code))) {
    return false;
  }

  // 3. Explicit other FAD categories (construction, labor hire, natural gas, etc.)
  if (item.fad_category && item.fad_category !== 'steel' && item.fad_category !== 'scrap_metal') {
    return false;
  }
  if (rateStr.includes('EPIT') || rateStr.includes('BERMUNKA') || rateStr.includes('KVOTA') || rateStr.includes('GAZ')) {
    return false;
  }

  // 4. Telecom / IT services exclusion (TESZOR 61, 62, 63 or telecom descriptions)
  const code = (item.product_code || '').trim();
  if (code.startsWith('61.') || code.startsWith('62.') || code.startsWith('63.')) {
    return false;
  }

  const desc = (item.line_description || '').trim();
  const descLower = desc.toLowerCase();

  // Exclude telecommunications / network services (mobilhálózat, hálózat, távközlés, etc.)
  if (
    descLower.includes('mobilhálózat') ||
    descLower.includes('telefonhálózat') ||
    descLower.includes('adathálózat') ||
    descLower.includes('távközl') ||
    descLower.includes('mobiltelefon') ||
    descLower.includes('internetszolg') ||
    /\b(hálózat|hálózati|mobilnet|sms|mms)\b/.test(descLower)
  ) {
    return false;
  }

  // 5. Positive indicators:
  // a) Explicit net weight entered (> 0)
  if (item.net_weight_kg != null && item.net_weight_kg > 0) return true;

  // b) VTSZ / KN code in chapters 72 or 73 (4-8 digits, e.g. 7214, 7306, 7214 20 00)
  const cleanCode = code.replace(/\s+/g, '');
  if (/^7[23]\d{2}/.test(cleanCode) && !code.includes('.')) return true;

  // c) Explicit steel VAT rate
  if (rateStr.includes('ACEL') || rateStr.includes('HULL')) return true;

  // d) Description starts with VTSZ 72xx or 73xx
  if (/^7[23]\d{2}/.test(desc)) return true;

  // e) Explicit steel product keywords (avoiding generic "háló" and "lemez")
  if (
    descLower.includes('acél') ||
    descLower.includes('betonacél') ||
    descLower.includes('zártszelvény') ||
    descLower.includes('idomacél') ||
    descLower.includes('köracél') ||
    descLower.includes('laposacél') ||
    descLower.includes('szögacél') ||
    descLower.includes('acéllemez') ||
    descLower.includes('vaslemez') ||
    descLower.includes('trapézlemez') ||
    descLower.includes('hullámlemez') ||
    descLower.includes('acélcső') ||
    descLower.includes('vascső') ||
    descLower.includes('acélgerenda') ||
    descLower.includes('vasgerenda') ||
    descLower.includes('acélháló') ||
    descLower.includes('betonháló') ||
    descLower.includes('vasháló') ||
    descLower.includes('síkháló') ||
    descLower.includes('drótháló') ||
    descLower.includes('hegesztett háló') ||
    descLower.includes('fémhulladék') ||
    descLower.includes('vashulladék') ||
    descLower.includes('acélhulladék') ||
    /\b(heb|hea|ipe|unp)\s*\d+/i.test(descLower)
  ) {
    return true;
  }

  return false;
}

export function isSteelItemComplete(item: SteelItemRecord): boolean {
  return Boolean(
    item.productCode &&
    item.productCode.trim() !== '' &&
    item.netWeightKg != null &&
    item.netWeightKg > 0
  );
}

export function useSteelProductsData(
  selectedCompany: any,
  year: number,
  month: number,
  frequency: VatFrequency
) {
  // Date range computation for period
  const { dateFrom, dateTo, periodLabel } = useMemo(() => {
    let df: string, dt: string;
    let lbl = '';
    if (frequency === 'H') {
      const mStr = String(month).padStart(2, '0');
      df = `${year}-${mStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      dt = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`;
      lbl = `${year}. ${month}. hónap`;
    } else if (frequency === 'N') {
      const startM = (month - 1) * 3 + 1;
      const endM = startM + 2;
      df = `${year}-${String(startM).padStart(2, '0')}-01`;
      const lastDay = new Date(year, endM, 0).getDate();
      dt = `${year}-${String(endM).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      lbl = `${year}. Q${month}`;
    } else {
      df = `${year}-01-01`;
      dt = `${year}-12-31`;
      lbl = `${year}. év`;
    }
    return { dateFrom: df, dateTo: dt, periodLabel: lbl };
  }, [year, month, frequency]);

  const { data: steelItems = [], isLoading, refetch } = useQuery<SteelItemRecord[]>({
    queryKey: ['vat_steel_items', selectedCompany?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];

      const { data: navInvs } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, supplier_name, supplier_tax_number, customer_name, customer_tax_number, invoice_delivery_date, invoice_issue_date, invoice_direction')
        .eq('company_id', selectedCompany.id)
        .gte('invoice_delivery_date', dateFrom)
        .lte('invoice_delivery_date', dateTo);

      const { data: subInvs } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, elado_nev, elado_vat_id, vevo_nev, vevo_vat_id, teljesites_datuma, kibocsatas_datuma, invoice_direction')
        .eq('company_id', selectedCompany.id)
        .gte('teljesites_datuma', dateFrom)
        .lte('teljesites_datuma', dateTo);

      const navList = navInvs || [];
      const subList = subInvs || [];
      const navMap = new Map(navList.map(i => [i.id, i]));
      const subMap = new Map(subList.map(i => [i.id, i]));
      const navIds = navList.map(i => i.id);
      const subIds = subList.map(i => i.id);

      const [navItemsRes, subItemsRes] = await Promise.all([
        navIds.length > 0
          ? supabase
              .from('nav_invoice_items')
              .select('id, nav_invoice_id, line_number, line_description, product_code, quantity, unit_of_measure, net_amount, vat_rate, net_weight_kg')
              .in('nav_invoice_id', navIds)
          : Promise.resolve({ data: [] }),
        subIds.length > 0
          ? supabase
              .from('invoice_items')
              .select('id, invoice_id, line_number, line_description, product_code, quantity, unit_of_measure, net_amount, vat_rate, net_weight_kg')
              .in('invoice_id', subIds)
          : Promise.resolve({ data: [] }),
      ]);

      const records: SteelItemRecord[] = [];

      (navItemsRes.data || []).forEach((it: any) => {
        if (isSteelCandidate(it)) {
          const inv = navMap.get(it.nav_invoice_id);
          const isOut = (inv?.invoice_direction || 'INBOUND').toUpperCase() === 'OUTBOUND';
          records.push({
            id: `nav_${it.id}`,
            sourceTable: 'nav_invoice_items',
            invoiceId: it.nav_invoice_id,
            direction: isOut ? 'OUTBOUND' : 'INBOUND',
            invoiceNumber: inv?.invoice_number || '—',
            partnerName: (isOut ? inv?.customer_name : inv?.supplier_name) || 'Ismeretlen partner',
            partnerTaxNumber: (isOut ? inv?.customer_tax_number : inv?.supplier_tax_number) || '',
            deliveryDate: inv?.invoice_delivery_date || inv?.invoice_issue_date || '',
            lineNumber: it.line_number || 1,
            lineDescription: it.line_description || '—',
            productCode: it.product_code || null,
            quantity: it.quantity ? Number(it.quantity) : null,
            unitOfMeasure: it.unit_of_measure || null,
            netAmount: Number(it.net_amount) || 0,
            vatRate: it.vat_rate || null,
            netWeightKg: it.net_weight_kg != null ? Number(it.net_weight_kg) : null,
          });
        }
      });

      (subItemsRes.data || []).forEach((it: any) => {
        if (isSteelCandidate(it)) {
          const inv = subMap.get(it.invoice_id);
          const isOut = (inv?.invoice_direction || 'INBOUND').toUpperCase() === 'OUTBOUND';
          const alreadyExists = records.some(
            r => r.invoiceNumber === inv?.bizonylatsorszam && r.lineNumber === it.line_number
          );
          if (!alreadyExists) {
            records.push({
              id: `sub_${it.id}`,
              sourceTable: 'invoice_items',
              invoiceId: it.invoice_id,
              direction: isOut ? 'OUTBOUND' : 'INBOUND',
              invoiceNumber: inv?.bizonylatsorszam || '—',
              partnerName: (isOut ? inv?.vevo_nev : inv?.elado_nev) || 'Ismeretlen partner',
              partnerTaxNumber: (isOut ? inv?.vevo_vat_id : inv?.elado_vat_id) || '',
              deliveryDate: inv?.teljesites_datuma || inv?.kibocsatas_datuma || '',
              lineNumber: it.line_number || 1,
              lineDescription: it.line_description || '—',
              productCode: it.product_code || null,
              quantity: it.quantity ? Number(it.quantity) : null,
              unitOfMeasure: it.unit_of_measure || null,
              netAmount: Number(it.net_amount) || 0,
              vatRate: it.vat_rate || null,
              netWeightKg: it.net_weight_kg != null ? Number(it.net_weight_kg) : null,
            });
          }
        }
      });

      return records.sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate));
    },
    enabled: !!selectedCompany?.id,
  });

  const incompleteSteelItems = useMemo(() => {
    return steelItems.filter(it => !isSteelItemComplete(it));
  }, [steelItems]);

  return {
    steelItems,
    isLoading,
    refetch,
    dateFrom,
    dateTo,
    periodLabel,
    incompleteSteelItems,
    hasIncompleteSteelItems: incompleteSteelItems.length > 0,
  };
}
