import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Building2, ArrowLeft, ChevronRight, Info, CheckCircle2,
  Clock, AlertTriangle, Send, Download, Calendar, FileText, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvTaxReturns, useEvHipaCalc } from '@/hooks/useEvData';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  submitted: { label: 'Benyújtva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  draft: { label: 'Vázlat', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: FileText },
  upcoming: { label: 'Közelgő', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Clock },
  overdue: { label: 'Lejárt!', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
};

export default function EvHipaReturnPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);

  // ─── Real data ────────────────────────────────────────────────────────────
  const { data: allReturns, isLoading } = useEvTaxReturns(id, 2026);
  const { data: hipaCalc } = useEvHipaCalc(id, 2026);

  const hipaReturns = useMemo(() => {
    const dbReturns = (allReturns || [])
      .filter((r: any) => r.return_type === 'hipa')
      .map((r: any) => {
        const now = new Date();
        const isOverdue = r.status !== 'submitted' && r.status !== 'accepted' && r.deadline && new Date(r.deadline) < now;
        const status = isOverdue ? 'overdue'
          : r.status === 'submitted' || r.status === 'accepted' ? 'submitted'
          : r.status === 'draft' ? 'draft' : 'upcoming';
        return {
          id: r.id,
          period: r.period_key || `${r.tax_year}. adóév`,
          deadline: r.deadline || '',
          status,
          amount: r.calculated_tax || 0,
          submittedDate: r.submitted_at,
        };
      });

    // If no DB records, generate expected HIPA entries
    if (dbReturns.length === 0) {
      const now = new Date();
      const hipaAmount = hipaCalc?.hipa_amount || 0;

      const getStatus = (deadline: string) => {
        const d = new Date(deadline);
        if (now > d) return 'overdue';
        const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return days <= 30 ? 'draft' : 'upcoming';
      };

      return [
        {
          id: 'gen-hipa-eloleg-1',
          period: '2026 I. félévi adóelőleg',
          deadline: '2026-03-15',
          status: getStatus('2026-03-15'),
          amount: Math.round(hipaAmount / 2),
          submittedDate: null,
        },
        {
          id: 'gen-hipa-annual',
          period: '2026. adóévi HIPA bevallás',
          deadline: '2026-05-31',
          status: getStatus('2026-05-31'),
          amount: hipaAmount,
          submittedDate: null,
        },
        {
          id: 'gen-hipa-eloleg-2',
          period: '2026 II. félévi adóelőleg',
          deadline: '2026-09-15',
          status: getStatus('2026-09-15'),
          amount: Math.round(hipaAmount / 2),
          submittedDate: null,
        },
      ];
    }
    return dbReturns;
  }, [allReturns, hipaCalc]);

  const lastPaidAmount = hipaReturns.find(r => r.status === 'submitted')?.amount || 0;
  const municipalityRate = hipaCalc?.municipality_rate || 2;

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-indigo-600 transition-colors">{client?.name || 'Ügyfél'}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">HIPA bevallás</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/25">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">HIPA bevallás</h1>
          <p className="text-sm text-slate-500">Htv. 39/A. § – helyi iparűzési adó bevallás</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Utolsó befizetett</p>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{isLoading ? '...' : formatHuf(lastPaidAmount)}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Adókulcs (önkorm.)</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{municipalityRate}%</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Gyakoriság</p>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">Éves</p>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 mb-3 animate-spin text-amber-400" />
            <p className="text-sm">Betöltés...</p>
          </div>
        ) : (
          hipaReturns.map(ret => {
            const cfg = STATUS_CFG[ret.status] || STATUS_CFG.upcoming;
            const Icon = cfg.icon;
            return (
              <div key={ret.id} className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-600">HIPA</div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{ret.period}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.color)}>
                          <Icon className="w-3 h-3" />{cfg.label}
                        </span>
                        {ret.deadline && (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />{new Date(ret.deadline).toLocaleDateString('hu-HU')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">{ret.amount > 0 ? formatHuf(ret.amount) : '–'}</p>
                    {ret.status === 'submitted' && <button className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 transition-colors"><Download className="w-4 h-4" /></button>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400">
            <p className="font-semibold">HIPA bevallás</p>
            <p>Az éves HIPA bevallás határideje a tárgyévet követő május 31. EV-k a sávos egyszerűsített módot választhatják – adóelőleg fizetése félévkor (márc 15. és szept 15.).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
