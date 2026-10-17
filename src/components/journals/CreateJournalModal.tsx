import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { BookOpen, Loader2, Landmark, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { MNB_CURRENCIES } from '@/lib/journalUtils';

export interface CreatedJournalPayload {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  connected_gl_account: string | null;
  bank_account_number?: string | null;
  company_bank_account_id?: string | null;
  petty_cash_register_id?: string | null;
  sub_type?: string | null;
  default_contra_gl_number?: string | null;
}

export interface CreateJournalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  isEditMode?: boolean;
  editJournalId?: string | null;
  initialCode?: string;
  initialType?: string;
  initialSubType?: string;
  initialName?: string;
  initialCurrency?: string;
  initialGlAccount?: string;
  initialContraGlAccount?: string;
  initialBankAccountNumber?: string;
  initialCompanyBankAccountId?: string;
  initialPettyCashRegisterId?: string;
  initialIsActive?: boolean;
  existingJournals?: Array<{ id: string; code: string; type?: string; name: string }>;
  glAccounts?: Array<{ id: string; gl_number: string; short_name: string; currency?: string | null }>;
  onJournalCreated?: (journal: CreatedJournalPayload) => void;
  onJournalUpdated?: (journal: CreatedJournalPayload) => void;
  onDeleteRequested?: (journalId: string) => void;
}

export const JOURNAL_TYPES = [
  { value: 'BANK', label: 'Banki napló (BANK)' },
  { value: 'PETTY_CASH', label: 'Házipénztár napló (PETTY_CASH)' },
  { value: 'CUSTOMER', label: 'Vevő napló (CUSTOMER - VF / VD)' },
  { value: 'SUPPLIER', label: 'Szállító napló (SUPPLIER - SZF / SZD)' },
  { value: 'MIXED', label: 'Vegyes napló (MIXED - VE)' },
  { value: 'SYSTEM', label: 'Rendszer feladási napló (SYSTEM - TE / ARF / ELH / BER)' },
  { value: 'OPENING', label: 'Nyitó napló (OPENING - NY)' },
  { value: 'CLOSING', label: 'Záró napló (CLOSING - Z)' },
];

export function suggestNextJournalCode(type: string, existingJournals: Array<{ code: string }>): string {
  const codes = new Set(existingJournals.map(j => j.code.toUpperCase().trim()));

  if (type === 'BANK') {
    let max = 0;
    for (const code of codes) {
      const match = code.match(/^B(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return `B${max + 1}`;
  }

  if (type === 'PETTY_CASH') {
    let max = 0;
    for (const code of codes) {
      const match = code.match(/^P(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return `P${max + 1}`;
  }

  if (type === 'CUSTOMER') {
    if (!codes.has('VF')) return 'VF';
    if (!codes.has('VD')) return 'VD';
    if (!codes.has('V')) return 'V';
    let idx = 2;
    while (codes.has(`V${idx}`)) idx++;
    return `V${idx}`;
  }

  if (type === 'SUPPLIER') {
    if (!codes.has('SZF')) return 'SZF';
    if (!codes.has('SZD')) return 'SZD';
    if (!codes.has('SZ')) return 'SZ';
    let idx = 2;
    while (codes.has(`SZ${idx}`)) idx++;
    return `SZ${idx}`;
  }

  if (type === 'SYSTEM') {
    if (!codes.has('TE')) return 'TE';
    if (!codes.has('ARF')) return 'ARF';
    if (!codes.has('ELH')) return 'ELH';
    if (!codes.has('BER')) return 'BER';
    let idx = 1;
    while (codes.has(`SYS${idx}`)) idx++;
    return `SYS${idx}`;
  }

  if (type === 'MIXED') {
    if (!codes.has('VE')) return 'VE';
    let idx = 1;
    while (codes.has(`V${idx}`)) idx++;
    return `V${idx}`;
  }

  if (type === 'OPENING') {
    if (!codes.has('NY')) return 'NY';
    return 'NY2';
  }

  if (type === 'CLOSING') {
    if (!codes.has('Z')) return 'Z';
    return 'ZAR';
  }

  return 'UJ';
}

export const CreateJournalModal: React.FC<CreateJournalModalProps> = ({
  open,
  onOpenChange,
  companyId,
  isEditMode = false,
  editJournalId = null,
  initialCode = '',
  initialType = 'BANK',
  initialSubType = '',
  initialName = '',
  initialCurrency = 'HUF',
  initialGlAccount = '',
  initialContraGlAccount = '',
  initialBankAccountNumber = '',
  initialCompanyBankAccountId = '',
  initialPettyCashRegisterId = '',
  initialIsActive = true,
  existingJournals = [],
  glAccounts = [],
  onJournalCreated,
  onJournalUpdated,
  onDeleteRequested,
}) => {
  const { t } = useTranslation(['accounting', 'common']);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentType = initialType || 'BANK';
  const [type, setType] = useState<string>(currentType);
  const [subType, setSubType] = useState<string>(initialSubType || '');
  const [code, setCode] = useState<string>(() => isEditMode ? (initialCode || '') : suggestNextJournalCode(currentType, existingJournals));
  const [name, setName] = useState<string>(initialName || '');
  const [currency, setCurrency] = useState<string>(initialCurrency || 'HUF');
  const [connectedGlAccount, setConnectedGlAccount] = useState<string>(initialGlAccount || '');
  const [defaultContraGlNumber, setDefaultContraGlNumber] = useState<string>(initialContraGlAccount || initialGlAccount || '');
  const [bankAccountNumber, setBankAccountNumber] = useState<string>(initialBankAccountNumber || '');
  const [companyBankAccountId, setCompanyBankAccountId] = useState<string>(initialCompanyBankAccountId || '');
  const [pettyCashRegisterId, setPettyCashRegisterId] = useState<string>(initialPettyCashRegisterId || '');
  const [isActive, setIsActive] = useState<boolean>(initialIsActive ?? true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Fetch company bank accounts for easy linking
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['company_bank_accounts', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_bank_accounts')
        .select('id, bank_name, account_number, currency, journal_id, gl_account_id')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{ id: string; bank_name?: string | null; account_number: string; currency?: string | null; journal_id?: string | null; gl_account_id?: string | null }>;
    },
    enabled: open && !!companyId,
  });

  // Fetch petty cash registers for easy linking
  const { data: cashRegisters = [] } = useQuery({
    queryKey: ['petty_cash_registers', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('petty_cash_registers')
        .select('id, name, currencies, gl_account')
        .eq('company_id', companyId)
        .order('name');
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; currencies?: string[] | null; gl_account?: string | null }>;
    },
    enabled: open && !!companyId,
  });

  // When type changes, automatically suggest new code and intelligent defaults
  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (!isEditMode) {
      const suggested = suggestNextJournalCode(newType, existingJournals);
      setCode(suggested);

      if (newType === 'CUSTOMER') {
        if (suggested === 'VF') {
          setName('Belföldi vevő számlák (Ft)');
          setConnectedGlAccount('3111');
          setDefaultContraGlNumber('3111');
          setCurrency('HUF');
          setSubType('DOMESTIC_CUSTOMER');
        } else if (suggested === 'VD') {
          setName('Devizás vevő számlák');
          setConnectedGlAccount('316');
          setDefaultContraGlNumber('316');
          setCurrency('EUR');
          setSubType('FOREIGN_CUSTOMER');
        }
      } else if (newType === 'SUPPLIER') {
        if (suggested === 'SZF') {
          setName('Belföldi szállító számlák (Ft)');
          setConnectedGlAccount('4541');
          setDefaultContraGlNumber('4541');
          setCurrency('HUF');
          setSubType('DOMESTIC_SUPPLIER');
        } else if (suggested === 'SZD') {
          setName('Devizás szállító számlák');
          setConnectedGlAccount('4542');
          setDefaultContraGlNumber('4542');
          setCurrency('EUR');
          setSubType('FOREIGN_SUPPLIER');
        }
      } else if (newType === 'SYSTEM') {
        if (suggested === 'TE') {
          setName('Tárgyi eszköz napló');
          setConnectedGlAccount('571');
          setDefaultContraGlNumber('571');
          setSubType('ASSET');
        } else if (suggested === 'ARF') {
          setName('Árfolyamkülönbözet napló');
          setConnectedGlAccount('876');
          setDefaultContraGlNumber('876');
          setSubType('FX');
        } else if (suggested === 'ELH') {
          setName('Időbeli elhatárolások naplója');
          setConnectedGlAccount('391');
          setDefaultContraGlNumber('391');
          setSubType('ACCRUAL');
        } else if (suggested === 'BER') {
          setName('Bérfeladási napló');
          setConnectedGlAccount('471');
          setDefaultContraGlNumber('471');
          setSubType('PAYROLL');
        }
      } else if (newType === 'BANK') {
        setConnectedGlAccount('3841');
        setDefaultContraGlNumber('3841');
        setCurrency('HUF');
        setSubType('BANK_HUF');
      } else if (newType === 'PETTY_CASH') {
        setConnectedGlAccount('3811');
        setDefaultContraGlNumber('3811');
        setCurrency('HUF');
        setSubType('PETTY_CASH_HUF');
      } else if (newType === 'OPENING') {
        setConnectedGlAccount('491');
        setDefaultContraGlNumber('491');
        setSubType('OPENING');
      } else if (newType === 'CLOSING') {
        setConnectedGlAccount('492');
        setDefaultContraGlNumber('492');
        setSubType('CLOSING');
      }
    }
  };

  // Filter or sort GL accounts matching current type/currency
  const filteredGlAccounts = useMemo(() => {
    if (!glAccounts || glAccounts.length === 0) return [];
    if (type === 'BANK') {
      return glAccounts.filter(g => g.gl_number.startsWith('384') || g.gl_number.startsWith('386') || g.gl_number.startsWith('385'));
    }
    if (type === 'PETTY_CASH') {
      return glAccounts.filter(g => g.gl_number.startsWith('381') || g.gl_number.startsWith('382'));
    }
    if (type === 'CUSTOMER') {
      return glAccounts.filter(g => g.gl_number.startsWith('31'));
    }
    if (type === 'SUPPLIER') {
      return glAccounts.filter(g => g.gl_number.startsWith('454'));
    }
    return glAccounts;
  }, [glAccounts, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    const trimmedCurrency = currency.trim().toUpperCase() || 'HUF';
    const trimmedBankAccount = bankAccountNumber.trim();
    const effectiveContraGl = defaultContraGlNumber.trim() || connectedGlAccount.trim() || null;

    if (!trimmedCode) {
      toast({
        title: t('accounting:journals.create_modal.toast_missing_code_title', 'Hiányzó naplókód'),
        description: t('accounting:journals.create_modal.toast_missing_code_desc', 'Kérjük adjon meg egy naplókódot (pl. B3 vagy 201).'),
        variant: 'destructive',
      });
      return;
    }

    if (!trimmedName) {
      toast({
        title: t('accounting:journals.create_modal.toast_missing_name_title', 'Hiányzó megnevezés'),
        description: t('accounting:journals.create_modal.toast_missing_name_desc', 'Kérjük adja meg a napló megnevezését (pl. OTP Bank HUF).'),
        variant: 'destructive',
      });
      return;
    }

    // Check duplicate code (excluding current journal when in edit mode)
    const isDuplicate = existingJournals.some(
      j => j.code.toUpperCase().trim() === trimmedCode && (!isEditMode || j.id !== editJournalId)
    );
    if (isDuplicate) {
      toast({
        title: t('accounting:journals.create_modal.toast_duplicate_title', 'Már létező naplókód'),
        description: t('accounting:journals.create_modal.toast_duplicate_desc', {
          code: trimmedCode,
          defaultValue: `A(z) "${trimmedCode}" kódú napló már létezik ennél a cégnél. Kérjük válasszon másikat!`,
        }),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && editJournalId) {
        const payload: any = {
          code: trimmedCode,
          name: trimmedName,
          type: type,
          currency: trimmedCurrency,
          connected_gl_account: connectedGlAccount.trim() || null,
          default_contra_gl_number: effectiveContraGl,
          bank_account_number: type === 'BANK' && trimmedBankAccount ? trimmedBankAccount : null,
          company_bank_account_id: type === 'BANK' && companyBankAccountId ? companyBankAccountId : null,
          petty_cash_register_id: type === 'PETTY_CASH' && pettyCashRegisterId ? pettyCashRegisterId : null,
          sub_type: subType || null,
          is_active: isActive,
        };

        const { data, error } = await supabase
          .from('acc_journals')
          .update(payload)
          .eq('id', editJournalId)
          .eq('company_id', companyId)
          .select('id, code, name, type, currency, connected_gl_account, bank_account_number, company_bank_account_id, petty_cash_register_id, sub_type, default_contra_gl_number')
          .single();

        if (error) throw error;

        toast({
          title: t('accounting:journals.manage_modal.toast_success', 'Napló sikeresen frissítve'),
          description: `${data.code} - ${data.name} (${data.currency}) mentve.`,
        });

        queryClient.invalidateQueries({ queryKey: ['acc-journals', companyId] });
        queryClient.invalidateQueries({ queryKey: ['acc-bank-journals', companyId] });
        queryClient.invalidateQueries({ queryKey: ['company_bank_accounts', companyId] });

        if (onJournalUpdated) {
          onJournalUpdated(data as CreatedJournalPayload);
        }

        onOpenChange(false);
      } else {
        const payload: any = {
          company_id: companyId,
          code: trimmedCode,
          name: trimmedName,
          type: type,
          currency: trimmedCurrency,
          connected_gl_account: connectedGlAccount.trim() || null,
          default_contra_gl_number: effectiveContraGl,
          bank_account_number: type === 'BANK' && trimmedBankAccount ? trimmedBankAccount : null,
          company_bank_account_id: type === 'BANK' && companyBankAccountId ? companyBankAccountId : null,
          petty_cash_register_id: type === 'PETTY_CASH' && pettyCashRegisterId ? pettyCashRegisterId : null,
          sub_type: subType || null,
          is_active: true,
        };

        const { data, error } = await supabase
          .from('acc_journals')
          .insert(payload)
          .select('id, code, name, type, currency, connected_gl_account, bank_account_number, company_bank_account_id, petty_cash_register_id, sub_type, default_contra_gl_number')
          .single();

        if (error) throw error;

        toast({
          title: t('accounting:journals.create_modal.toast_success_title', 'Napló sikeresen létrehozva'),
          description: `${data.code} - ${data.name} (${data.currency}) rögzítve.`,
        });

        queryClient.invalidateQueries({ queryKey: ['acc-journals', companyId] });
        queryClient.invalidateQueries({ queryKey: ['acc-bank-journals', companyId] });
        queryClient.invalidateQueries({ queryKey: ['company_bank_accounts', companyId] });

        if (onJournalCreated) {
          onJournalCreated(data as CreatedJournalPayload);
        }

        onOpenChange(false);
      }
    } catch (err: any) {
      toast({
        title: t('accounting:journals.create_modal.toast_error_title', 'Hiba a napló mentésekor'),
        description: err.message || t('accounting:journals.create_modal.toast_error_desc', 'Nem sikerült menteni a könyvelési naplót.'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              <span>
                {isEditMode 
                  ? t('accounting:journals.create_modal.title_edit', 'Könyvelési Napló Módosítása') 
                  : t('accounting:journals.create_modal.title', 'Új Könyvelési Napló Létrehozása')}
              </span>
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? t('accounting:journals.create_modal.description_edit', 'Módosítsa a napló adatait, a devizanemet, a kapcsolt főkönyvi számot vagy a bankszámlaszámot.')
                : t('accounting:journals.create_modal.description', 'Hozzon létre új analitikus könyvelési naplót a banki, pénztári vagy vegyes tételek önálló sorszámozásához.')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="journal-type">{t('accounting:journals.create_modal.field_type', 'Napló jellege *')}</Label>
                <Select value={type} onValueChange={handleTypeChange}>
                  <SelectTrigger id="journal-type">
                    <SelectValue placeholder={t('accounting:journals.create_modal.type_placeholder', 'Válassz típust...')} />
                  </SelectTrigger>
                  <SelectContent>
                    {JOURNAL_TYPES.map(jt => (
                      <SelectItem key={jt.value} value={jt.value}>
                        {t(`accounting:journals.create_modal.types.${jt.value}`, { defaultValue: jt.label })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="journal-code">{t('accounting:journals.create_modal.field_code', 'Naplókód *')}</Label>
                <Input
                  id="journal-code"
                  placeholder="pl. 201 vagy B3"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase font-semibold"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="journal-name">{t('accounting:journals.create_modal.field_name', 'Napló megnevezése *')}</Label>
              <Input
                id="journal-name"
                placeholder={t('accounting:journals.create_modal.name_placeholder', 'pl. OTP Bank HUF vagy VÚB Banka EUR')}
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="journal-currency">{t('accounting:journals.create_modal.field_currency', 'Pénznem *')}</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="journal-currency">
                    <SelectValue placeholder={t('accounting:journals.create_modal.currency_placeholder', 'Pénznem')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px]">
                    {MNB_CURRENCIES.map(c => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} — {c.name} {c.symbol ? `(${c.symbol})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="journal-gl-account">{t('accounting:journals.create_modal.field_gl_account', 'Kapcsolt főkönyvi szám')}</Label>
                {filteredGlAccounts.length > 0 ? (
                  <Select
                    value={connectedGlAccount || 'none'}
                    onValueChange={v => setConnectedGlAccount(v === 'none' ? '' : v)}
                  >
                    <SelectTrigger id="journal-gl-account">
                      <SelectValue placeholder={t('accounting:journals.create_modal.gl_placeholder', 'Válassz számlát...')} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[220px]">
                      <SelectItem value="none">{t('accounting:journals.create_modal.gl_none', 'Nincs hozzárendelve')}</SelectItem>
                      {filteredGlAccounts.map(ga => (
                        <SelectItem key={ga.id} value={ga.gl_number}>
                          {ga.gl_number} - {ga.short_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="journal-gl-account"
                    placeholder="pl. 3842 vagy 3862"
                    value={connectedGlAccount}
                    onChange={e => setConnectedGlAccount(e.target.value)}
                  />
                )}
              </div>
            </div>

            {/* Bank account selector or number input when journal is of type BANK */}
            {type === 'BANK' && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label htmlFor="journal-bank-account" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Landmark className="w-3.5 h-3.5 text-primary" />
                  <span>{t('accounting:journals.create_modal.field_bank_account', 'Kapcsolt Céges Bankszámla')}</span>
                </Label>

                {bankAccounts.length > 0 ? (
                  <div className="space-y-1.5">
                    <Select
                      value={companyBankAccountId || 'custom'}
                      onValueChange={(val) => {
                        if (val === 'custom') {
                          setCompanyBankAccountId('');
                        } else {
                          setCompanyBankAccountId(val);
                          const matched = bankAccounts.find(b => b.id === val);
                          if (matched) {
                            setBankAccountNumber(matched.account_number);
                            if (matched.currency) setCurrency(matched.currency);
                            if (!name) setName(`${matched.bank_name || 'Bank'} ${matched.currency || 'HUF'}`);
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue placeholder="Válassz meglévő bankszámlát..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">Egyéni számlaszám megadása...</SelectItem>
                        {bankAccounts.map(b => (
                          <SelectItem key={b.id} value={b.id} className="text-xs font-mono">
                            {b.bank_name ? `${b.bank_name} - ` : ''}{b.account_number} ({b.currency || 'HUF'})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Input
                      id="journal-bank-account"
                      placeholder="pl. 11773016-12345678-00000000 vagy IBAN"
                      value={bankAccountNumber}
                      onChange={e => {
                        setBankAccountNumber(e.target.value);
                        setCompanyBankAccountId('');
                      }}
                      className="font-mono text-xs mt-1"
                    />
                  </div>
                ) : (
                  <Input
                    id="journal-bank-account"
                    placeholder="pl. 11773016-12345678-00000000 vagy IBAN"
                    value={bankAccountNumber}
                    onChange={e => setBankAccountNumber(e.target.value)}
                    className="font-mono text-xs"
                  />
                )}

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t('accounting:journals.create_modal.bank_account_desc', 'A számlaszám és az IBAN alapján a bankkivonat (CAMT.053, MT940, CSV) és a PSD2 banki szinkron automatikusan ebbe a naplóba kontíroz.')}
                </p>
              </div>
            )}

            {/* Petty cash register selector when journal is of type PETTY_CASH */}
            {type === 'PETTY_CASH' && cashRegisters.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="flex items-center gap-1.5 text-xs font-semibold">
                  <BookOpen className="w-3.5 h-3.5 text-primary" />
                  <span>Kapcsolt Házipénztár / Kassza</span>
                </Label>
                <Select
                  value={pettyCashRegisterId || 'none'}
                  onValueChange={(val) => {
                    if (val === 'none') {
                      setPettyCashRegisterId('');
                    } else {
                      setPettyCashRegisterId(val);
                      const matched = cashRegisters.find(r => r.id === val);
                      if (matched) {
                        if (!name) setName(`Pénztár - ${matched.name}`);
                        if (matched.gl_account) setConnectedGlAccount(matched.gl_account);
                        if (matched.currencies?.[0]) setCurrency(matched.currencies[0]);
                      }
                    }
                  }}
                >
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Válassz kasszát az összerendeléshez..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nincs konkrét kasszához kötve</SelectItem>
                    {cashRegisters.map(r => (
                      <SelectItem key={r.id} value={r.id} className="text-xs">
                        {r.name} {r.gl_account ? `(Főkönyv: ${r.gl_account})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  A házipénztár bizonylatok lezárásakor a rendszer automatikusan a kapcsolt kassza naplójába generálja a könyvelési tételt.
                </p>
              </div>
            )}

            {/* Smart Contra GL info badge */}
            <div className="rounded-md bg-muted/60 p-2.5 border border-border/60 text-[11px] text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground flex items-center justify-between">
                <span>Automatikus könyvelési irányítás:</span>
                <span className="font-mono text-primary font-bold">{code || '—'}</span>
              </div>
              <p>
                {type === 'CUSTOMER' && (code === 'VF' ? 'Belföldi adószámmal rendelkező partnerek vevőszámlái a 3111 követelés számlára.' : code === 'VD' ? 'Külföldi / EU partnerek vevőszámlái a 316 devizás követelés számlára.' : 'Vevőszámlák automatikus vagy kézi könyvelése.')}
                {type === 'SUPPLIER' && (code === 'SZF' ? 'Belföldi adószámmal rendelkező szállítói számlák a 4541 kötelezettség számlára.' : code === 'SZD' ? 'Külföldi / EU szállítói számlák a 4542 devizás kötelezettség számlára.' : 'Szállítói számlák automatikus vagy kézi könyvelése.')}
                {type === 'BANK' && 'Bankkivonatok és banki tranzakciók kontírozása a kijelölt 384x számlára.'}
                {type === 'PETTY_CASH' && 'Készpénzes bizonylatok és pénztárjelentések a 381x/382x számlára.'}
                {type === 'SYSTEM' && 'Zárt gépi rendszernapló: ide kizárólag automatikus számítások (értékcsökkenés, árfolyam, elhatárolás, bér) könyvelnek.'}
                {type === 'MIXED' && 'Vegyes gazdasági események és kézi bizonylatok könyvelése.'}
                {type === 'OPENING' && 'Nyitó tételek és előző évi mérleg/főkönyv nyitás a 491-es számlával.'}
                {type === 'CLOSING' && 'Év végi rendező és mérlegzáró tételek a 492-es számlával.'}
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between items-center gap-2 pt-2">
            {isEditMode && editJournalId && onDeleteRequested ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (editJournalId) {
                    onDeleteRequested(editJournalId);
                  }
                }}
                disabled={isSubmitting}
                className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-9 px-2.5 gap-1.5 w-full sm:w-auto justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('accounting:journals.manage_modal.btn_delete', 'Napló törlése')}</span>
              </Button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                {t('common:actions.cancel', 'Mégse')}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('accounting:journals.create_modal.btn_submitting', 'Mentés...')}
                  </>
                ) : (
                  isEditMode
                    ? t('accounting:journals.create_modal.btn_submit_edit', 'Módosítások Mentése')
                    : t('accounting:journals.create_modal.btn_submit', 'Napló Létrehozása')
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
