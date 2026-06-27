import React, { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FileText, ArrowLeft, ChevronRight, Info, Calculator,
  CheckCircle2, Clock, AlertTriangle, Send, Download,
  Calendar, ArrowUpRight, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient } from '@/hooks/accounty';
import { formatHuf } from '@/lib/evCalculations';
import { useEvTaxReturns, EvTaxReturn } from '@/hooks/useEvData';

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  submitted: { label: 'Benyújtva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  accepted: { label: 'Elfogadva', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  draft: { label: 'Vázlat', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: FileText },
  upcoming: { label: 'Közelgő', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: Clock },
  overdue: { label: 'Lejárt!', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertTriangle },
};

const RETURN_TYPE_LABELS: Record<string, { type: string; code: string }> = {
  szja: { type: 'SZJA bevallás', code: '53' },
  '2658': { type: 'TB járulék', code: '58' },
  contrib: { type: 'TB járulék', code: '58' },
  hipa: { type: 'HIPA bevallás', code: 'HIPA' },
  kata: { type: 'KATA bevallás', code: 'KATA' },
  afa: { type: 'ÁFA bevallás', code: '65' },
  car: { type: 'Cégautóadó', code: 'CAR' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvSzjaReturnPage() {
  const { id } = useParams<{ id: string }>();
  const { data: client } = useAccountyClient(id);
  const [tab, setTab] = useState<'all' | 'pending' | 'submitted'>('all');

  // ─── Real data ────────────────────────────────────────────────────────────
  const { data: allReturns, isLoading } = useEvTaxReturns(id, 2026);

  const returns = useMemo(() => {
    return (allReturns || []).map((r: any) => {
      const labels = RETURN_TYPE_LABELS[r.return_type] || { type: r.return_type, code: r.form_code || '?' };
      const now = new Date();
      const isOverdue = r.status !== 'submitted' && r.status !== 'accepted' && r.deadline && new Date(r.deadline) < now;
      const status = isOverdue ? 'overdue'
        : r.status === 'submitted' || r.status === 'accepted' ? 'submitted'
        : r.status === 'draft' ? 'draft' : 'upcoming';
      return {
        id: r.id,
        type: labels.type,
        code: r.form_code || labels.code,
        period: r.period_key || '',
        deadline: r.deadline || '',
        status,
        amount: r.calculated_tax || 0,
        submittedDate: r.submitted_at,
        navSubmissionId: r.nav_submission_id,
      };
    });
  }, [allReturns]);

  const filtered = useMemo(() => {
    if (tab === 'all') return returns;
    if (tab === 'pending') return returns.filter(r => r.status === 'draft' || r.status === 'upcoming' || r.status === 'overdue');
    return returns.filter(r => r.status === 'submitted');
  }, [returns, tab]);

  const submittedCount = returns.filter(r => r.status === 'submitted').length;
  const pendingCount = returns.filter(r => r.status !== 'submitted').length;
  const totalPaid = returns.filter(r => r.status === 'submitted').reduce((s, r) => s + r.amount, 0);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty/ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/client/${id}/ev`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Bevallások</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/25">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Bevallások áttekintés</h1>
          <p className="text-sm text-slate-500">SZJA 53, TB 58, KATA, HIPA, ÁFA – összes adóbevallás egy helyen</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Összes bevallás</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{isLoading ? '...' : returns.length}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Benyújtva</p>
          <p className="text-2xl font-bold text-green-600">{isLoading ? '...' : submittedCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Függőben</p>
          <p className="text-2xl font-bold text-amber-600">{isLoading ? '...' : pendingCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-soft">
          <p className="text-xs text-slate-500 mb-1">Befizetett összeg</p>
          <p className="text-lg font-bold text-indigo-600 tabular-nums">{isLoading ? '...' : formatHuf(totalPaid)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-lg p-1 w-fit">
        {[
          { key: 'all', label: 'Összes' },
          { key: 'pending', label: 'Függőben' },
          { key: 'submitted', label: 'Benyújtva' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={cn(
              'px-4 py-1.5 text-xs font-semibold rounded-md transition-all',
              tab === t.key
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Returns list */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 mb-3 animate-spin text-indigo-400" />
            <p className="text-sm">Betöltés...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <FileText className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm font-medium">Nincs bevallás{tab !== 'all' ? ` ebben a kategóriában` : ''}</p>
          </div>
        ) : (
          filtered.map(ret => {
            const cfg = STATUS_CONFIG[ret.status] || STATUS_CONFIG.upcoming;
            const Icon = cfg.icon;

            return (
              <div key={ret.id} className={cn(
                'bg-card rounded-xl border shadow-soft overflow-hidden transition-all hover:shadow-md',
                ret.status === 'overdue' ? 'border-red-200 dark:border-red-800' : 'border-border'
              )}>
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold',
                      ret.status === 'submitted' ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                        : ret.status === 'draft' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    )}>
                      {ret.code}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{ret.type}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-500">{ret.period}</span>
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.color)}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                        {ret.amount > 0 ? formatHuf(ret.amount) : '–'}
                      </p>
                      {ret.deadline && (
                        <p className="text-[10px] text-slate-400 flex items-center gap-1 justify-end">
                          <Calendar className="w-3 h-3" />
                          Határidő: {new Date(ret.deadline).toLocaleDateString('hu-HU')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {ret.status === 'draft' && (
                        <button className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 hover:bg-indigo-100 transition-colors" title="Benyújtás">
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {ret.status === 'submitted' && (
                        <button className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 transition-colors" title="Letöltés">
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {ret.submittedDate && (
                  <div className="px-5 py-2 bg-green-50/50 dark:bg-green-900/10 border-t border-green-100 dark:border-green-900/30">
                    <p className="text-[10px] text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Benyújtva: {new Date(ret.submittedDate).toLocaleDateString('hu-HU')}
                      {ret.navSubmissionId && ` — NAV nyugta: ${ret.navSubmissionId}`}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
