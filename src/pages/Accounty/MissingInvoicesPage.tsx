import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock, MoreVertical, FileText, Settings, Search, ChevronRight, Mail, Phone, CheckCircle2, X, CheckCircle, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAccountyCompanySummary } from '@/hooks/accounty';
import { AccountyErrorState } from '@/components/accounty/AccountyErrorState';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { PageHeader } from '@/components/ui/page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { FloatingBulkBar } from '@/components/ui/floating-bulk-bar';
import { useToast } from '@/hooks/use-toast';

function AnimatedNumber({ value, duration = 1200, locale = 'hu-HU' }: { value: number; duration?: number; locale?: string }) {
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
  return <>{display.toLocaleString(locale)}</>;
}

type KpiModalType = 'all' | 'critical' | 'sent' | 'response' | null;

export default function MissingInvoicesPage() {
  const { t, i18n } = useTranslation('accounty');
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = location.pathname.startsWith('/hr') ? '/hr' : '';
  const currentLocale = i18n.language === 'hr' ? 'hr-HR' : 'hu-HU';

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
      let status = t('missing_invoices.status_not_notified', 'Nincs felszólítva');
      let statusType = 'neutral';
      let lastNotice = '-';

      if (cs.totalNotified > 0) {
        status = cs.maxNotificationCount >= 3 
          ? t('missing_invoices.status_critical', 'Kritikus') 
          : t('missing_invoices.status_notified', 'Felszólítva');
        statusType = cs.maxNotificationCount >= 3 ? 'danger' : 'warning';
        if (cs.lastNotifiedAt) {
          lastNotice = new Date(cs.lastNotifiedAt).toLocaleDateString(currentLocale);
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
  }, [companySummary, t, currentLocale]);

  const [selectedInvoiceForDetails, setSelectedInvoiceForDetails] = useState<any>(null);
  const { toast } = useToast();
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());

  const toggleSelectClient = (id: string) => {
    setSelectedClientIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllClients = () => {
    if (selectedClientIds.size === paginatedData.length && paginatedData.length > 0) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(paginatedData.map(d => d.id)));
    }
  };

  useEffect(() => {
    setSelectedClientIds(new Set());
  }, [searchQuery, statusFilter, currentPage]);

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
        return { title: t('missing_invoices.modal_all_title', 'Összes hiányzó számla ({{count}})', { count: totalMissing }), items: data.filter(r => r.missing > 0) };
      case 'critical':
        return { title: t('missing_invoices.modal_critical_title', 'Kritikus számlák ({{count}})', { count: totalCritical }), items: data.filter(r => r.critical > 0) };
      case 'sent':
        return { title: t('missing_invoices.modal_sent_title', 'Felszólított ügyfelek ({{count}})', { count: totalNotified }), items: data.filter(r => r.status === 'Felszólítva' || r.status === 'Kritikus') };
      case 'response':
        return { title: t('missing_invoices.modal_response_title', 'Válaszra váró ügyfelek'), items: data.filter(r => r.status === 'Nincs felszólítva' && r.missing > 0) };
    }
  }, [kpiModal, totalMissing, totalCritical, totalNotified, data, t]);

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Sürgős':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800">{t('missing_invoices.status_critical', 'Sürgős')}</span>;
      case 'Közepes':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800">Közepes</span>;
      case 'Alacsony':
        return <span className="px-2 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground border border-border">Alacsony</span>;
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
      <div className="w-full space-y-6 page-animate">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[0,1,2,3].map(i => (
            <div key={i} className="bg-card rounded-lg border border-border p-5 h-28 animate-pulse">
              <div className="h-4 w-24 bg-muted rounded mb-6" />
              <div className="h-7 w-12 bg-muted rounded" />
            </div>
          ))}
        </div>
        <div className="bg-card rounded-lg border border-border overflow-hidden animate-pulse">
          <div className="h-12 bg-background/50 border-b border-border" />
          {[0,1,2,3,4].map(i => (
            <div key={i} className="h-16 border-b border-border" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 page-animate">
      <PageHeader 
        title={t('missing_invoices.title', 'Hiányzó számlák')}
        description={t('missing_invoices.description', 'Hiányzó bizonylatok bekérése és partneri felszólítások kezelése')}
        actions={
          <>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2 bg-card border-border text-foreground hover:bg-muted/50 h-9 px-4"
              onClick={() => navigate(`${prefix}/eaisybooks/reports/missing-invoices`)}
            >
              <FileText className="w-4 h-4"/> {t('missing_invoices.reports', 'Riportok')}
            </Button>
            <Button variant="outline" size="sm" className="gap-2 bg-card border-border text-foreground hover:bg-muted/50 h-9 px-4">
              <Settings className="w-4 h-4"/> {t('missing_invoices.settings', 'Beállítások')}
            </Button>
          </>
        }
      />

       {totalCritical > 0 && (
       <div className="border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/20 rounded-lg p-4 flex gap-3 text-red-600 dark:text-red-400 shadow-soft">
         <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-red-500" />
         <div>
           <h3 className="font-semibold text-sm">{t('missing_invoices.critical_banner_title', 'Kritikus hiányok!')}</h3>
           <p className="text-sm text-red-600/80 dark:text-red-400/70 mt-0.5">{t('missing_invoices.critical_banner_desc', '{{count}} sürgős számla vár bekérésre {{clients}} ügyféltől.', { count: totalCritical, clients: data.length })}</p>
         </div>
       </div>
       )}

       {/* KPI Cards - CLICKABLE */}
       <div className="grid grid-cols-4 gap-4">
         <div className="stagger-1">
          <button 
            onClick={() => setKpiModal('all')}
            className="w-full bg-card rounded-lg border border-border p-5 shadow-soft flex flex-col justify-between text-left hover:border-muted-foreground/40 dark:hover:border-slate-600 hover:bg-muted/50 transition-all cursor-pointer card-ripple"
            onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`); e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`); }}
          >
            <h3 className="text-sm font-medium text-muted-foreground">{t('missing_invoices.kpi_all', 'Összes hiányzó')}</h3>
            <div className="mt-4">
              <div className="text-2xl font-bold text-foreground"><AnimatedNumber value={totalMissing} locale={currentLocale} /></div>
              <div className="flex items-center gap-1 mt-1">
                <TrendingDown className="w-3 h-3 text-red-500" />
                <p className="text-xs text-red-500">{t('missing_invoices.kpi_clients_count', '{{count}} ügyféltől', { count: data.length })}</p>
              </div>
            </div>
          </button>
         </div>
         <div className="stagger-2">
          <button 
            onClick={() => setKpiModal('critical')}
            className="w-full bg-card rounded-lg border border-red-200 dark:border-red-900/50 p-5 shadow-soft flex flex-col justify-between text-left hover:border-red-400 dark:hover:border-red-700 hover:bg-red-50/50 dark:hover:bg-red-900/20 transition-all cursor-pointer card-ripple"
            onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`); e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`); }}
          >
            <h3 className="text-sm font-medium text-red-500">{t('missing_invoices.kpi_critical', 'Kritikus')}</h3>
            <div className="mt-4">
              <div className="text-2xl font-bold text-red-600"><AnimatedNumber value={totalCritical} locale={currentLocale} /></div>
              <p className="text-xs text-red-500 mt-1">{t('missing_invoices.kpi_urgent_request', 'Sürgős bekérés')}</p>
            </div>
          </button>
         </div>
         <div className="stagger-3">
          <button 
            onClick={() => setKpiModal('sent')}
            className="w-full bg-card rounded-lg border border-border p-5 shadow-soft flex flex-col justify-between text-left hover:border-muted-foreground/40 dark:hover:border-slate-600 hover:bg-muted/50 transition-all cursor-pointer card-ripple"
            onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`); e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`); }}
          >
            <h3 className="text-sm font-medium text-muted-foreground">{t('missing_invoices.kpi_sent_notices', 'Küldött felszólítások')}</h3>
            <div className="mt-4">
             <div className="text-2xl font-bold text-foreground"><AnimatedNumber value={totalNotified} locale={currentLocale} /></div>
               <p className="text-xs text-muted-foreground mt-1">{t('missing_invoices.kpi_this_month', 'ez a hónap')}</p>
            </div>
          </button>
         </div>
         <div className="stagger-4">
          <button 
            onClick={() => setKpiModal('response')}
            className="w-full bg-card rounded-lg border border-border p-5 shadow-soft flex flex-col justify-between text-left hover:border-muted-foreground/40 dark:hover:border-slate-600 hover:bg-muted/50 transition-all cursor-pointer card-ripple"
            onMouseMove={(e) => { const rect = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty('--ripple-x', `${((e.clientX - rect.left) / rect.width) * 100}%`); e.currentTarget.style.setProperty('--ripple-y', `${((e.clientY - rect.top) / rect.height) * 100}%`); }}
          >
            <h3 className="text-sm font-medium text-muted-foreground mb-4">{t('missing_invoices.kpi_response_rate', 'Válaszadási arány')}</h3>
            <div>
               <div className="text-2xl font-bold text-foreground mb-2"><AnimatedNumber value={responseRate} locale={currentLocale} />%</div>
               <div className="h-1.5 bg-muted rounded-full overflow-hidden">
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
           <div className="relative bg-card rounded-lg border border-border shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
             {/* Header */}
             <div className="flex items-center justify-between p-5 border-b border-border">
               <h3 className="font-bold text-foreground text-lg">{modalData.title}</h3>
               <button 
                 onClick={() => setKpiModal(null)}
                 className="p-1.5 hover:bg-muted rounded-lg transition-colors"
               >
                 <X className="w-5 h-5 text-muted-foreground" />
               </button>
             </div>
             
             {/* Company list */}
             <div className="overflow-y-auto flex-1 p-2">
               {modalData.items.length > 0 ? modalData.items.map((row: any) => (
                   <button
                     key={row.id}
                     onClick={() => { setKpiModal(null); navigate(`${prefix}/eaisybooks/missing-invoices/${row.id}`); }}
                     className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group text-left"
                   >
                     <div className="flex items-center gap-3 min-w-0">
                       <div className={cn(
                         'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                         row.critical > 0 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-muted'
                       )}>
                         <FileText className={cn('w-4 h-4', row.critical > 0 ? 'text-red-500' : 'text-muted-foreground')} />
                       </div>
                       <div className="min-w-0">
                         <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary dark:group-hover:text-primary transition-colors">{row.name}</p>
                         <div className="flex items-center gap-2 mt-0.5">
                           <span className="text-[10px] text-muted-foreground">{t('missing_invoices.items_missing', '{{count}} hiányzó', { count: row.missing })}</span>
                           {row.critical > 0 && (
                             <>
                               <span className="text-[10px] text-muted-foreground">•</span>
                               <span className="text-[10px] text-red-500 font-semibold">{t('missing_invoices.items_critical', '{{count}} kritikus', { count: row.critical })}</span>
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
                         'bg-muted text-muted-foreground'
                       )}>
                         {row.status}
                       </span>
                       <ChevronRight className="w-4 h-4 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
                     </div>
                   </button>
               )) : (
                 <div className="text-center py-12 text-muted-foreground">{t('missing_invoices.no_data', 'Nincs adat')}</div>
               )}
             </div>
             
             {/* Footer */}
             <div className="p-4 border-t border-border flex justify-end">
               <button 
                 onClick={() => setKpiModal(null)}
                 className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-muted text-white dark:text-foreground text-sm font-semibold hover:bg-slate-800 dark:hover:bg-muted transition-colors"
               >
                 {t('missing_invoices.close', 'Bezárás')}
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
                 <DialogTitle className="text-xl font-bold text-foreground">{selectedInvoiceForDetails.subtext}</DialogTitle>
                 <span className="px-3 py-1 bg-muted text-foreground/90 text-xs font-semibold rounded-full mr-6">
                   {selectedInvoiceForDetails.status}
                 </span>
               </div>
               
               <div className="px-6 py-5 grid grid-cols-2 gap-y-6 gap-x-4">
                 <div>
                   <p className="text-xs text-muted-foreground mb-1">Sz&#225;ll&#237;t&#243; neve</p>
                   <p className="text-sm font-medium text-foreground">{selectedInvoiceForDetails.vendor}</p>
                 </div>
                 <div>
                   <p className="text-xs text-muted-foreground mb-1">Azonos&#237;t&#225;s m&#243;dja</p>
                   <span className="inline-block px-2.5 py-0.5 bg-muted text-muted-foreground border border-border rounded-md text-xs font-medium">
                     {selectedInvoiceForDetails.source}
                   </span>
                 </div>
                 <div>
                   <p className="text-xs text-muted-foreground mb-1">Becs&#252;lt &#246;sszeg</p>
                   <p className="text-sm font-medium text-foreground">{selectedInvoiceForDetails.amount}</p>
                 </div>
                 <div>
                   <p className="text-xs text-muted-foreground mb-1">V&#225;rhat&#243; id&#337;szak</p>
                   <p className="text-sm font-medium text-foreground">{selectedInvoiceForDetails.period}</p>
                 </div>
                 <div>
                   <p className="text-xs text-muted-foreground mb-1">Priorit&#225;s</p>
                   {getPriorityBadge(selectedInvoiceForDetails.priority)}
                 </div>
                 <div>
                   <p className="text-xs text-muted-foreground mb-1">Hozz&#225;adva</p>
                   <p className="text-sm font-medium text-foreground">2024-01-10</p>
                 </div>
               </div>

               <div className="px-6 py-5 border-t border-border">
                 <h3 className="text-sm font-bold text-foreground mb-4">NAV adatok</h3>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <p className="text-xs text-muted-foreground mb-1">NAV sz&#225;mla azonos&#237;t&#243;</p>
                     <p className="text-sm font-medium text-foreground">N/A</p>
                   </div>
                   <div>
                     <p className="text-xs text-muted-foreground mb-1">Sz&#225;ll&#237;t&#243; ad&#243;sz&#225;ma</p>
                     <p className="text-sm font-medium text-foreground">N/A</p>
                   </div>
                 </div>
               </div>

               <div className="px-6 py-5 border-t border-border">
                 <h3 className="text-sm font-bold text-foreground mb-4">Bek&#233;r&#233;si el&#337;zm&#233;nyek</h3>
                 <div className="space-y-3">
                   <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg shadow-soft">
                     <div className="flex items-center gap-3">
                       <div className="p-2 bg-muted rounded-lg text-muted-foreground border border-border">
                         <Mail className="w-4 h-4" />
                       </div>
                       <div>
                         <p className="text-sm font-medium text-foreground">2024-02-10 14:30</p>
                         <p className="text-xs text-muted-foreground">Email</p>
                       </div>
                     </div>
                     <span className="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                       Megnyitva
                     </span>
                   </div>
                   <div className="flex items-center justify-between p-3 bg-card border border-border rounded-lg shadow-soft">
                     <div className="flex items-center gap-3">
                       <div className="p-2 bg-muted rounded-lg text-muted-foreground border border-border">
                         <Mail className="w-4 h-4" />
                       </div>
                       <div>
                         <p className="text-sm font-medium text-foreground">2024-02-05 09:15</p>
                         <p className="text-xs text-muted-foreground">Email</p>
                       </div>
                     </div>
                     <span className="px-3 py-1 bg-muted text-muted-foreground text-xs font-semibold rounded-full border border-border">
                       Elk&#252;ldve
                     </span>
                   </div>
                 </div>
               </div>

               <div className="px-6 py-4 bg-muted/40/80 dark:bg-muted/80 border-t border-border flex items-center justify-between">
                 <button 
                   className="px-4 py-2.5 bg-card border border-border text-foreground/90 rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors shadow-soft"
                   onClick={() => setSelectedInvoiceForDetails(null)}
                 >
                   T&#233;ves azonos&#237;t&#225;s
                 </button>
                 <div className="flex items-center gap-3">
                   <button 
                     className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border text-foreground/90 rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors shadow-soft"
                     onClick={() => setSelectedInvoiceForDetails(null)}
                   >
                     <CheckCircle className="w-4 h-4 text-muted-foreground" />
                     Meg&#233;rkezett a sz&#225;mla
                   </button>
                   <button 
                     className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-soft"
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
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
           <Input 
             placeholder={t('missing_invoices.search_placeholder', 'Keresés ügyfél...')} 
             className="pl-9 bg-card border-border" 
             value={searchQuery}
             onChange={(e) => setSearchQuery(e.target.value)}
           />
         </div>
         <div className="w-48">
           <Select value={statusFilter} onValueChange={setStatusFilter}>
             <SelectTrigger className="bg-card border-border">
               <SelectValue placeholder={t('missing_invoices.filter_all', 'Minden státusz')} />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">{t('missing_invoices.filter_all', 'Minden státusz')}</SelectItem>
               <SelectItem value="critical">{t('missing_invoices.status_critical', 'Kritikus')}</SelectItem>
               <SelectItem value="warning">{t('missing_invoices.status_notified', 'Felszólítva')}</SelectItem>
               <SelectItem value="neutral">{t('missing_invoices.status_not_notified', 'Nincs felszólítva')}</SelectItem>
             </SelectContent>
           </Select>
         </div>
       </div>

       {/* Table */}
       <div className="bg-card border border-border rounded-lg overflow-hidden">
         <Table className="compact-table min-w-[900px]">
           <TableHeader>
             <TableRow className="bg-muted/40 border-b border-border">
               <TableHead className="px-6 py-4 w-12 text-center">
                 <Checkbox
                   checked={selectedClientIds.size === paginatedData.length && paginatedData.length > 0}
                   onCheckedChange={toggleSelectAllClients}
                 />
               </TableHead>
               <TableHead className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('missing_invoices.th_client', 'Ügyfél')}</TableHead>
               <TableHead className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('missing_invoices.th_missing', 'Hiányzó')}</TableHead>
               <TableHead className="px-6 py-4 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('missing_invoices.th_critical', 'Kritikus')}</TableHead>
               <TableHead className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('missing_invoices.th_last_notice', 'Utolsó felszólítás')}</TableHead>
               <TableHead className="px-6 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('missing_invoices.th_status', 'Státusz')}</TableHead>
               <TableHead className="px-6 py-4 w-12 text-center"></TableHead>
             </TableRow>
           </TableHeader>
           <TableBody>
             {filteredData.length > 0 ? (
               paginatedData.map((row) => (
               <TableRow 
                 key={row.id} 
                 onClick={() => navigate(`${prefix}/eaisybooks/missing-invoices/${row.id}`)}
                 className={cn(
                   "hover:bg-muted/40 transition-colors group cursor-pointer border-l-2 border-l-transparent hover:border-l-primary",
                   selectedClientIds.has(row.id) && "bg-primary/5 border-l-primary"
                 )}
               >
                 <TableCell className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                   <Checkbox
                     checked={selectedClientIds.has(row.id)}
                     onCheckedChange={() => toggleSelectClient(row.id)}
                   />
                 </TableCell>
                 <TableCell className="px-6 py-4 font-semibold text-foreground hover:text-primary transition-colors">{row.name}</TableCell>
                 <TableCell className="px-6 py-4 text-center">
                   <span className="w-7 h-7 rounded-md border border-border bg-card flex items-center justify-center mx-auto text-xs font-mono tabular-nums text-foreground">{row.missing}</span>
                 </TableCell>
                 <TableCell className="px-6 py-4 text-center">
                   {row.critical > 0 ? (
                     <span className="w-7 h-7 rounded-md bg-destructive/10 text-destructive flex items-center justify-center mx-auto text-xs font-mono tabular-nums font-semibold">{row.critical}</span>
                   ) : <span className="text-muted-foreground/60">-</span>}
                 </TableCell>
                 <TableCell className="px-6 py-4 text-muted-foreground">
                   {row.lastNotice !== '-' ? (
                     <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {row.lastNotice}</div>
                   ) : '-'}
                 </TableCell>
                 <TableCell className="px-6 py-4">
                   <span className={cn(
                     "px-2 py-0.5 rounded-sm text-[11px] font-semibold uppercase tracking-wider",
                     row.statusType === 'danger' && "bg-destructive/10 text-destructive",
                     row.statusType === 'warning' && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                     row.statusType === 'neutral' && "bg-muted text-muted-foreground"
                   )}>
                     {row.status}
                   </span>
                 </TableCell>
                 <TableCell className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                   <DropdownMenu>
                     <DropdownMenuTrigger asChild>
                       <button className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors">
                         <MoreVertical className="w-4 h-4" />
                       </button>
                     </DropdownMenuTrigger>
                     <DropdownMenuContent align="end" className="w-48">
                       <DropdownMenuItem onClick={() => navigate(`/eaisybooks/missing-invoices/${row.id}`)} className="cursor-pointer">
                         <ChevronRight className="w-4 h-4 mr-2" />
                         Részletek
                       </DropdownMenuItem>
                       <DropdownMenuItem className="cursor-pointer">
                         <Mail className="w-4 h-4 mr-2" />
                         Email küldés
                       </DropdownMenuItem>
                       <DropdownMenuItem className="cursor-pointer">
                         <Phone className="w-4 h-4 mr-2" />
                         AI telefonhívás
                       </DropdownMenuItem>
                       <DropdownMenuItem className="cursor-pointer text-primary focus:text-primary focus:bg-accent-subtle">
                         <CheckCircle2 className="w-4 h-4 mr-2" />
                         Megérkezettnek jelöl
                       </DropdownMenuItem>
                     </DropdownMenuContent>
                   </DropdownMenu>
                 </TableCell>
               </TableRow>
             ))
           ) : (
             <TableEmptyState colSpan={7} title={t('empty.title', 'Nincs találat')} description={t('empty.no_match', 'A megadott szűrők alapján nincs megjeleníthető ügyfél.')} />
           )}
           </TableBody>
         </Table>
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

      {/* Centralized Floating Bulk Action Bar */}
      <FloatingBulkBar
        count={selectedClientIds.size}
        label={t('missing_invoices.bulk_selected', 'Kijelölt ügyfelek:')}
        itemUnit={t('missing_invoices.bulk_unit', 'db')}
        onCancel={() => setSelectedClientIds(new Set())}
        cancelLabel={t('bulk.cancel', 'Mégse')}
        hideSaveButton={true}
      >
        <Button
          type="button"
          size="sm"
          onClick={() => {
            toast({
              title: t('missing_invoices.toast_sent_title', 'Felszólítások elküldve'),
              description: t('missing_invoices.toast_sent_desc', '{{count}} ügyfélnek elküldve a hiánypótlási felszólítás.', { count: selectedClientIds.size })
            });
            setSelectedClientIds(new Set());
          }}
          className="h-9 text-xs gap-1.5 rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm shrink-0"
        >
          <Mail className="w-3.5 h-3.5" />
          {t('missing_invoices.send_notice_btn', 'Felszólítás küldése ({{count}} db)', { count: selectedClientIds.size })}
        </Button>
      </FloatingBulkBar>
    </div>
  );
}
