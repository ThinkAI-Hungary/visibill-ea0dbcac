import React, { useState } from 'react';
import { Scale, AlertTriangle, HelpCircle, CheckCircle2, TrendingUp, Info, Activity, ArrowRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface BalanceSheetWidgetsProps {
  totalAssets: number;
  totalLiabilities: number;
  difference: number;
  isBalanced: boolean;
  selectedCurrency: 'HUF' | 'EUR' | 'USD';
  inThousands: boolean;
  currentAssets: number;
  inventories: number;
  shortTermLiabilities: number;
  cashAssets: number; // e.g. B/IV. cash
  unmappedAccountsCount: number;
  onAutoFixMappings?: () => void;
  conversionFactor: number;
}

export function BalanceSheetWidgets({
  totalAssets,
  totalLiabilities,
  difference,
  isBalanced,
  selectedCurrency,
  inThousands,
  currentAssets,
  inventories,
  shortTermLiabilities,
  cashAssets,
  unmappedAccountsCount,
  onAutoFixMappings,
  conversionFactor,
}: BalanceSheetWidgetsProps) {
  const [isDiagnosticOpen, setIsDiagnosticOpen] = useState(false);
  const [isRatiosOpen, setIsRatiosOpen] = useState(false);

  const formatHuf = (v: number) => {
    const valConsolidated = v * conversionFactor;
    const finalVal = inThousands ? Math.round(valConsolidated / 1000) : Math.round(valConsolidated);
    const fmt = new Intl.NumberFormat('hu-HU').format(finalVal);
    const symbol = selectedCurrency === 'EUR' ? ' €' : selectedCurrency === 'USD' ? ' $' : ' Ft';
    return `${fmt}${inThousands ? ' E' : ''}${symbol}`;
  };

  // Compute beam tilt angle: max 15 degrees tilt
  const tiltAngle = isBalanced 
    ? 0 
    : difference > 0 
      ? -Math.min(12, Math.max(3, (difference / totalAssets) * 45)) 
      : Math.min(12, Math.max(3, (Math.abs(difference) / totalLiabilities) * 45));

  // Liquidity Ratios
  const lRata = shortTermLiabilities > 0 ? currentAssets / shortTermLiabilities : 0;
  const lGyors = shortTermLiabilities > 0 ? (currentAssets - inventories) / shortTermLiabilities : 0;
  const lKeszpenz = shortTermLiabilities > 0 ? cashAssets / shortTermLiabilities : 0;

  // Health evaluations
  const getRatioStatus = (val: number, min: number, target: number) => {
    if (val >= target) return { label: 'Kiváló', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' };
    if (val >= min) return { label: 'Megfelelő', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' };
    return { label: 'Alacsony', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' };
  };

  const statusRata = getRatioStatus(lRata, 1.2, 1.8);
  const statusGyors = getRatioStatus(lGyors, 0.8, 1.3);
  const statusKesz = getRatioStatus(lKeszpenz, 0.2, 0.5);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 print:hidden">
      {/* 1. Mérleg-hinta (Balance Beam) ⚖️ */}
      <Card className="border border-border/60 bg-card/60 backdrop-blur-sm p-4 flex flex-col justify-between rounded-xl relative overflow-hidden h-[180px]">
        <div className="flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5">
            <Scale className={cn("w-4 h-4", isBalanced ? "text-emerald-500" : "text-amber-500")} />
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mérleg-hinta ⚖️</h4>
          </div>
          <span className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded border",
            isBalanced 
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
              : "bg-rose-500/10 text-rose-500 border-rose-500/20"
          )}>
            {isBalanced ? 'Egyensúlyban' : 'Eltérés!'}
          </span>
        </div>

        {/* Visual Balance Beam rendering */}
        <div className="flex-1 flex flex-col items-center justify-center py-2 relative">
          <svg width="220" height="70" className="overflow-visible">
            {/* Base triangular pivot point */}
            <polygon points="110,40 100,65 120,65" fill="#475569" stroke="#334155" strokeWidth="1" />
            
            {/* The Beam */}
            <g style={{ transform: `rotate(${tiltAngle}deg)`, transformOrigin: '110px 42px', transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              {/* Main horizontal beam */}
              <line x1="20" y1="42" x2="200" y2="42" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
              
              {/* Left scale pan strings */}
              <line x1="35" y1="42" x2="35" y2="60" stroke="#94a3b8" strokeWidth="1" />
              {/* Left scale pan */}
              <path d="M 15 60 Q 35 68 55 60 Z" fill="#10b981" fillOpacity="0.25" stroke="#10b981" strokeWidth="1.5" />
              
              {/* Right scale pan strings */}
              <line x1="185" y1="42" x2="185" y2="60" stroke="#94a3b8" strokeWidth="1" />
              {/* Right scale pan */}
              <path d="M 165 60 Q 185 68 205 60 Z" fill="#4f46e5" fillOpacity="0.25" stroke="#4f46e5" strokeWidth="1.5" />
              
              {/* Text indicator labels */}
              <text x="35" y="32" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#10b981">Eszközök</text>
              <text x="185" y="32" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#4f46e5">Források</text>
            </g>
          </svg>
        </div>

        <div className="flex justify-between items-center z-10 text-[10px] text-muted-foreground border-t pt-2 mt-1">
          <span>Eszköz: {formatHuf(totalAssets)}</span>
          <span>Forrás: {formatHuf(totalLiabilities)}</span>
        </div>
      </Card>

      {/* 2. Automated Diagnostics helper */}
      <Card className="border border-border/60 bg-card/60 backdrop-blur-sm p-4 flex flex-col justify-between rounded-xl h-[180px]">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className={cn("w-4 h-4", !isBalanced ? "text-rose-500 animate-bounce" : "text-emerald-500")} />
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Egyezőségi Diagnosztika</h4>
        </div>
        
        <div className="flex-1 flex flex-col justify-center text-xs space-y-1.5 py-1">
          {isBalanced ? (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 font-medium">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>A mérleg egyenlege egyezik. Nincs szükség beavatkozásra.</span>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-rose-500 font-bold flex items-center gap-1">
                Eltérés: {formatHuf(difference)}
              </p>
              <p className="text-[10px] text-muted-foreground leading-snug">
                {unmappedAccountsCount > 0 
                  ? `Találtunk ${unmappedAccountsCount} db besorolatlan főkönyvi számlát, ami egyensúlyhiányt okozhat.`
                  : 'Minden számla besorolva, de az egyenlegek nem egyeznek. Nyissa meg a részletes diagnosztikát.'}
              </p>
            </div>
          )}
        </div>

        <div className="border-t pt-2 mt-1 flex justify-end">
          <Button 
            variant="outline" 
            size="xs" 
            onClick={() => setIsDiagnosticOpen(true)}
            className="h-6 text-[10px] gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 border-indigo-500/20"
          >
            Diagnosztikai Jelentés
          </Button>
        </div>
      </Card>

      {/* 3. Liquidity ratios historical popups */}
      <Card className="border border-border/60 bg-card/60 backdrop-blur-sm p-4 flex flex-col justify-between rounded-xl h-[180px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-indigo-500" />
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Likviditási Mutatók</h4>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center space-y-2 py-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Likviditási ráta:</span>
            <span className={cn("font-bold tabular-nums", lRata >= 1.5 ? "text-emerald-500" : lRata >= 1.0 ? "text-yellow-500" : "text-rose-500")}>
              {lRata.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">Györsráta:</span>
            <span className={cn("font-bold tabular-nums", lGyors >= 1.0 ? "text-emerald-500" : lGyors >= 0.7 ? "text-yellow-500" : "text-rose-500")}>
              {lGyors.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="border-t pt-2 mt-1 flex justify-between items-center">
          <span className="text-[10px] text-muted-foreground italic">Target: Ráta &gt; 1.5</span>
          <Button 
            variant="ghost" 
            size="xs" 
            onClick={() => setIsRatiosOpen(true)}
            className="h-6 text-[10px] text-indigo-500 hover:text-indigo-600 hover:bg-transparent p-0 flex items-center gap-0.5"
          >
            Részletek <ArrowRight className="w-3 h-3" />
          </Button>
        </div>
      </Card>

      {/* DIAGNOSTIC DIALOG */}
      <Dialog open={isDiagnosticOpen} onOpenChange={setIsDiagnosticOpen}>
        <DialogContent className="bg-background max-w-md rounded-xl border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-foreground text-sm font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
              Mérleg Diagnosztikai Jelentés
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground">
              Rendszerünk megvizsgálta a főkönyvi egyenlegeket és az Sztv. mérleg-feltérképezést.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            {/* Mismatch Alert Box */}
            <div className={cn(
              "p-3 rounded-lg border",
              isBalanced ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" : "bg-rose-500/10 border-rose-500/20 text-rose-600"
            )}>
              <div className="font-bold flex items-center gap-1">
                {isBalanced ? '✓ Mérleg egyensúly rendben' : '⚠️ Eszközök és Források egyenlege eltér'}
              </div>
              <div className="text-[10px] mt-0.5">
                Eszközök összesen: {formatHuf(totalAssets)} | Források összesen: {formatHuf(totalLiabilities)}
              </div>
            </div>

            {/* Diagnostic Checks list */}
            <div className="space-y-2.5">
              <div className="flex items-start gap-2">
                {unmappedAccountsCount > 0 ? (
                  <AlertTriangle className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-semibold">Besorolatlan főkönyvi számlák</div>
                  <div className="text-[10px] text-muted-foreground leading-snug">
                    {unmappedAccountsCount > 0 
                      ? `Jelenleg ${unmappedAccountsCount} db aktív főkönyvi számlához nem tartozik mérleg-hozzárendelés. Ez megbontja a mérleg egyensúlyát.`
                      : 'Minden aktív főkönyvi számla megfelelően be van sorolva a mérlegstruktúrába.'}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 border-t pt-2.5">
                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">Eredménykimutatás lezárás ellenőrzés</div>
                  <div className="text-[10px] text-muted-foreground leading-snug">
                    Az adózott eredmény megfelelően integrálva lett a Saját tőke "D. Mérleg szerinti eredmény" sorába a tárgyévi profit lefutások alapján.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t pt-3 flex justify-between sm:justify-between">
            <Button variant="outline" size="sm" onClick={() => setIsDiagnosticOpen(false)}>Bezárás</Button>
            {unmappedAccountsCount > 0 && onAutoFixMappings && (
              <Button 
                onClick={() => {
                  onAutoFixMappings();
                  setIsDiagnosticOpen(false);
                }} 
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
              >
                Automatikus besorolás javítása
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RATIOS DETAILS DIALOG */}
      <Dialog open={isRatiosOpen} onOpenChange={setIsRatiosOpen}>
        <DialogContent className="bg-background max-w-md rounded-xl border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-foreground text-sm font-bold uppercase tracking-wider">
              <TrendingUp className="w-4.5 h-4.5 text-indigo-500" />
              Likviditási Ráták Részletes Vizsgálata
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground">
              A fizetőképesség és a rövid távú adósság-visszafizetési képesség kulcsmutatói.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2 text-xs">
            {/* Current Ratio Details */}
            <div className="p-3 rounded-lg border bg-background/50 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm">1. Likviditási Ráta (Current Ratio)</span>
                <span className={cn("px-2 py-0.5 rounded font-bold border text-[10px]", statusRata.color)}>
                  {statusRata.label}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Képlet: Forgóeszközök / Rövid távú kötelezettségek</p>
              <div className="flex justify-between items-center text-sm pt-1 border-t">
                <span>Számított érték:</span>
                <span className="font-bold tabular-nums text-foreground">{lRata.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug pt-1">
                Azt méri, hogy a cég forgóeszközei hányszorosan fedezik a rövid távú tartozásait. Az 1,5 feletti érték tekinthető stabilnak.
              </p>
            </div>

            {/* Quick Ratio Details */}
            <div className="p-3 rounded-lg border bg-background/50 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm">2. Likviditási Gyorsráta (Quick Ratio)</span>
                <span className={cn("px-2 py-0.5 rounded font-bold border text-[10px]", statusGyors.color)}>
                  {statusGyors.label}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Képlet: (Forgóeszközök - Készletek) / Rövid távú kötelezettségek</p>
              <div className="flex justify-between items-center text-sm pt-1 border-t">
                <span>Számított érték:</span>
                <span className="font-bold tabular-nums text-foreground">{lGyors.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug pt-1">
                Kiszűri a kevésbé likvid készleteket a forgóeszközök közül, így szigorúbb képet ad a fizetőképességről. Az 1,0 feletti érték ideális.
              </p>
            </div>

            {/* Cash Ratio Details */}
            <div className="p-3 rounded-lg border bg-background/50 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm">3. Pénzeszköz-Likviditás (Cash Ratio)</span>
                <span className={cn("px-2 py-0.5 rounded font-bold border text-[10px]", statusKesz.color)}>
                  {statusKesz.label}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground italic">Képlet: Pénzeszközök / Rövid távú kötelezettségek</p>
              <div className="flex justify-between items-center text-sm pt-1 border-t">
                <span>Számított érték:</span>
                <span className="font-bold tabular-nums text-foreground">{lKeszpenz.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug pt-1">
                Azt mutatja meg, hogy az azonnal rendelkezésre álló készpénz mekkora részt fedez a rövid távú kötelezettségekből. A 0,2 feletti érték biztonságos.
              </p>
            </div>
          </div>

          <DialogFooter className="border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => setIsRatiosOpen(false)} className="w-full">Bezárás</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
