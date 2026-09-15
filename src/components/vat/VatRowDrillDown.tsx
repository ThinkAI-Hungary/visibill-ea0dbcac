import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { reportError } from '@/lib/errorReporter';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { formatThousands } from '@/features/vat/types';


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
    queryKey: ['nav_invoice_items_drill', companyId, invoiceNumber],
    queryFn: async () => {
      const { data: inv } = await supabase
        .from('nav_invoices')
        .select('id')
        .eq('company_id', companyId)
        .eq('invoice_number', invoiceNumber)
        .limit(1)
        .maybeSingle();
      if (!(inv as any)?.id) return [];
      const { data: items } = await supabase
        .from('nav_invoice_items')
        .select('line_number, line_description, quantity, unit_price, net_amount, vat_amount, vat_rate, deductible_percentage')
        .eq('nav_invoice_id', (inv as any).id)
        .order('line_number');
      return (items || []) as any[];
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
              <span className="truncate">{item.line_description || '—'}</span>
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
      const { data } = await supabase.from('vat_codes').select('*').eq('company_id', companyId);
      return (data || []) as unknown as VatCode[];
    },
    staleTime: 60_000,
  });

  // Query invoices matching these VAT codes in the period
  const queryKeyStr = `${companyId}_${dateFrom}_${dateTo}_${rowNumber || ''}_${(sourceVatCodes || []).join(',')}`;
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['vat_row_drill', queryKeyStr],
    queryFn: async () => {
      let directions: string[] = [];
      let vatPercents: number[] = [];

      // 1. Direct resolution by standard NAV 65 rowNumber
      if (rowNumber === '01') { directions = ['OUTBOUND']; vatPercents = [0]; }
      else if (rowNumber === '03') { directions = ['OUTBOUND']; vatPercents = [5]; }
      else if (rowNumber === '05') { directions = ['OUTBOUND']; vatPercents = [18]; }
      else if (rowNumber === '07') { directions = ['OUTBOUND']; vatPercents = [27]; }
      else if (rowNumber === '18' || rowNumber === '27') { directions = ['INBOUND']; vatPercents = [27]; }
      else if (rowNumber === '64') { directions = ['INBOUND']; vatPercents = [5]; }
      else if (rowNumber === '65') { directions = ['INBOUND']; vatPercents = [18]; }
      else if (rowNumber === '66' || rowNumber === '67') { directions = ['INBOUND']; vatPercents = [27]; }
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
          const isInbound = codes.some(s => s.startsWith('BE_')) || (rowNumber && ['64','65','66','67'].includes(rowNumber));
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
        else if (Number(pct) === 0) rateFilters.push('0', '0.0', '0.00', '0%', 'TAM', 'AAM', 'DOMESTIC_REVERSE_CHARGE');
      }

      // Query nav_invoices with left join on items
      let query = supabase
        .from('nav_invoices')
        .select(`
          id, invoice_number, supplier_name, customer_name, invoice_direction,
          invoice_delivery_date, currency, invoice_net_amount, invoice_vat_amount,
          nav_invoice_items(id, line_number, line_description, net_amount, vat_amount, vat_rate, quantity, unit_price, deductible_percentage)
        `)
        .eq('company_id', companyId)
        .gte('invoice_delivery_date', dateFrom)
        .lte('invoice_delivery_date', dateTo)
        .in('invoice_direction', directions)
        .order('invoice_delivery_date', { ascending: true });

      const { data, error } = await query;
      if (error) { reportError({ type: 'db_query', component: 'VatRowDrillDown', action: 'error', message: 'drill error:', error: error }); return []; }

      // Filter in memory to match either item vat_rates or header-level rates if items aren't fetched yet
      return (data || []).filter((inv: any) => {
        const items = inv.nav_invoice_items || [];
        if (items.length > 0) {
          return items.some((it: any) => rateFilters.includes(String(it.vat_rate)));
        }
        const net = Number(inv.invoice_net_amount || 0);
        const vat = Number(inv.invoice_vat_amount || 0);
        if (net > 0 && vat > 0) {
          const calcRate = Math.round((vat / net) * 100);
          return vatPercents.some((p: any) => Math.abs(Number(p) - calcRate) <= 1);
        }
        if (vatPercents.some((p: any) => Number(p) === 0) && vat === 0) {
          return true;
        }
        return false;
      });
    },
    enabled: !!companyId,
    staleTime: 30_000,
  });

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

  const fmtHuf = (v: number) => `${formatThousands(v)} Ft`;

  const grandNet = invoices.reduce((s: number, inv: any) => {
    const currency = inv.currency || 'HUF';
    const rate = getRate(currency);
    const items = inv.nav_invoice_items || [];
    const isInbound = inv.invoice_direction === 'INBOUND';
    const netSum = items.length > 0
      ? items.reduce((is: number, i: any) => {
          const ratio = isInbound ? (Number(i.deductible_percentage ?? 100) / 100.0) : 1.0;
          return is + ((Number(i.net_amount) || 0) * ratio);
        }, 0)
      : Number(inv.invoice_net_amount || 0);
    return s + (netSum * rate);
  }, 0);

  const grandVat = invoices.reduce((s: number, inv: any) => {
    const currency = inv.currency || 'HUF';
    const rate = getRate(currency);
    const items = inv.nav_invoice_items || [];
    const isInbound = inv.invoice_direction === 'INBOUND';
    const vatSum = items.length > 0
      ? items.reduce((is: number, i: any) => {
          const ratio = isInbound ? (Number(i.deductible_percentage ?? 100) / 100.0) : 1.0;
          return is + ((Number(i.vat_amount) || 0) * ratio);
        }, 0)
      : Number(inv.invoice_vat_amount || 0);
    return s + (vatSum * rate);
  }, 0);

  return (
    <div className="bg-muted/15 border-t border-b border-border/30 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* header */}
      <div className="grid grid-cols-12 gap-2 px-6 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider bg-muted/10 border-b border-border/10">
        <div className="col-span-3">Számla</div>
        <div className="col-span-3">Partner</div>
        <div className="col-span-2 text-center">Teljesítés</div>
        <div className="col-span-2 text-right">Nettó</div>
        <div className="col-span-2 text-right">ÁFA</div>
      </div>
      {invoices.map((inv: any) => {
        const items = inv.nav_invoice_items || [];
        const isInbound = inv.invoice_direction === 'INBOUND';
        const partner = isInbound ? inv.supplier_name : inv.customer_name;
        
        const currency = inv.currency || 'HUF';
        const rate = getRate(currency);
        const isForeign = currency.toUpperCase() !== 'HUF';

        const origNet = items.length > 0
          ? items.reduce((s: number, i: any) => {
              const ratio = isInbound ? (Number(i.deductible_percentage ?? 100) / 100.0) : 1.0;
              return s + ((Number(i.net_amount) || 0) * ratio);
            }, 0)
          : Number(inv.invoice_net_amount || 0);
        const origVat = items.length > 0
          ? items.reduce((s: number, i: any) => {
              const ratio = isInbound ? (Number(i.deductible_percentage ?? 100) / 100.0) : 1.0;
              return s + ((Number(i.vat_amount) || 0) * ratio);
            }, 0)
          : Number(inv.invoice_vat_amount || 0);

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
              <div className="col-span-3 truncate text-muted-foreground">{partner || '—'}</div>
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
            {isExpanded && items.length > 0 && (
              <div className="bg-background/50 border border-border/20 rounded mx-6 mb-1.5 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="grid grid-cols-12 gap-2 px-3 py-1 text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-wider bg-muted/10 border-b border-border/10">
                  <div className="col-span-4">Megnevezés</div>
                  <div className="col-span-2 text-right">Mennyiség</div>
                  <div className="col-span-2 text-right">Egységár</div>
                  <div className="col-span-2 text-right">Nettó</div>
                  <div className="col-span-2 text-right">ÁFA</div>
                </div>
                {items.map((item: any, j: number) => {
                  const itemNet = Number(item.net_amount || 0);
                  const itemVat = Number(item.vat_amount || 0);
                  const itemNetHuf = Math.round(itemNet * rate);
                  const itemVatHuf = Math.round(itemVat * rate);
                  return (
                    <div key={j} className="grid grid-cols-12 gap-2 px-3 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/15 transition-colors">
                      <div className="col-span-4 truncate" title={item.line_description}>{item.line_description || '—'}</div>
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
                            {formatThousands(itemVat, { decimals: 2 })} {currency}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </React.Fragment>
        );
      })}
      {/* totals */}
      <div className="grid grid-cols-12 gap-2 px-6 py-1.5 text-[11px] font-semibold border-t border-border/30 bg-muted/10">
        <div className="col-span-6 text-muted-foreground">Összesen ({invoices.length} számla)</div>
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
