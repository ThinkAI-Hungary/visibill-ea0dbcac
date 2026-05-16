import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, TrendingUp, CheckCircle2, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const defaultBarData = [
  { name: 'Aug', requested: 12, resolved: 10 },
  { name: 'Sep', requested: 18, resolved: 15 },
  { name: 'Oct', requested: 15, resolved: 14 },
  { name: 'Nov', requested: 22, resolved: 18 },
  { name: 'Dec', requested: 20, resolved: 17 },
  { name: 'Jan', requested: 25, resolved: 19 },
];

const defaultPieData = [
  { name: 'Email', value: 45 },
  { name: 'Viber', value: 25 },
  { name: 'Telegram', value: 20 },
  { name: 'AI Hívás', value: 10 },
];
const COLORS = ['#1A1F2C', '#334155', '#64748B', '#94A3B8'];

const tableData = [
  { id: 1, name: 'Tech Solutions Kft.', requested: 12, resolved: 11, avgTime: '1.2 nap', reliability: 92 },
  { id: 2, name: 'Digital Partners Zrt.', requested: 8, resolved: 5, avgTime: '4.5 nap', reliability: 63 },
  { id: 3, name: 'Innovation Labs Kft.', requested: 15, resolved: 14, avgTime: '2.1 nap', reliability: 93 },
  { id: 4, name: 'Smart Office Bt.', requested: 6, resolved: 6, avgTime: '0.8 nap', reliability: 100 },
  { id: 5, name: 'Global Trade Kft.', requested: 10, resolved: 4, avgTime: '5.2 nap', reliability: 40 },
];

export default function MissingInvoicesReportPage() {
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState('all');

  const filteredTableData = useMemo(() => {
    if (selectedClient === 'all') return tableData;
    return tableData.filter(row => row.id.toString() === selectedClient);
  }, [selectedClient]);

  const kpis = useMemo(() => {
    if (selectedClient === 'all') {
      return {
        requested: 156,
        resolved: 118,
        successRate: 76,
        avgTime: 2.3,
      };
    }
    const requested = filteredTableData.reduce((acc, row) => acc + row.requested, 0);
    const resolved = filteredTableData.reduce((acc, row) => acc + row.resolved, 0);
    const successRate = requested > 0 ? Math.round((resolved / requested) * 100) : 0;
    const avgTime = filteredTableData.length > 0 
      ? (filteredTableData.reduce((acc, row) => acc + parseFloat(row.avgTime), 0) / filteredTableData.length)
      : 0;
      
    return {
      requested,
      resolved,
      successRate,
      avgTime: Number(avgTime.toFixed(1)),
    };
  }, [selectedClient, filteredTableData]);

  const dynamicCharts = useMemo(() => {
    if (selectedClient === 'all') return { barData: defaultBarData, pieData: defaultPieData };
    
    const idNum = parseInt(selectedClient, 10);
    const clientData = filteredTableData[0];
    const totalReq = clientData?.requested || 10;
    const totalRes = clientData?.resolved || 5;

    const barData = defaultBarData.map((month, index) => {
      const factorReq = 0.5 + ((idNum * 13 + index * 7) % 10) / 10;
      const factorRes = 0.5 + ((idNum * 17 + index * 11) % 10) / 10;
      const requested = Math.max(1, Math.round((totalReq / 6) * factorReq));
      const resolved = Math.min(requested, Math.max(0, Math.round((totalRes / 6) * factorRes)));
      return { name: month.name, requested, resolved };
    });

    const emailVal = 30 + (idNum * 10) % 40;
    const viberVal = 10 + (idNum * 15) % 30;
    const telegramVal = 5 + (idNum * 20) % 25;
    const sum = emailVal + viberVal + telegramVal;
    const pieData = [
      { name: 'Email', value: emailVal },
      { name: 'Viber', value: viberVal },
      { name: 'Telegram', value: telegramVal },
      { name: 'AI Hívás', value: Math.max(5, 100 - sum) },
    ];

    return { barData, pieData };
  }, [selectedClient, filteredTableData]);

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors mt-1"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hiányzó számlák riport</h1>
            <p className="text-sm text-slate-500 mt-1">Automatikus bekérő statisztikák és elemzések</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-[180px] bg-white border-slate-200">
              <SelectValue placeholder="Összes ügyfél" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Összes ügyfél</SelectItem>
              {tableData.map(client => (
                <SelectItem key={client.id} value={client.id.toString()}>{client.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select defaultValue="last_month">
            <SelectTrigger className="w-[180px] bg-white border-slate-200">
              <SelectValue placeholder="Elmúlt hónap" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_month">Elmúlt hónap</SelectItem>
              <SelectItem value="last_quarter">Elmúlt negyedév</SelectItem>
              <SelectItem value="this_year">Idei év</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="bg-white border-slate-200 text-slate-700 gap-2 px-6">
            <Download className="w-4 h-4" /> Exportálás
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Összes felszólítás</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{kpis.requested}</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-emerald-600 font-medium">
            <TrendingUp className="w-3.5 h-3.5 mr-1" />
            +12% az előző hónaphoz képest
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Sikeres bekérés</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{kpis.resolved}</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-emerald-600 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            {kpis.successRate}% sikeresség
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Átlagos válaszidő</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{kpis.avgTime} nap</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-emerald-600 font-medium">
            <Clock className="w-3.5 h-3.5 mr-1" />
            -0.5 nap javulás
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="text-sm font-medium text-slate-500">Automatikus bekérés</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">68%</span>
          </div>
          <div className="mt-2 flex items-center text-xs text-slate-500 font-medium">
            <Zap className="w-3.5 h-3.5 mr-1 text-amber-500" />
            Automatizált
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Felszólítások időbeli alakulása</h3>
            <p className="text-xs text-slate-500 mt-1">Küldött és megoldott kérések havonta</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dynamicCharts.barData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)' }} />
                <Bar dataKey="requested" name="Kérések" fill="#1A1F2C" radius={[4, 4, 0, 0]} barSize={32} />
                <Bar dataKey="resolved" name="Megoldott" fill="#475569" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col">
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-slate-900">Csatornák hatékonysága</h3>
            <p className="text-xs text-slate-500 mt-1">Sikeres bekérések csatornánként</p>
          </div>
          <div className="flex-1 flex items-center justify-center -mt-4">
            <div className="h-48 w-full max-w-xs relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dynamicCharts.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {dynamicCharts.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Custom Legend to match screenshot closely */}
              <div className="flex justify-center gap-4 mt-2">
                {dynamicCharts.pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[index] }}></div>
                    {entry.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-xs font-medium text-slate-600 px-4">
            <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#1A1F2C]"></div> Email:</span> <span>85% kézbesítés</span></div>
            <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#334155]"></div> Viber:</span> <span>92% olvasás</span></div>
            <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#64748B]"></div> Telegram:</span> <span>88% olvasás</span></div>
            <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-[#94A3B8]"></div> AI Hívás:</span> <span>78% válasz</span></div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden pb-4">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Ügyfél megbízhatóság</h3>
            <p className="text-xs text-slate-500 mt-1">Válaszadási arányok és átlagos válaszidők</p>
          </div>
          <Button variant="outline" size="sm" className="bg-white h-8 text-xs">
            Szűrés
          </Button>
        </div>
        
        <table className="w-full text-sm text-left">
          <thead className="bg-white border-b border-slate-100 text-slate-500 text-xs">
            <tr>
              <th className="px-6 py-4 font-medium">Ügyfél</th>
              <th className="px-6 py-4 font-medium text-center">Kérések</th>
              <th className="px-6 py-4 font-medium text-center">Megoldott</th>
              <th className="px-6 py-4 font-medium text-center">Átlag válaszidő</th>
              <th className="px-6 py-4 font-medium">Megbízhatóság</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredTableData.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-semibold text-slate-900">{row.name}</td>
                <td className="px-6 py-4 text-center font-medium text-slate-700">{row.requested}</td>
                <td className="px-6 py-4 text-center font-medium text-slate-700">{row.resolved}</td>
                <td className="px-6 py-4 text-center font-medium text-slate-700">{row.avgTime}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${row.reliability < 50 ? 'bg-red-500' : row.reliability < 80 ? 'bg-amber-500' : 'bg-slate-800'}`} 
                        style={{ width: `${row.reliability}%` }}
                      ></div>
                    </div>
                    <span className={`text-xs font-bold ${row.reliability < 50 ? 'text-red-500' : row.reliability < 80 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {row.reliability}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {filteredTableData.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  Nincs megjeleníthető adat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
