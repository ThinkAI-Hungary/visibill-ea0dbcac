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
  XCircle
} from 'lucide-react';
import AddManualJournalEntryModal from '@/components/journals/AddManualJournalEntryModal';
import OpeningJournalWizardModal from '@/components/journals/OpeningJournalWizardModal';
import PeriodClosingSettings from '@/components/journals/PeriodClosingSettings';
import AuditTrailDialog from '@/components/journals/AuditTrailDialog';
import { useActivePreset } from '@/hooks/useActivePreset';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { TablePlaceholderRows } from '@/components/ui/table-placeholder-rows';
import { CopyableCell } from '@/components/ui/copyable-cell';
import { Checkbox } from '@/components/ui/checkbox';


const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  GEPI_JAVASLAT: { label: 'Rendszer javaslat', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
  KEZI_PISZKOZAT: { label: 'Piszkozat', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  JOVAHAGYASRA_VAR: { label: 'Jóváhagyásra vár', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
  KONYVELT: { label: 'Könyvelt', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  SZTORNOZOTT: { label: 'Sztornózott', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
  ELVETVE: { label: 'Elvetve', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
};

export const SOURCE_LABELS: Record<string, string> = {
  AUTO_SZAMLA: 'Számla',
  AUTO_BANK: 'Bank',
  AUTO_RENDSZER: 'Rendszer',
  KEZI: 'Kézi',
  KEZI_MODOSITAS: 'Módosítás',
};

const renderSourceBadge = (source: string) => {
  switch (source) {
    case 'AUTO_SZAMLA':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-sky-600 dark:text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20 whitespace-nowrap">
          <Receipt className="w-3 h-3 text-sky-500 shrink-0" />
          Számla
        </span>
      );
    case 'AUTO_BANK':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 whitespace-nowrap">
          <Landmark className="w-3 h-3 text-emerald-500 shrink-0" />
          Bank
        </span>
      );
    case 'AUTO_RENDSZER':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 whitespace-nowrap">
          <Bot className="w-3 h-3 text-indigo-500 shrink-0" />
          Rendszer
        </span>
      );
    case 'KEZI':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 whitespace-nowrap">
          <PenTool className="w-3 h-3 text-amber-500 shrink-0" />
          Kézi
        </span>
      );
    case 'KEZI_MODOSITAS':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 whitespace-nowrap">
          <PenLine className="w-3 h-3 text-orange-500 shrink-0" />
          Módosítás
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
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Reset page and selection when search or journal changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedEntryIds(new Set());
  }, [search, selectedJournalId]);
  
  // Modals state
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [openingWizardOpen, setOpeningWizardOpen] = useState(false);
  const [periodClosingOpen, setPeriodClosingOpen] = useState(false);
  const [auditEntryId, setAuditEntryId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Storno / Correction dialog state
  const [stornoOpen, setStornoOpen] = useState(false);
  const [stornoTarget, setStornoTarget] = useState<{ headerId: string; correct: boolean } | null>(null);
  const [stornoReason, setStornoReason] = useState('');

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
      toast({ title: "Naplók sikeresen inicializálva" });
    },
    onError: (err) => {
      toast({ title: "Sikertelen inicializálás", description: err.message, variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      toast({ title: "Tétel sikeresen lekönyvelve" });
    },
    onError: (err) => {
      toast({ title: "Könyvelési hiba", description: err.message, variant: "destructive" });
    }
  });

  // Bulk post mutation
  const bulkPostMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Bejelentkezés szükséges");

      for (const id of ids) {
        const { error } = await supabase.rpc('acc_post_journal_entry', {
          p_header_id: id,
          p_user_id: user.id
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      setSelectedEntryIds(new Set());
      toast({ title: "Kijelölt tételek sikeresen lekönyvelve" });
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
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
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
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
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

  // Delete draft mutation
  const deleteMutation = useMutation({
    mutationFn: async (headerId: string) => {
      const { error: linesErr } = await supabase.from('acc_journal_lines').delete().eq('header_id', headerId);
      if (linesErr) throw linesErr;

      const { error: headerErr } = await supabase.from('acc_journal_headers').delete().eq('id', headerId);
      if (headerErr) throw headerErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['acc-ny-entries-count'] });
      setSelectedEntry(null);
      toast({ title: "Piszkozat törölve" });
    },
    onError: (err) => {
      toast({ title: "Törlési hiba", description: err.message, variant: "destructive" });
    }
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error: linesErr } = await supabase.from('acc_journal_lines').delete().in('header_id', ids);
      if (linesErr) throw linesErr;

      const { error: headerErr } = await supabase.from('acc_journal_headers').delete().in('id', ids);
      if (headerErr) throw headerErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['acc-ny-entries-count'] });
      setSelectedEntryIds(new Set());
      toast({ title: "Kijelölt piszkozatok sikeresen törölve" });
    },
    onError: (err) => {
      toast({ title: "Törlési hiba", description: err.message, variant: "destructive" });
    }
  });

  // Handle storno prompt
  const handleStorno = (headerId: string, correct: boolean) => {
    setStornoTarget({ headerId, correct });
    setStornoReason('');
    setStornoOpen(true);
  };

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

  // Filtered entries
  const filteredEntries = entries.filter((e: any) => {
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
        breadcrumb="Könyvelési Naplók"
        title="Könyvelési Naplók"
        description="A vállalkozás kettős könyvvitelének naplónemenkénti, idősoros és zárt nyilvántartása."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPeriodClosingOpen(true)}>
              <Lock className="w-4 h-4" /> Időszakzárás
            </Button>
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
              Javaslatok generálása
            </Button>
            <Button
              size="sm"
              className="gap-1.5 shadow-sm"
              onClick={() => { setEditingEntryId(null); setManualEntryOpen(true); }}
            >
              <Plus className="w-4 h-4" /> Új vegyes bizonylat
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
              <span className={cn("font-bold text-[11px] leading-tight whitespace-nowrap", selectedJournalId === 'munkalista' ? "text-primary-foreground" : "text-foreground")}>Munkalista</span>
              <span className={cn("text-[8px] leading-none whitespace-nowrap", selectedJournalId === 'munkalista' ? "text-primary-foreground/80" : "text-muted-foreground")}>Drafts</span>
            </div>
          </div>
          <Badge variant={selectedJournalId === 'munkalista' ? 'secondary' : 'outline'} className="px-1.5 py-0.5 text-[8px] shrink-0 font-normal mr-1">
            Függő
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
                    <span className={cn("text-[8px] leading-none truncate", selectedJournalId === j.id ? "text-primary-foreground/80" : "text-muted-foreground")}>{j.name}</span>
                  </div>
                  <Badge variant={selectedJournalId === j.id ? 'secondary' : 'outline'} className="px-1.5 py-0.5 text-[8px] shrink-0 font-normal mr-1">
                    {j.currency}
                  </Badge>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="p-2 text-xs shadow-md">
                <p className="font-semibold text-popover-foreground">{j.code} - {j.name}</p>
                <p className="text-[10px] text-muted-foreground">Pénznem: {j.currency}</p>
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
                      <span>Nyitó Napló (NY) — Sztv. 491. Technikai Nyitómérleg</span>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Mérlegfolytonosság</Badge>
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Az előző évi záró mérleg felvezetése a 491. Nyitómérleg számlával szemben (Kötelező validáció: Σ T = Σ K).
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button size="sm" className="gap-1.5 shadow-sm" onClick={() => setOpeningWizardOpen(true)}>
                    <BookOpen className="w-4 h-4" /> Nyitó Varázsló indítása
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Filters */}
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Keresés (partner, bizonylatszám, megnevezés...)"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 bg-card border-border shadow-none"
              />
            </div>
          </div>

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
                        <Checkbox
                          checked={
                            paginatedEntries.length > 0 &&
                            paginatedEntries
                              .filter((e: any) => ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status))
                              .every((e: any) => selectedEntryIds.has(e.id))
                          }
                          onCheckedChange={(checked) => handleSelectAll(!!checked, paginatedEntries)}
                          aria-label="Összes piszkozat kijelölése"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="w-[95px] whitespace-nowrap">Dátum</TableHead>
                    <TableHead className="w-[110px] whitespace-nowrap">Naplószám</TableHead>
                    <TableHead className="w-[150px] whitespace-nowrap">Bizonylatszám</TableHead>
                    <TableHead className="w-[180px] whitespace-nowrap">Partner</TableHead>
                    <TableHead className="w-auto min-w-[200px]">Megnevezés</TableHead>
                    <TableHead className="w-[150px] text-right whitespace-nowrap">Összeg</TableHead>
                    <TableHead className="w-[100px] text-center whitespace-nowrap">Típus</TableHead>
                    <TableHead className="w-[130px] text-center whitespace-nowrap">Státusz</TableHead>
                    <TableHead className="w-[120px] text-right whitespace-nowrap">Műveletek</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border/20">
                  {loadingEntries ? (
                    <TableSkeleton columns={10} rows={8} />
                  ) : filteredEntries.length === 0 ? (
                    <TableEmptyState
                      colSpan={10}
                      icon={search ? Search : FileText}
                      title={search ? "Nincs találat a megadott keresési feltételekre" : "Nincsenek tételek ebben a nézetben"}
                      description={search ? "Próbáld módosítani a keresési feltételt vagy törölni a szűrőt." : "Ehhez a naplóhoz még nem tartoznak könyvelési tételek a megadott időszakban."}
                      onClearFilters={search ? () => setSearch('') : undefined}
                      clearLabel="Keresés törlése"
                    />
                  ) : (
                    <>
                      {paginatedEntries.map((e: any) => {
                        const isForeign = e.currency && e.currency !== 'HUF';
                        const totalAmount = e.lines?.reduce((acc: number, l: any) => {
                          if (l.dc_type !== 'T') return acc;
                          const val = isForeign ? (l.foreign_amount || l.amount) : l.amount;
                          return acc + Number(val);
                        }, 0) || 0;

                        // Resolve daily exchange rate for the posting date
                        const headerRate = Number(e.exchange_rate) || 0;
                        const rate = headerRate > 1 ? headerRate : getDailyRate(e.currency, e.posting_date);

                        // Calculate HUF amount:
                        // 1. If line amounts in DB are already converted (differ from foreign amount), sum them
                        const linesHufSum = isForeign
                          ? e.lines?.reduce((acc: number, l: any) => l.dc_type === 'T' ? acc + Number(l.amount) : acc, 0) || 0
                          : 0;

                        // 2. If lines were already converted, use linesHufSum. Otherwise calculate directly using that day's exchange rate
                        const hufAmount = isForeign
                          ? (linesHufSum > 0 && Math.abs(linesHufSum - totalAmount) > 0.01 ? linesHufSum : totalAmount * rate)
                          : 0;

                        const statusInfo = STATUS_LABELS[e.status] || { label: e.status, color: 'bg-slate-500/10' };
                        const journalNum = e.journal_number ? `${e.journal?.code}/${e.journal_number}` : '—';
                        const isDraft = ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status);
                        
                        return (
                          <TableRow key={e.id} className="hover:bg-muted/20 transition-colors h-[45px]">
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
                                <div className="w-4 h-4 mx-auto" />
                              )}
                            </TableCell>
                            <TableCell className="w-[95px] font-mono text-muted-foreground whitespace-nowrap">
                              {e.posting_date.replace(/-/g, '.')}
                            </TableCell>
                            <TableCell className="w-[110px] font-semibold text-foreground whitespace-nowrap truncate">
                              {journalNum}
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
                                <span>{formatCurrency(totalAmount, e.currency || 'HUF')}</span>
                                {isForeign && (
                                  <Tooltip delayDuration={150}>
                                    <TooltipTrigger asChild>
                                      <span className="text-[10px] text-muted-foreground font-normal leading-tight cursor-help hover:text-foreground transition-colors">
                                        ({formatCurrency(hufAmount, 'HUF')})
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="text-xs">
                                      <p className="font-medium">Napi MNB árfolyam ({e.posting_date.replace(/-/g, '.')}):</p>
                                      <p className="text-muted-foreground font-mono">1 {e.currency} = {rate.toLocaleString('hu-HU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Ft</p>
                                    </TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="w-[100px] text-center">
                              {renderSourceBadge(e.source)}
                            </TableCell>
                            <TableCell className="w-[130px] text-center whitespace-nowrap">
                              <Badge className={cn("px-2 py-0.5 text-[10px] font-medium border uppercase", statusInfo.color)} variant="outline">
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="w-[120px] text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground hover:text-foreground" onClick={() => setSelectedEntry(e)}>
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="w-6 h-6 text-muted-foreground hover:text-foreground" onClick={() => setAuditEntryId(e.id)}>
                                  <History className="w-3.5 h-3.5" />
                                </Button>
                                {e.status === 'KONYVELT' && (
                                  <>
                                    <Button size="icon" variant="ghost" className="w-6 h-6 text-destructive hover:bg-destructive/10" title="Sztornózás" onClick={() => handleStorno(e.id, false)}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="w-6 h-6 text-sky-600 hover:bg-sky-500/10 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/30" title="Javítás/Helyesbítés" onClick={() => handleStorno(e.id, true)}>
                                      <CornerDownRight className="w-3.5 h-3.5" />
                                    </Button>
                                  </>
                                )}
                                {(e.status === 'KEZI_PISZKOZAT' || e.status === 'JOVAHAGYASRA_VAR' || e.status === 'GEPI_JAVASLAT') && (
                                  <>
                                    <Button size="icon" variant="ghost" className="w-6 h-6 text-emerald-600 hover:bg-emerald-500/10 dark:hover:bg-emerald-950/30" title="Könyvelés" onClick={() => postMutation.mutate(e.id)} disabled={postMutation.isPending}>
                                      <ShieldCheck className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="w-6 h-6 text-primary" title="Szerkesztés" onClick={() => { setEditingEntryId(e.id); setManualEntryOpen(true); }}>
                                      <FileSpreadsheet className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="w-6 h-6 text-destructive" title="Piszkozat törlése" onClick={(ev) => { ev.stopPropagation(); if (confirm("Biztosan törli ezt a piszkozatot?")) deleteMutation.mutate(e.id); }}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
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

      {/* Modals components */}
      {manualEntryOpen && (
        <AddManualJournalEntryModal
          open={manualEntryOpen}
          onOpenChange={setManualEntryOpen}
          entryId={editingEntryId}
        />
      )}

      {periodClosingOpen && (
        <PeriodClosingSettings
          open={periodClosingOpen}
          onOpenChange={setPeriodClosingOpen}
        />
      )}

      {auditEntryId && (
        <AuditTrailDialog
          open={!!auditEntryId}
          onOpenChange={open => !open && setAuditEntryId(null)}
          entryId={auditEntryId}
        />
      )}

      {stornoOpen && (
        <Dialog open={stornoOpen} onOpenChange={setStornoOpen}>
          <DialogContent className="sm:max-w-md bg-card border border-border">
            <DialogHeader>
              <DialogTitle className={cn("text-base font-bold", stornoTarget?.correct ? "text-primary" : "text-destructive")}>
                {stornoTarget?.correct ? 'Bizonylat helyesbítése' : 'Bizonylat sztornózása'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1">
                {stornoTarget?.correct 
                  ? 'Kérjük, adja meg a helyesbítés indokát. A helyesbítés során egy ellentétes előjelű (storno) tétel, majd egy új, javított kézi piszkozat jön létre.'
                  : 'Kérjük, adja meg a sztornózás indokát. A sztornózás során egy ellentétes előjelű tétel jön létre, amely lezárja az eredetit.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-3">
              <div className="space-y-1.5">
                <label htmlFor="storno-reason" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Indoklás <span className="text-destructive">*</span>
                </label>
                <Input
                  id="storno-reason"
                  value={stornoReason}
                  onChange={e => setStornoReason(e.target.value)}
                  placeholder="Pl. Hibás összeg, téves kontírozás..."
                  className="h-9 text-xs"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0 border-t border-border/10 pt-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setStornoOpen(false)} className="h-9 text-xs">
                Mégse
              </Button>
              <Button
                type="button"
                variant={stornoTarget?.correct ? 'default' : 'destructive'}
                size="sm"
                disabled={!stornoReason.trim() || stornoMutation.isPending}
                className="h-9 text-xs font-semibold"
                onClick={() => {
                  if (stornoTarget) {
                    stornoMutation.mutate({
                      headerId: stornoTarget.headerId,
                      reason: stornoReason,
                      correct: stornoTarget.correct
                    });
                    setStornoOpen(false);
                  }
                }}
              >
                {stornoMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                {stornoTarget?.correct ? 'Helyesbítés indítása' : 'Sztornózás végrehajtása'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selectedEntryIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-4xl bg-card border border-primary/30 shadow-2xl rounded-2xl px-6 py-4 flex items-center justify-between z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 text-sm font-semibold text-primary">
            <span className="bg-primary/10 px-3 py-1 rounded-full text-xs font-bold tabular-nums text-primary">
              {selectedEntryIds.size}
            </span>
            <span>tétel kijelölve a tömeges műveletekhez</span>
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
              Kijelöltek könyvelése
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
              Jóváhagyásra küldés
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
              Kijelöltek elvetése
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-destructive/20 text-destructive hover:bg-destructive/10"
              onClick={(ev) => {
                ev.stopPropagation();
                if (confirm(`Biztosan törölni szeretné a kijelölt ${selectedEntryIds.size} db piszkozatot?`)) {
                  bulkDeleteMutation.mutate(Array.from(selectedEntryIds));
                }
              }}
              disabled={bulkPostMutation.isPending || bulkUpdateStatusMutation.isPending || bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Kijelöltek törlése
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs px-2 text-muted-foreground"
              onClick={() => setSelectedEntryIds(new Set())}
            >
              Mégse
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
      </div>
    </TooltipProvider>
  );
}
