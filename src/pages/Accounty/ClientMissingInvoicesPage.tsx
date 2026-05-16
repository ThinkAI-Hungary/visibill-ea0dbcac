import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  History, 
  Plus, 
  Search, 
  Mail,
  MessageSquare,
  CheckCircle,
  Clock,
  Send,
  Phone,
  Eye,
  XCircle,
  MoreVertical
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const detailedHistoryData = [
  { id: 1, date: '2024-01-15 10:30', channel: 'Email', vendor: 'Telekom - Telefon számla', responseTime: '2 óra', status: 'Válaszolt', statusColor: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: Mail, iconColor: 'text-emerald-500' },
  { id: 2, date: '2024-01-14 14:15', channel: 'Viber', vendor: 'MOL - Üzemanyag', responseTime: '-', status: 'Megnyitva', statusColor: 'text-amber-600 bg-amber-50 border-amber-200', icon: MessageSquare, iconColor: 'text-slate-400' },
  { id: 3, date: '2024-01-14 09:00', channel: 'Email', vendor: 'Office Depot - Irodaszer', responseTime: '-', status: 'Kézbesítve', statusColor: 'text-slate-600 bg-slate-100 border-slate-200', icon: Mail, iconColor: 'text-slate-400' },
  { id: 4, date: '2024-01-13 16:45', channel: 'AI Hívás', vendor: 'Vodafone - Mobiltelefon', responseTime: '1 nap', status: 'Válaszolt', statusColor: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: Phone, iconColor: 'text-emerald-500' },
  { id: 5, date: '2024-01-12 11:00', channel: 'Telegram', vendor: 'Google - Hirdetés', responseTime: '-', status: 'Sikertelen', statusColor: 'text-red-600 bg-red-50 border-red-200', icon: Send, iconColor: 'text-red-400' },
  { id: 6, date: '2024-01-11 08:30', channel: 'Email', vendor: 'Telekom - Internet', responseTime: '4 óra', status: 'Válaszolt', statusColor: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: Mail, iconColor: 'text-emerald-500' },
  { id: 7, date: '2024-01-10 15:20', channel: 'Viber', vendor: 'MOL - Üzemanyag', responseTime: '-', status: 'Megnyitva', statusColor: 'text-amber-600 bg-amber-50 border-amber-200', icon: MessageSquare, iconColor: 'text-slate-400' },
  { id: 8, date: '2024-01-09 10:00', channel: 'Email', vendor: 'Magyar Posta - Levelezés', responseTime: '-', status: 'Elküldve', statusColor: 'text-blue-600 bg-blue-50 border-blue-200', icon: Mail, iconColor: 'text-slate-400' },
];

export default function ClientMissingInvoicesPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('Minden forrás');
  const [statusFilter, setStatusFilter] = useState('Minden');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState<typeof invoiceData[0] | null>(null);

  // History View State
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyChannelFilter, setHistoryChannelFilter] = useState('Minden');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('Minden');
  const [historyTab, setHistoryTab] = useState<'timeline' | 'table'>('timeline');

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

  const filteredHistory = detailedHistoryData.filter(item => {
    const matchesSearch = item.vendor.toLowerCase().includes(historySearchTerm.toLowerCase()) || item.channel.toLowerCase().includes(historySearchTerm.toLowerCase());
    const matchesChannel = historyChannelFilter === 'Minden' || item.channel === historyChannelFilter;
    const matchesStatus = historyStatusFilter === 'Minden' || item.status === historyStatusFilter;
    return matchesSearch && matchesChannel && matchesStatus;
  });

  if (showHistoryView) {
    return (
      <div className="w-full space-y-6 pb-24 animate-in fade-in slide-in-from-right-8 duration-500">
        
        {/* Header */}
        <div className="flex flex-col gap-1">
          <button 
            onClick={() => setShowHistoryView(false)}
            className="flex items-center text-sm text-slate-500 hover:text-slate-800 transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {clientName} • Hiányzó számlák
          </button>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Felszólítás előzmények</h1>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-500 mb-2">Összes</p>
            <h3 className="text-2xl font-black text-slate-900">45</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-emerald-600 mb-2">Sikeres</p>
            <h3 className="text-2xl font-black text-emerald-600">38</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-amber-600 mb-2">Folyamatban</p>
            <h3 className="text-2xl font-black text-amber-600">5</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-red-600 mb-2">Sikertelen</p>
            <h3 className="text-2xl font-black text-red-600">2</h3>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-500 mb-2">Átlag válaszidő</p>
            <h3 className="text-2xl font-black text-slate-900">6 óra</h3>
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
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <select 
              value={historyChannelFilter}
              onChange={(e) => setHistoryChannelFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm cursor-pointer min-w-[140px]"
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
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm cursor-pointer min-w-[140px]"
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
        <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
          <button 
            onClick={() => setHistoryTab('timeline')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${historyTab === 'timeline' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Idővonal
          </button>
          <button 
            onClick={() => setHistoryTab('table')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${historyTab === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Táblázat
          </button>
        </div>

        {/* Content */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          {historyTab === 'timeline' ? (
            <div className="p-6 space-y-0 relative">
              {/* Vertical line connecting timeline items */}
              <div className="absolute top-8 bottom-8 left-[43px] w-[2px] bg-slate-100 z-0"></div>
              
              {filteredHistory.map((item) => (
                <div key={item.id} className="relative z-10 flex items-center justify-between p-4 group hover:bg-slate-50 transition-colors rounded-xl -ml-2 -mr-2">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                      <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{item.vendor}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.channel} • {item.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {item.responseTime !== '-' && (
                      <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
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
                <div className="py-8 text-center text-slate-500">Nincs a keresésnek megfelelő találat.</div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 tracking-wider">Dátum</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 tracking-wider">Csatorna</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 tracking-wider">Számla</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 tracking-wider">Válaszidő</th>
                    <th className="py-4 px-6 text-xs font-semibold text-slate-500 tracking-wider">Státusz</th>
                    <th className="py-4 px-6 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-6 text-sm text-slate-600">{item.date}</td>
                      <td className="py-4 px-6 text-sm text-slate-600 flex items-center gap-2">
                        <item.icon className="w-4 h-4 text-slate-400" />
                        {item.channel}
                      </td>
                      <td className="py-4 px-6 text-sm font-medium text-slate-900">{item.vendor}</td>
                      <td className="py-4 px-6 text-sm text-slate-600">{item.responseTime}</td>
                      <td className="py-4 px-6">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.statusColor}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-200 transition-all">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredHistory.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">Nincs a keresésnek megfelelő találat.</td>
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

  return (
    <div className="w-full space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
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
          <button 
            onClick={() => setShowHistoryView(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
          >
            <History className="w-4 h-4" />
            Előzmények
          </button>
          
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#1A1F2C] text-white rounded-lg hover:bg-[#2A3143] transition-colors text-sm font-medium shadow-sm">
                <Plus className="w-4 h-4" />
                Hiányzó hozzáadása
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Hiányzó számla hozzáadása</DialogTitle>
                <DialogDescription>
                  Add meg a hiányzó számla adatait
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Szállító neve</label>
                  <input type="text" placeholder="pl. Telekom Magyarország" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Típus/Leírás</label>
                  <input type="text" placeholder="pl. Telefon számla" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Becsült összeg</label>
                    <input type="text" defaultValue="0" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Időszak</label>
                    <input type="text" defaultValue="2024 Január" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Prioritás</label>
                  <select defaultValue="Közepes" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer">
                    <option value="Sürgős">Sürgős</option>
                    <option value="Magas">Magas</option>
                    <option value="Közepes">Közepes</option>
                    <option value="Alacsony">Alacsony</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Megjegyzés</label>
                  <textarea placeholder="További információk..." className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-h-[100px] resize-none" />
                </div>
              </div>
              <DialogFooter>
                <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium">Mégse</button>
                <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 bg-[#1A1F2C] text-white rounded-lg hover:bg-[#2A3143] transition-colors text-sm font-medium">Hozzáadás</button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
                    <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100 transition-all outline-none">
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-white border-slate-200">
                          <DropdownMenuItem 
                            className="gap-2.5 cursor-pointer text-slate-700 py-2"
                            onClick={() => setSelectedInvoiceForDetails(invoice)}
                          >
                            <Eye className="w-4 h-4 text-slate-500" />
                            <span className="font-medium text-sm">Részletek</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2.5 cursor-pointer text-slate-700 py-2">
                            <Send className="w-4 h-4 text-slate-500" />
                            <span className="font-medium text-sm">Felszólítás küldése</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-100" />
                          <DropdownMenuItem className="gap-2.5 cursor-pointer text-slate-700 py-2">
                            <CheckCircle className="w-4 h-4 text-slate-500" />
                            <span className="font-medium text-sm">Megérkezettnek jelöl</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2.5 cursor-pointer text-slate-700 py-2">
                            <XCircle className="w-4 h-4 text-slate-500" />
                            <span className="font-medium text-sm">Téves találatnak jelöl</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

      {/* Quick History Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">Felszólítás előzmények</h2>
        </div>
        <div className="p-6 space-y-0 relative">
          <div className="absolute top-8 bottom-8 left-[43px] w-[2px] bg-slate-100 z-0"></div>
          
          {[
            { id: 1, title: 'Felszólítás küldve', date: '2024-01-14 10:30', icon: Mail, status: 'Elküldve', color: 'text-blue-600 bg-blue-50 border-blue-200', iconColor: 'text-slate-400' },
            { id: 2, title: 'Üzenet kézbesítve', date: '2024-01-12 14:15', icon: MessageSquare, status: 'Kézbesítve', color: 'text-emerald-600 bg-emerald-50 border-emerald-200', iconColor: 'text-slate-400' },
            { id: 3, title: 'Email megnyitva', date: '2024-01-10 09:00', icon: Mail, status: 'Megnyitva', color: 'text-amber-600 bg-amber-50 border-amber-200', iconColor: 'text-slate-400' }
          ].map((item) => (
            <div key={item.id} className="relative z-10 flex items-center justify-between p-4 group hover:bg-slate-50 transition-colors rounded-xl -ml-2 -mr-2">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                  <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {item.date}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.color}`}>
                  {item.status}
                </span>
              </div>
            </div>
          ))}
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

      {/* Invoice Details Modal */}
      <Dialog open={!!selectedInvoiceForDetails} onOpenChange={(open) => !open && setSelectedInvoiceForDetails(null)}>
        <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden">
          {selectedInvoiceForDetails && (
            <>
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
                <DialogTitle className="text-xl font-bold text-slate-900">{selectedInvoiceForDetails.subtext}</DialogTitle>
                <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full mr-6">
                  {selectedInvoiceForDetails.status}
                </span>
              </div>
              
              <div className="px-6 py-5 grid grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Szállító neve</p>
                  <p className="text-sm font-medium text-slate-900">{selectedInvoiceForDetails.vendor}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Azonosítás módja</p>
                  <span className="inline-block px-2.5 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-md text-xs font-medium">
                    {selectedInvoiceForDetails.source}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Becsült összeg</p>
                  <p className="text-sm font-medium text-slate-900">{selectedInvoiceForDetails.amount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Várható időszak</p>
                  <p className="text-sm font-medium text-slate-900">{selectedInvoiceForDetails.period}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Prioritás</p>
                  {getPriorityBadge(selectedInvoiceForDetails.priority)}
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Hozzáadva</p>
                  <p className="text-sm font-medium text-slate-900">2024-01-10</p>
                </div>
              </div>

              <div className="px-6 py-5 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4">NAV adatok</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">NAV számla azonosító</p>
                    <p className="text-sm font-medium text-slate-900">N/A</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Szállító adószáma</p>
                    <p className="text-sm font-medium text-slate-900">N/A</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-4">Bekérési előzmények</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg text-slate-400 border border-slate-100">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">2024-02-10 14:30</p>
                        <p className="text-xs text-slate-500">Email</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-[#1A1F2C] text-white text-xs font-semibold rounded-full">
                      Megnyitva
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg text-slate-400 border border-slate-100">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">2024-02-05 09:15</p>
                        <p className="text-xs text-slate-500">Email</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full border border-slate-200">
                      Elküldve
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
                <button 
                  className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                  onClick={() => setSelectedInvoiceForDetails(null)}
                >
                  Téves azonosítás
                </button>
                <div className="flex items-center gap-3">
                  <button 
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
                    onClick={() => setSelectedInvoiceForDetails(null)}
                  >
                    <CheckCircle className="w-4 h-4 text-slate-500" />
                    Megérkezett a számla
                  </button>
                  <button 
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#1A1F2C] text-white rounded-xl text-sm font-medium hover:bg-[#2A3143] transition-colors shadow-sm"
                    onClick={() => setSelectedInvoiceForDetails(null)}
                  >
                    <Mail className="w-4 h-4" />
                    Bekérés küldése
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
