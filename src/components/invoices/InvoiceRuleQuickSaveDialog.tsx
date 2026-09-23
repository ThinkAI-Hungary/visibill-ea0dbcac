import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Sparkles, Building2, Globe, Loader2, Check, Percent, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { useQueryClient } from '@tanstack/react-query';

export interface InvoiceRuleQuickSaveItem {
  id: string;
  line_description: string | null;
  direction?: 'INBOUND' | 'OUTBOUND' | 'ALL';
  partner_tax_number?: string | null;
  partner_name?: string | null;
  company_id?: string | null;
}

export interface InvoiceRuleQuickSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InvoiceRuleQuickSaveItem | null;
  glAccount: {
    id?: string | null;
    gl_number: string;
    short_name?: string;
  } | null;
  vatCode?: {
    id?: string | null;
    code: string;
  } | null;
  onRuleCreated?: () => void;
}

export function InvoiceRuleQuickSaveDialog({
  open,
  onOpenChange,
  item,
  glAccount,
  vatCode,
  onRuleCreated,
}: InvoiceRuleQuickSaveDialogProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const { session } = useAuth();
  const { selectedCompany } = useCompany();
  const { activePresetId } = useActivePreset(selectedCompany?.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [ruleName, setRuleName] = useState('');
  const [pattern, setPattern] = useState('');
  const [scope, setScope] = useState<'company' | 'tenant'>('company');
  const [includeVatCode, setIncludeVatCode] = useState(false);
  const [isPartnerSpecific, setIsPartnerSpecific] = useState(false);
  const [applyImmediately, setApplyImmediately] = useState(true);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [saving, setSaving] = useState(false);

  // Extract clean keyword from line_description
  useEffect(() => {
    if (item?.line_description) {
      const raw = item.line_description.trim();

      // Clean common invoice line noise (e.g. "1 db", "2.00 óra", "Cikkszám: 12345", leading numbers)
      let cleaned = raw
        .replace(/^\d+[\.\)]\s*/, '') // leading numbering like "1. " or "1) "
        .replace(/\b\d+([,\.]\d+)?\s*(db|darab|óra|ora|hó|ho|kg|m|csomag|alkalom)\b/gi, '') // units
        .replace(/\b(cikkszám|art\.?nr\.?|sku)[:\s]*[a-z0-9\-_]+/gi, '') // item codes
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (!cleaned || cleaned.length < 3) {
        cleaned = raw.substring(0, 40);
      }

      setPattern(cleaned);
      setRuleName(`${cleaned} -> ${glAccount?.gl_number || ''}`);
      setIncludeVatCode(Boolean(vatCode?.code));
      setIsPartnerSpecific(false);
    }
  }, [item, glAccount, vatCode]);

  const isDismissingRef = React.useRef(false);

  useEffect(() => {
    if (open) {
      isDismissingRef.current = false;
    }
  }, [open]);

  const handleDismissWithoutRule = () => {
    if (isDismissingRef.current) return;
    isDismissingRef.current = true;
    if (dontAskAgain) {
      sessionStorage.setItem('suppress_invoice_rule_prompt', 'true');
    }
    toast({
      title: 'Tétel besorolása frissítve',
      description: `A számlatétel rögzítve a(z) ${glAccount?.gl_number} számlaszámra (szabály létrehozása nélkül).`,
    });
    onOpenChange(false);
    setTimeout(() => {
      isDismissingRef.current = false;
    }, 400);
  };

  const handleSaveRule = async () => {
    if (!item || !glAccount || !session?.user?.id) return;
    setSaving(true);
    try {
      const companyId = scope === 'company' ? (item.company_id || selectedCompany?.id) : null;
      const direction = item.direction || 'ALL';

      const partnerTax = isPartnerSpecific ? (item.partner_tax_number || null) : null;
      const partnerName = isPartnerSpecific ? (item.partner_name || null) : null;

      const newRule: any = {
        name: ruleName.trim() || `${pattern} -> ${glAccount.gl_number}`,
        description_pattern: pattern.trim(),
        pattern_type: 'contains',
        direction,
        partner_tax_number: partnerTax,
        partner_name: partnerName,
        target_gl_account_id: scope === 'company' ? (glAccount.id || null) : null,
        target_gl_number: glAccount.gl_number,
        target_vat_code_id: (includeVatCode && vatCode?.id) ? vatCode.id : null,
        target_vat_code: (includeVatCode && vatCode?.code) ? vatCode.code : null,
        scope,
        user_id: session.user.id,
        company_id: companyId,
        is_active: true,
        priority: 100,
      };

      const { error } = await supabase
        .from('invoice_item_rules' as any)
        .insert([newRule]);

      if (error) throw error;

      let backfillMsg = '';
      if (applyImmediately && selectedCompany?.id && activePresetId) {
        const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('apply_invoice_item_rules', {
          p_company_id: selectedCompany.id,
          p_preset_id: activePresetId,
          p_user_id: session.user.id,
          p_only_unclassified: true,
        });

        if (!rpcError && rpcData && typeof rpcData === 'object') {
          const total = (rpcData as any).total_updated || 0;
          if (total > 0) {
            backfillMsg = ` (${total} meglévő számlatétel automatikusan besorolva)`;
          }
        }
      }

      if (dontAskAgain) {
        sessionStorage.setItem('suppress_invoice_rule_prompt', 'true');
      }

      toast({
        title: 'Szabály elmentve és tétel besorolva',
        description: (scope === 'tenant'
          ? `A szabály az iroda összes kezelt cégénél érvényesül a jövőbeli számlákra (${glAccount.gl_number}).`
          : `A szabály elmentve a(z) ${selectedCompany?.name || 'cég'} számláihoz (${glAccount.gl_number}).`) + backfillMsg,
      });

      queryClient.invalidateQueries({ queryKey: ['invoice_item_rules'] });
      queryClient.invalidateQueries({ queryKey: ['invoiceItems'] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      queryClient.invalidateQueries({ queryKey: ['filteredNavInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] });

      if (onRuleCreated) onRuleCreated();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving invoice item rule:', err);
      toast({
        title: 'Szabály mentési hiba',
        description: err.message || 'Nem sikerült elmenteni a számlaszabályt.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!item || !glAccount) return null;

  return (
    <Dialog open={open} onOpenChange={(newOpen) => { if (!newOpen && !saving) handleDismissWithoutRule(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-1">
            <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
            <span className="uppercase tracking-wider">Számlakontírozási Szabály</span>
          </div>
          <DialogTitle className="text-base font-bold">
            Szeretnél könyvelési szabályt létrehozni a jövőbeli tételekhez?
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            A számlatétel módosítása sikeresen megtörtént. Szeretnéd, hogy a rendszer a megadott megnevezés alapján a jövőben érkező hasonló tételeket is automatikusan a(z) <span className="font-semibold text-foreground">{glAccount.gl_number}</span> ({glAccount.short_name || 'főkönyvi szám'}) alá sorolja?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Pattern input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Keresendő szövegminta a tétel megnevezésében</Label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="pl. Üzemanyag, Könyvelési díj, Licenc..."
              className="text-xs font-mono h-8"
            />
            <p className="text-[11px] text-muted-foreground">
              Ha a számlasor leírása tartalmazza ezt a szöveget, a szabály automatikusan érvényesül.
            </p>
          </div>

          {/* GL and VAT Badges */}
          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/50">
            <div className="space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <FileText className="w-3 h-3 text-primary" /> Főkönyvi szám
              </span>
              <p className="text-xs font-bold font-mono text-foreground">
                {glAccount.gl_number} <span className="text-[11px] font-normal text-muted-foreground">({glAccount.short_name})</span>
              </p>
            </div>
            {vatCode && (
              <div className="space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Percent className="w-3 h-3 text-emerald-500" /> Cél áfakód
                </span>
                <p className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {vatCode.code}
                </p>
              </div>
            )}
          </div>

          {/* Include VAT Code Switch (if available) */}
          {vatCode && (
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium cursor-pointer" htmlFor="include-vat-switch">
                  Áfakód rögzítése a szabályban ({vatCode.code})
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  A főkönyvi szám mellett a megadott áfakódot is automatikusan hozzárendeli a tételhez.
                </p>
              </div>
              <Switch
                id="include-vat-switch"
                checked={includeVatCode}
                onCheckedChange={setIncludeVatCode}
              />
            </div>
          )}

          {/* Partner Specific Filter Checkbox */}
          {(item.partner_name || item.partner_tax_number) && (
            <div className="flex items-start gap-2.5 p-2 rounded-md border border-border/40 bg-muted/10">
              <Checkbox
                id="partner-specific-check"
                checked={isPartnerSpecific}
                onCheckedChange={(checked) => setIsPartnerSpecific(Boolean(checked))}
                className="mt-0.5"
              />
              <div className="space-y-0.5 leading-none">
                <label
                  htmlFor="partner-specific-check"
                  className="text-xs font-medium cursor-pointer leading-tight block"
                >
                  Csak ennél a partnernél érvényesüljön
                </label>
                <p className="text-[11px] text-muted-foreground">
                  {item.partner_name || 'Ismeretlen partner'} ({item.partner_tax_number || 'Adószám nélkül'})
                </p>
              </div>
            </div>
          )}

          {/* Scope Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Szabály érvényességi hatóköre</Label>
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
                <RadioGroupItem value="company" id="scope-company-inv" className="mt-0.5" />
                <div className="space-y-0.5">
                  <label htmlFor="scope-company-inv" className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Csak a(z) {selectedCompany?.name || 'kiválasztott cég'} számláin</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    A szabály kizárólag ennél a konkrét cégnél hajtódik végre.
                  </p>
                </div>
              </div>

              <div
                className={`flex items-start gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  scope === 'tenant' ? 'bg-primary/5 border-primary/40' : 'bg-muted/20 border-border/60 hover:bg-muted/40'
                }`}
                onClick={() => setScope('tenant')}
              >
                <RadioGroupItem value="tenant" id="scope-tenant-inv" className="mt-0.5" />
                <div className="space-y-0.5">
                  <label htmlFor="scope-tenant-inv" className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                    <Globe className="w-3.5 h-3.5 text-amber-500" />
                    <span>Könyvelőirodai sablon (Minden kezelt cégemnél)</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    A szabály az Ön által könyvelt összes cégnél a(z) {glAccount.gl_number} főkönyvi számra kontíroz.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Apply Immediately Switch */}
          <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/40">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium cursor-pointer" htmlFor="apply-immediately-switch">
                Azonnali alkalmazás a még besorolatlan tételekre
              </Label>
              <p className="text-[10px] text-muted-foreground">
                A mentés után ráfuttatja a szabályt az aktuális időszak számlatételeire.
              </p>
            </div>
            <Switch
              id="apply-immediately-switch"
              checked={applyImmediately}
              onCheckedChange={setApplyImmediately}
            />
          </div>

          {/* Don't ask again during this session */}
          <div className="flex items-center space-x-2 pt-2 border-t border-border/40">
            <Checkbox
              id="dont-ask-again-inv"
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(Boolean(checked))}
            />
            <Label
              htmlFor="dont-ask-again-inv"
              className="text-xs text-muted-foreground cursor-pointer font-normal leading-tight select-none"
            >
              Ne kérdezzen rá automatikusan a szabálymentésre a további tételeknél (ebben a munkamenetben)
            </Label>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismissWithoutRule}
            disabled={saving}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Nem kérek szabályt (csak tétel mentése)
          </Button>
          <Button
            size="sm"
            onClick={handleSaveRule}
            disabled={!pattern.trim() || saving}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium min-w-[140px] tabular-nums"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
            Szabály mentése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
