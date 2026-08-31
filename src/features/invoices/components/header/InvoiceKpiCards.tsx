import React from 'react';
import { cn } from '@/lib/utils';
import { FileText, Link2, Lightbulb, Link2Off } from 'lucide-react';
import { useInvoiceContext } from '../../context/useInvoiceContext';

export function InvoiceKpiCards() {
  const { invoiceKpis, kpiFilter, toggleKpiFilter } = useInvoiceContext();

  if (!invoiceKpis) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 mb-2 print:hidden">
      <div
        onClick={() => toggleKpiFilter('all')}
        className={cn(
          'bg-card border rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:shadow-md',
          kpiFilter === 'all' ? 'border-primary/50 ring-2 ring-primary/20 shadow-sm' : 'border-border/60'
        )}
      >
        <div className="bg-primary/10 text-primary p-2 rounded-lg">
          <FileText className="w-4 h-4" />
        </div>
        <div>
          <div className="text-lg font-bold tabular-nums">{invoiceKpis.total.toLocaleString('hu-HU')}</div>
          <div className="text-[11px] text-muted-foreground">Összes találat</div>
        </div>
      </div>

      <div
        onClick={() => toggleKpiFilter('matched')}
        className={cn(
          'bg-card border rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:shadow-md',
          kpiFilter === 'matched' ? 'border-emerald-500/50 ring-2 ring-emerald-500/20 shadow-sm' : 'border-border/60'
        )}
      >
        <div className="bg-emerald-500/10 text-emerald-600 p-2 rounded-lg">
          <Link2 className="w-4 h-4" />
        </div>
        <div>
          <div className="text-lg font-bold tabular-nums text-emerald-600">{invoiceKpis.matched}</div>
          <div className="text-[11px] text-muted-foreground">Párosított</div>
        </div>
      </div>

      <div
        onClick={() => toggleKpiFilter('suggested')}
        className={cn(
          'bg-card border rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:shadow-md',
          kpiFilter === 'suggested' ? 'border-amber-500/50 ring-2 ring-amber-500/20 shadow-sm' : 'border-border/60'
        )}
      >
        <div className="bg-amber-500/10 text-amber-500 p-2 rounded-lg">
          <Lightbulb className="w-4 h-4" />
        </div>
        <div>
          <div className="text-lg font-bold tabular-nums text-amber-500">{invoiceKpis.suggested}</div>
          <div className="text-[11px] text-muted-foreground">Javasolt (jóváhagyásra vár)</div>
        </div>
      </div>

      <div
        onClick={() => toggleKpiFilter('unmatched')}
        className={cn(
          'bg-card border rounded-xl p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:shadow-md',
          kpiFilter === 'unmatched' ? 'border-red-500/50 ring-2 ring-red-500/20 shadow-sm' : 'border-border/60'
        )}
      >
        <div className="bg-red-500/10 text-red-500 p-2 rounded-lg">
          <Link2Off className="w-4 h-4" />
        </div>
        <div>
          <div className="text-lg font-bold tabular-nums text-red-500">{invoiceKpis.unmatched}</div>
          <div className="text-[11px] text-muted-foreground">Nincs párosítás</div>
        </div>
      </div>
    </div>
  );
}
