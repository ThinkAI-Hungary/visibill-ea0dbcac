import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Building2, Globe2, FileCheck2, Loader2, Sparkles } from 'lucide-react';
import type { RuleScopeOption, RuleToCreate, PostingItem } from '../types';

interface PostingRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  approvedItems: PostingItem[];
  isSubmitting: boolean;
  onConfirm: (ruleScope: RuleScopeOption, rulesToCreate: RuleToCreate[]) => Promise<void>;
}

export function PostingRuleDialog({
  open,
  onOpenChange,
  approvedItems,
  isSubmitting,
  onConfirm,
}: PostingRuleDialogProps) {
  const [selectedScope, setSelectedScope] = useState<RuleScopeOption>('company');

  // Generate candidate rules from approved items (extract clean patterns)
  const candidateRules = React.useMemo(() => {
    const rulesMap = new Map<string, RuleToCreate>();

    approvedItems.forEach((item) => {
      if (!item.suggested_gl_account_id || !item.suggested_gl_number) return;
      if (item.suggested_gl_number === 'UNCLASSIFIED') return;

      // Clean description pattern (extract the main keyword or trimmed name)
      const cleanPattern = (item.line_description || item.invoice_number || '')
        .replace(/[0-9]{4,}/g, '') // remove invoice numbers or long IDs
        .replace(/[#\-_/]/g, ' ')
        .trim();

      const pattern = cleanPattern.length >= 3 ? cleanPattern.slice(0, 60) : item.line_description;
      if (!pattern) return;

      const key = `${pattern}__${item.suggested_gl_number}__${item.partner_tax_number || ''}`;
      if (!rulesMap.has(key)) {
        rulesMap.set(key, {
          description_pattern: pattern,
          partner_name: item.partner_name,
          partner_tax_number: item.partner_tax_number || undefined,
          target_gl_account_id: item.suggested_gl_account_id,
          target_gl_number: item.suggested_gl_number,
          target_vat_code_id: undefined,
          target_vat_code: item.vat_code || undefined,
          direction: item.invoice_direction || 'ALL',
          name: `Szabály: ${pattern}`,
        });
      }
    });

    return Array.from(rulesMap.values());
  }, [approvedItems]);

  const handleConfirm = async () => {
    const rulesToSend = selectedScope === 'none' ? [] : candidateRules;
    await onConfirm(selectedScope, rulesToSend);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary font-semibold text-xs mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Köteg véglegesítése és Szabálytanulás</span>
          </div>
          <DialogTitle className="text-xl">Könyvelési Szabálykészítés</DialogTitle>
          <DialogDescription>
            {approvedItems.length} tétel jóváhagyása történik meg. Válassz, hogy szeretnél-e
            automatikus szabályt létrehozni a jövőbeli számlák gyorsabb kontírozásához!
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-4">
          <RadioGroup
            value={selectedScope}
            onValueChange={(val) => setSelectedScope(val as RuleScopeOption)}
            className="gap-3"
          >
            {/* Opció 1: Céges szabály */}
            <div
              onClick={() => setSelectedScope('company')}
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                selectedScope === 'company'
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                  : 'border-border/70 hover:bg-accent/30'
              }`}
            >
              <RadioGroupItem value="company" id="rule-scope-company" className="mt-1" />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="rule-scope-company"
                  className="font-semibold text-sm cursor-pointer flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4 text-primary" />
                  Szabály készítése erre a cégre (Ajánlott)
                </Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A jóváhagyott párosításokból automatikus számlaszabály jön létre ehhez a céghez.
                  A jövőben beérkező hasonló tételek automatikusan a kiválasztott kontírszámra kerülnek.
                </p>
              </div>
            </div>

            {/* Opció 2: Irodai szintű szabály */}
            <div
              onClick={() => setSelectedScope('tenant')}
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                selectedScope === 'tenant'
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                  : 'border-border/70 hover:bg-accent/30'
              }`}
            >
              <RadioGroupItem value="tenant" id="rule-scope-tenant" className="mt-1" />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="rule-scope-tenant"
                  className="font-semibold text-sm cursor-pointer flex items-center gap-2"
                >
                  <Globe2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Szabály készítése az összes általunk könyvelt cégre
                </Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Irodai szintű szabály jön létre, amely az összes kezelt vállalkozás jövőbeli számláinál
                  érvényesül (pl. Telekom, Google, bankköltség standard számlák).
                </p>
              </div>
            </div>

            {/* Opció 3: Egyszeri kontírozás szabály nélkül */}
            <div
              onClick={() => setSelectedScope('none')}
              className={`flex items-start gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                selectedScope === 'none'
                  ? 'border-primary bg-primary/5 dark:bg-primary/10 shadow-sm'
                  : 'border-border/70 hover:bg-accent/30'
              }`}
            >
              <RadioGroupItem value="none" id="rule-scope-none" className="mt-1" />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="rule-scope-none"
                  className="font-semibold text-sm cursor-pointer flex items-center gap-2"
                >
                  <FileCheck2 className="w-4 h-4 text-muted-foreground" />
                  Csak ezen tételek kontírozása szabály nélkül
                </Label>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A tételek véglegesen lekönyvelődnek a beállított főkönyvi számra, de a rendszer nem hoz
                  létre új automatikus szabályt.
                </p>
              </div>
            </div>
          </RadioGroup>

          {selectedScope !== 'none' && candidateRules.length > 0 && (
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50 text-xs text-muted-foreground">
              💡 <strong>{candidateRules.length} új szabályminta</strong> kerül rögzítésre a jóváhagyott
              tételekből.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Mégse
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="min-w-[160px] gap-2 tabular-nums"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Véglegesítés...
              </>
            ) : (
              'Könyvelés véglegesítése'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
