import React, { useState, useEffect } from 'react';
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
      // Look for keywords: if NAV, MUNKABÉR, SZÉP KÁRTYA, or partner name
      let extracted = raw;
      if (/munkabér/i.test(raw)) {
        extracted = 'MUNKABÉR';
      } else if (/szép kártya/i.test(raw)) {
        extracted = 'SZÉP KÁRTYA';
      } else if (/nav/i.test(raw)) {
        const match = raw.match(/NAV\s+[^,]+/i) || raw.match(/10032000-\d+/);
        extracted = match ? match[0] : 'NAV';
      } else {
        // Take the first or second segment before comma or take up to 30 chars
        const parts = raw.split(/[,;\t]/).map(p => p.trim()).filter(Boolean);
        extracted = parts[1] || parts[0] || raw.substring(0, 30);
      }

      setPattern(extracted);
      setRuleName(`${extracted} -> ${glAccount?.gl_number || ''}`);
    }
  }, [transaction, glAccount]);

  const handleSaveRule = async () => {
    if (!transaction || !glAccount || !session?.user?.id) return;
    setSaving(true);
    try {
      const direction = transaction.amount < 0 ? 'OUTFLOW' : transaction.amount > 0 ? 'INFLOW' : 'ALL';
      const companyId = scope === 'company' ? (transaction.company_id || selectedCompany?.id) : null;

      const newRule: any = {
        name: ruleName.trim() || `${pattern} szabály`,
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
        title: 'Könyvelési szabály elmentve!',
        description: scope === 'tenant'
          ? `A szabály mostantól minden általad kezelt cégnél automatikusan érvényesül.`
          : `A szabály a jövőbeli bankkivonatoknál automatikusan kontírozni fogja az azonos tételeket.`,
      });

      queryClient.invalidateQueries({ queryKey: ['transaction_rules'] });
      if (onRuleCreated) onRuleCreated();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving quick rule:', err);
      toast({
        title: 'Hiba a szabály mentésekor',
        description: err.message || 'Ismeretlen hiba történt.',
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
            <span>Automatikus könyvelési szabály</span>
          </div>
          <DialogTitle className="text-base font-bold">
            Szeretnéd automatizálni a jövőbeli hasonló tételeket?
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            A rendszer a következő bankkivonat importálásakor automatikusan a(z){' '}
            <strong className="text-foreground font-mono">{glAccount.gl_number} {glAccount.short_name}</strong>{' '}
            főkönyvi számra fogja kontírozni a megfelelő tranzakciókat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Pattern input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Illeszkedő szövegrészlet a leírásból:</Label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="pl. MUNKABÉR, NAV ÁFA..."
              className="text-xs font-mono h-8"
            />
          </div>

          {/* Scope Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Szabály érvényessége (Hatókör):</Label>
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
                    <span>Csak ennél a cégnél ({selectedCompany?.name || 'Aktuális cég'})</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    Kizárólag ennek a cégnek a bankszámláira vonatkozik.
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
                    <span>Minden általam kezelt cégnél (Könyvelőirodai szabály)</span>
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    A mostani és a jövőben nyitott összes cégednél automatikusan erre a főkönyvi számra ({glAccount.gl_number}) kontírozódik!
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Auto verify switch */}
          <div className="flex items-center justify-between p-2 rounded-md bg-muted/20 border border-border/40">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium cursor-pointer" htmlFor="auto-verify-switch">
                Automatikus jóváhagyás
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Egyezés esetén azonnal lekönyvelt státuszba helyezi a tételt.
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
            Most nem, csak ezt a tételt
          </Button>
          <Button
            size="sm"
            onClick={handleSaveRule}
            disabled={!pattern.trim() || saving}
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Check className="w-3.5 h-3.5 mr-1" />}
            Szabály mentése
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
