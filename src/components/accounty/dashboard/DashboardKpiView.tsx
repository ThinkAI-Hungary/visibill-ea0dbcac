import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart2, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  Download, 
  User, 
  Clock, 
  Phone, 
  MessageCircle, 
  Mail, 
  AlertTriangle, 
  GripVertical
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line 
} from 'recharts';
import { cn } from '@/lib/utils';
import { ClientData } from '@/pages/Accounty/types';
import { WidgetWrapper, MissingItemsTooltip } from './DashboardShared';

interface DashboardKpiViewProps {
  clients: ClientData[];
  dynamicKpiStats: {
    zarasiSzazalek: number;
    kritikusDb: number;
    kiosztottLezart: string;
  };
  portalStats: any;
  editingLayout: boolean;
  setEditingLayout: (v: boolean) => void;
  widgetOrder: string[];
  moveWidget: (idx: number, dir: -1 | 1) => void;
  dynamicBarData: any[];
  dynamicPieData: any[];
  monthlyTrendData: any[];
  colleagueStats: any[] | null;
  auditLog: any[] | null;
  isAdmin: boolean;
}

export default function DashboardKpiView({
  clients,
  dynamicKpiStats,
  portalStats,
  editingLayout,
  setEditingLayout,
  widgetOrder,
  moveWidget,
  dynamicBarData,
  dynamicPieData,
  monthlyTrendData,
  colleagueStats,
  auditLog,
  isAdmin,
}: DashboardKpiViewProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      {/* Top Row: KPI Cards */}
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
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              {`Zárási státusz (${new Date().toLocaleDateString('hu-HU', { month: 'long' }).replace(/^./, c => c.toUpperCase())}):`}
            </h3>
            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-bold text-foreground">{dynamicKpiStats.zarasiSzazalek}%</span>
              <span className="text-sm font-semibold text-primary">aktív</span>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border shadow-soft flex flex-col justify-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Kritikus ügyfelek:</h3>
            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-bold text-foreground">{dynamicKpiStats.kritikusDb} db</span>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border shadow-soft flex flex-col justify-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Kiosztott / Rendben:</h3>
            <div className="flex items-baseline gap-4">
              <span className="text-4xl font-bold text-foreground">{dynamicKpiStats.kiosztottLezart}</span>
            </div>
          </div>
          <div className="bg-card rounded-xl p-6 border border-border shadow-soft flex flex-col justify-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Portál aktivitás:</h3>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-foreground">{portalStats?.totalVisits ?? 0}</span>
              <span className="text-sm font-semibold text-primary">látogatás</span>
            </div>
            <span className="text-xs text-muted-foreground mt-1">{portalStats?.activeLinks ?? 0} aktív link</span>
          </div>
        </div>
      </WidgetWrapper>

      {/* Widget layout edit button */}
      <div className="flex justify-end" style={{ order: -1 }}>
        <button
          onClick={() => setEditingLayout(!editingLayout)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
            editingLayout
              ? "bg-primary text-primary-foreground"
              : "bg-muted/10 text-muted-foreground hover:bg-muted/20"
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
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Könyvelői Teljesítmény
            </h3>
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dynamicBarData} margin={{ top: 20, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="[&>line]:stroke-border" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} width={75} tickFormatter={(v) => `${v} db`} />
                  <RechartsTooltip cursor={{ fill: 'hsl(var(--muted)/0.15)' }} content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                       <div className="bg-popover rounded-lg shadow-lg border border-border px-3 py-2">
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
                        <p className="text-sm font-bold text-foreground">{Number(payload[0].value).toLocaleString('hu-HU')} db</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey="value" fill="hsl(173, 80%, 40%)" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-soft h-80 flex flex-col relative">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
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
                    paddingAngle={dynamicPieData.filter(d => d.value > 0).length > 1 ? 2 : 0}
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
                      <div className="bg-popover rounded-lg shadow-lg border border-border px-3 py-2">
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">{payload[0].name}</p>
                        <p className="text-sm font-bold text-foreground">{payload[0].value}</p>
                      </div>
                    );
                  }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-8">
                <span className="text-sm font-semibold text-muted-foreground">Összes:</span>
                <span className="text-3xl font-bold text-foreground">{clients.length}</span>
              </div>
            </div>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3">
              {dynamicPieData.map((entry) => {
                const pct = clients.length > 0 ? Math.round((entry.value / clients.length) * 100) : 0;
                return (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }}></div>
                    <span className="text-xs font-medium text-muted-foreground">{entry.name} {pct}%</span>
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
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Havi Zárási Trend (utolsó 6 hónap)
            </h3>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/10 text-muted-foreground hover:bg-muted/20 transition-colors">
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData || []} margin={{ top: 10, right: 40, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="[&>line]:stroke-border" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickFormatter={(v) => `${v} db`} />
                <RechartsTooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const labels: Record<string, string> = { zaras: 'Zárási %', hianyzok: 'Hiányzó számlák' };
                  return (
                    <div className="bg-popover rounded-lg shadow-lg border border-border px-3 py-2">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
                      {payload.map((p: any, i: number) => (
                        <p key={i} className="text-sm font-bold text-foreground">
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
              <span className="text-xs text-muted-foreground">Zárási %</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-red-500 rounded border-dashed"></div>
              <span className="text-xs text-muted-foreground">Hiányzó számlák</span>
            </div>
          </div>
        </div>
      </WidgetWrapper>

      {/* Bottom Row: Table (admin only) */}
      {isAdmin && colleagueStats && (
        <WidgetWrapper 
          id="colleague_table" 
          editingLayout={editingLayout} 
          onMoveUp={() => moveWidget(widgetOrder.indexOf('colleague_table'), -1)} 
          onMoveDown={() => moveWidget(widgetOrder.indexOf('colleague_table'), 1)}
          isFirst={widgetOrder.indexOf('colleague_table') === 0}
          isLast={widgetOrder.indexOf('colleague_table') === widgetOrder.length - 1}
          order={widgetOrder.indexOf('colleague_table')}
        >
          <div className="bg-card rounded-xl border border-border shadow-soft overflow-hidden">
            <div className="p-4 border-b border-border dark:bg-muted/5 flex items-center justify-between">
              <h3 className="font-bold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Kolléga statisztikák (Havi Zárás)
              </h3>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/10 text-muted-foreground hover:bg-muted/20 transition-colors">
                <Download className="w-3.5 h-3.5" />
                Letöltés
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold text-xs tracking-wider">
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
                <tbody className="divide-y divide-border">
                  {colleagueStats.map((colleague, idx) => (
                    <tr key={idx} className="hover:bg-accent/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted-foreground/30 flex items-center justify-center text-xs font-bold text-white shrink-0">
                            {colleague.initial}
                          </div>
                          <span className="font-semibold text-foreground">{colleague.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-medium text-foreground">{colleague.assigned}</td>
                      <td className="px-4 py-4 text-center font-medium text-foreground">{colleague.closed}</td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-muted/20 dark:bg-muted/10 rounded-full h-1.5">
                            <div className={cn('h-1.5 rounded-full', colleague.closingPct >= 80 ? 'bg-primary' : colleague.closingPct >= 60 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${colleague.closingPct}%` }} />
                          </div>
                          <span className="text-xs font-bold text-foreground">{colleague.closingPct}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center font-medium text-foreground">{colleague.avgDays} nap</td>
                      <td className="px-4 py-4 text-center">
                        {colleague.missing > 15 ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {colleague.missing}
                          </div>
                        ) : (
                          <span className="font-medium text-foreground">{colleague.missing}</span>
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
        </WidgetWrapper>
      )}

      {/* Audit Log (admin only) */}
      {isAdmin && auditLog && (
        <WidgetWrapper 
          id="audit_log" 
          editingLayout={editingLayout} 
          onMoveUp={() => moveWidget(widgetOrder.indexOf('audit_log'), -1)} 
          onMoveDown={() => moveWidget(widgetOrder.indexOf('audit_log'), 1)}
          isFirst={widgetOrder.indexOf('audit_log') === 0}
          isLast={widgetOrder.indexOf('audit_log') === widgetOrder.length - 1}
          order={widgetOrder.indexOf('audit_log')}
        >
          <div className="bg-card rounded-xl border border-border shadow-soft p-6">
            <h3 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Tevékenységnapló
            </h3>
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {auditLog.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Még nincs bejegyzés</p>
              ) : (
                auditLog.map((entry: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 text-xs">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">{entry.action}</span>
                      {entry.details && <span className="text-muted-foreground ml-1">— {typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details)}</span>}
                    </div>
                    <span className="text-muted-foreground shrink-0">
                      {entry.created_at ? new Date(entry.created_at).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </WidgetWrapper>
      )}

      {/* Automatizmus & Ügyfél Analitika (admin only) */}
      {isAdmin && (
        <WidgetWrapper 
          id="automation_analytics" 
          editingLayout={editingLayout} 
          onMoveUp={() => moveWidget(widgetOrder.indexOf('automation_analytics'), -1)} 
          onMoveDown={() => moveWidget(widgetOrder.indexOf('automation_analytics'), 1)}
          isFirst={widgetOrder.indexOf('automation_analytics') === 0}
          isLast={widgetOrder.indexOf('automation_analytics') === widgetOrder.length - 1}
          order={widgetOrder.indexOf('automation_analytics')}
        >
          <div className="pt-8">
            <h2 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
              Bekérési Automatizmus & Ügyfél Kockázat
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <div className="bg-card rounded-xl p-6 border border-border shadow-soft hover:shadow-md transition-shadow">
                <h3 className="font-bold text-foreground mb-6">Értesítési Csatornák (Sikeres adatbekérés %)</h3>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        AI Telefonhívás
                      </div>
                      <span className="text-sm font-bold text-foreground">92%</span>
                    </div>
                    <div className="w-full bg-muted/20 dark:bg-muted/10 rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: '92%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <MessageCircle className="w-4 h-4 text-muted-foreground" />
                        Viber / Telegram
                      </div>
                      <span className="text-sm font-bold text-foreground">75%</span>
                    </div>
                    <div className="w-full bg-muted/20 dark:bg-muted/10 rounded-full h-2">
                      <div className="bg-amber-500 h-2 rounded-full" style={{ width: '75%' }}></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        E-mail értesítés
                      </div>
                      <span className="text-sm font-bold text-foreground">42%</span>
                    </div>
                    <div className="w-full bg-muted/20 dark:bg-muted/10 rounded-full h-2">
                      <div className="bg-red-500 h-2 rounded-full" style={{ width: '42%' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl p-6 border border-border shadow-soft hover:shadow-md transition-shadow flex flex-col">
                <h3 className="font-bold text-foreground mb-6">Legtöbb hiányzó tétellel rendelkező ügyfelek</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-transparent border-b border-border text-muted-foreground font-semibold text-xs tracking-wider">
                      <tr>
                        <th className="pb-3 pr-4">Ügyfél neve</th>
                        <th className="pb-3 px-4 text-center">Hiányzó</th>
                        <th className="pb-3 pl-4 text-right">Kockázat</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[...clients]
                        .sort((a, b) => b.missingCount - a.missingCount)
                        .slice(0, 5)
                        .filter(c => c.missingCount > 0)
                        .map(c => (
                          <tr key={c.id} className="hover:bg-accent/50 transition-colors cursor-pointer group/row relative" onClick={() => navigate(`/accounty/missing-invoices/${c.id}`)}>
                            <td className="py-3 pr-4 font-semibold text-foreground">{c.name}</td>
                            <td className="py-3 px-4 text-center font-bold text-foreground">{c.missingCount}</td>
                            <td className="py-3 pl-4 text-right">
                              <span className={cn(
                                "inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider",
                                c.missingCount > 500
                                  ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                                  : c.missingCount > 100
                                  ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"
                                  : "bg-muted/20 text-muted-foreground"
                              )}>
                                {c.missingCount > 500 ? 'Kritikus' : c.missingCount > 100 ? 'Magas' : 'Közepes'}
                              </span>
                            </td>
                            <td className="p-0 relative">
                              <MissingItemsTooltip companyId={c.id} />
                            </td>
                          </tr>
                        ))}
                      {clients.filter(c => c.missingCount > 0).length === 0 && (
                        <tr><td colSpan={3} className="py-6 text-center text-muted-foreground text-sm">Nincs kritikus ügyfél</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </div>
        </WidgetWrapper>
      )}
    </div>
  );
}
