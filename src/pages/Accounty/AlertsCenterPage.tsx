import React, { useState, useMemo } from 'react';
import { Bell, AlertTriangle, Info, CheckCircle, XCircle, Clock, TrendingUp, Users, FileWarning, Calculator, Search, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAccountyClients } from '@/hooks/useAccountyData';

type AlertLevel = 'critical' | 'warning' | 'info';
type AlertCategory = 'all' | 'nav' | 'payroll' | 'employee' | 'system';
type AlertState = 'active' | 'resolved' | 'dismissed';

interface Alert {
  id: string;
  level: AlertLevel;
  category: AlertCategory;
  title: string;
  description: string;
  client?: string;
  createdAt: Date;
  action?: { label: string; path: string };
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
  });

  alerts.push({
    id: 'emp-rehab',
    level: 'warning',
    category: 'employee',
    title: 'Rehabilitációs hozzájárulás aktiválandó',
    description: 'Egy ügyfél létszáma meghaladta a 25 főt, rehabilitációs hozzájárulási kötelezettség keletkezett.',
    createdAt: new Date(now.getTime() - 86400000 * 3),
  });

  // System info
  alerts.push({
    id: 'sys-legal',
    level: 'info',
    category: 'system',
    title: 'Új jogszabály-módosítás észlelve',
    description: 'Magyar Közlöny 2026/42. — családi kedvezmény végrehajtási rendelet frissítve.',
    createdAt: new Date(now.getTime() - 86400000 * 5),
  });

  return alerts.sort((a, b) => {
    const lev = { critical: 0, warning: 1, info: 2 };
    return lev[a.level] - lev[b.level] || b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export default function AlertsCenterPage() {
  const { data: clients = [] } = useAccountyClients();
  const [categoryFilter, setCategoryFilter] = useState<AlertCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Track alert states: active / resolved / dismissed
  const [alertStates, setAlertStates] = useState<Record<string, AlertState>>({});
  const [showArchived, setShowArchived] = useState(false);

  const allAlerts = useMemo(() => generateAlerts(clients), [clients]);

  const getState = (id: string): AlertState => alertStates[id] || 'active';

  const filtered = useMemo(() => {
    return allAlerts.filter(a => {
      const state = getState(a.id);
      // Hide resolved/dismissed unless showArchived is on
      if (!showArchived && (state === 'resolved' || state === 'dismissed')) return false;
      if (categoryFilter !== 'all' && a.category !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!a.title.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q) && !(a.client || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allAlerts, categoryFilter, alertStates, showArchived, searchQuery]);

  const activeAlerts = allAlerts.filter(a => getState(a.id) === 'active');
  const stats = {
    critical: activeAlerts.filter(a => a.level === 'critical').length,
    warning: activeAlerts.filter(a => a.level === 'warning').length,
    info: activeAlerts.filter(a => a.level === 'info').length,
    resolved: allAlerts.filter(a => getState(a.id) === 'resolved').length,
  };

  const setAlertState = (id: string, state: AlertState) => {
    setAlertStates(prev => ({ ...prev, [id]: state }));
  };

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
        <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={e => setShowArchived(e.target.checked)}
            className="rounded"
          />
          Archivált mutatása
        </label>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
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
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800/40 rounded-xl p-4">
          <p className="text-xs text-green-500 font-medium">Megoldva</p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</p>
        </div>
      </div>

      {/* Search + Category tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Keresés riasztásokban..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border h-9 text-sm"
          />
        </div>
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
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="py-16 text-center bg-card rounded-xl border border-border">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-green-400" />
            <p className="text-sm text-slate-500">
              {searchQuery || categoryFilter !== 'all' ? 'Nincs találat a szűrőkkel' : 'Nincs aktív riasztás — minden rendben!'}
            </p>
          </div>
        ) : (
          filtered.map(alert => {
            const state = getState(alert.id);
            const isResolved = state === 'resolved';
            const isDismissed = state === 'dismissed';
            const isArchived = isResolved || isDismissed;
            const config = isResolved
              ? { icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-200 dark:border-green-800/50' }
              : LEVEL_CONFIG[alert.level];
            const Icon = config.icon;
            return (
              <div
                key={alert.id}
                className={cn(
                  'rounded-xl border p-5 transition-all hover:shadow-md',
                  isArchived ? 'opacity-50' : '',
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
                        <h3 className={cn('text-sm font-bold', isResolved ? 'text-green-700 dark:text-green-400 line-through' : 'text-slate-900 dark:text-slate-100')}>
                          {alert.title}
                        </h3>
                        {alert.client && <p className="text-[10px] text-primary font-medium mt-0.5">{alert.client}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {alert.createdAt.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })}
                        </span>
                        {!isArchived && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/30 gap-1"
                              onClick={() => setAlertState(alert.id, 'resolved')}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Megoldva
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-[10px] text-slate-400 hover:text-slate-600"
                              onClick={() => setAlertState(alert.id, 'dismissed')}
                            >
                              Elutasít
                            </Button>
                          </>
                        )}
                        {isArchived && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-slate-400 hover:text-slate-600"
                            onClick={() => setAlertState(alert.id, 'active')}
                          >
                            Visszaállít
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{alert.description}</p>
                    {isResolved && (
                      <p className="text-[10px] text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Megoldva
                      </p>
                    )}
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
