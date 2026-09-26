import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Percent, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatThousands } from '../types';

interface VatRateSummaryCardsProps {
  lines: any[];
  lineMap?: Record<string, any>;
  unpaidVatEft?: number;
  periodLabel?: string;
  isCroatia?: boolean;
}

interface RateGroup {
  label: string;
  badgeVariant?: 'default' | 'secondary' | 'outline';
  dotColor?: string;
  payableBase: number;
  payableTax: number;
  deductibleBase: number;
  deductibleTax: number;
  balance: number;
}

export function VatRateSummaryCards({
  lines,
  lineMap = {},
  unpaidVatEft = 0,
  periodLabel,
  isCroatia = false,
}: VatRateSummaryCardsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const unit = isCroatia ? '€' : 'eFt';

  // Compute rate breakdown from lines
  const rateGroups: RateGroup[] = useMemo(() => {
    // 27%
    const p27Base = Number(lineMap['07']?.base_amount_rounded || 0);
    const p27Tax = Number(lineMap['07']?.tax_amount_rounded || 0);
    const d27Base = Number(lineMap['66']?.base_amount_rounded || 0);
    const d27Tax = Number(lineMap['66']?.tax_amount_rounded || 0);

    // 18%
    const p18Base = Number(lineMap['06']?.base_amount_rounded || 0);
    const p18Tax = Number(lineMap['06']?.tax_amount_rounded || 0);
    const d18Base = Number(lineMap['65']?.base_amount_rounded || 0);
    const d18Tax = Number(lineMap['65']?.tax_amount_rounded || 0);

    // 5%
    const p5Base = Number(lineMap['05']?.base_amount_rounded || 0);
    const p5Tax = Number(lineMap['05']?.tax_amount_rounded || 0);
    const d5Base = Number(lineMap['64']?.base_amount_rounded || 0);
    const d5Tax = Number(lineMap['64']?.tax_amount_rounded || 0);

    // Mentes (01, 02 sorok, export, EU mentes, 110. sor)
    const pMentesBase =
      Number(lineMap['01']?.base_amount_rounded || 0) +
      Number(lineMap['02']?.base_amount_rounded || 0) +
      Number(lineMap['110']?.base_amount_rounded || 0);
    const dMentesBase = Number(lineMap['63']?.base_amount_rounded || 0);

    // Fordított adózás (FAD: 04. sor kimenő, 29. sor fizetendő, 66_fad levonható)
    const p04Base = Number(lineMap['04']?.base_amount_rounded || 0);
    const p29Tax = Number(lineMap['29']?.tax_amount_rounded || 0);
    const p29Base = Number(lineMap['29']?.base_amount_rounded || (p29Tax > 0 ? Math.round(p29Tax / 0.27) : 0));
    const dFadTax = Number(lineMap['66_fad']?.tax_amount_rounded || p29Tax);
    const dFadBase = Number(lineMap['66_fad']?.base_amount_rounded || (dFadTax > 0 ? Math.round(dFadTax / 0.27) : p29Base));

    const pFadBase = p29Base + p04Base;
    const pFadTax = p29Tax;

    const groups: RateGroup[] = [
      {
        label: '27%-os',
        dotColor: 'bg-red-500',
        payableBase: p27Base,
        payableTax: p27Tax,
        deductibleBase: d27Base,
        deductibleTax: d27Tax,
        balance: p27Tax - d27Tax,
      },
      {
        label: '18%-os',
        dotColor: 'bg-blue-500',
        payableBase: p18Base,
        payableTax: p18Tax,
        deductibleBase: d18Base,
        deductibleTax: d18Tax,
        balance: p18Tax - d18Tax,
      },
      {
        label: '5%-os',
        dotColor: 'bg-emerald-500',
        payableBase: p5Base,
        payableTax: p5Tax,
        deductibleBase: d5Base,
        deductibleTax: d5Tax,
        balance: p5Tax - d5Tax,
      },
      {
        label: 'Mentes / 0%',
        dotColor: 'bg-slate-400',
        payableBase: pMentesBase,
        payableTax: 0,
        deductibleBase: dMentesBase,
        deductibleTax: 0,
        balance: 0,
      },
    ];

    if (pFadBase > 0 || pFadTax > 0 || dFadBase > 0 || dFadTax > 0) {
      groups.push({
        label: 'Fordított (FAD)',
        dotColor: 'bg-amber-500',
        payableBase: pFadBase,
        payableTax: pFadTax,
        deductibleBase: dFadBase,
        deductibleTax: dFadTax,
        balance: pFadTax - dFadTax,
      });
    }

    return groups;
  }, [lineMap]);

  // Overall totals
  const overallTotals = useMemo(() => {
    let pBase = 0;
    let pTax = 0;
    let dBase = 0;
    let dTax = 0;

    rateGroups.forEach((g) => {
      pBase += g.payableBase;
      pTax += g.payableTax;
      dBase += g.deductibleBase;
      dTax += g.deductibleTax;
    });

    return {
      pBase,
      pTax,
      dBase,
      dTax,
      balance: pTax - dTax,
    };
  }, [rateGroups]);

  return (
    <Card className="border border-border/70 shadow-sm overflow-hidden bg-card">
      <CardHeader className="py-2 px-4 bg-muted/20 border-b border-border/60 flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Percent className="w-4 h-4 text-primary shrink-0" />
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground truncate">
            ÁFA kulcsonkénti összesítés és adóalapok
          </CardTitle>
          {periodLabel && (
            <Badge variant="outline" className="text-[10px] font-normal shrink-0">
              {periodLabel}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="hidden sm:inline text-muted-foreground">
            Fizetendő:{' '}
            <strong className="text-foreground font-semibold tabular-nums">
              {formatThousands(overallTotals.pTax)} {unit}
            </strong>
          </span>
          <span className="hidden sm:inline text-muted-foreground">
            Levonható:{' '}
            <strong className="text-foreground font-semibold tabular-nums">
              {formatThousands(overallTotals.dTax)} {unit}
            </strong>
          </span>
          <span className="pl-2 border-l border-border/60">
            Egyenleg:{' '}
            <strong
              className={cn(
                'font-bold tabular-nums',
                overallTotals.balance > 0
                  ? 'text-red-500'
                  : overallTotals.balance < 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-foreground'
              )}
            >
              {formatThousands(overallTotals.balance)} {unit}
            </strong>
          </span>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground gap-1 ml-1"
          >
            <span className="hidden md:inline">{isExpanded ? 'Összecsukás' : 'Bontás'}</span>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 transition-transform duration-200',
                !isExpanded && '-rotate-90'
              )}
            />
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-0 animate-in fade-in duration-200">
          <Table className="text-xs">
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="w-40 font-semibold py-2">ÁFA kulcs</TableHead>
                <TableHead className="text-right w-32 font-semibold">Fiz. alap ({unit})</TableHead>
                <TableHead className="text-right w-32 font-semibold text-red-500 dark:text-red-400">
                  Fizetendő ÁFA ({unit})
                </TableHead>
                <TableHead className="text-right w-32 font-semibold">Lev. alap ({unit})</TableHead>
                <TableHead className="text-right w-32 font-semibold text-emerald-600 dark:text-emerald-400">
                  Levonható ÁFA ({unit})
                </TableHead>
                <TableHead className="text-right w-36 font-bold bg-muted/40 text-foreground">
                  Egyenleg ({unit})
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/20">
              {rateGroups.map((group) => (
                <TableRow key={group.label} className="hover:bg-muted/20">
                  <TableCell className="font-medium py-1.5 px-4 flex items-center gap-2">
                    {group.dotColor && (
                      <span className={cn('w-2 h-2 rounded-full shrink-0', group.dotColor)} />
                    )}
                    <span>{group.label}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatThousands(group.payableBase)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-foreground">
                    {formatThousands(group.payableTax)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatThousands(group.deductibleBase)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-foreground">
                    {formatThousands(group.deductibleTax)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums font-bold bg-muted/10',
                      group.balance > 0
                        ? 'text-red-500'
                        : group.balance < 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                    )}
                  >
                    {formatThousands(group.balance)}
                  </TableCell>
                </TableRow>
              ))}

              {/* Total Row */}
              <TableRow className="bg-muted/40 font-bold border-t-2 border-border/80">
                <TableCell className="py-2 px-4 uppercase text-xs">Összesen</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">
                  {formatThousands(overallTotals.pBase)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-red-500 dark:text-red-400 font-bold">
                  {formatThousands(overallTotals.pTax)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-foreground">
                  {formatThousands(overallTotals.dBase)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-bold">
                  {formatThousands(overallTotals.dTax)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right tabular-nums text-xs font-extrabold bg-muted/60',
                    overallTotals.balance > 0
                      ? 'text-red-500'
                      : overallTotals.balance < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-foreground'
                  )}
                >
                  {formatThousands(overallTotals.balance)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}

