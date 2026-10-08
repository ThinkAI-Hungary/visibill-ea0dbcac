import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Info, Coins } from 'lucide-react';
import { GlAccountCombobox } from './GlAccountCombobox';
import type { AutoAccountingRules, GlAccountOption, JournalOption } from '@/hooks/useAutoAccountingRules';

interface FxDifferenceRulesCardProps {
  rules: AutoAccountingRules;
  onChange: (field: keyof AutoAccountingRules, value: any) => void;
  accounts: GlAccountOption[];
  journals: JournalOption[];
  disabled?: boolean;
}

export const FxDifferenceRulesCard: React.FC<FxDifferenceRulesCardProps> = ({
  rules,
  onChange,
  accounts,
  journals,
  disabled = false,
}) => {
  return (
    <Card className="border-border/60 shadow-sm bg-card/70 backdrop-blur-sm">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <Coins className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              2. Árfolyam-különbözet Paraméterezése
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Realizált (pénzügyi rendezéskori) és nem realizált (év végi értékelési) árfolyamnyereség és veszteség számlái.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        {/* A) Realizált árfolyam-különbözet */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>A.) Realizált Árfolyam-különbözet</span>
          </div>

          <div className="space-y-3 bg-muted/20 p-3.5 rounded-lg border border-border/40">
            {/* Journal selector */}
            <div className="space-y-1.5 max-w-md">
              <Label className="text-xs font-medium text-foreground">
                Könyvelés vegyes naplója <span className="text-muted-foreground font-mono text-[11px]">(pl. VE)</span>
              </Label>
              <Select
                value={rules.fx_realized_journal_id || ''}
                onValueChange={(val) => onChange('fx_realized_journal_id', val || null)}
                disabled={disabled}
              >
                <SelectTrigger className="h-9 text-xs bg-background/60">
                  <SelectValue placeholder="Válassz vegyes naplót..." />
                </SelectTrigger>
                <SelectContent>
                  {journals.map((j) => (
                    <SelectItem key={j.id} value={j.id} className="text-xs">
                      <span className="font-mono font-bold mr-2 text-primary">{j.code}</span>
                      <span>{j.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gain and Loss accounts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Nyereség főkönyvi szám <span className="text-muted-foreground font-mono text-[11px]">(pl. 9779 – Egyéb árfolyamnyereség)</span>
                </Label>
                <GlAccountCombobox
                  value={rules.fx_realized_gain_gl_id}
                  onChange={(val) => onChange('fx_realized_gain_gl_id', val)}
                  accounts={accounts}
                  recommendedNumbers={['9779', '977', '976']}
                  disabled={disabled}
                  placeholder="Válassz árfolyamnyereség számlát..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Veszteség főkönyvi szám <span className="text-muted-foreground font-mono text-[11px]">(pl. 8755 – Egyéb árfolyamveszteség)</span>
                </Label>
                <GlAccountCombobox
                  value={rules.fx_realized_loss_gl_id}
                  onChange={(val) => onChange('fx_realized_loss_gl_id', val)}
                  accounts={accounts}
                  recommendedNumbers={['8755', '875', '876']}
                  disabled={disabled}
                  placeholder="Válassz árfolyamveszteség számlát..."
                />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 italic px-1">
            <Info className="h-3 w-3 shrink-0" />
            A folyószámla menüpontban devizás tételek kiegyenlítésekor, banki jóváíráskor automatikusan elszámolásra kerülő árfolyam-különbözet.
          </p>
        </div>

        {/* B) Nem realizált árfolyam-különbözet */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>B.) Nem Realizált Árfolyam-különbözet</span>
          </div>

          <div className="space-y-3 bg-muted/20 p-3.5 rounded-lg border border-border/40">
            {/* Journal selector */}
            <div className="space-y-1.5 max-w-md">
              <Label className="text-xs font-medium text-foreground">
                Könyvelés vegyes naplója <span className="text-muted-foreground font-mono text-[11px]">(pl. VE)</span>
              </Label>
              <Select
                value={rules.fx_unrealized_journal_id || ''}
                onValueChange={(val) => onChange('fx_unrealized_journal_id', val || null)}
                disabled={disabled}
              >
                <SelectTrigger className="h-9 text-xs bg-background/60">
                  <SelectValue placeholder="Válassz vegyes naplót..." />
                </SelectTrigger>
                <SelectContent>
                  {journals.map((j) => (
                    <SelectItem key={j.id} value={j.id} className="text-xs">
                      <span className="font-mono font-bold mr-2 text-primary">{j.code}</span>
                      <span>{j.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gain and Loss accounts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Nyereség főkönyvi szám <span className="text-muted-foreground font-mono text-[11px]">(pl. 9762 – Nem realizált nyereség)</span>
                </Label>
                <GlAccountCombobox
                  value={rules.fx_unrealized_gain_gl_id}
                  onChange={(val) => onChange('fx_unrealized_gain_gl_id', val)}
                  accounts={accounts}
                  recommendedNumbers={['9762', '976']}
                  disabled={disabled}
                  placeholder="Válassz nem realizált nyereség számlát..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Veszteség főkönyvi szám <span className="text-muted-foreground font-mono text-[11px]">(pl. 8762 – Nem realizált veszteség)</span>
                </Label>
                <GlAccountCombobox
                  value={rules.fx_unrealized_loss_gl_id}
                  onChange={(val) => onChange('fx_unrealized_loss_gl_id', val)}
                  accounts={accounts}
                  recommendedNumbers={['8762', '876']}
                  disabled={disabled}
                  placeholder="Válassz nem realizált veszteség számlát..."
                />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 italic px-1">
            <Info className="h-3 w-3 shrink-0" />
            Év végi devizás fordulónapi átértékelés (nyitott devizás követelések és kötelezettségek MNB árfolyamra történő átértékelése).
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
