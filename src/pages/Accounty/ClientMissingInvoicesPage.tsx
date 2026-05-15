import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  History, 
  Plus, 
  Search, 
  MoreHorizontal,
  Mail,
  MessageSquare,
  CheckCircle,
  Clock,
  Send
} from 'lucide-react';

// Mock data for the specific client
const invoiceData = [
  {
    id: 1,
    vendor: 'Telekom Magyarország',
    subtext: 'Telefon számla',
    period: '2024 Január',
    amount: '45 000 Ft',
    source: 'NAV',
    priority: 'Sürgős',
    status: 'Bekérésre vár',
    statusVariant: 'neutral'
  },
  {
    id: 2,
    vendor: 'Vodafone Kft.',
    subtext: 'Mobiltelefon',
    period: '2024 Január',
    amount: '28 000 Ft',
    source: 'NAV',
    priority: 'Sürgős',
    status: 'Bekérve (1x)',
    statusVariant: 'warning'
  },
  {
    id: 3,
    vendor: 'MOL Nyrt.',
    subtext: 'Üzemanyag',
    period: '2024 Január',
    amount: '120 000 Ft',
    source: 'Minta',
    priority: 'Közepes',
    status: 'Bekérésre vár',
    statusVariant: 'neutral'
  },
  {
    id: 4,
    vendor: 'Office Depot',
    subtext: 'Irodaszer rendelés',
    period: '2024 Január',
    amount: '35 000 Ft',
    source: 'Minta',
    priority: 'Alacsony',
    status: 'Bekérve (2x)',
    statusVariant: 'warning'
  },
  {
    id: 5,
    vendor: 'Ismeretlen szállító',
    subtext: 'Javítási munka',
    period: '2024 Január',
    amount: '80 000 Ft',
    source: 'Kézi',
    priority: 'Közepes',
    status: 'Bekérésre vár',
    statusVariant: 'neutral'
  }
];

const historyData = [
  {
    id: 1,
    title: 'Felszólítás küldve',
    time: '2024-01-14 10:30',
    icon: Mail,
    status: 'Elküldve',
    statusColor: 'text-blue-600 bg-blue-50 border-blue-200'
  },
  {
    id: 2,
    title: 'Üzenet kézbesítve',
    time: '2024-01-12 14:15',
    icon: MessageSquare,
    status: 'Kézbesítve',
    statusColor: 'text-emerald-600 bg-emerald-50 border-emerald-200'
  },
  {
    id: 3,
    title: 'Email megnyitva',
    time: '2024-01-10 09:00',
    icon: Mail,
    status: 'Megnyitva',
    statusColor: 'text-amber-600 bg-amber-50 border-amber-200'
  }
];

export default function ClientMissingInvoicesPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('Minden forrás');
  const [statusFilter, setStatusFilter] = useState('Minden');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // In a real app, fetch client data based on ID. We use mock data here.
  const mockClients: Record<number, string> = {
    1: 'Tech Solutions Kft.',
    2: 'Digital Partners Zrt.',
    3: 'Innovation Labs Kft.',
    4: 'Smart Office Bt.',
    5: 'Global Trade Kft.',
  };
  
  const clientName = id && !isNaN(Number(id)) ? mockClients[Number(id)] || "Ismeretlen Ügyfél" : "Ismeretlen Ügyfél";

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Sürgős':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-100">Sürgős</span>;
      case 'Közepes':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-100">Közepes</span>;
      case 'Alacsony':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">Alacsony</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string, variant: string) => {
    if (variant === 'warning') {
      return <span className="text-xs font-semibold text-amber-500 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100/50">{status}</span>;
    }
    return <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">{status}</span>;
  };

  const filteredInvoices = invoiceData.filter(invoice => {
    const matchesSearch = 
      invoice.vendor.toLowerCase().includes(searchTerm.toLowerCase()) || 
      invoice.subtext.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSource = sourceFilter === 'Minden forrás' || invoice.source === sourceFilter;
    
    const matchesStatus = statusFilter === 'Minden' || invoice.priority === statusFilter || invoice.status.includes(statusFilter);

    return matchesSearch && matchesSource && matchesStatus;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredInvoices.map(inv => inv.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectItem = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const isAllSelected = filteredInvoices.length > 0 && selectedIds.length === filteredInvoices.length;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button 
            onClick={() => navigate('/accounty/missing-invoices')}
            className="flex items-center text-sm text-slate-500 hover:text-slate-800 transition-colors mb-1"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {clientName}
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hiányzó számlák</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm">
            <History className="w-4 h-4" />
            Előzmények
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#1A1F2C] text-white rounded-lg hover:bg-[#2A3143] transition-colors text-sm font-medium shadow-sm">
            <Plus className="w-4 h-4" />
            Hiányzó hozzáadása
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-sm font-medium text-slate-500 mb-2">Összes hiányzó</p>
          <h3 className="text-3xl font-black text-slate-900">5</h3>
        </div>
        
        <div className="bg-red-50/50 p-5 rounded-xl border-2 border-red-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
          <p className="text-sm font-bold text-red-600 mb-2">Sürgős</p>
          <h3 className="text-3xl font-black text-red-600">2</h3>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-sm font-medium text-slate-500 mb-2">NAV-ból</p>
          <h3 className="text-3xl font-black text-slate-900">2</h3>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <p className="text-sm font-medium text-slate-500 mb-2">Becsült összeg</p>
          <h3 className="text-3xl font-black text-slate-900">308 000 Ft</h3>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Keresés szállító, leírás..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm cursor-pointer min-w-[140px]"
          >
            <option value="Minden forrás">Minden forrás</option>
            <option value="NAV">NAV</option>
            <option value="Minta">Minta</option>
            <option value="Kézi">Kézi</option>
          </select>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm cursor-pointer min-w-[120px]"
          >
            <option value="Minden">Minden</option>
            <option value="Sürgős">Sürgős</option>
            <option value="Bekérésre vár">Bekérésre vár</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-4 px-4 w-12">
                  <input 
                    type="checkbox" 
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                  />
                </th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Szállító</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Időszak</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Becsült összeg</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Forrás</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Prioritás</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Státusz</th>
                <th className="py-4 px-4 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className={`hover:bg-slate-50/80 transition-colors group ${selectedIds.includes(invoice.id) ? 'bg-slate-50' : ''}`}>
                    <td className="py-4 px-4">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(invoice.id)}
                        onChange={() => handleSelectItem(invoice.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900 text-sm">{invoice.vendor}</div>
                      <div className="text-xs text-slate-500">{invoice.subtext}</div>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-600">{invoice.period}</td>
                    <td className="py-4 px-4 text-sm font-semibold text-slate-900">{invoice.amount}</td>
                    <td className="py-4 px-4 text-sm text-slate-600">{invoice.source}</td>
                    <td className="py-4 px-4">{getPriorityBadge(invoice.priority)}</td>
                    <td className="py-4 px-4">{getStatusBadge(invoice.status, invoice.statusVariant)}</td>
                    <td className="py-4 px-4 text-center">
                      <button className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-all">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    Nincs a keresésnek megfelelő találat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* History Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Felszólítás előzmények</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {historyData.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">{item.title}</h4>
                    <p className="text-xs text-slate-500 flex items-center mt-0.5">
                      <Clock className="w-3 h-3 mr-1" />
                      {item.time}
                    </p>
                  </div>
                </div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${item.statusColor}`}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl bg-slate-100/95 backdrop-blur-sm border border-slate-200 p-4 rounded-2xl shadow-xl flex items-center justify-between animate-in slide-in-from-bottom-10 fade-in duration-300 z-50">
          <div className="text-sm font-semibold text-slate-700 pl-2">
            {selectedIds.length} kijelölve
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1F2C] text-white rounded-xl hover:bg-[#2A3143] transition-colors text-sm font-medium shadow-sm">
              <Send className="w-4 h-4" />
              Felszólítás küldése
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm">
              <CheckCircle className="w-4 h-4" />
              Megérkezett
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
