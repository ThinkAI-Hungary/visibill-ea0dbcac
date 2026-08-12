import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  Shield, ArrowLeft, ChevronRight, Info, CheckCircle2,
  Calendar, CreditCard, Building2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccountyClient, useEvTaxParams } from '@/hooks/accounty';
import { formatHuf, DEFAULT_2026_PARAMS, DEFAULT_2025_PARAMS } from '@/lib/evCalculations';
import { useEvChamberPayments } from '@/hooks/useEvData';

// ─── Component ──────────────────────────────────────────────────────────────

export default function EvChamberPage() {
  const { companyId, dateRange } = useParams<{ companyId: string; dateRange: string }>();
  const id = companyId;
  const [searchParams] = useSearchParams();
  const taxYear = Number(searchParams.get('year') || '2026');
  const { data: client } = useAccountyClient(id);

  const { data: dbParams } = useEvTaxParams(taxYear);
  const params = dbParams || (taxYear === 2026 ? DEFAULT_2026_PARAMS : DEFAULT_2025_PARAMS);
  const annualFee = params.kamaraiHozzajarulas;

  // Fetch from DB
  const { data: dbPayments = [] } = useEvChamberPayments(id);

  // Map DB records to the format the UI expects
  const payments = dbPayments.map(p => ({
    year: p.tax_year,
    amount: Number(p.amount) || 0,
    paidDate: p.paid_date,
    status: p.status as 'paid' | 'pending',
    deadline: p.deadline || `${p.tax_year}-03-31`,
  }));

  // Get chamber info from the most recent payment record
  const latestPayment = dbPayments[0];
  const chamberName = latestPayment?.chamber_name || (client?.name ? `${client.name} kamarája` : '—');
  const membershipNumber = latestPayment?.membership_number || '—';

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/accounty?tab=ev" className="hover:text-indigo-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> EV Portfólió
        </Link>
        <ChevronRight className="w-3 h-3" />
        <Link to={`/accounty/${id}/${dateRange}/ev?year=${taxYear}`} className="hover:text-indigo-600 transition-colors">
          {client?.name || 'Ügyfél'}
        </Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-slate-900 dark:text-slate-100 font-medium">Kamarai hozzájárulás</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg shadow-amber-500/25">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Kamarai hozzájárulás</h1>
          <p className="text-sm text-slate-500">Gazdasági kamarai hozzájárulás – éves fizetési kötelezettség</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-soft p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              Kamarai tagság adatai
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Kamara neve</label>
                <p className="text-sm text-slate-900 dark:text-slate-100 font-medium">{chamberName}</p>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Tagsági szám</label>
                <p className="text-sm text-slate-900 dark:text-slate-100 font-medium font-mono">{membershipNumber}</p>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Éves hozzájárulás ({taxYear})</label>
                <p className="text-2xl font-bold text-amber-600">{formatHuf(annualFee)}</p>
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Fizetési határidő</label>
                <p className="text-sm text-slate-900 dark:text-slate-100 font-medium">Március 31.</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <p className="font-semibold">Kamarai hozzájárulás szabályok</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Összeg: {formatHuf(annualFee)}/év (fix)</li>
                  <li>Határidő: tárgyév március 31.</li>
                  <li>Minden EV fizetni köteles</li>
                  <li>Költségként elszámolható a pénztárkönyvben</li>
                  <li>Elmulasztás: végrehajtási eljárás</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Payment history */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Fizetési előzmények</h2>
            </div>
            <div className="divide-y divide-border">
              {payments.map(p => (
                <div key={p.year} className={cn(
                  'flex items-center justify-between px-5 py-4',
                  p.status === 'pending' && 'bg-amber-50/50 dark:bg-amber-900/10'
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold',
                      p.status === 'paid'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600'
                        : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600'
                    )}>
                      {p.year}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {p.year}. évi kamarai hozzájárulás
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                          p.status === 'paid'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        )}>
                          {p.status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                          {p.status === 'paid' ? 'Fizetve' : 'Függőben'}
                        </span>
                        {p.paidDate && (
                          <span className="text-[10px] text-slate-400">
                            {new Date(p.paidDate).toLocaleDateString('hu-HU')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {formatHuf(p.amount)}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Határidő: {new Date(p.deadline).toLocaleDateString('hu-HU')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
