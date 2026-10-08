import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Check, Edit3 } from 'lucide-react';
import { invalidateGlQueries } from '@/lib/cache';
import { GlAccountFormFields, GlAccountFormData } from './GlAccountFormFields';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';
import { useTranslation } from 'react-i18next';

export interface EditableGlAccount {
  id: string;
  gl_number: string;
  short_name: string;
  description?: string | null;
  account_type?: 'group' | 'detail';
  subledger_type?: 'none' | 'partner' | 'detail';
  is_open_item_managed?: boolean;
  is_multicurrency?: boolean;
  currency?: string | null;
  parent_id?: string | null;
}

interface EditGlAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: EditableGlAccount | null;
  companyId: string | undefined;
  presetId: string | undefined;
  onSuccess?: (updatedAccount: any) => void;
}

export function EditGlAccountModal({
  open,
  onOpenChange,
  account,
  companyId,
  presetId,
  onSuccess,
}: EditGlAccountModalProps) {
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

  // Fetch accounts in preset to detect parent and children
  const { data: existingAccounts = [] } = useQuery({
    queryKey: ['gl-accounts-lookup', presetId],
    queryFn: async () => {
      if (!presetId) return [];
      return await fetchAllGlAccountsByPreset(presetId);
    },
    enabled: !!presetId && open,
  });

  // Populate form when account changes or modal opens
  useEffect(() => {
    if (account && open) {
      setFormData({
        glNumber: account.gl_number || '',
        shortName: account.short_name || '',
        description: account.description || '',
        accountType: (account.account_type as any) === 'group' ? 'group' : 'detail',
        subledgerType: account.subledger_type || 'none',
        isOpenItemManaged: !!account.is_open_item_managed,
        isMulticurrency: !!account.is_multicurrency,
        currency: account.currency || (account.is_multicurrency ? 'ANY' : 'HUF'),
      });
    }
  }, [account, open]);

  // Check if account has children in existingAccounts
  const hasChildren = useMemo(() => {
    if (!account) return false;
    return existingAccounts.some(acc => acc.parent_id === account.id);
  }, [account, existingAccounts]);

  // Detect parent account
  const detectedParent = useMemo(() => {
    if (!account || !account.parent_id) return null;
    return existingAccounts.find(acc => acc.id === account.parent_id) || null;
  }, [account, existingAccounts]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!account?.id) throw new Error('Nem azonosítható a szerkesztendő főkönyvi szám!');
      if (!formData.shortName.trim()) throw new Error('A megnevezés megadása kötelező!');

      const effectiveCurrency = formData.isMulticurrency
        ? (formData.currency === 'ANY' ? null : formData.currency)
        : (formData.currency === 'HUF' ? 'HUF' : null);

      const payload = {
        short_name: formData.shortName.trim(),
        description: formData.description.trim() || null,
        account_type: formData.accountType,
        subledger_type: formData.subledgerType,
        is_open_item_managed: formData.isOpenItemManaged,
        is_multicurrency: formData.isMulticurrency,
        currency: effectiveCurrency,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('gl_accounts')
        .update(payload)
        .eq('id', account.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      if (companyId) {
        await invalidateGlQueries(queryClient, companyId, presetId);
      }
      await queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      await queryClient.invalidateQueries({ queryKey: ['glItems'] });
      await queryClient.invalidateQueries({ queryKey: ['general-ledger-tree'] });
      await queryClient.invalidateQueries({ queryKey: ['subledger'] });
      await queryClient.invalidateQueries({ queryKey: ['gl-accounts-lookup'] });

      toast({
        title: t('accounting:dialogs.edit_gl.success_title', 'Főkönyvi szám módosítva'),
        description: `${formData.glNumber} — ${formData.shortName} beállításai sikeresen frissültek.`,
        className: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100',
      });

      onSuccess?.(data);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: t('accounting:dialogs.edit_gl.error_title', 'Hiba a mentés során'),
        description: error.message || 'Nem sikerült menteni a módosításokat.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Edit3 className="h-5 w-5 text-primary" />
            <span>Főkönyvi szám szerkesztése: {formData.glNumber}</span>
          </DialogTitle>
          <DialogDescription>
            Módosítsa a főkönyvi szám megnevezését, jellegét, folyószámla és deviza paramétereit.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <GlAccountFormFields
            data={formData}
            onChange={(updates) => setFormData(prev => ({ ...prev, ...updates }))}
            isEditingGlNumber={true}
            detectedParent={detectedParent}
            hasChildren={hasChildren}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={updateMutation.isPending}
          >
            Mégse
          </Button>
          <Button
            type="button"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            <span>Módosítások mentése</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
