import React from 'react';
import { Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PayrollStep3Props {
  activeEmployees: any[];
  attendanceData: Record<string, { workDays: number; overtime: number; sickDays: number; leaveDays: number }>;
  getAttendance: (empId: string) => { workDays: number; overtime: number; sickDays: number; leaveDays: number };
  onAttendanceChange?: (empId: string, field: 'workDays' | 'overtime' | 'sickDays' | 'leaveDays', value: number) => void;
  handleCsvUpload: (file: File) => void;
  csvValidation: any;
  setCsvValidation: (val: any) => void;
}

export default function PayrollStep3({
  activeEmployees,
  attendanceData,
  getAttendance,
  onAttendanceChange,
  handleCsvUpload,
  csvValidation,
  setCsvValidation,
}: PayrollStep3Props) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Munkaidő feldolgozás. Töltsd fel a jelenléti ívet, vagy add meg manuálisan a munkanapokat.
      </p>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 cursor-pointer transition-all">
          <Download className="w-4 h-4 text-primary rotate-180" />
          <span className="text-sm font-semibold text-primary">CSV / Excel feltöltés</span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCsvUpload(file);
            }}
          />
        </label>
        <span className="text-xs text-slate-500">Formátum: Név, Munkanapok, Túlóra, Táppénz, Szabadság</span>
        {Object.keys(attendanceData).length > 0 && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" /> {Object.keys(attendanceData).length} betöltve
          </span>
        )}
      </div>

      {csvValidation && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className={cn(
            'flex items-center justify-between px-4 py-3 rounded-lg border text-sm',
            csvValidation.unmatchedNames.length === 0 && csvValidation.warnings.length === 0
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
              : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
          )}>
            <div className="flex items-center gap-2">
              {csvValidation.unmatchedNames.length === 0 && csvValidation.warnings.length === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              )}
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {csvValidation.fileName}: {csvValidation.matched}/{csvValidation.total} párosítva
              </span>
            </div>
            <button onClick={() => setCsvValidation(null)} className="text-slate-400 hover:text-slate-600 text-xs font-medium">
              Bezárás
            </button>
          </div>

          {csvValidation.unmatchedNames.length > 0 && (
            <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider mb-1.5">
                Nem párosított nevek ({csvValidation.unmatchedNames.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {csvValidation.unmatchedNames.map((name: string, i: number) => (
                  <span key={i} className="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded text-xs font-mono">
                    {name}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-red-500 dark:text-red-400 mt-2">
                Tipp: a CSV-ben a nevek formátuma legyen „Vezetéknév Keresztnév" vagy „Keresztnév Vezetéknév"
              </p>
            </div>
          )}

          {csvValidation.warnings.length > 0 && (
            <div className="px-4 py-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-1.5">
                Figyelmeztetések ({csvValidation.warnings.length})
              </p>
              <div className="space-y-1">
                {csvValidation.warnings.slice(0, 10).map((w: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <span className="font-mono text-[10px] text-amber-500 shrink-0">#{w.row}</span>
                    <span className="font-medium">{w.name}:</span>
                    <span>{w.message}</span>
                  </div>
                ))}
                {csvValidation.warnings.length > 10 && (
                  <p className="text-[10px] text-amber-500 mt-1">…és még {csvValidation.warnings.length - 10} figyelmeztetés</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border dark:bg-slate-900/30">
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Név</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Munkanapok</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Túlóra (h)</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Táppénz</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Szabadság</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {activeEmployees.map((emp) => {
              const att = getAttendance(emp.id);
              const fromCsv = !!attendanceData[emp.id];
              return (
                <tr key={emp.id} className={cn('hover:bg-slate-50 dark:hover:bg-slate-800/50', fromCsv && 'bg-green-50/50 dark:bg-green-900/10')}>
                  <td className="px-4 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                    {emp.last_name} {emp.first_name}
                    {fromCsv && <CheckCircle2 className="w-3 h-3 inline ml-1.5 text-green-500" />}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      max={31}
                      value={att.workDays}
                      onChange={(e) => onAttendanceChange?.(emp.id, 'workDays', parseInt(e.target.value) || 0)}
                      className="w-16 text-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={att.overtime}
                      onChange={(e) => onAttendanceChange?.(emp.id, 'overtime', parseFloat(e.target.value) || 0)}
                      className="w-16 text-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      max={31}
                      value={att.sickDays}
                      onChange={(e) => onAttendanceChange?.(emp.id, 'sickDays', parseInt(e.target.value) || 0)}
                      className="w-16 text-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min={0}
                      max={31}
                      value={att.leaveDays}
                      onChange={(e) => onAttendanceChange?.(emp.id, 'leaveDays', parseInt(e.target.value) || 0)}
                      className="w-16 text-center rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-primary focus:outline-none"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
