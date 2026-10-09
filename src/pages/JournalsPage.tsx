import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  Plus,
  Loader2,
  Lock,
  Search,
  Eye,
  History,
  FileSpreadsheet,
  AlertCircle,
  FileText,
  Trash2,
  CornerDownRight,
  ShieldCheck,
  Calendar,
  Bot,
  Receipt,
  Landmark,
  PenTool,
  PenLine,
  CheckCircle2,
  XCircle,
  Sparkles,
  RotateCcw,
  Undo2,
  X,
  Download,
  ExternalLink,
  Copy,
  Settings2,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Layers,
  LayoutGrid,
  ChevronsLeftRight,
} from 'lucide-react';
import { AccountingRulesDialog } from '@/components/accounting/AccountingRulesDialog';
import { extractStoragePath } from '@/lib/utils';
import { formatCurrencyLocale, formatNumberLocale } from '@/lib/locale/formatters';
import { InvoiceDetailPopup } from '@/components/InvoiceDetailPopup';
import AddManualJournalEntryModal from '@/components/journals/AddManualJournalEntryModal';
import OpeningJournalWizardModal from '@/components/journals/OpeningJournalWizardModal';
import { UploadChartOfAccountsModal } from '@/components/general-ledger/UploadChartOfAccountsModal';
import PeriodClosingSettings from '@/components/journals/PeriodClosingSettings';
import AuditTrailDialog from '@/components/journals/AuditTrailDialog';
import { ManageJournalsModal } from '@/components/journals/ManageJournalsModal';
import { JournalFilterModal } from '@/components/journals/JournalFilterModal';
import {
  JournalFilterCriteria,
  DEFAULT_JOURNAL_FILTER_CRITERIA,
  getActiveFilterCount,
  getActiveFilterChips,
  filterJournalEntries,
} from '@/components/journals/journalFilterUtils';
import {
  getLocalizedJournalName,
  getNextDocumentId,
  JOURNAL_CATEGORIES,
  JournalCategoryKey,
  getJournalCategory,
  isJournalSystemLocked,
} from '@/lib/journalUtils';
import { useActivePreset } from '@/hooks/useActivePreset';
import { generatePettyCashDrafts, generateDraftsFallback } from '@/features/journals/services/draftFallbackGenerator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TablePlaceholderRows } from '@/components/ui/table-placeholder-rows';
import { CopyableCell } from '@/components/ui/copyable-cell';
import { Checkbox } from '@/components/ui/checkbox';
import { CustomTooltip } from '@/components/ui/custom-tooltip';


const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  GEPI_JAVASLAT: { label: 'Rendszer javaslat', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
  KEZI_PISZKOZAT: { label: 'Piszkozat', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  JOVAHAGYASRA_VAR: { label: 'Jóváhagyásra vár', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
  KONYVELT: { label: 'Könyvelt', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  SZTORNOZOTT: { label: 'Sztornózott', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
  ELVETVE: { label: 'Elvetve', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
};

const getStatusInfo = (status: string, t?: any) => {
  const labels: Record<string, { label: string; color: string }> = {
    GEPI_JAVASLAT: { label: t ? t('accounting:journals.status_labels.GEPI_JAVASLAT', 'Rendszer javaslat') : 'Rendszer javaslat', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
    KEZI_PISZKOZAT: { label: t ? t('accounting:journals.status_labels.KEZI_PISZKOZAT', 'Piszkozat') : 'Piszkozat', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
    JOVAHAGYASRA_VAR: { label: t ? t('accounting:journals.status_labels.JOVAHAGYASRA_VAR', 'Jóváhagyásra vár') : 'Jóváhagyásra vár', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
    KONYVELT: { label: t ? t('accounting:journals.status_labels.KONYVELT', 'Könyvelt') : 'Könyvelt', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
    SZTORNOZOTT: { label: t ? t('accounting:journals.status_labels.SZTORNOZOTT', 'Sztornózott') : 'Sztornózott', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
    ELVETVE: { label: t ? t('accounting:journals.status_labels.ELVETVE', 'Elvetve') : 'Elvetve', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  };
  return labels[status] || { label: status, color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' };
};

export const SOURCE_LABELS: Record<string, string> = {
  AUTO_SZAMLA: 'Számla',
  AUTO_BANK: 'Bank',
  AUTO_RENDSZER: 'Rendszer',
  KEZI: 'Kézi',
  KEZI_MODOSITAS: 'Módosítás',
};

const renderSourceBadge = (source: string, t?: any) => {
  switch (source) {
    case 'AUTO_SZAMLA':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 whitespace-nowrap">
          <Receipt className="w-3 h-3 text-sky-500 shrink-0" />
          {t ? t('accounting:journals.source_labels.AUTO_SZAMLA', 'Számla') : 'Számla'}
        </span>
      );
    case 'AUTO_BANK':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 whitespace-nowrap">
          <Landmark className="w-3 h-3 text-emerald-500 shrink-0" />
          {t ? t('accounting:journals.source_labels.AUTO_BANK', 'Bank') : 'Bank'}
        </span>
      );
    case 'AUTO_RENDSZER':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 whitespace-nowrap">
          <Bot className="w-3 h-3 text-indigo-500 shrink-0" />
          {t ? t('accounting:journals.source_labels.AUTO_RENDSZER', 'Rendszer') : 'Rendszer'}
        </span>
      );
    case 'KEZI':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 whitespace-nowrap">
          <PenTool className="w-3 h-3 text-amber-500 shrink-0" />
          {t ? t('accounting:journals.source_labels.KEZI', 'Kézi') : 'Kézi'}
        </span>
      );
    case 'KEZI_MODOSITAS':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 whitespace-nowrap">
          <PenLine className="w-3 h-3 text-orange-500 shrink-0" />
          {t ? t('accounting:journals.source_labels.KEZI_MODOSITAS', 'Módosítás') : 'Módosítás'}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono bg-muted/40 px-1.5 py-0.5 rounded border border-border whitespace-nowrap">
          <FileText className="w-3 h-3 shrink-0" />
          {source || '—'}
        </span>
      );
  }
};

const formatCurrency = (val: number, currency: string = 'HUF') => {
  return formatCurrencyLocale(val, currency, { maximumFractionDigits: currency === 'HUF' ? 0 : 2 });
};

interface JournalLineItem {
  key: string;
  index: number;
  description: string;
  net: number;
  vat: number;
  gross: number;
  foreignNet?: number;
  foreignVat?: number;
  foreignGross?: number;
  lines: any[];
}

function deriveJournalItems(entry: any): JournalLineItem[] {
  const lines = entry.lines || [];
  if (lines.length === 0) return [];

  const isForeign = Boolean(entry.currency && entry.currency !== 'HUF');

  const itemMap = new Map<string, { key: string; description: string; lines: any[] }>();
  const parentToItem = new Map<string, { key: string; description: string; lines: any[] }>();

  lines.forEach((l: any) => {
    if (l.parent_line_id) {
      const parentGroup = parentToItem.get(l.parent_line_id);
      if (parentGroup) {
        parentGroup.lines.push(l);
        return;
      }
    }

    const baseDesc = (l.description || '').trim();
    if (baseDesc && itemMap.has(baseDesc)) {
      const existing = itemMap.get(baseDesc)!;
      existing.lines.push(l);
      if (l.id) parentToItem.set(l.id, existing);
    } else {
      const newItem = {
        key: l.id || `item-${itemMap.size + 1}`,
        description: baseDesc || `${entry.description || 'Tétel'} #${itemMap.size + 1}`,
        lines: [l],
      };
      if (baseDesc) itemMap.set(baseDesc, newItem);
      else itemMap.set(newItem.key, newItem);
      if (l.id) parentToItem.set(l.id, newItem);
    }
  });

  const rawItems = Array.from(new Set(Array.from(itemMap.values())));

  return rawItems.map((it, idx) => {
    let net = 0;
    let vat = 0;
    let gross = 0;
    let foreignNet = 0;
    let foreignVat = 0;
    let foreignGross = 0;

    it.lines.forEach((l: any) => {
      const amt = Number(l.amount) || 0;
      const fAmt = Number(l.foreign_amount) || 0;
      const gl = l.gl_account?.gl_number || '';

      const isVat = l.vat_role === 'AFA' || gl.startsWith('466') || gl.startsWith('467');
      const isPartner = gl.startsWith('454') || gl.startsWith('311') || (l.vat_role === 'NONE' && !isVat);

      if (isVat) {
        vat += amt;
        foreignVat += fAmt;
      } else if (l.vat_role === 'ALAP' || (!isPartner && !isVat)) {
        net += amt;
        foreignNet += fAmt;
      } else if (isPartner) {
        gross = Math.max(gross, amt);
        foreignGross = Math.max(foreignGross, fAmt);
      }
    });

    if (gross === 0) {
      gross = net + vat;
      foreignGross = foreignNet + foreignVat;
    }
    if (net === 0 && gross > 0 && vat === 0) {
      net = gross;
      foreignNet = foreignGross;
    }

    return {
      key: it.key,
      index: idx + 1,
      description: it.description,
      net,
      vat,
      gross,
      foreignNet: isForeign ? foreignNet : undefined,
      foreignVat: isForeign ? foreignVat : undefined,
      foreignGross: isForeign ? foreignGross : undefined,
      lines: [...it.lines].sort((a: any, b: any) => (a.sequence_number || 0) - (b.sequence_number || 0)),
    };
  });
}

export default function JournalsPage() {
  const { t } = useTranslation(['accounting', 'common']);
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { dateFromFormatted: dateFrom, dateToFormatted: dateTo } = useDateRange();

  const { activePresetId } = useActivePreset(selectedCompany?.id);

  const generateDraftsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id || !activePresetId) return 0;
      let count = 0;
      try {
        const { data, error } = await supabase.rpc('acc_generate_drafts_from_ledger', {
          p_company_id: selectedCompany.id,
          p_preset_id: activePresetId
        });
        if (error) throw error;
        count = Number(data) || 0;
      } catch (rpcErr) {
        console.warn('acc_generate_drafts_from_ledger warning, attempting client-side fallback:', rpcErr);
        try {
          count = await generateDraftsFallback(selectedCompany.id, activePresetId);
        } catch (fbErr) {
          console.error('generateDraftsFallback failed as well:', fbErr);
          throw rpcErr;
        }
      }
      try {
        const p1Count = await generatePettyCashDrafts(selectedCompany.id, activePresetId);
        count += p1Count;
      } catch (p1Err) {
        console.warn('generatePettyCashDrafts warning:', p1Err);
      }
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['acc-munkalista-count'] });
      toast({
        title: t('accounting:journals.toasts.drafts_generated_title'),
        description: t('accounting:journals.toasts.drafts_generated_desc', { count })
      });
    },
    onError: (err: any) => {
      toast({
        title: t('accounting:journals.toasts.drafts_error_title'),
        description: err?.message || t('common:unknown_error', 'Ismeretlen hiba történt'),
        variant: "destructive"
      });
    }
  });

  const [selectedJournalId, setSelectedJournalId] = useState<string>('munkalista');
  const [search, setSearch] = useState('');
  const [stornoFilter, setStornoFilter] = useState<'all' | 'active' | 'storno'>('all');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState<JournalFilterCriteria>(DEFAULT_JOURNAL_FILTER_CRITERIA);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [expandedEntryIds, setExpandedEntryIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const lastRepeatTimeRef = useRef<number>(0);
  const scrollRafRef = useRef<number | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  const handleResetFilters = useCallback(() => {
    setFilterCriteria(DEFAULT_JOURNAL_FILTER_CRITERIA);
    setSearch('');
    setStornoFilter('all');
    setCurrentPage(1);
  }, []);

  const handleRemoveFilterChip = useCallback((chipId: string) => {
    setFilterCriteria(prev => {
      switch (chipId) {
        case 'journalScope':
          return { ...prev, journalScope: 'CURRENT' };
        case 'directions':
          return { ...prev, vevoSzamlak: true, szallitoSzamlak: true, bankPenztar: true, vegyesNaplo: true };
        case 'status':
          return { ...prev, statusKonyvelt: true, statusPiszkozat: true, statusSztorno: false };
        case 'csakJegyzet':
          return { ...prev, csakJegyzet: false };
        case 'csakPfAfa':
          return { ...prev, csakPfAfa: false };
        case 'naplosorszam':
          return { ...prev, naplosorszamTol: '', naplosorszamIg: '' };
        case 'kelt':
          return { ...prev, keltTol: '', keltIg: '' };
        case 'teljesites':
          return { ...prev, teljesitesTol: '', teljesitesIg: '' };
        case 'fokonyv':
          return { ...prev, fokonyviSzam: '' };
        case 'bizonylatszam':
          return { ...prev, bizonylatszam: '' };
        case 'partnerNev':
          return { ...prev, partnerNev: '' };
        case 'megjegyzes':
          return { ...prev, megjegyzes: '' };
        case 'munkaszam':
          return { ...prev, munkaszam: '' };
        case 'devizanem':
          return { ...prev, devizanem: 'ALL' };
        case 'fizetesiMod':
          return { ...prev, fizetesiMod: 'ALL' };
        case 'osszeg':
          return { ...prev, osszegTol: '', osszegIg: '' };
        default:
          return prev;
      }
    });
    setCurrentPage(1);
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleAllExpand = useCallback((entries: any[]) => {
    const pageIds = entries.map((e: any) => e.id);
    const allPageExpanded = pageIds.length > 0 && pageIds.every((id: string) => expandedEntryIds.has(id));
    setExpandedEntryIds((prev) => {
      const next = new Set(prev);
      if (allPageExpanded) {
        pageIds.forEach((id: string) => next.delete(id));
      } else {
        pageIds.forEach((id: string) => next.add(id));
      }
      return next;
    });
  }, [expandedEntryIds]);

  // Reset page and selection when search, stornoFilter, filterCriteria or journal changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedEntryIds(new Set());
    setExpandedEntryIds(new Set());
    setLastSelectedIndex(null);
    setFocusedIndex(null);
  }, [search, stornoFilter, selectedJournalId, filterCriteria]);
  
  // Modals state
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [openingWizardOpen, setOpeningWizardOpen] = useState(false);
  const [uploadCoaOpen, setUploadCoaOpen] = useState(false);
  const [periodClosingOpen, setPeriodClosingOpen] = useState(false);
  const [auditEntryId, setAuditEntryId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [cloneData, setCloneData] = useState<any | null>(null);

  const handleCoaUploadSuccess = useCallback(async (presetId: string) => {
    setUploadCoaOpen(false);
    await queryClient.invalidateQueries({ queryKey: ['active-preset'] });
    await queryClient.invalidateQueries({ queryKey: ['gl-accounts'] });
    await queryClient.invalidateQueries({ queryKey: ['gl-accounts-lookup'] });
    await queryClient.invalidateQueries({ queryKey: ['acc-presets'] });
    toast({
      title: t('accounting:journals.opening.coa_imported_title', 'Számlatükör sikeresen importálva!'),
      description: t('accounting:journals.opening.coa_imported_desc', 'Az új számlatükör aktív, a mérlegszámlák azonnal használhatók a nyitáshoz.'),
    });
  }, [queryClient, t, toast]);

  // Storno / Correction dialog state
  const [stornoOpen, setStornoOpen] = useState(false);
  const [stornoTarget, setStornoTarget] = useState<{ headerId: string; correct: boolean; entry?: any } | null>(null);
  const [stornoReason, setStornoReason] = useState('');

  // Delete confirmation dialogs state
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<{ id: string; description?: string } | null>(null);

  // Bulk GL Reassign state
  const [bulkGlDialogOpen, setBulkGlDialogOpen] = useState(false);
  const [bulkGlSide, setBulkGlSide] = useState<'T' | 'K'>('T');
  const [selectedTargetGlId, setSelectedTargetGlId] = useState<string>('');
  const [bulkGlSearch, setBulkGlSearch] = useState<string>('');

  // Manage Journals dialog state
  const [manageJournalsOpen, setManageJournalsOpen] = useState(false);
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);

  // Wrap vs Scroll horizontal layout for journal cards
  const [isWrapLayout, setIsWrapLayout] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('visibill_journals_wrap_layout');
      if (saved !== null) return saved === 'true';
    } catch (e) {}
    return true; // Default to true so all journals are visible without clipping
  });

  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 6);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 6);
  }, []);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || isWrapLayout) return;
    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [isWrapLayout, checkScroll]);

  const scrollByAmount = (delta: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: delta, behavior: 'smooth' });
    }
  };

  // Lookup GL accounts for preset
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['gl-accounts-lookup', activePresetId],
    queryFn: async () => {
      if (!activePresetId) return [];
      return await fetchAllGlAccountsByPreset(activePresetId);
    },
    enabled: !!activePresetId,
  });

  // Source document preview / download state
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [downloadingSourceDoc, setDownloadingSourceDoc] = useState(false);

  // Fetch existing NY journal entries count
  const { data: nyEntriesCount = 0 } = useQuery({
    queryKey: ['acc-ny-entries-count', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return 0;
      const { data: nyJ } = await supabase
        .from('acc_journals')
        .select('id')
        .eq('company_id', selectedCompany.id)
        .eq('code', 'NY')
        .maybeSingle();

      if (!nyJ) return 0;

      const { count, error } = await supabase
        .from('acc_journal_headers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id)
        .eq('journal_id', nyJ.id);

      if (error) return 0;
      return count || 0;
    },
    enabled: !!selectedCompany?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch pending drafts count for Munkalista badge (respecting selected date range)
  const { data: munkalistaCount = 0 } = useQuery({
    queryKey: ['acc-munkalista-count', selectedCompany?.id, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedCompany?.id) return 0;
      let query = supabase
        .from('acc_journal_headers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', selectedCompany.id)
        .in('status', ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT']);

      if (dateFrom) query = query.gte('posting_date', dateFrom);
      if (dateTo) query = query.lte('posting_date', dateTo);

      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    },
    enabled: !!selectedCompany?.id,
  });

  // Fetch journals
  const { data: journals = [], isLoading: loadingJournals, refetch: refetchJournals } = useQuery({
    queryKey: ['acc-journals', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('acc_journals')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .order('code');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  // Seed journals mutation if empty
  const seedMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id) return;
      const { error } = await supabase.rpc('acc_seed_default_journals', {
        p_company_id: selectedCompany.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchJournals();
      toast({ title: t('accounting:journals.init_success', 'Naplók sikeresen inicializálva') });
    },
    onError: (err) => {
      toast({ title: t('accounting:journals.init_error', 'Sikertelen inicializálás'), description: err.message, variant: "destructive" });
    }
  });

  // Auto seed if list is empty
  useEffect(() => {
    if (!loadingJournals && journals.length === 0 && selectedCompany?.id) {
      seedMutation.mutate();
    }
  }, [journals, loadingJournals, selectedCompany, seedMutation]);

  // EB-0257: Journal Category Filter State
  const [activeCategoryKey, setActiveCategoryKey] = useState<JournalCategoryKey>('ALL');

  const categoryCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      ALL: journals.length,
      OPENING: 0,
      BANK: 0,
      PETTY_CASH: 0,
      INVOICE: 0,
      MIXED: 0,
      CLOSING: 0,
    };
    journals.forEach((j: any) => {
      const cat = getJournalCategory(j);
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    });
    return counts;
  }, [journals]);

  const visibleJournals = React.useMemo(() => {
    if (activeCategoryKey === 'ALL') return journals;
    return journals.filter((j: any) => getJournalCategory(j) === activeCategoryKey);
  }, [journals, activeCategoryKey]);

  // Fetch MNB daily exchange rates for currency conversion and tooltips
  const { data: dailyExchangeRates = [] } = useQuery({
    queryKey: ['daily_exchange_rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_exchange_rates')
        .select('currency, rate_date, rate')
        .order('rate_date', { ascending: false })
        .limit(500);
      if (error) return [];
      return data || [];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  const getDailyRate = useCallback((currency: string, date: string): number => {
    if (!currency || currency === 'HUF') return 1;
    const match = dailyExchangeRates.find(r => r.currency === currency && r.rate_date <= date);
    if (match?.rate) return Number(match.rate);
    const fallback = dailyExchangeRates.find(r => r.currency === currency);
    return fallback?.rate ? Number(fallback.rate) : 1;
  }, [dailyExchangeRates]);

  // Fetch closed accounting periods for the company
  const { data: closedPeriods = [] } = useQuery({
    queryKey: ['acc-accounting-periods-lock', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('acc_accounting_periods')
        .select('year, month, is_closed')
        .eq('company_id', selectedCompany.id)
        .eq('is_closed', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch finalized VAT returns for the company
  const { data: finalizedVatReturns = [] } = useQuery({
    queryKey: ['acc-finalized-vat-returns-lock', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('vat_returns')
        .select('period_year, period_month, period_quarter, frequency, status')
        .eq('company_id', selectedCompany.id)
        .eq('status', 'finalized');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Check if an entry is locked due to closed period or finalized VAT
  const checkEntryLock = useCallback((entry: any): { locked: boolean; reason?: string } => {
    if (!entry?.posting_date) return { locked: false };
    const pDate = new Date(entry.posting_date);
    const year = pDate.getFullYear();
    const month = pDate.getMonth() + 1;
    const quarter = Math.ceil(month / 3);

    const isPeriodClosed = closedPeriods.some((p: any) => p.year === year && p.month === month && p.is_closed);
    if (isPeriodClosed) {
      return { locked: true, reason: `Lezárt számviteli időszak (${year}/${month}. hó)` };
    }

    const isVatFinalized = finalizedVatReturns.some((v: any) => {
      if (v.period_year !== year) return false;
      if (v.frequency === 'monthly' && v.period_month === month) return true;
      if (v.frequency === 'quarterly' && v.period_quarter === quarter) return true;
      if (v.frequency === 'annual') return true;
      return false;
    });
    if (isVatFinalized) {
      return { locked: true, reason: `Véglegesített ÁFA időszak (${year}/${month}. hó)` };
    }

    return { locked: false };
  }, [closedPeriods, finalizedVatReturns]);

  const effectiveJournalScope = filterCriteria.journalScope === 'ALL'
    ? 'ALL'
    : (filterCriteria.journalScope !== 'CURRENT' ? filterCriteria.journalScope : selectedJournalId);

  // Fetch entries
  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['acc-journal-entries', selectedCompany?.id, effectiveJournalScope, dateFrom, dateTo],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      let query = supabase
        .from('acc_journal_headers')
        .select(`
          *,
          journal:acc_journals(code, name),
          partner:partners(name),
          lines:acc_journal_lines(
            *,
            gl_account:gl_accounts(gl_number, short_name),
            project:projects(name)
          )
        `)
        .eq('company_id', selectedCompany.id);

      if (effectiveJournalScope === 'ALL') {
        // Minden napló – nem szűrünk journal_id-ra
      } else if (effectiveJournalScope === 'munkalista') {
        query = query.in('status', ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT']);
      } else {
        query = query.eq('journal_id', effectiveJournalScope);
      }

      if (dateFrom) query = query.gte('posting_date', dateFrom);
      if (dateTo) query = query.lte('posting_date', dateTo);

      const { data, error } = await query
        .order('posting_date', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id && !!effectiveJournalScope,
  });

  // Suggested next document ID based on the latest entry
  const suggestedNextDocumentId = React.useMemo(() => {
    const docIds = entries
      .map((e: any) => e.document_id)
      .filter(Boolean);
    if (docIds.length > 0) {
      return getNextDocumentId(docIds[0]);
    }
    return '';
  }, [entries]);

  // Keyboard shortcut: Insert key opens manual entry modal
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Insert' && !manualEntryOpen && !openingWizardOpen && !periodClosingOpen && !bulkDeleteDialogOpen) {
        const target = e.target as HTMLElement | null;
        const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
        if (!isInput) {
          e.preventDefault();
          setEditingEntryId(null);
          setCloneData(null);
          setManualEntryOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [manualEntryOpen, openingWizardOpen, periodClosingOpen, bulkDeleteDialogOpen]);

  // Source document query for selected entry (original bank statement PDF or invoice)
  const { data: sourceDocument } = useQuery({
    queryKey: ['acc-journal-source-doc', selectedEntry?.id, selectedEntry?.source, selectedEntry?.import_key, selectedEntry?.document_id],
    queryFn: async () => {
      if (!selectedEntry) return null;

      // 1. Bank transaction source
      if (selectedEntry.source === 'AUTO_BANK') {
        const txId = selectedEntry.import_key;
        if (!txId) return null;

        const { data: tx, error } = await supabase
          .from('transactions')
          .select('id, upload_id, upload:transaction_uploads(id, file_name, file_url)')
          .eq('id', txId)
          .maybeSingle();

        if (error) return null;
        const upload = (tx as any)?.upload;
        if (upload?.file_url) {
          return {
            type: 'bank' as const,
            title: upload.file_name || 'Banki kivonat',
            fileUrl: upload.file_url,
            bucket: 'transactions',
            fileName: upload.file_name || 'bankkivonat.pdf',
          };
        }
        return null;
      }

      // 2. Invoice source
      if (selectedEntry.source === 'AUTO_SZAMLA') {
        const docId = selectedEntry.document_id;
        const importKey = selectedEntry.import_key;

        // Try invoices table first (by id or bizonylatsorszam)
        if (importKey) {
          const { data: invById } = await supabase
            .from('invoices')
            .select('id, bizonylatsorszam, melleklet_url, image_url')
            .eq('id', importKey)
            .maybeSingle();

          if (invById) {
            return {
              type: 'invoice' as const,
              title: `Számla: ${invById.bizonylatsorszam}`,
              fileUrl: invById.melleklet_url || invById.image_url,
              bucket: 'invoice-uploads',
              fileName: `${invById.bizonylatsorszam || 'szamla'}.pdf`,
              invoiceId: invById.id,
            };
          }
        }

        if (docId) {
          const { data: invByDoc } = await supabase
            .from('invoices')
            .select('id, bizonylatsorszam, melleklet_url, image_url')
            .eq('bizonylatsorszam', docId)
            .maybeSingle();

          if (invByDoc) {
            return {
              type: 'invoice' as const,
              title: `Számla: ${invByDoc.bizonylatsorszam}`,
              fileUrl: invByDoc.melleklet_url || invByDoc.image_url,
              bucket: 'invoice-uploads',
              fileName: `${invByDoc.bizonylatsorszam || 'szamla'}.pdf`,
              invoiceId: invByDoc.id,
            };
          }

          // Try nav_invoices table (by invoice_number)
          const { data: navInv } = await supabase
            .from('nav_invoices')
            .select('id, invoice_number')
            .eq('invoice_number', docId)
            .maybeSingle();

          if (navInv) {
            return {
              type: 'invoice' as const,
              title: `NAV Számla: ${navInv.invoice_number}`,
              fileUrl: null,
              bucket: 'invoice-uploads',
              fileName: `${navInv.invoice_number}.pdf`,
              invoiceId: navInv.id,
            };
          }
        }

        return null;
      }

      return null;
    },
    enabled: !!selectedEntry && (selectedEntry.source === 'AUTO_BANK' || selectedEntry.source === 'AUTO_SZAMLA'),
    staleTime: 5 * 60 * 1000,
  });

  const handleDownloadSourceDoc = useCallback(async (fileUrl: string, fileName: string, bucket?: string) => {
    setDownloadingSourceDoc(true);
    try {
      if (bucket) {
        const storagePath = extractStoragePath(fileUrl, bucket);
        if (storagePath) {
          const { data, error } = await supabase.storage.from(bucket).download(storagePath);
          if (!error && data) {
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast({
              title: t('accounting:journals.toasts.download_success_title'),
              description: t('accounting:journals.toasts.download_success_desc', { fileName })
            });
            return;
          }
        }
      }
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({
        title: t('accounting:journals.toasts.download_success_title'),
        description: t('accounting:journals.toasts.download_success_desc', { fileName })
      });
    } catch (e: any) {
      toast({
        title: t('accounting:journals.toasts.download_error_title'),
        description: e?.message || t('accounting:journals.toasts.download_error_desc'),
        variant: 'destructive',
      });
    } finally {
      setDownloadingSourceDoc(false);
    }
  }, [toast, t]);

  // Canonical helper to invalidate all related caches across journals, GL, and VAT
  const invalidateGlAndJournalQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
    queryClient.invalidateQueries({ queryKey: ['acc-ny-entries-count'] });
    queryClient.invalidateQueries({ queryKey: ['acc-munkalista-count'] });
    queryClient.invalidateQueries({ queryKey: ['glBalances'] });
    queryClient.invalidateQueries({ queryKey: ['glItems'] });
    queryClient.invalidateQueries({ queryKey: ['glJournalItems'] });
    queryClient.invalidateQueries({ queryKey: ['glBalancesCurr'] });
    queryClient.invalidateQueries({ queryKey: ['glBalancesPrev'] });
    queryClient.invalidateQueries({ queryKey: ['subledger-reconciliation'] });
    queryClient.invalidateQueries({ queryKey: ['vat_period_posting_audit'] });
  }, [queryClient]);

  // Post entry mutation
  const postMutation = useMutation({
    mutationFn: async (headerId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Bejelentkezés szükséges");

      const { error } = await supabase.rpc('acc_post_journal_entry', {
        p_header_id: headerId,
        p_user_id: user.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateGlAndJournalQueries();
      toast({ title: t('accounting:journals.toasts.posted_success_title') });
    },
    onError: (err) => {
      toast({ title: t('accounting:journals.toasts.posted_error_title'), description: err.message, variant: "destructive" });
    }
  });

  // Resilient Bulk post mutation
  const bulkPostMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Bejelentkezés szükséges");

      // Sort IDs chronologically (posting_date ASC, document_date ASC, created_at ASC)
      // to ensure strictly chronological sequential numbering (e.g. P1/1, P1/2, ...)
      // regardless of current table sorting or display order
      const sortedIds = [...ids].sort((aId, bId) => {
        const a = entriesById.get(aId);
        const b = entriesById.get(bId);
        if (!a || !b) return 0;
        const dateA = a.posting_date || a.document_date || '';
        const dateB = b.posting_date || b.document_date || '';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        const docDateA = a.document_date || '';
        const docDateB = b.document_date || '';
        if (docDateA !== docDateB) return docDateA.localeCompare(docDateB);
        return (a.created_at || '').localeCompare(b.created_at || '');
      });

      const successes: string[] = [];
      const failures: { id: string; error: string }[] = [];

      for (const id of sortedIds) {
        const { error } = await supabase.rpc('acc_post_journal_entry', {
          p_header_id: id,
          p_user_id: user.id
        });
        if (error) {
          failures.push({ id, error: error.message });
        } else {
          successes.push(id);
        }
      }

      return { successes, failures, total: sortedIds.length };
    },
    onSettled: () => {
      // Always invalidate queries so UI immediately updates succeeded items
      invalidateGlAndJournalQueries();
    },
    onSuccess: ({ successes, failures, total }) => {
      if (failures.length === 0) {
        setSelectedEntryIds(new Set());
        toast({ title: t('accounting:journals.toasts.bulk_post_success_title', { total }) });
      } else if (successes.length > 0) {
        // Keep only failed IDs selected so user can easily retry or review
        setSelectedEntryIds(new Set(failures.map(f => f.id)));
        toast({
          title: t('accounting:journals.toasts.bulk_post_partial_title', { success: successes.length, fail: failures.length }),
          description: t('accounting:journals.toasts.bulk_post_partial_desc', { error: failures[0].error }),
          variant: "destructive"
        });
      } else {
        toast({
          title: t('accounting:journals.toasts.posted_error_title'),
          description: t('accounting:journals.toasts.bulk_post_none_desc', { error: failures[0].error }),
          variant: "destructive"
        });
      }
    },
    onError: (err) => {
      toast({ title: t('accounting:journals.toasts.posted_error_title'), description: err.message, variant: "destructive" });
    }
  });
  
  // Bulk update status mutation (for approval / discard)
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      const { error } = await supabase
        .from('acc_journal_headers')
        .update({ status })
        .in('id', ids);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      invalidateGlAndJournalQueries();
      setSelectedEntryIds(new Set());
      const label = STATUS_LABELS[variables.status]?.label || variables.status;
      toast({ title: t('accounting:journals.toasts.bulk_status_title', { label }) });
    },
    onError: (err) => {
      toast({ title: t('accounting:journals.toasts.bulk_status_error_title'), description: err.message, variant: "destructive" });
    }
  });

  // Bulk reassign GL account mutation
  const bulkReassignGlMutation = useMutation({
    mutationFn: async ({ headerIds, side, targetGlId }: { headerIds: string[]; side: 'T' | 'K'; targetGlId: string }) => {
      const { error } = await supabase
        .from('acc_journal_lines')
        .update({ gl_account_id: targetGlId })
        .in('header_id', headerIds)
        .eq('dc_type', side);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateGlAndJournalQueries();
      setBulkGlDialogOpen(false);
      setSelectedTargetGlId('');
      setSelectedEntryIds(new Set());
      toast({
        title: t('accounting:journals.toasts.bulk_gl_success_title', 'Főkönyvi számlaszám sikeresen módosítva!'),
        description: t('accounting:journals.toasts.bulk_gl_success_desc', { count: selectedEntryIds.size, defaultValue: `A kijelölt tételek kontírozása sikeresen frissítve.` })
      });
    },
    onError: (err: any) => {
      toast({
        title: t('accounting:journals.toasts.bulk_gl_error_title', 'Hiba a kontírozás módosításakor'),
        description: err.message,
        variant: "destructive"
      });
    }
  });

  // Storno entry mutation
  const stornoMutation = useMutation({
    mutationFn: async ({ headerId, reason, correct }: { headerId: string; reason: string; correct: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Bejelentkezés szükséges");

      const { data, error } = await supabase.rpc('acc_storno_journal_entry', {
        p_header_id: headerId,
        p_user_id: user.id,
        p_reason: reason,
        p_create_correction: correct
      });
      if (error) throw error;
      return { id: data, correct };
    },
    onSuccess: (res) => {
      invalidateGlAndJournalQueries();
      toast({ title: res.correct ? t('accounting:journals.toasts.storno_copy_title') : t('accounting:journals.toasts.storno_success_title') });
      if (res.correct && res.id) {
        setEditingEntryId(res.id);
        setManualEntryOpen(true);
      }
    },
    onError: (err) => {
      toast({ title: t('accounting:journals.toasts.storno_error_title'), description: err.message, variant: "destructive" });
    }
  });

  // Unpost entry mutation (direct edit in open period)
  const unpostMutation = useMutation({
    mutationFn: async ({ headerId, reason }: { headerId: string; reason?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Bejelentkezés szükséges");

      const { error } = await supabase.rpc('acc_unpost_journal_entry', {
        p_header_id: headerId,
        p_user_id: user.id,
        p_reason: reason || 'Tétel visszanyitva közvetlen javításra'
      });
      if (error) throw error;
      return headerId;
    },
    onSuccess: (headerId) => {
      invalidateGlAndJournalQueries();
      toast({
        title: t('accounting:journals.toasts.unpost_success_title'),
        description: t('accounting:journals.toasts.unpost_success_desc')
      });
      setEditingEntryId(headerId);
      setManualEntryOpen(true);
    },
    onError: (err: any) => {
      toast({ title: t('accounting:journals.toasts.unpost_error_title'), description: err.message, variant: "destructive" });
    }
  });

  // Delete draft mutation
  const deleteMutation = useMutation({
    mutationFn: async (headerId: string) => {
      const target = entriesById.get(headerId);
      if (target?.journal_number) {
        throw new Error(`A(z) ${target.journal?.code || ''}/${target.journal_number} számozott bizonylat a sorszámfolytonosság védelme miatt nem törölhető!`);
      }

      const { error: linesErr } = await supabase.from('acc_journal_lines').delete().eq('header_id', headerId);
      if (linesErr) throw linesErr;

      const { error: headerErr } = await supabase.from('acc_journal_headers').delete().eq('id', headerId);
      if (headerErr) throw headerErr;

      return headerId;
    },
    onSuccess: (deletedId) => {
      // Optimistically remove deleted item from query cache to prevent empty screen flashes
      queryClient.setQueriesData({ queryKey: ['acc-journal-entries'] }, (oldData: any) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.filter((item: any) => item.id !== deletedId);
      });
      setSelectedEntryIds(prev => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
      if (selectedEntry?.id === deletedId) {
        setSelectedEntry(null);
      }
      invalidateGlAndJournalQueries();
      toast({ title: t('accounting:journals.toasts.delete_success_title') });
    },
    onError: (err: any) => {
      toast({ title: t('accounting:journals.toasts.delete_error_title'), description: err.message, variant: "destructive" });
    }
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Filter out any entries with assigned journal numbers to protect gapless numbering
      const validDeletableIds = ids.filter(id => !entriesById.get(id)?.journal_number);
      const skippedCount = ids.length - validDeletableIds.length;

      if (validDeletableIds.length === 0) {
        throw new Error("A kijelölt tételek mindegyike rendelkezik hivatalos naplósorszámmal, így a sorszámfolytonosság védelme miatt nem törölhetőek.");
      }

      const { error: linesErr } = await supabase.from('acc_journal_lines').delete().in('header_id', validDeletableIds);
      if (linesErr) throw linesErr;

      const { error: headerErr } = await supabase.from('acc_journal_headers').delete().in('id', validDeletableIds);
      if (headerErr) throw headerErr;

      return { deletedIds: validDeletableIds, skippedCount };
    },
    onSuccess: ({ deletedIds, skippedCount }) => {
      const deletedSet = new Set(deletedIds);
      // Optimistically remove deleted items from query cache
      queryClient.setQueriesData({ queryKey: ['acc-journal-entries'] }, (oldData: any) => {
        if (!Array.isArray(oldData)) return oldData;
        return oldData.filter((item: any) => !deletedSet.has(item.id));
      });
      setSelectedEntryIds(new Set());
      if (selectedEntry && deletedSet.has(selectedEntry.id)) {
        setSelectedEntry(null);
      }
      invalidateGlAndJournalQueries();
      if (skippedCount > 0) {
        toast({
          title: t('accounting:journals.toasts.bulk_delete_partial_title', { deleted: deletedIds.length }),
          description: t('accounting:journals.toasts.bulk_delete_partial_desc', { skipped: skippedCount })
        });
      } else {
        toast({ title: t('accounting:journals.toasts.bulk_delete_success_title') });
      }
    },
    onError: (err: any) => {
      toast({ title: t('accounting:journals.toasts.delete_error_title'), description: err.message, variant: "destructive" });
    }
  });

  // Handle storno prompt
  const handleStorno = useCallback((entry: any, correct: boolean) => {
    setStornoTarget({ headerId: entry.id, correct, entry });
    setStornoReason('');
    setStornoOpen(true);
  }, []);

  const toggleSelectEntry = (id: string) => {
    setSelectedEntryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean, pageEntries: any[]) => {
    if (checked) {
      setSelectedEntryIds(new Set(pageEntries.map((e: any) => e.id)));
    } else {
      setSelectedEntryIds(new Set());
    }
  };

  // Memoized lookups for storno relationships
  const entriesById = React.useMemo(() => {
    const map = new Map<string, any>();
    entries.forEach((e: any) => map.set(e.id, e));
    return map;
  }, [entries]);

  const stornoMap = React.useMemo(() => {
    const map = new Map<string, any>();
    entries.forEach((e: any) => {
      if (e.stornoed_entry_id) {
        map.set(e.stornoed_entry_id, e);
      } else if (e.entry_type === 'SZTORNO' && e.original_entry_id) {
        map.set(e.original_entry_id, e);
      }
    });
    return map;
  }, [entries]);

  const selectedDraftIds = React.useMemo(() => {
    return Array.from(selectedEntryIds).filter((id) => {
      const e = entriesById.get(id);
      return e && ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status);
    });
  }, [selectedEntryIds, entriesById]);

  const journalNamesById = React.useMemo(() => {
    const map = new Map<string, string>();
    journals.forEach((j: any) => map.set(j.id, `${j.code} – ${j.name}`));
    return map;
  }, [journals]);

  const activeFilterCount = React.useMemo(() => {
    return getActiveFilterCount(filterCriteria);
  }, [filterCriteria]);

  const activeFilterChips = React.useMemo(() => {
    return getActiveFilterChips(filterCriteria, journalNamesById);
  }, [filterCriteria, journalNamesById]);

  // Filtered entries using RLB filterJournalEntries
  const filteredEntries = React.useMemo(() => {
    return filterJournalEntries(entries, filterCriteria, search, stornoFilter);
  }, [entries, filterCriteria, search, stornoFilter]);

  const totalItems = filteredEntries.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Auto-clamp currentPage if totalPages decreases due to deletions
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Shift-select and single select handler
  const handleRowSelect = useCallback(
    (targetId: string, index: number, isShiftKey: boolean, forcedChecked?: boolean) => {
      setFocusedIndex(index);

      setSelectedEntryIds((prev) => {
        const next = new Set(prev);

        if (
          isShiftKey &&
          lastSelectedIndex !== null &&
          lastSelectedIndex >= 0 &&
          lastSelectedIndex < paginatedEntries.length
        ) {
          // Range selection
          const start = Math.min(lastSelectedIndex, index);
          const end = Math.max(lastSelectedIndex, index);
          const shouldSelect = forcedChecked !== undefined ? forcedChecked : true;

          for (let i = start; i <= end; i++) {
            const item = paginatedEntries[i];
            if (item) {
              if (shouldSelect) {
                next.add(item.id);
              } else {
                next.delete(item.id);
              }
            }
          }
        } else {
          // Single toggle
          const shouldSelect = forcedChecked !== undefined ? forcedChecked : !prev.has(targetId);
          if (shouldSelect) {
            next.add(targetId);
          } else {
            next.delete(targetId);
          }
          setLastSelectedIndex(index);
        }

        return next;
      });
    },
    [lastSelectedIndex, paginatedEntries]
  );

  // Stable refs for keyboard handler to avoid listener thrashing
  const focusedIndexRef = useRef(focusedIndex);
  const lastSelectedIndexRef = useRef(lastSelectedIndex);
  const paginatedEntriesRef = useRef(paginatedEntries);

  useEffect(() => {
    focusedIndexRef.current = focusedIndex;
    lastSelectedIndexRef.current = lastSelectedIndex;
    paginatedEntriesRef.current = paginatedEntries;
  }, [focusedIndex, lastSelectedIndex, paginatedEntries]);

  // Keyboard navigation & spacebar row-by-row selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (
        manualEntryOpen ||
        openingWizardOpen ||
        uploadCoaOpen ||
        periodClosingOpen ||
        auditEntryId ||
        editingEntryId ||
        selectedEntry ||
        stornoOpen ||
        bulkGlDialogOpen ||
        bulkDeleteDialogOpen ||
        singleDeleteTarget
      ) {
        return;
      }

      const entries = paginatedEntriesRef.current;
      if (entries.length === 0) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();

        // Throttle key-repeat to 90ms (~11 rows/sec) so holding down Space never lags or starves React
        const now = performance.now();
        if (e.repeat && now - lastRepeatTimeRef.current < 90) {
          return;
        }
        lastRepeatTimeRef.current = now;

        const currentFocused = focusedIndexRef.current;
        const currentLastSelected = lastSelectedIndexRef.current;
        const currentIndex =
          currentFocused !== null && currentFocused >= 0 && currentFocused < entries.length
            ? currentFocused
            : 0;

        const currentEntry = entries[currentIndex];
        if (currentEntry) {
          if (e.shiftKey && currentLastSelected !== null) {
            // Shift + Space: Range selection from lastSelectedIndex to currentIndex
            const start = Math.min(currentLastSelected, currentIndex);
            const end = Math.max(currentLastSelected, currentIndex);
            setSelectedEntryIds((prev) => {
              const next = new Set(prev);
              for (let i = start; i <= end; i++) {
                const item = entries[i];
                if (item) next.add(item.id);
              }
              return next;
            });
          } else {
            // Space: Toggle current row and set lastSelectedIndex
            setSelectedEntryIds((prev) => {
              const next = new Set(prev);
              if (next.has(currentEntry.id)) {
                next.delete(currentEntry.id);
              } else {
                next.add(currentEntry.id);
              }
              return next;
            });
            setLastSelectedIndex(currentIndex);
          }

          // Advance focus down to next row so successive Space presses select row after row
          const nextIndex = Math.min(currentIndex + 1, entries.length - 1);
          setFocusedIndex(nextIndex);

          if (scrollRafRef.current !== null) {
            cancelAnimationFrame(scrollRafRef.current);
          }
          scrollRafRef.current = requestAnimationFrame(() => {
            const el = document.getElementById(`journal-row-${nextIndex}`);
            if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
          });
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();

        // Throttle key-repeat for arrow navigation
        const now = performance.now();
        if (e.repeat && now - lastRepeatTimeRef.current < 50) {
          return;
        }
        lastRepeatTimeRef.current = now;

        const currentFocused = focusedIndexRef.current;
        const currentLastSelected = lastSelectedIndexRef.current;
        const currentIndex = currentFocused !== null && currentFocused >= 0 ? currentFocused : -1;
        const nextIndex = Math.min(currentIndex + 1, entries.length - 1);

        if (e.shiftKey && currentLastSelected !== null) {
          const start = Math.min(currentLastSelected, nextIndex);
          const end = Math.max(currentLastSelected, nextIndex);
          setSelectedEntryIds((prev) => {
            const next = new Set(prev);
            for (let i = start; i <= end; i++) {
              const entry = entries[i];
              if (entry) next.add(entry.id);
            }
            return next;
          });
        }
        setFocusedIndex(nextIndex);

        if (scrollRafRef.current !== null) {
          cancelAnimationFrame(scrollRafRef.current);
        }
        scrollRafRef.current = requestAnimationFrame(() => {
          const el = document.getElementById(`journal-row-${nextIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        });
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();

        // Throttle key-repeat for arrow navigation
        const now = performance.now();
        if (e.repeat && now - lastRepeatTimeRef.current < 50) {
          return;
        }
        lastRepeatTimeRef.current = now;

        const currentFocused = focusedIndexRef.current;
        const currentLastSelected = lastSelectedIndexRef.current;
        const currentIndex = currentFocused !== null && currentFocused >= 0 ? currentFocused : 1;
        const prevIndex = Math.max(currentIndex - 1, 0);

        if (e.shiftKey && currentLastSelected !== null) {
          const start = Math.min(currentLastSelected, prevIndex);
          const end = Math.max(currentLastSelected, prevIndex);
          setSelectedEntryIds((prev) => {
            const next = new Set(prev);
            for (let i = start; i <= end; i++) {
              const entry = entries[i];
              if (entry) next.add(entry.id);
            }
            return next;
          });
        }
        setFocusedIndex(prevIndex);

        if (scrollRafRef.current !== null) {
          cancelAnimationFrame(scrollRafRef.current);
        }
        scrollRafRef.current = requestAnimationFrame(() => {
          const el = document.getElementById(`journal-row-${prevIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        });
        return;
      }

      if (e.key === 'Home') {
        e.preventDefault();
        const nextIndex = 0;
        const currentLastSelected = lastSelectedIndexRef.current;

        if (e.shiftKey && currentLastSelected !== null) {
          const start = 0;
          const end = currentLastSelected;
          setSelectedEntryIds((prev) => {
            const next = new Set(prev);
            for (let i = start; i <= end; i++) {
              const entry = entries[i];
              if (entry) next.add(entry.id);
            }
            return next;
          });
        }
        setFocusedIndex(nextIndex);

        if (scrollRafRef.current !== null) {
          cancelAnimationFrame(scrollRafRef.current);
        }
        scrollRafRef.current = requestAnimationFrame(() => {
          const el = document.getElementById(`journal-row-${nextIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        });
        return;
      }

      if (e.key === 'End') {
        e.preventDefault();
        const nextIndex = entries.length - 1;
        const currentLastSelected = lastSelectedIndexRef.current;

        if (e.shiftKey && currentLastSelected !== null) {
          const start = Math.min(currentLastSelected, nextIndex);
          const end = Math.max(currentLastSelected, nextIndex);
          setSelectedEntryIds((prev) => {
            const next = new Set(prev);
            for (let i = start; i <= end; i++) {
              const entry = entries[i];
              if (entry) next.add(entry.id);
            }
            return next;
          });
        }
        setFocusedIndex(nextIndex);

        if (scrollRafRef.current !== null) {
          cancelAnimationFrame(scrollRafRef.current);
        }
        scrollRafRef.current = requestAnimationFrame(() => {
          const el = document.getElementById(`journal-row-${nextIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        });
        return;
      }

      if (e.key === 'PageDown') {
        e.preventDefault();
        const currentFocused = focusedIndexRef.current ?? 0;
        const currentLastSelected = lastSelectedIndexRef.current;
        const nextIndex = Math.min(currentFocused + 10, entries.length - 1);

        if (e.shiftKey && currentLastSelected !== null) {
          const start = Math.min(currentLastSelected, nextIndex);
          const end = Math.max(currentLastSelected, nextIndex);
          setSelectedEntryIds((prev) => {
            const next = new Set(prev);
            for (let i = start; i <= end; i++) {
              const entry = entries[i];
              if (entry) next.add(entry.id);
            }
            return next;
          });
        }
        setFocusedIndex(nextIndex);

        if (scrollRafRef.current !== null) {
          cancelAnimationFrame(scrollRafRef.current);
        }
        scrollRafRef.current = requestAnimationFrame(() => {
          const el = document.getElementById(`journal-row-${nextIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        });
        return;
      }

      if (e.key === 'PageUp') {
        e.preventDefault();
        const currentFocused = focusedIndexRef.current ?? 0;
        const currentLastSelected = lastSelectedIndexRef.current;
        const prevIndex = Math.max(currentFocused - 10, 0);

        if (e.shiftKey && currentLastSelected !== null) {
          const start = Math.min(currentLastSelected, prevIndex);
          const end = Math.max(currentLastSelected, prevIndex);
          setSelectedEntryIds((prev) => {
            const next = new Set(prev);
            for (let i = start; i <= end; i++) {
              const entry = entries[i];
              if (entry) next.add(entry.id);
            }
            return next;
          });
        }
        setFocusedIndex(prevIndex);

        if (scrollRafRef.current !== null) {
          cancelAnimationFrame(scrollRafRef.current);
        }
        scrollRafRef.current = requestAnimationFrame(() => {
          const el = document.getElementById(`journal-row-${prevIndex}`);
          if (el) el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (scrollRafRef.current !== null) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, [
    manualEntryOpen,
    openingWizardOpen,
    uploadCoaOpen,
    periodClosingOpen,
    auditEntryId,
    editingEntryId,
    selectedEntry,
    stornoOpen,
    bulkGlDialogOpen,
    bulkDeleteDialogOpen,
    singleDeleteTarget,
  ]);

  const selectedJournal = journals.find((j: any) => j.id === selectedJournalId);
  const isNyJournal = selectedJournal?.code === 'NY';
  const isSystemLocked = selectedJournal ? isJournalSystemLocked(selectedJournal) : false;

  const handleOpenOpeningWizard = useCallback(() => {
    const nyJ = journals.find((j: any) => j.code === 'NY');
    if (nyJ) {
      setSelectedJournalId(nyJ.id);
    }
    setOpeningWizardOpen(true);
  }, [journals]);

  return (
    <TooltipProvider>
      <div className="flex flex-col space-y-4 p-6 min-h-[calc(100vh-4rem)] bg-background">
      <PageHeader
        companyName={selectedCompany?.name}
        breadcrumb={t('accounting:journals.breadcrumb', 'Könyvelési Naplók')}
        title={t('accounting:journals.title', 'Könyvelési Naplók')}
        description={t('accounting:journals.description', 'A vállalkozás kettős könyvvitelének naplónemenkénti, idősoros és zárt nyilvántartása.')}
        actions={
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button
                  size="default"
                  onClick={handleOpenOpeningWizard}
                  className="h-9 px-4 gap-2 font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:via-teal-500 hover:to-emerald-600 text-white shadow-md shadow-emerald-950/20 dark:shadow-emerald-900/30 border border-emerald-400/40 ring-2 ring-emerald-500/20 hover:ring-emerald-500/40 transition-all hover:scale-[1.02] active:scale-[0.98] shrink-0"
                >
                  <BookOpen className="w-4 h-4 text-emerald-100 shrink-0" />
                  <span>{t('accounting:journals.opening_entries_btn', 'Nyitó tételek')}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                <p className="font-semibold">{t('accounting:journals.opening_entries_tooltip_title', 'Nyitó tételek & Varázsló')}</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  {t('accounting:journals.opening_entries_tooltip_desc', 'Előző évi mérleg és főkönyv nyitása a 491. Nyitómérleg számlával szemben, Audit XML / CSV importálás és egyeztetés.')}
                </p>
              </TooltipContent>
            </Tooltip>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPeriodClosingOpen(true)}>
                  <Lock className="w-4 h-4" /> {t('accounting:journals.period_closing', 'Időszakzárás')}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                <p className="font-semibold">{t('accounting:journals.period_closing_tooltip_title', 'Naptári időszakok zárolása (év / hónap)')}</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">
                  {t('accounting:journals.period_closing_tooltip_desc', 'A könyvelési hónapok végleges zárolása. Megakadályozza az új tételek rögzítését a zárt időszakba. Egyedi bizonylatok véglegesítéséhez használd a lekönyvelést.')}
                </p>
              </TooltipContent>
            </Tooltip>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 shadow-2xs"
              onClick={() => setRulesDialogOpen(true)}
            >
              <Sliders className="w-4 h-4 text-primary" />
              <span>{t('accounting:journals.accounting_rules', { defaultValue: 'Könyvelési szabályok' })}</span>
            </Button>
            <AccountingRulesDialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen} />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10 hover:text-indigo-700 dark:border-indigo-500/30 dark:text-indigo-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
              onClick={() => generateDraftsMutation.mutate()}
              disabled={generateDraftsMutation.isPending || !activePresetId}
            >
              {generateDraftsMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
              {t('accounting:journals.generate_drafts', 'Javaslatok generálása')}
            </Button>
            <Tooltip delayDuration={200}>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    className="gap-1.5 shadow-sm"
                    disabled={isSystemLocked}
                    onClick={() => { setEditingEntryId(null); setCloneData(null); setManualEntryOpen(true); }}
                  >
                    <Plus className="w-4 h-4" /> {t('accounting:journals.new_manual_entry', 'Új vegyes bizonylat')}
                    <kbd className="hidden sm:inline-flex ml-1 px-1.5 py-0.5 text-[10px] font-mono rounded bg-primary-foreground/20 text-primary-foreground">Ins</kbd>
                  </Button>
                </span>
              </TooltipTrigger>
              {isSystemLocked && (
                <TooltipContent side="bottom" className="text-xs">
                  A(z) {selectedJournal?.code} egy zárt automatikus rendszer-napló, ide kézi bizonylat nem rögzíthető.
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        }
      />

      {/* EB-0257: Category Filter Tabs & Quick Jump Dropdown */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none max-w-full">
          <Button
            type="button"
            variant={activeCategoryKey === 'ALL' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5 rounded-full"
            onClick={() => setActiveCategoryKey('ALL')}
          >
            Összes napló
            <span className="ml-1.5 px-1.5 py-0.2 text-[10px] rounded-full bg-background/20 font-mono">
              {journals.length}
            </span>
          </Button>

          {JOURNAL_CATEGORIES.filter(c => c.key !== 'ALL').map((cat) => {
            const count = categoryCounts[cat.key] || 0;
            return (
              <Button
                key={cat.key}
                type="button"
                variant={activeCategoryKey === cat.key ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5 rounded-full"
                onClick={() => {
                  setActiveCategoryKey(cat.key);
                  if (selectedJournalId !== 'munkalista') {
                    const inCat = journals.find((j: any) => getJournalCategory(j) === cat.key);
                    if (inCat && getJournalCategory(selectedJournal || {}) !== cat.key) {
                      setSelectedJournalId(inCat.id);
                    }
                  }
                }}
              >
                <span>{cat.label}</span>
                {cat.codeRange && (
                  <span className="ml-1 text-[10px] opacity-75 font-mono">({cat.codeRange})</span>
                )}
                <span className="ml-1.5 px-1.5 py-0.2 text-[10px] rounded-full bg-muted font-mono">
                  {count}
                </span>
              </Button>
            );
          })}
        </div>

        {/* Quick Jump Dropdown & Layout Mode Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <Tooltip delayDuration={200}>
            <TooltipTrigger asChild>
              <Button
                variant={isWrapLayout ? "secondary" : "outline"}
                size="sm"
                className="h-8 px-2.5 gap-1.5 text-xs font-medium border-border"
                onClick={() => {
                  setIsWrapLayout(prev => {
                    const next = !prev;
                    try { localStorage.setItem('visibill_journals_wrap_layout', String(next)); } catch (e) {}
                    return next;
                  });
                }}
              >
                {isWrapLayout ? (
                  <>
                    <LayoutGrid className="w-3.5 h-3.5 text-primary" />
                    <span className="hidden sm:inline">Többsoros nézet</span>
                  </>
                ) : (
                  <>
                    <ChevronsLeftRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="hidden sm:inline">Görgethető nézet</span>
                  </>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs shadow-md">
              {isWrapLayout ? 'Váltás vízszintesen görgethető egy soros nézetre' : 'Váltás többsoros elrendezésre (hogy minden napló egyszerre látszódjon)'}
            </TooltipContent>
          </Tooltip>

          <Select 
            value={selectedJournalId} 
            onValueChange={(val) => {
              setSelectedJournalId(val);
              if (val !== 'munkalista') {
                const target = journals.find((j: any) => j.id === val);
                if (target) {
                  const cat = getJournalCategory(target);
                  setActiveCategoryKey(cat);
                }
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs w-[240px]">
              <SelectValue placeholder="Gyors naplóválasztó..." />
            </SelectTrigger>
            <SelectContent className="max-h-[360px] z-[1200]">
              <SelectItem value="munkalista" className="font-semibold text-primary">
                ⚠️ Munkalista ({munkalistaCount} piszkozat)
              </SelectItem>
              {JOURNAL_CATEGORIES.filter(c => c.key !== 'ALL').map((cat) => {
                const catJournals = journals.filter((j: any) => getJournalCategory(j) === cat.key);
                if (catJournals.length === 0) return null;
                return (
                  <div key={cat.key} className="py-1">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40">
                      {cat.label} ({cat.codeRange})
                    </div>
                    {catJournals.map((j: any) => (
                      <SelectItem key={j.id} value={j.id} className="text-xs pl-4 font-mono">
                        <span className="font-bold mr-1.5">{j.code}</span>
                        <span>{getLocalizedJournalName(j, j.name, t)}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">({j.currency})</span>
                        {isJournalSystemLocked(j) && (
                          <span className="ml-1 text-[9px] text-amber-600 dark:text-amber-400">🔒</span>
                        )}
                      </SelectItem>
                    ))}
                  </div>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Journals Selector (Wrap or Scroll with Navigation Controls) */}
      <div className="relative w-full group">
        {!isWrapLayout && canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollByAmount(-280)}
            className="absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-background/95 hover:bg-background border border-border shadow-md flex items-center justify-center text-foreground transition-all hover:scale-110"
            aria-label="Görgetés balra"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          onWheel={(e) => {
            if (!isWrapLayout && e.deltaY !== 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }}
          className={cn(
            "w-full flex items-center gap-1.5 select-none transition-all",
            isWrapLayout
              ? "flex-wrap py-1.5 min-h-[3.5rem]"
              : "overflow-x-auto scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground/40 scroll-smooth py-1 min-h-[3.5rem]"
          )}
        >
          <button
            onClick={() => setSelectedJournalId('munkalista')}
            className={cn(
              "flex items-center gap-3 pl-3 pr-4 h-12 rounded-lg text-xs transition-all border shrink-0 justify-between text-left",
              selectedJournalId === 'munkalista'
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card hover:bg-muted/60 text-muted-foreground border-border"
            )}
          >
            <div className="flex items-center gap-1.5 min-w-0 shrink-0">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <div className="flex flex-col leading-tight min-w-0 pr-1 shrink-0">
                <span className={cn("font-bold text-[11px] leading-tight whitespace-nowrap", selectedJournalId === 'munkalista' ? "text-primary-foreground" : "text-foreground")}>
                  {t('accounting:journals.worklist', 'Munkalista')}
                </span>
                <span className={cn("text-[8px] leading-none whitespace-nowrap", selectedJournalId === 'munkalista' ? "text-primary-foreground/80" : "text-muted-foreground")}>
                  {t('accounting:journals.drafts_sub', 'Drafts')}
                </span>
              </div>
            </div>
            <Badge variant={selectedJournalId === 'munkalista' ? 'secondary' : 'outline'} className="px-1.5 py-0.5 text-[8px] shrink-0 font-normal mr-1">
              {t('accounting:journals.pending_badge', {
                count: munkalistaCount,
                defaultValue: `${munkalistaCount} db jóváhagyásra vár`,
              })}
            </Badge>
          </button>

          {loadingJournals ? (
            <div className="flex items-center pl-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
          ) : (
            visibleJournals.map((j: any) => {
              const locked = isJournalSystemLocked(j);
              return (
                <Tooltip key={j.id} delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        setSelectedJournalId(j.id);
                        if (j.code === 'NY' && nyEntriesCount === 0) {
                          setOpeningWizardOpen(true);
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 pl-3 pr-3 h-12 rounded-lg text-xs transition-all border shrink-0 text-left justify-between min-w-[120px]",
                        selectedJournalId === j.id
                          ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                          : "bg-card hover:bg-muted/60 text-muted-foreground border-border"
                      )}
                    >
                      <div className="flex flex-col min-w-0 pr-1 leading-tight flex-1">
                        <div className="flex items-center gap-1">
                          <span className={cn("font-bold text-[11px] leading-tight truncate", selectedJournalId === j.id ? "text-primary-foreground" : "text-foreground")}>
                            {j.code}
                          </span>
                          {locked && (
                            <Lock className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                          )}
                        </div>
                        <span className={cn("text-[8px] leading-none truncate max-w-[100px]", selectedJournalId === j.id ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          {getLocalizedJournalName(j, j.name, t)}
                        </span>
                      </div>
                      <Badge variant={selectedJournalId === j.id ? 'secondary' : 'outline'} className="px-1.5 py-0.5 text-[8px] shrink-0 font-normal">
                        {j.currency}
                      </Badge>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="p-2 text-xs shadow-md">
                    <p className="font-semibold text-popover-foreground">
                      {j.code} - {getLocalizedJournalName(j, j.name, t)}
                      {locked && " 🔒 (Zárt gépi napló)"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {t('accounting:journals.currency_label', { currency: j.currency, defaultValue: `Pénznem: ${j.currency}` })}
                    </p>
                    {j.bank_account_number && (
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        Bankszámla: {j.bank_account_number}
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })
          )}

          {/* Manage Journals Button */}
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setManageJournalsOpen(true)}
                className="flex items-center gap-1.5 px-3 h-12 rounded-lg text-xs transition-all border border-dashed border-border hover:border-primary/50 hover:bg-muted/50 text-muted-foreground hover:text-foreground shrink-0"
                title="Naplótörzs kezelése / Új napló"
              >
                <Settings2 className="w-3.5 h-3.5 text-primary" />
                <span className="font-semibold text-[11px] whitespace-nowrap">Naplók kezelése</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="p-2 text-xs shadow-md">
              <p className="font-semibold text-popover-foreground">Könyvelési Naplótörzs Kezelése</p>
              <p className="text-[10px] text-muted-foreground">Új napló felvétele, meglévő naplók átnevezése és testreszabása.</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {!isWrapLayout && canScrollRight && (
          <button
            type="button"
            onClick={() => scrollByAmount(280)}
            className="absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-background/95 hover:bg-background border border-border shadow-md flex items-center justify-center text-foreground transition-all hover:scale-110"
            aria-label="Görgetés jobbra"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-4 items-start">
        {/* Full-width list table */}
        <div className="col-span-12 space-y-4">
          {/* EB-0257: System Locked Journal Banner */}
          {isSystemLocked && selectedJournal && (
            <Card className="border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm flex items-center gap-2 text-amber-900 dark:text-amber-200">
                    <span>Zárt automatikus rendszer-napló ({selectedJournal.code} - {selectedJournal.name})</span>
                    <Badge variant="outline" className="border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 text-[10px]">
                      Gépi zárású napló
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ez a napló kizárólag automatikus gépi zárásokhoz, tárgyi eszköz écs-hez vagy évközi árfolyam-különbözetekhez van fenntartva. Kézi bizonylat rögzítése, valamint meglévő tételek módosítása vagy törlése tiltott.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Special NY (Nyitó Napló) Banner */}
          {isNyJournal && (
            <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 text-primary rounded-xl">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <span>{t('accounting:journals.opening.banner_title', 'Nyitó Napló (NY) — Sztv. 491. Nyitó mérleg számla')}</span>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        {t('accounting:journals.opening.continuity_badge', 'Mérlegfolytonosság')}
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('accounting:journals.opening.banner_desc', 'Minden nyitás a 491. Nyitó mérleg számlával szemben történik (Kötelező validáció: Σ T = Σ K). (492 a Záró mérleg számla).')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10 shadow-2xs" 
                    onClick={() => setUploadCoaOpen(true)}
                  >
                    <FileSpreadsheet className="w-4 h-4" /> {t('accounting:journals.opening.upload_coa', 'Számlatükör importálása')}
                  </Button>
                  <Button size="sm" className="gap-1.5 shadow-sm" onClick={() => setOpeningWizardOpen(true)}>
                    <BookOpen className="w-4 h-4" /> {t('accounting:journals.opening.start_wizard', 'Nyitó Varázsló indítása')}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Filters & RLB Szűkítés */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('accounting:journals.filters.search_placeholder', 'Keresés (partner, bizonylatszám, megnevezés...)')}
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 bg-card border-border shadow-none"
                />
              </div>

              {/* RLB Szűkítés Button */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant={activeFilterCount > 0 ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsFilterModalOpen(true)}
                  className={cn(
                    "gap-1.5 h-9 font-medium shadow-2xs transition-all",
                    activeFilterCount > 0
                      ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
                      : "border-border text-foreground hover:bg-muted/50"
                  )}
                  title="RLB stílusú részletes szűkítés megnyitása"
                >
                  <Sliders className="w-4 h-4 text-amber-500" />
                  <span>{t('accounting:journals.filters.narrow_down', 'Szűkítés')}</span>
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px] bg-white text-amber-900 font-bold rounded-full">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>

                {activeFilterCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                    title="Minden szűkítés és szűrő visszaállítása"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Alaphelyzet</span>
                  </Button>
                )}
              </div>

              <div className="flex items-center bg-muted/40 p-1 rounded-lg border border-border shrink-0 text-xs">
                <button
                  type="button"
                  onClick={() => { setStornoFilter('all'); setCurrentPage(1); }}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-all text-xs font-medium",
                    stornoFilter === 'all' ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t('accounting:journals.filters.all', 'Összes tétel')}
                </button>
                <button
                  type="button"
                  onClick={() => { setStornoFilter('active'); setCurrentPage(1); }}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-all text-xs font-medium",
                    stornoFilter === 'active' ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t('accounting:journals.filters.active', 'Aktív tételek')}
                </button>
                <button
                  type="button"
                  onClick={() => { setStornoFilter('storno'); setCurrentPage(1); }}
                  className={cn(
                    "px-2.5 py-1 rounded-md transition-all text-xs font-medium flex items-center gap-1",
                    stornoFilter === 'storno' ? "bg-background text-amber-600 dark:text-amber-400 shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                  {t('accounting:journals.filters.storno', 'Sztornó tételek')}
                </button>
              </div>
            </div>

            {/* Active Filter Chips */}
            {activeFilterChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 py-1 text-xs">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1">
                  Aktív szűkítések:
                </span>
                {activeFilterChips.map((chip) => (
                  <Badge
                    key={chip.id}
                    variant="secondary"
                    className="gap-1 pl-2 pr-1 py-0.5 text-xs bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-500/30 font-medium"
                  >
                    <span>{chip.label}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFilterChip(chip.id)}
                      className="ml-0.5 p-0.5 rounded-full hover:bg-amber-500/20 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Szűrő feltétel eltávolítása"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline font-medium ml-1 cursor-pointer"
                >
                  Összes törlése
                </button>
              </div>
            )}
          </div>

          {/* Guidance Banner for Pending Drafts & System Proposals */}
          {(() => {
            const draftProposals = filteredEntries.filter((e: any) => ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status));
            if (draftProposals.length === 0) return null;
            return (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-md shrink-0 mt-0.5 sm:mt-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <span>
                        {t('accounting:journals.guidance_banner.title', {
                          count: draftProposals.length,
                          defaultValue: `${draftProposals.length} db lekönyvelésre váró könyvelési javaslat`,
                        })}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 py-0 font-medium">
                        {t('accounting:journals.guidance_banner.pending_badge', {
                          count: draftProposals.length,
                          defaultValue: `${draftProposals.length} db jóváhagyásra vár`,
                        })}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                      {t('accounting:journals.guidance_banner.description', 'A rendszerjavaslatok az ellenőrzést és lekönyvelést követően kapnak hivatalos naplósorszámot és válnak zárt, módosításvédett könyvelési tétellé.')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/15"
                    onClick={() => {
                      const draftIds = draftProposals.map((e: any) => e.id);
                      setSelectedEntryIds(new Set(draftIds));
                    }}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t('accounting:journals.guidance_banner.select_all_proposals', {
                      count: draftProposals.length,
                      defaultValue: `Összes javaslat kijelölése (${draftProposals.length})`,
                    })}
                  </Button>
                </div>
              </div>
            );
          })()}

          {/* Top Pagination */}
          {totalItems > 0 && (
            <UnifiedPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={itemsPerPage}
              onPageChange={setCurrentPage}
              onPageSizeChange={(newSize) => {
                setItemsPerPage(newSize);
                setCurrentPage(1);
              }}
              pageSizeOptions={[50, 100, 200]}
              className="py-1"
            />
          )}

          {/* List Table Container */}
          <div className="rounded-lg border border-border/50 bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <Table className="compact-table w-full table-fixed min-w-[1260px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 border-b border-border/40 text-muted-foreground select-none uppercase font-semibold text-[10px] tracking-wider">
                    <TableHead className="w-[68px] text-center p-0">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleAllExpand(paginatedEntries)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title={
                            paginatedEntries.length > 0 && paginatedEntries.every((e: any) => expandedEntryIds.has(e.id))
                              ? t('accounting:journals.table.collapse_all', 'Összes becsukása')
                              : t('accounting:journals.table.expand_all', 'Összes lenyitása')
                          }
                        >
                          {paginatedEntries.length > 0 && paginatedEntries.every((e: any) => expandedEntryIds.has(e.id)) ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        {(() => {
                          const isAllSelected =
                            paginatedEntries.length > 0 &&
                            paginatedEntries.every((e: any) => selectedEntryIds.has(e.id));
                          const isSomeSelected =
                            paginatedEntries.some((e: any) => selectedEntryIds.has(e.id));

                          return (
                            <Checkbox
                              checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                              disabled={paginatedEntries.length === 0}
                              onCheckedChange={(checked) => handleSelectAll(!!checked, paginatedEntries)}
                              aria-label={t('accounting:journals.table.select_all_items_aria', 'Összes tétel kijelölése ezen az oldalon')}
                            />
                          );
                        })()}
                      </div>
                    </TableHead>
                    <TableHead className="w-[95px] whitespace-nowrap">{t('accounting:journals.table.col_date', 'Dátum')}</TableHead>
                    <TableHead className="w-[125px] whitespace-nowrap">{t('accounting:journals.table.col_journal_num', 'Naplószám')}</TableHead>
                    <TableHead className="w-[160px] whitespace-nowrap">{t('accounting:journals.table.col_doc_num', 'Bizonylatszám')}</TableHead>
                    <TableHead className="w-[170px] whitespace-nowrap">{t('accounting:journals.table.col_partner', 'Partner')}</TableHead>
                    <TableHead className="w-auto min-w-[180px]">{t('accounting:journals.table.col_description', 'Megnevezés')}</TableHead>
                    <TableHead className="w-[130px] text-center whitespace-nowrap">{t('accounting:journals.table.col_gl_accounts', 'Kontír (T / K)')}</TableHead>
                    <TableHead className="w-[140px] text-right whitespace-nowrap">{t('accounting:journals.table.col_amount', 'Összeg')}</TableHead>
                    <TableHead className="w-[100px] text-center whitespace-nowrap">{t('accounting:journals.table.col_type', 'Típus')}</TableHead>
                    <TableHead className="w-[130px] text-center whitespace-nowrap">{t('accounting:journals.table.col_status', 'Státusz')}</TableHead>
                    <TableHead className="w-[135px] text-right whitespace-nowrap">{t('accounting:journals.table.col_actions', 'Műveletek')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/20">
                  {loadingEntries ? (
                    <TableSkeleton columns={11} rows={8} />
                  ) : filteredEntries.length === 0 ? (
                    <TableEmptyState
                      colSpan={11}
                      icon={search || activeFilterCount > 0 ? Search : FileText}
                      title={
                        activeFilterCount > 0
                          ? 'Nincs a szűkítési feltételeknek megfelelő naplótétel'
                          : search
                            ? t('accounting:journals.table.empty_search_title', 'Nincs találat a megadott keresési feltételekre')
                            : t('accounting:journals.table.empty_view_title', 'Nincsenek tételek ebben a nézetben')
                      }
                      description={
                        activeFilterCount > 0
                          ? 'Próbáld módosítani a szűkítést, vagy állítsd vissza a szűrőket az alapértelmezettre.'
                          : search
                            ? t('accounting:journals.table.empty_search_desc', 'Próbáld módosítani a keresési feltételt vagy törölni a szűrőt.')
                            : t('accounting:journals.table.empty_view_desc', 'Ehhez a naplóhoz még nem tartoznak könyvelési tételek a megadott időszakban.')
                      }
                      onClearFilters={search || activeFilterCount > 0 ? handleResetFilters : undefined}
                      clearLabel={activeFilterCount > 0 ? 'Szűkítések törlése' : t('accounting:journals.table.clear_search', 'Keresés törlése')}
                    />
                  ) : (
                    <>
                      {paginatedEntries.map((e: any, index: number) => {
                        const isForeign = e.currency && e.currency !== 'HUF';
                        const isStornoEntry = e.entry_type === 'SZTORNO';
                        const isStornoedOriginal = e.status === 'SZTORNOZOTT';
                        // Resolve daily exchange rate for the posting date
                        const headerRate = Number(e.exchange_rate) || 0;
                        const rate = headerRate > 1 ? headerRate : getDailyRate(e.currency, e.posting_date);

                        const rawTotalAmount = e.lines?.reduce((acc: number, l: any) => {
                          if (l.dc_type !== 'T') return acc;
                          let val: number;
                          if (isForeign) {
                            if (l.foreign_amount != null && Number(l.foreign_amount) > 0) {
                              val = Number(l.foreign_amount);
                            } else if (rate > 1 && Number(l.amount) > 0) {
                              val = Number((Number(l.amount) / rate).toFixed(2));
                            } else {
                              val = Number(l.amount);
                            }
                          } else {
                            val = Number(l.amount);
                          }
                          return acc + val;
                        }, 0) || 0;
                        const totalAmount = isStornoEntry ? -Math.abs(rawTotalAmount) : rawTotalAmount;

                        // Calculate HUF amount:
                        // 1. If line amounts in DB are already converted, sum them
                        const linesHufSum = isForeign
                          ? e.lines?.reduce((acc: number, l: any) => l.dc_type === 'T' ? acc + Number(l.amount) : acc, 0) || 0
                          : 0;

                        // 2. If lines were already converted, use linesHufSum. Otherwise calculate directly using that day's exchange rate
                        const rawHufAmount = isForeign
                          ? (linesHufSum > 0 && Math.abs(linesHufSum - rawTotalAmount) > 0.01 
                              ? linesHufSum 
                              : (rate > 1 && linesHufSum > 0 ? linesHufSum : rawTotalAmount * rate))
                          : 0;
                        const hufAmount = isStornoEntry ? -Math.abs(rawHufAmount) : rawHufAmount;

                        const statusInfo = getStatusInfo(e.status, t);
                        const journalNum = e.journal_number ? `${e.journal?.code}/${e.journal_number}` : '—';
                        const isDraft = ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status);
                        
                        const origRefEntry = isStornoEntry ? entriesById.get(e.stornoed_entry_id || e.original_entry_id) : null;
                        const stornoRefEntry = isStornoedOriginal ? stornoMap.get(e.id) : null;
                        const isExpanded = expandedEntryIds.has(e.id);
                        const entryItems = deriveJournalItems(e);
                        const totalNet = entryItems.reduce((acc, it) => acc + it.net, 0);
                        const totalVat = entryItems.reduce((acc, it) => acc + it.vat, 0);
                        const totalForeignNet = entryItems.reduce((acc, it) => acc + (it.foreignNet || 0), 0);
                        const totalForeignVat = entryItems.reduce((acc, it) => acc + (it.foreignVat || 0), 0);

                        return (
                          <React.Fragment key={e.id}>
                          <TableRow
                            key={e.id}
                            id={`journal-row-${index}`}
                            tabIndex={0}
                            onClick={(ev) => {
                              const target = ev.target as HTMLElement;
                              if (target.closest('button') || target.closest('input') || target.closest('[data-no-row-select]')) {
                                return;
                              }
                              handleRowSelect(e.id, index, ev.shiftKey);
                            }}
                            className={cn(
                              "h-[45px] cursor-pointer select-none relative transition-none",
                              isStornoEntry && "bg-amber-500/5 hover:bg-amber-500/10",
                              isStornoedOriginal && "bg-rose-500/5 hover:bg-rose-500/10",
                              isExpanded && "bg-muted/20 border-b-0",
                              selectedEntryIds.has(e.id)
                                ? "bg-sky-500/20 dark:bg-sky-500/25 font-medium"
                                : "hover:bg-muted/20",
                              focusedIndex === index &&
                                "outline outline-2 outline-sky-400 dark:outline-sky-400 -outline-offset-2 bg-sky-500/[0.28] dark:bg-sky-400/[0.30] shadow-[0_0_12px_rgba(56,189,248,0.4)] z-20"
                            )}
                          >
                            <TableCell className="w-[68px] text-center p-0 relative">
                              {focusedIndex === index && (
                                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-sky-400 dark:bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)] rounded-r z-30" />
                              )}
                              <div className="flex items-center justify-center gap-0.5">
                                {e.lines && e.lines.length > 0 ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      handleToggleExpand(e.id);
                                    }}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                    title={isExpanded ? t('accounting:journals.table.collapse_entry', 'Tételek becsukása') : t('accounting:journals.table.expand_entry', 'Tételek lenyitása')}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                    ) : (
                                      <ChevronRight className="w-3.5 h-3.5" />
                                    )}
                                  </Button>
                                ) : (
                                  <span className="w-6 h-6 inline-block" />
                                )}
                                <Checkbox
                                  checked={selectedEntryIds.has(e.id)}
                                  onCheckedChange={(checked) => {
                                    handleRowSelect(e.id, index, false, !!checked);
                                  }}
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    if (ev.shiftKey) {
                                      handleRowSelect(e.id, index, true);
                                    }
                                  }}
                                  aria-label={t('accounting:journals.table.select_item_aria', { id: e.document_id || e.id })}
                                />
                                {!isDraft && (
                                  (() => {
                                    if (e.status === 'SZTORNOZOTT') {
                                      return (
                                        <CustomTooltip content={t('accounting:journals.table.lock_stornoed', 'Sztornózott tétel (lezárt)')}>
                                          <span className="inline-flex items-center justify-center cursor-help text-muted-foreground/35 hover:text-muted-foreground/60 transition-colors ml-0.5">
                                            <Lock className="w-3.5 h-3.5" />
                                          </span>
                                        </CustomTooltip>
                                      );
                                    }
                                    const lock = checkEntryLock(e);
                                    if (lock.locked) {
                                      return (
                                        <CustomTooltip content={t('accounting:journals.table.lock_closed', { reason: lock.reason, defaultValue: `Lekönyvelt zárt tétel (${lock.reason})` })}>
                                          <span className="inline-flex items-center justify-center cursor-help text-amber-500/80 hover:text-amber-600 transition-colors ml-0.5">
                                            <Lock className="w-3.5 h-3.5" />
                                          </span>
                                        </CustomTooltip>
                                      );
                                    }
                                    return (
                                      <CustomTooltip content={t('accounting:journals.table.lock_open', 'Nyitott könyvelt tétel')}>
                                        <span className="inline-flex items-center justify-center cursor-help text-muted-foreground/35 hover:text-muted-foreground/60 transition-colors ml-0.5">
                                          <Lock className="w-3.5 h-3.5" />
                                        </span>
                                      </CustomTooltip>
                                    );
                                  })()
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="w-[95px] font-mono text-muted-foreground whitespace-nowrap">
                              {e.posting_date.replace(/-/g, '.')}
                            </TableCell>
                            <TableCell className="w-[125px] font-semibold text-foreground whitespace-nowrap truncate">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{journalNum}</span>
                                {entryItems.length > 1 && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-semibold px-1.5 py-0 shrink-0 cursor-pointer"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      handleToggleExpand(e.id);
                                    }}
                                    title={t('accounting:journals.table.items_count_badge', '{{count}} tétel — kattints a lenyitáshoz', { count: entryItems.length })}
                                    data-no-row-select="true"
                                  >
                                    {entryItems.length} tétel
                                  </Badge>
                                )}
                              </div>
                              {isStornoEntry && (
                                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-mono block leading-tight truncate">
                                  ↩ {origRefEntry ? `${origRefEntry.journal?.code}/${origRefEntry.journal_number}` : t('accounting:journals.table.storno_original_ref')}
                                </span>
                              )}
                              {isStornoedOriginal && (
                                <span className="text-[9px] text-rose-500 dark:text-rose-400 font-mono block leading-tight truncate">
                                  ❌ {stornoRefEntry ? `${stornoRefEntry.journal?.code}/${stornoRefEntry.journal_number}` : t('accounting:journals.table.storno_stornoed_ref')}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="w-[160px] font-mono truncate">
                              {e.document_id ? (
                                <CopyableCell
                                  value={e.document_id}
                                  displayValue={e.document_id}
                                  className="font-mono text-xs cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold"
                                  maxWidth="150px"
                                  ariaLabel={t('accounting:journals.table.copy_aria', { val: e.document_id })}
                                />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="w-[170px] font-medium text-foreground truncate">
                              {e.partner?.name ? (
                                <CopyableCell
                                  value={e.partner.name}
                                  displayValue={e.partner.name.length > 18 ? e.partner.name.slice(0, 18) + '…' : e.partner.name}
                                  truncate
                                  maxWidth="155px"
                                  className="font-medium text-xs text-foreground"
                                  ariaLabel={t('accounting:journals.table.copy_aria', { val: e.partner.name })}
                                />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="w-auto min-w-[200px] truncate">
                              <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                  <div className="truncate font-medium text-foreground cursor-default">
                                    {e.description}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[400px] p-2 text-xs shadow-md">
                                  <p className="whitespace-pre-wrap text-popover-foreground">{e.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TableCell>
                            {(() => {
                              const tAccounts = [...new Set(e.lines?.filter((l: any) => l.dc_type === 'T').map((l: any) => l.gl_account?.gl_number || (l.gl_account_id ? String(l.gl_account_id).slice(0, 4) : '')).filter(Boolean))] as string[];
                              const kAccounts = [...new Set(e.lines?.filter((l: any) => l.dc_type === 'K').map((l: any) => l.gl_account?.gl_number || (l.gl_account_id ? String(l.gl_account_id).slice(0, 4) : '')).filter(Boolean))] as string[];
                              const isComplex = tAccounts.length > 2 || kAccounts.length > 2;

                              const formatSide = (accounts: string[]) => {
                                if (accounts.length === 0) return '—';
                                if (accounts.length <= 2) return accounts.join(', ');
                                return `${accounts[0]} (+${accounts.length - 1})`;
                              };

                              const tDisplay = formatSide(tAccounts);
                              const kDisplay = formatSide(kAccounts);
                              const fullT = tAccounts.join(', ') || '—';
                              const fullK = kAccounts.join(', ') || '—';

                              return (
                                <TableCell className="w-[130px] max-w-[130px] text-center whitespace-nowrap overflow-hidden">
                                  {tAccounts.length > 0 || kAccounts.length > 0 ? (
                                    <Tooltip delayDuration={100}>
                                      <TooltipTrigger asChild>
                                        <div className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold cursor-help truncate max-w-full">
                                          <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 truncate" title={`Tartozik: ${fullT}`}>
                                            {tDisplay}
                                          </span>
                                          <span className="text-muted-foreground/40 font-normal shrink-0">/</span>
                                          <span className="text-rose-700 dark:text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 truncate" title={`Követel: ${fullK}`}>
                                            {kDisplay}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      {isComplex && (
                                        <TooltipContent side="top" className="max-w-[320px] p-2.5 text-xs shadow-lg space-y-1.5 font-sans">
                                          <div>
                                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Tartozik ({tAccounts.length} főkönyvi számla):</span>
                                            <p className="font-mono text-[11px] text-muted-foreground break-words">{fullT}</p>
                                          </div>
                                          <div className="border-t border-border/40 pt-1">
                                            <span className="font-semibold text-rose-600 dark:text-rose-400">Követel ({kAccounts.length} főkönyvi számla):</span>
                                            <p className="font-mono text-[11px] text-muted-foreground break-words">{fullK}</p>
                                          </div>
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              );
                            })()}
                            <TableCell className="w-[140px] text-right font-semibold tabular-nums whitespace-nowrap">
                              <div className="flex flex-col items-end">
                                <span className={cn(isStornoEntry && "text-amber-600 dark:text-amber-400 font-bold")}>
                                  {formatCurrency(totalAmount, e.currency || 'HUF')}
                                </span>
                                {isForeign && (
                                  <Tooltip delayDuration={150}>
                                    <TooltipTrigger asChild>
                                      <span className="text-[10px] text-muted-foreground font-normal leading-tight cursor-help hover:text-foreground transition-colors">
                                        ({formatCurrency(hufAmount, 'HUF')})
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="text-xs">
                                      <p className="font-medium">{t('accounting:journals.table.daily_rate_tooltip_title', { date: e.posting_date.replace(/-/g, '.'), defaultValue: `Napi MNB árfolyam (${e.posting_date.replace(/-/g, '.')})` })}:</p>
                                      <p className="text-muted-foreground font-mono">1 {e.currency} = {formatNumberLocale(rate, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Ft</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="w-[100px] text-center">
                              {renderSourceBadge(e.source, t)}
                            </TableCell>
                            <TableCell className="w-[130px] text-center whitespace-nowrap">
                              {isStornoEntry ? (
                                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 px-2 py-0.5 text-[10px] font-medium border uppercase inline-flex items-center gap-1" variant="outline">
                                  <RotateCcw className="w-3 h-3 shrink-0" /> {t('accounting:journals.table.storno_badge', 'Sztornó')}
                                </Badge>
                              ) : (
                                <Badge className={cn("px-2 py-0.5 text-[10px] font-medium border uppercase", statusInfo.color)} variant="outline">
                                  {statusInfo.label}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="w-[135px] text-right">
                              <div className="flex justify-end gap-1">
                                <CustomTooltip content={t('accounting:journals.actions.view_document', 'Bizonylat megtekintése')}>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="w-6 h-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => setSelectedEntry(e)}
                                    aria-label={t('accounting:journals.actions.view_document', 'Bizonylat megtekintése')}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                </CustomTooltip>

                                <CustomTooltip content={t('accounting:journals.actions.edit_history', 'Módosítási előzmények')}>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="w-6 h-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => setAuditEntryId(e.id)}
                                    aria-label={t('accounting:journals.actions.edit_history', 'Módosítási előzmények')}
                                  >
                                    <History className="w-3.5 h-3.5" />
                                  </Button>
                                </CustomTooltip>

                                {isJournalSystemLocked(e.journal || selectedJournal || {}) ? (
                                  <CustomTooltip content="Zárt rendszer-napló (603/605/901) — a tétel automatikus gépi védelmű, kézzel nem módosítható és nem törölhető.">
                                    <span className="inline-flex items-center justify-center p-1 text-amber-500/80 cursor-help">
                                      <Lock className="w-3.5 h-3.5" />
                                    </span>
                                  </CustomTooltip>
                                ) : (
                                  <>
                                    {e.status === 'KONYVELT' && (
                                  <>
                                    <CustomTooltip content={t('accounting:journals.actions.storno_cancel', 'Sztornózás (érvénytelenítés)')}>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="w-6 h-6 text-destructive hover:bg-destructive/10"
                                        onClick={() => handleStorno(e, false)}
                                        aria-label={t('accounting:journals.actions.storno_aria', 'Bizonylat sztornózása')}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </CustomTooltip>
                                    <CustomTooltip content={checkEntryLock(e).locked ? t('accounting:journals.actions.correct_closed', 'Helyesbítés sztornóval (lezárt időszak)') : t('accounting:journals.actions.correct_open', 'Javítás / Visszanyitás')}>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className={cn(
                                          "w-6 h-6",
                                          checkEntryLock(e).locked
                                            ? "text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400"
                                            : "text-sky-600 hover:bg-sky-500/10 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/30"
                                        )}
                                        onClick={() => handleStorno(e, true)}
                                        aria-label={t('accounting:journals.actions.correct_aria', 'Javítás vagy helyesbítés')}
                                      >
                                        <CornerDownRight className="w-3.5 h-3.5" />
                                      </Button>
                                    </CustomTooltip>
                                    <CustomTooltip content={t('accounting:journals.actions.clone_entry', 'Bizonylat klónozása (másolása új tételként)')}>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="w-6 h-6 text-indigo-600 hover:bg-indigo-500/10 dark:hover:bg-indigo-950/30"
                                        onClick={() => {
                                          setEditingEntryId(null);
                                          setCloneData(e);
                                          setManualEntryOpen(true);
                                        }}
                                        aria-label={t('accounting:journals.actions.clone_entry', 'Bizonylat klónozása')}
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </Button>
                                    </CustomTooltip>
                                  </>
                                )}

                                {(e.status === 'KEZI_PISZKOZAT' || e.status === 'JOVAHAGYASRA_VAR' || e.status === 'GEPI_JAVASLAT') && (
                                  <>
                                    <CustomTooltip content={t('accounting:journals.actions.approve_and_post', 'Könyvelés')}>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="w-6 h-6 text-emerald-600 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/30"
                                        onClick={() => postMutation.mutate(e.id)}
                                        disabled={postMutation.isPending}
                                        aria-label={t('accounting:journals.actions.post_entry', 'Bizonylat végleges könyvelése')}
                                      >
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                      </Button>
                                    </CustomTooltip>
                                    <CustomTooltip content={t('accounting:journals.actions.edit_entry', 'Szerkesztés')}>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="w-6 h-6 text-primary"
                                        onClick={() => { setEditingEntryId(e.id); setCloneData(null); setManualEntryOpen(true); }}
                                        aria-label={t('accounting:journals.actions.edit_entry_aria', 'Bizonylat szerkesztése')}
                                      >
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
                                      </Button>
                                    </CustomTooltip>
                                    <CustomTooltip content={t('accounting:journals.actions.clone_entry', 'Bizonylat klónozása (másolása új tételként)')}>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="w-6 h-6 text-indigo-600 hover:bg-indigo-500/10 dark:hover:bg-indigo-950/30"
                                        onClick={() => {
                                          setEditingEntryId(null);
                                          setCloneData(e);
                                          setManualEntryOpen(true);
                                        }}
                                        aria-label={t('accounting:journals.actions.clone_entry', 'Bizonylat klónozása')}
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </Button>
                                    </CustomTooltip>
                                    {e.journal_number ? (
                                      <CustomTooltip content={t('accounting:journals.actions.delete_disabled_tooltip', { journalNum, defaultValue: `A tétel hivatalos bizonylatszámmal rendelkezik (${journalNum}), a bizonylati fegyelem és sorszámfolytonosság védelme miatt nem törölhető. Kérjük könyvelje le vagy sztornózza!` })}>
                                        <span className="inline-flex items-center justify-center w-6 h-6 text-muted-foreground/30 cursor-not-allowed">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </span>
                                      </CustomTooltip>
                                    ) : (
                                      <CustomTooltip content={t('accounting:journals.actions.delete_draft', 'Piszkozat törlése')}>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="w-6 h-6 text-destructive hover:bg-destructive/10"
                                          onClick={(ev) => { ev.stopPropagation(); setSingleDeleteTarget({ id: e.id, description: e.description || e.document_id }); }}
                                          aria-label={t('accounting:journals.actions.delete_draft', 'Piszkozat törlése')}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </CustomTooltip>
                                    )}
                                  </>
                                )}
                              </>
                            )}
                              </div>
                            </TableCell>
                          </TableRow>

                          {/* Accordion Expanded Sub-Row with Detailed Invoice Items & Kontírok */}
                          {isExpanded && (
                            <TableRow key={`${e.id}-expanded`} className="bg-muted/20 border-b hover:bg-muted/20">
                              <TableCell colSpan={11} className="p-4 pl-12 pr-6">
                                <div className="rounded-xl border bg-card p-4 space-y-4 shadow-sm">
                                  {/* Header bar of expanded row */}
                                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
                                    <div className="flex items-center gap-2.5">
                                      <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                        <Layers className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <div className="font-bold text-foreground text-sm flex items-center gap-2">
                                          <span>
                                            {entryItems.length > 1
                                              ? t('accounting:journals.table.expanded_title_multi', 'Számla tételei ({{count}} tétel)', { count: entryItems.length })
                                              : t('accounting:journals.table.expanded_title_single', 'Számla tételei ({{count}} könyvelési sor)', { count: e.lines?.length || 0 })}
                                          </span>
                                          <span className="font-mono text-xs text-muted-foreground font-normal">
                                            — {e.document_id || journalNum}
                                          </span>
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                          {t('accounting:journals.table.expanded_desc', 'A teljes bizonylathoz tartozó számlatételek és azok főkönyvi kontírozása')}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-4 text-xs font-mono bg-muted/50 px-3 py-1.5 rounded-lg border">
                                      <span>
                                        {t('accounting:journals.table.net', 'Nettó')}:{' '}
                                        <strong className="text-foreground">
                                          {isForeign && totalForeignNet > 0
                                            ? `${formatCurrency(totalForeignNet, e.currency)} (${formatCurrency(totalNet, 'HUF')})`
                                            : formatCurrency(totalNet, e.currency || 'HUF')}
                                        </strong>
                                      </span>
                                      <span className="text-muted-foreground">|</span>
                                      <span>
                                        {t('accounting:journals.table.vat', 'ÁFA')}:{' '}
                                        <strong className="text-indigo-600 dark:text-indigo-400">
                                          {isForeign && totalForeignVat > 0
                                            ? `${formatCurrency(totalForeignVat, e.currency)} (${formatCurrency(totalVat, 'HUF')})`
                                            : formatCurrency(totalVat, e.currency || 'HUF')}
                                        </strong>
                                      </span>
                                      <span className="text-muted-foreground">|</span>
                                      <span>
                                        {t('accounting:journals.table.gross', 'Bruttó')}:{' '}
                                        <strong className="text-foreground">
                                          {isForeign
                                            ? `${formatCurrency(Math.abs(rawTotalAmount), e.currency)} (${formatCurrency(Math.abs(hufAmount), 'HUF')})`
                                            : formatCurrency(Math.abs(totalAmount), e.currency || 'HUF')}
                                        </strong>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Detailed Item List: Számlatételek felsorolása */}
                                  <div className="space-y-3">
                                    {entryItems.map((item, itemIdx) => (
                                      <div
                                        key={item.key || itemIdx}
                                        className="rounded-lg border bg-background overflow-hidden"
                                      >
                                        {/* Item header line if multiple items */}
                                        {entryItems.length > 1 && (
                                          <div className="bg-muted/40 px-3 py-2 border-b flex flex-wrap items-center justify-between gap-2 text-xs">
                                            <div className="flex items-center gap-2">
                                              <span className="font-mono font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded text-[11px]">
                                                #{itemIdx + 1}
                                              </span>
                                              <span className="font-semibold text-foreground">
                                                {item.description || `Tétel #${itemIdx + 1}`}
                                              </span>
                                            </div>

                                            <div className="flex items-center gap-3 font-mono text-[11px]">
                                              <span className="text-muted-foreground">
                                                {t('accounting:journals.table.net', 'Nettó')}:{' '}
                                                <strong className="text-foreground">
                                                  {isForeign && item.foreignNet != null
                                                    ? `${formatCurrency(item.foreignNet, e.currency)} (${formatCurrency(item.net, 'HUF')})`
                                                    : formatCurrency(item.net, e.currency || 'HUF')}
                                                </strong>
                                              </span>
                                              <span className="text-muted-foreground">|</span>
                                              <span className="text-muted-foreground">
                                                {t('accounting:journals.table.vat', 'ÁFA')}:{' '}
                                                <strong className="text-indigo-600 dark:text-indigo-400">
                                                  {isForeign && item.foreignVat != null
                                                    ? `${formatCurrency(item.foreignVat, e.currency)} (${formatCurrency(item.vat, 'HUF')})`
                                                    : formatCurrency(item.vat, e.currency || 'HUF')}
                                                </strong>
                                              </span>
                                              <span className="text-muted-foreground">|</span>
                                              <span className="text-muted-foreground">
                                                {t('accounting:journals.table.gross', 'Bruttó')}:{' '}
                                                <strong className="text-foreground">
                                                  {isForeign && item.foreignGross != null
                                                    ? `${formatCurrency(item.foreignGross, e.currency)} (${formatCurrency(item.gross, 'HUF')})`
                                                    : formatCurrency(item.gross, e.currency || 'HUF')}
                                                </strong>
                                              </span>
                                            </div>
                                          </div>
                                        )}

                                        {/* Kontírozási sorok az adott tételhez */}
                                        <div className="p-2.5">
                                          <div className="text-[11px] text-muted-foreground mb-1.5 font-medium px-1 flex items-center justify-between">
                                            <span>{t('accounting:journals.table.expanded_lines_title', 'Kontírozás (Főkönyvi könyvelési sorok: T / K):')}</span>
                                            <span className="font-mono text-[10px]">
                                              {t('accounting:journals.table.expanded_lines_count', '{{count}} sor', { count: item.lines.length })}
                                            </span>
                                          </div>
                                          <table className="w-full text-xs text-left border-collapse">
                                            <thead>
                                              <tr className="bg-muted/30 border-b text-muted-foreground font-semibold text-[10px]">
                                                <th className="p-1.5 w-8 text-center">{t('accounting:journals.table.col_seq', '#')}</th>
                                                <th className="p-1.5 w-12 text-center">{t('accounting:journals.table.col_dc', 'T/K')}</th>
                                                <th className="p-1.5 min-w-[200px]">{t('accounting:journals.table.gl_account', 'Főkönyvi számla')}</th>
                                                <th className="p-1.5 w-28">{t('accounting:journals.table.col_vat_role', 'ÁFA szerep')}</th>
                                                <th className="p-1.5 text-right w-36">{t('accounting:journals.table.col_amount', 'Összeg')}</th>
                                                <th className="p-1.5">{t('accounting:journals.table.col_desc', 'Sor leírása')}</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/40 text-[11px]">
                                              {item.lines.map((l: any, lIdx: number) => (
                                                <tr key={l.id || lIdx} className="hover:bg-muted/10 transition-colors">
                                                  <td className="p-1.5 text-center text-muted-foreground font-mono">
                                                    {l.sequence_number || lIdx + 1}
                                                  </td>
                                                  <td className="p-1.5 text-center">
                                                    <Badge
                                                      variant="secondary"
                                                      className={`text-[9px] font-bold px-1 py-0 font-mono ${
                                                        l.dc_type === 'T'
                                                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                      }`}
                                                    >
                                                      {l.dc_type}
                                                    </Badge>
                                                  </td>
                                                  <td className="p-1.5">
                                                    <span className="font-mono font-bold text-foreground">
                                                      {l.gl_account?.gl_number || l.gl_number}
                                                    </span>
                                                    <span className="text-muted-foreground ml-1.5 font-sans text-[11px]">
                                                      {l.gl_account?.short_name || l.gl_short_name}
                                                    </span>
                                                  </td>
                                                  <td className="p-1.5 text-[10px]">
                                                    {l.vat_role && l.vat_role !== 'NONE' ? (
                                                      <Badge variant="outline" className="text-[9px] font-mono uppercase">
                                                        {l.vat_role} {l.vat_code ? `(${l.vat_code})` : ''}
                                                      </Badge>
                                                    ) : (
                                                      <span className="text-muted-foreground">-</span>
                                                    )}
                                                  </td>
                                                  <td className="p-1.5 text-right font-mono font-bold text-foreground whitespace-nowrap">
                                                    <div>{formatCurrency(l.amount, 'HUF')}</div>
                                                    {isForeign && l.foreign_amount != null && (
                                                      <div className="text-[10px] text-muted-foreground font-normal">
                                                        ({formatCurrency(l.foreign_amount, e.currency)})
                                                      </div>
                                                    )}
                                                  </td>
                                                  <td className="p-1.5 text-muted-foreground truncate max-w-[360px]">
                                                    <span title={l.description}>{l.description}</span>
                                                    {l.project?.name && (
                                                      <Badge variant="outline" className="text-[9px] ml-1.5 text-muted-foreground">
                                                        {l.project.name}
                                                      </Badge>
                                                    )}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                          </React.Fragment>
                        );
                      })}
                      <TablePlaceholderRows
                        currentCount={paginatedEntries.length}
                        pageSize={itemsPerPage}
                        columns={11}
                      />
                    </>
                  )}
                </TableBody>
              </Table>
              </div>

              {totalItems > 0 && (
                <div className="border-t border-border/40 p-2 bg-muted/10">
                  <UnifiedPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={(newSize) => {
                      setItemsPerPage(newSize);
                      setCurrentPage(1);
                    }}
                    pageSizeOptions={[50, 100, 200]}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

      {/* Details Drawer */}
      <Sheet open={!!selectedEntry} onOpenChange={open => !open && setSelectedEntry(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selectedEntry && (
            <>
              <SheetHeader className="border-b pb-4">
                <SheetTitle className="flex justify-between items-center text-base">
                  <span>
                    {t('accounting:journals.drawer.title', {
                      docNum: selectedEntry.journal_number
                        ? `${selectedEntry.journal?.code}/${selectedEntry.journal_number}`
                        : t('accounting:journals.drawer.unposted_draft')
                    })}
                  </span>
                  <Badge variant="outline" className={cn("px-2 py-0.5 text-[10px] font-medium border uppercase", getStatusInfo(selectedEntry.status, t).color)}>
                    {getStatusInfo(selectedEntry.status, t).label}
                  </Badge>
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-6 py-6">
                {selectedEntry.entry_type === 'SZTORNO' && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                    <RotateCcw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">{t('accounting:journals.drawer.storno_title', 'SZTORNÓ BIZONYLAT')}</span>
                      <p className="text-[11px] mt-0.5 leading-relaxed">
                        {t('accounting:journals.drawer.storno_desc', 'Ez a bizonylat ellentétes előjellel sztornózza')}
                        {(() => {
                          const orig = entriesById.get(selectedEntry.stornoed_entry_id || selectedEntry.original_entry_id);
                          return orig ? t('accounting:journals.drawer.storno_ref_orig', { code: orig.journal?.code, num: orig.journal_number, docId: orig.document_id }) : '';
                        })()}
                      </p>
                    </div>
                  </div>
                )}

                {selectedEntry.status === 'SZTORNOZOTT' && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">{t('accounting:journals.drawer.stornoed_title', 'SZTORNÓZOTT (ÉRVÉNYTELENÍTETT) BIZONYLAT')}</span>
                      <p className="text-[11px] mt-0.5 leading-relaxed">
                        {t('accounting:journals.drawer.stornoed_desc', 'Ezt a bizonylatot hivatalosan sztornózták.')}
                        {(() => {
                          const st = stornoMap.get(selectedEntry.id);
                          return st ? t('accounting:journals.drawer.stornoed_ref_storno', { code: st.journal?.code, num: st.journal_number }) : '';
                        })()}
                      </p>
                    </div>
                  </div>
                )}

                {/* General Info */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-muted/30 p-4 rounded-lg border">
                  <div>
                    <span className="text-muted-foreground block">{t('accounting:journals.drawer.partner')}</span>
                    <span className="font-semibold text-foreground text-sm">{selectedEntry.partner?.name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{t('accounting:journals.drawer.description')}</span>
                    <span className="font-semibold text-foreground text-sm">{selectedEntry.description}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{t('accounting:journals.drawer.fulfillment_date')}</span>
                    <span className="font-medium text-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-muted-foreground" />{selectedEntry.posting_date.replace(/-/g, '.')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{t('accounting:journals.drawer.document_number')}</span>
                    <span className="font-mono font-medium text-foreground">{selectedEntry.document_id}</span>
                  </div>
                  {selectedEntry.currency && selectedEntry.currency !== 'HUF' && (
                    <div>
                      <span className="text-muted-foreground block">{t('accounting:journals.drawer.daily_rate')}</span>
                      <span className="font-mono font-medium text-foreground">
                        1 {selectedEntry.currency} = {formatNumberLocale((Number(selectedEntry.exchange_rate) > 1 ? Number(selectedEntry.exchange_rate) : getDailyRate(selectedEntry.currency, selectedEntry.posting_date)), { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Ft
                      </span>
                    </div>
                  )}
                  {selectedEntry.justification && (
                    <div className="col-span-2 border-t pt-2 mt-2">
                      <span className="text-muted-foreground block">{t('accounting:journals.drawer.justification')}</span>
                      <span className="italic text-foreground">{selectedEntry.justification}</span>
                    </div>
                  )}
                </div>

                {/* Source Document Card (Original Bank Statement PDF or Invoice) */}
                {sourceDocument && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3.5 flex items-center justify-between gap-3 transition-all hover:bg-primary/[0.08]">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        {sourceDocument.type === 'bank' ? (
                          <Landmark className="w-4 h-4 text-primary" />
                        ) : (
                          <Receipt className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-medium text-muted-foreground block">
                          {sourceDocument.type === 'bank' ? t('accounting:journals.drawer.source_bank', 'Csatolt eredeti bankkivonat') : t('accounting:journals.drawer.source_invoice', 'Csatolt bizonylat / számla')}
                        </span>
                        <span className="text-xs font-semibold text-foreground truncate block" title={sourceDocument.title}>
                          {sourceDocument.title}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {sourceDocument.type === 'invoice' && sourceDocument.invoiceId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs font-medium"
                          onClick={() => setPreviewInvoiceId(sourceDocument.invoiceId!)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {t('accounting:journals.drawer.details_btn', 'Részletek')}
                        </Button>
                      )}
                      {sourceDocument.fileUrl && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 text-xs font-medium"
                            onClick={() => window.open(sourceDocument.fileUrl, '_blank')}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {t('accounting:journals.drawer.open_btn', 'Megnyitás')}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={downloadingSourceDoc}
                            className="h-8 gap-1.5 text-xs font-medium"
                            onClick={() => handleDownloadSourceDoc(sourceDocument.fileUrl, sourceDocument.fileName, sourceDocument.bucket)}
                          >
                            {downloadingSourceDoc ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            {t('accounting:journals.drawer.download_btn', 'Letöltés')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Double entry lines */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('accounting:journals.drawer.lines_title')}</h4>
                  <div className="border rounded-lg overflow-hidden bg-card">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border/40 font-semibold text-[10px] uppercase text-muted-foreground">
                          <th className="p-2.5">{t('accounting:journals.drawer.seq')}</th>
                          <th className="p-2.5">{t('accounting:journals.drawer.gl_number')}</th>
                          <th className="p-2.5">{t('accounting:journals.drawer.gl_name')}</th>
                          <th className="p-2.5 text-center">{t('accounting:journals.drawer.dc')}</th>
                          <th className="p-2.5 text-right">{t('accounting:journals.drawer.amount')}</th>
                          <th className="p-2.5">{t('accounting:journals.drawer.project')}</th>
                          <th className="p-2.5">{t('accounting:journals.drawer.note')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {selectedEntry.lines?.map((line: any) => (
                          <tr key={line.id} className="hover:bg-muted/10">
                            <td className="p-2.5 text-muted-foreground font-mono">{line.sequence_number}</td>
                            <td className="p-2.5 font-mono font-semibold">{line.gl_account?.gl_number || '—'}</td>
                            <td className="p-2.5 text-muted-foreground">{line.gl_account?.short_name || '—'}</td>
                            <td className="p-2.5 text-center">
                              <Badge className={line.dc_type === 'T' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"} variant="outline">
                                {line.dc_type}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-right font-semibold tabular-nums">
                              {(() => {
                                const isForeign = selectedEntry.currency && selectedEntry.currency !== 'HUF';
                                const lineRate = Number(selectedEntry.exchange_rate) > 1 
                                  ? Number(selectedEntry.exchange_rate) 
                                  : getDailyRate(selectedEntry.currency, selectedEntry.posting_date);

                                let amtVal: number;
                                if (isForeign) {
                                  if (line.foreign_amount != null && Number(line.foreign_amount) > 0) {
                                    amtVal = Number(line.foreign_amount);
                                  } else if (lineRate > 1 && Number(line.amount) > 0) {
                                    amtVal = Number((Number(line.amount) / lineRate).toFixed(2));
                                  } else {
                                    amtVal = Number(line.amount);
                                  }
                                } else {
                                  amtVal = Number(line.amount);
                                }
                                const formatted = formatCurrency(amtVal, selectedEntry.currency || 'HUF');
                                
                                if (isForeign) {
                                  const lineHuf = (Number(line.amount) > 0 && Math.abs(Number(line.amount) - amtVal) > 0.01)
                                    ? Number(line.amount)
                                    : (lineRate > 1 && Number(line.amount) > 0 ? Number(line.amount) : amtVal * lineRate);
                                  const formattedHuf = formatCurrency(lineHuf, 'HUF');
                                  return (
                                    <div className="flex flex-col items-end">
                                      <span>{formatted}</span>
                                      <span className="text-[10px] text-muted-foreground font-normal leading-tight">
                                        ({formattedHuf})
                                      </span>
                                    </div>
                                  );
                                }
                                return <span>{formatted}</span>;
                              })()}
                            </td>
                            <td className="p-2.5 text-muted-foreground">{line.project?.name || '—'}</td>
                            <td className="p-2.5 text-muted-foreground italic truncate max-w-[120px]">{line.description || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>


      {auditEntryId && (
        <AuditTrailDialog
          open={!!auditEntryId}
          onOpenChange={open => !open && setAuditEntryId(null)}
          entryId={auditEntryId}
        />
      )}

      {stornoOpen && stornoTarget && (
        <Dialog open={stornoOpen} onOpenChange={setStornoOpen}>
          <DialogContent className="sm:max-w-md bg-card border border-border">
            {(() => {
              const lockInfo = checkEntryLock(stornoTarget.entry);
              const isCorrection = stornoTarget.correct;

              if (!isCorrection) {
                // 1. Sztornózás (érvénytelenítés)
                return (
                  <>
                    <DialogHeader>
                      <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
                        <Trash2 className="w-4 h-4" />
                        {t('accounting:journals.storno_modal.cancel_title', 'Bizonylat sztornózása')}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-1">
                        {t('accounting:journals.storno_modal.cancel_desc', 'Kérjük, adja meg a sztornózás indokát. A sztornózás során egy ellentétes előjelű tétel jön létre, amely érvényteleníti az eredeti tételt.')}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                      <div className="space-y-1.5">
                        <label htmlFor="storno-reason" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t('accounting:journals.storno_modal.reason_required', 'Indoklás')} <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="storno-reason"
                          value={stornoReason}
                          onChange={e => setStornoReason(e.target.value)}
                          placeholder={t('accounting:journals.storno_modal.cancel_reason_placeholder', 'Pl. Hibás összeg, téves számla...')}
                          className="h-9 text-xs"
                          autoFocus
                        />
                      </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0 border-t border-border/10 pt-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => setStornoOpen(false)} className="h-9 text-xs">
                        {t('accounting:journals.storno_modal.cancel_button', 'Mégse')}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={!stornoReason.trim() || stornoMutation.isPending}
                        className="h-9 text-xs font-semibold"
                        onClick={() => {
                          stornoMutation.mutate({
                            headerId: stornoTarget.headerId,
                            reason: stornoReason,
                            correct: false
                          });
                          setStornoOpen(false);
                        }}
                      >
                        {stornoMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                        {t('accounting:journals.storno_modal.execute_storno', 'Sztornózás végrehajtása')}
                      </Button>
                    </DialogFooter>
                  </>
                );
              }

              if (lockInfo.locked) {
                // 2. Lezárt időszak helyesbítése (storno kötelező)
                return (
                  <>
                    <DialogHeader>
                      <DialogTitle className="text-base font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        {t('accounting:journals.storno_modal.correct_closed_title', 'Bizonylat helyesbítése (Lezárt időszak)')}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground mt-1">
                        {t('accounting:journals.storno_modal.correct_closed_desc', { reason: lockInfo.reason, defaultValue: `Az érintett időszak zárt: ${lockInfo.reason}. Számviteli szabályok szerint lezárt időszakban közvetlen módosítás nem lehetséges; a javítás ellentétes előjelű sztornó bizonylattal és új helyesbítő másolattal történik.` })}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                      <div className="space-y-1.5">
                        <label htmlFor="storno-reason" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {t('accounting:journals.storno_modal.correction_reason_label', 'Helyesbítés indoklása')} <span className="text-destructive">*</span>
                        </label>
                        <Input
                          id="storno-reason"
                          value={stornoReason}
                          onChange={e => setStornoReason(e.target.value)}
                          placeholder={t('accounting:journals.storno_modal.correct_reason_placeholder', 'Pl. Hibás főkönyvi szám javítása...')}
                          className="h-9 text-xs"
                          autoFocus
                        />
                      </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0 border-t border-border/10 pt-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => setStornoOpen(false)} className="h-9 text-xs">
                        {t('accounting:journals.storno_modal.cancel_button', 'Mégse')}
                      </Button>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        disabled={!stornoReason.trim() || stornoMutation.isPending}
                        className="h-9 text-xs font-semibold"
                        onClick={() => {
                          stornoMutation.mutate({
                            headerId: stornoTarget.headerId,
                            reason: stornoReason,
                            correct: true
                          });
                          setStornoOpen(false);
                        }}
                      >
                        {stornoMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                        {t('accounting:journals.storno_modal.start_correction_storno', 'Helyesbítés indítása sztornóval')}
                      </Button>
                    </DialogFooter>
                  </>
                );
              }

              // 3. Nyitott időszak javítása (Közvetlen visszanyitás vs Sztornó)
              return (
                <>
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold text-primary flex items-center gap-2">
                      <Undo2 className="w-4 h-4" />
                      {t('accounting:journals.storno_modal.repair_open_title', 'Könyvelt tétel javítása')}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-1">
                      {t('accounting:journals.storno_modal.repair_open_desc', 'Az időszak nyitott (nincs lezárva és az ÁFA bevallás sincs véglegesítve). Válassza ki a javítás kívánt módját:')}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <div className="space-y-1.5">
                      <label htmlFor="storno-reason" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t('accounting:journals.storno_modal.reason_optional', 'Megjegyzés / Indoklás (opcionális)')}
                      </label>
                      <Input
                        id="storno-reason"
                        value={stornoReason}
                        onChange={e => setStornoReason(e.target.value)}
                        placeholder={t('accounting:journals.storno_modal.repair_reason_placeholder', 'Pl. Kontírozási javítás...')}
                        className="h-9 text-xs"
                        autoFocus
                      />
                    </div>

                    <div className="rounded-lg border border-primary/25 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                          {t('accounting:journals.storno_modal.direct_unpost_title', 'Közvetlen visszanyitás és javítás')}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                          {t('accounting:journals.storno_modal.recommended_badge', 'Ajánlott')}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {t('accounting:journals.storno_modal.direct_unpost_desc', 'A tétel visszanyílik szerkeszthető piszkozattá az eredeti bizonylatszám megőrzésével. Nem jön létre felesleges sztornó bizonylat, és azonnal megnyílik a szerkesztőfelület.')}
                      </p>
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        disabled={unpostMutation.isPending}
                        className="w-full h-8 text-xs font-semibold mt-1"
                        onClick={() => {
                          unpostMutation.mutate({
                            headerId: stornoTarget.headerId,
                            reason: stornoReason.trim() || undefined
                          });
                          setStornoOpen(false);
                        }}
                      >
                        {unpostMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                        {t('accounting:journals.storno_modal.direct_unpost_button', 'Visszanyitás és szerkesztés')}
                      </Button>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground" />
                        {t('accounting:journals.storno_modal.accounting_storno_title', 'Számviteli sztornózás és új bizonylat')}
                      </span>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {t('accounting:journals.storno_modal.accounting_storno_desc', 'Külön ellentétes előjelű sztornó bizonylat készül és egy új javító piszkozat jön létre (szigorú számviteli nyomvonal esetén).')}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!stornoReason.trim() || stornoMutation.isPending}
                        className="w-full h-8 text-xs font-medium"
                        onClick={() => {
                          stornoMutation.mutate({
                            headerId: stornoTarget.headerId,
                            reason: stornoReason,
                            correct: true
                          });
                          setStornoOpen(false);
                        }}
                      >
                        {stornoMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                        {t('accounting:journals.storno_modal.storno_and_copy_button', 'Sztornózás és javító másolat')}
                      </Button>
                      {!stornoReason.trim() && (
                        <p className="text-[10px] text-muted-foreground/70 italic text-center">
                          {t('accounting:journals.storno_modal.reason_hint', '(Sztornózáshoz kötelező indoklást megadni a fenti mezőben)')}
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter className="border-t border-border/10 pt-3">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setStornoOpen(false)} className="h-8 text-xs text-muted-foreground">
                      {t('accounting:journals.storno_modal.cancel_button', 'Mégse')}
                    </Button>
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}

      {selectedEntryIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-4xl bg-card border border-primary/30 shadow-2xl rounded-2xl px-6 py-4 flex items-center justify-between z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 text-sm font-semibold text-primary">
            <span className="bg-primary/10 px-3 py-1 rounded-full text-xs font-bold tabular-nums text-primary">
              {selectedEntryIds.size}
            </span>
            <span>
              {t('accounting:journals.batch_bar.selected_count', 'tétel kijelölve')}
              {selectedDraftIds.length < selectedEntryIds.size && (
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  ({selectedDraftIds.length} db szerkeszthető piszkozat)
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
              onClick={() => bulkPostMutation.mutate(selectedDraftIds)}
              disabled={selectedDraftIds.length === 0 || bulkPostMutation.isPending || bulkUpdateStatusMutation.isPending || bulkDeleteMutation.isPending}
            >
              {bulkPostMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              {t('accounting:journals.batch_bar.post_selected', 'Kijelöltek könyvelése')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10 hover:text-indigo-700 dark:border-indigo-500/30 dark:text-indigo-400 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300"
              onClick={() => {
                setSelectedTargetGlId('');
                setBulkGlSearch('');
                setBulkGlDialogOpen(true);
              }}
              disabled={selectedDraftIds.length === 0 || bulkPostMutation.isPending || bulkUpdateStatusMutation.isPending || bulkDeleteMutation.isPending || bulkReassignGlMutation.isPending}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {t('accounting:journals.batch_bar.reassign_gl', 'Tömeges kontírozás')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-sky-500/30 text-sky-600 hover:bg-sky-500/10 hover:text-sky-700 dark:border-sky-500/30 dark:text-sky-400 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
              onClick={() => bulkUpdateStatusMutation.mutate({ ids: selectedDraftIds, status: 'JOVAHAGYASRA_VAR' })}
              disabled={selectedDraftIds.length === 0 || bulkPostMutation.isPending || bulkUpdateStatusMutation.isPending || bulkDeleteMutation.isPending || bulkReassignGlMutation.isPending}
            >
              {bulkUpdateStatusMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {t('accounting:journals.batch_bar.submit_for_approval', 'Jóváhagyásra küldés')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              onClick={() => bulkUpdateStatusMutation.mutate({ ids: selectedDraftIds, status: 'ELVETVE' })}
              disabled={selectedDraftIds.length === 0 || bulkPostMutation.isPending || bulkUpdateStatusMutation.isPending || bulkDeleteMutation.isPending}
            >
              {bulkUpdateStatusMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              {t('accounting:journals.batch_bar.reject_selected', 'Kijelöltek elvetése')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-destructive/20 text-destructive hover:bg-destructive/10"
              onClick={(ev) => {
                ev.stopPropagation();
                setBulkDeleteDialogOpen(true);
              }}
              disabled={selectedDraftIds.length === 0 || bulkPostMutation.isPending || bulkUpdateStatusMutation.isPending || bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              {t('accounting:journals.batch_bar.delete_selected', 'Kijelöltek törlése')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs px-2 text-muted-foreground"
              onClick={() => setSelectedEntryIds(new Set())}
            >
              {t('accounting:journals.batch_bar.cancel', 'Mégse')}
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <AddManualJournalEntryModal
        open={manualEntryOpen}
        onOpenChange={(isOpen) => {
          setManualEntryOpen(isOpen);
          if (!isOpen) {
            setCloneData(null);
            setEditingEntryId(null);
          }
        }}
        entryId={editingEntryId}
        cloneData={cloneData}
        defaultJournalId={selectedJournalId !== 'munkalista' ? selectedJournalId : undefined}
        suggestedDocumentId={suggestedNextDocumentId}
        onOpenOpeningWizard={() => setOpeningWizardOpen(true)}
      />

      <OpeningJournalWizardModal
        open={openingWizardOpen}
        onOpenChange={setOpeningWizardOpen}
        onEditExistingEntry={(entryId) => {
          setEditingEntryId(entryId);
          setCloneData(null);
          setManualEntryOpen(true);
        }}
      />

      <UploadChartOfAccountsModal
        open={uploadCoaOpen}
        onOpenChange={setUploadCoaOpen}
        onSuccess={handleCoaUploadSuccess}
      />

      <PeriodClosingSettings
        open={periodClosingOpen}
        onOpenChange={setPeriodClosingOpen}
      />

      {/* Tömeges piszkozat törlés megerősítő modál */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <AlertDialogTitle>{t('accounting:journals.bulk_delete.title', 'Kijelölt piszkozatok törlése')}</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t('accounting:journals.bulk_delete.description', 'Visszavonhatatlan művelet. A kiválasztott javaslatok véglegesen törlődnek a rendszerből.')}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          <div className="py-2 text-sm text-foreground">
            {t('accounting:journals.bulk_delete.confirm_prefix', 'Biztosan törölni szeretné a kijelölt')} <strong className="text-destructive font-semibold">{selectedDraftIds.length > 0 ? selectedDraftIds.length : selectedEntryIds.size} db</strong> {t('accounting:journals.bulk_delete.confirm_suffix', 'piszkozatot?')}
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              {t('accounting:journals.bulk_delete.note', 'A rendszerjavaslatok és kézi piszkozatok fej- és soradatai törlésre kerülnek. A már hivatalosan lekönyvelt tételeket a rendszer védelme nem engedi törölni.')}
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleteMutation.isPending}>{t('accounting:journals.bulk_delete.cancel', 'Mégse')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
              disabled={bulkDeleteMutation.isPending}
              onClick={async (ev) => {
                ev.preventDefault();
                const ids = selectedDraftIds.length > 0 ? selectedDraftIds : Array.from(selectedEntryIds);
                setBulkDeleteDialogOpen(false);
                if (ids.length > 0) {
                  try {
                    await bulkDeleteMutation.mutateAsync(ids);
                  } catch {
                    // Handled in onError
                  }
                }
              }}
            >
              {bulkDeleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('accounting:journals.bulk_delete.deleting', 'Törlés folyamatban...')}
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  {t('accounting:journals.bulk_delete.confirm_button', { count: selectedEntryIds.size, defaultValue: `Törlés (${selectedEntryIds.size} db)` })}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Egyedi piszkozat törlése megerősítő modál */}
      <AlertDialog open={!!singleDeleteTarget} onOpenChange={(open) => { if (!open) setSingleDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <AlertDialogTitle>{t('accounting:journals.single_delete.title', 'Piszkozat törlése')}</AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {t('accounting:journals.single_delete.description', 'Biztosan törölni szeretné ezt a piszkozatot?')}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          {singleDeleteTarget?.description && (
            <div className="py-2 text-sm text-foreground/90 font-medium bg-muted/40 p-2.5 rounded-md border border-border">
              {singleDeleteTarget.description}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>{t('accounting:journals.single_delete.cancel', 'Mégse')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1.5"
              disabled={deleteMutation.isPending}
              onClick={async (ev) => {
                ev.preventDefault();
                if (singleDeleteTarget) {
                  const targetId = singleDeleteTarget.id;
                  setSingleDeleteTarget(null);
                  try {
                    await deleteMutation.mutateAsync(targetId);
                  } catch {
                    // Handled in onError
                  }
                }
              }}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('accounting:journals.single_delete.deleting', 'Törlés...')}
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  {t('accounting:journals.single_delete.confirm_button', 'Törlés')}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {previewInvoiceId && (
        <InvoiceDetailPopup
          open={!!previewInvoiceId}
          onOpenChange={(open) => !open && setPreviewInvoiceId(null)}
          invoiceId={previewInvoiceId}
        />
      )}

      {/* Tömeges kontírozás modál */}
      <Dialog open={bulkGlDialogOpen} onOpenChange={(open) => { if (!open) setBulkGlDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
              {t('accounting:journals.bulk_gl.title', 'Tömeges főkönyvi szám módosítás')}
            </DialogTitle>
            <DialogDescription>
              {t('accounting:journals.bulk_gl.desc', 'A kijelölt tételek Tartozik vagy Követel oldali főkönyvi számának tömeges módosítása.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">{t('accounting:journals.bulk_gl.side_label', 'Módosítandó oldal')}</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={bulkGlSide === 'T' ? 'default' : 'outline'}
                  className={cn("text-xs gap-1.5", bulkGlSide === 'T' ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "")}
                  onClick={() => setBulkGlSide('T')}
                >
                  {t('accounting:journals.bulk_gl.side_debit', 'T (Tartozik / Költség)')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={bulkGlSide === 'K' ? 'default' : 'outline'}
                  className={cn("text-xs gap-1.5", bulkGlSide === 'K' ? "bg-rose-600 hover:bg-rose-700 text-white" : "")}
                  onClick={() => setBulkGlSide('K')}
                >
                  {t('accounting:journals.bulk_gl.side_credit', 'K (Követel / Pénzforgalom)')}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">{t('accounting:journals.bulk_gl.account_label', 'Új főkönyvi szám kiválasztása')}</Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder={t('accounting:journals.bulk_gl.search_placeholder', 'Keresés számlaszámra vagy névre (pl. 526, 4541)...')}
                  value={bulkGlSearch}
                  onChange={(e) => setBulkGlSearch(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>

              <div className="max-h-56 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/40 bg-muted/20">
                {glAccounts
                  .filter((acc: any) => {
                    if (!bulkGlSearch.trim()) return true;
                    const q = bulkGlSearch.toLowerCase().trim();
                    const num = String(acc.gl_number || '').toLowerCase();
                    const name = String(acc.description || acc.name || acc.short_name || '').toLowerCase();
                    return num.includes(q) || name.includes(q);
                  })
                  .slice(0, 30)
                  .map((acc: any) => {
                    const isSelected = selectedTargetGlId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedTargetGlId(acc.id)}
                        className={cn(
                          "w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors",
                          isSelected ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 font-semibold" : "hover:bg-muted/60"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono font-bold text-foreground shrink-0">{acc.gl_number}</span>
                          <span className="truncate text-muted-foreground">{acc.description || acc.name || acc.short_name}</span>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-lg border border-border/40 text-xs text-muted-foreground leading-relaxed">
              {t('accounting:journals.bulk_gl.summary_info', {
                count: selectedEntryIds.size,
                side: bulkGlSide === 'T' ? 'T' : 'K',
                defaultValue: `Kijelölt tételek: ${selectedEntryIds.size} db. A jóváhagyás után az összes kijelölt tétel ${bulkGlSide === 'T' ? 'Tartozik (T)' : 'Követel (K)'} oldali sora frissül a kiválasztott számlaszámra.`
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBulkGlDialogOpen(false)}
              disabled={bulkReassignGlMutation.isPending}
            >
              {t('accounting:journals.bulk_delete.cancel', 'Mégse')}
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              disabled={!selectedTargetGlId || bulkReassignGlMutation.isPending}
              onClick={() => {
                if (selectedTargetGlId && selectedEntryIds.size > 0) {
                  bulkReassignGlMutation.mutate({
                    headerIds: Array.from(selectedEntryIds),
                    side: bulkGlSide,
                    targetGlId: selectedTargetGlId
                  });
                }
              }}
            >
              {bulkReassignGlMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {t('accounting:journals.bulk_gl.btn_submit', 'Kontírozás módosítása')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Journals Modal */}
      <ManageJournalsModal
        open={manageJournalsOpen}
        onOpenChange={setManageJournalsOpen}
        companyId={selectedCompany?.id || ''}
        journals={journals}
        glAccounts={glAccounts}
        onJournalDeleted={(deletedId) => {
          if (selectedJournalId === deletedId) {
            setSelectedJournalId('munkalista');
          }
        }}
      />

      {/* RLB Szűkítés Modal */}
      <JournalFilterModal
        open={isFilterModalOpen}
        onOpenChange={setIsFilterModalOpen}
        criteria={filterCriteria}
        onApplyCriteria={(newCrit) => {
          setFilterCriteria(newCrit);
          setCurrentPage(1);
        }}
        onResetCriteria={handleResetFilters}
        journals={journals}
        currentJournalName={
          selectedJournalId === 'munkalista'
            ? 'Munkalista'
            : selectedJournal ? `${selectedJournal.code} – ${selectedJournal.name}` : 'Aktuális nézet'
        }
      />
      </div>
    </TooltipProvider>
  );
}
