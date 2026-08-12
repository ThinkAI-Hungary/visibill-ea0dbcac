import React from 'react';
import { type CompanyInvoice } from '@/hooks/accounty/useAccountyClients';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, Landmark, Layers, CheckCircle } from 'lucide-react';

interface TAccountLedgerProps {
  invoice: CompanyInvoice;
}

export function TAccountLedger({ invoice }: TAccountLedgerProps) {
  const net = invoice.grossAmount - invoice.vatAmount;
  const isExpense = invoice.type === 'bejovo';

  // Format currency helper
  const fmt = (val: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: invoice.currency || 'HUF',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Define Hungarian accounts based on direction
  const debitAccounts = isExpense
    ? [
        { 
          code: invoice.glNumber || '511', 
          name: invoice.glName || 'Vásárolt anyagok és szolgáltatások', 
          amount: net 
        },
        ...(invoice.vatAmount > 0
          ? [{ code: '466', name: 'Előzetesen felszámított ÁFA', amount: invoice.vatAmount }]
          : []),
      ]
    : [
        { code: '311', name: 'Vevők (Belföldi)', amount: invoice.grossAmount },
      ];

  const creditAccounts = isExpense
    ? [
        { code: '454', name: 'Szállítók (Belföldi)', amount: invoice.grossAmount },
      ]
    : [
        { 
          code: invoice.glNumber || '911', 
          name: invoice.glName || 'Belföldi értékesítés nettó árbevétele', 
          amount: net 
        },
        ...(invoice.vatAmount > 0
          ? [{ code: '467', name: 'Fizetendő ÁFA', amount: invoice.vatAmount }]
          : []),
      ];

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-soft space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-border">
        <ArrowLeftRight className="w-5 h-5 text-indigo-500" />
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Dupla könyvelési T-számlák</h3>
          <p className="text-[11px] text-slate-400">Automatikusan kontírozott főkönyvi napló tétel (Tartozik / Követel)</p>
        </div>
      </div>

      {/* Visual T-Accounts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column: Debit accounts */}
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1 flex items-center gap-1">
            <Landmark className="w-3.5 h-3.5" />
            Tartozik oldal (Debit)
          </div>
          
          {debitAccounts.map(acc => (
            <div key={acc.code} className="bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 px-2 py-0.5 rounded">
                  {acc.code}
                </span>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 font-mono">
                  {fmt(acc.amount)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">{acc.name}</p>
              
              {/* T-Chart representation */}
              <div className="mt-2 border-t border-slate-300 dark:border-slate-700 relative pt-1">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300 dark:bg-slate-700 -translate-x-1/2" style={{ height: '24px' }} />
                <div className="grid grid-cols-2 text-[9px] font-bold text-center">
                  <div className="text-emerald-600 dark:text-emerald-500 font-mono">{fmt(acc.amount)}</div>
                  <div className="text-slate-300 dark:text-slate-700">-</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right column: Credit accounts */}
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            Követel oldal (Credit)
          </div>

          {creditAccounts.map(acc => (
            <div key={acc.code} className="bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 px-2 py-0.5 rounded">
                  {acc.code}
                </span>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 font-mono">
                  {fmt(acc.amount)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">{acc.name}</p>

              {/* T-Chart representation */}
              <div className="mt-2 border-t border-slate-300 dark:border-slate-700 relative pt-1">
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300 dark:bg-slate-700 -translate-x-1/2" style={{ height: '24px' }} />
                <div className="grid grid-cols-2 text-[9px] font-bold text-center">
                  <div className="text-slate-300 dark:text-slate-700">-</div>
                  <div className="text-emerald-600 dark:text-emerald-500 font-mono">{fmt(acc.amount)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Balanced Warning */}
      <div className="bg-slate-50 dark:bg-slate-800/40 border border-border rounded-xl p-3 flex justify-between items-center text-xs font-semibold">
        <span className="text-slate-500">Mérlegegyezőség (Főkönyvi egyenleg):</span>
        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <CheckCircle className="w-4 h-4" />
          Kiegyenlítve: {fmt(invoice.grossAmount)}
        </span>
      </div>
    </div>
  );
}
