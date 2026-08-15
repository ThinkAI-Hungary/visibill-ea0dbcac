import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Calculator, RefreshCw, X, Coins, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtBalance } from './types';

interface Denomination {
  value: number;
  label: string;
  isNote: boolean;
}

const DENOMINATIONS: Record<string, Denomination[]> = {
  HUF: [
    { value: 20000, label: '20 000 Ft', isNote: true },
    { value: 10000, label: '10 000 Ft', isNote: true },
    { value: 5000, label: '5 000 Ft', isNote: true },
    { value: 2000, label: '2 000 Ft', isNote: true },
    { value: 1000, label: '1 000 Ft', isNote: true },
    { value: 500, label: '500 Ft', isNote: true },
    { value: 200, label: '200 Ft', isNote: false },
    { value: 100, label: '100 Ft', isNote: false },
    { value: 50, label: '50 Ft', isNote: false },
    { value: 20, label: '20 Ft', isNote: false },
    { value: 10, label: '10 Ft', isNote: false },
    { value: 5, label: '5 Ft', isNote: false },
  ],
  EUR: [
    { value: 500, label: '500 €', isNote: true },
    { value: 200, label: '200 €', isNote: true },
    { value: 100, label: '100 €', isNote: true },
    { value: 50, label: '50 €', isNote: true },
    { value: 20, label: '20 €', isNote: true },
    { value: 10, label: '10 €', isNote: true },
    { value: 5, label: '5 €', isNote: true },
    { value: 2, label: '2 €', isNote: false },
    { value: 1, label: '1 €', isNote: false },
    { value: 0.50, label: '50 c', isNote: false },
    { value: 0.20, label: '20 c', isNote: false },
    { value: 0.10, label: '10 c', isNote: false },
    { value: 0.05, label: '5 c', isNote: false },
    { value: 0.02, label: '2 c', isNote: false },
    { value: 0.01, label: '1 c', isNote: false },
  ],
  USD: [
    { value: 100, label: '100 $', isNote: true },
    { value: 50, label: '50 $', isNote: true },
    { value: 20, label: '20 $', isNote: true },
    { value: 10, label: '10 $', isNote: true },
    { value: 5, label: '5 $', isNote: true },
    { value: 2, label: '2 $', isNote: true },
    { value: 1, label: '1 $', isNote: true },
    { value: 0.50, label: '50 ¢', isNote: false },
    { value: 0.25, label: '25 ¢', isNote: false },
    { value: 0.10, label: '10 ¢', isNote: false },
    { value: 0.05, label: '5 ¢', isNote: false },
    { value: 0.01, label: '1 ¢', isNote: false },
  ],
};

interface DenominationCalculatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registerName: string;
  currency: string;
  theoreticalBalance: number;
}

export default function DenominationCalculatorDialog({
  open,
  onOpenChange,
  registerName,
  currency,
  theoreticalBalance,
}: DenominationCalculatorDialogProps) {
  // Use HUF as fallback if currency is not HUF/EUR/USD
  const activeCurrency = useMemo(() => {
    const upper = (currency || 'HUF').toUpperCase();
    return DENOMINATIONS[upper] ? upper : 'HUF';
  }, [currency]);

  const denoms = useMemo(() => {
    return DENOMINATIONS[activeCurrency];
  }, [activeCurrency]);

  const [counts, setCounts] = useState<Record<number, string>>({});

  // Reset calculator counts when register or dialog changes
  useEffect(() => {
    if (open) {
      const initialCounts: Record<number, string> = {};
      denoms.forEach((d) => {
        initialCounts[d.value] = '';
      });
      setCounts(initialCounts);
    }
  }, [open, denoms]);

  const handleCountChange = (value: number, countStr: string) => {
    // Only allow positive integers or empty
    const sanitized = countStr.replace(/[^0-9]/g, '');
    setCounts((prev) => ({
      ...prev,
      [value]: sanitized,
    }));
  };

  const incrementCount = (value: number) => {
    const current = parseInt(counts[value] || '0', 10);
    setCounts((prev) => ({
      ...prev,
      [value]: String(current + 1),
    }));
  };

  const decrementCount = (value: number) => {
    const current = parseInt(counts[value] || '0', 10);
    if (current > 0) {
      setCounts((prev) => ({
        ...prev,
        [value]: String(current - 1),
      }));
    }
  };

  // Calculations
  const calculatedTotal = useMemo(() => {
    return Object.entries(counts).reduce((sum, [valStr, countStr]) => {
      const val = parseFloat(valStr);
      const count = parseInt(countStr || '0', 10);
      return sum + val * count;
    }, 0);
  }, [counts]);

  const difference = useMemo(() => {
    return calculatedTotal - theoreticalBalance;
  }, [calculatedTotal, theoreticalBalance]);

  const handleClear = () => {
    const resetCounts: Record<number, string> = {};
    denoms.forEach((d) => {
      resetCounts[d.value] = '';
    });
    setCounts(resetCounts);
  };

  // Group by notes and coins for two-column balance sheet style layout
  const notes = useMemo(() => denoms.filter((d) => d.isNote), [denoms]);
  const coins = useMemo(() => denoms.filter((d) => !d.isNote), [denoms]);

  const getDenomVisual = (value: number, isNote: boolean) => {
    if (activeCurrency !== 'HUF') return null;
    
    // HUF Banknote colors
    const banknoteColors: Record<number, { bg: string, text: string }> = {
      20000: { bg: 'bg-[#b8860b]/20 border-[#b8860b]/60 dark:bg-[#b8860b]/30', text: 'text-[#b8860b] dark:text-[#ffd700]' },
      10000: { bg: 'bg-purple-500/20 border-purple-500/60 dark:bg-purple-500/30', text: 'text-purple-600 dark:text-purple-300' },
      5000: { bg: 'bg-orange-600/20 border-orange-600/60 dark:bg-orange-600/30', text: 'text-orange-700 dark:text-orange-300' },
      2000: { bg: 'bg-emerald-600/20 border-emerald-600/60 dark:bg-emerald-600/30', text: 'text-emerald-700 dark:text-emerald-300' },
      1000: { bg: 'bg-blue-500/20 border-blue-500/60 dark:bg-blue-500/30', text: 'text-blue-600 dark:text-blue-300' },
      500: { bg: 'bg-pink-500/20 border-pink-500/60 dark:bg-pink-500/30', text: 'text-pink-600 dark:text-pink-300' }
    };

    if (isNote) {
      const col = banknoteColors[value] || { bg: 'bg-muted border-muted-foreground/30', text: 'text-muted-foreground' };
      return (
        <div className={cn("w-10 h-6 rounded flex items-center justify-center border font-mono text-[8px] font-bold shadow-sm select-none", col.bg)}>
          <span className={cn("opacity-95 leading-none", col.text)}>{value.toLocaleString('hu-HU')}</span>
        </div>
      );
    } else {
      if (value === 200) {
        return (
          <div className="w-6 h-6 rounded-full border border-gray-400/80 bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-inner relative select-none">
            <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/40 border border-yellow-600/50 flex items-center justify-center text-[6px] font-extrabold text-yellow-800 dark:text-yellow-300 font-mono leading-none">
              200
            </div>
          </div>
        );
      }
      if (value === 100) {
        return (
          <div className="w-6 h-6 rounded-full border border-yellow-500/50 bg-yellow-500/10 dark:bg-yellow-500/20 flex items-center justify-center shadow-inner relative select-none">
            <div className="w-3.5 h-3.5 rounded-full bg-gray-200 dark:bg-gray-700 border border-gray-400/40 flex items-center justify-center text-[6px] font-extrabold text-gray-700 dark:text-gray-300 font-mono leading-none">
              100
            </div>
          </div>
        );
      }
      if (value === 50) {
        return (
          <div className="w-6 h-6 rounded-full border border-gray-400 bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-inner text-[8px] font-extrabold text-gray-600 dark:text-gray-300 font-mono leading-none select-none">
            50
          </div>
        );
      }
      if (value === 20) {
        return (
          <div className="w-6 h-6 rounded-full border border-amber-600/70 bg-amber-500/15 flex items-center justify-center shadow-inner text-[8px] font-extrabold text-amber-800 dark:text-amber-400 font-mono leading-none select-none">
            20
          </div>
        );
      }
      if (value === 10) {
        return (
          <div className="w-6 h-6 rounded-full border border-gray-400 bg-gray-100 dark:bg-gray-800 flex items-center justify-center shadow-inner text-[8px] font-extrabold text-gray-600 dark:text-gray-300 font-mono leading-none select-none">
            10
          </div>
        );
      }
      if (value === 5) {
        return (
          <div className="w-5.5 h-5.5 rounded-full border border-amber-600/70 bg-amber-500/15 flex items-center justify-center shadow-inner text-[8px] font-extrabold text-amber-800 dark:text-amber-400 font-mono leading-none select-none">
            5
          </div>
        );
      }
    }
    return null;
  };

  const renderDenomRow = (d: Denomination) => {
    const count = counts[d.value] || '';
    const subtotal = d.value * (parseInt(count || '0', 10));

    return (
      <div key={d.value} className="flex items-center justify-between gap-3 py-1.5 border-b border-border/30 hover:bg-muted/10 px-1.5 rounded transition-colors">
        <div className="flex items-center gap-2 w-28">
          <div className="w-10 flex justify-center shrink-0">
            {getDenomVisual(d.value, d.isNote)}
          </div>
          <Label htmlFor={`denom-${d.value}`} className="text-xs font-semibold select-none text-foreground/80 truncate">
            {d.label}
          </Label>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="outline"
            className="w-6 h-6 p-0 text-xs shrink-0 select-none"
            onClick={() => decrementCount(d.value)}
          >
            -
          </Button>
          <Input
            id={`denom-${d.value}`}
            type="text"
            className="w-12 h-6 text-center text-xs font-semibold font-mono p-0 select-all"
            value={count}
            onChange={(e) => handleCountChange(d.value, e.target.value)}
            placeholder="0"
          />
          <Button
            type="button"
            variant="outline"
            className="w-6 h-6 p-0 text-xs shrink-0 select-none"
            onClick={() => incrementCount(d.value)}
          >
            +
          </Button>
        </div>
        <div className="w-20 text-right text-xs font-mono font-medium tabular-nums text-foreground/70">
          {subtotal > 0 ? fmtBalance(subtotal, currency) : '—'}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        <DialogHeader className="border-b border-border/20 pb-3 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Címletszámoló
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pénztár: <strong className="text-foreground">{registerName}</strong> | 
            Könyv szerinti egyenleg: <strong className="text-foreground font-mono">{fmtBalance(theoreticalBalance, currency)}</strong>
          </DialogDescription>
        </DialogHeader>

        {/* Form Body - two cols (Notes vs Coins) */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            {/* Notes Column */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pl-1.5">
                <Coins className="h-3 w-3 text-primary" />
                Papírpénzek (Bankjegyek)
              </div>
              <div className="rounded-lg border border-border/40 p-2 bg-muted/5">
                {notes.map(renderDenomRow)}
              </div>
            </div>

            {/* Coins Column */}
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pl-1.5">
                <Coins className="h-3 w-3 text-amber-500" />
                Fémpénzek (Érmék)
              </div>
              <div className="rounded-lg border border-border/40 p-2 bg-muted/5">
                {coins.length > 0 ? (
                  coins.map(renderDenomRow)
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-4">Nincsenek érmék ehhez a devizához.</p>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Sticky Audit Result Panel */}
        <Card className="border-border/60 bg-muted/10 shadow-sm shrink-0">
          <CardContent className="p-3.5 grid grid-cols-3 gap-3 items-center">
            
            {/* Theoretical balance */}
            <div className="space-y-0.5">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">Könyv szerinti</span>
              <span className="text-sm font-bold font-mono text-foreground leading-none tabular-nums">
                {fmtBalance(theoreticalBalance, currency)}
              </span>
            </div>

            {/* Calculated physical total */}
            <div className="space-y-0.5 border-l border-border/40 pl-3">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">Számolt fizikai</span>
              <span className="text-sm font-bold font-mono text-primary leading-none tabular-nums">
                {fmtBalance(calculatedTotal, currency)}
              </span>
            </div>

            {/* Difference / Discrepancy */}
            <div className="space-y-0.5 border-l border-border/40 pl-3">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider block">Eltérés</span>
                {difference === 0 && <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                {difference !== 0 && <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", difference < 0 ? "text-destructive" : "text-amber-500")} />}
              </div>
              <span className={cn(
                "text-sm font-extrabold font-mono leading-none tabular-nums",
                difference === 0 && "text-emerald-500 dark:text-emerald-400",
                difference < 0 && "text-destructive dark:text-red-400",
                difference > 0 && "text-amber-500 dark:text-amber-400"
              )}>
                {difference > 0 ? '+' : ''}{fmtBalance(difference, currency)}
              </span>
            </div>

          </CardContent>
        </Card>

        {/* Footer actions */}
        <DialogFooter className="border-t border-border/20 pt-3 shrink-0 flex items-center justify-between w-full sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Minden törlése
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-9"
            >
              Bezárás
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
