import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, Loader2 } from 'lucide-react';

export interface CreatedJournalPayload {
  id: string;
  code: string;
  name: string;
  type: string;
  currency: string;
  connected_gl_account: string | null;
}

interface CreateJournalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  initialType?: string;
  initialName?: string;
  initialCurrency?: string;
  initialGlAccount?: string;
  existingJournals?: Array<{ id: string; code: string; type: string; name: string }>;
  glAccounts?: Array<{ id: string; gl_number: string; short_name: string; currency?: string | null }>;
  onJournalCreated?: (journal: CreatedJournalPayload) => void;
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
  initialType = 'BANK',
  initialName = '',
  initialCurrency = 'HUF',
  initialGlAccount = '',
  existingJournals = [],
  glAccounts = [],
  onJournalCreated,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [type, setType] = useState<string>(initialType);
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>(initialName);
  const [currency, setCurrency] = useState<string>(initialCurrency);
  const [connectedGlAccount, setConnectedGlAccount] = useState<string>(initialGlAccount);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (open) {
      const currentType = initialType || 'BANK';
      setType(currentType);
      const suggested = suggestNextJournalCode(currentType, existingJournals);
      setCode(suggested);
      setName(initialName);
      setCurrency(initialCurrency || 'HUF');
      setConnectedGlAccount(initialGlAccount || '');
    }
  }, [open, initialType, initialName, initialCurrency, initialGlAccount, existingJournals]);

  // When type changes, automatically suggest new code if user hasn't heavily customized
  const handleTypeChange = (newType: string) => {
    setType(newType);
    const suggested = suggestNextJournalCode(newType, existingJournals);
    setCode(suggested);
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

    if (!trimmedCode) {
      toast({ title: 'Hiányzó naplókód', description: 'Kérjük adjon meg egy naplókódot (pl. B3).', variant: 'destructive' });
      return;
    }

    if (!trimmedName) {
      toast({ title: 'Hiányzó megnevezés', description: 'Kérjük adja meg a napló megnevezését (pl. OTP Bank HUF).', variant: 'destructive' });
      return;
    }

    // Check duplicate code
    const isDuplicate = existingJournals.some(
      j => j.code.toUpperCase().trim() === trimmedCode
    );
    if (isDuplicate) {
      toast({
        title: 'Már létező naplókód',
        description: `A(z) "${trimmedCode}" kódú napló már létezik ennél a cégnél. Kérjük válasszon másikat!`,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        company_id: companyId,
        code: trimmedCode,
        name: trimmedName,
        type: type,
        currency: trimmedCurrency,
        connected_gl_account: connectedGlAccount.trim() || null,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('acc_journals')
        .insert(payload)
        .select('id, code, name, type, currency, connected_gl_account')
        .single();

      if (error) throw error;

      toast({
        title: 'Napló sikeresen létrehozva',
        description: `${data.code} - ${data.name} (${data.currency}) rögzítve.`,
      });

      // Invalidate relevant React Query caches
      queryClient.invalidateQueries({ queryKey: ['acc-journals', companyId] });
      queryClient.invalidateQueries({ queryKey: ['acc-bank-journals', companyId] });

      if (onJournalCreated) {
        onJournalCreated(data as CreatedJournalPayload);
      }

      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Hiba a napló mentésekor',
        description: err.message || 'Nem sikerült menteni az új könyvelési naplót.',
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
              <span>Új Könyvelési Napló Létrehozása</span>
            </DialogTitle>
            <DialogDescription>
              Hozzon létre új analitikus könyvelési naplót a banki, pénztári vagy vegyes tételek önálló sorszámozásához.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="journal-type">Naplótípus *</Label>
                <Select value={type} onValueChange={handleTypeChange}>
                  <SelectTrigger id="journal-type">
                    <SelectValue placeholder="Válassz típust..." />
                  </SelectTrigger>
                  <SelectContent>
                    {JOURNAL_TYPES.map(jt => (
                      <SelectItem key={jt.value} value={jt.value}>
                        {jt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="journal-code">Naplókód *</Label>
                <Input
                  id="journal-code"
                  placeholder="pl. B3"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase font-semibold"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="journal-name">Napló megnevezése *</Label>
              <Input
                id="journal-name"
                placeholder="pl. OTP Bank HUF vagy VÚB Banka EUR"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="journal-currency">Pénznem *</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="journal-currency">
                    <SelectValue placeholder="Pénznem" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HUF">HUF - Magyar forint</SelectItem>
                    <SelectItem value="EUR">EUR - Euró</SelectItem>
                    <SelectItem value="USD">USD - Amerikai dollár</SelectItem>
                    <SelectItem value="GBP">GBP - Brit font</SelectItem>
                    <SelectItem value="CHF">CHF - Svájci frank</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="journal-gl-account">Kapcsolt főkönyvi szám</Label>
                {filteredGlAccounts.length > 0 ? (
                  <Select
                    value={connectedGlAccount || 'none'}
                    onValueChange={v => setConnectedGlAccount(v === 'none' ? '' : v)}
                  >
                    <SelectTrigger id="journal-gl-account">
                      <SelectValue placeholder="Válassz számlát..." />
                    </SelectTrigger>
                    <SelectContent className="max-h-[220px]">
                      <SelectItem value="none">Nincs hozzárendelve</SelectItem>
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
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Mégse
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mentés...
                </>
              ) : (
                'Napló Létrehozása'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
