import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Trash2,
  Edit2,
  Play,
  Loader2,
  FileText,
  Percent,
  Building2,
  Globe,
  Sliders,
  Sparkles,
  ArrowRight,
  Search,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { fetchAllGlAccountsByPreset } from '@/lib/glData';

export interface InvoiceItemRule {
  id: string;
  company_id: string | null;
  user_id: string | null;
  name: string;
  description_pattern: string;
  pattern_type: 'contains' | 'exact' | 'regex';
  direction: 'INBOUND' | 'OUTBOUND' | 'ALL';
  partner_tax_number: string | null;
  partner_name: string | null;
  target_gl_number: string;
  target_gl_account_id: string | null;
  target_vat_code_id: string | null;
  target_vat_code: string | null;
  scope: 'company' | 'tenant' | 'global';
  is_active: boolean;
  priority: number;
  created_at: string;
}

export interface InvoiceRulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceRulesDialog({ open, onOpenChange }: InvoiceRulesDialogProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const { selectedCompany } = useCompany();
  const { session } = useAuth();
  const { activePresetId } = useActivePreset(selectedCompany?.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const companyId = selectedCompany?.id;

  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [editingRule, setEditingRule] = useState<InvoiceItemRule | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [applyingRules, setApplyingRules] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formPattern, setFormPattern] = useState('');
  const [formPatternType, setFormPatternType] = useState<'contains' | 'exact'>('contains');
  const [formDirection, setFormDirection] = useState<'INBOUND' | 'OUTBOUND' | 'ALL'>('ALL');
  const [formPartnerTax, setFormPartnerTax] = useState('');
  const [formPartnerName, setFormPartnerName] = useState('');
  const [formGlAccountId, setFormGlAccountId] = useState('');
  const [formVatCodeId, setFormVatCodeId] = useState('');
  const [formScope, setFormScope] = useState<'company' | 'tenant'>('company');
  const [saving, setSaving] = useState(false);

  // Fetch rules
  const { data: rules = [], isLoading: rulesLoading } = useQuery<InvoiceItemRule[]>({
    queryKey: ['invoice_item_rules', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('invoice_item_rules' as any)
        .select('*')
        .or(`company_id.eq.${companyId},scope.eq.tenant,scope.eq.global`)
        .order('priority', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as InvoiceItemRule[];
    },
    enabled: !!companyId && open,
  });

  // Fetch GL accounts
  const { data: glAccounts = [] } = useQuery({
    queryKey: ['glAccounts_rules_dialog', activePresetId],
    queryFn: async () => {
      if (!activePresetId) return [];
      return await fetchAllGlAccountsByPreset(activePresetId);
    },
    enabled: !!activePresetId && open,
  });

  // Fetch VAT codes
  const { data: vatCodes = [] } = useQuery<any[]>({
    queryKey: ['vat_codes_rules_dialog', companyId],
    queryFn: async (): Promise<any[]> => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('vat_codes' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('code', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!companyId && open,
  });

  const handleOpenCreate = () => {
    setEditingRule(null);
    setFormName('');
    setFormPattern('');
    setFormPatternType('contains');
    setFormDirection('ALL');
    setFormPartnerTax('');
    setFormPartnerName('');
    setFormGlAccountId('');
    setFormVatCodeId('');
    setFormScope('company');
    setViewMode('form');
  };

  const handleOpenEdit = (rule: InvoiceItemRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormPattern(rule.description_pattern);
    setFormPatternType(rule.pattern_type === 'exact' ? 'exact' : 'contains');
    setFormDirection(rule.direction);
    setFormPartnerTax(rule.partner_tax_number || '');
    setFormPartnerName(rule.partner_name || '');
    setFormGlAccountId(rule.target_gl_account_id || '');
    setFormVatCodeId(rule.target_vat_code_id || '');
    setFormScope(rule.scope === 'tenant' ? 'tenant' : 'company');
    setViewMode('form');
  };

  const handleToggleActive = async (ruleId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('invoice_item_rules' as any)
        .update({ is_active: !currentActive, updated_at: new Date().toISOString() })
        .eq('id', ruleId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['invoice_item_rules', companyId] });
    } catch (e: any) {
      toast({ title: 'Hiba a státusz módosításakor', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('invoice_item_rules' as any)
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      toast({ title: 'Szabály törölve' });
      queryClient.invalidateQueries({ queryKey: ['invoice_item_rules', companyId] });
    } catch (e: any) {
      toast({ title: 'Hiba a törléskor', description: e.message, variant: 'destructive' });
    }
  };

  const handleSaveForm = async () => {
    if (!formName.trim() || !formPattern.trim() || !companyId || !session?.user?.id) return;
    setSaving(true);
    try {
      const targetGlAccount = glAccounts.find((g: any) => g.id === formGlAccountId);
      const targetGlNumber = targetGlAccount?.gl_number || '';
      const targetVatCode = (vatCodes as any[]).find((v: any) => v.id === formVatCodeId);

      const payload: any = {
        name: formName.trim(),
        description_pattern: formPattern.trim(),
        pattern_type: formPatternType,
        direction: formDirection,
        partner_tax_number: formPartnerTax.trim() || null,
        partner_name: formPartnerName.trim() || null,
        target_gl_number: targetGlNumber,
        target_gl_account_id: formScope === 'company' ? (formGlAccountId || null) : null,
        target_vat_code_id: formVatCodeId || null,
        target_vat_code: targetVatCode?.code || null,
        scope: formScope,
        company_id: formScope === 'company' ? companyId : null,
        user_id: session.user.id,
        is_active: true,
        priority: 100,
        updated_at: new Date().toISOString(),
      };

      if (editingRule) {
        const { error } = await supabase
          .from('invoice_item_rules' as any)
          .update(payload)
          .eq('id', editingRule.id);
        if (error) throw error;
        toast({ title: 'Szabály sikeresen frissítve' });
      } else {
        const { error } = await supabase
          .from('invoice_item_rules' as any)
          .insert([payload]);
        if (error) throw error;
        toast({ title: 'Új szabály létrehozva' });
      }

      queryClient.invalidateQueries({ queryKey: ['invoice_item_rules', companyId] });
      setViewMode('list');
    } catch (e: any) {
      toast({ title: 'Mentési hiba', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyRules = async () => {
    if (!companyId || !activePresetId) return;
    setApplyingRules(true);
    try {
      const { data, error } = await (supabase.rpc as any)('apply_invoice_item_rules', {
        p_company_id: companyId,
        p_preset_id: activePresetId,
        p_user_id: session?.user?.id || null,
        p_only_unclassified: true,
      });

      if (error) throw error;

      const total = (data as any)?.total_updated || 0;
      toast({
        title: 'Szabályok alkalmazása befejeződött',
        description: total > 0
          ? `${total} számlatétel automatikusan besorolva a szabályok alapján.`
          : 'Nem található olyan besorolatlan számlatétel, amely megfelelt a szabályoknak.',
      });

      queryClient.invalidateQueries({ queryKey: ['invoiceItems'] });
      queryClient.invalidateQueries({ queryKey: ['glBalances'] });
      queryClient.invalidateQueries({ queryKey: ['glItems'] });
      queryClient.invalidateQueries({ queryKey: ['filteredNavInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] });
    } catch (e: any) {
      toast({ title: 'Hiba a szabályok futtatásakor', description: e.message, variant: 'destructive' });
    } finally {
      setApplyingRules(false);
    }
  };

  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description_pattern.toLowerCase().includes(q) ||
        r.target_gl_number.toLowerCase().includes(q) ||
        (r.target_vat_code && r.target_vat_code.toLowerCase().includes(q)) ||
        (r.partner_name && r.partner_name.toLowerCase().includes(q))
    );
  }, [rules, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-primary" />
              <DialogTitle className="text-lg font-bold">
                Számlakontírozási Szabályok
              </DialogTitle>
            </div>
            {viewMode === 'list' && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApplyRules}
                  disabled={applyingRules || rules.length === 0}
                  className="h-8 gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 min-w-[140px] tabular-nums"
                >
                  {applyingRules ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  Szabályok futtatása
                </Button>
                <Button
                  size="sm"
                  onClick={handleOpenCreate}
                  className="h-8 gap-1 text-xs bg-primary hover:bg-primary/90"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Új szabály
                </Button>
              </div>
            )}
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {viewMode === 'list'
              ? 'Automatikus tételszintű szabályok számlákhoz (főkönyvi szám és áfakód hozzárendelés).'
              : editingRule
              ? 'Számlaszabály szerkesztése'
              : 'Új számlakontírozási szabály létrehozása'}
          </DialogDescription>
        </DialogHeader>

        {viewMode === 'list' ? (
          <div className="flex-1 flex flex-col min-h-0 space-y-3 pt-2">
            <div className="relative flex-shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Keresés szabálynév, minta, főkönyvi szám vagy partner alapján..."
                className="pl-8 text-xs h-8"
              />
            </div>

            <ScrollArea className="flex-1 pr-3">
              {rulesLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="text-center p-8 border border-dashed rounded-lg text-muted-foreground space-y-2">
                  <Sparkles className="w-8 h-8 mx-auto opacity-40" />
                  <p className="text-xs font-medium">Nincs rögzített számlaszabály</p>
                  <p className="text-[11px]">
                    Kontírozz számlát a felületen a gyors szabálymentéshez, vagy hozz létre egy újat a fenti gombbal.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-3 rounded-lg border transition-colors flex items-center justify-between gap-3 ${
                        rule.is_active
                          ? 'bg-card border-border hover:border-primary/40'
                          : 'bg-muted/30 border-dashed border-border/60 opacity-60'
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-foreground truncate">
                            {rule.name}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-mono font-medium px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20"
                          >
                            {rule.target_gl_number}
                          </Badge>
                          {rule.target_vat_code && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono px-1.5 py-0 h-4 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                            >
                              ÁFA: {rule.target_vat_code}
                            </Badge>
                          )}
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1 py-0 h-3.5 text-muted-foreground flex items-center gap-1"
                          >
                            {rule.scope === 'tenant' ? (
                              <>
                                <Globe className="w-2.5 h-2.5 text-amber-500" /> Iroda
                              </>
                            ) : (
                              <>
                                <Building2 className="w-2.5 h-2.5" /> Cég
                              </>
                            )}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                          <span>
                            Minta: <code className="bg-muted px-1 rounded text-foreground font-mono">{rule.description_pattern}</code>
                          </span>
                          {rule.partner_name && (
                            <span>• Partner: {rule.partner_name}</span>
                          )}
                          <span>• Irány: {rule.direction === 'ALL' ? 'Összes' : rule.direction === 'INBOUND' ? 'Bejövő' : 'Kimenő'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={() => handleToggleActive(rule.id, rule.is_active)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => handleOpenEdit(rule)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pt-2 pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Szabály megnevezése</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="pl. Telekom számlák kontírozása"
                className="text-xs h-8"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Keresendő szövegminta a tétel leírásában</Label>
              <Input
                value={formPattern}
                onChange={(e) => setFormPattern(e.target.value)}
                placeholder="pl. Telekom, Üzemanyag, Előfizetés..."
                className="text-xs font-mono h-8"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Cél főkönyvi szám</Label>
                <select
                  value={formGlAccountId}
                  onChange={(e) => setFormGlAccountId(e.target.value)}
                  className="w-full text-xs h-8 rounded-md border border-input bg-background px-2 font-mono"
                >
                  <option value="">Válassz főkönyvi számot...</option>
                  {glAccounts.map((gl: any) => (
                    <option key={gl.id} value={gl.id}>
                      {gl.gl_number} - {gl.short_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Cél áfakód (opcionális)</Label>
                <select
                  value={formVatCodeId}
                  onChange={(e) => setFormVatCodeId(e.target.value)}
                  className="w-full text-xs h-8 rounded-md border border-input bg-background px-2 font-mono"
                >
                  <option value="">Nincs hozzárendelt áfakód</option>
                  {vatCodes.map((vc: any) => (
                    <option key={vc.id} value={vc.id}>
                      {vc.code} {vc.description ? `(${vc.description})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Számla iránya</Label>
                <select
                  value={formDirection}
                  onChange={(e: any) => setFormDirection(e.target.value)}
                  className="w-full text-xs h-8 rounded-md border border-input bg-background px-2"
                >
                  <option value="ALL">Összes számla (Bejövő & Kimenő)</option>
                  <option value="INBOUND">Csak Bejövő (Költség / Beszerzés)</option>
                  <option value="OUTBOUND">Csak Kimenő (Árbevétel / Értékesítés)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Illesztési típus</Label>
                <select
                  value={formPatternType}
                  onChange={(e: any) => setFormPatternType(e.target.value)}
                  className="w-full text-xs h-8 rounded-md border border-input bg-background px-2"
                >
                  <option value="contains">Tartalmazza (Részszó egyezés)</option>
                  <option value="exact">Pontos egyezés</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Partner szűrés (opcionális)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  value={formPartnerName}
                  onChange={(e) => setFormPartnerName(e.target.value)}
                  placeholder="Partner neve..."
                  className="text-xs h-8"
                />
                <Input
                  value={formPartnerTax}
                  onChange={(e) => setFormPartnerTax(e.target.value)}
                  placeholder="Partner adószáma..."
                  className="text-xs font-mono h-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Hatókör</Label>
              <RadioGroup
                value={formScope}
                onValueChange={(val: any) => setFormScope(val)}
                className="grid grid-cols-2 gap-2"
              >
                <div
                  className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer text-xs ${
                    formScope === 'company' ? 'bg-primary/5 border-primary/40 font-semibold' : 'border-border'
                  }`}
                  onClick={() => setFormScope('company')}
                >
                  <RadioGroupItem value="company" id="f-scope-company" className="mt-0.5" />
                  <label htmlFor="f-scope-company" className="cursor-pointer">
                    Csak ez a cég ({selectedCompany?.name || 'aktív cég'})
                  </label>
                </div>
                <div
                  className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer text-xs ${
                    formScope === 'tenant' ? 'bg-primary/5 border-primary/40 font-semibold' : 'border-border'
                  }`}
                  onClick={() => setFormScope('tenant')}
                >
                  <RadioGroupItem value="tenant" id="f-scope-tenant" className="mt-0.5" />
                  <label htmlFor="f-scope-tenant" className="cursor-pointer">
                    Könyvelőirodai (Minden cég)
                  </label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('list')}
                disabled={saving}
                className="text-xs"
              >
                Mégse
              </Button>
              <Button
                size="sm"
                onClick={handleSaveForm}
                disabled={!formName.trim() || !formPattern.trim() || saving}
                className="text-xs bg-primary hover:bg-primary/90 min-w-[140px] tabular-nums"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                {editingRule ? 'Módosítás mentése' : 'Szabály létrehozása'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
