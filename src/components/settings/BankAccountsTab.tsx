import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Landmark, Plus, Trash2, Shield, CreditCard, Globe, CheckCircle2, Sparkles, ArrowRight, BookOpen, Settings2, AlertTriangle } from 'lucide-react';
import { reportError } from '@/lib/errorReporter';
import { useTranslation } from 'react-i18next';
import { useAggreg8 } from '@/hooks/useAggreg8';
import { useActivePreset } from '@/hooks/useActivePreset';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  formatAccountOnType,
  validateAccountNumber,
  detectAccountFormat,
  detectBankFromAccountNumber,
  formatIban,
  formatGiro,
} from '@/lib/ibanUtils';

interface BankAccount {
  id: string;
  company_id: string;
  bank_name: string;
  account_number: string;
  currency: string;
  journal_id?: string | null;
  gl_account_id?: string | null;
  created_at: string;
}

interface Props {
  companyId: string;
}

export interface CurrencyMatchResult {
  isMatch: boolean;
  warning?: string;
}

export function checkGlAccountCurrencyMatch(
  glNumber: string | undefined | null,
  currency: string | undefined | null,
  glAccountCurrency?: string | null,
  isMulticurrency?: boolean | null
): CurrencyMatchResult {
  if (!glNumber) return { isMatch: true };
  const bCurr = (currency || 'HUF').toUpperCase().trim();
  const clean = glNumber.replace(/\./g, '').trim();

  // 1. Explicit database configuration check
  if (glAccountCurrency) {
    const gaCurr = glAccountCurrency.toUpperCase().trim();
    if (gaCurr !== bCurr) {
      return {
        isMatch: false,
        warning: `A bankszámla devizaneme (${bCurr}) eltér a főkönyvi szám dedikált devizanemétől (${gaCurr}).`,
      };
    }
    return { isMatch: true };
  }

  if (isMulticurrency === false && bCurr !== 'HUF') {
    return {
      isMatch: false,
      warning: `A főkönyvi szám (${glNumber}) kizárólag forintos tételek könyvelésére van beállítva. ${bCurr} számlához devizás főkönyvi szám szükséges.`,
    };
  }

  // 2. Fallback heuristic
  const isHuf = bCurr === 'HUF';
  if (isHuf) {
    if (clean.startsWith('386') || clean.startsWith('382')) {
      return {
        isMatch: false,
        warning: `A bankszámla HUF devizanemű, de a kiválasztott főkönyvi szám (${glNumber}) devizaszámla / valuta számla. HUF bankszámlához a 384-es elszámolási számla ajánlott.`,
      };
    }
    return { isMatch: true };
  } else {
    if (clean.startsWith('384') || clean.startsWith('381')) {
      return {
        isMatch: false,
        warning: `A bankszámla ${bCurr} devizanemű, de a kiválasztott főkönyvi szám (${glNumber}) forintos elszámolási számla. ${bCurr} bankszámlához a 386-os devizaszámla ajánlott.`,
      };
    }
    return { isMatch: true };
  }
}

export function checkJournalCurrencyMatch(
  journalCurrency: string | undefined | null,
  bankCurrency: string | undefined | null
): CurrencyMatchResult {
  if (!journalCurrency) return { isMatch: true };
  const jCurr = journalCurrency.toUpperCase().trim();
  const bCurr = (bankCurrency || 'HUF').toUpperCase().trim();

  if (jCurr !== bCurr) {
    return {
      isMatch: false,
      warning: `A kiválasztott napló devizaneme (${jCurr}) eltér a bankszámla devizanemétől (${bCurr}).`,
    };
  }
  return { isMatch: true };
}

const BANK_GRADIENTS: Record<string, string> = {
  'OTP Bank': 'from-emerald-600 to-teal-800 text-white',
  'Erste Bank': 'from-red-600 to-orange-700 text-white',
  'K&H Bank': 'from-blue-600 to-sky-700 text-white',
  'Raiffeisen Bank': 'from-yellow-500 to-amber-700 text-zinc-900',
  'MBH Bank': 'from-zinc-800 to-slate-900 text-white border border-slate-700',
  'Revolut Bank': 'from-neutral-900 via-neutral-800 to-zinc-900 text-white border border-neutral-700',
  'Wise (TransferWise)': 'from-emerald-700 to-teal-900 text-white',
  'N26 Bank': 'from-teal-800 to-cyan-950 text-white',
  'Gránit Bank': 'from-amber-600 to-orange-800 text-white',
  'CIB Bank': 'from-amber-500 to-yellow-600 text-zinc-950',
  'UniCredit Bank': 'from-red-700 to-rose-900 text-white',
  'MagNet Bank': 'from-green-700 to-emerald-900 text-white',
  'default': 'from-indigo-600 to-violet-800 text-white',
};

const STANDARD_BANKS = [
  'OTP Bank',
  'Erste Bank',
  'K&H Bank',
  'MBH Bank',
  'Raiffeisen Bank',
  'CIB Bank',
  'UniCredit Bank',
  'Gránit Bank',
  'MagNet Bank',
  'Revolut Bank',
  'Wise (TransferWise)',
  'N26 Bank',
];

export function BankAccountsTab({ companyId }: Props) {
  const { t } = useTranslation(['settings', 'common']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { consents = [] } = useAggreg8(companyId);
  const { activePresetId } = useActivePreset(companyId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [bankName, setBankName] = useState('OTP Bank');
  const [customBankName, setCustomBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [currency, setCurrency] = useState('HUF');
  const [selectedJournalId, setSelectedJournalId] = useState<string>('none');
  const [selectedGlAccountId, setSelectedGlAccountId] = useState<string>('none');
  const [saving, setSaving] = useState(false);

  // Edit modal states
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [editJournalId, setEditJournalId] = useState<string>('none');
  const [editGlAccountId, setEditGlAccountId] = useState<string>('none');
  const [editSaving, setEditSaving] = useState(false);

  const { data: accounts = [], isLoading } = useQuery<BankAccount[]>({
    queryKey: ['company-bank-accounts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_bank_accounts')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as BankAccount[];
    }
  });

  // Fetch active BANK journals for this company
  const { data: bankJournals = [] } = useQuery({
    queryKey: ['acc-bank-journals', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('acc_journals')
        .select('id, code, name, currency, connected_gl_account')
        .eq('company_id', companyId)
        .eq('type', 'BANK')
        .eq('is_active', true)
        .order('code');
      if (error) return [];
      return data || [];
    }
  });

  // Fetch bank GL accounts (38% Class 3 Financial Assets)
  const { data: bankGlAccounts = [] } = useQuery({
    queryKey: ['bank-gl-accounts', activePresetId, companyId],
    queryFn: async () => {
      let query = supabase
        .from('gl_accounts')
        .select('id, gl_number, short_name, currency, is_multicurrency');
      if (activePresetId) {
        query = query.or(`preset_id.eq.${activePresetId},company_id.eq.${companyId}`);
      } else {
        query = query.eq('company_id', companyId);
      }
      const { data, error } = await query
        .like('gl_number', '38%')
        .order('gl_number');
      if (error) return [];
      return data || [];
    }
  });

  // Sorted bank GL accounts for Add form (prioritizing currency matches)
  const sortedBankGlAccounts = useMemo(() => {
    return [...bankGlAccounts].sort((a, b) => {
      const aMatch = checkGlAccountCurrencyMatch(a.gl_number, currency, a.currency, a.is_multicurrency).isMatch;
      const bMatch = checkGlAccountCurrencyMatch(b.gl_number, currency, b.currency, b.is_multicurrency).isMatch;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return a.gl_number.localeCompare(b.gl_number);
    });
  }, [bankGlAccounts, currency]);

  // Sorted bank journals for Add form (prioritizing currency matches)
  const sortedBankJournals = useMemo(() => {
    return [...bankJournals].sort((a, b) => {
      const aMatch = checkJournalCurrencyMatch(a.currency, currency).isMatch;
      const bMatch = checkJournalCurrencyMatch(b.currency, currency).isMatch;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return a.code.localeCompare(b.code);
    });
  }, [bankJournals, currency]);

  // Active mismatch warnings for Add form
  const selectedAddGl = bankGlAccounts.find(g => g.id === selectedGlAccountId);
  const selectedAddJournal = bankJournals.find(j => j.id === selectedJournalId);
  const addGlMatch = checkGlAccountCurrencyMatch(selectedAddGl?.gl_number, currency, selectedAddGl?.currency, selectedAddGl?.is_multicurrency);
  const addJournalMatch = checkJournalCurrencyMatch(selectedAddJournal?.currency, currency);

  // Sorted lists and mismatch warnings for Edit dialog
  const editAccCurrency = editingAccount?.currency || 'HUF';
  const sortedEditBankGlAccounts = useMemo(() => {
    return [...bankGlAccounts].sort((a, b) => {
      const aMatch = checkGlAccountCurrencyMatch(a.gl_number, editAccCurrency, a.currency, a.is_multicurrency).isMatch;
      const bMatch = checkGlAccountCurrencyMatch(b.gl_number, editAccCurrency, b.currency, b.is_multicurrency).isMatch;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return a.gl_number.localeCompare(b.gl_number);
    });
  }, [bankGlAccounts, editAccCurrency]);

  const sortedEditBankJournals = useMemo(() => {
    return [...bankJournals].sort((a, b) => {
      const aMatch = checkJournalCurrencyMatch(a.currency, editAccCurrency).isMatch;
      const bMatch = checkJournalCurrencyMatch(b.currency, editAccCurrency).isMatch;
      if (aMatch && !bMatch) return -1;
      if (!aMatch && bMatch) return 1;
      return a.code.localeCompare(b.code);
    });
  }, [bankJournals, editAccCurrency]);

  const selectedEditGl = bankGlAccounts.find(g => g.id === editGlAccountId);
  const selectedEditJournal = bankJournals.find(j => j.id === editJournalId);
  const editGlMatch = checkGlAccountCurrencyMatch(selectedEditGl?.gl_number, editAccCurrency, selectedEditGl?.currency, selectedEditGl?.is_multicurrency);
  const editJournalMatch = checkJournalCurrencyMatch(selectedEditJournal?.currency, editAccCurrency);

  const accountFormat = detectAccountFormat(accountNumber);
  const detectedBankInfo = detectBankFromAccountNumber(accountNumber);

  const handleAccountNumChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAccountOnType(e.target.value);
    setAccountNumber(formatted);

    // Intelligens bankfelismerés gépelés közben
    const bankInfo = detectBankFromAccountNumber(formatted);
    if (bankInfo?.bankName) {
      if (STANDARD_BANKS.includes(bankInfo.bankName)) {
        setBankName(bankInfo.bankName);
        setCustomBankName('');
      } else {
        setBankName('other');
        setCustomBankName(bankInfo.bankName);
      }
    }
  };

  const handleJournalChange = (jId: string) => {
    setSelectedJournalId(jId);
    if (jId && jId !== 'none') {
      const j = bankJournals.find((bj: any) => bj.id === jId);
      if (j?.connected_gl_account) {
        const matchingGl = bankGlAccounts.find((ga: any) => ga.gl_number === j.connected_gl_account);
        if (matchingGl) {
          setSelectedGlAccountId(matchingGl.id);
        }
      }
      if (j?.currency && j.currency.trim()) {
        setCurrency(j.currency.trim());
      }
    }
  };

  const startEditAccount = (acc: BankAccount) => {
    setEditingAccount(acc);
    setEditJournalId(acc.journal_id || 'none');
    setEditGlAccountId(acc.gl_account_id || 'none');
  };

  const handleEditJournalChange = (jId: string) => {
    setEditJournalId(jId);
    if (jId && jId !== 'none') {
      const j = bankJournals.find((bj: any) => bj.id === jId);
      if (j?.connected_gl_account) {
        const matchingGl = bankGlAccounts.find((ga: any) => ga.gl_number === j.connected_gl_account);
        if (matchingGl) {
          setEditGlAccountId(matchingGl.id);
        }
      }
    }
  };

  const handleSaveEdit = async () => {
    if (!editingAccount) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from('company_bank_accounts')
        .update({
          journal_id: editJournalId && editJournalId !== 'none' ? editJournalId : null,
          gl_account_id: editGlAccountId && editGlAccountId !== 'none' ? editGlAccountId : null,
        })
        .eq('id', editingAccount.id);

      if (error) throw error;

      toast({ title: 'Siker', description: 'Bankszámla könyvelési beállításai frissítve.' });
      setEditingAccount(null);
      queryClient.invalidateQueries({ queryKey: ['company-bank-accounts', companyId] });
    } catch (err: any) {
      reportError({
        type: 'db_query',
        component: 'BankAccountsTab',
        action: 'handleSaveEdit',
        message: err?.message || 'Nem sikerült frissíteni a bankszámlát.',
        error: err,
      });
      toast({ title: 'Hiba', description: 'Nem sikerült frissíteni a beállításokat.', variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateAccountNumber(accountNumber);
    if (!validation.valid) {
      toast({
        title: t('bank_accounts.invalid_account_number', 'Érvénytelen számlaszám'),
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }

    const finalBankName = bankName === 'other' ? customBankName.trim() : bankName;
    if (!finalBankName) {
      toast({ title: 'Hiba', description: 'Kérjük, add meg a bank nevét.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_bank_accounts')
        .insert({
          company_id: companyId,
          bank_name: finalBankName,
          account_number: accountNumber.trim(),
          currency: currency,
          journal_id: selectedJournalId && selectedJournalId !== 'none' ? selectedJournalId : null,
          gl_account_id: selectedGlAccountId && selectedGlAccountId !== 'none' ? selectedGlAccountId : null,
        });

      if (error) throw error;

      toast({ title: 'Siker', description: 'Bankszámla sikeresen hozzáadva.' });
      setAccountNumber('');
      setCustomBankName('');
      setSelectedJournalId('none');
      setSelectedGlAccountId('none');
      setShowAddForm(false);
      queryClient.invalidateQueries({ queryKey: ['company-bank-accounts', companyId] });
    } catch (err: any) {
      reportError({
        type: 'db_query',
        component: 'BankAccountsTab',
        action: 'handleAddAccount',
        message: err?.message || 'Nem sikerült hozzáadni a bankszámlát.',
        error: err,
      });
      toast({ title: 'Hiba', description: 'Nem sikerült hozzáadni a bankszámlát.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm(t('bank_accounts.delete_confirm', 'Biztosan törölni szeretnéd ezt a bankszámlát?'))) return;

    try {
      const { error } = await supabase
        .from('company_bank_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Siker', description: 'Bankszámla törölve.' });
      queryClient.invalidateQueries({ queryKey: ['company-bank-accounts', companyId] });
    } catch (err: any) {
      reportError({
        type: 'db_query',
        component: 'BankAccountsTab',
        action: 'handleDeleteAccount',
        message: err?.message || 'Nem sikerült törölni a bankszámlát.',
        error: err,
      });
      toast({ title: 'Hiba', description: 'Nem sikerült törölni a bankszámlát.', variant: 'destructive' });
    }
  };

  const formatAccountDisplay = (accNum: string) => {
    const fmt = detectAccountFormat(accNum);
    if (fmt === 'iban') return formatIban(accNum);
    if (fmt === 'giro') return formatGiro(accNum);
    return accNum;
  };

  return (
    <div className="space-y-6">
      {/* Élő Banki Kapcsolatok (PSD2 Open Banking) Állapotjelző & Integrációk Átirányító Kártya */}
      <Card className="border border-border/80 bg-gradient-to-r from-card via-card to-primary/5 shadow-sm">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0 mt-0.5">
              <Landmark className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base">Élő Banki Kapcsolatok (PSD2 Open Banking)</h3>
                <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                  Aggreg8
                </Badge>
                {consents.length > 0 ? (
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-xs flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {consents.length} csatlakoztatott bank
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs text-muted-foreground">
                    Nincs aktív kapcsolat
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                {consents.length > 0
                  ? `A rendszer automatikusan szinkronizálja az élő banki tranzakciókat (${consents.map(c => c.bank_name || 'Bank').join(', ')}). A banki kapcsolatokat és PSD2 hozzájárulásokat az Integrációk menüpontban kezelheted.`
                  : 'Kapcsold össze vállalkozásod bankszámláit a bankoddal az automatikus, valós idejű tranzakció-szinkronizációhoz és számlapárosításhoz az Integrációk menüpontban.'}
              </p>
            </div>
          </div>

          <Button
            onClick={() => navigate('/integrations?tab=banking')}
            className="shrink-0 gap-2 font-medium"
            variant={consents.length > 0 ? 'outline' : 'default'}
          >
            {consents.length > 0 ? 'Bankkapcsolatok kezelése' : 'Bankcsatlakozás beállítása'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              {t('bank_accounts.title', 'Céges bankszámlák')}
            </CardTitle>
            <CardDescription>
              {t('bank_accounts.subtitle', 'Regisztráld a cég saját bankszámláit a kimenő utalási listák generálásához és a könyvelési összerendeléshez.')}
            </CardDescription>
          </div>
          {!showAddForm && (
            <Button size="sm" onClick={() => setShowAddForm(true)} className="gap-1.5 shadow-md">
              <Plus className="h-4 w-4" />
              {t('bank_accounts.new_account', 'Új bankszámla')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <form onSubmit={handleAddAccount} className="p-5 border border-primary/20 bg-primary/5 rounded-xl mb-6 space-y-4 animate-in fade-in slide-in-from-top-3 duration-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  {t('bank_accounts.add_title', 'Új bankszámla hozzáadása')}
                </h3>
                {accountFormat !== 'unknown' && (
                  <Badge variant="outline" className="text-xs bg-background/80 flex items-center gap-1.5">
                    {accountFormat === 'iban' ? (
                      <>
                        <Globe className="h-3 w-3 text-sky-500" />
                        {t('bank_accounts.format_iban', 'Nemzetközi IBAN')}
                      </>
                    ) : (
                      <>
                        <Landmark className="h-3 w-3 text-emerald-500" />
                        {t('bank_accounts.format_giro', 'Belföldi GIRO')}
                      </>
                    )}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="acc_num">
                      {t('bank_accounts.account_number', 'Bankszámlaszám (magyar GIRO vagy nemzetközi IBAN) *')}
                    </Label>
                    {detectedBankInfo && (
                      <span className="text-xs text-primary font-medium flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        {detectedBankInfo.bankName}
                      </span>
                    )}
                  </div>
                  <Input
                    id="acc_num"
                    value={accountNumber}
                    onChange={handleAccountNumChange}
                    placeholder="11773016-00000000-00000000 vagy HU42 1177 3016..."
                    maxLength={42}
                    required
                    className="font-mono bg-background text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Támogatott: 16 vagy 24 jegyű magyar GIRO számla, magyar IBAN (HU...) vagy nemzetközi IBAN (pl. Revolut, Wise, N26).
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>{t('bank_accounts.bank_name', 'Bank neve')}</Label>
                  <Select value={bankName} onValueChange={setBankName}>
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder={t('bank_accounts.select_bank', 'Válassz bankot')} />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARD_BANKS.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                      <SelectItem value="other">Egyéb bank / Egyedi név</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {bankName === 'other' && (
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label htmlFor="custom_bank">{t('bank_accounts.custom_bank', 'Egyedi bank neve *')}</Label>
                    <Input
                      id="custom_bank"
                      value={customBankName}
                      onChange={e => setCustomBankName(e.target.value)}
                      placeholder={t('bank_accounts.custom_bank_placeholder', 'Pl. Gránit Bank, Revolut, Wise...')}
                      required
                      className="bg-background"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{t('bank_accounts.currency', 'Pénznem')}</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HUF">HUF (Ft)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="CHF">CHF (Fr)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Könyvelési összerendelés szekció */}
                <div className="col-span-1 md:col-span-3 pt-3 border-t border-border/40 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Könyvelési összerendelés (eaisyBooks)</span>
                    <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground ml-1">Opcionális</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="acc_journal" className="text-xs">Kapcsolódó Bank Napló</Label>
                      <Select value={selectedJournalId} onValueChange={handleJournalChange}>
                        <SelectTrigger id="acc_journal" className="bg-background text-xs">
                          <SelectValue placeholder="— Nincs hozzárendelve —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Nincs hozzárendelve —</SelectItem>
                          {sortedBankJournals.map(j => {
                            const jMatch = checkJournalCurrencyMatch(j.currency, currency);
                            return (
                              <SelectItem key={j.id} value={j.id}>
                                [{j.code}] {j.name} ({j.currency || 'HUF'}) {!jMatch.isMatch ? '⚠️ (Eltérő deviza)' : ''}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Ebbe a naplóba generálódnak automatikusan a banki tételek.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="acc_gl" className="text-xs">Kapcsolódó Főkönyvi Számla</Label>
                      <Select value={selectedGlAccountId} onValueChange={setSelectedGlAccountId}>
                        <SelectTrigger id="acc_gl" className="bg-background text-xs">
                          <SelectValue placeholder="— Nincs hozzárendelve —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Nincs hozzárendelve —</SelectItem>
                          {sortedBankGlAccounts.map(g => {
                            const gMatch = checkGlAccountCurrencyMatch(g.gl_number, currency, g.currency, g.is_multicurrency);
                            return (
                              <SelectItem key={g.id} value={g.id}>
                                {g.gl_number} - {g.short_name} {!gMatch.isMatch ? '⚠️ (Eltérő deviza)' : ''}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Erre az analitikus számlára (pl. 3841, 3842, 3861) könyvelődik az egyenleg.
                      </p>
                    </div>
                  </div>

                  {((selectedGlAccountId !== 'none' && !addGlMatch.isMatch) || (selectedJournalId !== 'none' && !addJournalMatch.isMatch)) && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div className="space-y-1">
                        {selectedJournalId !== 'none' && !addJournalMatch.isMatch && <p>{addJournalMatch.warning}</p>}
                        {selectedGlAccountId !== 'none' && !addGlMatch.isMatch && <p>{addGlMatch.warning}</p>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? 'Mentés...' : t('bank_accounts.save_button', 'Bankszámla mentése')}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                  {t('bank_accounts.cancel', 'Mégse')}
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground animate-pulse">{t('bank_accounts.loading', 'Számlák betöltése...')}</div>
          ) : accounts.length === 0 ? (
            <div className="py-8 text-center border border-dashed rounded-xl border-border/60">
              <Landmark className="h-8 w-8 text-muted-foreground/60 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{t('bank_accounts.no_accounts', 'Nincsenek még bankszámlák hozzáadva ehhez a céghez.')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map(acc => {
                const gradient = BANK_GRADIENTS[acc.bank_name] || BANK_GRADIENTS['default'];
                const fmt = detectAccountFormat(acc.account_number);

                return (
                  <div
                    key={acc.id}
                    className={`relative p-5 rounded-2xl bg-gradient-to-br ${gradient} shadow-md overflow-hidden min-h-[160px] flex flex-col justify-between group transition-all duration-300 hover:scale-[1.02] hover:shadow-lg`}
                  >
                    {/* Background glassmorphic circle */}
                    <div className="absolute right-[-20px] top-[-20px] w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

                    <div className="flex justify-between items-start z-10">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs uppercase tracking-widest opacity-80 font-medium">{acc.bank_name}</p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/30 text-white/90 bg-white/10">
                            {fmt === 'iban' ? 'IBAN' : 'GIRO'}
                          </Badge>
                        </div>
                        <p className="text-lg font-bold mt-1 flex items-center gap-1.5">
                          <Landmark className="h-4 w-4" />
                          {acc.currency} {t('bank_accounts.account_suffix', 'Számla')}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/15 rounded-full shrink-0 z-20"
                          onClick={() => startEditAccount(acc)}
                          title="Könyvelési beállítások"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-white/80 hover:text-red-400 hover:bg-white/15 rounded-full shrink-0 z-20"
                          onClick={() => handleDeleteAccount(acc.id)}
                          title="Törlés"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-2 z-10">
                      <p className="text-xs opacity-75">{t('bank_accounts.account_number_label', 'Számlaszám')}</p>
                      <p className="font-mono text-sm tracking-wider font-semibold select-all bg-black/15 px-2 py-1 rounded mt-0.5 inline-block border border-white/10">
                        {formatAccountDisplay(acc.account_number)}
                      </p>
                    </div>

                    {/* Könyvelési hozzárendelés címke és gyorsgomb */}
                    <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between gap-2 z-10">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <BookOpen className="h-3.5 w-3.5 opacity-80 shrink-0" />
                        {(() => {
                          const j = bankJournals.find(bj => bj.id === acc.journal_id);
                          const g = bankGlAccounts.find(ga => ga.id === acc.gl_account_id);
                          const gMatch = g ? checkGlAccountCurrencyMatch(g.gl_number, acc.currency, g.currency, g.is_multicurrency) : { isMatch: true };
                          const jMatch = j ? checkJournalCurrencyMatch(j.currency, acc.currency) : { isMatch: true };
                          const hasMismatch = !gMatch.isMatch || !jMatch.isMatch;

                          let text = 'Nincs főkönyvhöz rendelve';
                          if (j && g) text = `[${j.code}] ${j.name} • ${g.gl_number}`;
                          else if (j) text = `[${j.code}] ${j.name}`;
                          else if (g) text = `${g.gl_number} - ${g.short_name}`;

                          return (
                            <span className="text-xs font-medium opacity-90 truncate max-w-[220px] flex items-center gap-1">
                              {text}
                              {hasMismatch && (
                                <span
                                  title={gMatch.warning || jMatch.warning}
                                  className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-bold bg-amber-500/30 text-amber-200 border border-amber-400/40 shrink-0 ml-1"
                                >
                                  ⚠️ Eltérő deviza
                                </span>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-white/90 hover:text-white hover:bg-white/15 rounded-md shrink-0"
                        onClick={() => startEditAccount(acc)}
                      >
                        Beállítás
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Könyvelési beállítások szerkesztő modál */}
      <Dialog open={!!editingAccount} onOpenChange={open => !open && setEditingAccount(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Landmark className="h-5 w-5 text-primary" />
              Könyvelési beállítások
            </DialogTitle>
            <DialogDescription>
              Rendeld hozzá a(z) <span className="font-semibold text-foreground">{editingAccount?.bank_name}</span> ({editingAccount?.currency}) számlát a megfelelő könyvelési naplóhoz és főkönyvi számhoz.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-3 bg-muted/40 rounded-xl space-y-1 text-xs">
              <div className="text-muted-foreground">Számlaszám:</div>
              <div className="font-mono font-semibold text-sm select-all">
                {editingAccount && formatAccountDisplay(editingAccount.account_number)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_journal" className="text-xs">Kapcsolódó Bank Napló</Label>
              <Select value={editJournalId} onValueChange={handleEditJournalChange}>
                <SelectTrigger id="edit_journal">
                  <SelectValue placeholder="— Nincs hozzárendelve —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nincs hozzárendelve —</SelectItem>
                  {sortedEditBankJournals.map(j => {
                    const jMatch = checkJournalCurrencyMatch(j.currency, editAccCurrency);
                    return (
                      <SelectItem key={j.id} value={j.id}>
                        [{j.code}] {j.name} ({j.currency || 'HUF'}) {!jMatch.isMatch ? '⚠️ (Eltérő deviza)' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                A banki tranzakciókból ide készülnek majd az automatikus könyvelési tervezetek.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit_gl" className="text-xs">Kapcsolódó Főkönyvi Számla</Label>
              <Select value={editGlAccountId} onValueChange={setEditGlAccountId}>
                <SelectTrigger id="edit_gl">
                  <SelectValue placeholder="— Nincs hozzárendelve —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Nincs hozzárendelve —</SelectItem>
                  {sortedEditBankGlAccounts.map(g => {
                    const gMatch = checkGlAccountCurrencyMatch(g.gl_number, editAccCurrency, g.currency, g.is_multicurrency);
                    return (
                      <SelectItem key={g.id} value={g.id}>
                        {g.gl_number} - {g.short_name} {!gMatch.isMatch ? '⚠️ (Eltérő deviza)' : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Az analitikus számla, amelyre a bank mozgásai könyvelődnek (pl. 3841, 3842, 3861).
              </p>
            </div>

            {((editGlAccountId !== 'none' && !editGlMatch.isMatch) || (editJournalId !== 'none' && !editJournalMatch.isMatch)) && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  {editJournalId !== 'none' && !editJournalMatch.isMatch && <p>{editJournalMatch.warning}</p>}
                  {editGlAccountId !== 'none' && !editGlMatch.isMatch && <p>{editGlMatch.warning}</p>}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditingAccount(null)}>
              Mégse
            </Button>
            <Button onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? 'Mentés...' : 'Beállítások mentése'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-border/60 bg-muted/30 shadow-none">
        <CardContent className="pt-4 flex gap-3 items-start text-xs text-muted-foreground">
          <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground mb-0.5">{t('bank_accounts.safe_storage_title', 'Biztonságos adattárolás')}</p>
            <p>
              {t('bank_accounts.safe_storage_desc', 'A bankszámlaszámokat kizárólag a netbanki átutalási fájl generálására és a beérkező banki kivonatok automatikus párosítására használjuk. Pénzügyi tranzakciót indítani vagy a bankszámládhoz hozzáférni a Visibill nem tud.')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

