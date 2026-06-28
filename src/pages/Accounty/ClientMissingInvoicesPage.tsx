import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Plus } from 'lucide-react';
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
import HistoryView from './missing-invoices/HistoryView';
import InvoiceDetailModal, { type InvoiceItem } from './missing-invoices/InvoiceDetailModal';
import { MissingInvoicesTimeline } from './missing-invoices/MissingInvoicesTimeline';
import { MissingInvoicesBulkBar } from './missing-invoices/MissingInvoicesBulkBar';
import { AddMissingInvoiceModal } from './missing-invoices/AddMissingInvoiceModal';
import { MissingInvoicesKpiCards } from './missing-invoices/MissingInvoicesKpiCards';
import { MissingInvoicesFilterBar } from './missing-invoices/MissingInvoicesFilterBar';
import { MissingInvoicesTable } from './missing-invoices/MissingInvoicesTable';


// InvoiceItem type is imported from ./missing-invoices/InvoiceDetailModal


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
        .from('accounty_missing_items')
        .update({
          status: 'open',
          resolved_at: null,
          resolved_by: null,
          uploaded_files: [],
        })
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


  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedIds([]);
    setTimeout(() => document.getElementById('accounty-main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }), 50);
  };


  if (showHistoryView) {
    return (
      <HistoryView
        clientName={clientName}
        onBack={() => setShowHistoryView(false)}
        historySearchTerm={historySearchTerm}
        setHistorySearchTerm={setHistorySearchTerm}
        historyChannelFilter={historyChannelFilter}
        setHistoryChannelFilter={setHistoryChannelFilter}
        historyStatusFilter={historyStatusFilter}
        setHistoryStatusFilter={setHistoryStatusFilter}
        historyTab={historyTab}
        setHistoryTab={setHistoryTab}
      />
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
          
          <AddMissingInvoiceModal open={isAddModalOpen} onOpenChange={setIsAddModalOpen} form={newInvoiceForm} onFormChange={setNewInvoiceForm} onSubmit={handleAddInvoice} />
        </div>
      </div>


      {/* KPI Cards */}
      <MissingInvoicesKpiCards missingCounts={missingCounts} />


      {/* Filter Bar */}
      <MissingInvoicesFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sourceFilter={sourceFilter}
        onSourceFilterChange={setSourceFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />


      {/* Table */}
      <MissingInvoicesTable
        filteredInvoices={filteredInvoices}
        selectedIds={selectedIds}
        isAllSelected={isAllSelected}
        onSelectAll={handleSelectAll}
        onSelectItem={handleSelectItem}
        onViewDetails={setSelectedInvoiceForDetails}
        onResolve={handleResolveInvoice}
        onUnresolve={handleUnresolveInvoice}
        onDelete={handleDeleteInvoice}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
      />


      <MissingInvoicesTimeline />

      {/* Floating Action Bar */}
      <MissingInvoicesBulkBar selectedIds={selectedIds} invoices={invoices} onSendToApprovalQueue={handleSendToApprovalQueue} onBulkDelete={handleBulkDelete} onClearSelection={() => setSelectedIds([])} />

      {/* Invoice Details Modal */}
      <InvoiceDetailModal
        invoice={selectedInvoiceForDetails}
        onClose={() => setSelectedInvoiceForDetails(null)}
        onSendToApprovalQueue={handleSendToApprovalQueue}
      />


    </div>
  );
}
