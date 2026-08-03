import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, MoreVertical, FileText, Settings, Search, ChevronRight, Mail, Phone, CheckCircle2, X, CheckCircle, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAccountyCompanySummary } from '@/hooks/accounty';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';
import { UnifiedPagination } from '@/components/ui/unified-pagination';

function AnimatedNumber({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) { setDisplay(0); return; }
    let start = 0;
    const step = Math.max(1, Math.ceil(value / (duration / 16)));
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <>{display.toLocaleString('hu-HU')}</>;
}

type KpiModalType = 'all' | 'critical' | 'sent' | 'response' | null;

export default function MissingInvoicesPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [kpiModal, setKpiModal] = useState<KpiModalType>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const { data: companySummary, isLoading, isError, refetch } = useAccountyCompanySummary();

  // Transform RPC data to table format
  const data = useMemo(() => {
    if (!companySummary || companySummary.length === 0) return [];
    return companySummary.map(cs => {
      let status = 'Nincs felszólítva';
      let statusType = 'neutral';
      let lastNotice = '-';

      if (cs.totalNotified > 0) {
        status = cs.maxNotificationCount >= 3 ? 'Kritikus' : 'Felszólítva';
        statusType = cs.maxNotificationCount >= 3 ? 'danger' : 'warning';
        if (cs.lastNotifiedAt) {
          lastNotice = new Date(cs.lastNotifiedAt).toLocaleDateString('hu-HU');
        }
      }

      return {
        id: cs.companyId,
        name: cs.companyName,
        missing: cs.missingCount,
        critical: cs.criticalCount,
        lastNotice,
        status,
        statusType,
      };
    });
  }, [companySummary]);

  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState<any>(null);

  const totalMissing = data.reduce((sum, item) => sum + item.missing, 0);
  const totalCritical = data.reduce((sum, item) => sum + item.critical, 0);
  const totalNotified = useMemo(() => {
    if (!companySummary) return 0;
    return companySummary.reduce((sum, cs) => sum + cs.totalNotified, 0);
  }, [companySummary]);
  const responseRate = 0; // Will be calculated when notification tracking is implemented

  const filteredData = useMemo(() => {
    return data.filter(row => {
      const matchesSearch = row.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || row.statusType === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [searchQuery, statusFilter, data]);

  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // Modal data based on type — uses real company data
  const modalData = useMemo(() => {
    if (!kpiModal) return { title: '', items: [] as typeof data };
    switch (kpiModal) {
      case 'all':
        return { title: `Összes hiányzó számla (${totalMissing})`, items: data.filter(r => r.missing > 0) };
      case 'critical':
        return { title: `Kritikus számlák (${totalCritical})`, items: data.filter(r => r.critical > 0) };
      case 'sent':
        return { title: `Felszólított ügyfelek (${totalNotified})`, items: data.filter(r => r.status === 'Felszólítva' || r.status === 'Kritikus') };
      case 'response':
        return { title: `Válaszra váró ügyfelek`, items: data.filter(r => r.status === 'Nincs felszólítva' && r.missing > 0) };
    }
  }, [kpiModal, totalMissing, totalCritical, totalNotified, data]);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'S\u00FCrg\u0151s':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">S&#252;rg&#337;s</span>;
      case 'K\u00F6zepes':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800">K&#246;zepes</span>;
      case 'Alacsony':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-border">Alacsony</span>;
      default:
        return null;
    }
  };

  const handleInvoiceClick = (invoice: any) => {
    setSelectedInvoiceForDetails(invoice);
  };

  if (isError) {
    return <AccountyErrorState message="Nem sikerült betölteni a hiányzó számlák listáját." onRetry={() => refetch()} />;
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-6 animate-in fade-in duration-300">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[0,1,2,3].map(i => (
            <div key={i} className="bg-card rounded-xl border border-border p-5 h-28 animate-pulse">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded mb-6" />
              <div className="h-7 w-12 bg-slate-200 dark:bg-slate-800 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-card rounded-xl border border-border overflow-hidden animate-pulse">
          <div className="h-12 bg-slate-50 dark:bg-slate-900/50 border-b border-border" />
          {[0,1,2,3,4].map(i => (
            <div key={i} className="h-16 border-b border-slate-100 dark:border-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-500">
       {/* Header */}
       <div className="flex justify-between items-start">
         <div>
           <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Hi&#225;nyz&#243; sz&#225;ml&#225;k</h1>
           <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Hi&#225;nyz&#243; sz&#225;ml&#225;k bek&#233;r&#233;se</p>
         </div>
         <div className="flex gap-3">
           <Button 
             variant="outline" 
             size="sm" 
             className="gap-2 bg-card border-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 h-9 px-4"
             onClick={() => navigate('/accounty/reports/missing-invoices')}
           >
             <FileText className="w-4 h-4"/> Riportok
           </Button>
           <Button variant="outline" size="sm" className="gap-2 bg-card border-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 h-9 px-4">
             <Settings className="w-4 h-4"/> Be&#225;ll&#237;t&#225;sok
           </Button>
         </div>
       </div>

       {totalCritical > 0 && (
       <div className="border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/20 rounded-xl p-4 flex gap-3 text-red-600 dark:text-red-400 shadow-soft">
         <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
         <div>
           <h3 className="font-semibold text-sm">Kritikus hiányok!</h3>
           <p className="text-sm text-red-600/80 dark:text-red-400/70 mt-0.5">{totalCritical} sürgős számla vár bekérésre {data.length} ügyféltől.</p>
         </div>
       </div>
       )}

       {/* KPI Cards - CLICKABLE */}
       <div className="grid grid-cols-4 gap-4">
         <div className="stagger-1">
          <button 
            onClick={() => setKpiModal('all')}
            className="w-full bg-card rounded-xl border border-border p-5 shadow-soft flex flex-col justify-between text-left hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer card-ripple"
            onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`); e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`); }}
          >
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Összes hiányzó</h3>
            <div className="mt-4">
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100"><AnimatedNumber value={totalMissing} /></div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingDown className="w-3 h-3 text-red-500" />
                <p className="text-xs text-red-500">{data.length} ügyféltől</p>
              </div>
            </div>
          </button>
         </div>
         <div className="stagger-2">
          <button 
            onClick={() => setKpiModal('critical')}
            className="w-full bg-card rounded-xl border border-red-200 dark:border-red-900/50 p-5 shadow-soft flex flex-col justify-between text-left hover:border-red-400 dark:hover:border-red-700 hover:bg-red-50/50 dark:hover:bg-red-900/20 transition-all cursor-pointer card-ripple"
            onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`); e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`); }}
          >
            <h3 className="text-sm font-medium text-red-500">Kritikus</h3>
            <div className="mt-4">
              <div className="text-2xl font-bold text-red-600"><AnimatedNumber value={totalCritical} /></div>
              <p className="text-xs text-red-500 mt-1">Sürgős bekérés</p>
            </div>
          </button>
         </div>
         <div className="stagger-3">
          <button 
            onClick={() => setKpiModal('sent')}
            className="w-full bg-card rounded-xl border border-border p-5 shadow-soft flex flex-col justify-between text-left hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer card-ripple"
            onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`); e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`); }}
          >
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Küldött felszólítások</h3>
            <div className="mt-4">
             <div className="text-2xl font-bold text-slate-900 dark:text-slate-100"><AnimatedNumber value={totalNotified} /></div>
               <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ez a hónap</p>
            </div>
          </button>
         </div>
         <div className="stagger-4">
          <button 
            onClick={() => setKpiModal('response')}
            className="w-full bg-card rounded-xl border border-border p-5 shadow-soft flex flex-col justify-between text-left hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all cursor-pointer card-ripple"
            onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`); e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`); }}
          >
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4">Válaszadási arány</h3>
            <div>
               <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2"><AnimatedNumber value={responseRate} />%</div>
               <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                 <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${responseRate}%` }}></div>
              </div>
            </div>
          </button>
         </div>
       </div>

       {/* KPI Detail Modal */}
       {kpiModal && modalData && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           {/* Backdrop */}
           <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setKpiModal(null)} />
           
           {/* Modal */}
           <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
             {/* Header */}
             <div className="flex items-center justify-between p-5 border-b border-border">
               <h3 className="font-bold text-slate-900 dark:text-slate-100 text-lg">{modalData.title}</h3>
               <button 
                 onClick={() => setKpiModal(null)}
                 className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
               >
                 <X className="w-5 h-5 text-slate-400" />
               </button>
             </div>
             
             {/* Company list */}
             <div className="overflow-y-auto flex-1 p-2">
               {modalData.items.length > 0 ? modalData.items.map((row: any) => (
                   <button
                     key={row.id}
                     onClick={() => { setKpiModal(null); navigate(`/accounty/missing-invoices/${row.id}`); }}
                     className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group text-left"
                   >
                     <div className="flex items-center gap-3 min-w-0">
                       <div className={cn(
                         'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                         row.critical > 0 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-slate-100 dark:bg-slate-800'
                       )}>
                         <FileText className={cn('w-4 h-4', row.critical > 0 ? 'text-red-500' : 'text-slate-400')} />
                       </div>
                       <div className="min-w-0">
                         <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-primary dark:group-hover:text-primary transition-colors">{row.name}</p>
                         <div className="flex items-center gap-2 mt-0.5">
                           <span className="text-[10px] text-slate-500 dark:text-slate-400">{row.missing} hiányzó</span>
                           {row.critical > 0 && (
                             <>
                               <span className="text-[10px] text-slate-400">•</span>
                               <span className="text-[10px] text-red-500 font-semibold">{row.critical} kritikus</span>
                             </>
                           )}
                         </div>
                       </div>
                     </div>
                     <div className="flex items-center gap-3 shrink-0">
                       <span className={cn(
                         'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                         row.statusType === 'danger' ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' :
                         row.statusType === 'warning' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' :
                         'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                       )}>
                         {row.status}
                       </span>
                       <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                     </div>
                   </button>
               )) : (
                 <div className="text-center py-12 text-slate-500 dark:text-slate-400">Nincs adat</div>
               )}
             </div>
             
             {/* Footer */}
             <div className="p-4 border-t border-border flex justify-end">
               <button 
                 onClick={() => setKpiModal(null)}
                 className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
               >
                 Bez&#225;r&#225;s
               </button>
             </div>
           </div>
         </div>
       )}

       {/* Invoice Detail Dialog */}
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
                   <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sz&#225;ll&#237;t&#243; neve</p>
                   <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedInvoiceForDetails.vendor}</p>
                 </div>
                 <div>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Azonos&#237;t&#225;s m&#243;dja</p>
                   <span className="inline-block px-2.5 py-0.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-border rounded-md text-xs font-medium">
                     {selectedInvoiceForDetails.source}
                   </span>
                 </div>
                 <div>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Becs&#252;lt &#246;sszeg</p>
                   <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedInvoiceForDetails.amount}</p>
                 </div>
                 <div>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">V&#225;rhat&#243; id&#337;szak</p>
                   <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{selectedInvoiceForDetails.period}</p>
                 </div>
                 <div>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Priorit&#225;s</p>
                   {getPriorityBadge(selectedInvoiceForDetails.priority)}
                 </div>
                 <div>
                   <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Hozz&#225;adva</p>
                   <p className="text-sm font-medium text-slate-900 dark:text-slate-100">2024-01-10</p>
                 </div>
               </div>

               <div className="px-6 py-5 border-t border-border">
                 <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">NAV adatok</h3>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">NAV sz&#225;mla azonos&#237;t&#243;</p>
                     <p className="text-sm font-medium text-slate-900 dark:text-slate-100">N/A</p>
                   </div>
                   <div>
                     <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sz&#225;ll&#237;t&#243; ad&#243;sz&#225;ma</p>
                     <p className="text-sm font-medium text-slate-900 dark:text-slate-100">N/A</p>
                   </div>
                 </div>
               </div>

               <div className="px-6 py-5 border-t border-border">
                 <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">Bek&#233;r&#233;si el&#337;zm&#233;nyek</h3>
                 <div className="space-y-3">
                   <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl shadow-soft">
                     <div className="flex items-center gap-3">
                       <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 border border-border">
                         <Mail className="w-4 h-4" />
                       </div>
                       <div>
                         <p className="text-sm font-medium text-slate-900 dark:text-slate-100">2024-02-10 14:30</p>
                         <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                       </div>
                     </div>
                     <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                       Megnyitva
                     </span>
                   </div>
                   <div className="flex items-center justify-between p-3 bg-card border border-border rounded-xl shadow-soft">
                     <div className="flex items-center gap-3">
                       <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 border border-border">
                         <Mail className="w-4 h-4" />
                       </div>
                       <div>
                         <p className="text-sm font-medium text-slate-900 dark:text-slate-100">2024-02-05 09:15</p>
                         <p className="text-xs text-slate-500 dark:text-slate-400">Email</p>
                       </div>
                     </div>
                     <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-semibold rounded-full border border-border">
                       Elk&#252;ldve
                     </span>
                   </div>
                 </div>
               </div>

               <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-800/80 border-t border-border flex items-center justify-between">
                 <button 
                   className="px-4 py-2.5 bg-card border border-border text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors shadow-soft"
                   onClick={() => setSelectedInvoiceForDetails(null)}
                 >
                   T&#233;ves azonos&#237;t&#225;s
                 </button>
                 <div className="flex items-center gap-3">
                   <button 
                     className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors shadow-soft"
                     onClick={() => setSelectedInvoiceForDetails(null)}
                   >
                     <CheckCircle className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                     Meg&#233;rkezett a sz&#225;mla
                   </button>
                   <button 
                     className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors shadow-soft"
                     onClick={() => setSelectedInvoiceForDetails(null)}
                   >
                     <Mail className="w-4 h-4" />
                     Bek&#233;r&#233;s k&#252;ld&#233;se
                   </button>
                 </div>
               </div>
             </>
           )}
         </DialogContent>
       </Dialog>

       {/* Toolbar */}
       <div className="flex justify-between items-center py-2">
         <div className="w-72 relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
           <Input 
             placeholder={"Keres\u00E9s \u00FCgyf\u00E9l..."} 
             className="pl-9 bg-card border-border" 
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
         </div>
         <div className="w-48">
           <Select value={statusFilter} onValueChange={setStatusFilter}>
             <SelectTrigger className="bg-card border-border">
               <SelectValue placeholder={"Minden st\u00E1tusz"} />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">Minden st&#225;tusz</SelectItem>
               <SelectItem value="critical">Kritikus</SelectItem>
               <SelectItem value="warning">Felsz&#243;l&#237;tva</SelectItem>
               <SelectItem value="neutral">Nincs felsz&#243;l&#237;tva</SelectItem>
             </SelectContent>
           </Select>
         </div>
       </div>

       {/* Table */}
       <div className="bg-card border border-border rounded-xl shadow-soft overflow-hidden">
         <table className="w-full text-sm text-left">
           <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-border text-slate-500 dark:text-slate-400 font-medium text-xs uppercase tracking-wider">
             <tr>
               <th className="px-6 py-4 w-12 text-center"><input type="checkbox" className="rounded border-slate-300 w-4 h-4 accent-slate-900" /></th>
               <th className="px-6 py-4">&#220;gyf&#233;l</th>
               <th className="px-6 py-4 text-center">Hi&#225;nyz&#243;</th>
               <th className="px-6 py-4 text-center">Kritikus</th>
               <th className="px-6 py-4">Utols&#243; felsz&#243;l&#237;t&#225;s</th>
               <th className="px-6 py-4">St&#225;tusz</th>
               <th className="px-6 py-4 w-12 text-center"></th>
             </tr>
           </thead>
           <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
             {filteredData.length > 0 ? (
               paginatedData.map((row) => (
               <tr 
                 key={row.id} 
                 onClick={() => navigate(`/accounty/missing-invoices/${row.id}`)}
                 className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer"
               >
                 <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}><input type="checkbox" className="rounded border-slate-300 w-4 h-4 accent-slate-900" /></td>
                 <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100 hover:text-primary transition-colors">{row.name}</td>
                 <td className="px-6 py-4 text-center">
                   <span className="w-7 h-7 rounded-full border border-border bg-card shadow-soft flex items-center justify-center mx-auto text-xs font-semibold text-slate-700 dark:text-slate-300">{row.missing}</span>
                 </td>
                 <td className="px-6 py-4 text-center">
                   {row.critical > 0 ? (
                     <span className="w-7 h-7 rounded-full bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto text-xs font-semibold">{row.critical}</span>
                   ) : <span className="text-slate-300">-</span>}
                 </td>
                 <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                   {row.lastNotice !== '-' ? (
                     <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {row.lastNotice}</div>
                   ) : '-'}
                 </td>
                 <td className="px-6 py-4">
                   <span className={cn(
                     "px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider",
                     row.statusType === 'danger' && "bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400",
                     row.statusType === 'warning' && "bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400",
                     row.statusType === 'neutral' && "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                   )}>
                     {row.status}
                   </span>
                 </td>
                 <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                   <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                       <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 p-1 transition-colors">
                         <MoreVertical className="w-4 h-4" />
                       </button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end" className="w-48">
                       <DropdownMenuItem onClick={() => navigate(`/accounty/missing-invoices/${row.id}`)} className="cursor-pointer">
                         <ChevronRight className="w-4 h-4 mr-2" />
                         R&#233;szletek
                       </DropdownMenuItem>
                       <DropdownMenuItem className="cursor-pointer">
                         <Mail className="w-4 h-4 mr-2" />
                         Email k&#252;ld&#233;s
                       </DropdownMenuItem>
                       <DropdownMenuItem className="cursor-pointer">
                         <Phone className="w-4 h-4 mr-2" />
                         AI telefonh&#237;v&#225;s
                       </DropdownMenuItem>
                       <DropdownMenuItem className="cursor-pointer text-primary focus:text-primary focus:bg-accent-subtle">
                         <CheckCircle2 className="w-4 h-4 mr-2" />
                         Meg&#233;rkezettnek jel&#246;l
                       </DropdownMenuItem>
                     </DropdownMenuContent>
                   </DropdownMenu>
                 </td>
               </tr>
             ))
           ) : (
             <tr>
               <td colSpan={7} className="text-center py-12 text-slate-500 dark:text-slate-400">
                 Nincs tal&#225;lat a keres&#233;sre.
               </td>
             </tr>
           )}
           </tbody>
         </table>
       </div>
       {totalPages > 1 && (
         <div className="border-t border-border px-6 py-4 bg-card">
           <UnifiedPagination
             currentPage={currentPage}
             totalPages={totalPages}
             totalItems={totalItems}
             pageSize={pageSize}
             onPageChange={setCurrentPage}
             onPageSizeChange={setPageSize}
             pageSizeOptions={[25, 50, 100]}
           />
         </div>
       )}
    </div>
  );
}
