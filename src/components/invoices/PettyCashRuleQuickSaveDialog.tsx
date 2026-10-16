import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Wallet, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

export interface PettyCashRuleQuickSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  partnerName: string;
  partnerTaxNumber?: string | null;
  targetRegisterId: string;
  targetRegisterName: string;
  direction?: 'INBOUND' | 'OUTBOUND' | null;
  onRuleCreated?: () => void;
}

export function PettyCashRuleQuickSaveDialog({
  open,
  onOpenChange,
  companyId,
  partnerName,
  partnerTaxNumber,
  targetRegisterId,
  targetRegisterName,
  direction,
  onRuleCreated,
}: PettyCashRuleQuickSaveDialogProps) {
  const { t } = useTranslation(['invoices', 'pettyCash', 'common']);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [pattern, setPattern] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && partnerName) {
      setPattern(partnerName.trim());
    }
  }, [open, partnerName]);

  const handleSave = async () => {
    if (!pattern.trim()) {
      toast({
        title: t('common:error', 'Hiba'),
        description: t('invoices:rules.pattern_required', 'A partner minta kitöltése kötelező.'),
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc('create_petty_cash_routing_rule', {
        p_company_id: companyId,
        p_target_register_id: targetRegisterId,
        p_partner_pattern: pattern.trim(),
        p_source_type: 'invoice',
        p_priority: 10,
      });

      if (error) throw error;

      toast({
        title: t('invoices:rules.rule_created', 'Pénztár szabály létrehozva'),
        description: t('invoices:rules.rule_created_desc', {
          partner: pattern.trim(),
          register: targetRegisterName,
          defaultValue: `A(z) ${pattern.trim()} készpénzes számlái ezentúl a(z) ${targetRegisterName} pénztárba kerülnek.`,
        }),
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.pettyCashRoutingRules(companyId) });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['navInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoiceItems'] });

      onOpenChange(false);
      onRuleCreated?.();
    } catch (err: any) {
      toast({
        title: t('common:error', 'Hiba történt'),
        description: err.message || t('common:unknown_error', 'Ismeretlen hiba'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <DialogTitle>{t('invoices:rules.petty_cash_rule_title', 'Automatikus pénztár szabály mentése')}</DialogTitle>
          </div>
          <DialogDescription>
            {t(
              'invoices:rules.petty_cash_rule_desc',
              'Szeretnéd szabályként elmenteni ezt a pénztár hozzárendelést, hogy a jövőbeli számlák automatikusan ide kerüljenek?'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Target Register Summary Box */}
          <div className="p-3 rounded-lg border bg-muted/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-500 shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground">{t('invoices:rules.target_register', 'Cél pénztár')}</div>
                <div className="text-sm font-semibold text-foreground">{targetRegisterName}</div>
              </div>
            </div>
            {direction && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-background border">
                {direction === 'OUTBOUND'
                  ? t('invoices:direction_outbound', 'Kimenő számla')
                  : t('invoices:direction_inbound', 'Bejövő számla')}
              </span>
            )}
          </div>

          {/* Partner Pattern Input */}
          <div className="space-y-1.5">
            <Label htmlFor="partner-pattern" className="text-xs font-medium">
              {t('invoices:rules.partner_pattern_label', 'Partner neve (szűrési minta)')}
            </Label>
            <Input
              id="partner-pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={t('invoices:rules.partner_pattern_placeholder', 'pl. Partner Kft.')}
              className="text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {t(
                'invoices:rules.partner_pattern_help',
                'Minden olyan készpénzes számla, amely tartalmazza ezt a nevet, automatikusan ehhez a pénztárhoz fog tartozni.'
              )}
            </p>
          </div>

          {/* Rule Scope Info Box */}
          <div className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/20 text-xs text-muted-foreground flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>
              {t(
                'invoices:rules.scope_partner_all_cash',
                'A szabály mentése után a partner minden új vagy meglévő, még pénztárhoz nem rendelt készpénzes számlája automatikusan ehhez a pénztárhoz fog tartozni.'
              )}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t('common:cancel', 'Mégse')}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !pattern.trim()}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {t('invoices:rules.save_rule', 'Szabály mentése')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
