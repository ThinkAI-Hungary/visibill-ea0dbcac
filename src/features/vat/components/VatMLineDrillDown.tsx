import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronDown, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { InvoiceItemsDrillDown } from '@/components/vat/VatRowDrillDown';
import { fmtEft } from '../types';
import type { MLine, VatFrequency } from '../types';

interface VatMLineDrillDownProps {
  mLine: MLine;
  companyId: string;
  year: number;
  month: number;
  frequency: VatFrequency;
  expandedInvoice: string | null;
  setExpandedInvoice: (key: string | null) => void;
}

export function VatMLineDrillDown({
  mLine,
  companyId,
  year,
  month,
  frequency,
  expandedInvoice,
  setExpandedInvoice,
}: VatMLineDrillDownProps) {
  const { dateFrom, dateTo } = React.useMemo(() => {
    if (frequency === 'H') {
      const from = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { dateFrom: from, dateTo: to };
    } else if (frequency === 'N') {
      const startMonth = (month - 1) * 3 + 1;
      const from = `${year}-${String(startMonth).padStart(2, '0')}-01`;
      const endMonth = startMonth + 2;
      const lastDay = new Date(year, endMonth, 0).getDate();
      const to = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return { dateFrom: from, dateTo: to };
    } else {
      return { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` };
    }
  }, [year, month, frequency]);

  const hasPreloaded = Array.isArray(mLine.invoice_details) && mLine.invoice_details.length > 0;

  // Fallback query if DB row did not pre-aggregate invoice_details
  const { data: fetchedInvoices = [], isLoading } = useQuery({
    queryKey: ['m_line_invoices_fallback', companyId, mLine.partner_tax_number, dateFrom, dateTo],
    queryFn: async () => {
      if (!companyId || !mLine.partner_tax_number) return [];
      const tax8 = mLine.partner_tax_number.replace(/\D/g, '').substring(0, 8);
      if (!tax8) return [];

      // 1. Query nav_invoices
      const { data: navInvs, error: navErr } = await supabase
        .from('nav_invoices')
        .select('id, invoice_number, invoice_delivery_date, invoice_issue_date, ti_override, calculated_ti, invoice_net_amount, invoice_vat_amount, vat_row_override, currency')
        .eq('company_id', companyId)
        .eq('invoice_direction', 'INBOUND')
        .ilike('supplier_tax_number', `${tax8}%`);

      if (navErr) console.warn('Error fetching nav_invoices for M-lap drilldown:', navErr.message);

      // 2. Query invoices table
      const { data: appInvs, error: appErr } = await supabase
        .from('invoices')
        .select('id, bizonylatsorszam, teljesites_datuma, kibocsatas_datuma, adoalap_osszesen, afa_osszeg_osszesen, vat_row_override, penznem')
        .eq('company_id', companyId)
        .ilike('elado_vat_id', `${tax8}%`);

      if (appErr) console.warn('Error fetching invoices for M-lap drilldown:', appErr.message);

      const invoiceMap = new Map<string, any>();

      (navInvs || []).forEach((inv: any) => {
        const num = inv.invoice_number;
        if (!num) return;
        const date = inv.ti_override || inv.calculated_ti || inv.invoice_delivery_date || inv.invoice_issue_date;
        const dateStr = date ? String(date).substring(0, 10) : '';
        if (dateStr && (dateStr < dateFrom || dateStr > dateTo)) return;

        const net = Number(inv.invoice_net_amount || 0);
        const vat = Number(inv.invoice_vat_amount || 0);
        const rate = inv.vat_row_override
          ? `${inv.vat_row_override}. sor`
          : net > 0 && vat > 0
          ? `${Math.round((vat / net) * 100)}%`
          : '27%';

        invoiceMap.set(num, {
          invoice_number: num,
          invoice_id: inv.id,
          delivery_date: dateStr,
          net,
          vat,
          vat_rate: rate,
        });
      });

      (appInvs || []).forEach((inv: any) => {
        const num = inv.bizonylatsorszam;
        if (!num) return;
        const date = inv.teljesites_datuma || inv.kibocsatas_datuma;
        const dateStr = date ? String(date).substring(0, 10) : '';
        if (dateStr && (dateStr < dateFrom || dateStr > dateTo)) return;

        if (!invoiceMap.has(num)) {
          const net = Number(inv.adoalap_osszesen || 0);
          const vat = Number(inv.afa_osszeg_osszesen || 0);
          const rate = inv.vat_row_override
            ? `${inv.vat_row_override}. sor`
            : net > 0 && vat > 0
            ? `${Math.round((vat / net) * 100)}%`
            : '27%';

          invoiceMap.set(num, {
            invoice_number: num,
            invoice_id: inv.id,
            delivery_date: dateStr,
            net,
            vat,
            vat_rate: rate,
          });
        }
      });

      return Array.from(invoiceMap.values());
    },
    enabled: !hasPreloaded && !!companyId && !!mLine.partner_tax_number,
    staleTime: 60_000,
  });

  const finalInvoices = hasPreloaded ? (mLine.invoice_details as any[]) : fetchedInvoices;

  return (
    <div className="bg-muted/30 px-6 py-2.5 border-t border-border/20 animate-in fade-in duration-150">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-1.5">
        <span>Belföldi levonható számlák ({mLine.partner_name}):</span>
        {isLoading && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            Számlák betöltése...
          </span>
        )}
      </div>

      {isLoading && finalInvoices.length === 0 ? (
        <div className="py-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span>Számlák betöltése a NAV és bizonylat nyilvántartásból...</span>
        </div>
      ) : finalInvoices.length === 0 ? (
        <div className="bg-muted/20 border border-dashed border-border/40 rounded px-4 py-3 text-xs text-muted-foreground italic flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
          <span>Ehhez a partnerhez nem található részletező számla a kiválasztott időszakban ({year}/{String(month).padStart(2, '0')}).</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider pb-1 mb-1 border-b border-border/20 pl-4">
            <div className="col-span-3">Számlaszám</div>
            <div className="col-span-2">Teljesítés</div>
            <div className="col-span-2 text-right">Nettó (eFt)</div>
            <div className="col-span-2 text-right">ÁFA (eFt)</div>
            <div className="col-span-3 text-right">ÁFA kulcs / sor</div>
          </div>
          {finalInvoices.map((inv: any, i: number) => {
            const invKey = `${mLine.id}_${inv.invoice_number}_${i}`;
            const isInvExpanded = expandedInvoice === invKey;
            const netVal = Number(inv.net ?? inv.net_amount ?? 0);
            const vatVal = Number(inv.vat ?? inv.vat_amount ?? 0);
            const vatRateDisplay =
              inv.vat_rate === '0.27'
                ? '27%'
                : inv.vat_rate === '0.18'
                ? '18%'
                : inv.vat_rate === '0.05'
                ? '5%'
                : inv.vat_rate || '27%';

            return (
              <React.Fragment key={invKey}>
                <div
                  className="grid grid-cols-12 gap-2 text-xs py-1.5 pl-4 transition-colors cursor-pointer hover:bg-muted/40 text-muted-foreground hover:text-foreground rounded"
                  onClick={() => setExpandedInvoice(isInvExpanded ? null : invKey)}
                  title="Kattints a számla tételsorainak megtekintéséhez"
                >
                  <div className="col-span-3 font-mono flex items-center gap-1.5 text-foreground font-medium">
                    {isInvExpanded ? (
                      <ChevronDown className="w-3 h-3 text-primary shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                    )}
                    <span className="truncate">{inv.invoice_number}</span>
                  </div>
                  <div className="col-span-2 text-muted-foreground">
                    {inv.delivery_date ? String(inv.delivery_date).substring(0, 10) : '—'}
                  </div>
                  <div className="col-span-2 text-right tabular-nums">
                    {fmtEft(Math.round(netVal / 1000))}
                  </div>
                  <div className="col-span-2 text-right tabular-nums font-medium text-foreground">
                    {fmtEft(Math.round(vatVal / 1000))}
                  </div>
                  <div className="col-span-3 text-right font-medium">
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-muted/60 text-[10px]">
                      {vatRateDisplay}
                    </span>
                  </div>
                </div>

                {isInvExpanded && companyId && (
                  <div className="pl-6 pr-2 py-1">
                    <InvoiceItemsDrillDown
                      invoiceNumber={inv.invoice_number}
                      companyId={companyId}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </>
      )}
    </div>
  );
}
