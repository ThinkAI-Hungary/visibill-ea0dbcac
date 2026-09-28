import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Wallet, ShieldAlert, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PettyCashRegister, PettyCashEntry } from '../types';
import { fmtBalance } from '../types';

interface WizardStep1CheckProps {
  registers: PettyCashRegister[];
  selectedRegisterId: string;
  onSelectRegister: (id: string) => void;
  periodStart: string;
  periodEnd: string;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  bookClosingBalance: number;
  currency: string;
  onSelectCurrency?: (cur: string) => void;
  pendingApprovalsCount: number;
  isNegativeBalance: boolean;
  isLimitExceeded: boolean;
  limitAction: 'warn' | 'block';
  cashLimit: number;
}

export function WizardStep1Check({
  registers,
  selectedRegisterId,
  onSelectRegister,
  periodStart,
  periodEnd,
  openingBalance,
  totalIncome,
  totalExpense,
  bookClosingBalance,
  currency,
  onSelectCurrency,
  pendingApprovalsCount,
  isNegativeBalance,
  isLimitExceeded,
  limitAction,
  cashLimit,
}: WizardStep1CheckProps) {
  const activeRegister = registers.find(r => r.id === selectedRegisterId);

  return (
    <div className="space-y-4 text-xs">
      {/* 1. Pénztár és időszak kiválasztása */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-muted/30 rounded-xl border border-border/60">
        <div>
          <Label className="text-xs font-medium">Zárandó házipénztár</Label>
          <Select value={selectedRegisterId} onValueChange={onSelectRegister}>
            <SelectTrigger className="h-9 mt-1 text-xs">
              <SelectValue placeholder="Válassz pénztárat" />
            </SelectTrigger>
            <SelectContent>
              {registers.map(r => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} ({r.currencies.join(', ')})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeRegister && activeRegister.currencies.length > 1 && (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted-foreground text-[10px]">Zárandó devizanem:</span>
              <div className="flex gap-1">
                {activeRegister.currencies.map(c => (
                  <Button
                    key={c}
                    type="button"
                    size="sm"
                    variant={currency === c ? "default" : "outline"}
                    className="h-5 text-[10px] px-1.5 py-0"
                    onClick={() => onSelectCurrency?.(c)}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs font-medium">Zárási időszak</Label>
          <div className="h-9 mt-1 px-3 flex items-center gap-2 bg-background border border-border/80 rounded-md font-mono text-xs">
            <span>{periodStart}</span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <span className="font-semibold text-foreground">{periodEnd}</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Sztv. 165. §: nem léphet át naptári hónaphatárt.</p>
        </div>
      </div>

      {/* 2. Pénzforgalmi egyenleglevezetés kártyák */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Card className="bg-card shadow-none border-border/70">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1 text-[11px]">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              Nyitó egyenleg
            </div>
            <div className="text-base font-bold tabular-nums font-mono">
              {fmtBalance(openingBalance, currency)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-none border-border/70">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 mb-1 text-[11px] font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              Időszaki bevétel (+)
            </div>
            <div className="text-base font-bold tabular-nums font-mono text-emerald-600 dark:text-emerald-400">
              +{fmtBalance(totalIncome, currency)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-none border-border/70">
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-destructive mb-1 text-[11px] font-medium">
              <TrendingDown className="w-3.5 h-3.5" />
              Időszaki kiadás (-)
            </div>
            <div className="text-base font-bold tabular-nums font-mono text-destructive">
              -{fmtBalance(totalExpense, currency)}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "shadow-none transition-colors",
          isNegativeBalance 
            ? "border-destructive/60 bg-destructive/5 text-destructive" 
            : "border-primary/40 bg-primary/5"
        )}>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1 text-[11px] font-semibold">
              Könyv szerinti záró
            </div>
            <div className={cn(
              "text-base font-bold tabular-nums font-mono",
              isNegativeBalance ? "text-destructive" : "text-primary"
            )}>
              {fmtBalance(bookClosingBalance, currency)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Integritás és szabályzati riasztások */}
      <div className="space-y-2">
        {/* Negatív kassza riasztás */}
        {isNegativeBalance && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Figyelmeztetés: Negatív készpénzegyenleg!</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                A könyv szerinti záróegyenleg ({fmtBalance(bookClosingBalance, currency)}) negatív, ami a számviteli törvény szerint szabálytalan. Ellenőrizd a kiadásokat vagy rögzíts nyitó/befizetési tételt!
              </p>
            </div>
          </div>
        )}

        {/* Jóváhagyásra váró tételek */}
        {pendingApprovalsCount > 0 && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
            <div>
              <p className="font-semibold">Jóváhagyásra váró tételek találhatók ({pendingApprovalsCount} db)</p>
              <p className="text-[11px] opacity-90 mt-0.5">
                A pénztárban függőben lévő kiadások vannak az utalványozási határ felett. A pontos záráshoz javasolt előbb jóváhagyni vagy elutasítani őket.
              </p>
            </div>
          </div>
        )}

        {/* Keretösszeg túllépés */}
        {isLimitExceeded && (
          <div className={cn(
            "p-3 rounded-xl flex items-start gap-2.5",
            limitAction === 'block' 
              ? "bg-destructive/10 border border-destructive/30 text-destructive"
              : "bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-400"
          )}>
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                {limitAction === 'block' ? 'Keretösszeg túllépés — Zárás tiltva!' : 'Pénztári keretösszeg túllépés'}
              </p>
              <p className="text-[11px] opacity-90 mt-0.5">
                A záró készlet ({fmtBalance(bookClosingBalance, currency)}) meghaladja a szabályzatban rögzített {fmtBalance(cashLimit, currency)} keretet.
                {limitAction === 'block' && ' A zárás folytatásához bankba történő befizetés tétel rögzítése szükséges.'}
              </p>
            </div>
          </div>
        )}

        {!isNegativeBalance && pendingApprovalsCount === 0 && !isLimitExceeded && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-400 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Minden ellenőrzés sikeres! A pénztár állománya zárásra kész.</span>
          </div>
        )}
      </div>
    </div>
  );
}
