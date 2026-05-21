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
  MoreVertical,
  Trash2
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
import { globalMissingInvoicesData, globalClientInvoices } from './mockData';

const detailedHistoryData = [
  { id: 1, date: '2024-01-15 10:30', channel: 'Email', vendor: 'Telekom - Telefon számla', responseTime: '2 óra', status: 'Válaszolt', statusColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800', icon: Mail, iconColor: 'text-emerald-500' },
  { id: 2, date: '2024-01-14 14:15', channel: 'Viber', vendor: 'MOL - Üzemanyag', responseTime: '-', status: 'Megnyitva', statusColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800', icon: MessageSquare, iconColor: 'text-slate-400' },
  { id: 3, date: '2024-01-14 09:00', channel: 'Email', vendor: 'Office Depot - Irodaszer', responseTime: '-', status: 'Kézbesítve', statusColor: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-800', icon: Mail, iconColor: 'text-slate-400' },
  { id: 4, date: '2024-01-13 16:45', channel: 'AI Hívás', vendor: 'Vodafone - Mobiltelefon', responseTime: '1 nap', status: 'Válaszolt', statusColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800', icon: Phone, iconColor: 'text-emerald-500' },
  { id: 5, date: '2024-01-12 11:00', channel: 'Telegram', vendor: 'Google - Hirdetés', responseTime: '-', status: 'Sikertelen', statusColor: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/40 border-red-200 dark:border-red-800', icon: Send, iconColor: 'text-red-400' },
  { id: 6, date: '2024-01-11 08:30', channel: 'Email', vendor: 'Telekom - Internet', responseTime: '4 óra', status: 'Válaszolt', statusColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800', icon: Mail, iconColor: 'text-emerald-500' },
  { id: 7, date: '2024-01-10 15:20', channel: 'Viber', vendor: 'MOL - Üzemanyag', responseTime: '-', status: 'Megnyitva', statusColor: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800', icon: MessageSquare, iconColor: 'text-slate-400' },
  { id: 8, date: '2024-01-09 10:00', channel: 'Email', vendor: 'Magyar Posta - Levelezés', responseTime: '-', status: 'Elküldve', statusColor: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800', icon: Mail, iconColor: 'text-slate-400' },
];

export default function ClientMissingInvoicesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const clientId = Number(id) || 1;

  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('Minden forrás');
  const [statusFilter, setStatusFilter] = useState('Minden');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState<typeof globalClientInvoices[0] | null>(null);

  const [invoices, setInvoices] = useState(() => globalClientInvoices.filter(inv => inv.clientId === clientId));
  
  React.useEffect(() => {
    setInvoices(globalClientInvoices.filter(inv => inv.clientId === clientId));
    setSelectedIds([]);
  }, [clientId]);
  const [newInvoiceForm, setNewInvoiceForm] = useState({
    vendor: '',
    subtext: '',
    amount: '0',
    period: '2024 Január',
    priority: 'Közepes',
    note: ''
  });

  const handleAddInvoice = () => {
    const parsedAmount = parseInt(newInvoiceForm.amount.replace(/\D/g, ''), 10);
    const formattedAmount = isNaN(parsedAmount) ? '0 Ft' : `${new Intl.NumberFormat('hu-HU').format(parsedAmount).replace(/,/g, ' ')} Ft`;

    const newItem = {
      id: Date.now(),
      clientId: clientId,
      vendor: newInvoiceForm.vendor || 'Új szállító',
      subtext: newInvoiceForm.subtext || '-',
      period: newInvoiceForm.period || '2024 Január',
      amount: formattedAmount,
      source: 'Kézi',
      priority: newInvoiceForm.priority,
      status: 'Bekérésre vár',
      statusVariant: 'neutral'
    };
    globalClientInvoices.unshift(newItem); // Save to mock data
    
    // Update global summary data
    const clientStats = globalMissingInvoicesData.find(c => c.id === clientId);
    if (clientStats) {
      clientStats.missing += 1;
      if (newItem.priority === 'Sürgős') {
        clientStats.critical += 1;
      }
    }
    
    setInvoices([newItem, ...invoices]);
    setIsAddModalOpen(false);
    setNewInvoiceForm({ vendor: '', subtext: '', amount: '0', period: '2024 Január', priority: 'Közepes', note: '' });
  };

  const handleDeleteInvoice = (idToDelete: number) => {
    const invoiceToDelete = invoices.find(inv => inv.id === idToDelete);
    if (!invoiceToDelete) return;

    const index = globalClientInvoices.findIndex(inv => inv.id === idToDelete);
    if (index > -1) {
      globalClientInvoices.splice(index, 1);
    }

    const clientStats = globalMissingInvoicesData.find(c => c.id === clientId);
    if (clientStats) {
      clientStats.missing = Math.max(0, clientStats.missing - 1);
      if (invoiceToDelete.priority === 'Sürgős') {
        clientStats.critical = Math.max(0, clientStats.critical - 1);
      }
    }

    setInvoices(invoices.filter(inv => inv.id !== idToDelete));
    setSelectedIds(selectedIds.filter(id => id !== idToDelete));
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => {
      const invoiceToDelete = invoices.find(inv => inv.id === id);
      if (!invoiceToDelete) return;

      const index = globalClientInvoices.findIndex(inv => inv.id === id);
      if (index > -1) {
        globalClientInvoices.splice(index, 1);
      }

      const clientStats = globalMissingInvoicesData.find(c => c.id === clientId);
      if (clientStats) {
        clientStats.missing = Math.max(0, clientStats.missing - 1);
        if (invoiceToDelete.priority === 'Sürgős') {
          clientStats.critical = Math.max(0, clientStats.critical - 1);
        }
      }
    });

    setInvoices(invoices.filter(inv => !selectedIds.includes(inv.id)));
    setSelectedIds([]);
  };

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
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">Sürgős</span>;
      case 'Közepes':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800">Közepes</span>;
      case 'Alacsony':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">Alacsony</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string, variant: string) => {
    if (variant === 'warning') {
      return <span className="text-xs font-semibold text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 px-2.5 py-1 rounded-md border border-amber-100/50 dark:border-amber-800">{status}</span>;
    }
    return <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800">{status}</span>;
  };

  const filteredInvoices = invoices.filter(invoice => {
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
            className="flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {clientName} • Hiányzó számlák
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Felszólítás előzmények</h1>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Összes</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">45</h3>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-emerald-600 mb-2">Sikeres</p>
            <h3 className="text-2xl font-black text-emerald-600">38</h3>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-amber-600 mb-2">Folyamatban</p>
            <h3 className="text-2xl font-black text-amber-600">5</h3>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <p className="text-xs font-semibold text-red-600 mb-2">Sikertelen</p>
            <h3 className="text-2xl font-black text-red-600">2</h3>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
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
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <select 
              value={historyChannelFilter}
              onChange={(e) => setHistoryChannelFilter(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm cursor-pointer min-w-[140px]"
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
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm cursor-pointer min-w-[140px]"
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
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${historyTab === 'timeline' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300'}`}
          >
            Idővonal
          </button>
          <button 
            onClick={() => setHistoryTab('table')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${historyTab === 'table' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 dark:text-slate-300'}`}
          >
            Táblázat
          </button>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          {historyTab === 'timeline' ? (
            <div className="p-6 space-y-0 relative">
              {/* Vertical line connecting timeline items */}
              <div className="absolute top-8 bottom-8 left-[43px] w-[2px] bg-slate-100 dark:bg-slate-800 z-0"></div>
              
              {filteredHistory.map((item) => (
                <div key={item.id} className="relative z-10 flex items-center justify-between p-4 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-xl -ml-2 -mr-2">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm">
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
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
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

  return (
    <div className="w-full space-y-6 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button 
            onClick={() => navigate('/accounty/missing-invoices')}
            className="flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-colors mb-1"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            {clientName}
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Hiányzó számlák</h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowHistoryView(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm font-medium shadow-sm"
          >
            <History className="w-4 h-4" />
            Előzmények
          </button>
          
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 bg-[#1A1F2C] dark:bg-emerald-600 text-white rounded-lg hover:bg-[#2A3143] dark:hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm">
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
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Szállító neve</label>
                  <input type="text" value={newInvoiceForm.vendor} onChange={e => setNewInvoiceForm({...newInvoiceForm, vendor: e.target.value})} placeholder="pl. Telekom Magyarország" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Típus/Leírás</label>
                  <input type="text" value={newInvoiceForm.subtext} onChange={e => setNewInvoiceForm({...newInvoiceForm, subtext: e.target.value})} placeholder="pl. Telefon számla" className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Becsült összeg</label>
                    <input type="text" value={newInvoiceForm.amount} onChange={e => setNewInvoiceForm({...newInvoiceForm, amount: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Időszak</label>
                    <input type="text" value={newInvoiceForm.period} onChange={e => setNewInvoiceForm({...newInvoiceForm, period: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Prioritás</label>
                  <select value={newInvoiceForm.priority} onChange={e => setNewInvoiceForm({...newInvoiceForm, priority: e.target.value})} className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer">
                    <option value="Sürgős">Sürgős</option>
                    <option value="Magas">Magas</option>
                    <option value="Közepes">Közepes</option>
                    <option value="Alacsony">Alacsony</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Megjegyzés</label>
                  <textarea value={newInvoiceForm.note} onChange={e => setNewInvoiceForm({...newInvoiceForm, note: e.target.value})} placeholder="További információk..." className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 min-h-[100px] resize-none" />
                </div>
              </div>
              <DialogFooter>
                <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm font-medium">Mégse</button>
                <button onClick={handleAddInvoice} className="px-4 py-2 bg-[#1A1F2C] dark:bg-emerald-600 text-white rounded-lg hover:bg-[#2A3143] dark:hover:bg-emerald-700 transition-colors text-sm font-medium">Hozzáadás</button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Összes hiányzó</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">{invoices.length}</h3>
        </div>
        
        <div className="bg-red-50/50 dark:bg-red-900/20 p-5 rounded-xl border-2 border-red-200 dark:border-red-900/50 shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
          <p className="text-sm font-bold text-red-600 mb-2">Sürgős</p>
          <h3 className="text-3xl font-black text-red-600">{invoices.filter(i => i.priority === 'Sürgős').length}</h3>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">NAV-ból</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">{invoices.filter(i => i.source === 'NAV').length}</h3>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Becsült összeg</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">
            {new Intl.NumberFormat('hu-HU').format(invoices.reduce((sum, inv) => sum + (parseInt(inv.amount.replace(/\D/g, ''), 10) || 0), 0))} Ft
          </h3>
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
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm cursor-pointer min-w-[140px]"
          >
            <option value="Minden forrás">Minden forrás</option>
            <option value="NAV">NAV</option>
            <option value="Minta">Minta</option>
            <option value="Kézi">Kézi</option>
          </select>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm cursor-pointer min-w-[120px]"
          >
            <option value="Minden">Minden</option>
            <option value="Sürgős">Sürgős</option>
            <option value="Bekérésre vár">Bekérésre vár</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <th className="py-4 px-4 w-12">
                  <input 
                    type="checkbox" 
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                  />
                </th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Szállító</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Időszak</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Becsült összeg</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Forrás</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prioritás</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Státusz</th>
                <th className="py-4 px-4 w-12 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group ${selectedIds.includes(invoice.id) ? 'bg-slate-50 dark:bg-slate-800/30' : ''}`}>
                    <td className="py-4 px-4">
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(invoice.id)}
                        onChange={() => handleSelectItem(invoice.id)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer" 
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{invoice.vendor}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{invoice.subtext}</div>
                    </td>
                    <td className="py-4 px-4 text-sm text-slate-600 dark:text-slate-400">{invoice.period}</td>
                    <td className="py-4 px-4 text-sm font-semibold text-slate-900 dark:text-slate-100">{invoice.amount}</td>
                    <td className="py-4 px-4 text-sm text-slate-600 dark:text-slate-400">{invoice.source}</td>
                    <td className="py-4 px-4">{getPriorityBadge(invoice.priority)}</td>
                    <td className="py-4 px-4">{getStatusBadge(invoice.status, invoice.statusVariant)}</td>
                    <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 transition-all outline-none">
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                          <DropdownMenuItem 
                            className="gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 py-2"
                            onClick={() => setSelectedInvoiceForDetails(invoice)}
                          >
                            <Eye className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <span className="font-medium text-sm">Részletek</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 py-2">
                            <Send className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <span className="font-medium text-sm">Felszólítás küldése</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                          <DropdownMenuItem className="gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 py-2">
                            <CheckCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <span className="font-medium text-sm">Megérkezettnek jelöl</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 py-2">
                            <XCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <span className="font-medium text-sm">Téves találatnak jelöl</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2.5 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20 py-2"
                            onClick={() => handleDeleteInvoice(invoice.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="font-medium text-sm">Törlés</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">
                    Nincs a keresésnek megfelelő találat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick History Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Felszólítás előzmények</h2>
        </div>
        <div className="p-6 space-y-0 relative">
          <div className="absolute top-8 bottom-8 left-[43px] w-[2px] bg-slate-100 dark:bg-slate-800 z-0"></div>
          
          {[
            { id: 1, title: 'Felszólítás küldve', date: '2024-01-14 10:30', icon: Mail, status: 'Elküldve', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800', iconColor: 'text-slate-400' },
            { id: 2, title: 'Üzenet kézbesítve', date: '2024-01-12 14:15', icon: MessageSquare, status: 'Kézbesítve', color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/40 border-emerald-200 dark:border-emerald-800', iconColor: 'text-slate-400' },
            { id: 3, title: 'Email megnyitva', date: '2024-01-10 09:00', icon: Mail, status: 'Megnyitva', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800', iconColor: 'text-slate-400' }
          ].map((item) => (
            <div key={item.id} className="relative z-10 flex items-center justify-between p-4 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-xl -ml-2 -mr-2">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm">
                  <item.icon className={`w-4 h-4 ${item.iconColor}`} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{item.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-sm border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-xl flex items-center justify-between animate-in slide-in-from-bottom-10 fade-in duration-300 z-50">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 pl-2">
            {selectedIds.length} kijelölve
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-[#1A1F2C] dark:bg-emerald-600 text-white rounded-xl hover:bg-[#2A3143] dark:hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm">
              <Send className="w-4 h-4" />
              Felszólítás küldése
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm font-medium shadow-sm">
              <CheckCircle className="w-4 h-4" />
              Megérkezett
            </button>
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm font-medium shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              Törlés
            </button>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      <Dialog open={!!selectedInvoiceForDetails} onOpenChange={(open) => !open && setSelectedInvoiceForDetails(null)}>
        <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden">
          {selectedInvoiceForDetails && (
            <>
              <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">{selectedInvoiceForDetails.subtext}</DialogTitle>
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-full mr-6">
                  {selectedInvoiceForDetails.status}
                </span>
              </div>
              
              <div className="px-6 py-5 grid grid-cols-2 gap-y-6 gap-x-4">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Szállító neve</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedInvoiceForDetails.vendor}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Azonosítás módja</p>
                  <span className="inline-block px-2.5 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-md text-xs font-medium">
                    {selectedInvoiceForDetails.source}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Becsült összeg</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedInvoiceForDetails.amount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Várható időszak</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedInvoiceForDetails.period}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Prioritás</p>
                  {getPriorityBadge(selectedInvoiceForDetails.priority)}
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Hozzáadva</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">2024-01-10</p>
                </div>
              </div>

              <div className="px-6 py-5 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">NAV adatok</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">NAV számla azonosító</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">N/A</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Szállító adószáma</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">N/A</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">Bekérési előzmények</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 border border-slate-100 dark:border-slate-800">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">2024-02-10 14:30</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-[#1A1F2C] text-white text-xs font-semibold rounded-full">
                      Megnyitva
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 border border-slate-100 dark:border-slate-800">
                        <Mail className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">2024-02-05 09:15</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-full border border-slate-200 dark:border-slate-800">
                      Elküldve
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button 
                  className="px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors shadow-sm"
                  onClick={() => setSelectedInvoiceForDetails(null)}
                >
                  Téves azonosítás
                </button>
                <div className="flex items-center gap-3">
                  <button 
                    className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors shadow-sm"
                    onClick={() => setSelectedInvoiceForDetails(null)}
                  >
                    <CheckCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
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
