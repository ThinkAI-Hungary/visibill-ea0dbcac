import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Calculator, ArrowRight, CheckCircle2, AlertTriangle, Info, RefreshCw } from 'lucide-react';

interface VatProRataCalculatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year?: number;
}

export function VatProRataCalculatorModal({
  open,
  onOpenChange,
  year = new Date().getFullYear(),
}: VatProRataCalculatorModalProps) {
  // Inputs
  const [taxableRevenue, setTaxableRevenue] = useState<number>(100000000);
  const [exemptRevenue, setExemptRevenue] = useState<number>(20000000);
  const [subsidies, setSubsidies] = useState<number>(0);
  const [proRataInputVat, setProRataInputVat] = useState<number>(2700000);

  // Math calculation according to Áfa tv. 5. sz. melléklet
  const numerator = Math.max(0, taxableRevenue);
  const denominator = Math.max(0, taxableRevenue + exemptRevenue + subsidies);

  const rawRatio = denominator > 0 ? numerator / denominator : 1.0;

  // Rounding rule: Always round UP to 2 decimal places (ceil to 2 decimals)
  // Example: 0.83333 -> 0.84, 0.1201 -> 0.13
  const roundedRatio = denominator > 0 ? Math.ceil(rawRatio * 100) / 100 : 1.0;
  const clampedRatio = Math.min(1.0, Math.max(0.0, roundedRatio));

  const deductibleVat = Math.round(proRataInputVat * clampedRatio);
  const nonDeductibleVat = proRataInputVat - deductibleVat;

  const formatFt = (val: number) =>
    new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', maximumFractionDigits: 0 }).format(val);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Calculator className="w-5 h-5" />
            </div>
            <span>ÁFA Arányosítási Kalkulátor & Szimulátor (Áfa tv. 123. §)</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            A levonási hányados L(H) és a levonható ÁFA összegének törvényi számítása az 5. sz. melléklet alapján.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Inputs Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>1. Adóköteles árbevétel (Nettó Ft)</span>
                <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">Számláló & Nevező</Badge>
              </Label>
              <Input
                type="number"
                value={taxableRevenue}
                onChange={e => setTaxableRevenue(parseFloat(e.target.value) || 0)}
                className="h-9 font-mono text-xs text-right font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>2. Adómentes árbevétel (Nettó Ft)</span>
                <Badge variant="outline" className="text-[9px] bg-rose-500/10 text-rose-600 border-rose-500/30">Csak Nevező</Badge>
              </Label>
              <Input
                type="number"
                value={exemptRevenue}
                onChange={e => setExemptRevenue(parseFloat(e.target.value) || 0)}
                className="h-9 font-mono text-xs text-right font-semibold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>3. Közvetlen támogatás (Nettó Ft)</span>
                <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600 border-amber-500/30">Csak Nevező (Rontja)</Badge>
              </Label>
              <Input
                type="number"
                value={subsidies}
                onChange={e => setSubsidies(parseFloat(e.target.value) || 0)}
                className="h-9 font-mono text-xs text-right"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>4. Arányosítandó előzetes ÁFA (Ft)</span>
                <Badge variant="outline" className="text-[9px] bg-indigo-500/10 text-indigo-600 border-indigo-500/30">Vegyes számlák</Badge>
              </Label>
              <Input
                type="number"
                value={proRataInputVat}
                onChange={e => setProRataInputVat(parseFloat(e.target.value) || 0)}
                className="h-9 font-mono text-xs text-right font-semibold text-indigo-600 dark:text-indigo-400"
              />
            </div>
          </div>

          {/* Formula Display & Calculation Results */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <Card className="p-3.5 border border-border bg-card flex flex-col justify-between space-y-2">
              <span className="text-muted-foreground block text-[11px]">Nyers hányados</span>
              <span className="font-mono text-lg font-bold text-foreground">
                {rawRatio.toFixed(6)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                Pontos tört érték
              </span>
            </Card>

            <Card className="p-3.5 border-2 border-primary/40 bg-primary/5 flex flex-col justify-between space-y-2">
              <span className="text-primary font-semibold block text-[11px]">Törvényes hányados L(H)</span>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-extrabold text-primary">
                  {clampedRatio.toFixed(2)}
                </span>
                <Badge variant="secondary" className="text-[10px] font-bold">
                  {(clampedRatio * 100).toFixed(0)}%
                </Badge>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                Felfelé kerekítve (Áfa tv.)
              </span>
            </Card>

            <Card className="p-3.5 border border-border bg-card flex flex-col justify-between space-y-2">
              <span className="text-muted-foreground block text-[11px]">Levonható ÁFA Összeg</span>
              <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {formatFt(deductibleVat)}
              </span>
              <span className="text-[10px] text-rose-600 dark:text-rose-400">
                Nem levonható (Költség): {formatFt(nonDeductibleVat)}
              </span>
            </Card>
          </div>

          {/* Explanation Banner */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs space-y-1.5 leading-relaxed">
            <div className="font-semibold text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Számítási képlet bontása:</span>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground bg-background/80 p-2 rounded border">
              L(H) = {formatFt(numerator)} / ({formatFt(numerator)} + {formatFt(exemptRevenue)} + {formatFt(subsidies)}) = {rawRatio.toFixed(6)} $\rightarrow$ <strong>{clampedRatio.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Bezárás
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
