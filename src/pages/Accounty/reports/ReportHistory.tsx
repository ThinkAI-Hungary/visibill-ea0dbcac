import React from 'react';
import { Download, Trash2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReportTypeConfig } from './ReportCatalog';

export interface ReportHistoryEntry {
  id: string;
  type: string;
  typeLabel: string;
  format: 'pdf' | 'excel';
  dateFrom: string;
  dateTo: string;
  invoiceCount: number;
  includeDetails: boolean;
  generatedAt: string;
  sentToApproval: boolean;
}

const REPORT_HISTORY_KEY = 'eaisybooks_report_history';

export function getReportHistory(): ReportHistoryEntry[] {
  try {
    const raw = localStorage.getItem(REPORT_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function addToReportHistory(entry: ReportHistoryEntry) {
  const history = getReportHistory();
  history.unshift(entry);
  // Keep last 20
  localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
}

export function removeFromReportHistory(id: string) {
  const history = getReportHistory().filter(e => e.id !== id);
  localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(history));
}

interface ReportHistoryListProps {
  reportHistory: ReportHistoryEntry[];
  reportTypes: ReportTypeConfig[];
  onRedownload: (entry: ReportHistoryEntry) => void;
  onDelete: (id: string) => void;
}

export function ReportHistoryList({ reportHistory, reportTypes, onRedownload, onDelete }: ReportHistoryListProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Legutóbbi riportok</h2>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
        {reportHistory.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Még nincs generált riport</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">A generált riportok itt fognak megjelenni</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {reportHistory.slice(0, 10).map((entry) => {
              const icon = reportTypes.find(r => r.id === entry.type);
              const IconComp = icon?.icon || FileText;
              const genDate = new Date(entry.generatedAt);
              const fromFmt = new Date(entry.dateFrom).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' });
              const toFmt = new Date(entry.dateTo).toLocaleDateString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit' });
              return (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", icon?.bg || 'bg-slate-100')}>
                    <IconComp className={cn("w-4.5 h-4.5", icon?.color || 'text-slate-500')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{entry.typeLabel}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {fromFmt} – {toFmt} · {entry.invoiceCount} számla
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase",
                      entry.format === 'pdf' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    )}>
                      {entry.format}
                    </span>
                    {entry.sentToApproval && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                        ✉ Küldve
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {genDate.toLocaleDateString('hu-HU')} {genDate.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button
                      onClick={() => onRedownload(entry)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                      title="Újra letöltés"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(entry.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                      title="Törlés"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
