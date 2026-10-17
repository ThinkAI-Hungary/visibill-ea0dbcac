import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Check, Edit3, GitFork } from 'lucide-react';
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
  requires_partner?: boolean;
  requires_project?: boolean;
  requires_cost_center?: boolean;
  is_reconcilable?: boolean;
  is_monthly_fx_reval?: boolean;
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
    requiresPartner: false,
    requiresProject: false,
    requiresCostCenter: false,
    isReconcilable: false,
    isMonthlyFxReval: false,
  });

  const [cascadeToChildren, setCascadeToChildren] = useState(false);

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
      const cleanNum = account.gl_number?.replace(/\.$/, '') || '';
      const isSyntheticGroup = (account.account_type as any) === 'group' || cleanNum.length <= 3;

      setFormData({
        glNumber: account.gl_number || '',
        shortName: account.short_name || '',
        description: account.description || '',
        accountType: isSyntheticGroup ? 'group' : 'detail',
        subledgerType: account.subledger_type || (account.requires_partner ? 'partner' : 'none'),
        isOpenItemManaged: !!account.is_open_item_managed || !!account.is_reconcilable,
        isMulticurrency: !!account.is_multicurrency,
        currency: account.currency || (account.is_multicurrency ? 'ANY' : 'HUF'),
        requiresPartner: !!account.requires_partner,
        requiresProject: !!account.requires_project,
        requiresCostCenter: !!account.requires_cost_center,
        isReconcilable: !!account.is_reconcilable || !!account.is_open_item_managed,
        isMonthlyFxReval: !!account.is_monthly_fx_reval,
      });

      // Default cascadeToChildren to true if editing a group account
      setCascadeToChildren(isSyntheticGroup);
    }
  }, [account, open]);

  // Check if account has children in existingAccounts
  const hasChildren = useMemo(() => {
    if (!account) return false;
    const cleanNum = account.gl_number.replace(/\.$/, '');
    return existingAccounts.some(acc => acc.parent_id === account.id || (acc.gl_number.startsWith(cleanNum) && acc.id !== account.id));
  }, [account, existingAccounts]);

  // Detect parent account
  const detectedParent = useMemo(() => {
    if (!account || !account.parent_id) return null;
    return existingAccounts.find(acc => acc.id === account.parent_id) || null;
  }, [account, existingAccounts]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      let targetAccountId = account?.id;
      if (!targetAccountId || targetAccountId.length < 10) {
        const cleanNum = (account?.gl_number || formData.glNumber).replace(/\.$/, '');
        const found = existingAccounts.find(a => a.gl_number === cleanNum || a.gl_number === `${cleanNum}.`);
        if (found) {
          targetAccountId = found.id;
        } else if (presetId) {
          const { data: dbAcc } = await supabase
            .from('gl_accounts')
            .select('id')
            .eq('preset_id', presetId)
            .or(`gl_number.eq.${cleanNum},gl_number.eq.${cleanNum}.`)
            .maybeSingle();
          if (dbAcc) targetAccountId = dbAcc.id;
        }
      }

      if (!targetAccountId) throw new Error('Nem azonosítható a szerkesztendő főkönyvi szám az adatbázisban!');
      if (!formData.shortName.trim()) throw new Error('A megnevezés megadása kötelező!');

      const effectiveCurrency = formData.isMulticurrency
        ? (formData.currency === 'ANY' ? null : formData.currency)
        : (formData.currency === 'HUF' ? 'HUF' : null);

      const payload = {
        short_name: formData.shortName.trim(),
        description: formData.description.trim() || null,
        account_type: formData.accountType,
        subledger_type: formData.subledgerType,
        is_open_item_managed: formData.isOpenItemManaged || formData.isReconcilable,
        is_multicurrency: formData.isMulticurrency,
        currency: effectiveCurrency,
        requires_partner: formData.requiresPartner,
        requires_project: formData.requiresProject,
        requires_cost_center: formData.requiresCostCenter,
        is_reconcilable: formData.isReconcilable || formData.isOpenItemManaged,
        is_monthly_fx_reval: formData.isMonthlyFxReval,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('gl_accounts')
        .update(payload)
        .eq('id', targetAccountId)
        .select()
        .single();

      if (error) throw error;

      let cascadedCount = 0;
      if (cascadeToChildren && (account?.account_type === 'group' || hasChildren)) {
        const { data: cCount, error: cErr } = await (supabase.rpc as any)('acc_cascade_gl_account_settings', {
          p_account_id: targetAccountId,
          p_company_id: companyId || targetAccountId,
          p_requires_partner: formData.requiresPartner,
          p_requires_project: formData.requiresProject,
          p_requires_cost_center: formData.requiresCostCenter,
          p_is_reconcilable: formData.isReconcilable || formData.isOpenItemManaged,
          p_is_monthly_fx_reval: formData.isMonthlyFxReval,
        });

        if (!cErr && typeof cCount === 'number') {
          cascadedCount = cCount;
        }
      }

      return { data, cascadedCount };
    },
    onSuccess: async (result) => {
      if (companyId) {
        await invalidateGlQueries(queryClient, companyId, presetId);
      }
      await queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      await queryClient.invalidateQueries({ queryKey: ['glItems'] });
      await queryClient.invalidateQueries({ queryKey: ['general-ledger-tree'] });
      await queryClient.invalidateQueries({ queryKey: ['subledger'] });
      await queryClient.invalidateQueries({ queryKey: ['gl-accounts-lookup'] });
      await queryClient.invalidateQueries({ queryKey: ['glAccountCardItems'] });

      const cascadeNote = result.cascadedCount > 0 
        ? ` (${result.cascadedCount} alszámlára örökítve)`
        : '';

      toast({
        title: t('accounting:dialogs.edit_gl.success_title', 'Főkönyvi szám módosítva'),
        description: `${formData.glNumber} — ${formData.shortName} beállításai sikeresen frissültek${cascadeNote}.`,
        className: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100',
      });

      onSuccess?.(result.data);
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
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Edit3 className="h-5 w-5 text-primary" />
            <span>Főkönyvi szám szerkesztése: {formData.glNumber}</span>
          </DialogTitle>
          <DialogDescription>
            Módosítsa a főkönyvi szám megnevezését, kötelező mezőit, devizanemét és párosítási szabályait.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <GlAccountFormFields
            data={formData}
            onChange={(updates) => setFormData(prev => ({ ...prev, ...updates }))}
            isEditingGlNumber={true}
            detectedParent={detectedParent}
            hasChildren={hasChildren}
          />

          {/* Hierarchical Cascading Banner for Group Accounts */}
          {(formData.accountType === 'group' || hasChildren) && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <GitFork className="h-4 w-4 text-primary shrink-0" />
                <span>Beállítások csoportszintű öröklődése</span>
              </div>
              <label htmlFor="cascade-check" className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  id="cascade-check"
                  checked={cascadeToChildren}
                  onCheckedChange={(checked) => setCascadeToChildren(!!checked)}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-foreground block">
                    Beállítások automatikus érvényesítése a(z) <strong className="font-mono">{formData.glNumber}</strong> alatti összes analitikus alszámlán is
                  </span>
                  <span className="text-[11px] text-muted-foreground block leading-tight">
                    Jóváhagyáskor a módosított szabályok (partnerkényszer, projektkényszer, devizaátértékelés, párosítás) kötegelten lefutnak minden gyermek-számlára.
                  </span>
                </div>
              </label>
            </div>
          )}
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
            className="gap-2 bg-primary text-primary-foreground"
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
