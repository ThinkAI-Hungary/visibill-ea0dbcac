import React, { useState, useMemo, useEffect, useCallback } from 'react';
import AccountyWelcomeWizard from '@/components/accounty/AccountyWelcomeWizard';
import { 
  Plus, 
  Search, 
  Filter, 
  Grid, 
  List as ListIcon, 
  Kanban,
  Users, 
  FileText, 
  AlertTriangle,
  Clock,
  MoreVertical,
  ArrowUpRight,
  Building2,
  Building,
  User,
  ChevronDown,
  Check,
  Phone,
  MessageCircle,
  Mail,
  Shield,
  UserCheck,
  Download,
  TrendingUp,
  Loader2,
  Database,
  X,
  CheckSquare,
  GripVertical,
  ChevronUp,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { ClientData } from './types';
import { useAccountyClients, useAccountyKpis, useUpdateKanbanStatus, useAccountyAccountants, useAccountyMonthlyTrend, useAccountyColleagueStats, useAccountyAuditLog, useAccountyPortalStats, useUpdateClientOwner } from '@/hooks/useAccountyData';
import { useAccountyRole } from './AccountyRoleContext';
import { seedAccountyAssignments } from '@/utils/seedAccounty';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { reportError } from '@/lib/errorReporter';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { BarChart2, PieChart as PieChartIcon } from 'lucide-react';

// KPI stats, bar/pie chart data, and colleague stats are now computed dynamically from Supabase data

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    let startTime: number | null = null;
    let rafId: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setDisplay(Math.round(progress * value));
      if (progress < 1) rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [value, duration]);
  return <>{display.toLocaleString('hu-HU')}</>;
}

function KpiCard({ title, value, icon: Icon, valueClass = "text-slate-900 dark:text-slate-100", accentColor = "teal", onClick }: { title: string, value: number, icon: React.ElementType, valueClass?: string, accentColor?: string, onClick?: () => void }) {
  const colorMap: Record<string, string> = {
    teal: 'from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10',
    emerald: 'from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10',
    blue: 'from-blue-500/10 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10',
    red: 'from-red-500/10 to-red-600/5 dark:from-red-500/20 dark:to-red-600/10',
    amber: 'from-amber-500/10 to-amber-600/5 dark:from-amber-500/20 dark:to-amber-600/10',
  };
  const iconColorMap: Record<string, string> = {
    teal: 'bg-accent dark:bg-accent text-primary',
    emerald: 'bg-accent dark:bg-accent text-primary',
    blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600',
    red: 'bg-red-100 dark:bg-red-900/50 text-red-600',
    amber: 'bg-amber-100 dark:bg-amber-900/50 text-amber-600',
  };
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative overflow-hidden bg-gradient-to-br rounded-xl p-5 border border-border shadow-soft flex flex-col justify-between h-32 card-ripple",
        "hover:shadow-lg hover:scale-[1.02] hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-300 group",
        onClick ? "cursor-pointer" : "cursor-default",
        colorMap[accentColor] || colorMap.emerald,
        "bg-card"
      )}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`);
        e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`);
      }}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110", iconColorMap[accentColor] || iconColorMap.emerald)}>
          <Icon className="w-4.5 h-4.5" />
        </div>
      </div>
      <p className={`text-3xl font-bold tracking-tight ${valueClass}`}>
        <AnimatedNumber value={value} />
      </p>
      {/* Subtle shimmer on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-gradient-to-r from-transparent via-white/5 to-transparent" />
    </div>
  );
}

function StatusBadge({ status }: { status: ClientData['status'] }) {
  const styles = {
    'Rendben': 'bg-accent text-accent-foreground dark:bg-accent dark:text-primary',
    'Feldolgozandó': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    'Kritikus': 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
}

function OwnerDropdown({ client, onUpdateOwner }: { client: ClientData, onUpdateOwner?: (clientId: string, ownerId: string) => void }) {
  const [open, setOpen] = useState(false);
  const { data: accountants } = useAccountyAccountants();
  const { isAdmin } = useAccountyRole();
  const safeAccountants = accountants || [{ id: '1', userId: '1', name: 'Névtelen', initial: 'N', clientCount: 0 }];
  const owner = safeAccountants.find(a => a.id === client.ownerId) || safeAccountants[0];

  if (!owner) return null;

  if (!isAdmin) {
    return (
      <div className="h-8 px-2 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-border/30 cursor-default select-none">
        <div className="w-5 h-5 rounded-full bg-slate-400 flex items-center justify-center text-[10px] font-bold text-white">
          {owner.initial}
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{owner.name}</span>
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 flex items-center gap-2 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-700 data-[state=open]:bg-slate-100 shadow-soft border border-border/50">
            <div className="w-5 h-5 rounded-full bg-slate-500 flex items-center justify-center text-[10px] font-bold text-white">
              {owner.initial}
            </div>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{owner.name}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Keresés könyvelőre..." className="h-9 text-xs" />
            <CommandList>
              <CommandEmpty>Nincs találat.</CommandEmpty>
              <CommandGroup>
                {safeAccountants.map((acc) => (
                  <CommandItem
                    key={acc.id}
                    value={acc.name}
                    onSelect={() => {
                      onUpdateOwner?.(client.id, acc.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between text-xs cursor-pointer py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-slate-500 flex items-center justify-center text-[10px] font-bold text-white">
                        {acc.initial}
                      </div>
                      <span>{acc.name}</span>
                    </div>
                    {acc.id === owner.id && (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MissingItemsTooltip({ companyId }: { companyId: string }) {
  const { data: items } = useQuery({
    queryKey: ['missing-top3', companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('accounty_missing_items')
        .select('title, amount, priority')
        .eq('company_id', companyId)
        .in('status', ['open', 'notified'])
        .order('amount', { ascending: false, nullsFirst: false })
        .limit(3) as any;
      return (data || []) as { title: string; amount: number | null; priority: string }[];
    },
    staleTime: 60_000,
  });

  if (!items || items.length === 0) return null;

  return (
    <div className="absolute right-0 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover/row:opacity-100 pointer-events-none transition-opacity duration-200">
      <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-lg shadow-xl p-3 ml-2 min-w-[220px] border border-slate-700">
        <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2 font-semibold">Top tételek</p>
        {items.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-3 py-1">
            <span className="text-xs text-slate-200 truncate max-w-[140px]">{item.title}</span>
            {item.amount ? (
              <span className="text-xs font-bold text-primary whitespace-nowrap">{item.amount.toLocaleString('hu-HU')} Ft</span>
            ) : (
              <span className="text-xs text-slate-500">–</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClientCard({ client, draggable, onDragStart, onDragEnd, isDragged, onUpdateOwner }: { client: ClientData, draggable?: boolean, onDragStart?: (e: React.DragEvent) => void, onDragEnd?: (e: React.DragEvent) => void, isDragged?: boolean, onUpdateOwner?: (clientId: string, ownerId: string) => void }) {
  const navigate = useNavigate();

  // Dynamic deadline calculation
  const daysLeft = Math.ceil((new Date(client.deadlineDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysLeft < 0;
  const deadlineColor = isOverdue
    ? 'bg-red-500'
    : daysLeft <= 3
      ? 'bg-red-500'
      : daysLeft <= 7
        ? 'bg-amber-500'
        : 'bg-primary';
  const deadlineBadgeStyle = isOverdue
    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
    : daysLeft <= 3
      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
      : daysLeft <= 7
        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
        : 'bg-accent dark:bg-accent text-accent-foreground dark:text-primary';
  const deadlineText = isOverdue
    ? `${Math.abs(daysLeft)} napja lejárt!`
    : daysLeft === 0
      ? 'Ma lejár!'
      : daysLeft === 1
        ? 'Holnap lejár'
        : `${daysLeft} nap`;
  const progressColor = client.progress >= 80
    ? 'bg-primary'
    : client.progress >= 50
      ? 'bg-amber-500'
      : 'bg-red-500';

  return (
    <div 
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => navigate(`/accounty/client/${client.id}`)}
      className={cn(
        "bg-card rounded-xl border border-border shadow-soft flex flex-col group cursor-pointer h-full overflow-hidden", 
        "hover:shadow-lg hover:border-slate-200 dark:hover:border-slate-700 hover:-translate-y-0.5 transition-all duration-300",
        "animate-in fade-in slide-in-from-bottom-2 duration-300",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragged && "opacity-50 scale-[0.98] shadow-none border-dashed border-2 ring-2 ring-primary/20"
      )}
    >
        {/* Status accent bar */}
        <div className={cn(
          "h-1 w-full",
          client.status === 'Rendben' ? 'bg-gradient-to-r from-primary to-primary/80' :
          client.status === 'Feldolgozandó' ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
          'bg-gradient-to-r from-red-400 to-red-500'
        )} />
        <div className="p-5 flex flex-col h-full">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${client.colorHex}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-slate-100 leading-tight">{client.name}</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{client.taxNumber}</p>
            </div>
          </div>

        </div>

        <div className="flex justify-between items-center mb-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">Státusz</span>
          <StatusBadge status={client.status} />
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Havi zárás</span>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{client.progress}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
            <div className={cn('h-1.5 rounded-full transition-all duration-500', progressColor)} style={{ width: `${client.progress}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Feldolgozatlan</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100">{client.unprocessedCount} számla</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Hiányzó</p>
            <p className={`font-semibold ${client.missingCount > 0 ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'}`}>
              {client.missingCount} számla
            </p>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-border flex justify-between items-center">
          <OwnerDropdown client={client} onUpdateOwner={onUpdateOwner} />
          <div className="flex items-center gap-1.5">
            <Clock className={cn('w-3.5 h-3.5', isOverdue ? 'text-red-500' : daysLeft <= 3 ? 'text-red-500' : daysLeft <= 7 ? 'text-amber-500' : 'text-slate-400')} />
            <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', deadlineBadgeStyle)}>
              {deadlineText}
            </span>
          </div>
        </div>
        </div>
    </div>
  );
}

// Color palette for client cards
const CLIENT_COLORS = [
  'bg-accent text-primary', 'bg-amber-100 text-amber-600',
  'bg-indigo-100 text-indigo-600', 'bg-pink-100 text-pink-600',
  'bg-teal-100 text-teal-600', 'bg-sky-100 text-sky-600',
  'bg-violet-100 text-violet-600', 'bg-rose-100 text-rose-600',
];

function WidgetWrapper({ 
  children, 
  id, 
  editingLayout, 
  onMoveUp, 
  onMoveDown, 
  isFirst, 
  isLast,
  order
}: { 
  children: React.ReactNode; 
  id: string; 
  editingLayout: boolean; 
  onMoveUp: () => void; 
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
  order: number;
}) {
  return (
    <div className={cn("relative transition-all duration-300", editingLayout && "p-4 border-2 border-dashed border-primary/40 rounded-xl bg-primary/5")} style={{ order }}>
      {editingLayout && (
        <div className="absolute -left-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 bg-white dark:bg-slate-800 shadow-md rounded-lg p-1 z-10 border border-slate-200 dark:border-slate-700">
          <button 
            onClick={onMoveUp} 
            disabled={isFirst}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 disabled:opacity-30"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <div className="w-full h-px bg-slate-100 dark:bg-slate-700"></div>
          <button 
            onClick={onMoveDown} 
            disabled={isLast}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 disabled:opacity-30"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
      {children}
    </div>
  );
}

export default function AccountyApp() {
  const { user } = useAuth();
  const { data: supabaseClients, isLoading: clientsLoading } = useAccountyClients();
  const { data: supabaseKpis } = useAccountyKpis();
  const { data: monthlyTrendData } = useAccountyMonthlyTrend();
  const { data: colleagueStats } = useAccountyColleagueStats();
  const { data: auditLog } = useAccountyAuditLog(10);
  const { data: portalStats } = useAccountyPortalStats();
  const kanbanMutation = useUpdateKanbanStatus();
  const updateOwnerMutation = useUpdateClientOwner();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Minden');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ClientData['status'] | null>(null);
  const [ownerOverrides, setOwnerOverrides] = useState<Record<string, string>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ClientData['status']>>({});
  const navigate = useNavigate();
  const { role, isAdmin, isSenior } = useAccountyRole();

  // Keyboard shortcuts for power-user navigation
  // Plain keys work because the hook ignores keypresses inside inputs/textareas
  useKeyboardShortcuts([
    { combo: { key: '1' }, handler: () => setViewMode('grid'), preventDefault: false, description: 'Rács nézet (1)' },
    { combo: { key: '2' }, handler: () => setViewMode('list'), preventDefault: false, description: 'Lista nézet (2)' },
    { combo: { key: '3' }, handler: () => setViewMode('kanban'), preventDefault: false, description: 'Kanban nézet (3)' },
  ]);

  // F1: Bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const selectAll = (ids: string[]) => setSelectedIds(new Set(ids));
  const clearSelection = () => setSelectedIds(new Set());

  // F2: Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // F8: Widget order with localStorage persistence
  const DEFAULT_WIDGET_ORDER = ['kpi_cards', 'charts', 'monthly_trend', 'colleague_table', 'audit_log', 'automation_analytics'] as const;
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    try { 
      const saved = localStorage.getItem('accounty-widget-order'); 
      let parsed = saved ? JSON.parse(saved) : [...DEFAULT_WIDGET_ORDER]; 
      if (Array.isArray(parsed) && !parsed.includes('automation_analytics')) {
        parsed.push('automation_analytics');
      }
      return parsed;
    } catch { return [...DEFAULT_WIDGET_ORDER]; }
  });
  const [editingLayout, setEditingLayout] = useState(false);
  useEffect(() => { localStorage.setItem('accounty-widget-order', JSON.stringify(widgetOrder)); }, [widgetOrder]);
  const moveWidget = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= widgetOrder.length) return;
    setWidgetOrder(prev => { const next = [...prev]; [next[idx], next[newIdx]] = [next[newIdx], next[idx]]; return next; });
  };

  // Map Supabase data → ClientData format for UI compatibility
  const clients: ClientData[] = useMemo(() => {
    if (!supabaseClients || supabaseClients.length === 0) return [];
    return supabaseClients.map((sc, idx): ClientData => ({
      id: sc.id,
      name: sc.name,
      taxNumber: sc.taxNumber || '',
      status: statusOverrides[sc.id] || sc.status,
      unprocessedCount: sc.unprocessedCount,
      missingCount: sc.missingCount,
      deadline: sc.deadlineDate
        ? new Date(sc.deadlineDate).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' }) + '.'
        : '–',
      deadlineDate: sc.deadlineDate || new Date(Date.now() + 30 * 86400000).toISOString(),
      progress: sc.progress,
      colorHex: CLIENT_COLORS[idx % CLIENT_COLORS.length],
      assignedToMe: ownerOverrides[sc.id] 
        ? ownerOverrides[sc.id] === user?.id 
        : sc.assignedToMe,
      ownerId: ownerOverrides[sc.id] || sc.ownerId || '1',
      isMainAccountant: sc.isMainAccountant ?? false,
    }));
  }, [supabaseClients, ownerOverrides, statusOverrides, user?.id]);

  // KPIs from Supabase (fallback to 0)
  const kpis = useMemo(() => ({
    totalClients: supabaseKpis?.totalClients || 0,
    unprocessedInvoices: supabaseKpis?.unprocessedInvoices || 0,
    missingInvoices: supabaseKpis?.missingItems || 0,
    upcomingDeadlines: supabaseKpis?.upcomingDeadlines || 0,
  }), [supabaseKpis]);

  // Dynamic KPI stats for "Irodai KPI" view – computed from actual clients
  const dynamicKpiStats = useMemo(() => {
    const total = clients.length;
    const kritikus = clients.filter(c => c.status === 'Kritikus').length;
    const rendben = clients.filter(c => c.status === 'Rendben').length;
    const zarasiPct = total > 0 ? Math.round((rendben / total) * 100) : 0;
    return {
      zarasiSzazalek: zarasiPct,
      kritikusDb: kritikus,
      kiosztottLezart: `${total} / ${rendben}`,
    };
  }, [clients]);

  // Dynamic pie chart from actual client statuses
  const dynamicPieData = useMemo(() => {
    const rendben = clients.filter(c => c.status === 'Rendben').length;
    const feldolgozando = clients.filter(c => c.status === 'Feldolgozandó').length;
    const kritikus = clients.filter(c => c.status === 'Kritikus').length;
    return [
      { name: 'Rendben', value: rendben, color: 'hsl(173, 80%, 40%)' },
      { name: 'Feldolgozandó', value: feldolgozando, color: '#f59e0b' },
      { name: 'Kritikus', value: kritikus, color: '#ef4444' },
    ];
  }, [clients]);

  // Dynamic bar chart – missing items per accountant (mock accountant names, real values)
  const dynamicBarData = useMemo(() => {
    // Since we don't have per-accountant breakdown, group all as single entry
    const totalMissing = clients.reduce((sum, c) => sum + c.missingCount, 0);
    const totalUnprocessed = clients.reduce((sum, c) => sum + c.unprocessedCount, 0);
    return [
      { name: 'Hiányzó', value: totalMissing },
      { name: 'Feldolgozatlan', value: totalUnprocessed },
      { name: 'Rendben', value: clients.filter(c => c.status === 'Rendben').length },
    ];
  }, [clients]);

  const handleUpdateOwner = (clientId: string, ownerId: string) => {
    setOwnerOverrides(prev => ({ ...prev, [clientId]: ownerId }));
    const client = clients.find(c => c.id === clientId);
    const oldOwnerId = client?.ownerId || '1';
    updateOwnerMutation.mutate({
      companyId: clientId,
      newOwnerId: ownerId,
      oldOwnerId
    }, {
      onError: (err: any) => {
        console.error("Hiba a könyvelő módosításakor:", err);
        setOwnerOverrides(prev => {
          const next = { ...prev };
          delete next[clientId];
          return next;
        });
        alert("Nem sikerült módosítani a könyvelőt: " + (err.message || err));
      }
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('clientId', id);
    e.dataTransfer.effectAllowed = 'move';
    // Use setTimeout so the dragged ghost image doesn't get the opacity styles
    setTimeout(() => setDraggedId(id), 0);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, status: ClientData['status']) => {
    e.preventDefault();
    if (dragOverColumn !== status) {
      setDragOverColumn(status);
    }
  };


  const handleDrop = (e: React.DragEvent, newStatus: ClientData['status']) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggedId(null);
    
    const clientId = e.dataTransfer.getData('clientId');
    if (!clientId) return;
    
    setStatusOverrides(prev => ({ ...prev, [clientId]: newStatus }));
    
    // Persist to Supabase
    const sc = supabaseClients?.find(c => c.id === clientId);
    if (sc) {
      kanbanMutation.mutate({ assignmentId: sc.id, status: newStatus });
    }
  };

  const [viewScope, setViewScope] = useState<'kpi' | 'mine' | 'all'>('kpi');

  // Inline invite code state (must be before any early returns)
  const [showInviteCode, setShowInviteCode] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [codeStatus, setCodeStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid' | 'expired' | 'already_assigned'>('idle');
  const [linkedCompany, setLinkedCompany] = useState<{ id: string; name: string; tax_number: string } | null>(null);
  const [isJoiningAsAccountant, setIsJoiningAsAccountant] = useState(false);
  const queryClientRef = useQueryClient();

  // Előszűrjük a saját/összes nézet alapján
  const scopedClients = clients.filter(client => 
    viewScope === 'all' || client.isMainAccountant
  );

  const filteredClients = scopedClients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          client.taxNumber.includes(searchQuery);
    const matchesStatus = statusFilter === 'Minden' || client.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const mineCount = clients.filter(c => c.isMainAccountant).length;
  const allCount = clients.length;

  // Wizard visibility: once shown, stays visible until user completes it
  // (even if clients are added mid-wizard via invite code / sync)
  // MUST be declared before any early returns to satisfy React hooks rules
  const [wizardDismissed, setWizardDismissed] = useState(false);
  const showWizard = !clientsLoading
    && !wizardDismissed
    && localStorage.getItem('accounty-welcome-done') !== '1'
    && clients.length === 0;
  const [wizardActive, setWizardActive] = useState(false);
  useEffect(() => {
    if (showWizard && !wizardActive) setWizardActive(true);
  }, [showWizard]);

  if (clientsLoading) {
    return (
      <div className="w-full space-y-6 animate-in fade-in duration-300">
        {/* Skeleton KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-card rounded-xl p-5 border border-border h-32 animate-pulse">
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded" />
                <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-lg" />
              </div>
              <div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded mt-8" />
            </div>
          ))}
        </div>
        {/* Skeleton cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-card rounded-xl border border-border overflow-hidden animate-pulse" style={{ animationDelay: `${i * 100}ms` }}>
              <div className="h-1 w-full bg-slate-200 dark:bg-slate-800" />
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                    <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800 rounded" />
                  </div>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
                  <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }


  // Invite code handlers
  const handleValidateCode = async () => {
    if (!inviteCode.trim()) return;
    setCodeStatus('validating');
    setLinkedCompany(null);
    try {
      const { data, error } = await supabase.functions.invoke('validate-partner-code', {
        body: { share_token: inviteCode.trim() },
      });
      if (error) throw error;
      if (data?.valid) {
        setCodeStatus('valid');
        setLinkedCompany(data.company);
      } else if (data?.error === 'token_expired') {
        setCodeStatus('expired');
      } else {
        setCodeStatus('invalid');
      }
    } catch (err) {
      reportError({ type: 'edge_function', component: 'AccountyApp', action: 'error', message: 'Failed to validate partner code:', error: err });
      setCodeStatus('invalid');
    }
  };

  const handleJoinAsAccountant = async () => {
    if (!inviteCode.trim() || codeStatus !== 'valid') return;
    setIsJoiningAsAccountant(true);
    try {
      const { data, error } = await supabase.functions.invoke('join-company-as-accountant', {
        body: { share_token: inviteCode.trim() },
      });
      if (error) throw error;
      if (data?.error === 'already_assigned') {
        setCodeStatus('already_assigned');
        return;
      }
      if (data?.error) {
        setCodeStatus('invalid');
        return;
      }
      queryClientRef.invalidateQueries({ queryKey: ['accounty-clients'] });
      queryClientRef.invalidateQueries({ queryKey: ['accounty-kpis'] });
      setInviteCode('');
      setCodeStatus(null);
    } catch (err) {
      reportError({ type: 'edge_function', component: 'AccountyApp', action: 'error', message: 'Failed to join as accountant:', error: err });
      setCodeStatus('invalid');
    } finally {
      setIsJoiningAsAccountant(false);
    }
  };

  if (wizardActive && !wizardDismissed) {
    return (
      <AccountyWelcomeWizard
        onComplete={() => {
          localStorage.setItem('accounty-welcome-done', '1');
          setWizardDismissed(true);
          setWizardActive(false);
        }}
      />
    );
  }

  if (!clientsLoading && clients.length === 0) {

    // Post-onboarding empty state (user completed wizard but has no clients yet)
    return (
      <div className="w-full flex flex-col items-center justify-center py-24 gap-6">
        <Database className="w-12 h-12 text-slate-300 dark:text-slate-600" />
        <div className="text-center space-y-2">
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">Nincs hozzárendelt ügyfél</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
            Rendeld hozzá magad az eaisybill cégeidhez, vagy add hozzá az ügyfeled meghívó kóddal.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              const result = await seedAccountyAssignments();
              if (result && !('error' in result)) {
                window.location.reload();
              }
            }}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-medium text-sm transition-colors shadow-lg"
          >
            Hozzárendelés indítása (eaisybill cégek)
          </button>
          <button
            onClick={() => setShowInviteCode(!showInviteCode)}
            className={cn(
              "px-6 py-3 rounded-xl font-medium text-sm transition-all border shadow-soft",
              showInviteCode
                ? "bg-primary/10 dark:bg-primary/20 text-primary border-primary/30"
                : "bg-card hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border-border"
            )}
          >
            Hozzáadás meghívó kóddal
          </button>
        </div>

        {/* Inline invite code form */}
        {showInviteCode && (
          <div className="w-full max-w-lg animate-in fade-in slide-in-from-top-4 duration-400">
            <div className="bg-card rounded-xl p-6 border border-border shadow-soft">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">Ügyfél hozzáadása meghívó kóddal</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Írd be az ügyfeled eaisybill fiókjából generált meghívó kódot</p>
              
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-5 mb-6">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">Így működik:</h3>
                <ol className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                  <li>1. Kérd meg az ügyfelet, hogy generáljon meghívó kódot az eaisybill Beállításokban</li>
                  <li>2. Írd be ide a kapott kódot és ellenőrizd</li>
                  <li>3. Ha érvényes, add hozzá az ügyfelet</li>
                </ol>
              </div>

              <div className="space-y-2 mb-6">
                <Label className="text-sm font-medium text-slate-900 dark:text-slate-100">Meghívó kód</Label>
                <Input 
                  placeholder="pl. A1B2C3" 
                  value={inviteCode}
                  onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setCodeStatus('idle'); setLinkedCompany(null); }}
                  className="bg-slate-50/50 dark:bg-slate-900/50 border-border font-mono uppercase tracking-widest text-lg" 
                />
                {/* Validation feedback */}
                {codeStatus === 'valid' && linkedCompany && (
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm mt-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800 animate-in fade-in slide-in-from-top-2 duration-300">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Cég megtalálva: <strong>{linkedCompany.name}</strong> ({linkedCompany.tax_number})</span>
                  </div>
                )}
                {codeStatus === 'invalid' && (
                  <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm mt-2 p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg border border-rose-200 dark:border-rose-800 animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Érvénytelen meghívó kód</span>
                  </div>
                )}
                {codeStatus === 'expired' && (
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>A meghívó kód lejárt — kérj újat az ügyféltől!</span>
                  </div>
                )}
                {codeStatus === 'already_assigned' && (
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-sm mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800 animate-in fade-in duration-200">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>Ez a cég már hozzá van rendelve a fiókodhoz</span>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button variant="outline" onClick={() => { setShowInviteCode(false); setInviteCode(''); setCodeStatus('idle'); setLinkedCompany(null); }} className="border-border text-slate-700 dark:text-slate-300">
                  Mégse
                </Button>
                {codeStatus === 'valid' ? (
                  <Button 
                    onClick={handleJoinAsAccountant} 
                    disabled={isJoiningAsAccountant}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
                  >
                    {isJoiningAsAccountant ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Hozzáadás...</>
                    ) : (
                      <><Check className="w-4 h-4 mr-2" /> Ügyfél hozzáadása</>
                    )}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleValidateCode} 
                    disabled={!inviteCode.trim() || codeStatus === 'validating'}
                    className="px-6"
                  >
                    {codeStatus === 'validating' ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Ellenőrzés...</>
                    ) : (
                      'Kód ellenőrzése'
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header section */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Portfólió</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Ügyfeleid áttekintése és kezelése</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Role badge (read from DB) */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
            {isAdmin ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <Shield className="w-3.5 h-3.5" />
                Irodavezető
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">
                <UserCheck className="w-3.5 h-3.5" />
                {role === 'senior_könyvelő' ? 'Senior könyvelő' : role === 'asszisztens' ? 'Asszisztens' : 'Könyvelő'}
              </span>
            )}
          </div>
          <Link to="/accounty/new-client">
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Új ügyfél
          </Button>
          </Link>
        </div>
      </div>

      {/* KPIs (Hidden in KPI view since it has its own) */}
      {viewScope !== 'kpi' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stagger-1"><KpiCard title="Összes ügyfél" value={kpis.totalClients} icon={Users} accentColor="teal" /></div>
          <div className="stagger-2"><KpiCard title="Feldolgozatlan számlák" value={kpis.unprocessedInvoices} icon={FileText} accentColor="blue" /></div>
          <div className="stagger-3"><KpiCard title="Hiányzó számlák" value={kpis.missingInvoices} icon={AlertTriangle} valueClass="text-red-600" accentColor="red" onClick={() => navigate('/accounty/missing-invoices')} /></div>
          <div className="stagger-4"><KpiCard title="Közeledő határidők" value={kpis.upcomingDeadlines} icon={Clock} accentColor="amber" onClick={() => navigate('/accounty/tax-calendar')} /></div>
        </div>
      )}

      {/* Scope Tabs */}
      <div className="w-full bg-slate-100/80 dark:bg-slate-900/80 p-1.5 rounded-xl border border-border/60 shadow-inner flex items-center">
        <button
          onClick={() => setViewScope('kpi')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
            viewScope === 'kpi' 
              ? "bg-card text-slate-900 dark:text-slate-100 shadow-soft" 
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-slate-200/50"
          )}
        >
          <BarChart2 className="w-4 h-4" />
          {isAdmin ? 'Irodai KPI (Vezetői)' : 'Statisztikák'}
        </button>
        <button
          onClick={() => setViewScope('mine')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
            viewScope === 'mine' 
              ? "bg-card text-slate-900 dark:text-slate-100 shadow-soft" 
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-slate-200/50"
          )}
        >
          <User className="w-4 h-4" />
          Saját ügyfeleim ({mineCount})
        </button>
        {isAdmin && (
          <button
            onClick={() => setViewScope('all')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
              viewScope === 'all' 
                ? "bg-card text-slate-900 dark:text-slate-100 shadow-soft" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-slate-200/50"
            )}
          >
            <Building className="w-4 h-4" />
            Összes ügyfél ({allCount})
          </button>
        )}
      </div>

      {/* Toolbar - Hide if KPI view */}
      {viewScope !== 'kpi' && (
        <div className="flex items-center justify-between gap-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm p-3 rounded-xl border border-border shadow-soft sticky top-0 z-10">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Keresés..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-50 dark:bg-background border-transparent focus-visible:ring-primary"
              />
            </div>
            
            <div className="hidden sm:block">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-card border-border h-9 gap-2 text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 shrink-0" />
                    <SelectValue placeholder="Szűrés..." />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Minden">Minden</SelectItem>
                  <SelectItem value="Rendben">Rendben</SelectItem>
                  <SelectItem value="Feldolgozandó">Feldolgozandó</SelectItem>
                  <SelectItem value="Kritikus">Kritikus</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center bg-slate-50 dark:bg-background rounded-lg p-1 border border-border">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('grid')}
              className={cn("h-8 w-8 rounded-md transition-all", viewMode === 'grid' ? "bg-card shadow-soft text-slate-900 dark:text-slate-100" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300")}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('list')}
              className={cn("h-8 w-8 rounded-md transition-all", viewMode === 'list' ? "bg-card shadow-soft text-slate-900 dark:text-slate-100" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300")}
            >
              <ListIcon className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('kanban')}
              className={cn("h-8 w-8 rounded-md transition-all", viewMode === 'kanban' ? "bg-card shadow-soft text-slate-900 dark:text-slate-100" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300")}
            >
              <Kanban className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Content based on View Mode */}
      {viewScope === 'kpi' ? (
        <div className="flex flex-col gap-6 animate-in fade-in duration-500">
          {/* Top Row: 3 KPI Cards */}
          <WidgetWrapper 
            id="kpi_cards" 
            editingLayout={editingLayout} 
            onMoveUp={() => moveWidget(widgetOrder.indexOf('kpi_cards'), -1)} 
            onMoveDown={() => moveWidget(widgetOrder.indexOf('kpi_cards'), 1)}
            isFirst={widgetOrder.indexOf('kpi_cards') === 0}
            isLast={widgetOrder.indexOf('kpi_cards') === widgetOrder.length - 1}
            order={widgetOrder.indexOf('kpi_cards')}
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-card rounded-xl p-6 border border-border shadow-soft flex flex-col justify-center">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">{`Zárási státusz (${new Date().toLocaleDateString('hu-HU', { month: 'long' }).replace(/^./, c => c.toUpperCase())}):`}</h3>
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">{dynamicKpiStats.zarasiSzazalek}%</span>
                <span className="text-sm font-semibold text-primary">aktív</span>
              </div>
            </div>
            <div className="bg-card rounded-xl p-6 border border-border shadow-soft flex flex-col justify-center">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Kritikus ügyfelek:</h3>
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">{dynamicKpiStats.kritikusDb} db</span>
              </div>
            </div>
            <div className="bg-card rounded-xl p-6 border border-border shadow-soft flex flex-col justify-center">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Kiosztott / Rendben:</h3>
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">{dynamicKpiStats.kiosztottLezart}</span>
              </div>
            </div>
            <div className="bg-card rounded-xl p-6 border border-border shadow-soft flex flex-col justify-center">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Portál aktivitás:</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">{portalStats?.totalVisits ?? 0}</span>
                <span className="text-sm font-semibold text-primary">látogatás</span>
              </div>
              <span className="text-xs text-slate-400 mt-1">{portalStats?.activeLinks ?? 0} aktív link</span>
            </div>
            </div>
          </WidgetWrapper>

          {/* F8: Widget layout edit button */}
          <div className="flex justify-end" style={{ order: -1 }}>
            <button
              onClick={() => setEditingLayout(!editingLayout)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                editingLayout
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              <GripVertical className="w-3.5 h-3.5" />
              Elrendezés
            </button>
          </div>

          {/* Middle Row: Charts */}
          <WidgetWrapper 
            id="charts" 
            editingLayout={editingLayout} 
            onMoveUp={() => moveWidget(widgetOrder.indexOf('charts'), -1)} 
            onMoveDown={() => moveWidget(widgetOrder.indexOf('charts'), 1)}
            isFirst={widgetOrder.indexOf('charts') === 0}
            isLast={widgetOrder.indexOf('charts') === widgetOrder.length - 1}
            order={widgetOrder.indexOf('charts')}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl p-6 border border-border shadow-soft h-80 flex flex-col">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                Könyvelői Teljesítmény
              </h3>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dynamicBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="[&>line]:stroke-slate-100 dark:[&>line]:stroke-slate-800" stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <RechartsTooltip cursor={{ fill: 'rgba(100,116,139,0.1)' }} content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{Number(payload[0].value).toLocaleString('hu-HU')}</p>
                        </div>
                      );
                    }} />
                    <Bar dataKey="value" fill="hsl(173, 80%, 40%)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border shadow-soft h-80 flex flex-col relative">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-amber-600" />
                {isAdmin ? 'Irodai Ügyfél Státuszok' : 'Saját Ügyfél Státuszok'}
              </h3>
              <div className="flex-1 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dynamicPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {dynamicPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-0.5">{payload[0].name}</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{payload[0].value}</p>
                        </div>
                      );
                    }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-8">
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Összes:</span>
                  <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{clients.length}</span>
                </div>
              </div>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                 {dynamicPieData.map((entry) => {
                   const pct = clients.length > 0 ? Math.round((entry.value / clients.length) * 100) : 0;
                   return (
                     <div key={entry.name} className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                       <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{entry.name} {pct}%</span>
                     </div>
                   );
                 })}
              </div>
            </div>
          </div>
          </WidgetWrapper>

          {/* Monthly Trend Chart */}
          <WidgetWrapper 
            id="monthly_trend" 
            editingLayout={editingLayout} 
            onMoveUp={() => moveWidget(widgetOrder.indexOf('monthly_trend'), -1)} 
            onMoveDown={() => moveWidget(widgetOrder.indexOf('monthly_trend'), 1)}
            isFirst={widgetOrder.indexOf('monthly_trend') === 0}
            isLast={widgetOrder.indexOf('monthly_trend') === widgetOrder.length - 1}
            order={widgetOrder.indexOf('monthly_trend')}
          >
            <div className="bg-card rounded-xl p-6 border border-border shadow-soft">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                Havi Zárási Trend (utolsó 6 hónap)
              </h3>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData || []} margin={{ top: 10, right: 40, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="[&>line]:stroke-slate-100 dark:[&>line]:stroke-slate-800" stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v) => `${v} db`} />
                  <RechartsTooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const labels: Record<string, string> = { zaras: 'Zárási %', hianyzok: 'Hiányzó számlák' };
                    return (
                      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</p>
                        {payload.map((p: any, i: number) => (
                          <p key={i} className="text-sm font-bold text-slate-900 dark:text-white">
                            {labels[p.dataKey] || p.dataKey}: {p.value}{p.dataKey === 'zaras' ? '%' : ' db'}
                          </p>
                        ))}
                      </div>
                    );
                  }} />
                  <Line type="monotone" dataKey="zaras" yAxisId="left" stroke="hsl(173, 80%, 40%)" strokeWidth={2.5} dot={{ fill: 'hsl(173, 80%, 40%)', r: 4 }} activeDot={{ r: 6 }} name="zaras" />
                  <Line type="monotone" dataKey="hianyzok" yAxisId="right" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} strokeDasharray="5 5" name="hianyzok" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-6 mt-3 justify-center">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-primary rounded"></div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Zárási %</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-red-500 rounded border-dashed"></div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Hiányzó számlák</span>
              </div>
            </div>
          </div>
          </WidgetWrapper>

          {/* Bottom Row: Table (admin only) */}
          {isAdmin && <WidgetWrapper 
            id="colleague_table" 
            editingLayout={editingLayout} 
            onMoveUp={() => moveWidget(widgetOrder.indexOf('colleague_table'), -1)} 
            onMoveDown={() => moveWidget(widgetOrder.indexOf('colleague_table'), 1)}
            isFirst={widgetOrder.indexOf('colleague_table') === 0}
            isLast={widgetOrder.indexOf('colleague_table') === widgetOrder.length - 1}
            order={widgetOrder.indexOf('colleague_table')}
          >
            <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="p-4 border-b border-border dark:bg-slate-900/50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Kolléga statisztikák (Havi Zárás)
              </h3>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                <Download className="w-3.5 h-3.5" />
                Letöltés
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-border text-slate-500 dark:text-slate-400 font-medium text-xs tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Kolléga</th>
                    <th className="px-4 py-4 text-center">Kiosztott</th>
                    <th className="px-4 py-4 text-center">Lezárt</th>
                    <th className="px-4 py-4 text-center">Zárási %</th>
                    <th className="px-4 py-4 text-center">Átl. feldolg. idő</th>
                    <th className="px-4 py-4 text-center">Hiányzó</th>
                    <th className="px-4 py-4 text-center">Hatékonyság</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {(colleagueStats || []).map((colleague, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {colleague.initial}
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{colleague.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-medium text-slate-900 dark:text-slate-100">{colleague.assigned}</td>
                      <td className="px-4 py-4 text-center font-medium text-slate-900 dark:text-slate-100">{colleague.closed}</td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                            <div className={cn('h-1.5 rounded-full', colleague.closingPct >= 80 ? 'bg-primary' : colleague.closingPct >= 60 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${colleague.closingPct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{colleague.closingPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-medium text-slate-900 dark:text-slate-100">{colleague.avgDays} nap</td>
                      <td className="px-4 py-4 text-center">
                        {colleague.missing > 15 ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {colleague.missing}
                          </div>
                        ) : (
                          <span className="font-medium text-slate-900 dark:text-slate-100">{colleague.missing}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span className={cn(
                          'inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider',
                          colleague.efficiency === 'Kiváló' 
                            ? 'bg-accent dark:bg-accent text-accent-foreground dark:text-primary'
                            : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
                        )}>
                          {colleague.efficiency}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </WidgetWrapper>}

          {/* Audit Log + Portal Stats (admin only) */}
          {isAdmin && <WidgetWrapper 
            id="audit_log" 
            editingLayout={editingLayout} 
            onMoveUp={() => moveWidget(widgetOrder.indexOf('audit_log'), -1)} 
            onMoveDown={() => moveWidget(widgetOrder.indexOf('audit_log'), 1)}
            isFirst={widgetOrder.indexOf('audit_log') === 0}
            isLast={widgetOrder.indexOf('audit_log') === widgetOrder.length - 1}
            order={widgetOrder.indexOf('audit_log')}
          >
            <div className="bg-card rounded-xl border border-border shadow-soft p-6">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Tevékenységnapló
            </h3>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {(auditLog || []).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">Még nincs bejegyzés</p>
              ) : (
                (auditLog || []).map((entry: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{entry.action}</span>
                      {entry.details && <span className="text-slate-400 ml-1">— {typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details)}</span>}
                    </div>
                    <span className="text-slate-400 shrink-0">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          </WidgetWrapper>}

          {/* Új Szekció: Automatizmus & Ügyfél Analitika (admin only) */}
          {isAdmin && <WidgetWrapper 
            id="automation_analytics" 
            editingLayout={editingLayout} 
            onMoveUp={() => moveWidget(widgetOrder.indexOf('automation_analytics'), -1)} 
            onMoveDown={() => moveWidget(widgetOrder.indexOf('automation_analytics'), 1)}
            isFirst={widgetOrder.indexOf('automation_analytics') === 0}
            isLast={widgetOrder.indexOf('automation_analytics') === widgetOrder.length - 1}
            order={widgetOrder.indexOf('automation_analytics')}
          >
            <div className="pt-8">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
               Bekérési Automatizmus & Ügyfél Kockázat
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Bal kártya: Csatornák */}
              <div className="bg-card rounded-xl p-6 border border-border shadow-soft hover:shadow-md transition-shadow">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-6">Értesítési Csatornák (Sikeres adatbekérés %)</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Phone className="w-4 h-4 text-slate-400" />
                        AI Telefonhívás
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">92%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: '92%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <MessageCircle className="w-4 h-4 text-slate-400" />
                        Viber / Telegram
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">75%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                      <div className="bg-amber-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Mail className="w-4 h-4 text-slate-400" />
                        E-mail értesítés
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">42%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                      <div className="bg-red-500 h-2 rounded-full" style={{ width: '42%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Jobb kártya: Problémás Ügyfelek */}
              <div className="bg-card rounded-xl p-6 border border-border shadow-soft hover:shadow-md transition-shadow flex flex-col">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-6">Legtöbb hiányzó tétellel rendelkező ügyfelek</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-transparent border-b border-border text-slate-500 dark:text-slate-400 font-medium text-xs tracking-wider">
                      <tr>
                        <th className="pb-3 pr-4">Ügyfél neve</th>
                        <th className="pb-3 px-4 text-center">Hiányzó</th>
                        <th className="pb-3 pl-4 text-right">Kockázat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      {[...clients]
                        .sort((a, b) => b.missingCount - a.missingCount)
                        .slice(0, 5)
                        .filter(c => c.missingCount > 0)
                        .map(c => (
                        <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group/row relative" onClick={() => navigate(`/accounty/missing-invoices/${c.id}`)}>
                          <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-slate-100">{c.name}</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-900 dark:text-slate-100">{c.missingCount}</td>
                          <td className="py-3 pl-4 text-right">
                            <span className={cn(
                              "inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider",
                              c.missingCount > 500
                                ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                                : c.missingCount > 100
                                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                                : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400"
                            )}>
                              {c.missingCount > 500 ? 'Kritikus' : c.missingCount > 100 ? 'Magas' : 'Közepes'}
                            </span>
                          </td>
                          {/* Hover tooltip with top items */}
                          <td className="p-0 relative">
                            <MissingItemsTooltip companyId={c.id} />
                          </td>
                        </tr>
                      ))}
                      {clients.filter(c => c.missingCount > 0).length === 0 && (
                        <tr><td colSpan={3} className="py-6 text-center text-slate-400 text-sm">Nincs kritikus ügyfél</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
            </div>
          </WidgetWrapper>}
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Feldolgozandó oszlop */}
          <div 
            className={cn(
              "p-4 rounded-xl border flex flex-col gap-4 min-h-[500px] transition-all duration-200",
              dragOverColumn === 'Feldolgozandó' ? "bg-amber-50/80 border-amber-300 ring-4 ring-amber-500/10" : "bg-slate-100/60 dark:bg-slate-900/60 border-border/60"
            )}
            onDragOver={(e) => handleDragOver(e, 'Feldolgozandó')}
            onDrop={(e) => handleDrop(e, 'Feldolgozandó')}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                Feldolgozandó
              </h3>
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {filteredClients.filter(c => c.status === 'Feldolgozandó').length}
              </span>
            </div>
            {filteredClients.filter(c => c.status === 'Feldolgozandó').map(client => (
              <ClientCard 
                key={client.id} 
                client={client} 
                draggable 
                isDragged={draggedId === client.id}
                onDragStart={(e) => handleDragStart(e, client.id)} 
                onDragEnd={handleDragEnd}
                onUpdateOwner={handleUpdateOwner}
              />
            ))}
            {filteredClients.filter(c => c.status === 'Feldolgozandó').length === 0 && (
              <div className="text-center py-8 text-sm text-slate-400 border-2 border-dashed border-border rounded-lg">Nincs ügyfél</div>
            )}
          </div>

          {/* Rendben oszlop */}
          <div 
            className={cn(
              "p-4 rounded-xl border flex flex-col gap-4 min-h-[500px] transition-all duration-200",
              dragOverColumn === 'Rendben' ? "bg-accent-subtle/80 border-primary/30 ring-4 ring-primary/10" : "bg-slate-100/60 dark:bg-slate-900/60 border-border/60"
            )}
            onDragOver={(e) => handleDragOver(e, 'Rendben')}
            onDrop={(e) => handleDrop(e, 'Rendben')}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                Rendben
              </h3>
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {filteredClients.filter(c => c.status === 'Rendben').length}
              </span>
            </div>
            {filteredClients.filter(c => c.status === 'Rendben').map(client => (
              <ClientCard 
                key={client.id} 
                client={client} 
                draggable 
                isDragged={draggedId === client.id}
                onDragStart={(e) => handleDragStart(e, client.id)} 
                onDragEnd={handleDragEnd}
                onUpdateOwner={handleUpdateOwner}
              />
            ))}
            {filteredClients.filter(c => c.status === 'Rendben').length === 0 && (
              <div className="text-center py-8 text-sm text-slate-400 border-2 border-dashed border-border rounded-lg">Nincs ügyfél</div>
            )}
          </div>

          {/* Kritikus oszlop */}
          <div 
            className={cn(
              "p-4 rounded-xl border flex flex-col gap-4 min-h-[500px] transition-all duration-200",
              dragOverColumn === 'Kritikus' ? "bg-red-50/80 border-red-300 ring-4 ring-red-500/10" : "bg-slate-100/60 dark:bg-slate-900/60 border-border/60"
            )}
            onDragOver={(e) => handleDragOver(e, 'Kritikus')}
            onDrop={(e) => handleDrop(e, 'Kritikus')}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                Kritikus
              </h3>
              <span className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold px-2 py-0.5 rounded-full">
                {filteredClients.filter(c => c.status === 'Kritikus').length}
              </span>
            </div>
            {filteredClients.filter(c => c.status === 'Kritikus').map(client => (
              <ClientCard 
                key={client.id} 
                client={client} 
                draggable 
                isDragged={draggedId === client.id}
                onDragStart={(e) => handleDragStart(e, client.id)} 
                onDragEnd={handleDragEnd}
                onUpdateOwner={handleUpdateOwner}
              />
            ))}
            {filteredClients.filter(c => c.status === 'Kritikus').length === 0 && (
              <div className="text-center py-8 text-sm text-slate-400 border-2 border-dashed border-border rounded-lg">Nincs ügyfél</div>
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredClients.map((client, idx) => (
            <div key={client.id} className={`stagger-${Math.min(idx + 1, 8)}`}>
              <ClientCard client={client} onUpdateOwner={handleUpdateOwner} />
            </div>
          ))}
          {filteredClients.length === 0 && (
            <div className="col-span-full py-16 text-center">
              <Search className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-lg font-semibold text-foreground">Nincs találat</p>
              <p className="text-sm text-muted-foreground mt-1">
                Keresés: "{searchQuery}" {statusFilter !== 'Minden' && `· Státusz: ${statusFilter}`}
              </p>
              <Button variant="outline" className="mt-4 gap-2" onClick={() => { setSearchQuery(''); setStatusFilter('Minden'); }}>
                <X className="w-4 h-4" />
                Szűrők törlése
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.target instanceof HTMLInputElement) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(prev => Math.min(prev + 1, filteredClients.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(prev => Math.max(prev - 1, 0)); }
            else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredClients.length) { navigate(`/accounty/client/${filteredClients[focusedIndex].id}`); }
            else if (e.key === 'Escape') { setFocusedIndex(-1); clearSelection(); }
          }}
        >
          {/* F1: Bulk toolbar */}
          {selectedIds.size > 0 && (
            <div className="px-6 py-3 bg-primary/5 border-b border-primary/10 flex items-center gap-4">
              <span className="text-sm font-semibold text-primary">{selectedIds.size} kijelölve</span>
              <button onClick={() => selectAll(filteredClients.map(c => c.id))} className="text-xs text-slate-500 hover:text-primary transition-colors">Mind kijelölés</button>
              <button onClick={clearSelection} className="text-xs text-slate-500 hover:text-red-500 transition-colors">Törlés</button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-border text-slate-500 dark:text-slate-400 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-4 w-10">
                    <input type="checkbox" className="rounded border-slate-300 dark:border-slate-600" checked={selectedIds.size === filteredClients.length && filteredClients.length > 0} onChange={(e) => e.target.checked ? selectAll(filteredClients.map(c => c.id)) : clearSelection()} />
                  </th>
                  <th className="px-6 py-4">Cégnév</th>
                  <th className="px-6 py-4 text-center">Adószám</th>
                  <th className="px-6 py-4 text-center">Feldolgozatlan</th>
                  <th className="px-6 py-4 text-center">Hiányzó</th>
                  <th className="px-6 py-4 text-center">Határidő</th>
                  <th className="px-6 py-4 text-center">Felelős</th>
                  <th className="px-6 py-4 text-center">Státusz</th>
                  <th className="px-6 py-4 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredClients.length > 0 ? (
                  filteredClients.map((client, idx) => (
                    <tr 
                      key={client.id} 
                      onClick={() => navigate(`/accounty/client/${client.id}`)}
                      className={cn(
                        "hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer",
                        selectedIds.has(client.id) && "bg-primary/5",
                        focusedIndex === idx && "ring-2 ring-primary/30 ring-inset"
                      )}
                    >
                      <td className="px-3 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="rounded border-slate-300 dark:border-slate-600" checked={selectedIds.has(client.id)} onChange={() => toggleSelect(client.id)} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${client.colorHex} shrink-0`}>
                            <Building2 className="w-4 h-4" />
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-primary transition-colors">{client.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500 dark:text-slate-400">{client.taxNumber}</td>
                      <td className="px-6 py-4 text-center font-medium text-slate-900 dark:text-slate-100">{client.unprocessedCount}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-medium ${client.missingCount > 0 ? 'text-red-600' : 'text-slate-900 dark:text-slate-100'}`}>
                          {client.missingCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500 dark:text-slate-400">
                        <span className={`${client.status === 'Kritikus' ? 'text-red-600 font-medium' : ''}`}>
                          {client.deadline}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex justify-center">
                        <OwnerDropdown client={client} onUpdateOwner={handleUpdateOwner} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={client.status} />
                      </td>
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button className="text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      Nincs találat a következőre: "{searchQuery}" {statusFilter !== 'Minden' && `és státusz: ${statusFilter}`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
