import React, { useState, useMemo, useRef } from 'react';
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
  Trash2,
  Loader2,
  FileText
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
import { useAccountyMissingItems, useAccountyMissingCounts, useAddMissingItem, useIgnoreMissingItem, useResolveMissingItem, useAccountyCommunicationPrefs, useGeneratePortalToken } from '@/hooks/accounty';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';
import {
  generateRequestEmail,
  addToApprovalQueue,
  type OutgoingMessage,
  type MissingItemForEmail,
} from './generateRequestEmail';

// Invoice item type from Supabase
interface InvoiceItem {
  id: string;
  vendor: string;
  subtext: string;
  period: string;
  amount: string;
  source: string;
  priority: string;
  status: string;
  statusVariant: string;
  category: string;
  notificationCount: number;
  itemDate: string | null;
  amountRaw: number | null;
  uploadedFiles: string[];
  createdAt: string | null;
  navInvoiceId: string | null;
  invoiceNumber: string | null;
  lastNotifiedAt: string | null;
  escalationLevel: number;
  details: string | null;
}

export default function ClientMissingInvoicesPage() {
  const { id: companyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch company name
  const { data: companyData } = useQuery({
    queryKey: ['company-name', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', companyId)
        .single();
      return data;
    },
    enabled: !!companyId,
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 100;

  // Fetch missing items from Supabase (paginated)
  const { data: paginatedData, isLoading, isError, refetch } = useAccountyMissingItems(companyId || '', currentPage, PAGE_SIZE);

  if (isError) {
    return (
      <div className="w-full p-6">
        <AccountyErrorState
          message="Nem sikerült betölteni a hiányzó számlák adatait. Ellenőrizd a hálózati kapcsolatot."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const supabaseMissing = paginatedData?.items;
  const totalCount = paginatedData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Server-side counts for KPI cards (no row transfer needed)
  const { data: missingCounts } = useAccountyMissingCounts(companyId || '');

  // Mutations
  const addMissingItem = useAddMissingItem();
  const ignoreMissingItem = useIgnoreMissingItem();
  const resolveMissingItem = useResolveMissingItem();

  // Communication preferences for contact email
  const { data: commPrefs } = useAccountyCommunicationPrefs(companyId || '');
  const generateTokenMutation = useGeneratePortalToken();

  // ── Handler: send request to approval queue ──
  const handleSendToApprovalQueue = async (items: InvoiceItem[]) => {
    if (!companyId || items.length === 0) return;

    const contactEmail = commPrefs?.contactEmail || 'nincs-megadva@example.com';
    const missingItemsForEmail: MissingItemForEmail[] = items.map(item => ({
      title: item.vendor + (item.subtext ? ` – ${item.subtext}` : ''),
      category: item.category,
      deadline: item.itemDate ? new Date(item.itemDate).toLocaleDateString('hu-HU') : undefined,
    }));

    // Generate real portal token using the hook (with specific item IDs)
    let portalLink = `${window.location.origin}/portal/demo-fallback`;
    try {
      const result = await generateTokenMutation.mutateAsync({ companyId, requestedItemIds: items.map(i => i.id) });
      portalLink = `${window.location.origin}/portal/${result.token}`;
    } catch (err) {
      reportError({ type: 'db_query', component: 'ClientMissingInvoicesPage', action: 'error', message: 'Portal token creation failed:', error: err });
    }

    const generated = generateRequestEmail({
      companyName: clientName,
      missingItems: missingItemsForEmail,
      portalLink,
      senderName: 'ThinkAI',
    });

    const message: OutgoingMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      companyId,
      companyName: clientName,
      contactEmail,
      channel: 'email',
      category: items.some(i => i.priority === 'Sürgős') ? 'urgent' : 'normal',
      subject: generated.subject,
      originalContext: items.map(i => `${i.vendor} – ${i.subtext}`).join(', '),
      aiGeneratedBody: generated.body,
      htmlPreview: generated.htmlPreview,
      portalLink,
      status: 'pending',
      createdAt: new Date().toISOString(),
      missingItemIds: items.map(i => i.id),
    };

    addToApprovalQueue(message);
    toast({
      title: ' Bekérés a jóváhagyó sorba került',
      description: `${items.length} dokumentum – ${clientName}`,
    });
    navigate('/accounty/approval-queue');
  };

  // Transform Supabase data to invoice format
  const invoices: InvoiceItem[] = useMemo(() => {
    if (!supabaseMissing) return [];
    return supabaseMissing.map(mi => {
      const sourceLabel = mi.source === 'nav_detektor' ? 'NAV' 
        : mi.source === 'bank_detektor' ? 'Bank' 
        : mi.source === 'ber_cron' ? 'Bér' 
        : 'Kézi';
      const priorityLabel = mi.priority === 'urgent' ? 'Sürgős' 
        : mi.priority === 'medium' ? 'Közepes' 
        : 'Alacsony';
      const statusLabel = mi.status === 'resolved'
        ? 'Feltöltve'
        : mi.notificationCount > 0 
          ? `Bekérve (${mi.notificationCount}x)` 
          : 'Bekérésre vár';
      const statusVariant = mi.status === 'resolved' 
        ? 'success' 
        : mi.notificationCount > 0 
          ? 'warning' 
          : 'neutral';
      return {
        id: mi.id,
        vendor: mi.title,
        subtext: mi.subtitle || mi.category,
        period: mi.itemDate ? new Date(mi.itemDate).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' }) : '-',
        amount: mi.amount ? `${mi.amount.toLocaleString('hu-HU')} Ft` : '-',
        source: sourceLabel,
        priority: priorityLabel,
        status: statusLabel,
        statusVariant: statusVariant,
        category: mi.category,
        notificationCount: mi.notificationCount,
        itemDate: mi.itemDate,
        amountRaw: mi.amount,
        uploadedFiles: (mi as any).uploaded_files || [],
        createdAt: mi.createdAt || null,
        navInvoiceId: mi.navInvoiceId || null,
        invoiceNumber: mi.invoiceNumber || null,
        lastNotifiedAt: mi.lastNotifiedAt || null,
        escalationLevel: mi.escalationLevel || 0,
        details: mi.details || null,
      };
    });
  }, [supabaseMissing]);

   const clientName = companyData?.name || 'Betöltés...';
  const tableRef = useRef<HTMLDivElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('Minden forrás');
  const [statusFilter, setStatusFilter] = useState('Minden');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState<InvoiceItem | null>(null);
  const [newInvoiceForm, setNewInvoiceForm] = useState({
    vendor: '',
    subtext: '',
    amount: '0',
    period: '2024 Január',
    priority: 'Közepes',
    note: ''
  });

  const handleAddInvoice = async () => {
    if (!companyId || !newInvoiceForm.vendor) return;
    const priorityMap: Record<string, 'urgent' | 'medium' | 'low'> = {
      'Sürgős': 'urgent', 'Közepes': 'medium', 'Alacsony': 'low'
    };
    try {
      await addMissingItem.mutateAsync({
        companyId,
        category: 'bejovo',
        title: newInvoiceForm.vendor,
        subtitle: newInvoiceForm.subtext || undefined,
        priority: priorityMap[newInvoiceForm.priority] || 'medium',
        details: newInvoiceForm.note || undefined,
        amount: newInvoiceForm.amount ? Number(newInvoiceForm.amount) : undefined,
      });
      setIsAddModalOpen(false);
      setNewInvoiceForm({ vendor: '', subtext: '', amount: '0', period: '2024 Január', priority: 'Közepes', note: '' });
    } catch (err) {
      reportError({ type: 'db_query', component: 'ClientMissingInvoicesPage', action: 'error', message: 'Add invoice failed:', error: err });
    }
  };

  const handleDeleteInvoice = async (idToDelete: string) => {
    try {
      await ignoreMissingItem.mutateAsync(idToDelete);
    } catch (err) {
      reportError({ type: 'db_query', component: 'ClientMissingInvoicesPage', action: 'error', message: 'Delete invoice failed:', error: err });
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedIds.map(id => ignoreMissingItem.mutateAsync(id)));
      setSelectedIds([]);
    } catch (err) {
      reportError({ type: 'db_query', component: 'ClientMissingInvoicesPage', action: 'error', message: 'Bulk delete failed:', error: err });
    }
  };

  const handleResolveInvoice = async (idToResolve: string) => {
    try {
      await resolveMissingItem.mutateAsync(idToResolve);
    } catch (err) {
      reportError({ type: 'db_query', component: 'ClientMissingInvoicesPage', action: 'error', message: 'Resolve invoice failed:', error: err });
    }
  };

  const handleUnresolveInvoice = async (idToUnresolve: string) => {
    if (!confirm('Biztosan eltávolítod a feltöltött fájl(oka)t? A tétel visszaáll "Bekérésre vár" státuszra.')) return;
    try {
      // Find the invoice to get its uploaded files
      const inv = invoices.find(i => i.id === idToUnresolve);
      const filesToDelete = inv?.uploadedFiles || [];

      // Delete files from storage
      if (filesToDelete.length > 0) {
        const { error: storageErr } = await supabase.storage
          .from('accounty_uploads')
          .remove(filesToDelete);
        if (storageErr) reportError({ type: 'upload', component: 'ClientMissingInvoicesPage', action: 'storageDelete', message: storageErr.message, error: storageErr });
      }

      // Reset status and clear uploaded_files
      const { error } = await supabase
        .from('accounty_missing_items' as any)
        .update({
          status: 'open',
          resolved_at: null,
          resolved_by: null,
          uploaded_files: [],
        } as any)
        .eq('id', idToUnresolve);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['accounty-missing-items'] });
      toast({ title: 'Eltávolítva', description: 'A feltöltött fájl(ok) törölve, a tétel visszaállt "Bekérésre vár" státuszra.' });
    } catch (err) {
      reportError({ type: 'db_query', component: 'ClientMissingInvoicesPage', action: 'unresolve', message: 'Unresolve failed', error: err as Error });
      toast({ variant: 'destructive', title: 'Hiba', description: 'Nem sikerült eltávolítani.' });
    }
  };

  const [showHistoryView, setShowHistoryView] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyChannelFilter, setHistoryChannelFilter] = useState('Minden');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('Minden');
  const [historyTab, setHistoryTab] = useState<'timeline' | 'table'>('timeline');

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Sürgős':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">Sürgős</span>;
      case 'Közepes':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800">Közepes</span>;
      case 'Alacsony':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-border">Alacsony</span>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string, variant: string) => {
    if (variant === 'success') {
      return <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/40 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-800 whitespace-nowrap">{status}</span>;
    }
    if (variant === 'warning') {
      return <span className="text-xs font-semibold text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 px-2.5 py-1 rounded-full border border-amber-100/50 dark:border-amber-800 whitespace-nowrap">{status}</span>;
    }
    return <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-full border border-border whitespace-nowrap">{status}</span>;
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

  const handleSelectItem = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const isAllSelected = filteredInvoices.length > 0 && selectedIds.length === filteredInvoices.length;

  // History data placeholder - communication feature out of scope
  const filteredHistory: { id: number; date: string; channel: string; vendor: string; responseTime: string; status: string; statusColor: string; icon: any; iconColor: string }[] = [];

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
              {/* Vertical line connecting timeline items */}
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
            className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm font-medium shadow-soft"
          >
            <History className="w-4 h-4" />
            Előzmények
          </button>
          
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-card/80 dark:hover:bg-primary/90 transition-colors text-sm font-medium shadow-soft">
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
                  <input type="text" value={newInvoiceForm.vendor} onChange={e => setNewInvoiceForm({...newInvoiceForm, vendor: e.target.value})} placeholder="pl. Telekom Magyarország" className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Típus/Leírás</label>
                  <input type="text" value={newInvoiceForm.subtext} onChange={e => setNewInvoiceForm({...newInvoiceForm, subtext: e.target.value})} placeholder="pl. Telefon számla" className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Becsült összeg</label>
                    <input type="text" value={newInvoiceForm.amount} onChange={e => setNewInvoiceForm({...newInvoiceForm, amount: e.target.value})} className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Időszak</label>
                    <input type="text" value={newInvoiceForm.period} onChange={e => setNewInvoiceForm({...newInvoiceForm, period: e.target.value})} className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Prioritás</label>
                  <select value={newInvoiceForm.priority} onChange={e => setNewInvoiceForm({...newInvoiceForm, priority: e.target.value})} className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer">
                    <option value="Sürgős">Sürgős</option>
                    <option value="Magas">Magas</option>
                    <option value="Közepes">Közepes</option>
                    <option value="Alacsony">Alacsony</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Megjegyzés</label>
                  <textarea value={newInvoiceForm.note} onChange={e => setNewInvoiceForm({...newInvoiceForm, note: e.target.value})} placeholder="További információk..." className="w-full px-3 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[100px] resize-none" />
                </div>
              </div>
              <DialogFooter>
                <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 bg-card border border-border text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm font-medium">Mégse</button>
                <button onClick={handleAddInvoice} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-card/80 dark:hover:bg-primary/90 transition-colors text-sm font-medium">Hozzáadás</button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Cards – server-side counts, no need to load all rows */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-xl border border-border shadow-soft flex flex-col justify-between">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Összes hiányzó</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">{missingCounts?.total?.toLocaleString('hu-HU') ?? '–'}</h3>
        </div>
        
        <div className="bg-red-50/50 dark:bg-red-900/20 p-5 rounded-xl border-2 border-red-200 dark:border-red-900/50 shadow-soft flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
          <p className="text-sm font-bold text-red-600 mb-2">Sürgős</p>
          <h3 className="text-3xl font-black text-red-600">{missingCounts?.urgent?.toLocaleString('hu-HU') ?? '0'}</h3>
        </div>
        
        <div className="bg-card p-5 rounded-xl border border-border shadow-soft flex flex-col justify-between">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">NAV-ból</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">{missingCounts?.nav?.toLocaleString('hu-HU') ?? '–'}</h3>
        </div>
        
        <div className="bg-card p-5 rounded-xl border border-border shadow-soft flex flex-col justify-between">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Becsült összeg</p>
          <h3 className="text-3xl font-black text-slate-900 dark:text-slate-100">
            {missingCounts?.totalAmount != null ? new Intl.NumberFormat('hu-HU').format(missingCounts.totalAmount) + ' Ft' : '–'}
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
            className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-soft"
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-soft cursor-pointer min-w-[140px]"
          >
            <option value="Minden forrás">Minden forrás</option>
            <option value="NAV">NAV</option>
            <option value="Bank">Bank</option>
            <option value="Bér">Bér</option>
            <option value="Kézi">Kézi</option>
          </select>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-soft cursor-pointer min-w-[120px]"
          >
            <option value="Minden">Minden</option>
            <option value="Sürgős">Sürgős</option>
            <option value="Bekérésre vár">Bekérésre vár</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div ref={tableRef} className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border dark:bg-slate-900/50">
                <th className="py-4 px-4 w-12">
                  <input 
                    type="checkbox" 
                    checked={isAllSelected}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer" 
                  />
                </th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Szállító</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Időszak</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Becsült összeg</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Forrás</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Prioritás</th>
                <th className="py-4 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[130px]">Státusz</th>
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
                        className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer" 
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
                          <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all outline-none">
                            <MoreVertical className="w-5 h-5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                          <DropdownMenuItem 
                            className="gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 py-2"
                            onClick={() => setSelectedInvoiceForDetails(invoice)}
                          >
                            <Eye className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                            <span className="font-medium text-sm">Részletek</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                          {invoice.statusVariant === 'success' ? (
                            <DropdownMenuItem 
                              className="gap-2.5 cursor-pointer text-red-500 dark:text-red-400 py-2"
                              onClick={() => handleUnresolveInvoice(invoice.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                              <span className="font-medium text-sm">Feltöltött file eltávolítása</span>
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem 
                              className="gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 py-2"
                              onClick={() => handleResolveInvoice(invoice.id)}
                            >
                              <CheckCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                              <span className="font-medium text-sm">Megérkezettnek jelöl</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            className="gap-2.5 cursor-pointer text-slate-700 dark:text-slate-300 py-2"
                            onClick={() => handleDeleteInvoice(invoice.id)}
                          >
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

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} / {totalCount.toLocaleString('hu-HU')} tétel
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setCurrentPage(p => Math.max(0, p - 1)); setSelectedIds([]); setTimeout(() => document.getElementById('accounty-main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }), 50); }}
                disabled={currentPage === 0}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-card hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Előző
              </button>
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 px-2">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => { setCurrentPage(p => Math.min(totalPages - 1, p + 1)); setSelectedIds([]); setTimeout(() => document.getElementById('accounty-main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }), 50); }}
                disabled={currentPage >= totalPages - 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-card hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Következő →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick History Section */}
      <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Felszólítás előzmények</h2>
        </div>
        <div className="p-6 space-y-0 relative">
          <div className="absolute top-8 bottom-8 left-[43px] w-[2px] bg-slate-100 dark:bg-slate-800 z-0"></div>
          
          {[
            { id: 1, title: 'Felszólítás küldve', date: '2024-01-14 10:30', icon: Mail, status: 'Elküldve', color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 border-blue-200 dark:border-blue-800', iconColor: 'text-slate-400' },
            { id: 2, title: 'Üzenet kézbesítve', date: '2024-01-12 14:15', icon: MessageSquare, status: 'Kézbesítve', color: 'text-primary dark:text-primary bg-accent-subtle dark:bg-accent border-accent dark:border-accent', iconColor: 'text-slate-400' },
            { id: 3, title: 'Email megnyitva', date: '2024-01-10 09:00', icon: Mail, status: 'Megnyitva', color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/40 border-amber-200 dark:border-amber-800', iconColor: 'text-slate-400' }
          ].map((item) => (
            <div key={item.id} className="relative z-10 flex items-center justify-between p-4 group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-xl -ml-2 -mr-2">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shadow-soft">
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
            <button 
              onClick={() => {
                const selectedItems = invoices.filter(inv => selectedIds.includes(inv.id));
                handleSendToApprovalQueue(selectedItems);
                setSelectedIds([]);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-card/80 dark:hover:bg-primary/90 transition-colors text-sm font-medium shadow-soft"
            >
              <Send className="w-4 h-4" />
              Felszólítás küldése
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-card border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm font-medium shadow-soft">
              <CheckCircle className="w-4 h-4" />
              Megérkezett
            </button>
            <button 
              onClick={handleBulkDelete}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm font-medium shadow-soft"
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
              <div className="px-6 py-4 flex items-center justify-between border-b border-border">
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
                  <span className="inline-block px-2.5 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-border rounded-md text-xs font-medium">
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
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedInvoiceForDetails.createdAt ? new Date(selectedInvoiceForDetails.createdAt).toLocaleDateString('hu-HU') : '-'}</p>
                </div>
              </div>

              <div className="px-6 py-5 border-t border-border">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">NAV adatok</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">NAV számla azonosító</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedInvoiceForDetails.navInvoiceId || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Számla szám</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedInvoiceForDetails.invoiceNumber || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 border-t border-border">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">Bekérési előzmények</h3>
                {selectedInvoiceForDetails.notificationCount > 0 ? (
                  <div className="space-y-3">
                    {selectedInvoiceForDetails.lastNotifiedAt && (
                      <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl shadow-soft">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 border border-border">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {new Date(selectedInvoiceForDetails.lastNotifiedAt).toLocaleString('hu-HU')}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Email – {selectedInvoiceForDetails.notificationCount}. bekérés</p>
                          </div>
                        </div>
                        <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                          Elküldve
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">Még nem lett bekérve.</p>
                )}
              </div>

              {/* Uploaded files section */}
              {selectedInvoiceForDetails.uploadedFiles.length > 0 && (
                <div className="px-6 py-5 border-t border-border">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">Feltöltött dokumentumok</h3>
                  <div className="space-y-2">
                    {selectedInvoiceForDetails.uploadedFiles.map((filePath, idx) => {
                      const fileName = filePath.split('/').pop() || filePath;
                      const displayName = fileName.replace(/^\d+_/, '');
                      return (
                        <div key={idx} className="flex items-center justify-between p-3 bg-card border border-border rounded-xl shadow-soft">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-green-50 dark:bg-green-900/30 rounded-lg text-green-600 border border-green-100 dark:border-green-800">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{displayName}</p>
                              <p className="text-[10px] text-slate-400">Portálon keresztül feltöltve</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`https://vxxgvdlqvvchtlmqnrqf.supabase.co/storage/v1/object/public/accounty_uploads/${filePath}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-semibold rounded-full hover:bg-primary/20 transition-colors"
                            >
                              Megnyitás
                            </a>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm('Biztosan törölni szeretnéd ezt a fájlt?')) return;
                                try {
                                  // Remove from storage
                                  await supabase.storage.from('accounty_uploads').remove([filePath]);
                                  // Remove from DB array
                                  const newFiles = selectedInvoiceForDetails.uploadedFiles.filter((_, i) => i !== idx);
                                  await supabase.from('accounty_missing_items' as any)
                                    .update({
                                      uploaded_files: newFiles,
                                      ...(newFiles.length === 0 ? { status: 'open', resolved_at: null, resolved_by: null } : {}),
                                    } as any)
                                    .eq('id', selectedInvoiceForDetails.id);
                                  queryClient.invalidateQueries({ queryKey: ['accounty-missing-items'] });
                                  setSelectedInvoiceForDetails({ ...selectedInvoiceForDetails, uploadedFiles: newFiles });
                                  toast({ title: 'Fájl törölve' });
                                } catch (err) {
                                  reportError({ type: 'upload', component: 'ClientMissingInvoicesPage', action: 'fileDelete', message: 'File delete error', error: err as Error });
                                  toast({ variant: 'destructive', title: 'Törlés sikertelen' });
                                }
                              }}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                              title="Fájl törlése"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/80 border-t border-border flex items-center justify-between">
                <button 
                  className="px-4 py-2.5 bg-card border border-border text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors shadow-soft"
                  onClick={() => setSelectedInvoiceForDetails(null)}
                >
                  Téves azonosítás
                </button>
                <div className="flex items-center gap-3">
                  <button 
                    className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors shadow-soft"
                    onClick={() => setSelectedInvoiceForDetails(null)}
                  >
                    <CheckCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                    Megérkezett a számla
                  </button>
                  <button 
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-soft"
                    onClick={() => {
                      if (selectedInvoiceForDetails) {
                        handleSendToApprovalQueue([selectedInvoiceForDetails]);
                      }
                      setSelectedInvoiceForDetails(null);
                    }}
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
