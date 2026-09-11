import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, BookOpen, AlertCircle, CheckCircle2, ArrowDownRight } from 'lucide-react';
import { invalidateGlQueries } from '@/lib/cache';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';

interface AddGlAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetId: string | undefined;
  presetName?: string;
  companyId: string | undefined;
  onSuccess?: (newAccount: any) => void;
}

const getAccountClassLabel = (firstDigit: string): string => {
  switch (firstDigit) {
    case '1': return '1. Befektetett eszközök (Eszközök)';
    case '2': return '2. Készletek (Eszközök)';
    case '3': return '3. Követelések és pénzügyi eszközök (Eszközök)';
    case '4': return '4. Források (Saját tőke, Céltartalékok, Kötelezettségek)';
    case '5': return '5. Költségnemek (Ráfordítások)';
    case '6': return '6. Általános költségek (Költséghelyek)';
    case '7': return '7. Tevékenységek közvetlen költségei';
    case '8': return '8. Értékesítés elszámolt közvetlen önköltsége és egyéb ráfordítások';
    case '9': return '9. Értékesítés árbevétele és egyéb bevételek';
    default: return 'Egyéb számlaosztály';
  }
};

export function AddGlAccountModal({
  open,
  onOpenChange,
  presetId,
  presetName,
  companyId,
  onSuccess,
}: AddGlAccountModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [glNumber, setGlNumber] = useState('');
  const [shortName, setShortName] = useState('');
  const [description, setDescription] = useState('');
  const [accountType, setAccountType] = useState<'BALANCE_SHEET' | 'PROFIT_LOSS'>('BALANCE_SHEET');

  // Fetch current preset accounts to detect duplicates and parent accounts
  const { data: existingAccounts = [] } = useQuery({
    queryKey: ['gl-accounts-lookup', presetId],
    queryFn: async () => {
      if (!presetId) return [];
      return await fetchAllGlAccountsByPreset(presetId);
    },
    enabled: !!presetId && open,
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setGlNumber('');
      setShortName('');
      setDescription('');
      setAccountType('BALANCE_SHEET');
    }
  }, [open]);

  // Clean GL Number
  const cleanedGlNumber = useMemo(() => {
    return glNumber.trim().replace(/\s+/g, '');
  }, [glNumber]);

  // Auto-detect accountType & class label from first digit
  const firstDigit = cleanedGlNumber.charAt(0);
  const classLabel = firstDigit ? getAccountClassLabel(firstDigit) : null;

  useEffect(() => {
    if (firstDigit) {
      if (['1', '2', '3', '4'].includes(firstDigit)) {
        setAccountType('BALANCE_SHEET');
      } else if (['5', '6', '7', '8', '9'].includes(firstDigit)) {
        setAccountType('PROFIT_LOSS');
      }
    }
  }, [firstDigit]);

  // Detect parent account (e.g. if creating 4712, check if 471 exists)
  const detectedParent = useMemo(() => {
    if (!cleanedGlNumber || cleanedGlNumber.length <= 1) return null;
    const cleanId = (num: string) => String(num || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const currentCid = cleanId(cleanedGlNumber);

    let match: any = null;
    for (const acc of existingAccounts) {
      const parentCid = cleanId(acc.gl_number);
      if (parentCid && currentCid.startsWith(parentCid) && currentCid !== parentCid) {
        if (!match || parentCid.length > cleanId(match.gl_number).length) {
          match = acc;
        }
      }
    }
    return match;
  }, [cleanedGlNumber, existingAccounts]);

  // Check duplicate
  const isDuplicate = useMemo(() => {
    if (!cleanedGlNumber) return false;
    const cleanId = (num: string) => String(num || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const currentCid = cleanId(cleanedGlNumber);
    return existingAccounts.some(acc => cleanId(acc.gl_number) === currentCid);
  }, [cleanedGlNumber, existingAccounts]);

  // Mutation to insert new account
  const createAccountMutation = useMutation({
    mutationFn: async () => {
      if (!presetId) throw new Error('Nincs aktív számlatükör sablon kiválasztva!');
      if (!cleanedGlNumber) throw new Error('A főkönyvi szám megadása kötelező!');
      if (!shortName.trim()) throw new Error('A megnevezés megadása kötelező!');
      if (isDuplicate) throw new Error(`A(z) ${cleanedGlNumber} főkönyvi szám már létezik ebben a számlatükörben!`);

      const payload = {
        preset_id: presetId,
        gl_number: cleanedGlNumber,
        short_name: shortName.trim(),
        description: description.trim() || null,
        parent_id: detectedParent?.id || null,
      };

      const { data, error } = await supabase
        .from('gl_accounts')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (newAccount) => {
      if (companyId) {
        await invalidateGlQueries(queryClient, companyId, presetId);
      }
      await queryClient.invalidateQueries({ queryKey: ['gl-accounts-lookup', presetId] });
      await queryClient.invalidateQueries({ queryKey: ['glAccounts_manual_form', presetId] });
      await queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      await queryClient.invalidateQueries({ queryKey: ['coaPresets', companyId] });

      toast({
        title: 'Főkönyvi szám létrehozva',
        description: `A(z) ${cleanedGlNumber} — ${shortName.trim()} sikeresen rögzítve a számlatükörben.`,
      });

      onSuccess?.(newAccount);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a mentéskor',
        description: err.message || 'Nem sikerült létrehozni a főkönyvi számot.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAccountMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <BookOpen className="w-5 h-5 text-primary" />
            Új Főkönyvi Szám / Alábontás Felvitele
          </DialogTitle>
          <DialogDescription>
            {presetName ? (
              <span>Aktív sablon: <strong className="text-foreground">{presetName}</strong></span>
            ) : (
              'Adj hozzá új analitikus vagy szintetikus számlát a számlatükörhöz.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Főkönyvi szám */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="glNumber" className="text-xs font-semibold">
                Főkönyvi szám <span className="text-destructive">*</span>
              </Label>
              {classLabel && (
                <span className="text-[11px] text-muted-foreground font-medium">
                  {classLabel}
                </span>
              )}
            </div>
            <Input
              id="glNumber"
              value={glNumber}
              onChange={(e) => setGlNumber(e.target.value)}
              placeholder="pl. 4712 vagy 5412"
              className="font-mono text-sm"
              autoFocus
              required
            />
            {isDuplicate && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Ez a főkönyvi szám ({cleanedGlNumber}) már szerepel ebben a számlatükörben!
              </p>
            )}
            {detectedParent && !isDuplicate && (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded-md border border-emerald-500/20 mt-1.5">
                <ArrowDownRight className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Alábontás a következő gyűjtőhöz:{' '}
                  <strong>{detectedParent.gl_number} — {detectedParent.short_name}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Megnevezés */}
          <div className="space-y-1.5">
            <Label htmlFor="shortName" className="text-xs font-semibold">
              Megnevezés / Számlanév <span className="text-destructive">*</span>
            </Label>
            <Input
              id="shortName"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="pl. Jövedelemelszámolási számla (fizikai)"
              className="text-sm"
              required
            />
          </div>

          {/* Számla típusa */}
          <div className="space-y-1.5">
            <Label htmlFor="accountType" className="text-xs font-semibold">
              Számla jellege (Mérleg / Eredmény)
            </Label>
            <Select
              value={accountType}
              onValueChange={(val: 'BALANCE_SHEET' | 'PROFIT_LOSS') => setAccountType(val)}
            >
              <SelectTrigger id="accountType" className="text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BALANCE_SHEET" className="text-xs">
                  Mérlegszámla (Eszközök 1-3, Források 4)
                </SelectItem>
                <SelectItem value="PROFIT_LOSS" className="text-xs">
                  Eredményszámla (Költségek 5, Ráfordítások 8, Bevételek 9)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Leírás (opcionális) */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground">
              Részletes leírás / Megjegyzés (opcionális)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="pl. Fizikai állományú dolgozók bérkötelezettségei telephelyenként..."
              className="text-xs min-h-[70px]"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createAccountMutation.isPending}
            >
              Mégse
            </Button>
            <Button
              type="submit"
              disabled={
                createAccountMutation.isPending ||
                !cleanedGlNumber ||
                !shortName.trim() ||
                isDuplicate
              }
              className="gap-1.5"
            >
              {createAccountMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Mentés...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Hozzáadás
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
