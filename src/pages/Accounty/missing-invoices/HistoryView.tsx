import React from 'react';
import { ArrowLeft, Search, Clock, Eye, Mail, MessageSquare } from 'lucide-react';

interface HistoryViewProps {
  clientName: string;
  onBack: () => void;
  historySearchTerm: string;
  setHistorySearchTerm: (v: string) => void;
  historyChannelFilter: string;
  setHistoryChannelFilter: (v: string) => void;
  historyStatusFilter: string;
  setHistoryStatusFilter: (v: string) => void;
  historyTab: 'timeline' | 'table';
  setHistoryTab: (v: 'timeline' | 'table') => void;
}

export default function HistoryView({
  clientName, onBack,
  historySearchTerm, setHistorySearchTerm,
  historyChannelFilter, setHistoryChannelFilter,
  historyStatusFilter, setHistoryStatusFilter,
  historyTab, setHistoryTab,
}: HistoryViewProps) {
  // History data placeholder - communication feature out of scope
  const filteredHistory: { id: number; date: string; channel: string; vendor: string; responseTime: string; status: string; statusColor: string; icon: any; iconColor: string }[] = [];

  return (
    <div className="w-full space-y-6 pb-24 animate-in fade-in slide-in-from-right-8 duration-500">
      
      {/* Header */}
      <div className="flex flex-col gap-1">
        <button 
          onClick={onBack}
          className="flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {clientName} • Hiányzó számlák
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Felszólítás előzmények</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card p-5 rounded-xl border border-border shadow-soft flex flex-col justify-between">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Összes</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">45</h3>
        </div>
        <div className="bg-card p-5 rounded-xl border border-border shadow-soft flex flex-col justify-between">
          <p className="text-xs font-semibold text-primary mb-2">Sikeres</p>
          <h3 className="text-2xl font-black text-primary">38</h3>
        </div>
        <div className="bg-card p-5 rounded-xl border border-border shadow-soft flex flex-col justify-between">
          <p className="text-xs font-semibold text-amber-600 mb-2">Folyamatban</p>
          <h3 className="text-2xl font-black text-amber-600">5</h3>
        </div>
        <div className="bg-card p-5 rounded-xl border border-border shadow-soft flex flex-col justify-between">
          <p className="text-xs font-semibold text-red-600 mb-2">Sikertelen</p>
          <h3 className="text-2xl font-black text-red-600">2</h3>
        </div>
        <div className="bg-card p-5 rounded-xl border border-border shadow-soft flex flex-col justify-between">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Átlag válaszidő</p>
          <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">6 óra</h3>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Keresés..." 
            value={historySearchTerm}
            onChange={(e) => setHistorySearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-soft"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            value={historyChannelFilter}
            onChange={(e) => setHistoryChannelFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-soft cursor-pointer min-w-[140px]"
          >
            <option value="Minden">Minden</option>
            <option value="Email">Email</option>
            <option value="Viber">Viber</option>
            <option value="Telegram">Telegram</option>
            <option value="AI Hívás">AI Hívás</option>
          </select>
          <select 
            value={historyStatusFilter}
            onChange={(e) => setHistoryStatusFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-soft cursor-pointer min-w-[140px]"
          >
            <option value="Minden">Minden</option>
            <option value="Elküldve">Elküldve</option>
            <option value="Kézbesítve">Kézbesítve</option>
            <option value="Megnyitva">Megnyitva</option>
            <option value="Válaszolt">Válaszolt</option>
            <option value="Sikertelen">Sikertelen</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
        <button 
          onClick={() => setHistoryTab('timeline')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${historyTab === 'timeline' ? 'bg-card text-slate-900 dark:text-slate-100 shadow-soft' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300'}`}
        >
          Idővonal
        </button>
        <button 
          onClick={() => setHistoryTab('table')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${historyTab === 'table' ? 'bg-card text-slate-900 dark:text-slate-100 shadow-soft' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300'}`}
        >
          Táblázat
        </button>
      </div>

      {/* Content */}
      <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
        {historyTab === 'timeline' ? (
          <div className="p-6 space-y-0 relative">
            <div className="absolute top-8 bottom-8 left-[43px] w-[2px] bg-slate-100 dark:bg-slate-800 z-0"></div>
            
            {filteredHistory.map((item) => (
              <div key={item.id} className="relative z-10 flex items-center justify-between p-4 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-xl -ml-2 -mr-2">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shadow-soft">
                    <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.vendor}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {item.channel} • {item.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  {item.responseTime !== '-' && (
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {item.responseTime}
                    </span>
                  )}
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.statusColor}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
            {filteredHistory.length === 0 && (
              <div className="py-8 text-center text-slate-500 dark:text-slate-400">Nincs a keresésnek megfelelő találat.</div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border dark:bg-slate-900/50">
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Dátum</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Csatorna</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Számla</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Válaszidő</th>
                  <th className="py-4 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider">Státusz</th>
                  <th className="py-4 px-6 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-400">{item.date}</td>
                    <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <item.icon className="w-4 h-4 text-slate-400" />
                      {item.channel}
                    </td>
                    <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-slate-100">{item.vendor}</td>
                    <td className="py-4 px-6 text-sm text-slate-600 dark:text-slate-400">{item.responseTime}</td>
                    <td className="py-4 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.statusColor}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 p-1.5 rounded-md hover:bg-slate-200 dark:bg-slate-800 transition-all">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">Nincs a keresésnek megfelelő találat.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
