import React from 'react';
import { cn } from '@/lib/utils';

export default function PayrollStep4() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Magáncélú telefonhasználat, cafeteria juttatások, SZÉP kártya kezelés.
      </p>

      {/* Tax info banner */}
      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-2">
        <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full">28%</span>
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Cafeteria közteher: SZJA 15% + SZOCHO 13% = <strong>28%</strong> · Rekreáció 75.000 Ft/év adómentes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Phone panel */}
        <div className="p-4 rounded-lg border border-border">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2"> Magáncélú telefon</h4>
          <p className="text-xs text-slate-500 mb-3">A magáncélú telefonhasználat 20%-a kerül adóztatásra.</p>
          <div className="text-center py-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <p className="text-sm text-slate-400">Nincs rögzített tétel</p>
          </div>
        </div>

        {/* SZÉP kártya panel */}
        <div className="p-4 rounded-lg border border-border">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2"> SZÉP kártya</h4>
          <p className="text-xs text-slate-500 mb-3">Éves limit: 450.000 Ft / zseb</p>
          <div className="space-y-3">
            {[
              { name: 'Szálláshely', used: 0, limit: 450000, color: 'bg-blue-500' },
              { name: 'Vendéglátás', used: 0, limit: 450000, color: 'bg-amber-500' },
              { name: 'Szabadidő', used: 0, limit: 450000, color: 'bg-green-500' },
            ].map((pocket) => (
              <div key={pocket.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 dark:text-slate-400">{pocket.name}</span>
                  <span className="font-mono text-slate-500">{pocket.used.toLocaleString('hu-HU')} / {pocket.limit.toLocaleString('hu-HU')} Ft</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', pocket.color)}
                    style={{ width: `${Math.min(100, (pocket.used / pocket.limit) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rekreáció */}
      <div className="p-4 rounded-lg border border-border">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100"> Rekreáció</h4>
          <span className="text-xs text-slate-500 font-mono">0 / 75.000 Ft</span>
        </div>
        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-violet-500 rounded-full" style={{ width: '0%' }} />
        </div>
        <p className="text-[10px] text-slate-400 mt-1">Adómentes keret: évi 75.000 Ft</p>
      </div>
    </div>
  );
}
