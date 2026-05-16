import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Grid, 
  List as ListIcon, 
  Users, 
  FileText, 
  AlertTriangle, 
  Clock,
  MoreVertical,
  ArrowUpRight,
  Building2
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { mockKpis, mockClients, ClientData } from './mockData';
import { cn } from '@/lib/utils';

function KpiCard({ title, value, icon: Icon, valueClass = "text-slate-900" }: { title: string, value: number, icon: React.ElementType, valueClass?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
        <Icon className={`w-5 h-5 ${valueClass === 'text-red-600' ? 'text-red-500' : 'text-slate-400'}`} />
      </div>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ClientData['status'] }) {
  const styles = {
    'Rendben': 'bg-emerald-100 text-emerald-700',
    'Feldolgozandó': 'bg-amber-100 text-amber-700',
    'Kritikus': 'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${styles[status]}`}>
      {status}
    </span>
  );
}

function ClientCard({ client }: { client: ClientData }) {
  return (
    <Link to={`/accounty/client/${client.id}`} className="block">
      <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col group cursor-pointer h-full">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${client.colorHex}`}>
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 leading-tight">{client.name}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{client.taxNumber}</p>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        <div className="flex justify-between items-center mb-6">
          <span className="text-xs text-slate-500">Státusz</span>
          <StatusBadge status={client.status} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-slate-500 mb-1">Feldolgozatlan</p>
            <p className="font-semibold text-slate-900">{client.unprocessedCount} számla</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Hiányzó</p>
            <p className={`font-semibold ${client.missingCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {client.missingCount} számla
            </p>
          </div>
        </div>

        <div className="mt-auto pt-4 border-t border-slate-50 flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-slate-500">Határidő:</span>
            <span className={`font-semibold ${client.status === 'Kritikus' ? 'text-red-600' : 'text-slate-900'}`}>
              {client.deadline}
            </span>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 transition-colors" />
        </div>
      </div>
    </Link>
  );
}

export default function AccountyApp() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Minden');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const navigate = useNavigate();

  const filteredClients = mockClients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          client.taxNumber.includes(searchQuery);
    const matchesStatus = statusFilter === 'Minden' || client.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      
      {/* Header section */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Portfólió</h1>
          <p className="text-slate-500 mt-1">Ügyfeleid áttekintése és kezelése</p>
        </div>
        <Link to="/accounty/new-client">
          <Button className="bg-[#1A1F2C] hover:bg-[#1A1F2C]/90 text-white rounded-lg px-4 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Új ügyfél
          </Button>
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Összes ügyfél" value={mockKpis.totalClients} icon={Users} />
        <KpiCard title="Feldolgozatlan számlák" value={mockKpis.unprocessedInvoices} icon={FileText} />
        <KpiCard title="Hiányzó számlák" value={mockKpis.missingInvoices} icon={AlertTriangle} valueClass="text-red-600" />
        <KpiCard title="Közeledő határidők" value={mockKpis.upcomingDeadlines} icon={Clock} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Keresés..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50 border-transparent focus-visible:ring-emerald-500"
            />
          </div>
          
          <div className="hidden sm:block">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] bg-white border-slate-200 h-9 gap-2 text-slate-600">
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
        
        <div className="flex items-center bg-slate-50 rounded-lg p-1 border border-slate-100">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setViewMode('grid')}
            className={cn("h-8 w-8 rounded-md transition-all", viewMode === 'grid' ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-700")}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setViewMode('list')}
            className={cn("h-8 w-8 rounded-md transition-all", viewMode === 'list' ? "bg-white shadow-sm text-slate-900" : "text-slate-400 hover:text-slate-700")}
          >
            <ListIcon className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content based on View Mode */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredClients.map(client => (
            <ClientCard key={client.id} client={client} />
          ))}
          {filteredClients.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-500">
              Nincs találat a következőre: "{searchQuery}" {statusFilter !== 'Minden' && `és státusz: ${statusFilter}`}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-medium text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Cégnév</th>
                  <th className="px-6 py-4 text-center">Adószám</th>
                  <th className="px-6 py-4 text-center">Feldolgozatlan</th>
                  <th className="px-6 py-4 text-center">Hiányzó</th>
                  <th className="px-6 py-4 text-center">Határidő</th>
                  <th className="px-6 py-4 text-center">Státusz</th>
                  <th className="px-6 py-4 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.length > 0 ? (
                  filteredClients.map((client) => (
                    <tr 
                      key={client.id} 
                      onClick={() => navigate(`/accounty/client/${client.id}`)}
                      className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${client.colorHex} shrink-0`}>
                            <Building2 className="w-4 h-4" />
                          </div>
                          <span className="font-semibold text-slate-900 group-hover:text-emerald-600 transition-colors">{client.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500">{client.taxNumber}</td>
                      <td className="px-6 py-4 text-center font-medium text-slate-900">{client.unprocessedCount}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`font-medium ${client.missingCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                          {client.missingCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-500">
                        <span className={`${client.status === 'Kritikus' ? 'text-red-600 font-medium' : ''}`}>
                          {client.deadline}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={client.status} />
                      </td>
                      <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button className="text-slate-300 hover:text-slate-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
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
