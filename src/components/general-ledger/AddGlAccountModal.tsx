import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, BookOpen, AlertCircle } from 'lucide-react';
import { invalidateGlQueries } from '@/lib/cache';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';
import { GlAccountFormFields, GlAccountFormData } from './GlAccountFormFields';
import { useTranslation } from 'react-i18next';

interface AddGlAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetId: string | undefined;
  presetName?: string;
  companyId: string | undefined;
  onSuccess?: (newAccount: any) => void;
}

export function AddGlAccountModal({
  open,
  onOpenChange,
  presetId,
  presetName,
  companyId,
  onSuccess,
}: AddGlAccountModalProps) {
  const { t } = useTranslation(['accounting', 'common']);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<GlAccountFormData>({
    glNumber: '',
    shortName: '',
    description: '',
    accountType: 'detail',
    subledgerType: 'none',
    isOpenItemManaged: false,
    isMulticurrency: false,
    currency: 'ANY',
  });

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
      setFormData({
        glNumber: '',
        shortName: '',
        description: '',
        accountType: 'detail',
        subledgerType: 'none',
        isOpenItemManaged: false,
        isMulticurrency: false,
        currency: 'ANY',
      });
    }
  }, [open]);

  // Clean GL Number
  const cleanedGlNumber = useMemo(() => {
    return formData.glNumber.trim().replace(/\s+/g, '');
  }, [formData.glNumber]);

  // Auto-detect defaults based on GL Number prefixes
  useEffect(() => {
    if (!cleanedGlNumber) return;
    const clean = cleanedGlNumber.replace(/\./g, '');

    // Auto-detect multicurrency
    if (clean.startsWith('386') || clean.startsWith('382') || clean.startsWith('316') || clean.startsWith('4542')) {
      setFormData(prev => ({
        ...prev,
        isMulticurrency: true,
        currency: clean.startsWith('386') && prev.currency === 'ANY' ? 'EUR' : prev.currency,
      }));
    }

    // Auto-detect subledger defaults
    if (
      clean.startsWith('311') || clean.startsWith('312') || clean.startsWith('315') ||
      clean.startsWith('316') || clean.startsWith('317') || clean.startsWith('454') || clean.startsWith('455')
    ) {
      setFormData(prev => ({
        ...prev,
        subledgerType: 'partner',
        isOpenItemManaged: true,
      }));
    } else if (
      clean.startsWith('361') || clean.startsWith('4521') || clean.startsWith('452') ||
      clean.startsWith('451') || clean.startsWith('44')
    ) {
      setFormData(prev => ({
        ...prev,
        subledgerType: 'detail',
        isOpenItemManaged: true,
      }));
    }
  }, [cleanedGlNumber]);

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
      if (!formData.shortName.trim()) throw new Error('A megnevezés megadása kötelező!');
      if (isDuplicate) throw new Error(`A(z) ${cleanedGlNumber} főkönyvi szám már létezik ebben a számlatükörben!`);

      const effectiveCurrency = formData.isMulticurrency
        ? (formData.currency === 'ANY' ? null : formData.currency)
        : (formData.currency === 'HUF' ? 'HUF' : null);

      const payload = {
        preset_id: presetId,
        gl_number: cleanedGlNumber,
        short_name: formData.shortName.trim(),
        description: formData.description.trim() || null,
        parent_id: detectedParent?.id || null,
        account_type: formData.accountType,
        subledger_type: formData.subledgerType,
        is_open_item_managed: formData.isOpenItemManaged,
        is_multicurrency: formData.isMulticurrency,
        currency: effectiveCurrency,
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
      await queryClient.invalidateQueries({ queryKey: ['general-ledger-tree'] });
      await queryClient.invalidateQueries({ queryKey: ['subledger'] });
      await queryClient.invalidateQueries({ queryKey: ['coaPresets', companyId] });

      toast({
        title: 'Főkönyvi szám létrehozva',
        description: `A(z) ${cleanedGlNumber} — ${formData.shortName.trim()} sikeresen rögzítve a számlatükörben.`,
        className: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100',
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <BookOpen className="w-5 h-5 text-primary" />
            <span>Új Főkönyvi Szám / Alábontás Felvitele</span>
          </DialogTitle>
          <DialogDescription>
            {presetName ? (
              <span>Aktív sablon: <strong className="text-foreground">{presetName}</strong></span>
            ) : (
              'Adjon hozzá új könyvelési számlát vagy csoportszámlát az aktív számlatükörhöz.'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {isDuplicate && (
            <div className="p-2.5 mb-3 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Ez a főkönyvi szám ({cleanedGlNumber}) már szerepel ebben a számlatükörben!</span>
            </div>
          )}

          <GlAccountFormFields
            data={formData}
            onChange={(updates) => setFormData(prev => ({ ...prev, ...updates }))}
            isEditingGlNumber={false}
            detectedParent={detectedParent}
            hasChildren={false}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createAccountMutation.isPending}
          >
            Mégse
          </Button>
          <Button
            type="button"
            onClick={() => createAccountMutation.mutate()}
            disabled={createAccountMutation.isPending || isDuplicate || !cleanedGlNumber || !formData.shortName.trim()}
            className="gap-2"
          >
            {createAccountMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>Főkönyvi szám mentése</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
