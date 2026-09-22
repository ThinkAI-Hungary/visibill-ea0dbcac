import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
}

export function isSteelCandidate(item: {
  product_code?: string | null;
  net_weight_kg?: number | null;
  vat_rate?: string | null;
  line_description?: string | null;
}): boolean {
  if (item.net_weight_kg != null && item.net_weight_kg > 0) return true;
  const code = (item.product_code || '').trim();
  if (code.startsWith('72') || code.startsWith('73')) return true;
  const rate = (item.vat_rate || '').toUpperCase();
  if (rate.includes('ACEL') || rate.includes('HULL') || rate.includes('FAD')) return true;
  const desc = (item.line_description || '').toLowerCase();
  if (
    desc.includes('acél') ||
    desc.includes('betonacél') ||
    desc.includes('zártszelvény') ||
    desc.includes('idomacél') ||
    desc.includes('gerenda') ||
    desc.includes('lemez') ||
    desc.includes('háló') ||
    desc.includes('fémhulladék')
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
