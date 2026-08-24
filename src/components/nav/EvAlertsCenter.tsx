import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface PortfolioAlert {
  id: string;
  companyId: string;
  companyName: string;
  type: 'danger' | 'warning';
  title: string;
  message: string;
  targetUrl?: string;
}

interface EvAlertsCenterProps {
  alerts: PortfolioAlert[];
}

export default function EvAlertsCenter({ alerts }: EvAlertsCenterProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (alerts.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden animate-in fade-in duration-300">
        <div className="px-5 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/10 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="text-left">
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Kockázati és adóhatár riasztások
                <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-mono text-[10px] px-1.5 py-0.5">
                  0
                </Badge>
              </h2>
              <p className="text-xs text-slate-500">Minden ellenőrzés rendben lefutott. Nincs aktív riasztás vagy határidő-túllépés a portfólióban.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const dangerAlerts = alerts.filter((a) => a.type === 'danger');
  const warningAlerts = alerts.filter((a) => a.type === 'warning');

  return (
    <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden animate-in fade-in duration-300">
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors border-b border-border/30"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Kockázati és adóhatár riasztások
              <Badge className="bg-red-500 hover:bg-red-600 text-white font-mono text-[10px] px-1.5 py-0.5">
                {alerts.length}
              </Badge>
            </h2>
            <p className="text-xs text-slate-500">Azonnali intézkedést vagy figyelmet igénylő adózási események a portfólióban.</p>
          </div>
        </div>
        <div>
          {isOpen ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Content */}
      {isOpen && (
        <div className="p-5 space-y-3 max-h-[350px] overflow-y-auto divide-y divide-border/50">
          {/* Danger alerts (critical) */}
          {dangerAlerts.map((alert, idx) => (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-3 py-2.5 first:pt-0 last:pb-0",
                "text-red-700 dark:text-red-400"
              )}
            >
              <XCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-sans">
                    Kritikus
                  </span>
                  <span className="text-sm font-bold">{alert.title}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <strong>{alert.companyName}</strong>: {alert.message}
                </p>
              </div>
              <Link
                to={alert.targetUrl || `/eaisybooks/client/${alert.companyId}/ev`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors shrink-0 pt-0.5"
              >
                Megnyitás <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}

          {/* Warning alerts (warnings) */}
          {warningAlerts.map((alert, idx) => (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-3 py-2.5 first:pt-0 last:pb-0",
                "text-amber-700 dark:text-amber-400"
              )}
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-500" />
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-sans">
                    Figyelem
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{alert.title}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <strong>{alert.companyName}</strong>: {alert.message}
                </p>
              </div>
              <Link
                to={alert.targetUrl || `/eaisybooks/client/${alert.companyId}/ev`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors shrink-0 pt-0.5"
              >
                Megnyitás <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
