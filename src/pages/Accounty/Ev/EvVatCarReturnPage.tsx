import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Receipt, Car, ArrowLeft, ChevronRight, Info, CheckCircle2,
  Clock, Send, Download, Calendar, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvTaxReturns } from '@/hooks/useEvData';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  submitted: { label: 'Benyújtva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  draft: { label: 'Vázlat', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Receipt },
  upcoming: { label: 'Közelgő', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Clock },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapReturn(r: any) {
  const status = r.status === 'submitted' || r.status === 'accepted' ? 'submitted'
    : r.status === 'draft' ? 'draft' : 'upcoming';
  return {
    id: r.id,
    type: r.return_type === 'afa' ? 'ÁFA bevallás'
      : r.return_type === 'car' ? 'Cégautóadó' : r.return_type,
    code: r.form_code || (r.return_type === 'afa' ? '65A' : 'CAR'),
    period: r.period_key || '',
    deadline: r.deadline || '',
    status,
    amount: r.calculated_tax || 0,
    submittedDate: r.submitted_at,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvVatCarReturnPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);

  const { data: allReturns, isLoading } = useEvTaxReturns(id, 2026);

  const vatReturns = useMemo(() => {
    return (allReturns || []).filter((r: any) => r.return_type === 'afa').map(mapReturn);
  }, [allReturns]);

  const carReturns = useMemo(() => {
    return (allReturns || []).filter((r: any) => r.return_type === 'car').map(mapReturn);
  }, [allReturns]);

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    returns: ReturnType<typeof mapReturn>[],
    badgeLabel: string,
    badgeBg: string,
    badgeIcon: React.ReactNode,
  ) => (
    <div>
      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
        {icon} {title}
      </h2>
      <div className="space-y-2">
        {returns.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Nincs bevallás rögzítve</p>
        ) : (
          returns.map(ret => {
            const cfg = STATUS_CFG[ret.status] || STATUS_CFG.upcoming;
            const Icon = cfg.icon;
            return (
              <div key={ret.id} className="bg-card rounded-xl border border-border shadow-soft flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold', badgeBg)}>
                    {badgeIcon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ret.period}</p>
                    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.color)}>
                      <Icon className="w-3 h-3" />{cfg.label}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">{ret.amount > 0 ? formatHuf(ret.amount) : '–'}</p>
                    {ret.deadline && <p className="text-[10px] text-slate-400">{new Date(ret.deadline).toLocaleDateString('hu-HU')}</p>}
                  </div>
                  {ret.status === 'draft' && <button className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 hover:bg-indigo-100 transition-colors"><Send className="w-3.5 h-3.5" /></button>}
                  {ret.status === 'submitted' && <button className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 transition-colors"><Download className="w-3.5 h-3.5" /></button>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-indigo-600 transition-colors">{client?.name || 'Ügyfél'}</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">ÁFA & Cégautóadó bevallás</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/25">
          <Receipt className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">ÁFA & Cégautóadó bevallás</h1>
          <p className="text-sm text-slate-500">65A nyomtatvány (ÁFA) és cégautóadó negyedéves bevallás</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 mb-3 animate-spin text-cyan-400" />
          <p className="text-sm">Betöltés...</p>
        </div>
      ) : (
        <>
          {renderSection(
            'ÁFA bevallások (65A)',
            <Receipt className="w-4 h-4 text-cyan-600" />,
            vatReturns,
            '65A',
            'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600',
            <span>65A</span>,
          )}

          {renderSection(
            'Cégautóadó bevallások',
            <Car className="w-4 h-4 text-rose-600" />,
            carReturns,
            'CAR',
            'bg-rose-100 dark:bg-rose-900/30',
            <Car className="w-4 h-4 text-rose-600" />,
          )}
        </>
      )}

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-600 dark:text-blue-400">
            <p className="font-semibold">ÁFA & Cégautóadó bevallás</p>
            <p>Negyedéves bevallás a negyedévet követő hónap 20-ig. Alanyi adómentes EV-nak ÁFA bevallás nem szükséges, de cégautóadó igen ha cégautót használ.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
