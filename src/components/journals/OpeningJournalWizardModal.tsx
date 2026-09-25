import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
import { Plus, Trash2, Loader2, AlertCircle, CheckCircle2, BookOpen, ShieldCheck, ArrowRight, ArrowLeft, UploadCloud, RefreshCw, Sparkles, Scale, Check, AlertTriangle, Coins, ChevronsUpDown } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { formatCurrencyLocale } from '@/lib/locale/formatters';
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

export interface OpeningLineInput {
  id?: string;
  gl_account_id: string;
  gl_number?: string;
  gl_name?: string;
  dc_type: 'T' | 'K';
  amount: number;
  is_foreign?: boolean;
  currency?: string;
  foreign_amount?: number | null;
  exchange_rate?: number | null;
  description: string;
}

export const isForeignCurrencyAccount = (
  glNumber: string = '',
  shortName: string = '',
  isMulticurrency?: boolean | null,
  accountCurrency?: string | null
): boolean => {
  // 1. Explicit database configuration check
  if (isMulticurrency === true) return true;
  if (accountCurrency && accountCurrency.toUpperCase() !== 'HUF') return true;
  if (isMulticurrency === false && (!accountCurrency || accountCurrency.toUpperCase() === 'HUF')) {
    return false;
  }

  // 2. Fallback heuristic
  const clean = glNumber.replace(/\./g, '').trim();
  return (
    clean.startsWith('386') || // Devizabetétszámla
    clean.startsWith('382') || // Valutapénztár
    clean.startsWith('316') || // Külföldi vevők
    clean.startsWith('317') || // Egyéb devizás követelések
    clean.startsWith('4542') || // Külföldi szállítók
    clean.startsWith('455') || // Egyéb devizás kötelezettségek
    /deviza|valuta|eur|usd|külföldi/i.test(shortName)
  );
};

export interface MnbRateResult {
  rate: number;
  date: string;
  isExact: boolean;
}

export const findMnbRateForDate = (
  rates: Array<{ currency: string; rate_date: string; rate: number | string }>,
  currency: string,
  targetDate: string
): MnbRateResult | null => {
  if (!currency || currency === 'HUF') {
    return { rate: 1, date: targetDate, isExact: true };
  }
  const upperCurr = currency.toUpperCase().trim();

  // Rates are sorted desc by rate_date (most recent first)
  const match = rates.find(r => r.currency === upperCurr && r.rate_date <= targetDate);
  if (match?.rate) {
    return {
      rate: Number(match.rate),
      date: match.rate_date,
      isExact: match.rate_date === targetDate,
    };
  }

  // Fallback to latest available rate for this currency if target date has no prior rates in table
  const fallback = rates.find(r => r.currency === upperCurr);
  if (fallback?.rate) {
    return {
      rate: Number(fallback.rate),
      date: fallback.rate_date,
      isExact: false,
    };
  }

  return null;
};

export default function OpeningJournalWizardModal({
  open,
  onOpenChange,
  headerId
}: OpeningJournalWizardModalProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activePresetId } = useActivePreset(selectedCompany?.id);

  const wizardSteps = [
    { id: 1 as const, title: t('dialogs.opening_wizard.steps.step1', { defaultValue: 'Alapadatok' }) },
    { id: 2 as const, title: t('dialogs.opening_wizard.steps.step2', { defaultValue: 'Főkönyv & 491' }) },
    { id: 3 as const, title: t('dialogs.opening_wizard.steps.step3', { defaultValue: 'Analitika' }) },
    { id: 4 as const, title: t('dialogs.opening_wizard.steps.step4', { defaultValue: 'Rendező' }) },
  ];

  // Wizard Step (1: Params, 2: GL Opening + 491 Check, 3: Sub-ledger Match, 4: Reconcile)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const currentYear = new Date().getFullYear();
  const [accountingYear, setAccountingYear] = useState<number>(currentYear);
  const [postingDate, setPostingDate] = useState<string>(`${currentYear}-01-01`);
  const [documentId, setDocumentId] = useState<string>('NYITO-' + currentYear);
  const [justification, setJustification] = useState<string>(t('dialogs.opening_wizard.step1.default_justification', { defaultValue: 'Előző évi záró mérleg és nyitó főkönyvi kivonat alapján' }));
  const [transitionType, setTransitionType] = useState<'EVFORDULOS' | 'EVKOZBENI'>('EVFORDULOS');
  const [currency, setCurrency] = useState<string>('HUF');
  
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
    setJustification(t('dialogs.opening_wizard.step1.default_justification', { defaultValue: 'Előző évi záró mérleg és nyitó főkönyvi kivonat alapján' }));
    setTransitionType('EVFORDULOS');
    setCurrency('HUF');
    setLines([
      { gl_account_id: '', dc_type: 'T', amount: 0, description: 'Eszköz nyitó tétel' },
      { gl_account_id: '', dc_type: 'K', amount: 0, description: 'Forrás nyitó tétel' },
    ]);
    setOpenDropdownIndex(null);
    setSearchQuery('');
    setCsvImportOpen(false);
    setReconcileResult(null);
  }, [currentYear, t]);

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

  // Fetch NY Journal ID & currency
  const { data: nyJournal } = useQuery({
    queryKey: ['acc-ny-journal', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return null;
      const { data, error } = await supabase
        .from('acc_journals')
        .select('id, code, name, currency')
        .eq('company_id', selectedCompany.id)
        .eq('code', 'NY')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCompany?.id,
  });

  useEffect(() => {
    if (nyJournal?.currency) {
      setCurrency(nyJournal.currency);
    }
  }, [nyJournal?.currency]);

  // Fetch GL Accounts (Filtered to 0, 1-4, 9 Balance sheet accounts for Opening, paginated)
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['gl-accounts-balance-sheet', activePresetId],
    queryFn: async () => {
      if (!activePresetId) return [];
      const data = await fetchAllGlAccountsByPreset(activePresetId);
      
      // Filter to Balance sheet accounts (0, 1-4, 9) to support Hungarian (1-4) and Croatian/international charts (0, 1-4, 9)
      return (data || []).filter(g => {
        const firstDigit = g.gl_number.replace(/\./g, '').substring(0, 1);
        return ['0', '1', '2', '3', '4', '9'].includes(firstDigit);
      });
    },
    enabled: !!activePresetId,
  });

  // Fetch MNB daily exchange rates for one-click FX lookup
  const { data: mnbExchangeRates = [] } = useQuery({
    queryKey: ['daily-exchange-rates-opening'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_exchange_rates')
        .select('currency, rate_date, rate')
        .eq('source', 'MNB')
        .order('rate_date', { ascending: false });
      if (error) return [];
      return data || [];
    },
    staleTime: 1000 * 60 * 30, // 30 minutes cache
    enabled: open,
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
      return ['0', '1', '2', '3'].includes(firstDigit) && l.dc_type === 'T';
    })
    .reduce((sum, l) => sum + (l.amount || 0), 0);

  const liabilityCreditSum = lines
    .filter(l => {
      const g = glAccounts.find(acc => acc.id === l.gl_account_id);
      if (!g) return l.dc_type === 'K';
      const firstDigit = g.gl_number.replace(/\./g, '').substring(0, 1);
      return ['2', '4', '9'].includes(firstDigit) && l.dc_type === 'K';
    })
    .reduce((sum, l) => sum + (l.amount || 0), 0);

  const totalDebit = lines.filter(l => l.dc_type === 'T').reduce((sum, l) => sum + (l.amount || 0), 0);
  const totalCredit = lines.filter(l => l.dc_type === 'K').reduce((sum, l) => sum + (l.amount || 0), 0);
  
  // Imbalance of double-entry (rounded to 2 decimals)
  const totalImbalance = Math.round((totalDebit - totalCredit) * 100) / 100;

  const hasValidLines = lines.some(l => Boolean(l.gl_account_id) && Number(l.amount) > 0);

  // 491 Account balance calculation:
  // Eszköz nyitás: T Eszköz - K 491 (adds Credit to 491)
  // Forrás nyitás: T 491 - K Forrás (adds Debit to 491)
  const is491Balanced = hasValidLines && Math.abs(totalImbalance) < 0.01;

  // Save / Post Opening Mutation
  const saveAndPostMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id || !nyJournal?.id) {
        throw new Error('Cég vagy Nyitó napló nem található.');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Bejelentkezés szükséges.');

      const validLines = lines.filter(line => line.gl_account_id && Number(line.amount) > 0);
      if (validLines.length === 0) {
        throw new Error(t('dialogs.opening_wizard.validation.at_least_one_valid_line', { defaultValue: 'Legalább egy érvényes, kitöltött nyitó tételsor szükséges a könyveléshez.' }));
      }

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
          currency: currency || nyJournal?.currency || 'HUF',
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

        const hasForeign = Boolean(line.is_foreign && line.foreign_amount != null && Number(line.foreign_amount) > 0);
        const foreignAmount = hasForeign ? Number(line.foreign_amount) : null;
        let lineDesc = line.description || 'Nyitó tétel';
        if (hasForeign && line.currency) {
          const rateInfo = line.exchange_rate ? ` @ ${line.exchange_rate} HUF` : '';
          lineDesc = `${lineDesc} (${foreignAmount} ${line.currency}${rateInfo})`;
        }

        // Original line
        insertLines.push({
          header_id: header.id,
          sequence_number: seq++,
          gl_account_id: line.gl_account_id,
          dc_type: line.dc_type,
          amount: line.amount,
          foreign_amount: foreignAmount,
          description: lineDesc
        });

        // Technical 491 counter line
        if (technicalAccount491) {
          insertLines.push({
            header_id: header.id,
            sequence_number: seq++,
            gl_account_id: technicalAccount491.id,
            dc_type: line.dc_type === 'T' ? 'K' : 'T',
            amount: line.amount,
            foreign_amount: null,
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
      toast({ 
        title: t('dialogs.opening_wizard.toasts.success_title', { defaultValue: 'Sikeres nyitás!' }), 
        description: t('dialogs.opening_wizard.toasts.success_desc', { defaultValue: 'A Nyitó tételek lekönyvelése sikeresen megtörtént!' }) 
      });
      setStep(4);
    },
    onError: (err: any) => {
      toast({ 
        title: t('dialogs.opening_wizard.toasts.error_title', { defaultValue: 'Könyvelési hiba' }), 
        description: err.message, 
        variant: 'destructive' 
      });
    }
  });

  // Post-Opening Reconciliations Mutation
  const postOpeningReconciliateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('dialogs.opening_wizard.toasts.login_required', { defaultValue: 'Bejelentkezés szükséges.' }));

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
      toast({ 
        title: t('dialogs.opening_wizard.toasts.reconcile_success', { defaultValue: 'Rendező tételek lefuttatva' }), 
        description: data?.message 
      });
    },
    onError: (err: any) => {
      toast({ 
        title: t('dialogs.opening_wizard.toasts.reconcile_error', { defaultValue: 'Hiba a rendező tételeknél' }), 
        description: err.message, 
        variant: 'destructive' 
      });
    }
  });

  // Line Handlers
  const handleAddLine = () => {
    setLines(prev => {
      const next = [
        ...prev,
        { gl_account_id: '', dc_type: 'T' as const, amount: 0, description: 'Nyitó tétel' }
      ];
      const nextIdx = next.length - 1;
      setTimeout(() => {
        const el = document.getElementById(`gl-account-trigger-${nextIdx}`);
        if (el) {
          el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
          el.focus();
        }
      }, 50);
      return next;
    });
  };

  const handleRemoveLine = (index: number) => {
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleForeign = (index: number) => {
    setLines(prev => {
      const next = [...prev];
      const cur = next[index];
      const willBeForeign = !cur.is_foreign;
      const targetCurr = cur.currency || 'EUR';
      let autoRate = cur.exchange_rate;
      if (willBeForeign && (autoRate == null || autoRate === 0)) {
        const found = findMnbRateForDate(mnbExchangeRates, targetCurr, postingDate);
        if (found) autoRate = found.rate;
      }
      const calculatedAmount = (willBeForeign && cur.foreign_amount != null && autoRate != null && Number(cur.foreign_amount) > 0 && Number(autoRate) > 0)
        ? Math.round(Number(cur.foreign_amount) * Number(autoRate))
        : cur.amount;

      next[index] = {
        ...cur,
        is_foreign: willBeForeign,
        currency: willBeForeign ? targetCurr : undefined,
        exchange_rate: willBeForeign ? autoRate : undefined,
        amount: calculatedAmount,
      };
      return next;
    });
  };

  const handleUpdateLine = (index: number, field: keyof OpeningLineInput, value: any) => {
    setLines(prev => {
      const next = [...prev];
      const current = { ...next[index], [field]: value };

      if (field === 'gl_account_id') {
        const selected = glAccounts.find(g => g.id === value);
        if (selected) {
          current.gl_number = selected.gl_number;
          current.gl_name = selected.short_name;
          const isFx = isForeignCurrencyAccount(selected.gl_number, selected.short_name, selected.is_multicurrency, selected.currency);
          if (isFx && !current.is_foreign) {
            current.is_foreign = true;
            if (!current.currency) current.currency = selected.currency || 'EUR';
            if (current.exchange_rate == null || current.exchange_rate === 0) {
              const found = findMnbRateForDate(mnbExchangeRates, current.currency, postingDate);
              if (found) current.exchange_rate = found.rate;
            }
          }
        }
      }

      if (field === 'currency') {
        const newCurr = value || 'EUR';
        const found = findMnbRateForDate(mnbExchangeRates, newCurr, postingDate);
        if (found) {
          current.exchange_rate = found.rate;
          if (current.foreign_amount != null && Number(current.foreign_amount) > 0) {
            current.amount = Math.round(Number(current.foreign_amount) * found.rate);
          }
        }
      }

      if (field === 'foreign_amount' || field === 'exchange_rate') {
        const fAmt = field === 'foreign_amount' ? value : current.foreign_amount;
        const rate = field === 'exchange_rate' ? value : current.exchange_rate;
        if (fAmt != null && rate != null && Number(fAmt) > 0 && Number(rate) > 0) {
          current.amount = Math.round(Number(fAmt) * Number(rate));
        }
      }

      next[index] = current;
      return next;
    });
  };

  const handleFetchMnbRate = (index: number) => {
    const line = lines[index];
    const curr = line.currency || 'EUR';
    const result = findMnbRateForDate(mnbExchangeRates, curr, postingDate);

    if (result) {
      handleUpdateLine(index, 'exchange_rate', result.rate);
      toast({
        title: 'MNB árfolyam betöltve',
        description: `${curr}: ${result.rate} Ft (${result.date}${result.isExact ? '' : ' - legközelebbi korábbi MNB nap'})`,
      });
    } else {
      toast({
        title: 'Árfolyam nem található',
        description: `Nincs elérhető MNB árfolyam a(z) ${curr} devizához a megadott időszakra (${postingDate}).`,
        variant: 'destructive',
      });
    }
  };

  const handleFetchAllMnbRates = () => {
    let updatedCount = 0;
    setLines(prev =>
      prev.map(line => {
        if (!line.is_foreign) return line;
        const curr = line.currency || 'EUR';
        const result = findMnbRateForDate(mnbExchangeRates, curr, postingDate);
        if (result) {
          updatedCount++;
          const rate = result.rate;
          const amount = line.foreign_amount && Number(line.foreign_amount) > 0 
            ? Math.round(Number(line.foreign_amount) * rate) 
            : line.amount;
          return { ...line, exchange_rate: rate, amount };
        }
        return line;
      })
    );
    if (updatedCount > 0) {
      toast({
        title: 'MNB árfolyamok frissítve',
        description: `${updatedCount} devizás tételhez betöltöttük a hivatalos MNB árfolyamot.`,
      });
    } else {
      toast({
        title: 'Nem található devizás tétel vagy árfolyam',
        description: 'Nincs elérhető árfolyam az aktuális devizanemekhez.',
        variant: 'destructive',
      });
    }
  };

  const handleImportGlBalances = (
    imported: Array<{ gl_number: string; dc_type: 'T' | 'K'; amount: number; description?: string }>,
    metadata?: { currency?: string; suggestedDate?: string; suggestedYear?: number }
  ) => {
    const newLines: OpeningLineInput[] = [];
    let unmatchedCount = 0;

    for (const item of imported) {
      const cleanItemKonto = item.gl_number.replace(/\./g, '').trim();
      const matched = glAccounts.find(g => g.gl_number.replace(/\./g, '').trim() === cleanItemKonto);
      if (matched) {
        const isFx = isForeignCurrencyAccount(matched.gl_number, matched.short_name, matched.is_multicurrency, matched.currency);
        newLines.push({
          gl_account_id: matched.id,
          gl_number: matched.gl_number,
          gl_name: matched.short_name,
          dc_type: item.dc_type,
          amount: item.amount,
          is_foreign: isFx,
          currency: isFx ? (matched.currency || 'EUR') : undefined,
          description: item.description || 'Importált nyitó egyenleg'
        });
      } else {
        unmatchedCount++;
      }
    }

    if (newLines.length > 0) {
      setLines(newLines);
      if (unmatchedCount > 0) {
        toast({
          title: t('dialogs.opening_wizard.toasts.import_partial_title', { defaultValue: 'Részleges import' }),
          description: t('dialogs.opening_wizard.toasts.import_partial_desc', { 
            defaultValue: `${newLines.length} számla sikeresen betöltve. ${unmatchedCount} számla nem található a számlatükörben.`
          }),
        });
      } else {
        toast({
          title: t('dialogs.opening_wizard.toasts.import_success_title', { defaultValue: 'Sikeres import' }),
          description: t('dialogs.opening_wizard.toasts.import_success_desc', { 
            defaultValue: `${newLines.length} nyitó tétel sikeresen betöltve.`
          })
        });
      }
    } else {
      toast({
        title: t('dialogs.opening_wizard.toasts.import_empty_title', { defaultValue: 'Sikertelen betöltés' }),
        description: t('dialogs.opening_wizard.toasts.import_empty_desc', { defaultValue: 'Nem sikerült számlákat párosítani az aktív számlatükörrel.' }),
        variant: 'destructive'
      });
    }

    if (metadata?.currency) {
      setCurrency(metadata.currency);
    }
    if (metadata?.suggestedDate) {
      setPostingDate(metadata.suggestedDate);
    }
    if (metadata?.suggestedYear) {
      setAccountingYear(metadata.suggestedYear);
      setDocumentId(`NYITO-${metadata.suggestedYear}`);
    }

    if (newLines.length > 0) {
      setStep(2);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(val) => { if (!val) handleClose(); else onOpenChange(val); }}>
        <DialogContent className="w-[96vw] max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
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
                      {t('dialogs.opening_wizard.title', { defaultValue: 'Nyitó tételek rögzítése & Varázsló' })}
                    </DialogTitle>
                    <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/30 px-2 py-0.5 uppercase tracking-wide">
                      {t('dialogs.opening_wizard.badge', { defaultValue: 'Sztv. 491' })}
                    </Badge>
                  </div>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {t('dialogs.opening_wizard.description', { defaultValue: 'Évnyitás és mérlegfolytonosság felvezetése a 491. Nyitómérleg technikai számlával szemben' })}
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Stepper Progress Navigation Cards */}
            <div className="grid grid-cols-4 gap-2.5">
              {wizardSteps.map((s, idx) => {
                const isCurrent = step === s.id;
                const isPassed = step > s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={!isPassed}
                    onClick={() => isPassed && setStep(s.id)}
                    className={cn(
                      "relative flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors duration-150 select-none text-left border",
                      isCurrent && "bg-primary text-primary-foreground border-primary shadow-sm ring-1 ring-primary/20 font-semibold",
                      isPassed && "bg-card hover:bg-muted/80 text-foreground border-emerald-500/30 dark:border-emerald-500/20 hover:border-emerald-500/50 cursor-pointer shadow-2xs",
                      !isCurrent && !isPassed && "bg-muted/40 border-border/40 text-muted-foreground opacity-60 cursor-not-allowed"
                    )}
                  >
                    {/* Step indicator circle */}
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors duration-150",
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
                        {t('dialogs.opening_wizard.steps.step_n', { index: idx + 1, defaultValue: `${idx + 1}. lépés` })}
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
                    <ShieldCheck className="w-4 h-4" /> {t('dialogs.opening_wizard.step1.methodology_title', { defaultValue: 'Nyitás metodikája & Sztv. mérlegfolytonosság' })}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t('dialogs.opening_wizard.step1.methodology_desc', { defaultValue: 'A nyitás az előző üzleti év záró mérlegének felvezetése az új év 1. napjára. Az eszközök nyitása T Eszköz – K 491, a források nyitása T 491 – K Forrás. A nyitás után a 491-nek 0 Ft egyenleggel kell rendelkeznie.' })}
                  </p>
                </div>

                {/* Warning if opening entry already exists for this year */}
                {existingOpeningEntry && (
                  <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 p-4 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>{t('dialogs.opening_wizard.step1.existing_warning_title', { year: accountingYear, defaultValue: `Már létezik nyitó bizonylat erre az üzleti évre (${accountingYear})` })}</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t('dialogs.opening_wizard.step1.existing_warning_desc', {
                        year: accountingYear,
                        docId: existingOpeningEntry.document_id || 'NYITÓ',
                        date: existingOpeningEntry.posting_date,
                        status: existingOpeningEntry.status,
                        defaultValue: `A(z) ${accountingYear}. évhez már rögzítésre került a(z) ${existingOpeningEntry.document_id || 'NYITÓ'} számú nyitó bizonylat (Könyvelési dátum: ${existingOpeningEntry.posting_date}, Státusz: ${existingOpeningEntry.status}).`
                      })}
                    </p>
                    <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 leading-normal">
                      {t('dialogs.opening_wizard.step1.rule_warning', { defaultValue: 'Az Sztv. mérlegfolytonossági szabályai szerint az évnyitás normál esetben évente egyszer történik. Újabb nyitás rögzítése megduplázhatja a nyitó egyenlegeket a 491-es számlával szemben!' })}
                    </p>
                  </div>
                )}

                {/* Quick File Import Banner */}
                <div className="p-4 rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/15 text-primary shrink-0">
                      <UploadCloud className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                        {t('dialogs.opening_wizard.step1.quick_import_title', { defaultValue: 'Gyors nyitás fájlból (.xlsx, .xls, .csv, .json)' })}
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30 py-0 px-1.5 font-normal">
                          .xlsx, .xls, .csv
                        </Badge>
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        {t('dialogs.opening_wizard.step1.quick_import_desc', { defaultValue: 'Tölts fel exportált főkönyvi nyitóállományt, és a rendszer automatikusan betölti a számlákat és egyenlegeket!' })}
                      </p>
                    </div>
                  </div>
                  <Button 
                    type="button"
                    size="sm" 
                    onClick={() => setCsvImportOpen(true)}
                    className="gap-1.5 h-8 text-xs shrink-0 font-medium shadow-xs"
                  >
                    <UploadCloud className="w-4 h-4" />
                    {t('dialogs.opening_wizard.step1.upload_btn', { defaultValue: 'Fájl feltöltése (.xlsx, .csv)' })}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t('dialogs.opening_wizard.step1.tax_year', { defaultValue: 'Könyvelési Adóév' })}</Label>
                    <Select value={accountingYear.toString()} onValueChange={(v) => setAccountingYear(parseInt(v))}>
                      <SelectTrigger className="h-9 focus:border-primary focus-visible:border-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 5 }).map((_, i) => {
                          const y = currentYear - 2 + i;
                          return <SelectItem key={y} value={y.toString()}>{t('dialogs.opening_wizard.step1.business_year', { year: y, defaultValue: `${y}. üzleti év` })}</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t('dialogs.opening_wizard.step1.transition_type', { defaultValue: 'Átállás típusa' })}</Label>
                    <Select value={transitionType} onValueChange={(v: any) => setTransitionType(v)}>
                      <SelectTrigger className="h-9 focus:border-primary focus-visible:border-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EVFORDULOS">{t('dialogs.opening_wizard.step1.transition_yearly', { defaultValue: 'Évfordulós átállás (Január 1.)' })}</SelectItem>
                        <SelectItem value="EVKOZBENI">{t('dialogs.opening_wizard.step1.transition_interim', { defaultValue: 'Év közbeni átállás (Tört időszak)' })}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t('dialogs.opening_wizard.step1.document_number', { defaultValue: 'Bizonylatszám' })}</Label>
                    <Input
                      value={documentId}
                      onChange={e => setDocumentId(e.target.value)}
                      className="h-9 font-mono text-xs focus:border-primary focus-visible:border-primary"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t('dialogs.opening_wizard.step1.currency', { defaultValue: 'Pénznem' })}</Label>
                    <Select value={currency} onValueChange={(v) => setCurrency(v)}>
                      <SelectTrigger className="h-9 focus:border-primary focus-visible:border-primary">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="HUF">HUF (Ft)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{t('dialogs.opening_wizard.step1.opening_date', { defaultValue: 'Nyitás Dátuma (Sztv. kötelező)' })}</Label>
                    <DatePicker
                      value={postingDate}
                      onChange={(date) => date && setPostingDate(date)}
                      disabled={transitionType === 'EVFORDULOS'}
                      placeholder={t('dialogs.opening_wizard.step1.opening_date_placeholder', { defaultValue: 'Nyitás dátuma' })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{t('dialogs.opening_wizard.step1.source_doc', { defaultValue: 'Forrásdokumentum megnevezése / Hivatkozás' })}</Label>
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
                {/* Top Action Bar & Live 491 Balance Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border border-border/60">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setCsvImportOpen(true)} className="gap-1.5 h-8 text-xs font-medium">
                      <UploadCloud className="w-3.5 h-3.5 text-muted-foreground" /> {t('dialogs.opening_wizard.step2.csv_import', { defaultValue: 'Importálás (.xlsx, .csv)' })}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleAddLine} className="gap-1.5 h-8 text-xs font-medium">
                      <Plus className="w-3.5 h-3.5 text-muted-foreground" /> {t('dialogs.opening_wizard.step2.add_row', { defaultValue: 'Sor hozzáadása' })}
                    </Button>
                    {lines.some(l => l.is_foreign) && (
                      <Button
                        size="sm"
                        variant="outline"
                        id="fetch-all-mnb-rates-btn"
                        onClick={handleFetchAllMnbRates}
                        className="gap-1.5 h-8 text-xs border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/5 hover:bg-amber-500/15"
                        title={`Minden devizás tételhez lekéri a hivatalos MNB záróárfolyamot a nyitás dátumára (${postingDate})`}
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        MNB árfolyamok kitöltése
                      </Button>
                    )}
                    {lines.some(l => l.is_foreign && l.gl_account_id) && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 text-[11px] font-semibold py-1">
                        <Coins className="w-3 h-3" />
                        {lines.filter(l => l.is_foreign && l.gl_account_id).length} devizás tétel
                      </Badge>
                    )}
                  </div>

                  {/* Live 491 KPI indicator */}
                  <div className="flex flex-wrap items-center gap-2.5 text-xs font-medium shrink-0 ml-auto">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-background/80 border border-border/50 shadow-2xs">
                      <span className="text-muted-foreground">{t('dialogs.opening_wizard.step2.total_debit', { defaultValue: 'Össz T:' })}</span>
                      <span className="font-bold tabular-nums font-mono text-blue-600 dark:text-blue-400">{formatCurrencyLocale(totalDebit, currency)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-background/80 border border-border/50 shadow-2xs">
                      <span className="text-muted-foreground">{t('dialogs.opening_wizard.step2.total_credit', { defaultValue: 'Össz K:' })}</span>
                      <span className="font-bold tabular-nums font-mono text-emerald-600 dark:text-emerald-400">{formatCurrencyLocale(totalCredit, currency)}</span>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-lg font-bold border flex items-center gap-1.5 tabular-nums transition-colors duration-150 shadow-2xs",
                      !hasValidLines
                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                        : is491Balanced 
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                    )}>
                      {!hasValidLines ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : is491Balanced ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
                      <span className="whitespace-nowrap">
                        {t('dialogs.opening_wizard.step2.imbalance_label', { defaultValue: '491 Nyitómérleg Eltérés:' })} {formatCurrencyLocale(totalImbalance, currency)}
                        {!hasValidLines && ` (${t('dialogs.opening_wizard.step2.no_lines_warning', { defaultValue: 'Nincsenek nyitó összegek' })})`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lines Table Container with internal scroll & sticky header */}
                <div className="border border-border/60 rounded-xl overflow-hidden bg-card shadow-2xs">
                  <div className="max-h-[clamp(240px,calc(88vh-360px),560px)] overflow-y-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 bg-muted/95 backdrop-blur-xs z-10 shadow-xs border-b border-border/60">
                        <tr className="text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                          <th className="py-2.5 px-3 text-center w-10">#</th>
                          <th className="py-2.5 px-3 text-left w-[260px] lg:w-[320px]">{t('dialogs.opening_wizard.step2.table_headers.gl_account', { defaultValue: 'Főkönyvi Számla (0–4, 9)' })}</th>
                          <th className="py-2.5 px-3 text-center w-32">{t('dialogs.opening_wizard.step2.table_headers.sign', { defaultValue: 'Jel' })}</th>
                          <th className="py-2.5 px-3 text-right w-[280px] lg:w-[340px]">{t('dialogs.opening_wizard.step2.table_headers.amount', { defaultValue: `Nyitó Összeg (${currency === 'EUR' ? '€' : currency})` })}</th>
                          <th className="py-2.5 px-3 text-left min-w-[180px]">{t('dialogs.opening_wizard.step2.table_headers.comment', { defaultValue: 'Megjegyzés' })}</th>
                          <th className="py-2.5 px-3 text-center w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {lines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-muted/20 transition-colors">
                            <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                            <td className="py-2.5 px-3 align-top">
                              <Popover 
                                open={openDropdownIndex === idx} 
                                onOpenChange={(open) => {
                                  setOpenDropdownIndex(open ? idx : null);
                                  if (open) {
                                    setSearchQuery('');
                                  }
                                }}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
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
                                      <span className="text-muted-foreground">{t('dialogs.opening_wizard.step2.choose_account', { defaultValue: 'Válassz mérlegszámlát...' })}</span>
                                    )}
                                    <ChevronsUpDown className="w-3.5 h-3.5 opacity-50 shrink-0 ml-1" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[380px] p-0 z-50" align="start">
                                  <Command shouldFilter={false}>
                                    <CommandInput
                                      placeholder={t('dialogs.opening_wizard.step2.search_account_placeholder', { defaultValue: 'Számlaszám v. név keresése...' })}
                                      value={searchQuery}
                                      onValueChange={setSearchQuery}
                                    />
                                    <CommandList className="max-h-60 overflow-y-auto">
                                      <CommandEmpty>{t('dialogs.opening_wizard.step2.no_account_found', { defaultValue: 'Nincs találat.' })}</CommandEmpty>
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
                                                setTimeout(() => {
                                                  document.getElementById(`dc-type-trigger-${idx}`)?.focus();
                                                }, 50);
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

                              {/* Deviza kapcsoló gomb */}
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <button
                                  type="button"
                                  id={`foreign-toggle-${idx}`}
                                  onClick={() => handleToggleForeign(idx)}
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors duration-150 cursor-pointer shadow-2xs",
                                    line.is_foreign 
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/25" 
                                      : "text-muted-foreground/80 hover:text-foreground border-dashed border-border/80 hover:border-foreground/30 hover:bg-muted/40"
                                  )}
                                  title={line.is_foreign ? "Devizás tétel bekapcsolva (kattints a kikapcsoláshoz)" : "Devizás tétel bekapcsolása ezen a számlán"}
                                >
                                  <Coins className="w-3 h-3 text-amber-500" />
                                  <span>{line.is_foreign ? `Deviza: ${line.currency || 'EUR'}` : '+ Deviza'}</span>
                                </button>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center align-top">
                              <Select value={line.dc_type} onValueChange={(v: any) => handleUpdateLine(idx, 'dc_type', v)}>
                                <SelectTrigger id={`dc-type-trigger-${idx}`} className="h-8 text-xs font-bold justify-between px-2.5 focus:border-primary focus-visible:border-primary">
                                  <span className={line.dc_type === 'T' ? "text-blue-600 dark:text-blue-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                                    {line.dc_type === 'T' 
                                      ? t('dialogs.opening_wizard.step2.debit_label', { defaultValue: 'T (Eszköz)' }) 
                                      : t('dialogs.opening_wizard.step2.credit_label', { defaultValue: 'K (Forrás)' })}
                                  </span>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="T" className="text-blue-600 dark:text-blue-400 font-bold">{t('dialogs.opening_wizard.step2.debit_label', { defaultValue: 'T (Eszköz)' })}</SelectItem>
                                  <SelectItem value="K" className="text-emerald-600 dark:text-emerald-400 font-bold">{t('dialogs.opening_wizard.step2.credit_label', { defaultValue: 'K (Forrás)' })}</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-2.5 px-3 align-top">
                              {line.is_foreign ? (
                                <div className="p-2 rounded-lg bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/25 space-y-1.5 shadow-2xs">
                                  {/* Deviza összeg és Devizanem választó */}
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-muted-foreground font-medium w-14 shrink-0">Deviza:</span>
                                    <div className="relative flex-1">
                                      <NumberInput
                                        id={`foreign-amount-input-${idx}`}
                                        showStepper={false}
                                        value={line.foreign_amount ?? ''}
                                        placeholder="0.00"
                                        onChange={e => handleUpdateLine(idx, 'foreign_amount', e.target.value === '' ? null : Math.abs(parseFloat(e.target.value) || 0))}
                                        className="h-7 text-right font-mono text-xs pr-2 bg-background focus:border-primary"
                                        min="0"
                                        step="any"
                                      />
                                    </div>
                                    <Select 
                                      value={line.currency || 'EUR'} 
                                      onValueChange={(curr) => handleUpdateLine(idx, 'currency', curr)}
                                    >
                                      <SelectTrigger className="h-7 w-[72px] text-xs px-2 font-bold bg-background shrink-0">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="EUR">EUR</SelectItem>
                                        <SelectItem value="USD">USD</SelectItem>
                                        <SelectItem value="GBP">GBP</SelectItem>
                                        <SelectItem value="CHF">CHF</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  {/* Árfolyam és MNB lekérő gomb */}
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-muted-foreground font-medium w-14 shrink-0">Árfolyam:</span>
                                    <div className="relative flex-1">
                                      <NumberInput
                                        id={`exchange-rate-input-${idx}`}
                                        showStepper={false}
                                        value={line.exchange_rate ?? ''}
                                        placeholder="0.00"
                                        onChange={e => handleUpdateLine(idx, 'exchange_rate', e.target.value === '' ? null : Math.abs(parseFloat(e.target.value) || 0))}
                                        className="h-7 text-right font-mono text-xs pr-14 bg-background focus:border-primary"
                                        min="0"
                                        step="any"
                                      />
                                      <span className="absolute right-1.5 top-1.5 text-[9px] text-muted-foreground/80 font-mono font-medium pointer-events-none">
                                        Ft/{line.currency || 'EUR'}
                                      </span>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      id={`fetch-mnb-btn-${idx}`}
                                      onClick={() => handleFetchMnbRate(idx)}
                                      className="h-7 px-2 text-[10px] font-semibold gap-1 shrink-0 bg-background text-amber-700 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/10"
                                      title={`Hivatalos MNB záróárfolyam betöltése (${postingDate})`}
                                    >
                                      <Sparkles className="w-3 h-3 text-amber-500" />
                                      MNB
                                    </Button>
                                  </div>

                                  {/* Könyvelt HUF érték (automatikus átszámítás) */}
                                  <div className="flex items-center gap-1.5 pt-1 border-t border-amber-500/20">
                                    <span className="text-[10px] font-semibold text-primary w-14 shrink-0">HUF:</span>
                                    <div className="relative flex-1">
                                      <NumberInput
                                        id={`amount-input-${idx}`}
                                        showStepper={false}
                                        value={line.amount || ''}
                                        placeholder="0"
                                        onChange={e => handleUpdateLine(idx, 'amount', Math.abs(parseFloat(e.target.value) || 0))}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            document.getElementById(`desc-input-${idx}`)?.focus();
                                          }
                                        }}
                                        className="h-7 text-right font-bold font-mono text-xs pr-7 bg-primary/10 border-primary/40 focus:border-primary text-foreground"
                                        min="0"
                                        step="any"
                                      />
                                      <span className="absolute right-2 top-1.5 text-[10px] font-bold text-primary pointer-events-none">
                                        Ft
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="relative">
                                  <NumberInput
                                    id={`amount-input-${idx}`}
                                    showStepper={false}
                                    value={line.amount || ''}
                                    placeholder="0"
                                    onChange={e => handleUpdateLine(idx, 'amount', Math.abs(parseFloat(e.target.value) || 0))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        document.getElementById(`desc-input-${idx}`)?.focus();
                                      }
                                    }}
                                    className="h-8 text-right font-bold font-mono text-xs pr-7 w-full bg-background focus:border-primary focus-visible:border-primary"
                                    min="0"
                                    step="any"
                                  />
                                  <span className="absolute right-2 top-2 text-[10px] font-bold text-muted-foreground pointer-events-none">
                                    Ft
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 align-top">
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
                                      const nextIdx = idx + 1;
                                      setTimeout(() => {
                                        document.getElementById(`gl-account-trigger-${nextIdx}`)?.focus();
                                      }, 50);
                                    }
                                  }
                                }}
                                className="h-8 text-xs w-full focus:border-primary focus-visible:border-primary"
                                placeholder={t('dialogs.opening_wizard.step2.comment_placeholder', { defaultValue: 'Megjegyzés...' })}
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center align-top">
                              <CustomTooltip content={t('dialogs.opening_wizard.step2.delete_row_tooltip', { defaultValue: 'Sor törlése' })}>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  tabIndex={-1}
                                  className="h-8 w-8 text-muted-foreground/60 hover:text-rose-500 hover:bg-rose-500/10 transition-colors duration-150"
                                  onClick={() => handleRemoveLine(idx)}
                                  aria-label={t('dialogs.opening_wizard.step2.delete_row_tooltip', { defaultValue: 'Sor törlése' })}
                                >
                                  <Trash2 className="w-4 h-4" />
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
                      {t('dialogs.opening_wizard.step2.validation_error', { defaultValue: 'Sztv. validációs hiba: A nyitó bizonylat nem könyvelhető le, mert a Tartozik és Követel oldal nem egyezik meg (491-es technikai számla egyenlege eltér a nullától).' })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Subledger Reconciliation Control */}
            {step === 3 && (
              <div className="space-y-4 max-w-2xl mx-auto py-2">
                <div className="bg-muted/40 p-4 rounded-xl border space-y-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <Scale className="w-4 h-4 text-primary" /> {t('dialogs.opening_wizard.step3.reconciliation_title', { defaultValue: 'Analitika vs. Főkönyv egyeztetési kontroll' })}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {t('dialogs.opening_wizard.step3.reconciliation_desc', { defaultValue: 'A szakmai specifikáció alapján a tételes vevő/szállító nyitó számláknak fillérre egyezniük kell a 311 és 454 főkönyvi nyitó egyenleggel.' })}
                  </p>
                </div>

                {subledgerData && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-xl bg-card space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('dialogs.opening_wizard.step3.customer_subledger', { defaultValue: 'Vevő (311) Folyószámla' })}</div>
                      <div className="flex justify-between text-xs"><span>{t('dialogs.opening_wizard.step3.itemized_opening', { defaultValue: 'Tételes Nyitó Számlák:' })}</span> <span className="font-bold">{formatCurrencyLocale(subledgerData.open_ar_subledger, currency)}</span></div>
                      <div className="flex justify-between text-xs"><span>{t('dialogs.opening_wizard.step3.gl_opening_311', { defaultValue: 'Főkönyvi 311 Nyitó:' })}</span> <span className="font-bold">{formatCurrencyLocale(subledgerData.gl_311_opening, currency)}</span></div>
                      <div className={cn("text-xs font-bold pt-2 border-t flex items-center justify-between", subledgerData.ar_diff === 0 ? "text-emerald-600" : "text-rose-500")}>
                        <span>{t('dialogs.opening_wizard.step3.difference', { defaultValue: 'Eltérés:' })}</span>
                        <span>{formatCurrencyLocale(subledgerData.ar_diff, currency)}</span>
                      </div>
                    </div>

                    <div className="p-4 border rounded-xl bg-card space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('dialogs.opening_wizard.step3.supplier_subledger', { defaultValue: 'Szállító (454) Folyószámla' })}</div>
                      <div className="flex justify-between text-xs"><span>{t('dialogs.opening_wizard.step3.itemized_opening', { defaultValue: 'Tételes Nyitó Számlák:' })}</span> <span className="font-bold">{formatCurrencyLocale(subledgerData.open_ap_subledger, currency)}</span></div>
                      <div className="flex justify-between text-xs"><span>{t('dialogs.opening_wizard.step3.gl_opening_454', { defaultValue: 'Főkönyvi 454 Nyitó:' })}</span> <span className="font-bold">{formatCurrencyLocale(subledgerData.gl_454_opening, currency)}</span></div>
                      <div className={cn("text-xs font-bold pt-2 border-t flex items-center justify-between", subledgerData.ap_diff === 0 ? "text-emerald-600" : "text-rose-500")}>
                        <span>{t('dialogs.opening_wizard.step3.difference', { defaultValue: 'Eltérés:' })}</span>
                        <span>{formatCurrencyLocale(subledgerData.ap_diff, currency)}</span>
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
                  <h3 className="text-lg font-bold text-emerald-600">{t('dialogs.opening_wizard.step4.success_title', { defaultValue: 'A Nyitó bizonylat sikeresen lekönyvelve!' })}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t('dialogs.opening_wizard.step4.success_desc', { defaultValue: 'Az 1–4. számlaosztályok megnyitásra kerültek a 491-es technikai számlával szemben.' })}
                  </p>
                </div>

                <div className="bg-card border rounded-xl p-5 text-left space-y-3 shadow-sm">
                  <h4 className="font-semibold text-sm flex items-center gap-2 text-primary">
                    <Sparkles className="w-4 h-4" /> {t('dialogs.opening_wizard.step4.reconciliations_title', { defaultValue: 'Nyitás utáni rendező tételek indítása (Sztv.)' })}
                  </h4>
                  <ul className="text-xs space-y-1.5 text-muted-foreground list-disc pl-4">
                    <li>{t('dialogs.opening_wizard.step4.reconciliations_item1', { defaultValue: '419 Adózott eredmény átvezetése a 413. Eredménytartalék számlára' })}</li>
                    <li>{t('dialogs.opening_wizard.step4.reconciliations_item2', { defaultValue: 'ÁFA számlák összevezetése (466 Előzetes és 467 Fizetendő kivezetése a 468-ra)' })}</li>
                  </ul>

                  <Button
                    onClick={() => postOpeningReconciliateMutation.mutate()}
                    disabled={postOpeningReconciliateMutation.isPending}
                    className="w-full mt-2 gap-2"
                  >
                    {postOpeningReconciliateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>{t('dialogs.opening_wizard.step4.generate_reconciliations', { defaultValue: 'Rendező Tételek Generálása a VE Naplóba' })}</span>
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
                  <ArrowLeft className="w-3.5 h-3.5" /> {t('dialogs.opening_wizard.navigation.back', { defaultValue: 'Vissza' })}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>{t('dialogs.opening_wizard.navigation.close', { defaultValue: 'Bezárás' })}</Button>

              {step === 1 && (
                <Button size="sm" onClick={() => setStep(2)} className="gap-1 text-xs">
                  {t('dialogs.opening_wizard.step1.next_gl', { defaultValue: 'Tovább a Főkönyvhöz' })} <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}

              {step === 2 && (
                <Button size="sm" onClick={() => setStep(3)} disabled={!is491Balanced} className="gap-1 text-xs">
                  {t('dialogs.opening_wizard.step2.next_subledger', { defaultValue: 'Tovább az Analitikához' })} <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              )}

              {step === 3 && (
                <Button size="sm" onClick={() => saveAndPostMutation.mutate()} disabled={saveAndPostMutation.isPending || !hasValidLines} className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                  {saveAndPostMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{t('dialogs.opening_wizard.step3.post_opening_action', { defaultValue: 'Nyitó Bizonylat Lekönyvelése' })}</span>
                </Button>
              )}

              {step === 4 && (
                <Button size="sm" onClick={handleClose} className="gap-1 text-xs">
                  {t('dialogs.opening_wizard.step4.finish_action', { defaultValue: 'Kész / Befejezés' })}
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
