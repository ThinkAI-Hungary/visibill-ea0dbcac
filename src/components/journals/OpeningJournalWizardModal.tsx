import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { useActivePreset } from '@/hooks/useActivePreset';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle2, BookOpen, ShieldCheck, ArrowRight, ArrowLeft, UploadCloud, RefreshCw, Sparkles, Scale, Check, AlertTriangle } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { CustomTooltip } from '@/components/ui/custom-tooltip';
import { DatePicker } from '@/components/ui/date-picker';
import { NumberInput } from '@/components/ui/number-input';
import OpeningCSVImportModal from './OpeningCSVImportModal';

interface OpeningJournalWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headerId?: string | null;
}

interface OpeningLineInput {
  id?: string;
  gl_account_id: string;
  gl_number?: string;
  gl_name?: string;
  dc_type: 'T' | 'K';
  amount: number;
  description: string;
}

const WIZARD_STEPS = [
  { id: 1 as const, title: 'Alapadatok' },
  { id: 2 as const, title: 'Főkönyv & 491' },
  { id: 3 as const, title: 'Analitika' },
  { id: 4 as const, title: 'Rendező' },
];

export default function OpeningJournalWizardModal({
  open,
  onOpenChange,
  headerId
}: OpeningJournalWizardModalProps) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activePresetId } = useActivePreset(selectedCompany?.id);

  // Wizard Step (1: Params, 2: GL Opening + 491 Check, 3: Sub-ledger Match, 4: Reconcile)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const currentYear = new Date().getFullYear();
  const [accountingYear, setAccountingYear] = useState<number>(currentYear);
  const [postingDate, setPostingDate] = useState<string>(`${currentYear}-01-01`);
  const [documentId, setDocumentId] = useState<string>('NYITO-' + currentYear);
  const [justification, setJustification] = useState<string>('Előző évi záró mérleg és nyitó főkönyvi kivonat alapján');
  const [transitionType, setTransitionType] = useState<'EVFORDULOS' | 'EVKOZBENI'>('EVFORDULOS');
  
  const [lines, setLines] = useState<OpeningLineInput[]>([
    { gl_account_id: '', dc_type: 'T', amount: 0, description: 'Eszköz nyitó tétel' },
    { gl_account_id: '', dc_type: 'K', amount: 0, description: 'Forrás nyitó tétel' },
  ]);

  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [reconcileResult, setReconcileResult] = useState<any>(null);

  // Full reset to Step 1 & initial form state
  const resetWizard = useCallback(() => {
    setStep(1);
    setAccountingYear(currentYear);
    setPostingDate(`${currentYear}-01-01`);
    setDocumentId(`NYITO-${currentYear}`);
    setJustification('Előző évi záró mérleg és nyitó főkönyvi kivonat alapján');
    setTransitionType('EVFORDULOS');
    setLines([
      { gl_account_id: '', dc_type: 'T', amount: 0, description: 'Eszköz nyitó tétel' },
      { gl_account_id: '', dc_type: 'K', amount: 0, description: 'Forrás nyitó tétel' },
    ]);
    setOpenDropdownIndex(null);
    setSearchQuery('');
    setCsvImportOpen(false);
    setReconcileResult(null);
  }, [currentYear]);

  // Handle modal closing with state reset
  const handleClose = useCallback(() => {
    onOpenChange(false);
    resetWizard();
  }, [onOpenChange, resetWizard]);

  // Reset if modal is closed
  useEffect(() => {
    if (!open) {
      resetWizard();
    }
  }, [open, resetWizard]);

  // Update date when accounting year or transition type changes
  useEffect(() => {
    if (transitionType === 'EVFORDULOS') {
      setPostingDate(`${accountingYear}-01-01`);
    }
    if (!documentId || documentId.startsWith('NYITO-')) {
      setDocumentId(`NYITO-${accountingYear}`);
    }
  }, [accountingYear, transitionType]);

  // Check if an opening entry already exists for this company & year
  const { data: existingOpeningEntry } = useQuery({
    queryKey: ['existing-opening-entry', selectedCompany?.id, accountingYear],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      const { data, error } = await supabase
        .from('acc_journal_headers')
        .select('id, document_id, posting_date, status, created_at')
        .eq('company_id', selectedCompany.id)
        .eq('accounting_year', accountingYear)
        .eq('entry_type', 'OPENING')
        .neq('status', 'TOROLT')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error checking existing opening entry:', error);
        return null;
      }
      return data;
    },
    enabled: !!selectedCompany?.id && open,
  });

  // Fetch NY Journal ID
  const { data: nyJournal } = useQuery({
    queryKey: ['acc-ny-journal', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      const { data, error } = await supabase
        .from('acc_journals')
        .select('id, code, name')
        .eq('company_id', selectedCompany.id)
        .eq('code', 'NY')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  // Fetch GL Accounts (Filtered to 1-4 Balance sheet accounts for Opening, paginated)
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['gl-accounts-balance-sheet', activePresetId],
    queryFn: async () => {
      if (!activePresetId) return [];
      const data = await fetchAllGlAccountsByPreset(activePresetId);
      
      // Filter to Balance sheet accounts (1-4)
      return (data || []).filter(g => {
        const firstDigit = g.gl_number.replace(/\./g, '').substring(0, 1);
        return ['1', '2', '3', '4'].includes(firstDigit);
      });
    },
    enabled: !!activePresetId,
  });

  // Fetch Subledger reconciliation status
  const { data: subledgerData, refetch: refetchSubledger } = useQuery({
    queryKey: ['subledger-reconciliation', selectedCompany?.id, accountingYear],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      const { data, error } = await supabase.rpc('acc_check_opening_subledger_reconciliation' as any, {
        p_company_id: selectedCompany.id,
        p_year: accountingYear
      });
      if (error) return null;
      return data as { open_ar_subledger: number; gl_311_opening: number; ar_diff: number; open_ap_subledger: number; gl_454_opening: number; ap_diff: number } | null;
    },
    enabled: !!selectedCompany?.id && open && step >= 3,
  });

  // Live 491 & Balance Calculations
  const assetDebitSum = lines
    .filter(l => {
      const g = glAccounts.find(acc => acc.id === l.gl_account_id);
      if (!g) return l.dc_type === 'T';
      const firstDigit = g.gl_number.replace(/\./g, '').substring(0, 1);
      return ['1', '2', '3'].includes(firstDigit) && l.dc_type === 'T';
    })
    .reduce((sum, l) => sum + (l.amount || 0), 0);

  const liabilityCreditSum = lines
    .filter(l => {
      const g = glAccounts.find(acc => acc.id === l.gl_account_id);
      if (!g) return l.dc_type === 'K';
      const firstDigit = g.gl_number.replace(/\./g, '').substring(0, 1);
      return firstDigit === '4' && l.dc_type === 'K';
    })
    .reduce((sum, l) => sum + (l.amount || 0), 0);

  const totalDebit = lines.filter(l => l.dc_type === 'T').reduce((sum, l) => sum + (l.amount || 0), 0);
  const totalCredit = lines.filter(l => l.dc_type === 'K').reduce((sum, l) => sum + (l.amount || 0), 0);
  
  // Imbalance of double-entry
  const totalImbalance = totalDebit - totalCredit;

  // 491 Account balance calculation:
  // Eszköz nyitás: T Eszköz - K 491 (adds Credit to 491)
  // Forrás nyitás: T 491 - K Forrás (adds Debit to 491)
  const is491Balanced = totalImbalance === 0;

  // Save / Post Opening Mutation
  const saveAndPostMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id || !nyJournal?.id) {
        throw new Error('Cég vagy Nyitó napló nem található.');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Bejelentkezés szükséges.');

      // 1. Create Header
      const { data: header, error: headerErr } = await supabase
        .from('acc_journal_headers')
        .insert({
          company_id: selectedCompany.id,
          journal_id: nyJournal.id,
          accounting_year: accountingYear,
          status: 'KEZI_PISZKOZAT',
          entry_type: 'OPENING',
          source: 'KEZI',
          posting_date: postingDate,
          document_date: postingDate,
          document_id: documentId,
          description: `Nyitó tételek (${accountingYear})`,
          justification: justification,
          currency: 'HUF',
          created_by: user.id
        })
        .select('id')
        .single();

      if (headerErr) throw headerErr;

      // 2. Insert Lines with 491 Technical Counter-Lines
      // For every Asset T: insert T Eszköz and K 491
      // For every Liability K: insert T 491 and K Forrás
      const technicalAccount491 = glAccounts.find(g => g.gl_number.replace(/\./g, '').startsWith('491'));
      
      const insertLines: any[] = [];
      let seq = 1;

      for (const line of lines) {
        if (!line.gl_account_id || !line.amount) continue;

        // Original line
        insertLines.push({
          header_id: header.id,
          sequence_number: seq++,
          gl_account_id: line.gl_account_id,
          dc_type: line.dc_type,
          amount: line.amount,
          description: line.description || 'Nyitó tétel'
        });

        // Technical 491 counter line
        if (technicalAccount491) {
          insertLines.push({
            header_id: header.id,
            sequence_number: seq++,
            gl_account_id: technicalAccount491.id,
            dc_type: line.dc_type === 'T' ? 'K' : 'T',
            amount: line.amount,
            description: `491 Technikai ellenszámla (${line.gl_number || ''})`
          });
        }
      }

      const { error: linesErr } = await supabase
        .from('acc_journal_lines')
        .insert(insertLines);

      if (linesErr) throw linesErr;

      // 3. Call acc_validate_and_post_opening_entry RPC
      const { data: postResult, error: postErr } = await supabase.rpc('acc_validate_and_post_opening_entry' as any, {
        p_header_id: header.id,
        p_user_id: user.id
      });

      if (postErr) throw postErr;
      const res = postResult as any;
      if (!res?.success) {
        // Rollback header if validation failed
        await supabase.from('acc_journal_headers').delete().eq('id', header.id);
        throw new Error(res?.error || 'Validation failed');
      }

      return header.id;
    },
    onSuccess: (newHeaderId) => {
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      queryClient.invalidateQueries({ queryKey: ['subledger-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['existing-opening-entry'] });
      toast({ title: 'Sikeres nyitás!', description: 'A Nyitó tételek lekönyvelése sikeresen megtörtént!' });
      setStep(4);
    },
    onError: (err: any) => {
      toast({ title: 'Könyvelési hiba', description: err.message, variant: 'destructive' });
    }
  });

  // Post-Opening Reconciliations Mutation
  const postOpeningReconciliateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Bejelentkezés szükséges.');

      const { data, error } = await supabase.rpc('acc_generate_post_opening_reconciliations' as any, {
        p_company_id: selectedCompany.id,
        p_user_id: user.id,
        p_year: accountingYear
      });

      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      setReconcileResult(data);
      queryClient.invalidateQueries({ queryKey: ['acc-journal-entries'] });
      toast({ title: 'Rendező tételek lefuttatva', description: data?.message });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba a rendező tételeknél', description: err.message, variant: 'destructive' });
    }
  });

  // Line Handlers
  const handleAddLine = () => {
    setLines(prev => {
      const next = [
        ...prev,
        { gl_account_id: '', dc_type: 'T' as const, amount: 0, description: 'Nyitó tétel' }
      ];
      setTimeout(() => {
        const nextIdx = next.length - 1;
        document.getElementById(`gl-account-trigger-${nextIdx}`)?.focus();
      }, 50);
      return next;
    });
  };

  const handleRemoveLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateLine = (index: number, field: keyof OpeningLineInput, value: any) => {
    setLines(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === 'gl_account_id') {
        const selected = glAccounts.find(g => g.id === value);
        if (selected) {
          next[index].gl_number = selected.gl_number;
          next[index].gl_name = selected.short_name;
        }
      }
      return next;
    });
  };

  const handleImportGlBalances = (imported: Array<{ gl_number: string; dc_type: 'T' | 'K'; amount: number; description?: string }>) => {
    const newLines: OpeningLineInput[] = [];

    for (const item of imported) {
      const matched = glAccounts.find(g => g.gl_number.replace(/\./g, '') === item.gl_number.replace(/\./g, ''));
      if (matched) {
        newLines.push({
          gl_account_id: matched.id,
          gl_number: matched.gl_number,
          gl_name: matched.short_name,
          dc_type: item.dc_type,
          amount: item.amount,
          description: item.description || 'Importált nyitó egyenleg'
        });
      }
    }

    if (newLines.length > 0) {
      setLines(newLines);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); else onOpenChange(val); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40 bg-muted/20 shrink-0 space-y-4">
            {/* Top row: Icon + Title + Badge + Subtitle */}
            <div className="flex items-start justify-between gap-4 pr-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary shrink-0 shadow-2xs">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                      Nyitó tételek rögzítése & Varázsló
                    </DialogTitle>
                    <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30 px-2 py-0.5 uppercase tracking-wide">
                      Sztv. 491
                    </Badge>
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Évnyitás és mérlegfolytonosság felvezetése a 491. Nyitómérleg technikai számlával szemben
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Stepper Progress Navigation Cards */}
            <div className="grid grid-cols-4 gap-2.5">
              {WIZARD_STEPS.map((s, idx) => {
                const isCurrent = step === s.id;
                const isPassed = step > s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!isPassed}
                    onClick={() => isPassed && setStep(s.id)}
                    className={cn(
                      "relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-200 select-none text-left border",
                      isCurrent && "bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary/20 font-semibold",
                      isPassed && "bg-card hover:bg-muted/80 text-foreground border-emerald-500/30 dark:border-emerald-500/20 hover:border-emerald-500/50 cursor-pointer shadow-2xs",
                      !isCurrent && !isPassed && "bg-muted/40 border-border/40 text-muted-foreground opacity-60 cursor-not-allowed"
                    )}
                  >
                    {/* Step indicator circle */}
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all",
                      isCurrent && "bg-primary-foreground text-primary shadow-2xs",
                      isPassed && "bg-emerald-500 text-white shadow-2xs",
                      !isCurrent && !isPassed && "bg-muted-foreground/15 text-muted-foreground"
                    )}>
                      {isPassed ? <Check className="w-3 h-3 stroke-[3]" /> : s.id}
                    </span>

                    <div className="flex flex-col min-w-0 leading-tight">
                      <span className={cn(
                        "text-[9px] uppercase tracking-wider font-semibold",
                        isCurrent ? "text-primary-foreground/80" : isPassed ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/80"
                      )}>
                        {idx + 1}. lépés
                      </span>
                      <span className={cn(
                        "text-xs truncate mt-0.5",
                        isCurrent ? "text-primary-foreground font-semibold" : "text-foreground font-medium"
                      )}>
                        {s.title}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </DialogHeader>

          {/* Body content based on step */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* STEP 1: Basic Params */}
            {step === 1 && (
              <div className="space-y-5 max-w-xl mx-auto py-4">
                <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2 text-primary">
                    <ShieldCheck className="w-4 h-4" /> Nyitás metodikája & Sztv. mérlegfolytonosság
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A nyitás az előző üzleti év záró mérlegének felvezetése az új év 1. napjára. Az eszközök nyitása <span className="font-semibold text-foreground">T Eszköz – K 491</span>, a források nyitása <span className="font-semibold text-foreground">T 491 – K Forrás</span>. A nyitás után a 491-nek **0 Ft** egyenleggel kell rendelkeznie.
                  </p>
                </div>

                {/* Warning if opening entry already exists for this year */}
                {existingOpeningEntry && (
                  <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 p-4 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>Már létezik nyitó bizonylat erre az üzleti évre ({accountingYear})</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      A(z) <span className="font-semibold text-foreground">{accountingYear}</span>. évhez már rögzítésre került a(z){' '}
                      <span className="font-mono font-semibold text-foreground bg-background/60 px-1.5 py-0.5 rounded border border-border/40">
                        {existingOpeningEntry.document_id || 'NYITÓ'}
                      </span>{' '}
                      számú nyitó bizonylat (Könyvelési dátum: {existingOpeningEntry.posting_date}, Státusz:{' '}
                      <span className="font-semibold text-foreground">{existingOpeningEntry.status}</span>).
                    </p>
                    <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 leading-normal">
                      Az Sztv. mérlegfolytonossági szabályai szerint az évnyitás normál esetben évente egyszer történik. Újabb nyitás rögzítése megduplázhatja a nyitó egyenlegeket a 491-es számlával szemben!
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Könyvelési Adóév</Label>
                    <Select value={accountingYear.toString()} onValueChange={(v) => setAccountingYear(parseInt(v))}>
                      <SelectTrigger className="h-9 focus:border-primary focus-visible:border-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }).map((_, i) => {
                          const y = currentYear - 2 + i;
                          return <SelectItem key={y} value={y.toString()}>{y}. üzleti év</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nyitás Dátuma (Sztv. kötelező)</Label>
                    <DatePicker
                      value={postingDate}
                      onChange={(date) => date && setPostingDate(date)}
                      disabled={transitionType === 'EVFORDULOS'}
                      placeholder="Nyitás dátuma"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Bizonylatszám</Label>
                    <Input
                      value={documentId}
                      onChange={e => setDocumentId(e.target.value)}
                      className="h-9 font-mono text-xs focus:border-primary focus-visible:border-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Átállás típusa</Label>
                    <Select value={transitionType} onValueChange={(v: any) => setTransitionType(v)}>
                      <SelectTrigger className="h-9 focus:border-primary focus-visible:border-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EVFORDULOS">Évfordulós átállás (Január 1.)</SelectItem>
                        <SelectItem value="EVKOZBENI">Év közbeni átállás (Tört időszak)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Forrásdokumentum megnevezése / Hivatkozás</Label>
                  <Input
                    value={justification}
                    onChange={e => setJustification(e.target.value)}
                    className="h-9 text-xs focus:border-primary focus-visible:border-primary"
                  />
                </div>
              </div>
            )}

            {/* STEP 2: GL Opening lines & Live 491 check */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Top Action Bar */}
                <div className="flex items-center justify-between bg-muted/40 p-3 rounded-xl border">
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setCsvImportOpen(true)} className="gap-1.5 h-8 text-xs">
                      <UploadCloud className="w-4 h-4" /> CSV / JSON Import
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleAddLine} className="gap-1.5 h-8 text-xs">
                      <Plus className="w-4 h-4" /> Sor hozzáadása
                    </Button>
                  </div>

                  {/* Live 491 KPI indicator */}
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <div>Össz T: <span className="font-bold tabular-nums text-blue-600">{formatCurrency(totalDebit)}</span></div>
                    <div>Össz K: <span className="font-bold tabular-nums text-emerald-600">{formatCurrency(totalCredit)}</span></div>
                    <div className={cn(
                      "px-3 py-1 rounded-full font-bold border flex items-center gap-1.5 tabular-nums transition-colors",
                      is491Balanced 
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-600 border-rose-500/30"
                    )}>
                      {is491Balanced ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                      <span>491 Nyitómérleg Eltérés: {formatCurrency(totalImbalance)}</span>
                    </div>
                  </div>
                </div>

                {/* Lines Table Container with internal scroll & sticky header */}
                <div className="border border-border/60 rounded-xl overflow-hidden bg-card shadow-2xs">
                  <div className="max-h-[clamp(200px,calc(85vh-420px),420px)] overflow-y-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 bg-muted/95 backdrop-blur-xs z-10 shadow-xs border-b border-border/60">
                        <tr className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                          <th className="py-2.5 px-3 text-left w-10">#</th>
                          <th className="py-2.5 px-3 text-left w-[320px]">Főkönyvi Számla (1–4)</th>
                          <th className="py-2.5 px-3 text-center w-24">Jel</th>
                          <th className="py-2.5 px-3 text-right w-40">Nyitó Összeg (Ft)</th>
                          <th className="py-2.5 px-3 text-left">Megjegyzés</th>
                          <th className="py-2.5 px-3 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {lines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2 px-3 text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="py-2 px-3">
                              <Popover open={openDropdownIndex === idx} onOpenChange={(o) => setOpenDropdownIndex(o ? idx : null)}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    id={`gl-account-trigger-${idx}`}
                                    className="w-full justify-between h-8 text-xs font-mono focus:border-primary focus-visible:border-primary"
                                  >
                                    {line.gl_account_id ? (
                                      <span className="truncate">
                                        <strong className="text-primary mr-1">{line.gl_number}</strong> {line.gl_name}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">Válassz mérlegszámlát...</span>
                                    )}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[360px] p-0" align="start">
                                  <Command shouldFilter={false}>
                                    <CommandInput
                                      placeholder="Számlaszám v. név keresése..."
                                      value={searchQuery}
                                      onValueChange={setSearchQuery}
                                    />
                                    <CommandList className="max-h-60 overflow-y-auto">
                                      <CommandEmpty>Nincs találat.</CommandEmpty>
                                      <CommandGroup>
                                        {glAccounts
                                          .filter(account => !searchQuery || `${account.gl_number} ${account.short_name}`.toLowerCase().includes(searchQuery.toLowerCase()))
                                          .map((account) => (
                                            <CommandItem
                                              key={account.id}
                                              value={`${account.gl_number} ${account.short_name}`}
                                              onSelect={() => {
                                                handleUpdateLine(idx, 'gl_account_id', account.id);
                                                setOpenDropdownIndex(null);
                                                setSearchQuery('');
                                                document.getElementById(`dc-type-trigger-${idx}`)?.focus();
                                              }}
                                              className="text-xs font-mono cursor-pointer hover:bg-accent"
                                            >
                                              <strong className="text-primary mr-2">{account.gl_number}</strong>
                                              <span className="truncate">{account.short_name}</span>
                                            </CommandItem>
                                          ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <Select value={line.dc_type} onValueChange={(v: any) => handleUpdateLine(idx, 'dc_type', v)}>
                                <SelectTrigger id={`dc-type-trigger-${idx}`} className="h-8 text-xs font-bold text-center focus:border-primary focus-visible:border-primary">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="T" className="text-blue-600 font-bold">T (Eszköz)</SelectItem>
                                  <SelectItem value="K" className="text-emerald-600 font-bold">K (Forrás)</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-2 px-3">
                              <NumberInput
                                id={`amount-input-${idx}`}
                                value={line.amount || ''}
                                onChange={e => handleUpdateLine(idx, 'amount', Math.abs(parseFloat(e.target.value) || 0))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    document.getElementById(`desc-input-${idx}`)?.focus();
                                  }
                                }}
                                className="h-8 text-right font-semibold text-xs min-w-[120px] w-full focus:border-primary focus-visible:border-primary"
                                min="0.01"
                                step="1"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                id={`desc-input-${idx}`}
                                value={line.description}
                                onChange={e => handleUpdateLine(idx, 'description', e.target.value)}
                                onKeyDown={(e) => {
                                  if ((e.key === 'Tab' && !e.shiftKey) || e.key === 'Enter') {
                                    if (idx === lines.length - 1) {
                                      e.preventDefault();
                                      handleAddLine();
                                    } else if (e.key === 'Enter') {
                                      e.preventDefault();
                                      document.getElementById(`gl-account-trigger-${idx + 1}`)?.focus();
                                    }
                                  }
                                }}
                                className="h-8 text-xs focus:border-primary focus-visible:border-primary"
                                placeholder="Megjegyzés..."
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <CustomTooltip content="Sor törlése">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  tabIndex={-1}
                                  className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                                  onClick={() => handleRemoveLine(idx)}
                                  aria-label="Sor törlése"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </CustomTooltip>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {!is491Balanced && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      <strong>Sztv. validációs hiba:</strong> A nyitó bizonylat nem könyvelhető le, mert a Tartozik és Követel oldal nem egyezik meg (491-es technikai számla egyenlege eltér a nullától).
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Subledger Reconciliation Control */}
            {step === 3 && (
              <div className="space-y-4 max-w-xl mx-auto py-2">
                <div className="bg-muted/40 p-4 rounded-xl border space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Scale className="w-4 h-4 text-primary" /> Analitika vs. Főkönyv egyeztetési kontroll
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    A szakmai specifikáció alapján a tételes vevő/szállító nyitó számláknak fillérre egyezniük kell a 311 és 454 főkönyvi nyitó egyenleggel.
                  </p>
                </div>

                {subledgerData && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-xl bg-card space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vevő (311) Folyószámla</div>
                      <div className="flex justify-between text-xs"><span>Tételes Nyitó Számlák:</span> <span className="font-bold">{formatCurrency(subledgerData.open_ar_subledger)}</span></div>
                      <div className="flex justify-between text-xs"><span>Főkönyvi 311 Nyitó:</span> <span className="font-bold">{formatCurrency(subledgerData.gl_311_opening)}</span></div>
                      <div className={cn("text-xs font-bold pt-2 border-t flex items-center justify-between", subledgerData.ar_diff === 0 ? "text-emerald-600" : "text-rose-500")}>
                        <span>Eltérés:</span>
                        <span>{formatCurrency(subledgerData.ar_diff)}</span>
                      </div>
                    </div>

                    <div className="p-4 border rounded-xl bg-card space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Szállító (454) Folyószámla</div>
                      <div className="flex justify-between text-xs"><span>Tételes Nyitó Számlák:</span> <span className="font-bold">{formatCurrency(subledgerData.open_ap_subledger)}</span></div>
                      <div className="flex justify-between text-xs"><span>Főkönyvi 454 Nyitó:</span> <span className="font-bold">{formatCurrency(subledgerData.gl_454_opening)}</span></div>
                      <div className={cn("text-xs font-bold pt-2 border-t flex items-center justify-between", subledgerData.ap_diff === 0 ? "text-emerald-600" : "text-rose-500")}>
                        <span>Eltérés:</span>
                        <span>{formatCurrency(subledgerData.ap_diff)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: Post-Opening Reconciliations */}
            {step === 4 && (
              <div className="space-y-6 max-w-xl mx-auto py-4 text-center">
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-2xl space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <h3 className="text-lg font-bold text-emerald-600">A Nyitó bizonylat sikeresen lekönyvelve!</h3>
                  <p className="text-xs text-muted-foreground">
                    Az 1–4. számlaosztályok megnyitásra kerültek a 491-es technikai számlával szemben.
                  </p>
                </div>

                <div className="bg-card border rounded-xl p-5 text-left space-y-3 shadow-sm">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-primary">
                    <Sparkles className="w-4 h-4" /> Nyitás utáni rendező tételek indítása (Sztv.)
                  </h4>
                  <ul className="text-xs space-y-1.5 text-muted-foreground list-disc pl-4">
                    <li><strong className="text-foreground">419 Adózott eredmény átvezetése</strong> a 413. Eredménytartalék számlára</li>
                    <li><strong className="text-foreground">ÁFA számlák összevezetése</strong> (466 Előzetes és 467 Fizetendő kivezetése a 468-ra)</li>
                  </ul>

                  <Button
                    onClick={() => postOpeningReconciliateMutation.mutate()}
                    disabled={postOpeningReconciliateMutation.isPending}
                    className="w-full mt-2 gap-2"
                  >
                    {postOpeningReconciliateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Rendező Tételek Generálása a VE Naplóba</span>
                  </Button>
                </div>

                {reconcileResult && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-600 rounded-xl text-xs text-left flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{reconcileResult.message}</span>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer Navigation */}
          <DialogFooter className="px-6 py-3 border-t border-border/40 bg-muted/30 shrink-0 flex items-center justify-between gap-2">
            <div>
              {step > 1 && step < 4 && (
                <Button variant="outline" size="sm" onClick={() => setStep((step - 1) as any)} className="gap-1 text-xs">
                  <ArrowLeft className="w-3.5 h-3.5" /> Vissza
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>Bezárás</Button>

              {step === 1 && (
                <Button size="sm" onClick={() => setStep(2)} className="gap-1 text-xs">
                  Tovább a Főkönyvhöz <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}

              {step === 2 && (
                <Button size="sm" onClick={() => setStep(3)} disabled={!is491Balanced} className="gap-1 text-xs">
                  Tovább az Analitikához <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}

              {step === 3 && (
                <Button size="sm" onClick={() => saveAndPostMutation.mutate()} disabled={saveAndPostMutation.isPending} className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                  {saveAndPostMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Nyitó Bizonylat Lekönyvelése</span>
                </Button>
              )}

              {step === 4 && (
                <Button size="sm" onClick={handleClose} className="gap-1 text-xs">
                  Kész / Befejezés
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OpeningCSVImportModal
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        onImportGlBalances={handleImportGlBalances}
      />
    </>
  );
}
