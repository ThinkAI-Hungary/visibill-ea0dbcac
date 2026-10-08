import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calculator, Info, Scale } from 'lucide-react';
import { GlAccountCombobox } from './GlAccountCombobox';
import type { AutoAccountingRules, GlAccountOption } from '@/hooks/useAutoAccountingRules';

interface RoundingRulesCardProps {
  rules: AutoAccountingRules;
  onChange: (field: keyof AutoAccountingRules, value: any) => void;
  accounts: GlAccountOption[];
  disabled?: boolean;
}

export const RoundingRulesCard: React.FC<RoundingRulesCardProps> = ({
  rules,
  onChange,
  accounts,
  disabled = false,
}) => {
  return (
    <Card className="border-border/60 shadow-sm bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              3. Kerekítési Különbözet Paraméterezése
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Folyószámla párosítás és bizonylat-kiegyenlítés során keletkező filléres forintkülönbözetek elszámolása.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        <div className="bg-muted/20 p-3.5 rounded-lg border border-border/40 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Nyereség főkönyvi szám <span className="text-muted-foreground font-mono text-[11px]">(pl. 9699 – Kerekítési különbözet)</span>
              </Label>
              <GlAccountCombobox
                value={rules.rounding_gain_gl_id}
                onChange={(val) => onChange('rounding_gain_gl_id', val)}
                accounts={accounts}
                recommendedNumbers={['9699', '969']}
                disabled={disabled}
                placeholder="Válassz kerekítési bevétel számlát..."
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground">
                Veszteség főkönyvi szám <span className="text-muted-foreground font-mono text-[11px]">(pl. 8699 – Kerekítési különbözet)</span>
              </Label>
              <GlAccountCombobox
                value={rules.rounding_loss_gl_id}
                onChange={(val) => onChange('rounding_loss_gl_id', val)}
                accounts={accounts}
                recommendedNumbers={['8699', '869']}
                disabled={disabled}
                placeholder="Válassz kerekítési ráfordítás számlát..."
              />
            </div>
          </div>

          <div className="space-y-1.5 max-w-sm pt-1">
            <Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-amber-500" />
              <span>Maximális forintos kerekítési határ (HUF)</span>
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                step="1"
                value={rules.rounding_max_limit_huf ?? 10}
                onChange={(e) => {
                  const val = e.target.value === '' ? null : parseFloat(e.target.value);
                  onChange('rounding_max_limit_huf', val !== null && !isNaN(val) ? Math.max(0, val) : 0);
                }}
                disabled={disabled}
                className="h-9 text-xs font-mono font-bold bg-background/60 w-28"
              />
              <span className="text-xs text-muted-foreground font-semibold">Ft (HUF)</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Kizárólag forintos (HUF) bizonylatok filléres kerekítésére érvényes. A devizás (EUR, USD stb.) folyószámla-különbözeteket a rendszer automatikusan árfolyam-különbözetként könyveli a 2. pontban megadott szabályok szerint.
            </p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground flex items-center gap-1 italic px-1">
          <Info className="h-3 w-3 shrink-0" />
          A folyószámla menüpontban („Kerekítési Különbözetek Csoportos Leírása”) és a manuális bizonylat-lezáráskor a rendszer forintos bizonylatoknál automatikusan ezekre a számlákra könyvel.
        </p>
      </CardContent>
    </Card>
  );
};
