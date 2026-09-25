import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, UploadCloud, Database, Bot, Loader2, Search, FileText, ChevronDown, Eye, Printer, Maximize2, Minimize2, FileUp, Trash2, BookOpen, Table2, Calendar, CalendarCheck, Layers, ShieldCheck, Plus, LayoutGrid, Columns, Filter, FolderTree, ListTree, FileSpreadsheet, Receipt, ListFilter } from 'lucide-react';
import { UploadAuditXmlModal } from '@/components/general-ledger/UploadAuditXmlModal';
import { AuditImportHistoryModal } from '@/components/general-ledger/AuditImportHistoryModal';
import GeneralLedgerTable, { GeneralLedgerTableRef, GlViewGranularity, GlItemGroupingMode } from '@/components/general-ledger/GeneralLedgerTable';
import { GlSearchAutocomplete } from '@/components/general-ledger/GlSearchAutocomplete';
import { UploadChartOfAccountsModal } from '@/components/general-ledger/UploadChartOfAccountsModal';
import { AddGlAccountModal } from '@/components/general-ledger/AddGlAccountModal';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { ManagePresetsModal } from '@/components/general-ledger/ManagePresetsModal';
import JournalView from '@/components/general-ledger/JournalView'; // F7
import { AddManualJournalEntryModal } from '@/components/general-ledger/AddManualJournalEntryModal';
import { GeneralLedgerComparisonTable } from '@/components/general-ledger/GeneralLedgerComparisonTable';
import { Settings2 } from 'lucide-react';
import { useActivePreset } from '@/hooks/useActivePreset';
import { useDateRange } from '@/contexts/DateRangeContext';
import { PageHeader } from '@/components/ui/page-header';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { cn } from '@/lib/utils';
import { useCompanySettings } from '@/hooks/useCompanySettings';
import { useCompanyJurisdiction } from '@/hooks/useCompanyJurisdiction';
import { GlDateBasis, GlPostingStatus, GlSearchResult } from '@/lib/glData';
import { useTranslation } from 'react-i18next';

import { GlAccountCardView } from '@/components/general-ledger/GlAccountCardView';
import { PartnerLedgerCardView } from '@/components/general-ledger/PartnerLedgerCardView';
import { GlAnalyticReconciliationView } from '@/components/general-ledger/GlAnalyticReconciliationView';
import { CreditCard, UserCheck, ShieldAlert } from 'lucide-react';

export default function GeneralLedgerPage() {
  const { t } = useTranslation(['accounting', 'common']);
  const { selectedCompany } = useCompany();
  const { isCroatia, defaultCurrency } = useCompanyJurisdiction();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { dateFromFormatted: dateFrom, dateToFormatted: dateTo } = useDateRange();
  const taxYear = dateFrom ? dateFrom.substring(0, 4) : new Date().getFullYear().toString();
  
  const [partnerBreakdown, setPartnerBreakdown] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [addGlAccountOpen, setAddGlAccountOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [auditXmlModalOpen, setAuditXmlModalOpen] = useState(false);
  const [auditHistoryOpen, setAuditHistoryOpen] = useState(false);
  const [isAIRunning, setIsAIRunning] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'extract' | 'cards' | 'journal' | 'comparison'>('extract');
  const [cardSubTab, setCardSubTab] = useState<'account' | 'partner' | 'reconciliation'>('account');
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [printLayoutMode, setPrintLayoutMode] = useState<'synthetic' | 'analytical'>('analytical');
  const [glStats, setGlStats] = useState<{ accountCount: number; leafCount: number; totalDebit: number; totalCredit: number; classifiedItems: number; totalItems: number } | null>(null);
  const [isTableLoading, setIsTableLoading] = useState(true);
  const [glSearchQuery, setGlSearchQuery] = useState('');
  const [glSearchResults, setGlSearchResults] = useState<GlSearchResult[]>([]);
  const tableRef = useRef<GeneralLedgerTableRef>(null);
  const handleStatsChange = useCallback((stats: typeof glStats) => setGlStats(stats), []);
  const handleLoadingChange = useCallback((loading: boolean) => setIsTableLoading(loading), []);

  // ── P4: Audit imports — conditional polling ──
  const { data: auditImports } = useQuery({
    queryKey: ['auditImports', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('gl_audit_imports')
        .select('id, file_name, period_start, period_end, processing_status, entry_count, source_program, imported_at, error_message, dry_run')
        .eq('company_id', selectedCompany.id)
        .order('imported_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!selectedCompany?.id,
    // P4: Only poll when there's a processing import, otherwise stop
    refetchInterval: (query) => {
      const data = query.state.data as typeof auditImports;
      return data?.some(i => i.processing_status === 'processing') ? 5000 : false;
    },
  });

  // Auto-use the latest completed import (no toggle needed)
  const activeAuditImport = auditImports?.find(i => i.processing_status === 'completed' && !i.dry_run) || null;

  // ── URL deep-linking for modals, date basis & posting status ──
  const [searchParams, setSearchParams] = useSearchParams();
  const { effectiveSettings } = useCompanySettings();
  const urlDateBasis = searchParams.get('date_basis') as GlDateBasis | null;
  const [dateBasis, setDateBasis] = useState<GlDateBasis>(() => {
    if (urlDateBasis === 'kibocsatas' || urlDateBasis === 'teljesites') return urlDateBasis;
    return (effectiveSettings?.gl_date_basis as GlDateBasis) || 'kibocsatas';
  });

  const urlPostingStatus = searchParams.get('posting_status') as GlPostingStatus | null;
  const [postingStatus, setPostingStatus] = useState<GlPostingStatus>(() => {
    if (urlPostingStatus === 'all' || urlPostingStatus === 'posted_only') return urlPostingStatus;
    return 'all';
  });

  const urlHideZero = searchParams.get('hide_zero');
  const [hideZeroBalances, setHideZeroBalances] = useState<boolean>(() => {
    if (urlHideZero !== null) return urlHideZero === 'true';
    if (selectedCompany?.id) {
      try {
        const stored = localStorage.getItem(`visibill_gl_hide_zero_${selectedCompany.id}`);
        if (stored !== null) return stored === 'true';
      } catch (e) {}
    }
    return false;
  });

  const [viewLayout, setViewLayout] = useState<'summary' | 'classic'>('summary');

  const urlGranularity = searchParams.get('granularity') as GlViewGranularity | null;
  const [viewGranularity, setViewGranularity] = useState<GlViewGranularity>(() => {
    if (urlGranularity === 'kontirok' || urlGranularity === 'teteles') return urlGranularity;
    return 'kontirok';
  });

  // Keep viewGranularity in sync with URL parameter if changed externally or via back/forward
  useEffect(() => {
    const param = searchParams.get('granularity') as GlViewGranularity | null;
    if (param === 'kontirok' || param === 'teteles') {
      setViewGranularity(param);
    } else if (!param) {
      setViewGranularity('kontirok');
    }
  }, [searchParams]);

  const handleGranularityChange = useCallback((newGranularity: GlViewGranularity) => {
    if (newGranularity === viewGranularity) return;
    setViewGranularity(newGranularity);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newGranularity === 'kontirok') {
        next.delete('granularity');
      } else {
        next.set('granularity', newGranularity);
      }
      return next;
    }, { replace: true });
  }, [viewGranularity, setSearchParams]);

  const urlItemGrouping = searchParams.get('item_grouping') as GlItemGroupingMode | null;
  const [itemGrouping, setItemGrouping] = useState<GlItemGroupingMode>(() => {
    if (urlItemGrouping === 'by_invoice' || urlItemGrouping === 'detailed') return urlItemGrouping;
    try {
      const stored = localStorage.getItem('visibill_gl_item_grouping');
      if (stored === 'by_invoice' || stored === 'detailed') return stored as GlItemGroupingMode;
    } catch (e) {}
    return 'by_invoice';
  });

  // Keep itemGrouping in sync with URL parameter if changed externally or via back/forward
  useEffect(() => {
    const param = searchParams.get('item_grouping') as GlItemGroupingMode | null;
    if (param === 'by_invoice' || param === 'detailed') {
      setItemGrouping(param);
    } else if (!param) {
      setItemGrouping('by_invoice');
    }
  }, [searchParams]);

  const handleItemGroupingChange = useCallback((newGrouping: GlItemGroupingMode) => {
    if (newGrouping === itemGrouping) return;
    setItemGrouping(newGrouping);
    try {
      localStorage.setItem('visibill_gl_item_grouping', newGrouping);
    } catch (e) {}
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newGrouping === 'by_invoice') {
        next.delete('item_grouping');
      } else {
        next.set('item_grouping', newGrouping);
      }
      return next;
    }, { replace: true });
  }, [itemGrouping, setSearchParams]);

  // Keep in sync with company default if no explicit URL parameter was provided
  useEffect(() => {
    const param = searchParams.get('date_basis');
    if (!param && effectiveSettings?.gl_date_basis) {
      setDateBasis(effectiveSettings.gl_date_basis as GlDateBasis);
    }
  }, [effectiveSettings?.gl_date_basis, searchParams]);

  // Keep hideZeroBalances in sync with URL parameter or company change
  useEffect(() => {
    if (!selectedCompany?.id) return;
    const urlVal = searchParams.get('hide_zero');
    if (urlVal !== null) {
      setHideZeroBalances(urlVal === 'true');
    } else {
      try {
        const stored = localStorage.getItem(`visibill_gl_hide_zero_${selectedCompany.id}`);
        if (stored !== null) {
          setHideZeroBalances(stored === 'true');
        }
      } catch (e) {}
    }
  }, [selectedCompany?.id, searchParams]);

  // Keep postingStatus in sync with URL parameter if changed externally or via back/forward
  useEffect(() => {
    const param = searchParams.get('posting_status') as GlPostingStatus | null;
    if (param === 'all' || param === 'posted_only') {
      setPostingStatus(param);
    } else if (!param) {
      setPostingStatus('all');
    }
  }, [searchParams]);

  const handleDateBasisChange = useCallback((newBasis: GlDateBasis) => {
    if (newBasis === dateBasis) return;
    setIsTableLoading(true);
    setDateBasis(newBasis);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('date_basis', newBasis);
      return next;
    }, { replace: true });
  }, [dateBasis, setSearchParams]);

  const handlePostingStatusChange = useCallback((newStatus: GlPostingStatus) => {
    if (newStatus === postingStatus) return;
    setIsTableLoading(true);
    setPostingStatus(newStatus);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (newStatus === 'all') {
        next.delete('posting_status');
      } else {
        next.set('posting_status', newStatus);
      }
      return next;
    }, { replace: true });
  }, [postingStatus, setSearchParams]);

  const renderDateBasisToggle = () => (
    <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs select-none">
      <CustomTooltip content={t('accounting:general_ledger.date_basis.issue_tooltip', 'Számla kibocsátásának kelte alapján gyűjti az adatokat')} side="bottom">
        <button
          type="button"
          onClick={() => handleDateBasisChange('kibocsatas')}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
            dateBasis === 'kibocsatas'
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span>{t('accounting:general_ledger.date_basis.issue', 'Kibocsátás')}</span>
        </button>
      </CustomTooltip>
      <CustomTooltip content={t('accounting:general_ledger.date_basis.fulfillment_tooltip', 'Számla / tétel gazdasági teljesítésének dátuma alapján gyűjti az adatokat')} side="bottom">
        <button
          type="button"
          onClick={() => handleDateBasisChange('teljesites')}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
            dateBasis === 'teljesites'
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <CalendarCheck className="w-3.5 h-3.5 shrink-0" />
          <span>{t('accounting:general_ledger.date_basis.fulfillment', 'Teljesítés')}</span>
        </button>
      </CustomTooltip>
    </div>
  );

  const renderPostingStatusToggle = () => (
    <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs select-none">
      <CustomTooltip content={t('accounting:general_ledger.posting_status.all_tooltip', 'Minden tétel megjelenítése (operatív számlák és lekönyvelt bizonylatok együtt)')} side="bottom">
        <button
          type="button"
          onClick={() => handlePostingStatusChange('all')}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
            postingStatus === 'all'
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span>{t('accounting:general_ledger.posting_status.all', 'Összes tétel')}</span>
        </button>
      </CustomTooltip>
      <CustomTooltip content={t('accounting:general_ledger.posting_status.posted_tooltip', 'Kizárólag a hivatalosan naplózott és lezárt bizonylatok megjelenítése (Sztv. szerinti zárt könyvelés)')} side="bottom">
        <button
          type="button"
          onClick={() => handlePostingStatusChange('posted_only')}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
            postingStatus === 'posted_only'
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{t('accounting:general_ledger.posting_status.posted', 'Csak lekönyvelt')}</span>
        </button>
      </CustomTooltip>
    </div>
  );

  const renderViewLayoutToggle = () => (
    <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs select-none shrink-0">
      <CustomTooltip content={t('accounting:general_ledger.tooltips.view_summary', 'Összesítő nézet (Egyenleg + Forgalom T/K)')} side="bottom">
        <button
          type="button"
          onClick={() => setViewLayout('summary')}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
            viewLayout === 'summary'
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
          <span>{t('accounting:general_ledger.view_summary', 'Összesítő')}</span>
        </button>
      </CustomTooltip>
      <CustomTooltip content={t('accounting:general_ledger.tooltips.view_classic', 'Klasszikus 4 oszlopos főkönyvi kivonat (Forgalom T/K, Egyenleg T/K)')} side="bottom">
        <button
          type="button"
          onClick={() => setViewLayout('classic')}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
            viewLayout === 'classic'
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <Columns className="w-3.5 h-3.5 shrink-0" />
          <span>{t('accounting:general_ledger.view_classic', 'Klasszikus')}</span>
        </button>
      </CustomTooltip>
    </div>
  );

  const renderGranularityToggle = () => (
    <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs select-none shrink-0">
      <CustomTooltip content={t('accounting:general_ledger.tooltips.granularity_kontirok', 'Kontírok nézet (Összevont számlatükör fastruktúra - alapértelmezett)')} side="bottom">
        <button
          type="button"
          onClick={() => handleGranularityChange('kontirok')}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
            viewGranularity === 'kontirok'
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <FolderTree className="w-3.5 h-3.5 shrink-0" />
          <span>{t('accounting:general_ledger.granularity_kontirok', 'Kontírok')}</span>
        </button>
      </CustomTooltip>
      <CustomTooltip content={t('accounting:general_ledger.tooltips.granularity_teteles', 'Tételes analitikus nézet (Minden számla alatt kibontva a könyvelt tételek)')} side="bottom">
        <button
          type="button"
          onClick={() => handleGranularityChange('teteles')}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
            viewGranularity === 'teteles'
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold text-primary"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <ListTree className="w-3.5 h-3.5 shrink-0 text-primary" />
          <span>{t('accounting:general_ledger.granularity_teteles', 'Tételes')}</span>
        </button>
      </CustomTooltip>
    </div>
  );

  const renderItemGroupingToggle = () => (
    <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs select-none shrink-0">
      <CustomTooltip content={t('accounting:general_ledger.item_grouping.by_invoice_tooltip', 'Számlánkénti összevonás: egy számlán szereplő és azonos kontírszámra könyvelt tételek egy sorként, összesítve jelennek meg (alapértelmezett)')} side="bottom">
        <button
          type="button"
          onClick={() => handleItemGroupingChange('by_invoice')}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
            itemGrouping === 'by_invoice'
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold text-primary"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <Receipt className="w-3.5 h-3.5 shrink-0 text-primary" />
          <span>{t('accounting:general_ledger.item_grouping.by_invoice', 'Számlánként')}</span>
        </button>
      </CustomTooltip>
      <CustomTooltip content={t('accounting:general_ledger.item_grouping.detailed_tooltip', 'Tételes bontás: minden számlatétel különálló sorként jelenik meg')} side="bottom">
        <button
          type="button"
          onClick={() => handleItemGroupingChange('detailed')}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
            itemGrouping === 'detailed'
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold text-primary"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <ListFilter className="w-3.5 h-3.5 shrink-0" />
          <span>{t('accounting:general_ledger.item_grouping.detailed', 'Tételes')}</span>
        </button>
      </CustomTooltip>
    </div>
  );

  const [isAllExpanded, setIsAllExpanded] = useState(false);

  const handleToggleExpandAll = useCallback((expand: boolean) => {
    setIsAllExpanded(expand);
    if (expand) {
      tableRef.current?.expandAll();
    } else {
      tableRef.current?.collapseAll();
    }
  }, []);

  const renderExpandCollapseToggle = () => (
    <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs select-none shrink-0">
      <CustomTooltip content={t('accounting:general_ledger.expand_all_tooltip', 'Összes főkönyvi szám és alábontás lenyitása')} side="bottom">
        <button
          type="button"
          onClick={() => handleToggleExpandAll(true)}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border shrink-0 whitespace-nowrap",
            isAllExpanded
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold text-primary"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <Maximize2 className="w-3.5 h-3.5 shrink-0" />
          <span>{t('accounting:general_ledger.context_menu.expand_all', 'Mind kinyitása')}</span>
        </button>
      </CustomTooltip>
      <CustomTooltip content={t('accounting:general_ledger.collapse_all_tooltip', 'Összes alszámla becsukása a főkategóriák szintjére')} side="bottom">
        <button
          type="button"
          onClick={() => handleToggleExpandAll(false)}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border shrink-0 whitespace-nowrap",
            !isAllExpanded
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <Minimize2 className="w-3.5 h-3.5 shrink-0" />
          <span>{t('accounting:general_ledger.context_menu.collapse_all', 'Mind összecsukása')}</span>
        </button>
      </CustomTooltip>
    </div>
  );

  const handleHideZeroChange = useCallback((hide: boolean) => {
    setHideZeroBalances(hide);
    if (selectedCompany?.id) {
      try {
        localStorage.setItem(`visibill_gl_hide_zero_${selectedCompany.id}`, String(hide));
      } catch (e) {}
    }
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (hide) {
        next.set('hide_zero', 'true');
      } else {
        next.delete('hide_zero');
      }
      return next;
    }, { replace: true });
  }, [selectedCompany?.id, setSearchParams]);

  const renderHideZeroToggle = () => (
    <div className="inline-flex h-8 items-center rounded-lg border border-border/80 bg-background/80 p-0.5 shadow-2xs text-xs select-none">
      <CustomTooltip content={t('accounting:general_ledger.hide_zero.all_tooltip', 'A teljes számlatükör megjelenítése forgalomtól függetlenül')} side="bottom">
        <button
          type="button"
          onClick={() => handleHideZeroChange(false)}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
            !hideZeroBalances
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span>{t('accounting:general_ledger.hide_zero.all', 'Összes')}</span>
        </button>
      </CustomTooltip>
      <CustomTooltip content={t('accounting:general_ledger.hide_zero.active_tooltip', 'Csak azok a számlák és hierarchikus összesítők jelennek meg, ahol könyvelési tétel vagy forgalom van')} side="bottom">
        <button
          type="button"
          onClick={() => handleHideZeroChange(true)}
          className={cn(
            "inline-flex h-7 items-center justify-center gap-1.5 px-2.5 rounded-md text-xs transition-all cursor-pointer border whitespace-nowrap",
            hideZeroBalances
              ? "bg-muted text-foreground shadow-xs border-border/60 font-semibold text-primary"
              : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/50 font-medium"
          )}
        >
          <Filter className="w-3.5 h-3.5 shrink-0 text-primary" />
          <span>{t('accounting:general_ledger.hide_zero.active_only', 'Csak forgalom')}</span>
        </button>
      </CustomTooltip>
    </div>
  );

  const setActionParam = useCallback((action: string | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (action) next.set('action', action);
      else next.delete('action');
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const handleOpenUpload = useCallback(() => { setUploadModalOpen(true); setActionParam('upload'); }, [setActionParam]);
  const handleOpenManage = useCallback(() => { setManageModalOpen(true); setActionParam('manage'); }, [setActionParam]);
  const handleCloseUpload = useCallback((v: boolean) => { setUploadModalOpen(v); if (!v) setActionParam(null); }, [setActionParam]);
  const handleCloseManage = useCallback((v: boolean) => { setManageModalOpen(v); if (!v) setActionParam(null); }, [setActionParam]);

  // Auto-open from URL
  const actionFromUrl = searchParams.get('action');
  useEffect(() => {
    if (actionFromUrl === 'upload' && !uploadModalOpen) setUploadModalOpen(true);
    if (actionFromUrl === 'manage' && !manageModalOpen) setManageModalOpen(true);
  }, [actionFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  const { activePresetId, setActivePresetId, presets, isLoading: isPresetsLoading } = useActivePreset(selectedCompany?.id);

  useEffect(() => {
    if (!selectedCompany?.id) return;

    const channel = supabase.channel('ai_notifications')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'gl_upload_notifications',
        filter: `company_id=eq.${selectedCompany.id}`
      }, (payload) => {
        const row = payload.new as { processing_status: string; message: string };
        if (row.processing_status !== 'completed' && row.processing_status !== 'error') return;
        
        setIsAIRunning(false);
        queryClient.invalidateQueries({ queryKey: ['glBalances'] });
        queryClient.invalidateQueries({ queryKey: ['glItems'] });
        queryClient.invalidateQueries({ queryKey: ['glJournalItems'] });
        
        if (row.processing_status === 'error') {
          toast({ title: t('common:status.error', 'Hiba történt'), description: row.message || t('accounting:general_ledger.toasts.ai_error', 'Az AI feldolgozás sikertelen.'), variant: 'destructive' });
        } else {
          toast({
            title: t('common:status.ready', 'Kész!'),
            description: row.message || t('accounting:general_ledger.toasts.ai_success', 'Az AI feldolgozás sikeresen befejeződött.'),
            className: "bg-green-50 text-green-900 border-green-200"
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCompany?.id, toast, t]);

  const toggleActivePresetMutation = useMutation({
    mutationFn: async (presetId: string) => {
      if (!selectedCompany?.id) throw new Error(t('accounting:general_ledger.toasts.company_not_selected', 'Cég nincs kiválasztva.'));
      
      const isGeneric = presets?.find(p => p.id === presetId)?.type === 'generic' || presets?.find(p => p.id === presetId)?.name === 'számla_hr';
      
      // Deactivate all custom presets for this company
      await supabase
        .from('chart_of_accounts_presets')
        .update({ is_active: false })
        .eq('company_id', selectedCompany.id)
        .eq('type', 'custom');

      if (!isGeneric) {
        // Activate the selected custom one
        const { error } = await supabase
          .from('chart_of_accounts_presets')
          .update({ is_active: true })
          .eq('id', presetId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coaPresets'] });
    },
    onError: (error: any) => {
      toast({ title: t('common:status.error', 'Hiba'), description: error.message, variant: "destructive" });
    }
  });

  const getPresetDisplayName = useCallback((preset: { name: string; type?: string }) => {
    if (preset.name === 'számla_hr') {
      return isCroatia
        ? t('accounting:general_ledger.toolbar.builtin_hr_preset', 'Ugrađeni sustavni predložak (számla_hr)')
        : t('accounting:general_ledger.toolbar.builtin_hr_preset', 'Beépített Horvát Számlatükör (számla_hr)');
    }
    if (preset.type === 'generic' || preset.name === 'Beépített Rendszerszintű Sablon' || preset.name.toLowerCase().includes('beépített')) {
      return t('accounting:general_ledger.toolbar.builtin_system_preset', 'Beépített Rendszerszintű Sablon');
    }
    return preset.name;
  }, [t, isCroatia]);

  const handleSelectPreset = (val: string) => {
    setActivePresetId(val);
    toggleActivePresetMutation.mutate(val);
  };

  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const handlePrint = () => {
    if (tableRef.current) {
      tableRef.current.expandAllAndPrint();
    } else {
      window.print();
    }
  };

  const handleRunAI = async () => {
    if (!selectedCompany?.id) return;
    setIsAIRunning(true);
    try {
      // PGMQ: INSERT into gl_upload_notifications triggers the DB trigger
      // which enqueues the job to the gl_classification_jobs PGMQ queue.
      const { error } = await supabase
        .from('gl_upload_notifications')
        .insert({
          company_id: selectedCompany.id,
          target_preset_id: activePresetId,
          processing_status: 'pending',
          message: 'AI besorolás indítva a felhasználó által'
        });

      if (error) throw new Error(error.message);
      toast({
        title: t('accounting:general_ledger.toasts.ai_started_title', 'Sikeres indítás'),
        description: t('accounting:general_ledger.toasts.ai_started', 'Az AI besorolás elindult a paramétereknek megfelelően.')
      });
    } catch (error: any) {
      toast({ title: t('common:status.error', 'Hiba történt'), description: error.message, variant: 'destructive' });
      setIsAIRunning(false);
    }
  };

  useKeyboardShortcuts([
    { combo: { key: 'p', ctrl: true }, handler: handlePrint, description: 'Nyomtatás' },
  ]);

  // U6: Detect "first use" (no presets) only when company is selected and query has finished loading
  const hasPresets = presets && presets.length > 0;
  const showOnboarding = Boolean(selectedCompany) && !isPresetsLoading && presets !== undefined && !hasPresets;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10 page-animate">
      {/* Print-only header */}
      <div className="hidden print:flex flex-col items-center justify-center mb-8 w-full border-b-2 border-primary/20 pb-6">
        <h1 className="text-5xl font-semibold text-primary tracking-tight print:text-black mb-2">eaisybill</h1>
        <h2 className="text-2xl font-bold uppercase tracking-widest text-foreground mt-2">Főkönyvi Kivonat</h2>
        <div className="mt-4 flex items-center gap-4 text-sm font-medium text-muted-foreground">
          <span>Adóév: {taxYear}</span>
          <span>•</span>
          <span>Időszak: {dateFrom.replace(/-/g, '.')} - {dateTo.replace(/-/g, '.')}</span>
        </div>
      </div>

      <PageHeader
        companyName={selectedCompany?.name}
        breadcrumb={t('accounting:general_ledger.breadcrumb', 'Főkönyv')}
        title={t('accounting:general_ledger.title', 'Főkönyv')}
        description={t('accounting:general_ledger.description', 'Hierarchikus főkönyvi kivonat és kategóriák')}
      />

      {/* U6: Onboarding empty state */}
      {showOnboarding ? (
        <Card className="border-dashed border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent print:hidden">
          <CardContent className="py-12 flex flex-col items-center text-center gap-6">
            <div className="bg-primary/10 text-primary p-4 rounded-2xl">
              <Database className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t('accounting:general_ledger.onboarding.welcome', 'Üdvözlünk a Főkönyvben!')}</h2>
              <p className="text-muted-foreground mt-1 max-w-md">
                {t('accounting:general_ledger.onboarding.steps_intro', 'Az induláshoz kövesd az alábbi lépéseket:')}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mt-2">
              {/* Step 1 */}
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:shadow-md transition-shadow">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">1</div>
                <h3 className="font-semibold text-sm">{t('accounting:general_ledger.onboarding.step1_title', 'Számlatükör feltöltése')}</h3>
                <p className="text-xs text-muted-foreground">{t('accounting:general_ledger.onboarding.step1_desc', 'Válassz egy beépített sablont, vagy töltsd fel a sajátodat')}</p>
                <Button size="sm" onClick={handleOpenUpload} className="mt-auto gap-1.5">
                  <UploadCloud className="w-4 h-4" /> {t('accounting:general_ledger.onboarding.step1_btn', 'Feltöltés')}
                </Button>
              </div>
              {/* Step 2 */}
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:shadow-md transition-shadow">
                <div className="w-8 h-8 rounded-full bg-primary/70 text-primary-foreground flex items-center justify-center text-sm font-bold">2</div>
                <h3 className="font-semibold text-sm">{t('accounting:general_ledger.onboarding.step2_title', 'Adat importálás')}</h3>
                <p className="text-xs text-muted-foreground">{t('accounting:general_ledger.onboarding.step2_desc', 'XML auditfájl vagy számlák/tranzakciók importálása')}</p>
                <Button size="sm" variant="outline" onClick={() => setAuditXmlModalOpen(true)} className="mt-auto gap-1.5">
                  <FileUp className="w-4 h-4" /> {t('accounting:general_ledger.onboarding.step2_btn', 'XML Import')}
                </Button>
              </div>
              {/* Step 3 */}
              <div className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:shadow-md transition-shadow">
                <div className="w-8 h-8 rounded-full bg-primary/40 text-primary-foreground flex items-center justify-center text-sm font-bold">3</div>
                <h3 className="font-semibold text-sm">{t('accounting:general_ledger.onboarding.step3_title', 'AI besorolás')}</h3>
                <p className="text-xs text-muted-foreground">{t('accounting:general_ledger.onboarding.step3_desc', 'Az AI automatikusan kategorizálja a tételeket a számlatükör alapján')}</p>
                <Button size="sm" variant="secondary" disabled className="mt-auto gap-1.5">
                  <Bot className="w-4 h-4" /> {t('accounting:general_ledger.onboarding.step3_btn', 'Később elérhető')}
                </Button>
              </div>
            </div>
            {hasPresets && (
              <p className="text-xs text-muted-foreground mt-4">
                {t('accounting:general_ledger.onboarding.or_choose_existing', 'Vagy válassz egy meglévő számlatükröt a fenti sávban a kezdéshez.')}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
      <div className="flex flex-col gap-3 print:hidden">

          {/* Preset Selector & Action */}
          <div className="flex items-center justify-end gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <Label className="whitespace-nowrap font-medium text-xs">
                {t('accounting:general_ledger.toolbar.active_preset', 'Aktív Számlatükör:')}
              </Label>
              <Select value={activePresetId || ''} onValueChange={handleSelectPreset} disabled={toggleActivePresetMutation.isPending}>
                <SelectTrigger className="w-[200px] h-9 text-sm">
                  <SelectValue placeholder={t('accounting:general_ledger.toolbar.select_preset', 'Sablon kiválasztása')} />
                </SelectTrigger>
                <SelectContent>
                  {presets?.map(preset => {
                    const isGeneric = preset.type === 'generic' || preset.name === 'számla_hr';
                    const displayName = getPresetDisplayName(preset);
                    return (
                      <SelectItem key={preset.id} value={preset.id}>
                        {displayName} {isGeneric ? ` ${t('accounting:general_ledger.toolbar.builtin_badge', '(Beépített)')}` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 gap-2 text-muted-foreground font-medium"
                onClick={handleOpenManage}
              >
                <Settings2 className="w-4 h-4" />
                <span>{t('accounting:general_ledger.toolbar.manage_presets', 'Sablonok kezelése')}</span>
              </Button>
            </div>
            <div className="border-l pl-3 border-border/60 flex items-center gap-2">
              <Button onClick={() => setAddGlAccountOpen(true)} size="sm" variant="outline" className="h-9 gap-2">
                <Plus className="w-4 h-4" />
                <span>{t('accounting:general_ledger.toolbar.add_account', 'Új főkönyvi szám')}</span>
              </Button>
              <Button onClick={handleOpenUpload} size="sm" className="h-9 gap-2">
                <UploadCloud className="w-4 h-4" />
                <span>{t('accounting:general_ledger.toolbar.upload_preset', 'Új sablon feltöltése')}</span>
              </Button>
              <Button onClick={() => setManualEntryOpen(true)} size="sm" variant="outline" className="h-9 gap-2 bg-primary/5 hover:bg-primary/10 text-primary border-primary/20">
                <BookOpen className="w-4 h-4" />
                <span>{t('accounting:general_ledger.toolbar.manual_entry', 'Vegyes bizonylat')}</span>
              </Button>
              <Button onClick={() => setAuditXmlModalOpen(true)} size="sm" variant="outline" className="h-9 gap-2">
                <FileUp className="w-4 h-4" />
                <span>{t('accounting:general_ledger.toolbar.xml_import', 'XML Import')}</span>
              </Button>
              <Button onClick={() => setAuditHistoryOpen(true)} size="sm" variant="outline" className="h-9 gap-2">
                <FileText className="w-4 h-4" />
                <span>{t('accounting:general_ledger.toolbar.xml_imports', 'XML Importok')}</span>
              </Button>
              <Button 
                onClick={handleRunAI} 
                disabled={isAIRunning}
                size="sm" 
                variant="secondary"
                className="h-9 gap-2"
              >
                {isAIRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                <span>{t('accounting:general_ledger.toolbar.ai_classification', 'AI Besorolás')}</span>
              </Button>
              <div className="border-l pl-3 border-border/60 ml-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 gap-2">
                      <Download className="h-4 w-4" />
                      {t('accounting:general_ledger.toolbar.export', 'Export')}
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setShowPrintPreview(true)}>
                      <Eye className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{t('accounting:general_ledger.toolbar.print_preview', 'Nyomtatási előnézet')}</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handlePrint}>
                      <Printer className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span className="flex-1">{t('accounting:general_ledger.toolbar.print_pdf', 'Nyomtatás / PDF')}</span>
                      <kbd className="ml-2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                        Ctrl+P
                      </kbd>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <FileSpreadsheet className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{t('accounting:general_ledger.toolbar.export_excel', 'Kivonat (Excel)')}</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-52">
                        <DropdownMenuItem onClick={() => tableRef.current?.exportExcel(selectedCompany?.name, { excludeZeroRows: false })}>
                          <Layers className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span>{t('accounting:general_ledger.toolbar.export_full', 'Teljes kivonat')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => tableRef.current?.exportExcel(selectedCompany?.name, { excludeZeroRows: true })}>
                          <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span>{t('accounting:general_ledger.toolbar.export_no_zeros', '0-ás sorok nélkül')}</span>
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    {/* F6: Analytical export */}
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <Table2 className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>{t('accounting:general_ledger.toolbar.export_analytical_excel', 'Analitikus kivonat (Excel)')}</span>
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-52">
                        <DropdownMenuItem onClick={() => tableRef.current?.exportAnalyticalExcel(selectedCompany?.name, { excludeZeroRows: false })}>
                          <Layers className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span>{t('accounting:general_ledger.toolbar.export_full_analytics', 'Teljes analitika')}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => tableRef.current?.exportAnalyticalExcel(selectedCompany?.name, { excludeZeroRows: true })}>
                          <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span>{t('accounting:general_ledger.toolbar.export_no_zeros_analytics', '0-ás sorok nélkül')}</span>
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
      </div>

      {/* ── KPI Summary Bar (F1) ── */}
      {!isTableLoading && glStats && glStats.accountCount > 0 ? (() => {
        const currencyLabel = defaultCurrency === 'HUF' ? 'Ft' : defaultCurrency;
        const fmtCurrency = (v: number) => new Intl.NumberFormat(isCroatia ? 'hr-HR' : 'hu-HU').format(Math.round(v));
        return (
          <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-primary/10 text-primary p-2 rounded-lg"><Database className="w-4 h-4" /></div>
              <div>
                <div className="text-lg font-bold tabular-nums">{glStats.accountCount}</div>
                <div className="text-[11px] text-muted-foreground">{t('accounting:general_ledger.kpi.accounts', 'Főkönyvi számok')}</div>
              </div>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-blue-500/10 text-blue-600 p-2 rounded-lg"><FileText className="w-4 h-4" /></div>
              <div>
                <div className="text-lg font-bold tabular-nums">{glStats.leafCount}</div>
                <div className="text-[11px] text-muted-foreground">{t('accounting:general_ledger.kpi.leaf_accounts', 'Analitikus számlák')}</div>
              </div>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-orange-500/10 text-orange-500 p-2 rounded-lg"><Download className="w-4 h-4 rotate-180" /></div>
              <div>
                <div className="text-lg font-bold tabular-nums">{fmtCurrency(glStats.totalDebit)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {t('accounting:general_ledger.kpi.debit', { currency: currencyLabel, defaultValue: `Tartozik (${currencyLabel})` })}
                </div>
              </div>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-sky-500/10 text-sky-500 p-2 rounded-lg"><Download className="w-4 h-4" /></div>
              <div>
                <div className="text-lg font-bold tabular-nums">{fmtCurrency(glStats.totalCredit)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {t('accounting:general_ledger.kpi.credit', { currency: currencyLabel, defaultValue: `Követel (${currencyLabel})` })}
                </div>
              </div>
            </div>
          </div>
          {/* ── Classification Progress Bar / Reserved Space (F2) ── */}
          <div className="h-6 mt-3 print:hidden">
            {glStats.totalItems > 0 && (() => {
              const pct = Math.round((glStats.classifiedItems / glStats.totalItems) * 100);
              return (
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1 leading-none">
                    <span>
                      {t('accounting:general_ledger.kpi.classification_progress', {
                        classified: glStats.classifiedItems,
                        total: glStats.totalItems,
                        defaultValue: `Besorolás: ${glStats.classifiedItems}/${glStats.totalItems} tétel`
                      })}
                    </span>
                    <span className={pct === 100 ? 'text-emerald-600 font-semibold' : ''}>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-primary to-blue-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}
          </div>
          </>
        );
      })() : (
        <div className="space-y-3 print:hidden animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg"><Skeleton className="w-4 h-4 rounded" /></div>
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-5 w-16 bg-muted/60" />
                <Skeleton className="h-3 w-24 bg-muted/40" />
              </div>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-blue-500/10 p-2 rounded-lg"><Skeleton className="w-4 h-4 rounded" /></div>
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-5 w-16 bg-muted/60" />
                <Skeleton className="h-3 w-24 bg-muted/40" />
              </div>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-orange-500/10 p-2 rounded-lg"><Skeleton className="w-4 h-4 rounded" /></div>
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-5 w-28 bg-muted/60" />
                <Skeleton className="h-3 w-20 bg-muted/40" />
              </div>
            </div>
            <div className="bg-card border border-border/60 rounded-xl p-3.5 flex items-center gap-3">
              <div className="bg-sky-500/10 p-2 rounded-lg"><Skeleton className="w-4 h-4 rounded" /></div>
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-5 w-28 bg-muted/60" />
                <Skeleton className="h-3 w-20 bg-muted/40" />
              </div>
            </div>
          </div>
          <div className="h-6 mt-3 print:hidden space-y-1.5">
            <div className="flex justify-between leading-none">
              <Skeleton className="h-2.5 w-36 bg-muted/50" />
              <Skeleton className="h-2.5 w-8 bg-muted/50" />
            </div>
            <Skeleton className="h-1.5 w-full rounded-full bg-muted/50" />
          </div>
        </div>
      )}

      {/* F7: View tabs — Kivonat vs Kartonok vs Naplófőkönyv vs Összehasonlítás */}
      <Tabs value={activeViewTab} onValueChange={v => setActiveViewTab(v as any)} className="print:hidden">
        <TabsList className="mb-0">
          <TabsTrigger value="extract" className="gap-1.5">
            <Database className="w-4 h-4" /> {t('accounting:general_ledger.tabs.extract', 'Kivonat')}
          </TabsTrigger>
          <TabsTrigger value="cards" className="gap-1.5 bg-primary/10 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
            <CreditCard className="w-4 h-4" /> {t('accounting:general_ledger.tabs.cards', 'Kartonok')}
          </TabsTrigger>
          <TabsTrigger value="journal" className="gap-1.5">
            <BookOpen className="w-4 h-4" /> {t('accounting:general_ledger.tabs.journal', 'Naplófőkönyv')}
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-1.5">
            <Table2 className="w-4 h-4" /> {t('accounting:general_ledger.tabs.comparison', 'Összehasonlítás')}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Extract (default) view */}
      <div className={activeViewTab !== 'extract' ? 'hidden' : ''}>
        <Card className="border-border/60 shadow-md print:border-none print:shadow-none print:bg-transparent content-animate">
          <CardHeader className="p-0 border-b border-border/40 bg-muted/30 relative z-30 overflow-visible print:hidden">
            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary/40 via-primary/20 to-transparent"></div>
            
            {/* 1. sor: Keresés és Fa kibontás (bal) | Nézetváltó és Időszak (jobb) */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <GlSearchAutocomplete
                  companyId={selectedCompany?.id}
                  presetId={activePresetId}
                  placeholder={t('accounting:general_ledger.search_placeholder', 'Keresés a főkönyvben (szám, név, partner)...')}
                  onQueryChange={setGlSearchQuery}
                  onSearchResultsChange={setGlSearchResults}
                  onSelect={(result) => {
                    const term = result.entity_type === 'account' ? result.gl_number : (result.title || result.target_gl_number);
                    setGlSearchQuery(term);
                    tableRef.current?.navigateToEntity(result);
                  }}
                  onClear={() => {
                    setGlSearchQuery('');
                    setGlSearchResults([]);
                  }}
                />
                <div className="h-5 w-px bg-border/60 shrink-0 hidden sm:block" />
                {renderExpandCollapseToggle()}
              </div>

              <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                {renderGranularityToggle()}
                {renderViewLayoutToggle()}
                <span className="text-xs font-semibold text-muted-foreground bg-background px-3 py-1.5 rounded-lg border border-border flex items-center gap-2 shadow-2xs whitespace-nowrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                  {dateFrom.replace(/-/g, '.')} - {dateTo.replace(/-/g, '.')}
                </span>
              </div>
            </div>

            {/* 2. sor: Dedikált adatszűrő sáv */}
            <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-border/30 bg-muted/15 text-xs">
              <div className="flex items-center gap-3.5 flex-wrap">
                <div className="flex items-center gap-1.5 text-muted-foreground font-medium text-xs mr-0.5">
                  <Filter className="w-3.5 h-3.5 text-primary" />
                  <span className="font-semibold text-foreground/85">
                    {t('accounting:general_ledger.filters_label', 'Szűrők:')}
                  </span>
                </div>
                {/* Dátum alap kapcsoló */}
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/80 text-[11px] font-medium">
                    {t('accounting:general_ledger.date_label', 'Dátum:')}
                  </span>
                  {renderDateBasisToggle()}
                </div>
                {/* Státusz szűrő kapcsoló */}
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/80 text-[11px] font-medium">
                    {t('accounting:general_ledger.documents_label', 'Bizonylatok:')}
                  </span>
                  {renderPostingStatusToggle()}
                </div>
                {/* Nullás sorok kapcsoló */}
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/80 text-[11px] font-medium">
                    {t('accounting:general_ledger.balance_label', 'Egyenleg:')}
                  </span>
                  {renderHideZeroToggle()}
                </div>
                {/* Tételek összevonása / bontása kapcsoló */}
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/80 text-[11px] font-medium">
                    {t('accounting:general_ledger.item_grouping_label', 'Tételek:')}
                  </span>
                  {renderItemGroupingToggle()}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <GeneralLedgerTable
              ref={tableRef}
              presetId={activePresetId}
              dateFrom={dateFrom}
              dateTo={dateTo}
              dateBasis={dateBasis}
              postingStatus={postingStatus}
              hideZeroBalances={hideZeroBalances}
              viewLayout={viewLayout}
              viewGranularity={viewGranularity}
              itemGrouping={itemGrouping}
              searchQuery={glSearchQuery}
              searchResults={glSearchResults}
              isPolling={isAIRunning}
              onStatsChange={handleStatsChange}
              onLoadingChange={handleLoadingChange}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Kartonok nézet (Főkönyvi & Analitikus Kartonok modul) ── */}
      <div className={activeViewTab !== 'cards' ? 'hidden' : ''}>
        <Card className="border-border/60 shadow-md content-animate">
          <CardHeader className="py-4 border-b border-border/40 bg-muted/30">
            <CardTitle className="text-xl font-bold flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary p-2 rounded-lg">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{t('accounting:general_ledger.cards_view.title', 'Főkönyvi & Analitikus Kartonok')}</h2>
                  <p className="text-xs text-muted-foreground font-normal">{t('accounting:general_ledger.cards_view.subtitle', 'Tételes forgalmi kimutatások, göngyölt egyenlegek és analitikai egyeztető')}</p>
                </div>
              </div>

              {/* Sub-tab Switcher: Főkönyvi Karton | Partnerkarton | Egyeztető */}
              <div className="flex items-center gap-1 bg-background border p-1 rounded-lg">
                <Button
                  variant={cardSubTab === 'account' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setCardSubTab('account')}
                >
                  <CreditCard className="w-3.5 h-3.5" /> {t('accounting:general_ledger.cards_view.account_card', 'Főkönyvi Karton')}
                </Button>
                <Button
                  variant={cardSubTab === 'partner' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setCardSubTab('partner')}
                >
                  <UserCheck className="w-3.5 h-3.5" /> {t('accounting:general_ledger.cards_view.partner_card', 'Partner Kartonok')}
                </Button>
                <Button
                  variant={cardSubTab === 'reconciliation' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setCardSubTab('reconciliation')}
                >
                  <ShieldAlert className="w-3.5 h-3.5" /> {t('accounting:general_ledger.cards_view.reconciliation', 'Főkönyv ↔ Analitika')}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {cardSubTab === 'account' && (
              <GlAccountCardView
                companyId={selectedCompany?.id}
                presetId={activePresetId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                dateBasis={dateBasis}
                postingStatus={postingStatus}
                companyName={selectedCompany?.name}
              />
            )}

            {cardSubTab === 'partner' && (
              <PartnerLedgerCardView
                companyId={selectedCompany?.id}
                dateFrom={dateFrom}
                dateTo={dateTo}
                companyName={selectedCompany?.name}
              />
            )}

            {cardSubTab === 'reconciliation' && (
              <GlAnalyticReconciliationView
                companyId={selectedCompany?.id}
                presetId={activePresetId}
                dateTo={dateTo}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* F7: Journal view */}
      <div className={activeViewTab !== 'journal' ? 'hidden' : ''}>
        <Card className="border-border/60 shadow-md content-animate">
          <CardHeader className="py-4 border-b border-border/40 bg-muted/30">
            <CardTitle className="text-xl font-bold flex items-center gap-3">
              <div className="bg-primary/10 text-primary p-2 rounded-lg">
                <BookOpen className="w-5 h-5" />
              </div>
              {t('accounting:general_ledger.journal_view.title', 'Naplófőkönyv')}
              <div className="ml-auto flex items-center gap-3">
                {/* Dátum alap kapcsoló Naplófőkönyvhöz */}
                {renderDateBasisToggle()}
                {/* Státusz szűrő kapcsoló Naplófőkönyvhöz */}
                {renderPostingStatusToggle()}
                <span className="text-xs font-semibold text-muted-foreground bg-background px-3 py-1.5 rounded-full border border-border flex items-center gap-2 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                  {dateFrom.replace(/-/g, '.')} - {dateTo.replace(/-/g, '.')}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <JournalView
              presetId={activePresetId}
              dateFrom={dateFrom}
              dateTo={dateTo}
              dateBasis={dateBasis}
              postingStatus={postingStatus}
            />
          </CardContent>
        </Card>
      </div>

      {/* Comparison view */}
      <div className={activeViewTab !== 'comparison' ? 'hidden' : ''}>
        <Card className="border-border/60 shadow-md content-animate">
          <CardHeader className="py-4 border-b border-border/40 bg-muted/30">
            <CardTitle className="text-xl font-bold flex items-center gap-3">
              <div className="bg-primary/10 text-primary p-2 rounded-lg">
                <Table2 className="w-5 h-5" />
              </div>
              {t('accounting:general_ledger.comparison_view.title', 'Többéves Összehasonlítás (Előző év vs Tárgyév)')}
              <div className="ml-auto flex items-center gap-3">
                {renderDateBasisToggle()}
                {renderPostingStatusToggle()}
                <span className="text-xs font-semibold text-muted-foreground bg-background px-3 py-1.5 rounded-full border border-border flex items-center gap-2 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                  {t('accounting:general_ledger.comparison_view.compared_periods', 'Összehasonlított időszakok')}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <GeneralLedgerComparisonTable
              presetId={activePresetId}
              companyId={selectedCompany?.id}
              dateFrom={dateFrom}
              dateTo={dateTo}
              dateBasis={dateBasis}
              postingStatus={postingStatus}
            />
          </CardContent>
        </Card>
      </div>
      </>
      )}

      <UploadChartOfAccountsModal 
        open={uploadModalOpen} 
        onOpenChange={handleCloseUpload} 
        onSuccess={(id) => {
          queryClient.invalidateQueries({ queryKey: ['coaPresets'] });
          setActivePresetId(id);
        }}
      />

      <UploadAuditXmlModal
        open={auditXmlModalOpen}
        onOpenChange={setAuditXmlModalOpen}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['auditImports'] });
        }}
      />

      <ManagePresetsModal
        open={manageModalOpen}
        onOpenChange={handleCloseManage}
        presets={presets || []}
        companyId={selectedCompany?.id}
      />

      <AuditImportHistoryModal
        open={auditHistoryOpen}
        onOpenChange={setAuditHistoryOpen}
      />

      <AddManualJournalEntryModal
        open={manualEntryOpen}
        onOpenChange={setManualEntryOpen}
        companyId={selectedCompany?.id}
        presetId={activePresetId}
      />

      <AddGlAccountModal
        open={addGlAccountOpen}
        onOpenChange={setAddGlAccountOpen}
        presetId={activePresetId}
        presetName={presets?.find(p => p.id === activePresetId)?.name}
        companyId={selectedCompany?.id}
      />

      {/* F5: Print Preview Dialog */}
      <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
        <DialogContent className="max-w-5xl w-[95vw] h-[85vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-border/40 bg-muted/30 shrink-0 flex flex-row items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Eye className="w-5 h-5 text-primary" />
              {t('accounting:general_ledger.print_preview_modal.title', 'Főkönyv nyomtatási előnézet')}
            </DialogTitle>
            <div className="flex items-center gap-2 shrink-0 mr-4">
              <Label className="text-xs font-semibold whitespace-nowrap">{t('accounting:general_ledger.print_preview_modal.layout', 'Elrendezés:')}</Label>
              <Select value={printLayoutMode} onValueChange={(v: any) => setPrintLayoutMode(v)}>
                <SelectTrigger className="w-[150px] h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="analytical">{t('accounting:general_ledger.print_preview_modal.analytical', 'Analitikus (Tételek)')}</SelectItem>
                  <SelectItem value="synthetic">{t('accounting:general_ledger.print_preview_modal.synthetic', 'Szintetikus (Összesített)')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-6 bg-white dark:bg-background">
            <div className="text-center mb-6 border-b-2 border-primary/20 pb-4">
              <h1 className="text-2xl font-bold text-foreground">{selectedCompany?.name || 'Vállalkozás'}</h1>
              <p className="text-sm text-muted-foreground mt-1">{t('accounting:general_ledger.print_preview_modal.subtitle', 'Főkönyvi kivonat — Nyomtatási előnézet')}</p>
            </div>
            <div className="border rounded-md shadow-sm bg-card">
              <GeneralLedgerTable
                presetId={activePresetId}
                dateFrom={dateFrom}
                dateTo={dateTo}
                printLayoutMode={printLayoutMode}
              />
            </div>
          </div>
          <DialogFooter className="px-6 py-3 border-t border-border/40 bg-muted/30 shrink-0 gap-2">
            <Button variant="outline" onClick={() => setShowPrintPreview(false)}>{t('accounting:general_ledger.print_preview_modal.close', 'Bezárás')}</Button>
            <Button className="gap-2" onClick={() => { setShowPrintPreview(false); handlePrint(); }}>
              <Printer className="w-4 h-4" /> {t('accounting:general_ledger.print_preview_modal.print', 'Nyomtatás')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
