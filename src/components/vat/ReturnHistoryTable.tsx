import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const fmtEft = (v: number | null | undefined) => (v === null || v === undefined) ? '—' : `${v.toLocaleString('hu-HU')} eFt`;

type HistoryProps = {
  companyId: string;
  currentReturnId?: string;
  onNavigate: (y: number, m: number, frequency?: 'H' | 'N' | 'E') => void;
};

export function ReturnHistoryTable({ companyId, currentReturnId, onNavigate }: HistoryProps) {
  const { data: history = [] } = useQuery({
    queryKey: ['vat_return_history', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('vat_returns')
        .select('id, period_year, period_month, frequency, status, total_payable_tax, total_deductible_tax, net_result, amount_to_pay, amount_reclaimable, updated_at')
        .eq('company_id', companyId)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false })
        .limit(12);
      return (data || []) as any[];
    },
  });

  if (history.length === 0) {
    return <div className="px-4 py-6 text-center text-xs text-muted-foreground">Még nincs korábbi bevallás</div>;
  }

  const statusLabel = (s: string) => s === 'draft' ? 'Piszkozat' : s === 'validated' ? 'Ellenőrzött' : 'Végleges';
  const statusColor = (s: string) => s === 'draft' ? 'bg-amber-500/10 text-amber-600' : s === 'validated' ? 'bg-blue-500/10 text-blue-600' : 'bg-emerald-500/10 text-emerald-600';

  return (
    <div className="divide-y divide-border/30">
      <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/20">
        <div className="col-span-2">Időszak</div>
        <div className="col-span-2">Státusz</div>
        <div className="col-span-2 text-right">Fizetendő</div>
        <div className="col-span-2 text-right">Levonható</div>
        <div className="col-span-2 text-right">Egyenleg</div>
        <div className="col-span-2 text-right">Utoljára</div>
      </div>
      {history.map((ret: any, idx: number) => {
        const rowKey = ret.id || `${ret.period_year}-${ret.period_month}-${ret.frequency || 'H'}-${idx}`;
        const freqLabel = ret.frequency === 'N' ? ' (Negyedév)' : ret.frequency === 'E' ? ' (Éves)' : '';
        return (
          <button
            key={rowKey}
            className={cn(
              "grid grid-cols-12 gap-2 px-4 py-2.5 text-sm w-full text-left hover:bg-muted/30 transition-colors",
              ret.id === currentReturnId && "bg-primary/5 border-l-2 border-l-primary"
            )}
            onClick={() => onNavigate(ret.period_year, ret.period_month, ret.frequency)}
          >
            <div className="col-span-2 font-medium">
              {ret.period_year}/{String(ret.period_month).padStart(2, '0')}{freqLabel}
            </div>
            <div className="col-span-2"><Badge className={cn("text-[10px]", statusColor(ret.status))}>{statusLabel(ret.status)}</Badge></div>
            <div className="col-span-2 text-right tabular-nums text-red-500">{fmtEft(Math.round((ret.total_payable_tax || 0) / 1000))}</div>
            <div className="col-span-2 text-right tabular-nums text-emerald-600">{fmtEft(Math.round((ret.total_deductible_tax || 0) / 1000))}</div>
            <div className={cn("col-span-2 text-right tabular-nums font-medium", (ret.net_result || 0) > 0 ? 'text-red-500' : 'text-emerald-600')}>
              {fmtEft(Math.round((ret.net_result || 0) / 1000))}
            </div>
            <div className="col-span-2 text-right text-xs text-muted-foreground">{ret.updated_at?.substring(0, 10)}</div>
          </button>
        );
      })}
    </div>
  );
}
