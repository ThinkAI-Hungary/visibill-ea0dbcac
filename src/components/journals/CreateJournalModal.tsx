import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
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
}

export interface CreateJournalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  isEditMode?: boolean;
  editJournalId?: string | null;
  initialCode?: string;
  initialType?: string;
  initialName?: string;
  initialCurrency?: string;
  initialGlAccount?: string;
  initialBankAccountNumber?: string;
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
  { value: 'MIXED', label: 'Vegyes napló (MIXED)' },
  { value: 'CUSTOMER', label: 'Vevő napló (CUSTOMER)' },
  { value: 'SUPPLIER', label: 'Szállító napló (SUPPLIER)' },
  { value: 'OPENING', label: 'Nyitó napló (OPENING)' },
  { value: 'CLOSING', label: 'Záró napló (CLOSING)' },
  { value: 'SYSTEM', label: 'Rendszer feladási napló (SYSTEM)' },
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

  if (type === 'MIXED') {
    if (!codes.has('VE')) return 'VE';
    let idx = 2;
    while (codes.has(`VE${idx}`)) idx++;
    return `VE${idx}`;
  }

  if (type === 'CUSTOMER') {
    if (!codes.has('V')) return 'V';
    let idx = 2;
    while (codes.has(`V${idx}`)) idx++;
    return `V${idx}`;
  }

  if (type === 'SUPPLIER') {
    if (!codes.has('SZ')) return 'SZ';
    let idx = 2;
    while (codes.has(`SZ${idx}`)) idx++;
    return `SZ${idx}`;
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
  initialName = '',
  initialCurrency = 'HUF',
  initialGlAccount = '',
  initialBankAccountNumber = '',
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

  const [type, setType] = useState<string>(initialType);
  const [code, setCode] = useState<string>(initialCode);
  const [name, setName] = useState<string>(initialName);
  const [currency, setCurrency] = useState<string>(initialCurrency);
  const [connectedGlAccount, setConnectedGlAccount] = useState<string>(initialGlAccount);
  const [bankAccountNumber, setBankAccountNumber] = useState<string>(initialBankAccountNumber);
  const [isActive, setIsActive] = useState<boolean>(initialIsActive);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (open) {
      const currentType = initialType || 'BANK';
      setType(currentType);
      if (isEditMode) {
        setCode(initialCode || '');
      } else {
        const suggested = suggestNextJournalCode(currentType, existingJournals);
        setCode(suggested);
      }
      setName(initialName || '');
      setCurrency(initialCurrency || 'HUF');
      setConnectedGlAccount(initialGlAccount || '');
      setBankAccountNumber(initialBankAccountNumber || '');
      setIsActive(initialIsActive ?? true);
    }
  }, [open, isEditMode, initialCode, initialType, initialName, initialCurrency, initialGlAccount, initialBankAccountNumber, initialIsActive, existingJournals]);

  // When type changes, automatically suggest new code if creating and user hasn't customized
  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (!isEditMode) {
      const suggested = suggestNextJournalCode(newType, existingJournals);
      setCode(suggested);
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
        const payload = {
          code: trimmedCode,
          name: trimmedName,
          type: type,
          currency: trimmedCurrency,
          connected_gl_account: connectedGlAccount.trim() || null,
          bank_account_number: type === 'BANK' && trimmedBankAccount ? trimmedBankAccount : null,
          is_active: isActive,
        };

        const { data, error } = await supabase
          .from('acc_journals')
          .update(payload)
          .eq('id', editJournalId)
          .eq('company_id', companyId)
          .select('id, code, name, type, currency, connected_gl_account, bank_account_number')
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
        const payload = {
          company_id: companyId,
          code: trimmedCode,
          name: trimmedName,
          type: type,
          currency: trimmedCurrency,
          connected_gl_account: connectedGlAccount.trim() || null,
          bank_account_number: type === 'BANK' && trimmedBankAccount ? trimmedBankAccount : null,
          is_active: true,
        };

        const { data, error } = await supabase
          .from('acc_journals')
          .insert(payload)
          .select('id, code, name, type, currency, connected_gl_account, bank_account_number')
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

            {/* Bank account number input when journal is of type BANK */}
            {type === 'BANK' && (
              <div className="space-y-1.5 pt-1 border-t border-border/50">
                <Label htmlFor="journal-bank-account" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Landmark className="w-3.5 h-3.5 text-primary" />
                  <span>{t('accounting:journals.create_modal.field_bank_account', 'Bankszámlaszám (szinkron a cég bankszámláival)')}</span>
                </Label>
                <Input
                  id="journal-bank-account"
                  placeholder="pl. 11773016-12345678-00000000 vagy IBAN"
                  value={bankAccountNumber}
                  onChange={e => setBankAccountNumber(e.target.value)}
                  className="font-mono text-xs"
                />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {t('accounting:journals.create_modal.bank_account_desc', 'A megadott számlaszám automatikusan szinkronizálódik a cég Bankszámlák beállításaiba, és a beolvasott bankkivonatok alapján azonosítja a naplót.')}
                </p>
              </div>
            )}
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
