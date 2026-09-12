import React, { useState, useEffect, useCallback } from 'react';
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
  Undo2
} from 'lucide-react';
import AddManualJournalEntryModal from '@/components/journals/AddManualJournalEntryModal';
import OpeningJournalWizardModal from '@/components/journals/OpeningJournalWizardModal';
import PeriodClosingSettings from '@/components/journals/PeriodClosingSettings';
import AuditTrailDialog from '@/components/journals/AuditTrailDialog';
import { getLocalizedJournalName } from '@/lib/journalUtils';
import { useActivePreset } from '@/hooks/useActivePreset';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
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
  const isHuf = currency === 'HUF';
  return new Intl.NumberFormat('hu-HU', {
    style: 'currency',
    currency,
    maximumFractionDigits: isHuf ? 0 : 2
  }).format(val);
};

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
      const { data, error } = await supabase.rpc('acc_generate_drafts_from_ledger', {
        p_company_id: selectedCompany.id,
        p_preset_id: activePresetId
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      toast({ title: "Javaslatok sikeresen legenerálva", description: `${count} db könyvelési tétel javaslat jött létre a meglévő adatokból.` });
    },
    onError: (err: any) => {
      toast({ title: "Hiba a javaslatok generálásakor", description: err?.message || "Ismeretlen hiba történt", variant: "destructive" });
    }
  });

  const [selectedJournalId, setSelectedJournalId] = useState<string>('munkalista');
  const [search, setSearch] = useState('');
  const [stornoFilter, setStornoFilter] = useState<'all' | 'active' | 'storno'>('all');
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Reset page and selection when search, stornoFilter or journal changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedEntryIds(new Set());
  }, [search, stornoFilter, selectedJournalId]);
  
  // Modals state
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [openingWizardOpen, setOpeningWizardOpen] = useState(false);
  const [periodClosingOpen, setPeriodClosingOpen] = useState(false);
  const [auditEntryId, setAuditEntryId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Storno / Correction dialog state
  const [stornoOpen, setStornoOpen] = useState(false);
  const [stornoTarget, setStornoTarget] = useState<{ headerId: string; correct: boolean; entry?: any } | null>(null);
  const [stornoReason, setStornoReason] = useState('');

  // Delete confirmation dialogs state
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [singleDeleteTarget, setSingleDeleteTarget] = useState<{ id: string; description?: string } | null>(null);

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
  }, [journals, loadingJournals, selectedCompany]);

  // Fetch MNB daily exchange rates for currency conversion and tooltips
  const { data: dailyExchangeRates = [] } = useQuery({
    queryKey: ['daily-exchange-rates-journals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_exchange_rates')
        .select('currency, rate_date, rate')
        .order('rate_date', { ascending: false });
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

  // Fetch entries
  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['acc-journal-entries', selectedCompany?.id, selectedJournalId, dateFrom, dateTo],
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

      if (selectedJournalId === 'munkalista') {
        query = query.in('status', ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT']);
      } else {
        query = query.eq('journal_id', selectedJournalId);
        if (dateFrom) query = query.gte('posting_date', dateFrom);
        if (dateTo) query = query.lte('posting_date', dateTo);
      }

      const { data, error } = await query
        .order('posting_date', { ascending: false })
        .limit(10000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCompany?.id && !!selectedJournalId,
  });

  // Canonical helper to invalidate all related caches across journals, GL, and VAT
  const invalidateGlAndJournalQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
    queryClient.invalidateQueries({ queryKey: ['acc-ny-entries-count'] });
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
      toast({ title: "Tétel sikeresen lekönyvelve" });
    },
    onError: (err) => {
      toast({ title: "Könyvelési hiba", description: err.message, variant: "destructive" });
    }
  });

  // Resilient Bulk post mutation
  const bulkPostMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Bejelentkezés szükséges");

      const successes: string[] = [];
      const failures: { id: string; error: string }[] = [];

      for (const id of ids) {
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

      return { successes, failures, total: ids.length };
    },
    onSettled: () => {
      // Always invalidate queries so UI immediately updates succeeded items
      invalidateGlAndJournalQueries();
    },
    onSuccess: ({ successes, failures, total }) => {
      if (failures.length === 0) {
        setSelectedEntryIds(new Set());
        toast({ title: `${total} tétel sikeresen lekönyvelve` });
      } else if (successes.length > 0) {
        // Keep only failed IDs selected so user can easily retry or review
        setSelectedEntryIds(new Set(failures.map(f => f.id)));
        toast({
          title: `Részleges könyvelés: ${successes.length} sikeres, ${failures.length} hibás`,
          description: `A hibás tételek kijelölve maradtak. Első hiba: ${failures[0].error}`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Könyvelési hiba",
          description: `Egyetlen tétel sem került lekönyvelésre. Hiba: ${failures[0].error}`,
          variant: "destructive"
        });
      }
    },
    onError: (err) => {
      toast({ title: "Könyvelési hiba", description: err.message, variant: "destructive" });
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
      toast({ title: `Kijelölt tételek állapota frissítve: ${label}` });
    },
    onError: (err) => {
      toast({ title: "Hiba a tömeges módosítás során", description: err.message, variant: "destructive" });
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
      toast({ title: res.correct ? "Sztornózva és javító másolat elkészítve" : "Tétel sztornózva" });
      if (res.correct && res.id) {
        setEditingEntryId(res.id);
        setManualEntryOpen(true);
      }
    },
    onError: (err) => {
      toast({ title: "Sztornózási hiba", description: err.message, variant: "destructive" });
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
        title: "Tétel visszanyitva piszkozattá",
        description: "A tétel sikeresen visszanyílt kézi piszkozattá. Az eredeti naplósorszám megmaradt, most közvetlenül szerkesztheti."
      });
      setEditingEntryId(headerId);
      setManualEntryOpen(true);
    },
    onError: (err: any) => {
      toast({ title: "Visszanyitási hiba", description: err.message, variant: "destructive" });
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
      toast({ title: "Piszkozat törölve" });
    },
    onError: (err: any) => {
      toast({ title: "Törlési hiba", description: err.message, variant: "destructive" });
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
          title: `${deletedIds.length} piszkozat törölve`,
          description: `${skippedCount} db tétel megőrzésre került, mivel hivatalos naplósorszámmal rendelkezik (sorszámfolytonosság védelme).`
        });
      } else {
        toast({ title: "Kijelölt piszkozatok sikeresen törölve" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Törlési hiba", description: err.message, variant: "destructive" });
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
      const draftIds = pageEntries
        .filter((e: any) => ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status))
        .map((e: any) => e.id);
      setSelectedEntryIds(new Set(draftIds));
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

  // Filtered entries
  const filteredEntries = entries.filter((e: any) => {
    if (stornoFilter === 'active') {
      if (e.status === 'SZTORNOZOTT' || e.entry_type === 'SZTORNO') return false;
    } else if (stornoFilter === 'storno') {
      if (e.status !== 'SZTORNOZOTT' && e.entry_type !== 'SZTORNO') return false;
    }

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (e.description && e.description.toLowerCase().includes(q)) ||
      (e.document_id && e.document_id.toLowerCase().includes(q)) ||
      (e.partner?.name && e.partner.name.toLowerCase().includes(q)) ||
      (e.journal_number && `${e.journal?.code}/${e.journal_number}`.toLowerCase().includes(q))
    );
  });

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

  const selectedJournal = journals.find((j: any) => j.id === selectedJournalId);
  const isNyJournal = selectedJournal?.code === 'NY';

  return (
    <TooltipProvider>
      <div className="flex flex-col space-y-4 p-6 min-h-[calc(100vh-4rem)] bg-background">
      <PageHeader
        companyName={selectedCompany?.name}
        breadcrumb={t('accounting:journals.breadcrumb', 'Könyvelési Naplók')}
        title={t('accounting:journals.title', 'Könyvelési Naplók')}
        description={t('accounting:journals.description', 'A vállalkozás kettős könyvvitelének naplónemenkénti, idősoros és zárt nyilvántartása.')}
        actions={
          <div className="flex gap-2">
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
            <Button
              size="sm"
              className="gap-1.5 shadow-sm"
              onClick={() => { setEditingEntryId(null); setManualEntryOpen(true); }}
            >
              <Plus className="w-4 h-4" /> {t('accounting:journals.new_manual_entry', 'Új vegyes bizonylat')}
            </Button>
          </div>
        }
      />

      {/* Horizontal Journals Selector */}
      <div className="w-full flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none select-none">
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
            {t('accounting:journals.pending_badge', 'Függő')}
          </Badge>
        </button>

        {loadingJournals ? (
          <div className="flex items-center pl-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
        ) : (
          journals.map((j: any) => (
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
                    "flex items-center gap-3 pl-3 pr-4 h-12 rounded-lg text-xs transition-all border shrink-0 text-left justify-between flex-1 min-w-[80px]",
                    selectedJournalId === j.id
                      ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                      : "bg-card hover:bg-muted/60 text-muted-foreground border-border"
                  )}
                >
                  <div className="flex flex-col min-w-0 pr-1 leading-tight flex-1">
                    <span className={cn("font-bold text-[11px] leading-tight truncate", selectedJournalId === j.id ? "text-primary-foreground" : "text-foreground")}>{j.code}</span>
                    <span className={cn("text-[8px] leading-none truncate", selectedJournalId === j.id ? "text-primary-foreground/80" : "text-muted-foreground")}>{getLocalizedJournalName(j, j.name, t)}</span>
                  </div>
                  <Badge variant={selectedJournalId === j.id ? 'secondary' : 'outline'} className="px-1.5 py-0.5 text-[8px] shrink-0 font-normal mr-1">
                    {j.currency}
                  </Badge>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="p-2 text-xs shadow-md">
                <p className="font-semibold text-popover-foreground">{j.code} - {getLocalizedJournalName(j, j.name, t)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {t('accounting:journals.currency_label', { currency: j.currency, defaultValue: `Pénznem: ${j.currency}` })}
                </p>
              </TooltipContent>
            </Tooltip>
          ))
        )}
      </div>

      <div className="grid grid-cols-12 gap-4 items-start">
        {/* Full-width list table */}
        <div className="col-span-12 space-y-4">
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
                      <span>{t('accounting:journals.opening.banner_title', 'Nyitó Napló (NY) — Sztv. 491. Technikai Nyitómérleg')}</span>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                        {t('accounting:journals.opening.continuity_badge', 'Mérlegfolytonosság')}
                      </Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('accounting:journals.opening.banner_desc', 'Az előző évi záró mérleg felvezetése a 491. Nyitómérleg számlával szemben (Kötelező validáció: Σ T = Σ K).')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" className="gap-1.5 shadow-sm" onClick={() => setOpeningWizardOpen(true)}>
                    <BookOpen className="w-4 h-4" /> {t('accounting:journals.opening.start_wizard', 'Nyitó Varázsló indítása')}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Filters */}
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
                <RotateCcw className="w-3 h-3 text-amber-500" />
                {t('accounting:journals.filters.storno', 'Sztornó tételek')}
              </button>
            </div>
          </div>

          {/* Guidance Banner for Pending Drafts & System Proposals */}
          {filteredEntries.filter((e: any) => ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status)).length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-md shrink-0 mt-0.5 sm:mt-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-2">
                    <span>
                      {t('accounting:journals.guidance_banner.title', {
                        count: filteredEntries.filter((e: any) => ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status)).length,
                        defaultValue: `${filteredEntries.filter((e: any) => ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status)).length} db lekönyvelésre váró könyvelési javaslat`,
                      })}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 py-0 font-medium">
                      {t('accounting:journals.guidance_banner.pending_badge', 'Jóváhagyásra vár')}
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
                    const draftIds = filteredEntries
                      .filter((e: any) => ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status))
                      .map((e: any) => e.id);
                    setSelectedEntryIds(new Set(draftIds));
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('accounting:journals.guidance_banner.select_all_proposals', {
                    count: filteredEntries.filter((e: any) => ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status)).length,
                    defaultValue: `Összes javaslat kijelölése (${filteredEntries.filter((e: any) => ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status)).length})`,
                  })}
                </Button>
              </div>
            </div>
          )}

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
              <Table className="compact-table w-full table-fixed min-w-[1150px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 border-b border-border/40 text-muted-foreground select-none uppercase font-semibold text-[10px] tracking-wider">
                    <TableHead className="w-[44px] text-center p-0">
                      <div className="flex items-center justify-center">
                        {(() => {
                          const pageDrafts = paginatedEntries.filter((e: any) =>
                            ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status)
                          );
                          const isAllSelected =
                            pageDrafts.length > 0 &&
                            pageDrafts.every((e: any) => selectedEntryIds.has(e.id));
                          const isSomeSelected =
                            pageDrafts.some((e: any) => selectedEntryIds.has(e.id));

                          return (
                            <Checkbox
                              checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                              disabled={pageDrafts.length === 0}
                              onCheckedChange={(checked) => handleSelectAll(!!checked, paginatedEntries)}
                              aria-label={t('accounting:journals.table.select_all_drafts_aria', 'Összes piszkozat kijelölése ezen az oldalon')}
                            />
                          );
                        })()}
                      </div>
                    </TableHead>
                    <TableHead className="w-[95px] whitespace-nowrap">{t('accounting:journals.table.col_date', 'Dátum')}</TableHead>
                    <TableHead className="w-[110px] whitespace-nowrap">{t('accounting:journals.table.col_journal_num', 'Naplószám')}</TableHead>
                    <TableHead className="w-[150px] whitespace-nowrap">{t('accounting:journals.table.col_doc_num', 'Bizonylatszám')}</TableHead>
                    <TableHead className="w-[180px] whitespace-nowrap">{t('accounting:journals.table.col_partner', 'Partner')}</TableHead>
                    <TableHead className="w-auto min-w-[200px]">{t('accounting:journals.table.col_description', 'Megnevezés')}</TableHead>
                    <TableHead className="w-[150px] text-right whitespace-nowrap">{t('accounting:journals.table.col_amount', 'Összeg')}</TableHead>
                    <TableHead className="w-[100px] text-center whitespace-nowrap">{t('accounting:journals.table.col_type', 'Típus')}</TableHead>
                    <TableHead className="w-[130px] text-center whitespace-nowrap">{t('accounting:journals.table.col_status', 'Státusz')}</TableHead>
                    <TableHead className="w-[135px] text-right whitespace-nowrap">{t('accounting:journals.table.col_actions', 'Műveletek')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/20">
                  {loadingEntries ? (
                    <TableSkeleton columns={10} rows={8} />
                  ) : filteredEntries.length === 0 ? (
                    <TableEmptyState
                      colSpan={10}
                      icon={search ? Search : FileText}
                      title={search ? t('accounting:journals.table.empty_search_title', 'Nincs találat a megadott keresési feltételekre') : t('accounting:journals.table.empty_view_title', 'Nincsenek tételek ebben a nézetben')}
                      description={search ? t('accounting:journals.table.empty_search_desc', 'Próbáld módosítani a keresési feltételt vagy törölni a szűrőt.') : t('accounting:journals.table.empty_view_desc', 'Ehhez a naplóhoz még nem tartoznak könyvelési tételek a megadott időszakban.')}
                      onClearFilters={search ? () => setSearch('') : undefined}
                      clearLabel={t('accounting:journals.table.clear_search', 'Keresés törlése')}
                    />
                  ) : (
                    <>
                      {paginatedEntries.map((e: any) => {
                        const isForeign = e.currency && e.currency !== 'HUF';
                        const isStornoEntry = e.entry_type === 'SZTORNO';
                        const isStornoedOriginal = e.status === 'SZTORNOZOTT';
                        const rawTotalAmount = e.lines?.reduce((acc: number, l: any) => {
                          if (l.dc_type !== 'T') return acc;
                          const val = isForeign ? (l.foreign_amount || l.amount) : l.amount;
                          return acc + Number(val);
                        }, 0) || 0;
                        const totalAmount = isStornoEntry ? -Math.abs(rawTotalAmount) : rawTotalAmount;

                        // Resolve daily exchange rate for the posting date
                        const headerRate = Number(e.exchange_rate) || 0;
                        const rate = headerRate > 1 ? headerRate : getDailyRate(e.currency, e.posting_date);

                        // Calculate HUF amount:
                        // 1. If line amounts in DB are already converted (differ from foreign amount), sum them
                        const linesHufSum = isForeign
                          ? e.lines?.reduce((acc: number, l: any) => l.dc_type === 'T' ? acc + Number(l.amount) : acc, 0) || 0
                          : 0;

                        // 2. If lines were already converted, use linesHufSum. Otherwise calculate directly using that day's exchange rate
                        const rawHufAmount = isForeign
                          ? (linesHufSum > 0 && Math.abs(linesHufSum - rawTotalAmount) > 0.01 ? linesHufSum : rawTotalAmount * rate)
                          : 0;
                        const hufAmount = isStornoEntry ? -Math.abs(rawHufAmount) : rawHufAmount;

                        const statusInfo = getStatusInfo(e.status, t);
                        const journalNum = e.journal_number ? `${e.journal?.code}/${e.journal_number}` : '—';
                        const isDraft = ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status);
                        
                        const origRefEntry = isStornoEntry ? entriesById.get(e.stornoed_entry_id || e.original_entry_id) : null;
                        const stornoRefEntry = isStornoedOriginal ? stornoMap.get(e.id) : null;

                        return (
                          <TableRow key={e.id} className={cn("hover:bg-muted/20 transition-colors h-[45px]", isStornoEntry && "bg-amber-500/5 hover:bg-amber-500/10", isStornoedOriginal && "bg-rose-500/5 hover:bg-rose-500/10")}>
                            <TableCell className="w-[44px] text-center p-0">
                              {isDraft ? (
                                <div className="flex items-center justify-center">
                                  <Checkbox
                                    checked={selectedEntryIds.has(e.id)}
                                    onCheckedChange={() => toggleSelectEntry(e.id)}
                                    aria-label={`Tétel kijelölése: ${e.document_id || e.id}`}
                                  />
                                </div>
                              ) : (
                                <div className="flex items-center justify-center">
                                  {(() => {
                                    if (e.status === 'SZTORNOZOTT') {
                                      return (
                                        <CustomTooltip content="Sztornózott tétel (lezárt, nem jelölhető ki tömeges műveletre)">
                                          <span className="inline-flex items-center justify-center cursor-help text-muted-foreground/35 hover:text-muted-foreground/60 transition-colors">
                                            <Lock className="w-3.5 h-3.5" />
                                          </span>
                                        </CustomTooltip>
                                      );
                                    }
                                    const lock = checkEntryLock(e);
                                    if (lock.locked) {
                                      return (
                                        <CustomTooltip content={`Lekönyvelt zárt tétel (${lock.reason}). Közvetlenül nem módosítható, kizárólag számviteli sztornózással helyesbíthető.`}>
                                          <span className="inline-flex items-center justify-center cursor-help text-amber-500/80 hover:text-amber-600 transition-colors">
                                            <Lock className="w-3.5 h-3.5" />
                                          </span>
                                        </CustomTooltip>
                                      );
                                    }
                                    return (
                                      <CustomTooltip content="Lekönyvelt tétel nyitott időszakban. A sorvégi műveleteknél közvetlenül visszanyitható és szerkeszthető, vagy sztornózható.">
                                        <span className="inline-flex items-center justify-center cursor-help text-muted-foreground/35 hover:text-muted-foreground/60 transition-colors">
                                          <Lock className="w-3.5 h-3.5" />
                                        </span>
                                      </CustomTooltip>
                                    );
                                  })()}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="w-[95px] font-mono text-muted-foreground whitespace-nowrap">
                              {e.posting_date.replace(/-/g, '.')}
                            </TableCell>
                            <TableCell className="w-[110px] font-semibold text-foreground whitespace-nowrap truncate">
                              <div>{journalNum}</div>
                              {isStornoEntry && (
                                <span className="text-[9px] text-amber-600 dark:text-amber-400 font-mono block leading-tight truncate">
                                  ↩ {origRefEntry ? `${origRefEntry.journal?.code}/${origRefEntry.journal_number}` : 'eredeti'}
                                </span>
                              )}
                              {isStornoedOriginal && (
                                <span className="text-[9px] text-rose-500 dark:text-rose-400 font-mono block leading-tight truncate">
                                  ❌ {stornoRefEntry ? `${stornoRefEntry.journal?.code}/${stornoRefEntry.journal_number}` : 'sztornózva'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="w-[150px] font-mono truncate">
                              {e.document_id ? (
                                <CopyableCell
                                  value={e.document_id}
                                  displayValue={e.document_id}
                                  className="font-mono text-xs"
                                  maxWidth="135px"
                                  ariaLabel={`${e.document_id} másolása`}
                                />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="w-[180px] font-medium text-foreground truncate">
                              {e.partner?.name ? (
                                <CopyableCell
                                  value={e.partner.name}
                                  displayValue={e.partner.name.length > 18 ? e.partner.name.slice(0, 18) + '…' : e.partner.name}
                                  truncate
                                  maxWidth="165px"
                                  className="font-medium text-xs text-foreground"
                                  ariaLabel={`${e.partner.name} másolása`}
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
                            <TableCell className="w-[150px] text-right font-semibold tabular-nums whitespace-nowrap">
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
                                      <p className="text-muted-foreground font-mono">1 {e.currency} = {rate.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Ft</p>
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
                                        onClick={() => { setEditingEntryId(e.id); setManualEntryOpen(true); }}
                                        aria-label={t('accounting:journals.actions.edit_entry_aria', 'Bizonylat szerkesztése')}
                                      >
                                        <FileSpreadsheet className="w-3.5 h-3.5" />
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
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      <TablePlaceholderRows
                        currentCount={paginatedEntries.length}
                        pageSize={itemsPerPage}
                        columns={10}
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
                  <span>Bizonylat tételek: {selectedEntry.journal_number ? `${selectedEntry.journal?.code}/${selectedEntry.journal_number}` : 'Könyveletlen piszkozat'}</span>
                  <Badge variant="outline" className={cn("px-2 py-0.5 text-[10px] font-medium border uppercase", STATUS_LABELS[selectedEntry.status]?.color)}>
                    {STATUS_LABELS[selectedEntry.status]?.label}
                  </Badge>
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-6 py-6">
                {selectedEntry.entry_type === 'SZTORNO' && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
                    <RotateCcw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">SZTORNÓ BIZONYLAT</span>
                      <p className="text-[11px] mt-0.5 leading-relaxed">
                        Ez a bizonylat ellentétes előjellel sztornózza és kivezeti a kapcsolódó eredeti bizonylatot.
                        {(() => {
                          const orig = entriesById.get(selectedEntry.stornoed_entry_id || selectedEntry.original_entry_id);
                          return orig ? ` Hivatkozott eredeti tétel: ${orig.journal?.code}/${orig.journal_number} (${orig.document_id})` : '';
                        })()}
                      </p>
                    </div>
                  </div>
                )}

                {selectedEntry.status === 'SZTORNOZOTT' && (
                  <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">SZTORNÓZOTT (ÉRVÉNYTELENÍTETT) BIZONYLAT</span>
                      <p className="text-[11px] mt-0.5 leading-relaxed">
                        Ezt a bizonylatot hivatalosan sztornózták. A könyvelésből kivezetésre került egy ellentétes sztornó bizonylattal.
                        {(() => {
                          const st = stornoMap.get(selectedEntry.id);
                          return st ? ` Sztornó bizonylat száma: ${st.journal?.code}/${st.journal_number}` : '';
                        })()}
                      </p>
                    </div>
                  </div>
                )}

                {/* General Info */}
                <div className="grid grid-cols-2 gap-4 text-xs bg-muted/30 p-4 rounded-lg border">
                  <div>
                    <span className="text-muted-foreground block">Partner</span>
                    <span className="font-semibold text-foreground text-sm">{selectedEntry.partner?.name || '—'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Megnevezés</span>
                    <span className="font-semibold text-foreground text-sm">{selectedEntry.description}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Teljesítés dátuma</span>
                    <span className="font-medium text-foreground flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-muted-foreground" />{selectedEntry.posting_date.replace(/-/g, '.')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Bizonylatszám</span>
                    <span className="font-mono font-medium text-foreground">{selectedEntry.document_id}</span>
                  </div>
                  {selectedEntry.currency && selectedEntry.currency !== 'HUF' && (
                    <div>
                      <span className="text-muted-foreground block">Napi MNB árfolyam</span>
                      <span className="font-mono font-medium text-foreground">
                        1 {selectedEntry.currency} = {(Number(selectedEntry.exchange_rate) > 1 ? Number(selectedEntry.exchange_rate) : getDailyRate(selectedEntry.currency, selectedEntry.posting_date)).toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Ft
                      </span>
                    </div>
                  )}
                  {selectedEntry.justification && (
                    <div className="col-span-2 border-t pt-2 mt-2">
                      <span className="text-muted-foreground block">Indoklás / Megjegyzés</span>
                      <span className="italic text-foreground">{selectedEntry.justification}</span>
                    </div>
                  )}
                </div>

                {/* Double entry lines */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kontírozott tételek (Tétel sorok)</h4>
                  <div className="border rounded-lg overflow-hidden bg-card">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border/40 font-semibold text-[10px] uppercase text-muted-foreground">
                          <th className="p-2.5">Sorsz.</th>
                          <th className="p-2.5">Főkönyvi szám</th>
                          <th className="p-2.5">Főkönyvi megnevezés</th>
                          <th className="p-2.5 text-center">T/K</th>
                          <th className="p-2.5 text-right">Összeg</th>
                          <th className="p-2.5">Projekt</th>
                          <th className="p-2.5">Jegyzet</th>
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
                                const amtVal = isForeign ? (line.foreign_amount || line.amount) : line.amount;
                                const formatted = formatCurrency(amtVal, selectedEntry.currency || 'HUF');
                                
                                if (isForeign) {
                                  const lineRate = Number(selectedEntry.exchange_rate) > 1 
                                    ? Number(selectedEntry.exchange_rate) 
                                    : getDailyRate(selectedEntry.currency, selectedEntry.posting_date);
                                  const lineHuf = (Number(line.amount) > 0 && Math.abs(Number(line.amount) - amtVal) > 0.01)
                                    ? Number(line.amount)
                                    : amtVal * lineRate;
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
            <span>{t('accounting:journals.batch_bar.selected_count', 'tétel kijelölve a tömeges műveletekhez')}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
              onClick={() => bulkPostMutation.mutate(Array.from(selectedEntryIds))}
              disabled={bulkPostMutation.isPending || bulkUpdateStatusMutation.isPending || bulkDeleteMutation.isPending}
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
              className="h-8 text-xs gap-1.5 border-sky-500/30 text-sky-600 hover:bg-sky-500/10 hover:text-sky-700 dark:border-sky-500/30 dark:text-sky-400 dark:hover:bg-sky-950/40 dark:hover:text-sky-300"
              onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedEntryIds), status: 'JOVAHAGYASRA_VAR' })}
              disabled={bulkPostMutation.isPending || bulkUpdateStatusMutation.isPending || bulkDeleteMutation.isPending}
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
              onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedEntryIds), status: 'ELVETVE' })}
              disabled={bulkPostMutation.isPending || bulkUpdateStatusMutation.isPending || bulkDeleteMutation.isPending}
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
              disabled={bulkPostMutation.isPending || bulkUpdateStatusMutation.isPending || bulkDeleteMutation.isPending}
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
        onOpenChange={setManualEntryOpen}
        entryId={editingEntryId}
        onOpenOpeningWizard={() => setOpeningWizardOpen(true)}
      />

      <OpeningJournalWizardModal
        open={openingWizardOpen}
        onOpenChange={setOpeningWizardOpen}
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
            {t('accounting:journals.bulk_delete.confirm_prefix', 'Biztosan törölni szeretné a kijelölt')} <strong className="text-destructive font-semibold">{selectedEntryIds.size} db</strong> {t('accounting:journals.bulk_delete.confirm_suffix', 'piszkozatot?')}
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
                const ids = Array.from(selectedEntryIds);
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
      </div>
    </TooltipProvider>
  );
}
