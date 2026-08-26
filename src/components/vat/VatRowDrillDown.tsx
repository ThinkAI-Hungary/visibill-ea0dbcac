import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { reportError } from '@/lib/errorReporter';
import { useExchangeRates } from '@/hooks/useExchangeRates';


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
        .select('line_number, line_description, quantity, unit_price, net_amount, vat_amount, vat_rate')
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
      {items.map((item: any, j: number) => (
        <div key={j} className="grid grid-cols-12 gap-2 px-3 py-1 text-[11px] text-muted-foreground hover:bg-muted/20 transition-colors">
          <div className="col-span-4 truncate" title={item.line_description}>{item.line_description || '—'}</div>
          <div className="col-span-2 text-right tabular-nums">{item.quantity != null ? Number(item.quantity).toLocaleString('hu-HU') : '—'}</div>
          <div className="col-span-2 text-right tabular-nums">{item.unit_price != null ? Number(item.unit_price).toLocaleString('hu-HU') : '—'}</div>
          <div className="col-span-2 text-right tabular-nums">{Number(item.net_amount || 0).toLocaleString('hu-HU')} Ft</div>
          <div className="col-span-2 text-right tabular-nums">{Number(item.vat_amount || 0).toLocaleString('hu-HU')} Ft</div>
        </div>
      ))}
    </div>
  );
}


/* ────────────────────────────────────────── */
/*  VAT Row Drill-Down                        */
/* ────────────────────────────────────────── */
/** Drill-down: shows which invoices/items make up a given VAT return row */
export function VatRowDrillDown({ sourceVatCodes, companyId, year, month, frequency }: {
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

  // Filter to matching VAT codes
  const matchingCodes = useMemo(() =>
    vatCodes.filter(c => sourceVatCodes.includes(c.code)),
  [vatCodes, sourceVatCodes]);

  // Query invoices matching these VAT codes in the period
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['vat_row_drill', companyId, dateFrom, dateTo, sourceVatCodes.join(',')],
    queryFn: async () => {
      if (matchingCodes.length === 0) return [];

      // Get unique directions and rates
      const directions = [...new Set(matchingCodes.map(c => c.direction))];
      const vatPercents = [...new Set(matchingCodes.map(c => c.vat_percent))];

      // Build vat_rate filter values
      const rateFilters: string[] = [];
      for (const pct of vatPercents) {
        if (pct === 27) rateFilters.push('0.27', '27', '27.0', '27.00');
        else if (pct === 18) rateFilters.push('0.18', '18', '18.0', '18.00');
        else if (pct === 5) rateFilters.push('0.05', '5', '5.0', '5.00');
        else if (pct === 0) rateFilters.push('0', '0.0', '0.00', 'TAM', 'AAM', 'DOMESTIC_REVERSE_CHARGE');
      }

      // Query nav_invoices with their items
      let query = supabase
        .from('nav_invoices')
        .select(`
          id, invoice_number, supplier_name, customer_name, invoice_direction,
          invoice_delivery_date, currency,
          nav_invoice_items!inner(id, line_number, line_description, net_amount, vat_amount, vat_rate, quantity, unit_price)
        `)
        .eq('company_id', companyId)
        .gte('invoice_delivery_date', dateFrom)
        .lte('invoice_delivery_date', dateTo)
        .in('invoice_direction', directions)
        .in('nav_invoice_items.vat_rate', rateFilters)
        .order('invoice_delivery_date', { ascending: true });

      const { data, error } = await query;
      if (error) { reportError({ type: 'db_query', component: 'VatRowDrillDown', action: 'error', message: 'drill error:', error: error }); return []; }
      return (data || []) as any[];
    },
    enabled: matchingCodes.length > 0,
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

  const fmtHuf = (v: number) => `${Math.round(v).toLocaleString('hu-HU')} Ft`;

  const grandNet = invoices.reduce((s: number, inv: any) => {
    const currency = inv.currency || 'HUF';
    const rate = getRate(currency);
    const items = inv.nav_invoice_items || [];
    const netSum = items.reduce((is: number, i: any) => is + (Number(i.net_amount) || 0), 0);
    return s + (netSum * rate);
  }, 0);

  const grandVat = invoices.reduce((s: number, inv: any) => {
    const currency = inv.currency || 'HUF';
    const rate = getRate(currency);
    const items = inv.nav_invoice_items || [];
    const vatSum = items.reduce((is: number, i: any) => is + (Number(i.vat_amount) || 0), 0);
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

        const origNet = items.reduce((s: number, i: any) => s + (Number(i.net_amount) || 0), 0);
        const origVat = items.reduce((s: number, i: any) => s + (Number(i.vat_amount) || 0), 0);

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
                    {origNet.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                  </div>
                )}
              </div>
              <div className="col-span-2 text-right tabular-nums font-medium">
                <div>{fmtHuf(totalVat)}</div>
                {isForeign && (
                  <div className="text-[9px] text-muted-foreground/60 font-normal text-muted-foreground/50">
                    {origVat.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
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
                      <div className="col-span-2 text-right tabular-nums">{item.quantity != null ? Number(item.quantity).toLocaleString('hu-HU') : '—'}</div>
                      <div className="col-span-2 text-right tabular-nums">{item.unit_price != null ? Number(item.unit_price).toLocaleString('hu-HU') : '—'}</div>
                      <div className="col-span-2 text-right tabular-nums font-normal">
                        <div>{fmtHuf(itemNetHuf)}</div>
                        {isForeign && (
                          <div className="text-[8px] text-muted-foreground/50">
                            {itemNet.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 text-right tabular-nums font-normal">
                        <div>{fmtHuf(itemVatHuf)}</div>
                        {isForeign && (
                          <div className="text-[8px] text-muted-foreground/50">
                            {itemVat.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
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
