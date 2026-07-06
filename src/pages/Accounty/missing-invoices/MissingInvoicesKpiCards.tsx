import React from 'react';

interface MissingCounts {
  total?: number;
  urgent?: number;
  nav?: number;
  totalAmount?: number | null;
}

interface MissingInvoicesKpiCardsProps {
  missingCounts: MissingCounts | undefined;
}

export function MissingInvoicesKpiCards({ missingCounts }: MissingInvoicesKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-card p-5 rounded-xl border border-border shadow-soft flex flex-col justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Összes hiányzó</p>
        <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">{missingCounts?.total?.toLocaleString('hu-HU') ?? '–'}</h3>
      </div>
      
      <div className="bg-red-50/50 dark:bg-red-900/20 p-5 rounded-xl border-2 border-red-200 dark:border-red-900/50 shadow-soft flex flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
        <p className="text-sm font-bold text-red-600 mb-2">Sürgős</p>
        <h3 className="text-3xl font-black text-red-600">{missingCounts?.urgent?.toLocaleString('hu-HU') ?? '0'}</h3>
      </div>
      
      <div className="bg-card p-5 rounded-xl border border-border shadow-soft flex flex-col justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">NAV-ból</p>
        <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">{missingCounts?.nav?.toLocaleString('hu-HU') ?? '–'}</h3>
      </div>
      
      <div className="bg-card p-5 rounded-xl border border-border shadow-soft flex flex-col justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Becsült összeg</p>
        <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">
          {missingCounts?.totalAmount != null ? new Intl.NumberFormat('hu-HU').format(missingCounts.totalAmount) + ' Ft' : '–'}
        </h3>
      </div>
    </div>
  );
}
