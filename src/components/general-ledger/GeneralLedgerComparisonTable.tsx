import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn, fixCharacterEncoding } from '@/lib/utils';
import { Loader2, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { useExchangeRates } from '@/hooks/useExchangeRates';

interface GeneralLedgerComparisonTableProps {
  presetId?: string;
  companyId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export function GeneralLedgerComparisonTable({
  presetId,
  companyId,
  dateFrom,
  dateTo,
}: GeneralLedgerComparisonTableProps) {
  const { data: exchangeRates } = useExchangeRates();

  // Compute previous year dates
  const prevDateFrom = useMemo(() => {
    if (!dateFrom) return '';
    const parts = dateFrom.split('-');
    if (parts.length < 1) return '';
    const prevYear = parseInt(parts[0], 10) - 1;
    return `${prevYear}-${parts[1] || '01'}-${parts[2] || '01'}`;
  }, [dateFrom]);

  const prevDateTo = useMemo(() => {
    if (!dateTo) return '';
    const parts = dateTo.split('-');
    if (parts.length < 1) return '';
    const prevYear = parseInt(parts[0], 10) - 1;
    return `${prevYear}-${parts[1] || '12'}-${parts[2] || '31'}`;
  }, [dateTo]);

  // Current year balances
  const { data: currData = [], isLoading: currLoading } = useQuery({
    queryKey: ['glBalancesCurr', presetId, companyId, dateFrom, dateTo],
    queryFn: async () => {
      if (!presetId || !companyId) return [];
      const { data, error } = await supabase.rpc('get_gl_balances', {
        p_company_id: companyId,
        p_preset_id: presetId,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
        p_exchange_rates: exchangeRates || {}
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!presetId && !!companyId && !!exchangeRates,
  });

  // Previous year balances
  const { data: prevData = [], isLoading: prevLoading } = useQuery({
    queryKey: ['glBalancesPrev', presetId, companyId, prevDateFrom, prevDateTo],
    queryFn: async () => {
      if (!presetId || !companyId || !prevDateFrom || !prevDateTo) return [];
      const { data, error } = await supabase.rpc('get_gl_balances', {
        p_company_id: companyId,
        p_preset_id: presetId,
        p_date_from: prevDateFrom,
        p_date_to: prevDateTo,
        p_exchange_rates: exchangeRates || {}
      });
      if (error) throw error;
      return data || [];
    },
    enabled: !!presetId && !!companyId && !!prevDateFrom && !!prevDateTo && !!exchangeRates,
  });

  const comparisonData = useMemo(() => {
    if (currLoading || prevLoading) return [];
    
    // Map previous year balances by gl_number
    const prevMap = new Map<string, number>();
    prevData.forEach(d => {
      prevMap.set(d.gl_number, Number(d.total_balance) || 0);
    });

    return currData.map(curr => {
      const glNumber = curr.gl_number;
      const name = fixCharacterEncoding(curr.short_name);
      const valCurr = Number(curr.total_balance) || 0;
      const valPrev = prevMap.get(glNumber) ?? 0;
      const diff = valCurr - valPrev;
      
      let pct = 0;
      if (valPrev !== 0) {
        pct = (diff / Math.abs(valPrev)) * 100;
      } else if (diff !== 0) {
        pct = 100; // went from 0 to something
      }

      return {
        glNumber,
        name,
        valCurr,
        valPrev,
        diff,
        pct,
      };
    }).sort((a, b) => a.glNumber.localeCompare(b.glNumber));
  }, [currData, prevData, currLoading, prevLoading]);

  const formatHuf = (v: number) => {
    return new Intl.NumberFormat('hu-HU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(v));
  };

  const currYearLabel = dateFrom ? dateFrom.substring(0, 4) : 'Tárgyév';
  const prevYearLabel = prevDateFrom ? prevDateFrom.substring(0, 4) : 'Előző év';

  if (currLoading || prevLoading) {
    return (
      <div className="flex justify-center items-center h-[350px] text-muted-foreground w-full">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-3 font-medium">Összehasonlító adatok betöltése...</span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden bg-card">
      <table className="w-full text-sm text-left">
        <thead className="bg-muted text-xs font-semibold text-foreground uppercase tracking-wider border-b">
          <tr>
            <th className="p-3 text-center w-[12%]">Fők. szám</th>
            <th className="p-3 w-[38%]">Megnevezés</th>
            <th className="p-3 text-right w-[15%]">{prevYearLabel} Egyenleg</th>
            <th className="p-3 text-right w-[15%]">{currYearLabel} Egyenleg</th>
            <th className="p-3 text-right w-[12%]">Eltérés (Ft)</th>
            <th className="p-3 text-center w-[8%]">Változás %</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {comparisonData.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                Nincsenek összehasonlító adatok a kiválasztott időszakra.
              </td>
            </tr>
          ) : (
            comparisonData.map((row) => {
              const classChar = row.glNumber ? row.glNumber[0] : '';
              const classBorderColor = 
                ['1', '2', '3'].includes(classChar) ? 'border-l-4 border-l-blue-500/70'
                : classChar === '4' ? 'border-l-4 border-l-purple-500/70'
                : ['5', '8'].includes(classChar) ? 'border-l-4 border-l-red-500/70'
                : classChar === '9' ? 'border-l-4 border-l-emerald-500/70'
                : '';

              const isHeading = row.glNumber.length <= 2;

              return (
                <tr
                  key={row.glNumber}
                  className={cn(
                    "hover:bg-muted/30 transition-colors",
                    isHeading ? "font-semibold bg-muted/10" : ""
                  )}
                >
                  <td className={cn("p-2.5 font-mono text-center text-xs text-muted-foreground", classBorderColor)}>
                    {row.glNumber}
                  </td>
                  <td className="p-2.5 text-xs font-medium text-foreground truncate max-w-[300px]" title={row.name}>
                    {row.name}
                  </td>
                  <td className="p-2.5 font-mono text-xs text-right tabular-nums">
                    {formatHuf(row.valPrev)} Ft
                  </td>
                  <td className="p-2.5 font-mono text-xs text-right tabular-nums">
                    {formatHuf(row.valCurr)} Ft
                  </td>
                  <td className={cn(
                    "p-2.5 font-mono text-xs text-right tabular-nums font-semibold",
                    row.diff > 0 ? "text-emerald-600 dark:text-emerald-400" : row.diff < 0 ? "text-rose-600 dark:text-rose-400" : ""
                  )}>
                    {row.diff > 0 ? '+' : ''}{formatHuf(row.diff)} Ft
                  </td>
                  <td className="p-2.5 text-center shrink-0">
                    {row.diff === 0 ? (
                      <span className="text-[10px] bg-slate-100 dark:bg-secondary text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold">
                        0%
                      </span>
                    ) : row.diff > 0 ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">
                        <TrendingUp className="w-2.5 h-2.5 shrink-0" />
                        {Math.round(row.pct)}%
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 text-[10px] bg-rose-500/10 text-rose-700 dark:text-rose-400 px-1.5 py-0.5 rounded font-mono font-bold">
                        <TrendingDown className="w-2.5 h-2.5 shrink-0" />
                        {Math.round(Math.abs(row.pct))}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
