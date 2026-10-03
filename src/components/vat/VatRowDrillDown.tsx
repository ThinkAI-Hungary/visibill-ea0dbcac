import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isValidUUID } from '@/lib/validationUtils';
import { reportError } from '@/lib/errorReporter';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { formatThousands } from '@/features/vat/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { isSteelCandidate } from '@/features/vat/hooks/useSteelProductsData';

export function isFadItem(it: any, inv: any, isDomestic: boolean): boolean {
  if (!isDomestic) return false;
  const itVat = Number(it.vat_amount || 0);
  const itNet = Number(it.net_amount || 0);
  const rateStr = String(it.vat_rate || '').trim().toUpperCase();
  const codeStr = String(it.vat_code || it.vat_code_code || inv?.vat_code || '').trim().toUpperCase();

  // If item or invoice has an explicit EU or non-FAD code, it is NOT domestic FAD
  if (
    codeStr.startsWith('EU_') ||
    codeStr.startsWith('BE_EU') ||
    codeStr.startsWith('KI_EU') ||
    codeStr.startsWith('3_ORSZ') ||
    codeStr.startsWith('KI_EXP') ||
    codeStr.startsWith('BE_27') ||
    codeStr.startsWith('BE_18') ||
    codeStr.startsWith('BE_5') ||
    codeStr.startsWith('BE_MENTES') ||
    it.is_eu === true
  ) {
    return false;
  }

  // If the line item already has positive VAT charged by supplier, it is standard VAT, not reverse charge
  if (itVat > 0) return false;

  if (
    codeStr.includes('FAD') ||
    codeStr.includes('FORD') ||
    rateStr.includes('FAD') ||
    rateStr.includes('DOMESTIC_REVERSE_CHARGE') ||
    rateStr.includes('ACEL') ||
    rateStr.includes('HULL') ||
    inv?.vat_row_override === '29'
  ) {
    return true;
  }

  if (inv?.is_reverse_charge && itVat === 0) return true;

  if (itVat === 0 && itNet !== 0 && isSteelCandidate(it)) {
    return true;
  }

  return false;
}


/* ────────────────────────────────────────── */
/*  Types                                     */
/* ────────────────────────────────────────── */
interface VatCode {
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

/* ────────────────────────────────────────── */
/*  Invoice Items Drill-Down                   */
/* ────────────────────────────────────────── */
export function InvoiceItemsDrillDown({ invoiceNumber, companyId }: { invoiceNumber: string; companyId: string }) {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['invoice_items_drill', companyId, invoiceNumber],
    queryFn: async () => {
      // 1. Check nav_invoices
      const { data: inv } = await supabase
        .from('nav_invoices')
        .select('id')
        .eq('company_id', companyId)
        .eq('invoice_number', invoiceNumber)
        .limit(1)
        .maybeSingle();
      if ((inv as any)?.id) {
        const { data: navItems } = await supabase
          .from('nav_invoice_items')
          .select('line_number, line_description, quantity, unit_price, net_amount, vat_amount, vat_rate, deductible_percentage, product_code, net_weight_kg, vat_code, vat_code_id')
          .eq('nav_invoice_id', (inv as any).id)
          .order('line_number');
        if (navItems && navItems.length > 0) return navItems as any[];
      }

      // 2. Fallback to invoices / invoice_items
      const { data: appInv } = await supabase
        .from('invoices')
        .select('id')
        .eq('company_id', companyId)
        .eq('bizonylatsorszam', invoiceNumber)
        .limit(1)
        .maybeSingle();
      if ((appInv as any)?.id) {
        const { data: appItems } = await supabase
          .from('invoice_items')
          .select('line_number, line_description, quantity, unit_price, net_amount, vat_amount, vat_rate, deductible_percentage, product_code, net_weight_kg, vat_code, vat_code_id')
          .eq('invoice_id', (appInv as any).id)
          .order('line_number');
        if (appItems && appItems.length > 0) return appItems as any[];
      }

      return [];
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Tételek betöltése...
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="px-4 py-2 text-xs text-muted-foreground italic">Nincs tétel ehhez a számlához</div>;
  }

  return (
    <div className="bg-background/50 border border-border/20 rounded mx-4 mb-2 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider bg-muted/10 border-b border-border/10">
        <div className="col-span-4">Megnevezés</div>
        <div className="col-span-2 text-right">Mennyiség</div>
        <div className="col-span-2 text-right">Egységár</div>
        <div className="col-span-2 text-right">Nettó</div>
        <div className="col-span-2 text-right">ÁFA</div>
      </div>
      {items.map((item: any, j: number) => {
        const deductible = Number(item.deductible_percentage ?? 100);
        const isPartial = deductible < 100;
        const effectiveNet = Math.round((Number(item.net_amount || 0) * (deductible / 100.0)));
        const effectiveVat = Math.round((Number(item.vat_amount || 0) * (deductible / 100.0)));
        return (
          <div key={j} className="grid grid-cols-12 gap-2 px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted/20 transition-colors items-center">
            <div className="col-span-4 flex items-center gap-1.5 truncate" title={item.line_description}>
              <span className="truncate font-medium text-foreground/85">{item.line_description || '—'}</span>
              {item.product_code && (
                <span className="shrink-0 text-[10px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border/40">
                  {item.product_code}
                </span>
              )}
              {item.vat_code && (
                <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {item.vat_code}
                </span>
              )}
              {item.net_weight_kg != null && (
                <span className="shrink-0 text-[10px] font-mono px-1 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  {item.net_weight_kg} kg
                </span>
              )}
              {isPartial && (
                <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {deductible}% lev.
                </span>
              )}
            </div>
            <div className="col-span-2 text-right tabular-nums">{item.quantity != null ? formatThousands(Number(item.quantity)) : '—'}</div>
            <div className="col-span-2 text-right tabular-nums">{item.unit_price != null ? formatThousands(Number(item.unit_price)) : '—'}</div>
            <div className="col-span-2 text-right tabular-nums">
              <div>{formatThousands(effectiveNet)} Ft</div>
              {isPartial && (
                <div className="text-[9px] text-muted-foreground/50 line-through">
                  {formatThousands(Number(item.net_amount || 0))} Ft
                </div>
              )}
            </div>
            <div className="col-span-2 text-right tabular-nums font-medium">
              <div>{formatThousands(effectiveVat)} Ft</div>
              {isPartial && (
                <div className="text-[9px] text-muted-foreground/50 line-through font-normal">
                  {formatThousands(Number(item.vat_amount || 0))} Ft
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


/* ────────────────────────────────────────── */
/*  VAT Row Drill-Down                        */
/* ────────────────────────────────────────── */
/** Drill-down: shows which invoices/items make up a given VAT return row */
export function VatRowDrillDown({ rowNumber, sourceVatCodes, companyId, year, month, frequency }: {
  rowNumber?: string;
  sourceVatCodes: string[];
  companyId: string;
  year: number;
  month: number;
  frequency: 'H' | 'N' | 'E';
}) {
  const [expandedInv, setExpandedInv] = useState<string | null>(null);

  // Compute date range same as RPC
  const dateFrom = useMemo(() => {
    if (frequency === 'H') return `${year}-${String(month).padStart(2,'0')}-01`;
    if (frequency === 'E') return `${year}-01-01`;
    const startMonth = (month - 1) * 3 + 1;
    return `${year}-${String(startMonth).padStart(2,'0')}-01`;
  }, [year, month, frequency]);

  const dateTo = useMemo(() => {
    if (frequency === 'E') return `${year}-12-31`;
    let endYear = year;
    let endMonth = frequency === 'H' ? month : month * 3;
    const lastDay = new Date(Date.UTC(endYear, endMonth, 0)).getUTCDate();
    return `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  }, [frequency, year, month]);

  // Fetch current exchange rates to dynamically handle foreign currencies
  const { data: exchangeRates } = useExchangeRates();

  const getRate = (currency: string | null | undefined): number => {
    const cur = (currency || 'HUF').toUpperCase();
    if (cur === 'HUF') return 1;
    if (exchangeRates && exchangeRates[cur]) return exchangeRates[cur];
    const fallbacks: Record<string, number> = {
      EUR: 400,
      USD: 370,
      GBP: 470,
      CHF: 415,
      RON: 80,
    };
    return fallbacks[cur] || 1;
  };

  // Fetch VAT codes config to know which direction/rate to query
  const { data: vatCodes = [] } = useQuery({
    queryKey: ['vat_codes', companyId],
    queryFn: async () => {
      if (!isValidUUID(companyId)) return [];
      const { data } = await supabase.from('vat_codes').select('*').eq('company_id', companyId);
      return (data || []) as unknown as VatCode[];
    },
    enabled: isValidUUID(companyId),
    staleTime: 60_000,
  });

  // Query invoices matching these VAT codes in the period
  const queryKeyStr = `${companyId}_${dateFrom}_${dateTo}_${rowNumber || ''}_${(sourceVatCodes || []).join(',')}`;
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['vat_row_drill', queryKeyStr],
    queryFn: async () => {
      if (!isValidUUID(companyId)) return [];
      let directions: string[] = [];
      let vatPercents: number[] = [];

      // 1. Direct resolution by standard NAV 65 rowNumber
      if (rowNumber === '01') { directions = ['OUTBOUND']; vatPercents = [0]; }
      else if (rowNumber === '02') { directions = ['OUTBOUND']; vatPercents = [0]; }
      else if (rowNumber === '03') { directions = ['OUTBOUND']; vatPercents = [0]; }
      else if (rowNumber === '04') { directions = ['OUTBOUND']; vatPercents = [0, 27]; }
      else if (rowNumber === '05') { directions = ['OUTBOUND']; vatPercents = [5]; }
      else if (rowNumber === '06') { directions = ['OUTBOUND']; vatPercents = [18]; }
      else if (rowNumber === '07') { directions = ['OUTBOUND']; vatPercents = [27]; }
      else if (rowNumber === '08') { directions = ['OUTBOUND']; vatPercents = [0]; }
      else if (rowNumber === '11') { directions = ['INBOUND']; vatPercents = [0]; }
      else if (rowNumber === '12') { directions = ['INBOUND']; vatPercents = [5, 0]; }
      else if (rowNumber === '13') { directions = ['INBOUND']; vatPercents = [18, 0]; }
      else if (rowNumber === '14' || rowNumber === '15' || rowNumber === '16') { directions = ['INBOUND']; vatPercents = [27, 0]; }
      else if (rowNumber === '18') { directions = ['INBOUND']; vatPercents = [27, 0]; }
      else if (rowNumber === '27') { directions = ['INBOUND']; vatPercents = [27, 0]; }
      else if (rowNumber === '29') { directions = ['INBOUND']; vatPercents = [27, 0]; }
      else if (rowNumber === '43') { directions = ['OUTBOUND']; vatPercents = [27, 18, 5, 0]; }
      else if (rowNumber === '45') { directions = ['OUTBOUND']; vatPercents = [27, 18, 5, 0]; }
      else if (rowNumber === '63') { directions = ['INBOUND']; vatPercents = [0]; }
      else if (rowNumber === '64') { directions = ['INBOUND']; vatPercents = [5]; }
      else if (rowNumber === '65') { directions = ['INBOUND']; vatPercents = [18]; }
      else if (rowNumber === '66') { directions = ['INBOUND']; vatPercents = [27, 0]; }
      else if (rowNumber === '66_fad') { directions = ['INBOUND']; vatPercents = [27, 0]; }
      else if (rowNumber === '67') { directions = ['INBOUND']; vatPercents = [27, 18, 5, 0]; }
      else if (rowNumber === '69') { directions = ['INBOUND']; vatPercents = [27, 18, 5, 0]; }
      else if (rowNumber === '77') { directions = ['INBOUND']; vatPercents = [27, 18, 5, 0]; }
      else if (rowNumber === '91' || rowNumber === '92') { directions = ['OUTBOUND']; vatPercents = [0]; }

      // 2. If rowNumber not recognized, match via vat_codes or sourceVatCodes
      if (directions.length === 0) {
        const matching = vatCodes.filter(c => 
          (sourceVatCodes || []).includes(c.code) ||
          (c.target_rows && Array.isArray(c.target_rows) && c.target_rows.some((tr: any) => (sourceVatCodes || []).includes(tr.row) || tr.row === rowNumber))
        );
        if (matching.length > 0) {
          directions = [...new Set(matching.map(c => c.direction))];
          vatPercents = [...new Set(matching.map(c => Number(c.vat_percent)))];
        } else {
          const codes = sourceVatCodes || [];
          const has27 = codes.some(s => s === '25' || s === '27%' || s === '27' || s === '0.27' || s === 'KIM_27' || s === 'BE_27');
          const has18 = codes.some(s => s === '18' || s === '18%' || s === '0.18' || s === 'KIM_18' || s === 'BE_18');
          const has5 = codes.some(s => s === '05' || s === '5%' || s === '5' || s === '0.05' || s === 'KIM_5' || s === 'BE_5');
          if (has27) vatPercents.push(27);
          if (has18) vatPercents.push(18);
          if (has5) vatPercents.push(5);
          const isInbound = codes.some(s => s.startsWith('BE_')) || (rowNumber && ['64','65','66','66_fad','67','69','77'].includes(rowNumber));
          directions = [isInbound ? 'INBOUND' : 'OUTBOUND'];
        }
      }

      if (directions.length === 0) return [];

      // Build vat_rate filter values
      const rateFilters: string[] = [];
      for (const pct of vatPercents) {
        if (Number(pct) === 27) rateFilters.push('0.27', '27', '27.0', '27.00', '27%');
        else if (Number(pct) === 18) rateFilters.push('0.18', '18', '18.0', '18.00', '18%');
        else if (Number(pct) === 5) rateFilters.push('0.05', '5', '5.0', '5.00', '5%');
        else if (Number(pct) === 0) {
          rateFilters.push(
            '0', '0.0', '0.00', '0%',
            'TAM', 'AAM', 'DOMESTIC_REVERSE_CHARGE', 'FAD',
            'ATHK', 'EUK', 'EUF', 'EUT', 'HO',
            'EU_SZOLG', 'EU_SZOLG_BE', 'KIM_EU_SZOLG',
            'MENTES', '3_ORSZ_SZOLG', 'K-AFA'
          );
        }
      }

      const norm = (s: string) => (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

      // Fetch advance and tangible asset references from invoices table if row 43, 45 or 77
      const advanceNumbers = new Set<string>();
      const tangibleNumbers = new Set<string>();
      if (rowNumber === '43' || rowNumber === '45' || rowNumber === '77') {
        const { data: appInvs } = await supabase
          .from('invoices')
          .select('bizonylatsorszam, invoice_type, vat_row_override, invoice_items(line_description, gl_classifications)')
          .eq('company_id', companyId);
        (appInvs || []).forEach((inv: any) => {
          const isAdv = inv.invoice_type === 'elolegszamla' || 
            inv.vat_row_override === '45' ||
            (inv.invoice_items || []).some((ii: any) => 
              (ii.line_description && ii.line_description.toLowerCase().includes('előleg')) ||
              (ii.gl_classifications && JSON.stringify(ii.gl_classifications).includes('"gl_number": "453'))
            );
          const isTan = inv.vat_row_override === '43' ||
            inv.vat_row_override === '77' ||
            (inv.invoice_items || []).some((ii: any) =>
              ii.gl_classifications && /"gl_number":\s*"(1[0-9]{2}|9611|8611)/.test(JSON.stringify(ii.gl_classifications))
            );
          if (isAdv && inv.bizonylatsorszam) {
            advanceNumbers.add(inv.bizonylatsorszam);
            advanceNumbers.add(norm(inv.bizonylatsorszam));
          }
          if (isTan && inv.bizonylatsorszam) {
            tangibleNumbers.add(inv.bizonylatsorszam);
            tangibleNumbers.add(norm(inv.bizonylatsorszam));
          }
        });
      }

      // Paginated query for nav_invoices to bypass Supabase 1,000-row default limit
      let candidateInvoices: any[] = [];
      let navPage = 0;
      const pageSize = 1000;
      while (true) {
        const { data: chunk, error } = await supabase
          .from('nav_invoices')
          .select(`
            id, invoice_number, supplier_name, customer_name, supplier_tax_number, customer_tax_number, invoice_direction,
            invoice_delivery_date, invoice_issue_date, ti_override, calculated_ti, currency, invoice_net_amount, invoice_vat_amount, is_reverse_charge, vat_row_override, vat_code_id,
            nav_invoice_items(id, line_number, line_description, net_amount, vat_amount, vat_rate, quantity, unit_price, deductible_percentage, product_code, net_weight_kg, vat_code, vat_code_id)
          `)
          .eq('company_id', companyId)
          .or(
            `and(invoice_delivery_date.gte.${dateFrom},invoice_delivery_date.lte.${dateTo}),` +
            `and(calculated_ti.gte.${dateFrom},calculated_ti.lte.${dateTo}),` +
            `and(ti_override.gte.${dateFrom},ti_override.lte.${dateTo}),` +
            `and(invoice_delivery_date.is.null,invoice_issue_date.gte.${dateFrom},invoice_issue_date.lte.${dateTo})`
          )
          .in('invoice_direction', directions)
          .range(navPage * pageSize, (navPage + 1) * pageSize - 1);

        if (error) {
          reportError({ type: 'db_query', component: 'VatRowDrillDown', action: 'error', message: 'drill error:', error: error });
          break;
        }
        if (!chunk || chunk.length === 0) break;
        candidateInvoices.push(...chunk);
        if (chunk.length < pageSize) break;
        navPage++;
        if (navPage >= 10) break; // Safety cap 10,000 rows
      }

      // Paginated query for uploaded foreign / OCR invoices from invoices table
      let uploadedInvs: any[] = [];
      let appPage = 0;
      while (true) {
        const { data: chunk, error: appErr } = await supabase
          .from('invoices')
          .select(`
            id, bizonylatsorszam, elado_nev, vevo_nev, elado_vat_id, vevo_vat_id, invoice_direction,
            teljesites_datuma, kibocsatas_datuma, penznem, adoalap_osszesen, afa_osszeg_osszesen, forditott_adozas, vat_row_override, vat_code_id,
            invoice_items(id, line_number, line_description, net_amount, vat_amount, vat_rate, quantity, unit_price, deductible_percentage, product_code, net_weight_kg, vat_code, vat_code_id)
          `)
          .eq('company_id', companyId)
          .or(
            `and(teljesites_datuma.gte.${dateFrom},teljesites_datuma.lte.${dateTo}),and(teljesites_datuma.is.null,kibocsatas_datuma.gte.${dateFrom},kibocsatas_datuma.lte.${dateTo})`
          )
          .in('invoice_direction', directions)
          .range(appPage * pageSize, (appPage + 1) * pageSize - 1);

        if (appErr || !chunk || chunk.length === 0) break;
        uploadedInvs.push(...chunk);
        if (chunk.length < pageSize) break;
        appPage++;
        if (appPage >= 10) break;
      }

      if (uploadedInvs.length > 0) {
        const navInvNumbers = new Set(candidateInvoices.map((d: any) => norm(d.invoice_number)));
        const missingUploaded = uploadedInvs.filter((u: any) => !navInvNumbers.has(norm(u.bizonylatsorszam)));
        const mappedUploaded = missingUploaded.map((u: any) => ({
          id: u.id,
          invoice_number: u.bizonylatsorszam,
          supplier_name: u.elado_nev,
          customer_name: u.vevo_nev,
          supplier_tax_number: u.elado_vat_id,
          customer_tax_number: u.vevo_vat_id,
          invoice_direction: u.invoice_direction || 'INBOUND',
          invoice_delivery_date: u.teljesites_datuma || u.kibocsatas_datuma,
          invoice_issue_date: u.kibocsatas_datuma,
          currency: u.penznem || 'HUF',
          invoice_net_amount: u.adoalap_osszesen || 0,
          invoice_vat_amount: u.afa_osszeg_osszesen || 0,
          is_reverse_charge: u.forditott_adozas || false,
          vat_row_override: u.vat_row_override,
          vat_code_id: u.vat_code_id,
          nav_invoice_items: u.invoice_items || [],
        }));
        candidateInvoices = [...candidateInvoices, ...mappedUploaded] as any;
      }

      // Fetch items and customer names from invoices table for nav_invoices in chunks of 200
      const invNumbers = candidateInvoices.map((d: any) => d.invoice_number).filter(Boolean);
      const appItemsMap: Record<string, any[]> = {};
      const appVevoMap: Record<string, string> = {};
      const appOverrideMap: Record<string, string> = {};

      if (invNumbers.length > 0) {
        const chunkSize = 200;
        for (let i = 0; i < invNumbers.length; i += chunkSize) {
          const slice = invNumbers.slice(i, i + chunkSize);
          const { data: appInvs } = await supabase
            .from('invoices')
            .select('bizonylatsorszam, vevo_nev, vat_row_override, vat_code_id, invoice_items(id, line_number, line_description, net_amount, vat_amount, vat_rate, quantity, unit_price, deductible_percentage, product_code, net_weight_kg, gl_classifications, vat_code, vat_code_id)')
            .eq('company_id', companyId)
            .in('bizonylatsorszam', slice);

          (appInvs || []).forEach((ai: any) => {
            const k = norm(ai.bizonylatsorszam);
            if (k) {
              if (ai.vevo_nev && ai.vevo_nev.trim()) {
                appVevoMap[k] = ai.vevo_nev.trim();
              }
              if (ai.vat_row_override) {
                appOverrideMap[k] = ai.vat_row_override;
              }
              if (ai.invoice_items && ai.invoice_items.length > 0) {
                appItemsMap[k] = ai.invoice_items;
                appItemsMap[ai.bizonylatsorszam] = ai.invoice_items;
              }
            }
          });
        }
      }

      const enrichedInvoices = candidateInvoices.map((inv: any) => {
        const navItems = inv.nav_invoice_items || [];
        const appItems = appItemsMap[norm(inv.invoice_number)] || appItemsMap[inv.invoice_number] || [];
        const submittedVevo = appVevoMap[norm(inv.invoice_number)] || null;
        const submittedOverride = appOverrideMap[norm(inv.invoice_number)] || null;
        const isOutbound = inv.invoice_direction === 'OUTBOUND';
        const isFromSub = isOutbound && (!inv.customer_name || inv.customer_name === 'Ismeretlen partner' || inv.customer_name === 'Ismeretlen vevő') && !!submittedVevo;
        const effectiveCustomer = isFromSub ? submittedVevo : inv.customer_name;

        const rawItems = navItems.length > 0 ? navItems : appItems;
        // Generate synthetic item if invoice has header amounts but no item lines (e.g. Magyar Telekom header-only invoices)
        const effectiveItems = rawItems.length > 0
          ? rawItems
          : (Number(inv.invoice_net_amount || 0) !== 0 || Number(inv.invoice_vat_amount || 0) !== 0)
            ? [{
                id: `synth_${inv.id}`,
                line_number: 1,
                line_description: inv.supplier_name ? `${inv.supplier_name} (Összesítő fejléc)` : 'Számla összesítő',
                quantity: 1,
                unit_price: Number(inv.invoice_net_amount || 0),
                net_amount: Number(inv.invoice_net_amount || 0),
                vat_amount: Number(inv.invoice_vat_amount || 0),
                vat_rate: Number(inv.invoice_net_amount || 0) > 0 && Number(inv.invoice_vat_amount || 0) > 0
                  ? `${Math.round((Number(inv.invoice_vat_amount) / Number(inv.invoice_net_amount)) * 100)}%`
                  : '0%',
                deductible_percentage: 100,
                product_code: null,
                net_weight_kg: null,
                vat_code: inv.vat_code || null,
                vat_code_id: inv.vat_code_id || null,
              }]
            : [];

        return {
          ...inv,
          customer_name: effectiveCustomer,
          is_customer_from_submitted: isFromSub,
          vat_row_override: inv.vat_row_override || submittedOverride,
          nav_invoice_items: effectiveItems,
        };
      });

      // Filter in memory to match either item vat_rates or header-level rates
      return enrichedInvoices.map((inv: any) => {
        // Effective tax date check aligned with calculate_hungarian_vat_return
        const effectiveDate = inv.ti_override || inv.calculated_ti || inv.invoice_delivery_date || inv.invoice_issue_date;
        if (!effectiveDate || effectiveDate < dateFrom || effectiveDate > dateTo) {
          return null;
        }

        const suppTax = (inv.supplier_tax_number || '').trim().toUpperCase();
        const custTax = (inv.customer_tax_number || '').trim().toUpperCase();
        const isEuSupplier = /^[A-Z]{2}/.test(suppTax) && !suppTax.startsWith('HU');
        const isForeign = isEuSupplier || (inv.currency && inv.currency !== 'HUF') || (suppTax !== '' && !suppTax.startsWith('HU') && !suppTax.includes('-') && !/^[0-9]{8}$/.test(suppTax));
        const isDomestic = !isForeign;
        const isInbound = inv.invoice_direction === 'INBOUND';
        const isEuCustomer = /^[A-Z]{2}/.test(custTax) && !custTax.startsWith('HU');

        // Fast reject checks
        if (rowNumber === '66' && isForeign) return null;
        if (rowNumber === '67' && !isForeign) return null;
        if (rowNumber === '43') {
          const hasOverride = inv.vat_row_override === '43';
          if (!hasOverride && !tangibleNumbers.has(inv.invoice_number) && !tangibleNumbers.has(norm(inv.invoice_number))) return null;
        }
        if (rowNumber === '45') {
          const hasAdvItem = (inv.nav_invoice_items || []).some((it: any) => (it.line_description || '').toLowerCase().includes('előleg'));
          if (!hasAdvItem && !advanceNumbers.has(inv.invoice_number) && !advanceNumbers.has(norm(inv.invoice_number)) && inv.vat_row_override !== '45') return null;
        }
        if (rowNumber === '77') {
          const hasTanItem = (inv.nav_invoice_items || []).some((it: any) => it.gl_classifications && /"gl_number":\s*"(1[0-9]{2}|9611|8611)/.test(JSON.stringify(it.gl_classifications)));
          if (!hasTanItem && !tangibleNumbers.has(inv.invoice_number) && !tangibleNumbers.has(norm(inv.invoice_number)) && inv.vat_row_override !== '77') return null;
        }

        const isItemForThisRow = (it: any) => {
          // Exclude DRS / Visszaváltási díj / Kupakdíj from ANY official VAT return row (Áfa tv. 71. §)
          const desc = String(it.line_description || '').toLowerCase();
          const vat = Number(it.vat_amount || 0);
          if (vat === 0 && (
            desc.includes('visszavált') ||
            desc.includes('visszavalt') ||
            desc.includes('drs') ||
            desc.includes('betétdíj') ||
            desc.includes('betetdij') ||
            desc.includes('kupakdíj') ||
            desc.includes('kupakdij') ||
            desc.includes('palackdíj') ||
            desc.includes('palackdij')
          )) {
            return false;
          }

          // Check if item or invoice has an assigned VAT code matching configured vat_codes
          const itemVatCodeId = it.vat_code_id || inv.vat_code_id;
          const itemVatCodeStr = String(it.vat_code || it.vat_code_code || '').trim().toUpperCase();
          const matchedCode = (vatCodes as VatCode[]).find(vc => 
            (itemVatCodeId && vc.id === itemVatCodeId) || 
            (itemVatCodeStr && vc.code.toUpperCase() === itemVatCodeStr)
          );

          if (matchedCode && matchedCode.target_rows && Array.isArray(matchedCode.target_rows) && matchedCode.target_rows.length > 0) {
            return matchedCode.target_rows.some((tr: any) => String(tr.row) === String(rowNumber));
          }

          // Invoice-level manual override
          if (inv.vat_row_override) {
            if (inv.vat_row_override === rowNumber) return true;
            if (rowNumber === '66' && ['29', '66_fad', '77'].includes(inv.vat_row_override)) return true;
          }

          const rateStr = String(it.vat_rate || '').trim().toUpperCase();
          const itNet = Number(it.net_amount || 0);
          const itVat = Number(it.vat_amount || 0);
          const codeStr = String(it.vat_code || it.vat_code_code || '').trim().toUpperCase();

          const isServiceItem = Boolean(
            ['ATHK', 'EUK', 'EUF', 'EUT', 'HO', 'EU_SZOLG_BE', 'KIM_EU_SZOLG', 'EU_SZOLG', '3_ORSZ_SZOLG'].includes(rateStr) ||
            (codeStr && (codeStr.startsWith('EU_SZOLG') || codeStr.startsWith('3_ORSZ') || codeStr.startsWith('BE_EU_SZOLG') || codeStr.startsWith('KIM_EU_SZOLG'))) ||
            (it?.product_code && /^(SZJ|TESZOR|[5-9][0-9]|62|63|69|70|71|72|73|74)/i.test(it.product_code)) ||
            (inv.supplier_name && /(google|meta|facebook|hetzner|adobe|microsoft|openai|anthropic|stripe|apple|digitalocean|cloudflare|github|aws|amazon|booking|airbnb|zoom|linkedin|ovh|atlassian|slack|canva|figma|notion|mailchimp|hubspot)/i.test(inv.supplier_name)) ||
            (it?.line_description && /(szolgáltat|szolgaltat|fejleszt|tanácsad|tanacsad|díj|dij|bérlet|berlet|licenc|license|előfizet|elofizet|audit|marketing|hirdet|hosting|domain|support|consulting|üzemeltet|oktatás|ügyintéz|service|subscription|advertising|cloud|api|software|jutalék|jutalek|commission|közvetít|szobaértékesítés)/i.test(it.line_description)) ||
            ((Number(it?.net_weight_kg) || 0) === 0 && !/^[0-4][0-9]/.test(it?.product_code || ''))
          );

          if (isInbound) {
            if (rowNumber === '29') {
              return isFadItem(it, inv, isDomestic);
            }
            if (rowNumber === '66_fad') {
              return isFadItem(it, inv, isDomestic);
            }
            if (rowNumber === '77') {
              const isTan = inv.vat_row_override === '77' ||
                tangibleNumbers.has(inv.invoice_number) ||
                tangibleNumbers.has(norm(inv.invoice_number)) ||
                (it.gl_classifications && /"gl_number":\s*"(1[0-9]{2}|9611|8611)/.test(JSON.stringify(it.gl_classifications)));
              return isTan && (itVat > 0 || itNet !== 0);
            }
            if (rowNumber === '18') {
              return isEuSupplier && isServiceItem;
            }
            if (rowNumber === '27') {
              return isForeign && !isEuSupplier && isServiceItem;
            }
            if (rowNumber === '67') {
              return isForeign && isServiceItem;
            }
            if (rowNumber === '69') {
              return isEuSupplier && !isServiceItem;
            }
            if (['11', '12', '13', '14', '15', '16'].includes(rowNumber || '')) {
              if (!isEuSupplier || isServiceItem) return false;
              if (rowNumber === '11') return ['0', '0.0', '0.00', '0%', 'TAM', 'AAM', 'MENTES'].includes(rateStr) || itVat === 0;
              if (rowNumber === '12') return ['5%', '0.05', '5'].includes(rateStr) || (codeStr && codeStr.endsWith('_5'));
              if (rowNumber === '13') return ['18%', '0.18', '18'].includes(rateStr) || (codeStr && codeStr.endsWith('_18'));
              return true;
            }
            if (rowNumber === '63') {
              if (!isDomestic || inv.is_reverse_charge) return false;
              if (isFadItem(it, inv, isDomestic)) return false;
              if (itVat === 0 && itNet !== 0) return true;
              return ['0', '0.0', '0.00', '0%', 'TAM', 'AAM', 'MENTES', 'K-AFA'].includes(rateStr);
            }
            if (rowNumber === '64') {
              if (!isDomestic || inv.is_reverse_charge) return false;
              return ['5%', '0.05', '5', '5.0', '5.00'].includes(rateStr) || (itNet !== 0 && Math.round((itVat / itNet) * 100) === 5);
            }
            if (rowNumber === '65') {
              if (!isDomestic || inv.is_reverse_charge) return false;
              return ['18%', '0.18', '18', '18.0', '18.00'].includes(rateStr) || (itNet !== 0 && Math.round((itVat / itNet) * 100) === 18);
            }
            if (rowNumber === '66') {
              if (!isDomestic) return false;
              if (isFadItem(it, inv, isDomestic)) return true;
              return ['27%', '0.27', '27', '27.0', '27.00'].includes(rateStr) || (itNet !== 0 && Math.round((itVat / itNet) * 100) === 27);
            }
          } else {
            if (rowNumber === '01') return isEuCustomer && !isServiceItem && (codeStr.includes('EXP') || rateFilters.includes(rateStr));
            if (rowNumber === '02') return isEuCustomer && !isServiceItem;
            if (rowNumber === '04') return inv.is_reverse_charge || rateStr.includes('FAD') || codeStr.includes('FAD');
            if (rowNumber === '05') return ['5%', '0.05', '5', '5.0', '5.00'].includes(rateStr) || (itNet !== 0 && Math.round((itVat / itNet) * 100) === 5);
            if (rowNumber === '06') return ['18%', '0.18', '18', '18.0', '18.00'].includes(rateStr) || (itNet !== 0 && Math.round((itVat / itNet) * 100) === 18);
            if (rowNumber === '07') return ['27%', '0.27', '27', '27.0', '27.00'].includes(rateStr) || (itNet !== 0 && Math.round((itVat / itNet) * 100) === 27);
            if (rowNumber === '08') return !isEuCustomer && !inv.is_reverse_charge && (itVat === 0 || ['0', '0.0', '0.00', '0%', 'TAM', 'AAM', 'MENTES'].includes(rateStr));
            if (rowNumber === '43') return inv.vat_row_override === '43' || tangibleNumbers.has(inv.invoice_number) || tangibleNumbers.has(norm(inv.invoice_number));
            if (rowNumber === '45') return String(it.line_description || '').toLowerCase().includes('előleg') || inv.vat_row_override === '45' || advanceNumbers.has(inv.invoice_number) || advanceNumbers.has(norm(inv.invoice_number));
            if (rowNumber === '91') return !isDomestic && !isEuCustomer;
            if (rowNumber === '92') return isEuCustomer && isServiceItem;
          }

          if (rateFilters.includes(rateStr)) return true;
          if (itNet > 0 && itVat > 0) {
            const calcRate = Math.round((itVat / itNet) * 100);
            return vatPercents.some((p: any) => Math.abs(Number(p) - calcRate) <= 1);
          }
          if (vatPercents.some((p: any) => Number(p) === 0) && itVat === 0 && itNet !== 0) return true;
          return false;
        };

        const items = inv.nav_invoice_items || [];
        const matchingItems = items.filter(isItemForThisRow);

        let matchesInvoice = false;
        if (items.length > 0) {
          matchesInvoice = matchingItems.length > 0;
        } else {
          // If invoice has a known vat_code assigned, test its target_rows
          const invVatCodeId = inv.vat_code_id;
          const invCodeObj = (vatCodes as VatCode[]).find(vc => vc.id === invVatCodeId);
          if (invCodeObj && invCodeObj.target_rows && Array.isArray(invCodeObj.target_rows) && invCodeObj.target_rows.length > 0) {
            matchesInvoice = invCodeObj.target_rows.some((tr: any) => String(tr.row) === String(rowNumber));
          } else {
            const net = Number(inv.invoice_net_amount || 0);
            const vat = Number(inv.invoice_vat_amount || 0);
            if (rowNumber === '63') {
              matchesInvoice = isDomestic && !inv.is_reverse_charge && vat === 0 && net !== 0;
            } else if (rowNumber === '29' || rowNumber === '66_fad') {
              matchesInvoice = isDomestic && inv.is_reverse_charge;
            } else if (rowNumber === '66') {
              matchesInvoice = isDomestic && (inv.is_reverse_charge || (vat > 0 && Math.round((vat / net) * 100) === 27));
            } else if (rowNumber === '18') {
              matchesInvoice = isEuSupplier;
            } else if (rowNumber === '27') {
              matchesInvoice = isForeign && !isEuSupplier;
            } else if (['11', '12', '13', '14', '15', '16', '69'].includes(rowNumber || '')) {
              matchesInvoice = isEuSupplier;
            } else if (rowNumber === '67') {
              matchesInvoice = isForeign;
            } else if (rowNumber === '02') {
              matchesInvoice = isEuCustomer;
            } else if (rowNumber === '91' || rowNumber === '92') {
              matchesInvoice = isEuCustomer;
            } else if (net > 0 && vat > 0) {
              const calcRate = Math.round((vat / net) * 100);
              matchesInvoice = vatPercents.some((p: any) => Math.abs(Number(p) - calcRate) <= 1);
            } else if (vatPercents.some((p: any) => Number(p) === 0) && vat === 0 && net !== 0) {
              matchesInvoice = true;
            }
          }
        }

        if (!matchesInvoice) return null;

        return {
          ...inv,
          matching_items: matchingItems.length > 0 ? matchingItems : items,
        };
      }).filter(Boolean);
    },
    enabled: isValidUUID(companyId),
    staleTime: 30_000,
  });

  const [subFilter, setSubFilter] = useState<'ALL' | 'FAD' | 'NORMAL'>('ALL');

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-6 py-3 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Számlák betöltése...
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="px-6 py-3 text-xs text-muted-foreground italic">
        Nincs számla ehhez a sorhoz a kiválasztott időszakban.
      </div>
    );
  }

  const isFadInv = (inv: any) => {
    if (inv.is_reverse_charge) return true;
    const items = inv.matching_items && inv.matching_items.length > 0 ? inv.matching_items : (inv.nav_invoice_items || []);
    const suppTax = (inv.supplier_tax_number || '').trim().toUpperCase();
    const isEuSupplier = /^[A-Z]{2}/.test(suppTax) && !suppTax.startsWith('HU');
    const isForeign = isEuSupplier || (inv.currency && inv.currency !== 'HUF') || (suppTax !== '' && !suppTax.startsWith('HU') && !suppTax.includes('-') && !/^[0-9]{8}$/.test(suppTax));
    return items.some((it: any) => isFadItem(it, inv, !isForeign));
  };

  const fadInvoices = invoices.filter(isFadInv);
  const normalInvoices = invoices.filter((inv: any) => !isFadInv(inv));
  const displayedInvoices = rowNumber === '66'
    ? (subFilter === 'FAD' ? fadInvoices : subFilter === 'NORMAL' ? normalInvoices : invoices)
    : invoices;

  const fmtHuf = (v: number) => `${formatThousands(v)} Ft`;

  const grandNet = displayedInvoices.reduce((s: number, inv: any) => {
    const currency = inv.currency || 'HUF';
    const rate = getRate(currency);
    const suppTax = (inv.supplier_tax_number || '').trim().toUpperCase();
    const isEuSupplier = /^[A-Z]{2}/.test(suppTax) && !suppTax.startsWith('HU');
    const isForeign = isEuSupplier || (inv.currency && inv.currency !== 'HUF') || (suppTax !== '' && !suppTax.startsWith('HU') && !suppTax.includes('-') && !/^[0-9]{8}$/.test(suppTax));
    const isDomestic = !isForeign;
    let items = inv.matching_items && inv.matching_items.length > 0 ? inv.matching_items : (inv.nav_invoice_items || []);
    if (rowNumber === '66' && subFilter === 'FAD') {
      items = items.filter((it: any) => isFadItem(it, inv, isDomestic));
    } else if (rowNumber === '66' && subFilter === 'NORMAL') {
      items = items.filter((it: any) => !isFadItem(it, inv, isDomestic));
    }
    const isInbound = inv.invoice_direction === 'INBOUND';
    const isPayableRow = ['01', '02', '03', '04', '05', '06', '07', '08', '11', '12', '13', '14', '15', '16', '18', '27', '29', '91', '92'].includes(rowNumber || '');
    const netSum = items.length > 0
      ? items.reduce((is: number, i: any) => {
          const ratio = (isInbound && !isPayableRow) ? (Number(i.deductible_percentage ?? 100) / 100.0) : 1.0;
          return is + ((Number(i.net_amount) || 0) * ratio);
        }, 0)
      : Number(inv.invoice_net_amount || 0);
    return s + (netSum * rate);
  }, 0);

  const grandVat = displayedInvoices.reduce((s: number, inv: any) => {
    const currency = inv.currency || 'HUF';
    const rate = getRate(currency);
    const suppTax = (inv.supplier_tax_number || '').trim().toUpperCase();
    const isEuSupplier = /^[A-Z]{2}/.test(suppTax) && !suppTax.startsWith('HU');
    const isForeign = isEuSupplier || (inv.currency && inv.currency !== 'HUF') || (suppTax !== '' && !suppTax.startsWith('HU') && !suppTax.includes('-') && !/^[0-9]{8}$/.test(suppTax));
    const isDomestic = !isForeign;
    let items = inv.matching_items && inv.matching_items.length > 0 ? inv.matching_items : (inv.nav_invoice_items || []);
    if (rowNumber === '66' && subFilter === 'FAD') {
      items = items.filter((it: any) => isFadItem(it, inv, isDomestic));
    } else if (rowNumber === '66' && subFilter === 'NORMAL') {
      items = items.filter((it: any) => !isFadItem(it, inv, isDomestic));
    }
    const isInbound = inv.invoice_direction === 'INBOUND';
    const isPayableRow = ['01', '02', '03', '04', '05', '06', '07', '08', '11', '12', '13', '14', '15', '16', '18', '27', '29', '91', '92'].includes(rowNumber || '');
    const vatSum = items.length > 0
      ? items.reduce((is: number, i: any) => {
          const ratio = (isInbound && !isPayableRow) ? (Number(i.deductible_percentage ?? 100) / 100.0) : 1.0;
          let itVat = Number(i.vat_amount || 0);
          if (itVat === 0) {
            if (rowNumber === '29') {
              itVat = Math.round((Number(i.net_amount) || 0) * 0.27);
            } else if ((rowNumber === '66' || rowNumber === '66_fad') && isFadItem(i, inv, isDomestic)) {
              itVat = Math.round((Number(i.net_amount) || 0) * 0.27);
            } else if (['14', '15', '16', '18', '27', '67', '69'].includes(rowNumber || '')) {
              itVat = Math.round((Number(i.net_amount) || 0) * 0.27);
            } else if (rowNumber === '13') {
              itVat = Math.round((Number(i.net_amount) || 0) * 0.18);
            } else if (rowNumber === '12') {
              itVat = Math.round((Number(i.net_amount) || 0) * 0.05);
            }
          }
          return is + (itVat * ratio);
        }, 0)
      : (() => {
          let invVat = Number(inv.invoice_vat_amount || 0);
          if (invVat === 0) {
            const net = Number(inv.invoice_net_amount || 0);
            if (rowNumber === '29') {
              invVat = Math.round(net * 0.27);
            } else if ((rowNumber === '66' || rowNumber === '66_fad') && (inv.is_reverse_charge || inv.matching_items?.some((it: any) => isFadItem(it, inv, isDomestic)))) {
              invVat = Math.round(net * 0.27);
            } else if (['14', '15', '16', '18', '27', '67', '69'].includes(rowNumber || '')) {
              invVat = Math.round(net * 0.27);
            } else if (rowNumber === '13') {
              invVat = Math.round(net * 0.18);
            } else if (rowNumber === '12') {
              invVat = Math.round(net * 0.05);
            }
          }
          return invVat;
        })();
    return s + (vatSum * rate);
  }, 0);

  return (
    <div className="bg-muted/15 border-t border-b border-border/30 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* 66-os sor FAD gyorsszűrő sáv */}
      {rowNumber === '66' && (
        <div className="flex items-center gap-2 px-6 py-2 bg-muted/20 border-b border-border/20 text-xs">
          <span className="text-[11px] font-medium text-muted-foreground mr-1">66. sor szűrés:</span>
          <button
            type="button"
            className={cn(
              "px-2.5 py-1 rounded text-xs font-medium transition-colors",
              subFilter === 'ALL'
                ? "bg-background shadow-xs text-foreground font-semibold border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setSubFilter('ALL')}
          >
            Összes 27% tétel ({invoices.length})
          </button>
          <button
            type="button"
            className={cn(
              "px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5",
              subFilter === 'FAD'
                ? "bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/30"
                : "text-purple-600/80 hover:text-purple-700 dark:hover:text-purple-300"
            )}
            onClick={() => setSubFilter('FAD')}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Csak FAD tételek ({fadInvoices.length})
          </button>
          <button
            type="button"
            className={cn(
              "px-2.5 py-1 rounded text-xs font-medium transition-colors",
              subFilter === 'NORMAL'
                ? "bg-background shadow-xs text-foreground font-semibold border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setSubFilter('NORMAL')}
          >
            Normál 27% ({normalInvoices.length})
          </button>
        </div>
      )}
      {/* header */}
      <div className="grid grid-cols-12 gap-2 px-6 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider bg-muted/10 border-b border-border/10">
        <div className="col-span-3">Számla</div>
        <div className="col-span-3">Partner</div>
        <div className="col-span-2 text-center">Teljesítés</div>
        <div className="col-span-2 text-right">Nettó</div>
        <div className="col-span-2 text-right">ÁFA</div>
      </div>
      {displayedInvoices.map((inv: any) => {
        const items = inv.nav_invoice_items || [];
        const isInbound = inv.invoice_direction === 'INBOUND';
        const partner = isInbound ? inv.supplier_name : inv.customer_name;
        
        const currency = inv.currency || 'HUF';
        const rate = getRate(currency);
        const isForeign = currency.toUpperCase() !== 'HUF';
        const suppTax = (inv.supplier_tax_number || '').trim().toUpperCase();
        const isEuSupplier = /^[A-Z]{2}/.test(suppTax) && !suppTax.startsWith('HU');
        const isForeignSupplier = isEuSupplier || (inv.currency && inv.currency !== 'HUF') || (suppTax !== '' && !suppTax.startsWith('HU') && !suppTax.includes('-') && !/^[0-9]{8}$/.test(suppTax));
        const isDomestic = !isForeignSupplier;

        let displayItems = inv.matching_items && inv.matching_items.length > 0 ? inv.matching_items : items;
        if (rowNumber === '66' && subFilter === 'FAD') {
          displayItems = displayItems.filter((it: any) => isFadItem(it, inv, isDomestic));
        } else if (rowNumber === '66' && subFilter === 'NORMAL') {
          displayItems = displayItems.filter((it: any) => !isFadItem(it, inv, isDomestic));
        }

        const isPayableRow = ['01', '02', '03', '04', '05', '06', '07', '08', '11', '12', '13', '14', '15', '16', '18', '27', '29', '91', '92'].includes(rowNumber || '');
        const origNet = displayItems.length > 0
          ? displayItems.reduce((s: number, i: any) => {
              const ratio = (isInbound && !isPayableRow) ? (Number(i.deductible_percentage ?? 100) / 100.0) : 1.0;
              return s + ((Number(i.net_amount) || 0) * ratio);
            }, 0)
          : Number(inv.invoice_net_amount || 0);

        const origVat = displayItems.length > 0
          ? displayItems.reduce((s: number, i: any) => {
              const ratio = (isInbound && !isPayableRow) ? (Number(i.deductible_percentage ?? 100) / 100.0) : 1.0;
              let itVat = Number(i.vat_amount || 0);
              if (itVat === 0) {
                if (rowNumber === '29') {
                  itVat = Math.round((Number(i.net_amount) || 0) * 0.27);
                } else if ((rowNumber === '66' || rowNumber === '66_fad') && isFadItem(i, inv, isDomestic)) {
                  itVat = Math.round((Number(i.net_amount) || 0) * 0.27);
                } else if (['14', '15', '16', '18', '27', '67', '69'].includes(rowNumber || '')) {
                  itVat = Math.round((Number(i.net_amount) || 0) * 0.27);
                } else if (rowNumber === '13') {
                  itVat = Math.round((Number(i.net_amount) || 0) * 0.18);
                } else if (rowNumber === '12') {
                  itVat = Math.round((Number(i.net_amount) || 0) * 0.05);
                }
              }
              return s + (itVat * ratio);
            }, 0)
          : (() => {
              let invVat = Number(inv.invoice_vat_amount || 0);
              if (invVat === 0) {
                const net = Number(inv.invoice_net_amount || 0);
                if (rowNumber === '29') {
                  invVat = Math.round(net * 0.27);
                } else if ((rowNumber === '66' || rowNumber === '66_fad') && (inv.is_reverse_charge || inv.matching_items?.some((it: any) => isFadItem(it, inv, isDomestic)))) {
                  invVat = Math.round(net * 0.27);
                } else if (['14', '15', '16', '18', '27', '67', '69'].includes(rowNumber || '')) {
                  invVat = Math.round(net * 0.27);
                } else if (rowNumber === '13') {
                  invVat = Math.round(net * 0.18);
                } else if (rowNumber === '12') {
                  invVat = Math.round(net * 0.05);
                }
              }
              return invVat;
            })();

        const totalNet = Math.round(origNet * rate);
        const totalVat = Math.round(origVat * rate);
        const isExpanded = expandedInv === inv.id;

        return (
          <React.Fragment key={inv.id}>
            <div
              className={cn(
                "grid grid-cols-12 gap-2 px-6 py-1.5 text-[11px] items-center cursor-pointer transition-colors",
                isExpanded ? "bg-primary/5" : "hover:bg-muted/20"
              )}
              onClick={() => setExpandedInv(isExpanded ? null : inv.id)}
            >
              <div className="col-span-3 flex items-center gap-1.5">
                {isExpanded ? <ChevronDown className="w-3 h-3 shrink-0 text-primary" /> : <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />}
                <span className="font-mono font-medium truncate">{inv.invoice_number}</span>
              </div>
              <div className="col-span-3 truncate text-muted-foreground flex items-center gap-1.5" title={partner || '—'}>
                <span className="truncate">{partner || '—'}</span>
                {!isInbound && inv.is_customer_from_submitted && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="shrink-0 inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-medium bg-primary/10 text-primary border border-primary/20 cursor-help">
                          <FileText className="w-2.5 h-2.5" />
                          Számláról
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        A vevő neve a beküldött saját számláról származik
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <div className="col-span-2 text-center tabular-nums text-muted-foreground">
                {inv.invoice_delivery_date ? new Date(inv.invoice_delivery_date).toLocaleDateString('hu-HU') : '—'}
              </div>
              <div className="col-span-2 text-right tabular-nums">
                <div>{fmtHuf(totalNet)}</div>
                {isForeign && (
                  <div className="text-[9px] text-muted-foreground/60 font-normal">
                    {formatThousands(origNet, { decimals: 2 })} {currency}
                  </div>
                )}
              </div>
              <div className="col-span-2 text-right tabular-nums font-medium">
                <div>{fmtHuf(totalVat)}</div>
                {isForeign && (
                  <div className="text-[9px] text-muted-foreground/60 font-normal text-muted-foreground/50">
                    {formatThousands(origVat, { decimals: 2 })} {currency}
                  </div>
                )}
              </div>
            </div>
            {isExpanded && displayItems.length > 0 && (
              <div className="bg-background/50 border border-border/20 rounded mx-6 mb-1.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="grid grid-cols-12 gap-2 px-3 py-1 text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider bg-muted/10 border-b border-border/10">
                  <div className="col-span-4">Megnevezés</div>
                  <div className="col-span-2 text-right">Mennyiség</div>
                  <div className="col-span-2 text-right">Egységár</div>
                  <div className="col-span-2 text-right">Nettó</div>
                  <div className="col-span-2 text-right">ÁFA</div>
                </div>
                {displayItems.map((item: any, j: number) => {
                  const deductible = Number(item.deductible_percentage ?? 100);
                  const isPartial = deductible < 100;
                  const itemNet = Number(item.net_amount || 0);
                  const rawItemVat = Number(item.vat_amount || 0);
                  const isItemFad = isFadItem(item, inv, isDomestic);
                  let calculatedVat = rawItemVat;
                  if (calculatedVat === 0) {
                    if (rowNumber === '29' || ((rowNumber === '66' || rowNumber === '66_fad') && isItemFad)) {
                      calculatedVat = Math.round(itemNet * 0.27);
                    } else if (['14', '15', '16', '18', '27', '67', '69'].includes(rowNumber || '')) {
                      calculatedVat = Math.round(itemNet * 0.27);
                    } else if (rowNumber === '13') {
                      calculatedVat = Math.round(itemNet * 0.18);
                    } else if (rowNumber === '12') {
                      calculatedVat = Math.round(itemNet * 0.05);
                    }
                  }
                  const itemVat = calculatedVat;
                  const itemRatio = (isInbound && !isPayableRow) ? (deductible / 100.0) : 1.0;
                  const itemNetHuf = Math.round(itemNet * rate * itemRatio);
                  const itemVatHuf = Math.round(itemVat * rate * itemRatio);
                  
                  let glNum: string | null = null;
                  if (item.gl_classifications) {
                    const str = JSON.stringify(item.gl_classifications);
                    const match = str.match(/"gl_number":\s*"([^"]+)"/);
                    if (match) glNum = match[1];
                  }

                  return (
                    <div key={j} className="grid grid-cols-12 gap-2 px-3 py-1 text-[10px] text-muted-foreground hover:bg-muted/15 transition-colors items-center">
                      <div className="col-span-4 flex items-center gap-1.5 truncate" title={item.line_description}>
                        <span className="truncate font-medium text-foreground/80">{item.line_description || '—'}</span>
                        {item.product_code && (
                          <span className="shrink-0 text-[9px] font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground border border-border/40">
                            {item.product_code}
                          </span>
                        )}
                        {item.net_weight_kg != null && (
                          <span className="shrink-0 text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                            {item.net_weight_kg} kg
                          </span>
                        )}
                        {isItemFad && (
                          <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                            FAD 27%
                          </span>
                        )}
                        {item.vat_code && !isItemFad && (
                          <span className="shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            {item.vat_code}
                          </span>
                        )}
                        {isPartial && (
                          <span className="shrink-0 text-[9px] font-medium px-1 py-0.2 rounded bg-amber-500/15 text-amber-600 border border-amber-500/30">
                            {deductible}% lev.
                          </span>
                        )}
                        {glNum && (
                          <span className="shrink-0 text-[9px] font-mono px-1 py-0.2 rounded bg-primary/10 text-primary border border-primary/20">
                            {glNum}
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 text-right tabular-nums">{item.quantity != null ? formatThousands(Number(item.quantity)) : '—'}</div>
                      <div className="col-span-2 text-right tabular-nums">{item.unit_price != null ? formatThousands(Number(item.unit_price)) : '—'}</div>
                      <div className="col-span-2 text-right tabular-nums font-normal">
                        <div>{fmtHuf(itemNetHuf)}</div>
                        {isForeign && (
                          <div className="text-[8px] text-muted-foreground/50">
                            {formatThousands(itemNet, { decimals: 2 })} {currency}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 text-right tabular-nums font-normal">
                        <div>{fmtHuf(itemVatHuf)}</div>
                        {isForeign && (
                          <div className="text-[8px] text-muted-foreground/50">
                            {formatThousands(calculatedVat, { decimals: 2 })} {currency}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {isExpanded && displayItems.length === 0 && (
              <div className="bg-muted/10 border border-dashed border-border/40 rounded mx-6 mb-2 px-4 py-2.5 text-xs text-muted-foreground italic flex items-center gap-2 animate-in fade-in duration-150">
                <span>Ehhez a bizonylathoz nincsenek részletező tételsorok rögzítve (fejléc-szintű összesítés).</span>
              </div>
            )}
          </React.Fragment>
        );
      })}
      {/* totals */}
      <div className="grid grid-cols-12 gap-2 px-6 py-1.5 text-[11px] font-semibold border-t border-border/30 bg-muted/10">
        <div className="col-span-6 text-muted-foreground">Összesen ({displayedInvoices.length} számla)</div>
        <div className="col-span-2" />
        <div className="col-span-2 text-right tabular-nums">
          {fmtHuf(grandNet)}
        </div>
        <div className="col-span-2 text-right tabular-nums">
          {fmtHuf(grandVat)}
        </div>
      </div>
    </div>
  );
}
