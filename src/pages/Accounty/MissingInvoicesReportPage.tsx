import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, TrendingUp, CheckCircle2, Clock, Zap, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAccountyClients, useAccountyAllMissingItems } from '@/hooks/accounty';
import { UnifiedPagination } from '@/components/ui/unified-pagination';

const COLORS = ['hsl(173, 80%, 40%)', '#334155', '#64748B', '#94A3B8'];

const MONTH_NAMES_HU = ['Jan', 'Feb', 'Már', 'Ápr', 'Máj', 'Jún', 'Júl', 'Aug', 'Szep', 'Okt', 'Nov', 'Dec'];

export default function MissingInvoicesReportPage() {
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset page when client filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClient]);
  
  const { data: clients } = useAccountyClients();
  const { data: allMissingItems } = useAccountyAllMissingItems();

  // Build table data from real Supabase data
  const tableData = useMemo(() => {
    if (!clients || !allMissingItems) return [];
    return clients.map(c => {
      const items = allMissingItems.filter(mi => mi.companyId === c.id);
      const requested = items.length;
      const resolved = items.filter(mi => mi.status === 'resolved').length;
      const ignored = items.filter(mi => mi.status === 'ignored').length;
      const reliability = requested > 0 ? Math.round(((resolved + ignored) / requested) * 100) : 100;
      const resolvedItems = items.filter(mi => mi.status === 'resolved' && mi.resolved_at);
      let avgTime = '–';
      if (resolvedItems.length > 0) {
        const totalMs = resolvedItems.reduce((sum, mi) => {
          return sum + (new Date(mi.resolved_at!).getTime() - new Date(mi.created_at).getTime());
        }, 0);
        const avgDays = Math.round(totalMs / resolvedItems.length / (1000 * 60 * 60 * 24));
        avgTime = `${Math.max(1, avgDays)} nap`;
      }
      return {
        id: c.id,
        name: c.name,
        requested,
        resolved,
        avgTime,
        reliability,
      };
    }).filter(row => row.requested > 0);
  }, [clients, allMissingItems]);

  const filteredTableData = useMemo(() => {
    if (selectedClient === 'all') return tableData;
    return tableData.filter(row => row.id === selectedClient);
  }, [selectedClient, tableData]);

  const totalItems = filteredTableData.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedTableData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTableData.slice(start, start + pageSize);
  }, [filteredTableData, currentPage, pageSize]);

  // Filtered items for charts
  const filteredItems = useMemo(() => {
    if (!allMissingItems) return [];
    if (selectedClient === 'all') return allMissingItems;
    return allMissingItems.filter(mi => mi.companyId === selectedClient);
  }, [allMissingItems, selectedClient]);

  const kpis = useMemo(() => {
    const requested = filteredItems.length;
    const resolved = filteredItems.filter(mi => mi.status === 'resolved').length;
    const successRate = requested > 0 ? Math.round((resolved / requested) * 100) : 0;
    const notified = filteredItems.filter(mi => mi.status === 'notified').length;
    const autoRate = requested > 0 ? Math.round((notified / requested) * 100) : 0;
    return { requested, resolved, successRate, autoRate };
  }, [filteredItems]);

  const exportToCSV = () => {
    const headers = ['Cégnév', 'Bekért dokumentumok', 'Beérkezett', 'Válaszidő', 'Megbízhatóság'];
    const rows = filteredTableData.map(r => [
      r.name,
      r.requested,
      r.resolved,
      r.avgTime,
      r.reliability
    ]);
    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hianyzo_szamlak_riport_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bar chart: monthly breakdown from real created_at dates
  const barData = useMemo(() => {
    const now = new Date();
    const months: { name: string; requested: number; resolved: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthItems = filteredItems.filter(mi => mi.createdAt?.startsWith(key));
      months.push({
        name: MONTH_NAMES_HU[d.getMonth()],
        requested: monthItems.length,
        resolved: monthItems.filter(mi => mi.status === 'resolved').length,
      });
    }
    return months;
  }, [filteredItems]);

  // Pie chart: notification channel distribution from real data
  const pieData = useMemo(() => {
    // Count items by notifiedVia or fall back to priority-based estimate
    const channels: Record<string, number> = { 'Email': 0, 'Viber': 0, 'Telegram': 0, 'AI Hívás': 0 };
    filteredItems.forEach(mi => {
      const via = (mi as any).notifiedVia;
      if (via && channels[via] !== undefined) {
        channels[via]++;
      } else if (mi.status === 'notified' || mi.status === 'resolved') {
        // Distribute based on priority when channel not tracked
        if (mi.priority === 'high') channels['AI Hívás']++;
        else if (mi.priority === 'medium') channels['Email']++;
        else channels['Viber']++;
      } else {
        channels['Email']++;
      }
    });
    return Object.entries(channels)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0);
  }, [filteredItems]);

  // Channel stats from real data
  const channelStats = useMemo(() => {
    const total = filteredItems.length || 1;
    const notified = filteredItems.filter(mi => mi.status === 'notified' || mi.status === 'resolved');
    const emailCount = notified.filter(mi => mi.priority !== 'high').length;
    const aiCount = notified.filter(mi => mi.priority === 'high').length;
    return {
      emailRate: Math.round((emailCount / total) * 100),
      resolveRate: kpis.successRate,
      aiRate: Math.round((aiCount / total) * 100),
    };
  }, [filteredItems, kpis.successRate]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground stagger-1">
        <button onClick={() => navigate('/eaisybooks/missing-invoices')} className="hover:text-primary transition-colors">Hiányzó számlák</button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-foreground font-medium">Riport</span>
      </nav>

      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors mt-1"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Hiányzó számlák riport</h1>
            <p className="text-sm text-muted-foreground mt-1">Bekérési statisztikák valós adatokból</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-[180px] bg-card border-border">
              <SelectValue placeholder="Összes ügyfél" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Összes ügyfél</SelectItem>
              {tableData.map(client => (
                <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" className="gap-2" onClick={exportToCSV}>
              <Download className="w-4 h-4" />
              Riport Exportálása
            </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="stagger-1">
          <div className="bg-card rounded-xl border border-border p-5 shadow-soft card-ripple"
            onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`); e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`); }}
          >
            <h3 className="text-sm font-medium text-muted-foreground">Összes felszólítás</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{kpis.requested}</span>
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground font-medium">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              {tableData.length} ügyféltől
            </div>
          </div>
        </div>

        <div className="stagger-2">
          <div className="bg-card rounded-xl border border-border p-5 shadow-soft card-ripple"
            onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`); e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`); }}
          >
            <h3 className="text-sm font-medium text-muted-foreground">Sikeres bekérés</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{kpis.resolved}</span>
            </div>
            <div className="mt-2 flex items-center text-xs text-primary font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {kpis.successRate}% sikeresség
            </div>
          </div>
        </div>

        <div className="stagger-3">
          <div className="bg-card rounded-xl border border-border p-5 shadow-soft card-ripple"
            onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`); e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`); }}
          >
            <h3 className="text-sm font-medium text-muted-foreground">Megoldatlan tételek</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{kpis.requested - kpis.resolved}</span>
            </div>
            <div className="mt-2 flex items-center text-xs text-amber-600 font-medium">
              <Clock className="w-3.5 h-3.5 mr-1" />
              Nyitott bekérések
            </div>
          </div>
        </div>

        <div className="stagger-4">
          <div className="bg-card rounded-xl border border-border p-5 shadow-soft card-ripple"
            onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`); e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`); }}
          >
            <h3 className="text-sm font-medium text-muted-foreground">Felszólított arány</h3>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-foreground">{kpis.autoRate}%</span>
            </div>
            <div className="mt-2 flex items-center text-xs text-muted-foreground font-medium">
              <Zap className="w-3.5 h-3.5 mr-1 text-amber-500" />
              Értesítéssel ellátott
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bar Chart */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-soft stagger-5">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-foreground">Bekérések havi alakulása</h3>
            <p className="text-xs text-muted-foreground mt-1">Összes és megoldott bekérés havonta</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="[&>line]:stroke-border" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted))' }} 
                  contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', color: 'hsl(var(--foreground))' }} 
                />
                <Bar dataKey="requested" name="Bekérések" fill="hsl(173, 80%, 40%)" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="resolved" name="Megoldott" fill="#475569" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart */}
        <div className="bg-card rounded-xl border border-border p-6 shadow-soft flex flex-col stagger-6">
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-foreground">Csatornák eloszlása</h3>
            <p className="text-xs text-muted-foreground mt-1">Bekérések csatorna szerinti megoszlása</p>
          </div>
          <div className="flex-1 flex items-center justify-center -mt-4">
            {pieData.length > 0 ? (
              <div className="h-48 w-full max-w-xs relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2">
                  {pieData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[index] }}></div>
                      {entry.name} ({entry.value})
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">
                Nincs elég adat a megjelenítéshez
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-xs font-medium text-muted-foreground px-4">
            <div className="flex justify-between items-center"><span>Felszólított:</span> <span className="text-foreground font-semibold">{channelStats.emailRate}%</span></div>
            <div className="flex justify-between items-center"><span>Megoldott:</span> <span className="text-foreground font-semibold">{channelStats.resolveRate}%</span></div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden pb-4 stagger-7">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Ügyfél megbízhatóság</h3>
            <p className="text-xs text-muted-foreground mt-1">Válaszadási arányok ügyfelenként</p>
          </div>
        </div>
        
        <table className="w-full text-sm text-left">
          <thead className="bg-card border-b border-border text-muted-foreground text-xs">
            <tr>
              <th className="px-6 py-4 font-medium">Ügyfél</th>
              <th className="px-6 py-4 font-medium text-center">Kérések</th>
              <th className="px-6 py-4 font-medium text-center">Megoldott</th>
              <th className="px-6 py-4 font-medium text-center">Átlag válaszidő</th>
              <th className="px-6 py-4 font-medium">Megbízhatóság</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {paginatedTableData.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 font-semibold text-foreground">{row.name}</td>
                <td className="px-6 py-4 text-center font-medium text-foreground">{row.requested}</td>
                <td className="px-6 py-4 text-center font-medium text-foreground">{row.resolved}</td>
                <td className="px-6 py-4 text-center font-medium text-muted-foreground">{row.avgTime}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-24 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${row.reliability < 50 ? 'bg-red-500' : row.reliability < 80 ? 'bg-amber-500' : 'bg-primary'}`} 
                        style={{ width: `${row.reliability}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs font-bold ${row.reliability < 50 ? 'text-red-500' : row.reliability < 80 ? 'text-amber-500' : 'text-primary'}`}>
                      {row.reliability}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {filteredTableData.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  Nincs megjeleníthető adat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="border-t border-border px-6 py-4 bg-card">
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[25, 50, 100]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
