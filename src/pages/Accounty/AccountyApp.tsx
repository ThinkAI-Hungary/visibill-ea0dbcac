import React, { useState } from 'react';
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
  TrendingUp
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { mockKpis, mockClients, ClientData, mockAccountants } from './mockData';
import { useAccountyRole } from './AccountyRoleContext';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { BarChart2, PieChart as PieChartIcon } from 'lucide-react';

const kpiStats = {
  zarasiSzazalek: 82,
  kritikusDb: 12,
  kiosztottLezart: "15 / 9"
};

const barChartData = [
  { name: 'Anna', value: 45 },
  { name: 'Péter', value: 38 },
  { name: 'Gábor', value: 24 }
];

const pieChartData = [
  { name: 'Kész', value: 15, color: '#10b981' },
  { name: 'Feldolgozandó', value: 5, color: '#f59e0b' },
  { name: 'Kritikus', value: 4, color: '#ef4444' }
];

const monthlyTrendData = [
  { month: 'Okt', zaras: 68, szamlak: 320, hianyzok: 28 },
  { month: 'Nov', zaras: 72, szamlak: 345, hianyzok: 22 },
  { month: 'Dec', zaras: 65, szamlak: 290, hianyzok: 31 },
  { month: 'Jan', zaras: 77, szamlak: 360, hianyzok: 18 },
  { month: 'Feb', zaras: 80, szamlak: 375, hianyzok: 15 },
  { month: 'Már', zaras: 82, szamlak: 390, hianyzok: 12 },
];

const colleagueStats = [
  { name: 'Anna', initial: 'A', assigned: 45, closed: 38, inProgress: 5, missing: 12, closingPct: 84, avgDays: 2.1, efficiency: 'Kiváló' as const },
  { name: 'Péter', initial: 'P', assigned: 32, closed: 28, inProgress: 4, missing: 5, closingPct: 87, avgDays: 1.8, efficiency: 'Kiváló' as const },
  { name: 'Gábor', initial: 'G', assigned: 20, closed: 15, inProgress: 5, missing: 21, closingPct: 75, avgDays: 3.5, efficiency: 'Fejlesztendő' as const }
];

function KpiCard({ title, value, icon: Icon, valueClass = "text-slate-900 dark:text-slate-100" }: { title: string, value: number, icon: React.ElementType, valueClass?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</h3>
        <Icon className={`w-5 h-5 ${valueClass === 'text-red-600' ? 'text-red-500' : 'text-slate-400'}`} />
      </div>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ClientData['status'] }) {
  const styles = {
    'Rendben': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
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
  const owner = mockAccountants.find(a => a.id === client.ownerId) || mockAccountants[0];

  if (!owner) return null;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 data-[state=open]:bg-slate-100 dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-800/50">
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
                {mockAccountants.map((acc) => (
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
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
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
        : 'bg-emerald-500';
  const deadlineBadgeStyle = isOverdue
    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
    : daysLeft <= 3
      ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400'
      : daysLeft <= 7
        ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400'
        : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400';
  const deadlineText = isOverdue
    ? `${Math.abs(daysLeft)} napja lejárt!`
    : daysLeft === 0
      ? 'Ma lejár!'
      : daysLeft === 1
        ? 'Holnap lejár'
        : `${daysLeft} nap`;
  const progressColor = client.progress >= 80
    ? 'bg-emerald-500'
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
        "bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col group cursor-pointer h-full", 
        draggable && "cursor-grab active:cursor-grabbing",
        isDragged && "opacity-50 scale-[0.98] shadow-none border-dashed border-2 ring-2 ring-emerald-500/20"
      )}
    >
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
          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreVertical className="w-4 h-4" />
          </button>
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

        <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
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

export default function AccountyApp() {
  const [clients, setClients] = useState<ClientData[]>(mockClients);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Minden');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<ClientData['status'] | null>(null);
  const navigate = useNavigate();
  const { role, setRole } = useAccountyRole();

  const handleUpdateOwner = (clientId: string, ownerId: string) => {
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, ownerId } : c));
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
    
    setClients(prev => prev.map(c => 
      c.id === clientId ? { ...c, status: newStatus } : c
    ));
  };

  const [viewScope, setViewScope] = useState<'kpi' | 'mine' | 'all'>('kpi');

  // Előszűrjük a saját/összes nézet alapján
  const scopedClients = clients.filter(client => 
    viewScope === 'all' || client.assignedToMe
  );

  const filteredClients = scopedClients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          client.taxNumber.includes(searchQuery);
    const matchesStatus = statusFilter === 'Minden' || client.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const mineCount = clients.filter(c => c.assignedToMe).length;
  const allCount = clients.length;

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header section */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Portfólió</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Ügyfeleid áttekintése és kezelése</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Role Switcher */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => { setRole('admin'); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                role === 'admin'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </button>
            <button
              onClick={() => { setRole('könyvelő'); setViewScope('mine'); }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                role === 'könyvelő'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Könyvelő
            </button>
          </div>
          <Link to="/accounty/new-client">
          <Button className="bg-[#1A1F2C] hover:bg-[#1A1F2C]/90 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-lg px-4 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Új ügyfél
          </Button>
          </Link>
        </div>
      </div>

      {/* KPIs (Hidden in KPI view since it has its own) */}
      {viewScope !== 'kpi' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Összes ügyfél" value={mockKpis.totalClients} icon={Users} />
          <KpiCard title="Feldolgozatlan számlák" value={mockKpis.unprocessedInvoices} icon={FileText} />
          <KpiCard title="Hiányzó számlák" value={mockKpis.missingInvoices} icon={AlertTriangle} valueClass="text-red-600" />
          <KpiCard title="Közeledő határidők" value={mockKpis.upcomingDeadlines} icon={Clock} />
        </div>
      )}

      {/* Scope Tabs */}
      <div className="w-full bg-slate-100/80 dark:bg-slate-900/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800/60 shadow-inner flex items-center">
        {role === 'admin' && (
          <button
            onClick={() => setViewScope('kpi')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
              viewScope === 'kpi' 
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-slate-200/50"
            )}
          >
            <BarChart2 className="w-4 h-4" />
            Irodai KPI (Vezetői)
          </button>
        )}
        <button
          onClick={() => setViewScope('mine')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
            viewScope === 'mine' 
              ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm" 
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300 hover:bg-slate-200/50"
          )}
        >
          <User className="w-4 h-4" />
          Saját ügyfeleim ({mineCount})
        </button>
        {role === 'admin' && (
          <button
            onClick={() => setViewScope('all')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200",
              viewScope === 'all' 
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm" 
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
        <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 flex-1">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Keresés..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-50 dark:bg-[#0a0a0a] border-transparent focus-visible:ring-emerald-500"
              />
            </div>
            
            <div className="hidden sm:block">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-9 gap-2 text-slate-600 dark:text-slate-400">
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
          
          <div className="flex items-center bg-slate-50 dark:bg-[#0a0a0a] rounded-lg p-1 border border-slate-100 dark:border-slate-800">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('grid')}
              className={cn("h-8 w-8 rounded-md transition-all", viewMode === 'grid' ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-slate-100" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300")}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('list')}
              className={cn("h-8 w-8 rounded-md transition-all", viewMode === 'list' ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-slate-100" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300")}
            >
              <ListIcon className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setViewMode('kanban')}
              className={cn("h-8 w-8 rounded-md transition-all", viewMode === 'kanban' ? "bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-slate-100" : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300")}
            >
              <Kanban className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Content based on View Mode */}
      {viewScope === 'kpi' ? (
        <div className="space-y-6 animate-in fade-in duration-500">
          {/* Top Row: 3 KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Zárási státusz (Május):</h3>
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">{kpiStats.zarasiSzazalek}%</span>
                <span className="text-sm font-semibold text-emerald-500">+5% előző hónap</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Kritikus ügyfelek:</h3>
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">{kpiStats.kritikusDb} db</span>
                <span className="text-sm font-semibold text-red-500">-3 előző hó</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-center">
              <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Kiosztott/Lezárt cégek:</h3>
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-slate-900 dark:text-slate-100">{kpiStats.kiosztottLezart}</span>
              </div>
            </div>
          </div>

          {/* Middle Row: Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm h-80 flex flex-col">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-500" />
                Könyvelői Teljesítmény
              </h3>
              <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="[&>line]:stroke-slate-100 dark:[&>line]:stroke-slate-800" stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <RechartsTooltip cursor={{ fill: 'var(--tooltip-cursor, #f8fafc)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, white)', color: 'var(--tooltip-text, #1e293b)' }} />
                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm h-80 flex flex-col relative">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-amber-600" />
                Irodai Ügyfél Státuszok
              </h3>
              <div className="flex-1 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, white)', color: 'var(--tooltip-text, #1e293b)' }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-8">
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Összes:</span>
                  <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">24</span>
                </div>
              </div>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3">
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Kész 65%</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Feldolgozandó 20%</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Kritikus 15%</span>
                 </div>
              </div>
            </div>
          </div>

          {/* Monthly Trend Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
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
                <LineChart data={monthlyTrendData} margin={{ top: 10, right: 30, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="[&>line]:stroke-slate-100 dark:[&>line]:stroke-slate-800" stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, white)', color: 'var(--tooltip-text, #1e293b)' }} formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = { zaras: 'Zárási %', hianyzok: 'Hiányzó számlák' };
                    return [`${value}${name === 'zaras' ? '%' : ' db'}`, labels[name] || name];
                  }} />
                  <Line type="monotone" dataKey="zaras" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} activeDot={{ r: 6 }} name="zaras" />
                  <Line type="monotone" dataKey="hianyzok" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} strokeDasharray="5 5" name="hianyzok" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-6 mt-3 justify-center">
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-emerald-500 rounded"></div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Zárási %</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-0.5 bg-red-500 rounded border-dashed"></div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Hiányzó számlák</span>
              </div>
            </div>
          </div>

          {/* Bottom Row: Table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
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
                <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium text-xs tracking-wider">
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
                  {colleagueStats.map((colleague, idx) => (
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
                            <div className={cn('h-1.5 rounded-full', colleague.closingPct >= 80 ? 'bg-emerald-500' : colleague.closingPct >= 60 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${colleague.closingPct}%` }} />
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
                            ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400'
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

          {/* Új Szekció: Automatizmus & Ügyfél Analitika */}
          <div className="pt-8">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6 flex items-center gap-2">
              🤖 Bekérési Automatizmus & Ügyfél Kockázat
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Bal kártya: Csatornák */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow">
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
                      <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '92%' }}></div>
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
              <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-6">Kritikus Válaszadási Idejű Ügyfelek</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-transparent border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium text-xs tracking-wider">
                      <tr>
                        <th className="pb-3 pr-4">Ügyfél neve</th>
                        <th className="pb-3 px-4">Átlagos Késés</th>
                        <th className="pb-3 pl-4 text-right">Kockázat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-4 pr-4 font-semibold text-slate-900 dark:text-slate-100">Webshop Hungary Zrt.</td>
                        <td className="py-4 px-4 font-medium text-slate-600 dark:text-slate-400">12 nap</td>
                        <td className="py-4 pl-4 text-right">
                          <span className="inline-flex px-2.5 py-1 rounded-md bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-[11px] font-bold uppercase tracking-wider">
                            Kritikus
                          </span>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-4 pr-4 font-semibold text-slate-900 dark:text-slate-100">Gastro Delight Kft.</td>
                        <td className="py-4 px-4 font-medium text-slate-600 dark:text-slate-400">8 nap</td>
                        <td className="py-4 pl-4 text-right">
                          <span className="inline-flex px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[11px] font-bold uppercase tracking-wider">
                            Magas
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Feldolgozandó oszlop */}
          <div 
            className={cn(
              "p-4 rounded-xl border flex flex-col gap-4 min-h-[500px] transition-all duration-200",
              dragOverColumn === 'Feldolgozandó' ? "bg-amber-50/80 border-amber-300 ring-4 ring-amber-500/10" : "bg-slate-100/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/60"
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
              <div className="text-center py-8 text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">Nincs ügyfél</div>
            )}
          </div>

          {/* Rendben oszlop */}
          <div 
            className={cn(
              "p-4 rounded-xl border flex flex-col gap-4 min-h-[500px] transition-all duration-200",
              dragOverColumn === 'Rendben' ? "bg-emerald-50/80 border-emerald-300 ring-4 ring-emerald-500/10" : "bg-slate-100/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/60"
            )}
            onDragOver={(e) => handleDragOver(e, 'Rendben')}
            onDrop={(e) => handleDrop(e, 'Rendben')}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
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
              <div className="text-center py-8 text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">Nincs ügyfél</div>
            )}
          </div>

          {/* Kritikus oszlop */}
          <div 
            className={cn(
              "p-4 rounded-xl border flex flex-col gap-4 min-h-[500px] transition-all duration-200",
              dragOverColumn === 'Kritikus' ? "bg-red-50/80 border-red-300 ring-4 ring-red-500/10" : "bg-slate-100/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800/60"
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
              <div className="text-center py-8 text-sm text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">Nincs ügyfél</div>
            )}
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredClients.map(client => (
            <ClientCard key={client.id} client={client} onUpdateOwner={handleUpdateOwner} />
          ))}
          {filteredClients.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400">
              Nincs találat a következőre: "{searchQuery}" {statusFilter !== 'Minden' && `és státusz: ${statusFilter}`}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-medium text-xs uppercase tracking-wider">
                <tr>
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
                  filteredClients.map((client) => (
                    <tr 
                      key={client.id} 
                      onClick={() => navigate(`/accounty/client/${client.id}`)}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${client.colorHex} shrink-0`}>
                            <Building2 className="w-4 h-4" />
                          </div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-emerald-600 transition-colors">{client.name}</span>
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
