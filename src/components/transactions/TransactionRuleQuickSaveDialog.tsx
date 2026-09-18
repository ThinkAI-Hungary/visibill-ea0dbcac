import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Sparkles, Building2, Globe, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useQueryClient } from '@tanstack/react-query';

interface TransactionRuleQuickSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: {
    id: string;
    description: string | null;
    amount: number;
    company_id?: string | null;
  } | null;
  glAccount: {
    id: string;
    gl_number: string;
    short_name: string;
  } | null;
  onRuleCreated?: () => void;
}

export function TransactionRuleQuickSaveDialog({
  open,
  onOpenChange,
  transaction,
  glAccount,
  onRuleCreated,
}: TransactionRuleQuickSaveDialogProps) {
  const { t } = useTranslation(['transactions', 'common']);
  const { session } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [ruleName, setRuleName] = useState('');
  const [pattern, setPattern] = useState('');
  const [scope, setScope] = useState<'company' | 'tenant'>('company');
  const [autoVerify, setAutoVerify] = useState(false);
  const [saving, setSaving] = useState(false);

  // Extract smart default keyword from description
  useEffect(() => {
    if (transaction?.description) {
      const raw = transaction.description.trim();
      let extracted = raw;

      if (/munkabér/i.test(raw)) {
        extracted = 'MUNKABÉR';
      } else if (/szép kártya/i.test(raw)) {
        extracted = 'SZÉP KÁRTYA';
      } else if (/nav/i.test(raw)) {
        // Prefer exact NAV tax name (e.g. "NAV TB járulék", "NAV SZJA 290", "NAV ÁFA")
        const match = raw.match(/NAV\s+[^,;\t]+/i) || raw.match(/10032000-\d+(-\d+)?/);
        extracted = match ? match[0].trim() : 'NAV';
      } else {
        // Look for Hungarian bank account numbers (e.g. 10032000-..., 11732064-...)
        const accMatch = raw.match(/\b\d{8}-\d{8}(-\d{8})?\b/);

        // Split by comma / semicolon / tab and clean up
        const parts = raw.split(/[,;\t]/).map(p => p.trim()).filter(Boolean);

        // Filter out bank technical codes and noise
        const filtered = parts.filter(p => {
          // Exclude transaction type labels
          if (/^(napközi|napkozbeni|napközbeni|azonnali|atutalas|átutalás|qvik|giro|bankon belüli|bankon belul)/i.test(p)) return false;
          // Exclude batch / technical IDs like F.9923, F.3200, MW_12345
          if (/^F\.\d+/i.test(p)) return false;
          if (/^MW_/i.test(p)) return false;
          // Exclude SWIFT BIC codes (e.g. OTPVHUHB, MKKBHUHB)
          if (/^[A-Z]{4}HU[A-Z0-9]{2,5}$/i.test(p)) return false;
          // Exclude bank tags like (2.)NOTPROVIDED, (5.)ADÓSZÁM..., (8.)KÖLCSÖN
          if (/^\(\d+\)/.test(p)) return false;
          if (/^(notprovided|ámb|amb|credtranid|latestdttm|n)$/i.test(p)) return false;
          // Exclude tax numbers like 13739830-2-03
          if (/^\d{8}-\d-\d{2}$/.test(p)) return false;
          // Exclude raw numeric transaction refs (e.g. 11732064202609149380371, dates 2026.09.14)
          if (/^\d{15,}$/.test(p)) return false;
          if (/^\d{4}\.\d{2}\.\d{2}$/.test(p)) return false;
          // Exclude account number if we want to prefer partner name in parts
          if (/^\d{8}-\d{8}(-\d{8})?$/.test(p) || /^\d{16,24}$/.test(p)) return false;
          // Exclude own company name if known
          if (selectedCompany?.name && p.toLowerCase() === selectedCompany.name.toLowerCase()) return false;
          return true;
        });

        // Prefer clean partner name from filtered list, fallback to account number, then first part
        extracted = filtered[0] || (accMatch ? accMatch[0] : parts[0] || raw.substring(0, 30));
      }

      setPattern(extracted);
      setRuleName(`${extracted} -> ${glAccount?.gl_number || ''}`);
    }
  }, [transaction, glAccount, selectedCompany?.name]);

  const handleSaveRule = async () => {
    if (!transaction || !glAccount || !session?.user?.id) return;
    setSaving(true);
    try {
      const direction = transaction.amount < 0 ? 'OUTFLOW' : transaction.amount > 0 ? 'INFLOW' : 'ALL';
      const companyId = scope === 'company' ? (transaction.company_id || selectedCompany?.id) : null;

      const newRule: any = {
        name: ruleName.trim() || t('transactions:quick_rule.rule_name_suffix', { pattern }),
        description_pattern: pattern.trim(),
        pattern_type: 'contains',
        direction,
        amount_min: null,
        amount_max: null,
        target_gl_account_id: scope === 'company' ? glAccount.id : null,
        target_gl_number: glAccount.gl_number,
        auto_verify: autoVerify,
        scope,
        user_id: session.user.id,
        company_id: companyId,
      };

      const { error } = await supabase.from('transaction_rules' as any).insert([newRule]);
      if (error) throw error;

      toast({
        title: t('transactions:quick_rule.toast_success_title'),
        description: scope === 'tenant'
          ? t('transactions:quick_rule.toast_success_tenant_desc')
          : t('transactions:quick_rule.toast_success_company_desc'),
      });

      queryClient.invalidateQueries({ queryKey: ['transaction_rules'] });
      if (onRuleCreated) onRuleCreated();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving quick rule:', err);
      toast({
        title: t('transactions:quick_rule.toast_error_title'),
        description: err.message || t('transactions:quick_rule.toast_error_desc'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!transaction || !glAccount) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-sm mb-1">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>{t('transactions:quick_rule.badge')}</span>
          </div>
          <DialogTitle className="text-base font-bold">
            {t('transactions:quick_rule.title')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('transactions:quick_rule.desc', {
              glNumber: glAccount.gl_number,
              glName: glAccount.short_name,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Pattern input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('transactions:quick_rule.pattern_label')}</Label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder={t('transactions:quick_rule.pattern_placeholder')}
              className="text-xs font-mono h-8"
            />
          </div>

          {/* Scope Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">{t('transactions:quick_rule.scope_label')}</Label>
            <RadioGroup
              value={scope}
              onValueChange={(val: any) => setScope(val)}
              className="grid grid-cols-1 gap-2"
            >
              <div
                className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  scope === 'company' ? 'bg-primary/5 border-primary/40' : 'bg-muted/20 border-border/60 hover:bg-muted/40'
                }`}
                onClick={() => setScope('company')}
              >
                <RadioGroupItem value="company" id="scope-company" className="mt-0.5" />
                <div className="space-y-0.5">
                  <label htmlFor="scope-company" className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{t('transactions:quick_rule.scope_company_title', { company: selectedCompany?.name || t('transactions:quick_rule.current_company') })}</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    {t('transactions:quick_rule.scope_company_desc')}
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  scope === 'tenant' ? 'bg-primary/5 border-primary/40' : 'bg-muted/20 border-border/60 hover:bg-muted/40'
                }`}
                onClick={() => setScope('tenant')}
              >
                <RadioGroupItem value="tenant" id="scope-tenant" className="mt-0.5" />
                <div className="space-y-0.5">
                  <label htmlFor="scope-tenant" className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                    <Globe className="w-3.5 h-3.5 text-amber-500" />
                    <span>{t('transactions:quick_rule.scope_tenant_title')}</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    {t('transactions:quick_rule.scope_tenant_desc', { glNumber: glAccount.gl_number })}
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Auto verify switch */}
          <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/40">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium cursor-pointer" htmlFor="auto-verify-switch">
                {t('transactions:quick_rule.auto_verify_title')}
              </Label>
              <p className="text-[10px] text-muted-foreground">
                {t('transactions:quick_rule.auto_verify_desc')}
              </p>
            </div>
            <Switch
              id="auto-verify-switch"
              checked={autoVerify}
              onCheckedChange={setAutoVerify}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-xs"
          >
            {t('transactions:quick_rule.cancel_btn')}
          </Button>
          <Button
            size="sm"
            onClick={handleSaveRule}
            disabled={!pattern.trim() || saving}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
            {t('transactions:quick_rule.save_btn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
