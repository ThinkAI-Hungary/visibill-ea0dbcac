import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invalidateGlQueries } from '@/lib/cache';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Sparkles, BookOpen } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface AddManualJournalEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string;
  presetId?: string;
  onSuccess?: () => void;
}

export function AddManualJournalEntryModal({
  open,
  onOpenChange,
  companyId,
  presetId,
  onSuccess,
}: AddManualJournalEntryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [voucherNumber, setVoucherNumber] = useState('');
  const [description, setDescription] = useState('');
  const [debitAccount, setDebitAccount] = useState('');
  const [creditAccount, setCreditAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('HUF');

  const [debitComboOpen, setDebitComboOpen] = useState(false);
  const [creditComboOpen, setCreditComboOpen] = useState(false);
  const [debitSearch, setDebitSearch] = useState('');
  const [creditSearch, setCreditSearch] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch GL accounts (paginated)
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glAccounts_manual_form', presetId],
    queryFn: async () => {
      if (!presetId) return [];
      return await fetchAllGlAccountsByPreset(presetId);
    },
    enabled: !!presetId && open,
  });

  // Filter leaf accounts
  const leafAccounts = useMemo(() => {
    const cleanGlNum = (num: string) => String(num).replace(/\./g, '');
    return glAccounts.filter(gl => {
      const cid = cleanGlNum(gl.gl_number);
      const isLeaf = !glAccounts.some(sub => 
        cleanGlNum(sub.gl_number).startsWith(cid) && 
        sub.id !== gl.id
      );
      return isLeaf;
    }).sort((a, b) => cleanGlNum(a.gl_number).localeCompare(cleanGlNum(b.gl_number)));
  }, [glAccounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !presetId) return;

    if (!voucherNumber || !debitAccount || !creditAccount || !amount) {
      toast({ title: 'Hiba', description: 'Kérjük, töltsön ki minden kötelező mezőt!', variant: 'destructive' });
      return;
    }

    if (debitAccount === creditAccount) {
      toast({ title: 'Hiba', description: 'A tartozik és követel főkönyvi szám nem egyezhet meg!', variant: 'destructive' });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      toast({ title: 'Hiba', description: 'Az összegnek nullánál nagyobbnak kell lennie!', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Check if the manual import header exists
      const { data: imports, error: importError } = await supabase
        .from('gl_audit_imports')
        .select('id')
        .eq('company_id', companyId)
        .eq('preset_id', presetId)
        .eq('file_name', 'Vegyes Manuális Bizonylatok')
        .limit(1);

      if (importError) throw importError;

      let importId = '';
      if (imports && imports.length > 0) {
        importId = imports[0].id;
      } else {
        // Create manual import header
        const year = date.substring(0, 4) || new Date().getFullYear().toString();
        const { data: newImport, error: createImportError } = await supabase
          .from('gl_audit_imports')
          .insert({
            company_id: companyId,
            preset_id: presetId,
            file_name: 'Vegyes Manuális Bizonylatok',
            period_start: `${year}-01-01`,
            period_end: `${year}-12-31`,
            processing_status: 'completed',
            dry_run: false,
            entry_count: 0,
            source_program: 'Manual Entry Form',
          })
          .select('id')
          .single();

        if (createImportError) throw createImportError;
        importId = newImport.id;
      }

      // 2. Insert manual entry into gl_journal_entries
      const { error: entryError } = await supabase
        .from('gl_journal_entries')
        .insert({
          company_id: companyId,
          import_id: importId,
          voucher_date: date,
          voucher_number: voucherNumber,
          description: description || 'Vegyes manual journal entry',
          debit_account: debitAccount,
          credit_account: creditAccount,
          amount: numericAmount,
          foreign_currency: currency,
          foreign_amount: numericAmount,
          exchange_rate: 1,
        });

      if (entryError) throw entryError;

      toast({
        title: 'Sikeres rögzítés',
        description: 'A vegyes bizonylat sikeresen rögzítve lett.',
        className: 'bg-green-50 text-green-900 border-green-200',
      });

      // Reset form
      setVoucherNumber('');
      setDescription('');
      setDebitAccount('');
      setCreditAccount('');
      setAmount('');
      setCurrency('HUF');
      setDebitSearch('');
      setCreditSearch('');

      // Invalidate caches
      if (companyId) {
        invalidateGlQueries(queryClient, companyId, presetId);
      } else {
        queryClient.invalidateQueries({ queryKey: ['glBalances'] });
        queryClient.invalidateQueries({ queryKey: ['glItems'] });
        queryClient.invalidateQueries({ queryKey: ['glJournalEntries'] });
        queryClient.invalidateQueries({ queryKey: ['auditImports'] });
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Mentési hiba', description: err.message || 'Hiba történt a mentés során.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getGlLabel = (code: string) => {
    const acc = leafAccounts.find(gl => gl.gl_number === code);
    return acc ? `${acc.gl_number} ${acc.short_name}` : code || 'Főkönyvi szám kiválasztása...';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Vegyes Manuális Bizonylat Rögzítése
            </DialogTitle>
            <DialogDescription>
              Rögzítsen kézzel vegyes könyvelési tételt közvetlenül a főkönyvi struktúrába.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="font-semibold">Kelt / Dátum</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="voucherNumber" className="font-semibold">Bizonylatszám</Label>
                <Input
                  id="voucherNumber"
                  placeholder="pl. V-2026-0001"
                  value={voucherNumber}
                  onChange={(e) => setVoucherNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Tartozik számla (Debit)</Label>
              <Popover open={debitComboOpen} onOpenChange={setDebitComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={debitComboOpen}
                    className="justify-between w-full font-medium"
                  >
                    <span className="truncate">{getGlLabel(debitAccount)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0 z-[1200]">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Tartozik főkönyvi szám keresése..."
                      value={debitSearch}
                      onValueChange={setDebitSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Nincs találat.</CommandEmpty>
                      <CommandGroup>
                        {leafAccounts
                          ?.filter(gl => !debitSearch || `${gl.gl_number} ${gl.short_name}`.toLowerCase().includes(debitSearch.toLowerCase()))
                          .map(gl => (
                            <CommandItem
                              key={gl.id}
                              value={`${gl.gl_number} ${gl.short_name}`}
                              onSelect={() => {
                                setDebitAccount(gl.gl_number);
                                setDebitComboOpen(false);
                              }}
                            >
                              {gl.gl_number} {gl.short_name}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold">Követel számla (Credit)</Label>
              <Popover open={creditComboOpen} onOpenChange={setCreditComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={creditComboOpen}
                    className="justify-between w-full font-medium"
                  >
                    <span className="truncate">{getGlLabel(creditAccount)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0 z-[1200]">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Követel főkönyvi szám keresése..."
                      value={creditSearch}
                      onValueChange={setCreditSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Nincs találat.</CommandEmpty>
                      <CommandGroup>
                        {leafAccounts
                          ?.filter(gl => !creditSearch || `${gl.gl_number} ${gl.short_name}`.toLowerCase().includes(creditSearch.toLowerCase()))
                          .map(gl => (
                            <CommandItem
                              key={gl.id}
                              value={`${gl.gl_number} ${gl.short_name}`}
                              onSelect={() => {
                                setCreditAccount(gl.gl_number);
                                setCreditComboOpen(false);
                              }}
                            >
                              {gl.gl_number} {gl.short_name}
                            </CommandItem>
                          ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="amount" className="font-semibold">Összeg</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency" className="font-semibold">Pénznem</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HUF">HUF</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="font-semibold">Megjegyzés / Szöveg</Label>
              <Textarea
                id="description"
                placeholder="Írja le a tétel okát..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Mégse
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-1.5">
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Könyvelés
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
