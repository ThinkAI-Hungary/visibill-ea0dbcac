import React from 'react';
import { ArrowLeft, Search, Clock, Eye, Mail, MessageSquare } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableEmptyState } from "@/components/ui/table-empty-state";

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
    <div className="w-full space-y-6 pb-24 page-animate">
      
      {/* Header */}
      <div className="flex flex-col gap-1">
        <button 
          onClick={onBack}
          className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {clientName} • Hiányzó számlák
        </button>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Felszólítás előzmények</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-card p-5 rounded-lg border border-border shadow-soft flex flex-col justify-between">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Összes</p>
          <h3 className="text-2xl font-black text-foreground">45</h3>
        </div>
        <div className="bg-card p-5 rounded-lg border border-border shadow-soft flex flex-col justify-between">
          <p className="text-xs font-semibold text-primary mb-2">Sikeres</p>
          <h3 className="text-2xl font-black text-primary">38</h3>
        </div>
        <div className="bg-card p-5 rounded-lg border border-border shadow-soft flex flex-col justify-between">
          <p className="text-xs font-semibold text-amber-600 mb-2">Folyamatban</p>
          <h3 className="text-2xl font-black text-amber-600">5</h3>
        </div>
        <div className="bg-card p-5 rounded-lg border border-border shadow-soft flex flex-col justify-between">
          <p className="text-xs font-semibold text-red-600 mb-2">Sikertelen</p>
          <h3 className="text-2xl font-black text-red-600">2</h3>
        </div>
        <div className="bg-card p-5 rounded-lg border border-border shadow-soft flex flex-col justify-between">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Átlag válaszidő</p>
          <h3 className="text-2xl font-black text-foreground">6 óra</h3>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
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
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-soft cursor-pointer min-w-[140px]"
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
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-soft cursor-pointer min-w-[140px]"
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
      <div className="flex bg-muted p-1 rounded-lg w-fit">
        <button 
          onClick={() => setHistoryTab('timeline')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${historyTab === 'timeline' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground/90 dark:hover:text-foreground dark:text-foreground/90'}`}
        >
          Idővonal
        </button>
        <button 
          onClick={() => setHistoryTab('table')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${historyTab === 'table' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground/90 dark:hover:text-foreground dark:text-foreground/90'}`}
        >
          Táblázat
        </button>
      </div>

      {/* Content */}
      <div className="bg-card border border-border rounded-lg shadow-soft overflow-hidden">
        {historyTab === 'timeline' ? (
          <div className="p-6 space-y-0 relative">
            <div className="absolute top-8 bottom-8 left-[43px] w-[2px] bg-muted z-0"></div>
            
            {filteredHistory.map((item) => (
              <div key={item.id} className="relative z-10 flex items-center justify-between p-4 group hover:bg-muted/50 transition-colors rounded-lg -ml-2 -mr-2">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shadow-soft">
                    <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{item.vendor}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.channel} • {item.date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  {item.responseTime !== '-' && (
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
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
              <div className="py-8 text-center text-muted-foreground">Nincs a keresésnek megfelelő találat.</div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="compact-table min-w-[700px]">
              <TableHeader>
                <TableRow className="border-b border-border bg-muted/40 hover:bg-muted/40">
                  <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dátum</TableHead>
                  <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Csatorna</TableHead>
                  <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Számla</TableHead>
                  <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Válaszidő</TableHead>
                  <TableHead className="py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Státusz</TableHead>
                  <TableHead className="py-3 px-5 w-12 text-center"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {filteredHistory.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/40 transition-colors border-l-2 border-l-transparent hover:border-l-primary">
                    <TableCell className="py-3 px-5 text-sm text-muted-foreground font-mono tabular-nums">{item.date}</TableCell>
                    <TableCell className="py-3 px-5 text-sm text-muted-foreground flex items-center gap-2">
                      <item.icon className="w-4 h-4 text-muted-foreground" />
                      {item.channel}
                    </TableCell>
                    <TableCell className="py-3 px-5 text-sm font-medium text-foreground">{item.vendor}</TableCell>
                    <TableCell className="py-3 px-5 text-sm text-muted-foreground font-mono tabular-nums">{item.responseTime}</TableCell>
                    <TableCell className="py-3 px-5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.statusColor}`}>
                        {item.status}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 px-5 text-center">
                      <button className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-muted transition-all">
                        <Eye className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredHistory.length === 0 && (
                  <TableEmptyState
                    colSpan={6}
                    title="Nincs találat"
                    description="Nincs a keresésnek megfelelő előzmény."
                  />
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
