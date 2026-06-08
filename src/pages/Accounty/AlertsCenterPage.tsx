import React, { useState, useMemo } from 'react';
import { Bell, AlertTriangle, Info, CheckCircle, XCircle, Filter, Clock, TrendingUp, Users, FileWarning, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/useAccountyData';

type AlertLevel = 'critical' | 'warning' | 'info';
type AlertCategory = 'all' | 'nav' | 'payroll' | 'employee' | 'system';

interface Alert {
  id: string;
  level: AlertLevel;
  category: AlertCategory;
  title: string;
  description: string;
  client?: string;
  createdAt: Date;
  action?: { label: string; path: string };
  dismissed: boolean;
}

const LEVEL_CONFIG: Record<AlertLevel, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  critical: {
    icon: XCircle,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800/50',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800/50',
  },
  info: {
    icon: Info,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800/50',
  },
};

const CATEGORIES: { id: AlertCategory; label: string; icon: React.ElementType }[] = [
  { id: 'all', label: 'Minden', icon: Bell },
  { id: 'nav', label: 'NAV', icon: FileWarning },
  { id: 'payroll', label: 'Bérszámfejtés', icon: Calculator },
  { id: 'employee', label: 'Foglalkoztatottak', icon: Users },
  { id: 'system', label: 'Rendszer', icon: TrendingUp },
];

// Generate realistic alerts based on actual clients
function generateAlerts(clients: any[]): Alert[] {
  const now = new Date();
  const alerts: Alert[] = [];

  // NAV deadlines
  const navDay = 12;
  const daysUntilNav = navDay - now.getDate();
  if (daysUntilNav > 0 && daysUntilNav <= 5) {
    alerts.push({
      id: 'nav-deadline-1',
      level: daysUntilNav <= 2 ? 'critical' : 'warning',
      category: 'nav',
      title: `NAV járulékbevallás határidő ${daysUntilNav} nap múlva`,
      description: `A 2608 havi járulékbevallás beadási határideje ${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${navDay}.`,
      createdAt: new Date(now.getTime() - 86400000),
      dismissed: false,
    });
  }

  // Payroll cycle alerts per client
  clients.slice(0, 3).forEach((client, i) => {
    alerts.push({
      id: `payroll-${client.id || i}`,
      level: i === 0 ? 'warning' : 'info',
      category: 'payroll',
      title: `${client.name}: havi bérszámfejtés nem indult`,
      description: `Az aktuális hónapra még nem indult el a bérszámfejtési ciklus.`,
      client: client.name,
      createdAt: new Date(now.getTime() - 172800000 * (i + 1)),
      dismissed: false,
    });
  });

  // Employee alerts
  alerts.push({
    id: 'emp-min-wage',
    level: 'critical',
    category: 'employee',
    title: 'Minimálbér alatti bér — 2 foglalkoztatott',
    description: 'A 2026-os minimálbér (322 800 Ft) alatti alapbér rögzítve. Ellenőrizd a részfoglalkoztatást.',
    createdAt: new Date(now.getTime() - 86400000 * 2),
    dismissed: false,
  });

  alerts.push({
    id: 'emp-rehab',
    level: 'warning',
    category: 'employee',
    title: 'Rehabilitációs hozzájárulás aktiválandó',
    description: 'Egy ügyfél létszáma meghaladta a 25 főt, rehabilitációs hozzájárulási kötelezettség keletkezett.',
    createdAt: new Date(now.getTime() - 86400000 * 3),
    dismissed: false,
  });

  // System info
  alerts.push({
    id: 'sys-legal',
    level: 'info',
    category: 'system',
    title: 'Új jogszabály-módosítás észlelve',
    description: 'Magyar Közlöny 2026/42. — családi kedvezmény végrehajtási rendelet frissítve.',
    createdAt: new Date(now.getTime() - 86400000 * 5),
    dismissed: false,
  });

  return alerts.sort((a, b) => {
    const lev = { critical: 0, warning: 1, info: 2 };
    return lev[a.level] - lev[b.level] || b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export default function AlertsCenterPage() {
  const { data: clients = [] } = useAccountyClients();
  const [categoryFilter, setCategoryFilter] = useState<AlertCategory>('all');
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showDismissed, setShowDismissed] = useState(false);

  const allAlerts = useMemo(() => generateAlerts(clients), [clients]);

  const filtered = useMemo(() => {
    return allAlerts.filter(a => {
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      if (!showDismissed && dismissedIds.has(a.id)) return false;
      return true;
    });
  }, [allAlerts, categoryFilter, dismissedIds, showDismissed]);

  const stats = {
    critical: allAlerts.filter(a => a.level === 'critical' && !dismissedIds.has(a.id)).length,
    warning: allAlerts.filter(a => a.level === 'warning' && !dismissedIds.has(a.id)).length,
    info: allAlerts.filter(a => a.level === 'info' && !dismissedIds.has(a.id)).length,
  };

  const dismiss = (id: string) => setDismissedIds(prev => new Set(prev).add(id));

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl shadow-lg shadow-red-500/25">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Riasztások és figyelmeztetések</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Portfólió-szintű figyelmeztető rendszer</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
          <input
            type="checkbox"
            checked={showDismissed}
            onChange={e => setShowDismissed(e.target.checked)}
            className="rounded"
          />
          Elutasítottak mutatása
        </label>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40 rounded-xl p-4">
          <p className="text-xs text-red-500 font-medium">Kritikus</p>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.critical}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40 rounded-xl p-4">
          <p className="text-xs text-amber-500 font-medium">Figyelmeztetés</p>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.warning}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 rounded-xl p-4">
          <p className="text-xs text-blue-500 font-medium">Tájékoztató</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.info}</p>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1 overflow-x-auto">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategoryFilter(cat.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
              categoryFilter === cat.id
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <cat.icon className="w-3.5 h-3.5" />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-16 text-center bg-card rounded-xl border border-border">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <p className="text-sm text-slate-500">Nincs aktív riasztás — minden rendben!</p>
          </div>
        ) : (
          filtered.map(alert => {
            const config = LEVEL_CONFIG[alert.level];
            const Icon = config.icon;
            const isDismissed = dismissedIds.has(alert.id);
            return (
              <div
                key={alert.id}
                className={cn(
                  'rounded-xl border p-5 transition-all hover:shadow-md',
                  isDismissed ? 'opacity-50' : '',
                  config.bg, config.border
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn('p-2 rounded-xl', config.bg)}>
                    <Icon className={cn('w-5 h-5', config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{alert.title}</h3>
                        {alert.client && <p className="text-[10px] text-primary font-medium mt-0.5">{alert.client}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {alert.createdAt.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
                        </span>
                        {!isDismissed && (
                          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-slate-400 hover:text-slate-600" onClick={() => dismiss(alert.id)}>
                            Elutasít
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{alert.description}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
