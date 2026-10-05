import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Calculator, CheckCircle2, AlertTriangle, RotateCcw, Coins, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DenominationRow } from '../types';
import { fmtBalance } from '../types';

interface WizardStep2DenominationsProps {
  currency: string;
  bookClosingBalance: number;
  rows: DenominationRow[];
  onChangeRows: (rows: DenominationRow[]) => void;
  actualBalance: number;
  difference: number;
}

const DEFAULT_HUF_DENOMINATIONS = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5];
const DEFAULT_EUR_DENOMINATIONS = [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05];

export function WizardStep2Denominations({
  currency,
  bookClosingBalance,
  rows,
  onChangeRows,
  actualBalance,
  difference,
}: WizardStep2DenominationsProps) {
  const { t } = useTranslation(['pettyCash', 'common']);
  // Update count for a specific denomination
  const handleCountChange = (index: number, countStr: string) => {
    const count = Math.max(0, parseInt(countStr, 10) || 0);
    const updated = [...rows];
    updated[index] = {
      ...updated[index],
      denomination: updated[index].denomination,
      count,
      subtotal: count * updated[index].denomination,
    };
    onChangeRows(updated);
  };

  const handleReset = () => {
    const reset = rows.map(r => ({ ...r, count: 0, subtotal: 0 }));
    onChangeRows(reset);
  };

  const isInitialEmpty = actualBalance === 0 && rows.every(r => (Number(r.count) || 0) === 0);
  const isMatch = !isInitialEmpty && Math.abs(difference) < 0.01;
  const isSurplus = !isInitialEmpty && difference > 0.01;
  const isShortage = !isInitialEmpty && difference < -0.01;

  return (
    <div className="space-y-4 text-xs">
      {/* Összehasonlító kártyák */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Card className="bg-card shadow-none border-border/70">
          <CardContent className="p-3">
            <div 
              className="text-[11px] text-muted-foreground mb-1 cursor-help"
              title="A kiválasztott időszak alatti pénztárbizonylatok alapján számított pénztárkönyvi egyenleg (nem a főkönyv!)"
            >
              {t('pettyCash:closing_wizard.step2.book_closing', 'Könyv szerinti záró')}
            </div>
            <div className="text-base font-bold tabular-nums font-mono">
              {fmtBalance(bookClosingBalance, currency)}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card shadow-none border-border/70">
          <CardContent className="p-3">
            <div className="text-[11px] text-muted-foreground mb-1 flex items-center justify-between">
              <span>{t('pettyCash:closing_wizard.step2.counted_closing', 'Ténylegesen megszámolt')}</span>
              <Coins className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="text-base font-bold tabular-nums font-mono text-foreground">
              {fmtBalance(actualBalance, currency)}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "shadow-none transition-colors",
          isInitialEmpty && "border-border/70 bg-muted/20 text-muted-foreground",
          !isInitialEmpty && isMatch && "border-emerald-500/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-400",
          !isInitialEmpty && isSurplus && "border-blue-500/40 bg-blue-500/5 text-blue-800 dark:text-blue-400",
          !isInitialEmpty && isShortage && "border-destructive/60 bg-destructive/5 text-destructive"
        )}>
          <CardContent className="p-3">
            <div className="text-[11px] font-semibold mb-1 flex items-center justify-between">
              <span>{t('pettyCash:closing_wizard.step2.diff_formula', 'Eltérés (tényleges − könyv)')}</span>
              {isInitialEmpty && <Info className="w-3.5 h-3.5 text-muted-foreground" />}
              {!isInitialEmpty && isMatch && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
              {!isInitialEmpty && !isMatch && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
            </div>
            <div className="text-base font-bold tabular-nums font-mono">
              {isInitialEmpty 
                ? t('pettyCash:closing_wizard.step2.awaiting_count', 'Megszámolásra vár')
                : isMatch 
                  ? t('pettyCash:closing_wizard.step2.no_diff', { currency, defaultValue: `0 ${currency} (Nincs eltérés)` }) 
                  : `${difference > 0 ? '+' : ''}${fmtBalance(difference, currency)}`}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Címlet táblázat */}
      <div className="border border-border/80 rounded-xl overflow-hidden bg-card">
        <div className="flex items-center justify-between p-2.5 bg-muted/40 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-primary" />
            <span className="font-semibold text-foreground">{t('pettyCash:closing_wizard.step2.table_title', { currency, defaultValue: `Címletjegyzék (${currency})` })}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
            <RotateCcw className="w-3 h-3" />
            {t('pettyCash:closing_wizard.step2.reset_btn', 'Nullázás')}
          </Button>
        </div>

        <div className="max-h-[320px] overflow-y-auto">
          <Table className="text-xs">
            <TableHeader className="bg-muted/30 sticky top-0 z-10 border-b border-border/60">
              <TableRow>
                <TableHead className="w-32">{t('pettyCash:closing_wizard.step2.col_denomination', 'Címlet')}</TableHead>
                <TableHead className="w-36 text-center">{t('pettyCash:closing_wizard.step2.col_count', 'Megszámolt darab')}</TableHead>
                <TableHead className="text-right">{t('pettyCash:closing_wizard.step2.col_subtotal', 'Részösszeg')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={row.denomination} className="hover:bg-muted/20">
                  <TableCell className="font-mono font-medium py-1.5">
                    {fmtBalance(row.denomination, currency)}
                  </TableCell>
                  <TableCell className="py-1.5 text-center">
                    <Input
                      type="number"
                      min={0}
                      value={row.count === 0 ? '' : row.count}
                      onChange={(e) => handleCountChange(idx, e.target.value)}
                      placeholder="0"
                      className="h-7 w-24 mx-auto text-center font-mono text-xs"
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums py-1.5 font-semibold text-foreground">
                    {fmtBalance(row.subtotal, currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter className="bg-muted/50 font-bold border-t border-border">
              <TableRow>
                <TableCell colSpan={2}>{t('pettyCash:closing_wizard.step2.total_counted', 'Összesen megszámolt készpénzállomány:')}</TableCell>
                <TableCell className="text-right font-mono text-sm text-foreground">
                  {fmtBalance(actualBalance, currency)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>

      {/* Tájékoztató üres állapotban */}
      {isInitialEmpty && (
        <div className="p-3 rounded-xl border border-blue-500/20 bg-blue-500/5 text-blue-900 dark:text-blue-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
          <div className="space-y-0.5">
            <p className="font-semibold text-xs">Címletjegyzék kitöltése</p>
            <p className="text-[11px] opacity-90 leading-relaxed">
              Számolja meg a fizikai kasszában található készpénzt, és adja meg a címletek darabszámát az alábbi jegyzékben! A rendszer automatikusan összesíti a tényleges készpénzállományt és összeveti a pénztárkönyvi záróegyenleggel.
            </p>
          </div>
        </div>
      )}

      {/* Tájékoztató sáv az eltérés következményéről */}
      {!isInitialEmpty && !isMatch && (
        <div className={cn(
          "p-3 rounded-xl border flex items-start gap-2.5",
          isSurplus ? "bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-300" : "bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-300"
        )}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">
              {isSurplus ? t('pettyCash:closing_wizard.step2.surplus_title', 'Pénztári többlet észlelve!') : t('pettyCash:closing_wizard.step2.shortage_title', 'Pénztári hiány észlelve!')}
            </p>
            <p className="text-[11px] opacity-90">
              {isSurplus 
                ? t('pettyCash:closing_wizard.step2.surplus_desc', {
                    amount: fmtBalance(difference, currency),
                    defaultValue: `A záráskor a rendszer automatikusan +${fmtBalance(difference, currency)} összegű többlet-kiegyenlítő tételt hoz létre (jogcím: Pénztári többlet, ellenszámla: 4791).`,
                  })
                : t('pettyCash:closing_wizard.step2.shortage_desc', {
                    amount: fmtBalance(Math.abs(difference), currency),
                    defaultValue: `A záráskor a rendszer automatikusan -${fmtBalance(Math.abs(difference), currency)} összegű hiány-kiegyenlítő tételt hoz létre (jogcím: Pénztári hiány, ellenszámla: 3681).`,
                  })}
              {' '}
              {t('pettyCash:closing_wizard.step2.diff_mandatory_note', 'A következő lépésben indoklás és zárási jegyzőkönyv rögzítése kötelező!')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
