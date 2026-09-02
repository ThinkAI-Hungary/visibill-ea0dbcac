import React, { useState, useEffect } from 'react';
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  GEPI_JAVASLAT: { label: 'Rendszer javaslat', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' },
  KEZI_PISZKOZAT: { label: 'Piszkozat', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  JOVAHAGYASRA_VAR: { label: 'Jóváhagyásra vár', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
  KONYVELT: { label: 'Könyvelt', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  SZTORNOZOTT: { label: 'Sztornózott', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
  ELVETVE: { label: 'Elvetve', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
};

const SOURCE_LABELS: Record<string, string> = {
  AUTO_SZAMLA: '⚙️ Számla',
  AUTO_BANK: '⚙️ Bank',
  AUTO_RENDSZER: '⚙️ Rendszer',
  KEZI: '✏️ Kézi',
  KEZI_MODOSITAS: '✏️ Módosítás',
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
      try {
        const { data, error } = await supabase.rpc('acc_generate_drafts_from_ledger', {
          p_company_id: selectedCompany.id,
          p_preset_id: activePresetId
        });
        if (error) throw error;
        return data;
      } catch (err: any) {
        console.warn('RPC acc_generate_drafts_from_ledger failed, executing robust fallback generator:', err);

        // 1. Delete existing system suggestions
        await supabase
          .from('acc_journal_headers')
          .delete()
          .eq('company_id', selectedCompany.id)
          .eq('status', 'GEPI_JAVASLAT');

        // 2. Ensure default journals exist
        await supabase.rpc('acc_seed_default_journals', { p_company_id: selectedCompany.id });

        // 3. Fetch categorized items
        const { data: items, error: itemsErr } = await supabase.rpc('get_gl_categorized_items', {
          p_company_id: selectedCompany.id,
          p_preset_id: activePresetId
        });
        if (itemsErr) throw itemsErr;
        if (!items || items.length === 0) return 0;

        // 4. Fetch GL Accounts & Journals
        const { data: glAccounts } = await supabase
          .from('gl_accounts')
          .select('id, gl_number')
          .or(`preset_id.eq.${activePresetId},company_id.eq.${selectedCompany.id}`);

        const { data: journals } = await supabase
          .from('acc_journals')
          .select('id, code, type, currency')
          .eq('company_id', selectedCompany.id);

        const glCustId = glAccounts?.find(g => g.gl_number.startsWith('311'))?.id || glAccounts?.[0]?.id;
        const glSuppId = glAccounts?.find(g => g.gl_number.startsWith('454'))?.id || glCustId;

        if (!glCustId || !glSuppId) return 0;

        const validGlIds = new Set((glAccounts || []).map(g => g.id));

        // Filter valid mapped items (MUST have a valid gl_account_id in gl_accounts, NOT nil UUID)
        const validItems = items.filter(
          (item: any) =>
            item.gl_account_id &&
            item.gl_account_id !== '00000000-0000-0000-0000-000000000000' &&
            validGlIds.has(item.gl_account_id) &&
            item.amount &&
            Math.abs(item.amount) > 0
        );

        let createdCount = 0;

        for (const item of validItems) {
          const itemDate = item.item_date ? item.item_date.substring(0, 10) : new Date().toISOString().substring(0, 10);
          const year = Number(itemDate.substring(0, 4)) || new Date().getFullYear();
          const currency = item.original_currency || 'HUF';
          const amount = Math.round(Math.abs(item.amount) * 100) / 100;
          const foreignAmount = item.original_amount ? Math.round(Math.abs(item.original_amount) * 100) / 100 : null;
          const exchangeRate = (currency !== 'HUF' && foreignAmount) ? Math.round((amount / foreignAmount) * 1000000) / 1000000 : 1;

          let journalId = journals?.find(j => j.code === 'VE')?.id || journals?.[0]?.id;
          let source = 'AUTO_RENDSZER';
          let docId = `MISC-${item.item_id.substring(0, 8).toUpperCase()}`;

          if (item.source_table === 'transactions') {
            source = 'AUTO_BANK';
            docId = `TR-${item.item_id.substring(0, 8).toUpperCase()}`;
            journalId = journals?.find(j => j.type === 'BANK' && j.currency === currency)?.id || journals?.find(j => j.code === 'B1')?.id || journalId;
          } else if (['invoice_items', 'nav_invoice_items'].includes(item.source_table)) {
            source = 'AUTO_SZAMLA';
            docId = `INV-${item.item_id.substring(0, 8).toUpperCase()}`;
            if (item.amount >= 0) {
              journalId = journals?.find(j => j.code === 'V')?.id || journalId;
            } else {
              journalId = journals?.find(j => j.code === 'SZ')?.id || journalId;
            }
          }

          let line1: any;
          let line2: any;

          if (item.source_table === 'transactions') {
            const glBankId = glAccounts?.find(g => g.gl_number.startsWith('384'))?.id || glAccounts?.[0]?.id;
            if (!glBankId || !validGlIds.has(glBankId) || !validGlIds.has(item.gl_account_id)) {
              continue;
            }
            if (item.amount >= 0) {
              line1 = { sequence_number: 1, gl_account_id: glBankId, dc_type: 'T', amount, foreign_amount: foreignAmount, description: item.description };
              line2 = { sequence_number: 2, gl_account_id: item.gl_account_id, dc_type: 'K', amount, foreign_amount: foreignAmount, description: item.description };
            } else {
              line1 = { sequence_number: 1, gl_account_id: item.gl_account_id, dc_type: 'T', amount, foreign_amount: foreignAmount, description: item.description };
              line2 = { sequence_number: 2, gl_account_id: glBankId, dc_type: 'K', amount, foreign_amount: foreignAmount, description: item.description };
            }
          } else {
            if (item.amount >= 0) {
              if (!glCustId || !validGlIds.has(glCustId) || !validGlIds.has(item.gl_account_id)) {
                continue;
              }
              line1 = { sequence_number: 1, gl_account_id: glCustId, dc_type: 'T', amount, foreign_amount: foreignAmount, description: item.description };
              line2 = { sequence_number: 2, gl_account_id: item.gl_account_id, dc_type: 'K', amount, foreign_amount: foreignAmount, description: item.description };
            } else {
              if (!glSuppId || !validGlIds.has(glSuppId) || !validGlIds.has(item.gl_account_id)) {
                continue;
              }
              line1 = { sequence_number: 1, gl_account_id: item.gl_account_id, dc_type: 'T', amount, foreign_amount: foreignAmount, description: item.description };
              line2 = { sequence_number: 2, gl_account_id: glSuppId, dc_type: 'K', amount, foreign_amount: foreignAmount, description: item.description };
            }
          }

          const { data: header, error: hErr } = await supabase
            .from('acc_journal_headers')
            .insert({
              company_id: selectedCompany.id,
              journal_id: journalId,
              accounting_year: year,
              status: 'GEPI_JAVASLAT',
              entry_type: 'NORMAL',
              source: source,
              posting_date: itemDate,
              document_date: itemDate,
              document_id: docId,
              description: item.description || 'Automatikus bizonylat javaslat',
              currency: currency,
              exchange_rate: exchangeRate,
              exchange_rate_date: itemDate,
              import_key: item.item_id.toString()
            })
            .select('id')
            .single();

          if (hErr) continue;

          line1.header_id = header.id;
          line2.header_id = header.id;

          await supabase.from('acc_journal_lines').insert([line1, line2]);
          createdCount++;
        }

        return createdCount;
      }
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      toast({ title: "Javaslatok sikeresen legenerálva", description: `${count} db könyvelési tétel javaslat jött létre a meglévő adatokból.` });
    },
    onError: (err) => {
      toast({ title: "Hiba a javaslatok generálásakor", description: err.message, variant: "destructive" });
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

      const { data, error } = await query.order('posting_date', { ascending: false });
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
              className="gap-1.5 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 dark:border-indigo-900/50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
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
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-500" onClick={() => { setEditingEntryId(null); setManualEntryOpen(true); }}>
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
              <TooltipContent side="bottom" className="bg-slate-900 border-slate-800 text-slate-100 p-2 text-xs shadow-md">
                <p className="font-semibold text-white">{j.code} - {j.name}</p>
                <p className="text-[10px] text-slate-400">Pénznem: {j.currency}</p>
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Keresés (partner, bizonylatszám, megnevezés...)"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-card border-border"
              />
            </div>
            
            {/* Items per page selector */}
            <div className="flex items-center gap-2 shrink-0 bg-card border border-border rounded-lg px-3 h-10 text-xs">
              <span className="text-muted-foreground font-medium">Sorok száma:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-transparent border-none focus:outline-none cursor-pointer font-bold text-foreground"
              >
                <option value={50} className="bg-card">50</option>
                <option value={100} className="bg-card">100</option>
                <option value={200} className="bg-card">200</option>
              </select>
            </div>
          </div>

          {/* List Table */}
          <Card className="border border-border bg-card overflow-hidden">

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/40 text-muted-foreground select-none uppercase font-semibold text-[10px] tracking-wider">
                      <th className="py-1.5 px-2 text-center w-10">
                        <input
                          type="checkbox"
                          checked={
                            paginatedEntries.length > 0 &&
                            paginatedEntries
                              .filter((e: any) => ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status))
                              .every((e: any) => selectedEntryIds.has(e.id))
                          }
                          onChange={(ev) => handleSelectAll(ev.target.checked, paginatedEntries)}
                          className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                        />
                      </th>
                      <th className="py-1.5 px-2">Dátum</th>
                      <th className="py-1.5 px-2">Naplószám</th>
                      <th className="py-1.5 px-2">Bizonylatszám</th>
                      <th className="py-1.5 px-2">Partner</th>
                      <th className="py-1.5 px-2">Megnevezés</th>
                      <th className="py-1.5 px-2 text-right">Összeg</th>
                      <th className="py-1.5 px-2 text-center">Típus</th>
                      <th className="py-1.5 px-2 text-center">Státusz</th>
                      <th className="py-1.5 px-2 text-right">Műveletek</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {loadingEntries ? (
                      <tr>
                        <td colSpan={10} className="p-12 text-center text-muted-foreground">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
                          Tételek betöltése...
                        </td>
                      </tr>
                    ) : filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-12 text-center text-muted-foreground">
                          <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                          Nincsenek tételek ebben a nézetben.
                        </td>
                      </tr>
                    ) : (
                      paginatedEntries.map((e: any) => {
                        const isForeign = e.currency && e.currency !== 'HUF';
                        const totalAmount = e.lines?.reduce((acc: number, l: any) => {
                          if (l.dc_type !== 'T') return acc;
                          const val = isForeign ? (l.foreign_amount || l.amount) : l.amount;
                          return acc + Number(val);
                        }, 0) || 0;
                        const hufAmount = isForeign
                          ? e.lines?.reduce((acc: number, l: any) => l.dc_type === 'T' ? acc + Number(l.amount) : acc, 0) || 0
                          : 0;

                        const statusInfo = STATUS_LABELS[e.status] || { label: e.status, color: 'bg-slate-500/10' };
                        const journalNum = e.journal_number ? `${e.journal?.code}/${e.journal_number}` : '—';
                        const isDraft = ['KEZI_PISZKOZAT', 'JOVAHAGYASRA_VAR', 'GEPI_JAVASLAT'].includes(e.status);
                        
                        return (
                          <tr key={e.id} className="hover:bg-muted/20 transition-colors">
                            <td className="py-1 px-2 text-center w-10">
                              {isDraft ? (
                                <input
                                  type="checkbox"
                                  checked={selectedEntryIds.has(e.id)}
                                  onChange={() => toggleSelectEntry(e.id)}
                                  className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                                />
                              ) : (
                                <div className="w-3.5 h-3.5 mx-auto" />
                              )}
                            </td>
                            <td className="py-1 px-2 font-mono text-muted-foreground">{e.posting_date.replace(/-/g, '.')}</td>
                            <td className="py-1 px-2 font-semibold text-foreground">{journalNum}</td>
                            <td className="py-1 px-2 font-mono">{e.document_id}</td>
                            <td className="py-1 px-2 font-medium text-foreground">{e.partner?.name || '—'}</td>
                            <td className="py-1 px-2">
                              <Tooltip delayDuration={0}>
                                <TooltipTrigger asChild>
                                  <div className="truncate max-w-[200px] font-medium text-foreground cursor-default">
                                    {e.description}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[400px] bg-slate-900 border-slate-800 text-slate-100 p-2 text-xs shadow-md">
                                  <p className="whitespace-pre-wrap">{e.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </td>
                            <td className="py-1 px-2 text-right font-semibold tabular-nums">
                              <div className="flex flex-col items-end">
                                <span>{formatCurrency(totalAmount, e.currency || 'HUF')}</span>
                                {isForeign && (
                                  <span className="text-[10px] text-muted-foreground font-normal leading-tight">
                                    ({formatCurrency(hufAmount, 'HUF')})
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-1 px-2 text-center text-[10px] text-muted-foreground font-mono">{SOURCE_LABELS[e.source] || e.source}</td>
                            <td className="py-1 px-2 text-center">
                              <Badge className={cn("px-2 py-0.5 text-[10px] font-medium border uppercase", statusInfo.color)} variant="outline">
                                {statusInfo.label}
                              </Badge>
                            </td>
                            <td className="py-1 px-2 text-right">
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
                                    <Button size="icon" variant="ghost" className="w-6 h-6 text-sky-600 hover:bg-sky-50" title="Javítás/Helyesbítés" onClick={() => handleStorno(e.id, true)}>
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
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {totalItems > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/40 bg-muted/20 text-xs flex-wrap gap-3">
                  <div className="text-muted-foreground">
                    Összesen <span className="font-semibold text-foreground">{totalItems}</span> tételből{' '}
                    <span className="font-semibold text-foreground">
                      {Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)} -{' '}
                      {Math.min(currentPage * itemsPerPage, totalItems)}
                    </span>{' '}
                    megjelenítve
                  </div>
                  {totalPages > 1 && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="h-8"
                      >
                        Előző
                      </Button>
                      <div className="flex items-center px-3 font-medium">
                        {currentPage} / {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="h-8"
                      >
                        Következő
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
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
                                  const formattedHuf = formatCurrency(line.amount, 'HUF');
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
            <span className="bg-primary/10 px-3 py-1 rounded-full text-xs font-bold tabular-nums text-primary-foreground dark:text-primary">
              {selectedEntryIds.size}
            </span>
            <span>tétel kijelölve a tömeges műveletekhez</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-950 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
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
              className="h-8 text-xs gap-1.5 border-sky-200 text-sky-700 hover:bg-sky-50 dark:border-sky-950 dark:text-sky-400 dark:hover:bg-sky-950/30"
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
              className="h-8 text-xs gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/30"
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

      {auditEntryId && (
        <AuditTrailDialog
          open={!!auditEntryId}
          onOpenChange={(o) => !o && setAuditEntryId(null)}
          entityId={auditEntryId}
          entityType="acc_journal_headers"
        />
      )}
      </div>
    </TooltipProvider>
  );
}
