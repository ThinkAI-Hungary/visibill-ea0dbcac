import React, { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Receipt, Car, ArrowLeft, ChevronRight, Info, CheckCircle2,
  Clock, AlertTriangle, Send, Download, Calendar, Loader2, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvTaxReturns, useEvClientSettings } from '@/hooks/useEvData';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  submitted: { label: 'Benyújtva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  draft: { label: 'Vázlat', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Receipt },
  upcoming: { label: 'Közelgő', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Clock },
  overdue: { label: 'Lejárt!', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDateStatus(deadline: string): string {
  const now = new Date();
  const d = new Date(deadline);
  if (now > d) return 'overdue';
  const days = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return days <= 30 ? 'draft' : 'upcoming';
}

function mapReturn(r: any) {
  const now = new Date();
  const isOverdue = r.status !== 'submitted' && r.status !== 'accepted' && r.deadline && new Date(r.deadline) < now;
  const status = isOverdue ? 'overdue'
    : r.status === 'submitted' || r.status === 'accepted' ? 'submitted'
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

const QUARTER_DEADLINES_20 = [
  { q: 'Q1', deadline: '2026-04-20' },
  { q: 'Q2', deadline: '2026-07-20' },
  { q: 'Q3', deadline: '2026-10-20' },
  { q: 'Q4', deadline: '2027-01-20' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvVatCarReturnPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);

  const { data: allReturns, isLoading } = useEvTaxReturns(id, 2026);
  const { data: evSettings } = useEvClientSettings(id, 2026);

  const isAlanyiMentes = evSettings?.vat_status === 'alanyi_mentes';

  const vatReturns = useMemo(() => {
    const dbReturns = (allReturns || []).filter((r: any) => r.return_type === 'afa').map(mapReturn);
    if (dbReturns.length === 0 && !isAlanyiMentes) {
      return QUARTER_DEADLINES_20.map(qd => ({
        id: `gen-afa-${qd.q}`,
        type: 'ÁFA bevallás',
        code: '65A',
        period: `2026 ${qd.q}`,
        deadline: qd.deadline,
        status: getDateStatus(qd.deadline),
        amount: 0,
        submittedDate: null,
      }));
    }
    return dbReturns;
  }, [allReturns, isAlanyiMentes]);

  const carReturns = useMemo(() => {
    const dbReturns = (allReturns || []).filter((r: any) => r.return_type === 'car' || r.return_type === 'cegautado').map(mapReturn);
    // Cégautóadó is only needed if the EV uses a company car — show placeholder message
    return dbReturns;
  }, [allReturns]);

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    returns: ReturnType<typeof mapReturn>[],
    badgeLabel: string,
    badgeBg: string,
    badgeIcon: React.ReactNode,
    emptyMessage?: string,
  ) => (
    <div>
      <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
        {icon} {title}
      </h2>
      <div className="space-y-2">
        {returns.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-4 text-center">
            <p className="text-xs text-slate-400">{emptyMessage || 'Nincs bevallás rögzítve'}</p>
          </div>
        ) : (
          returns.map(ret => {
            const cfg = STATUS_CFG[ret.status] || STATUS_CFG.upcoming;
            const Icon = cfg.icon;
            return (
              <div key={ret.id} className={cn(
                'bg-card rounded-xl border shadow-soft flex items-center justify-between px-5 py-3',
                ret.status === 'overdue' ? 'border-red-300 dark:border-red-800' : 'border-border'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold', badgeBg)}>
                    {badgeIcon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ret.period}</p>
                    <div className="flex items-center gap-2 mt-0.5">
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
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">{ret.amount > 0 ? formatHuf(ret.amount) : '–'}</p>
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
            isAlanyiMentes ? '✅ Alanyi adómentes – ÁFA bevallás nem szükséges' : undefined,
          )}

          {renderSection(
            'Cégautóadó bevallások',
            <Car className="w-4 h-4 text-rose-600" />,
            carReturns,
            'CAR',
            'bg-rose-100 dark:bg-rose-900/30',
            <Car className="w-4 h-4 text-rose-600" />,
            'Nem használ cégautót – bevallás nem szükséges',
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
