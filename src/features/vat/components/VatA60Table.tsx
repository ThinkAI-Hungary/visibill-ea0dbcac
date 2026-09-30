import React, { useState, useMemo } from 'react';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ExternalLink,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { type A60CalculationsResult, fmtEft, formatThousands } from '../types';

interface VatA60TableProps {
  a60Calculations: A60CalculationsResult;
  viesStatuses: Record<string, 'valid' | 'invalid' | 'loading' | null>;
  isValidatingVies: boolean;
  handleViesCheck: (singleTaxNumber?: string) => Promise<void>;
  setEuTypeOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}

export function VatA60Table({
  a60Calculations,
  viesStatuses,
  isValidatingVies,
  handleViesCheck,
  setEuTypeOverrides,
}: VatA60TableProps) {
  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'OUTBOUND' | 'INBOUND'>('ALL');

  const filteredItems = useMemo(() => {
    if (directionFilter === 'ALL') return a60Calculations.itemsList;
    return a60Calculations.itemsList.filter(
      (item) => item.invoice_direction === directionFilter
    );
  }, [a60Calculations.itemsList, directionFilter]);

  const outboundCount = useMemo(
    () => a60Calculations.itemsList.filter((i) => i.invoice_direction === 'OUTBOUND').length,
    [a60Calculations.itemsList]
  );
  const inboundCount = useMemo(
    () => a60Calculations.itemsList.filter((i) => i.invoice_direction === 'INBOUND').length,
    [a60Calculations.itemsList]
  );

  return (
    <Card className="border border-border/80 shadow-md">
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Shield
              className={cn(
                'w-4 h-4',
                a60Calculations.isValid ? 'text-emerald-500' : 'text-amber-500'
              )}
            />
            Közösségi Ügyletek (A60) Keresztellenőrzése
          </CardTitle>
          <CardDescription className="text-xs">
            A60-as összesítő nyilatkozat számláinak összevetése a 65-ös bevallás soraival (02., 11–16., 91–92. és 18. sorok)
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleViesCheck()}
          disabled={isValidatingVies}
          title={
            a60Calculations.itemsList.length === 0
              ? 'Nincs közösségi adószámmal rendelkező partner ebben az időszakban'
              : 'Összes közösségi adószám lekérdezése az EU VIES adatbázisból'
          }
          className="h-8 text-xs font-semibold gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 border-indigo-500/20 dark:text-indigo-400 shrink-0"
        >
          {isValidatingVies ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              VIES Lekérdezés...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
              VIES Adószám Ellenőrzés
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Info Banner */}
        {a60Calculations.isValid ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 p-3 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>
              Minden közösségi tranzakció (02., 11–16., 91–92., 18. sor) helyes, az összesített összegek egyeznek a 65-ös bevallással és minden adószám érvényes.
            </span>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-lg text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Eltérés vagy hiányzó közösségi adószám észlelhető a 65-ös bevallás soraihoz képest!</span>
            </div>
            {a60Calculations.taxErrors.length > 0 && (
              <ul className="list-disc pl-5 mt-1 space-y-0.5 text-[11px] text-amber-600 dark:text-amber-300">
                {a60Calculations.taxErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* 4 Statutory Comparison Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Közösségi Termékértékesítés -> 02. sor */}
          <div
            className={cn(
              'p-3 rounded-lg border text-xs space-y-2 transition-all',
              a60Calculations.goodsOutMismatch
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-border/60 bg-muted/30'
            )}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                <span>Termékértékesítés</span>
              </div>
              <Badge
                className={cn(
                  'text-[10px]',
                  a60Calculations.goodsOutMismatch
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                )}
              >
                {a60Calculations.goodsOutMismatch ? 'Eltérés!' : 'Egyezik'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-muted-foreground">Számlák (Kimenő):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.goodsOutSum)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Bevallás (02. sor):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.expectedGoodsOut)}
                </p>
              </div>
            </div>
            {a60Calculations.goodsOutMismatch && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 pt-1 border-t border-amber-500/10">
                Eltérés:{' '}
                {fmtEft(Math.abs(a60Calculations.goodsOutSum - a60Calculations.expectedGoodsOut))}
              </p>
            )}
          </div>

          {/* 2. Közösségi Termékbeszerzés -> 11-16. sorok */}
          <div
            className={cn(
              'p-3 rounded-lg border text-xs space-y-2 transition-all',
              a60Calculations.goodsInMismatch
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-border/60 bg-muted/30'
            )}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <ArrowDownLeft className="w-3.5 h-3.5 text-blue-500" />
                <span>Termékbeszerzés</span>
              </div>
              <Badge
                className={cn(
                  'text-[10px]',
                  a60Calculations.goodsInMismatch
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                )}
              >
                {a60Calculations.goodsInMismatch ? 'Eltérés!' : 'Egyezik'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-muted-foreground">Számlák (Bejövő):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.goodsInSum)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Bevallás (11-16. sor):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.expectedGoodsIn)}
                </p>
              </div>
            </div>
            {a60Calculations.goodsInMismatch && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 pt-1 border-t border-amber-500/10">
                Eltérés:{' '}
                {fmtEft(Math.abs(a60Calculations.goodsInSum - a60Calculations.expectedGoodsIn))}
              </p>
            )}
          </div>

          {/* 3. Közösségi Szolgáltatásnyújtás -> 91-92. sorok */}
          <div
            className={cn(
              'p-3 rounded-lg border text-xs space-y-2 transition-all',
              a60Calculations.servicesOutMismatch
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-border/60 bg-muted/30'
            )}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                <span>Szolgáltatásnyújtás</span>
              </div>
              <Badge
                className={cn(
                  'text-[10px]',
                  a60Calculations.servicesOutMismatch
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                )}
              >
                {a60Calculations.servicesOutMismatch ? 'Eltérés!' : 'Egyezik'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-muted-foreground">Számlák (Kimenő):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.servicesOutSum)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Bevallás (91-92. sor):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.expectedServicesOut)}
                </p>
              </div>
            </div>
            {a60Calculations.servicesOutMismatch && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 pt-1 border-t border-amber-500/10">
                Eltérés:{' '}
                {fmtEft(Math.abs(a60Calculations.servicesOutSum - a60Calculations.expectedServicesOut))}
              </p>
            )}
          </div>

          {/* 4. Közösségi Szolgáltatás igénybevétele -> 18. sor */}
          <div
            className={cn(
              'p-3 rounded-lg border text-xs space-y-2 transition-all',
              a60Calculations.servicesInMismatch
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-border/60 bg-muted/30'
            )}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1 font-semibold text-foreground">
                <ArrowDownLeft className="w-3.5 h-3.5 text-blue-500" />
                <span>Szolgáltatás igénybevétel</span>
              </div>
              <Badge
                className={cn(
                  'text-[10px]',
                  a60Calculations.servicesInMismatch
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                )}
              >
                {a60Calculations.servicesInMismatch ? 'Eltérés!' : 'Egyezik'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-muted-foreground">Számlák (Bejövő/Google):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.servicesInSum)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Bevallás (18. sor):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {fmtEft(a60Calculations.expectedServicesIn)}
                </p>
              </div>
            </div>
            {a60Calculations.servicesInMismatch && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 pt-1 border-t border-amber-500/10">
                Eltérés:{' '}
                {fmtEft(Math.abs(a60Calculations.servicesInSum - a60Calculations.expectedServicesIn))}
              </p>
            )}
          </div>
        </div>

        {/* Invoices list filter bar and table */}
        <div className="border border-border/60 rounded-lg overflow-hidden">
          <div className="bg-muted/40 p-2.5 text-xs font-semibold border-b border-border/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span>Közösségi (EU) számlák listája ({filteredItems.length})</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                (Átváltva a 65-ös bevallási soraiba)
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={directionFilter === 'ALL' ? 'secondary' : 'ghost'}
                onClick={() => setDirectionFilter('ALL')}
                className="h-6 text-[10px] px-2"
              >
                Mind ({a60Calculations.itemsList.length})
              </Button>
              <Button
                size="sm"
                variant={directionFilter === 'OUTBOUND' ? 'secondary' : 'ghost'}
                onClick={() => setDirectionFilter('OUTBOUND')}
                className="h-6 text-[10px] px-2 text-emerald-600 dark:text-emerald-400"
              >
                Kimenő ({outboundCount})
              </Button>
              <Button
                size="sm"
                variant={directionFilter === 'INBOUND' ? 'secondary' : 'ghost'}
                onClick={() => setDirectionFilter('INBOUND')}
                className="h-6 text-[10px] px-2 text-blue-600 dark:text-blue-400"
              >
                Bejövő ({inboundCount})
              </Button>
            </div>
          </div>
          <ScrollArea className="max-h-72 overflow-y-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Irány</TableHead>
                  <TableHead>Számlaszám</TableHead>
                  <TableHead>Partner neve</TableHead>
                  <TableHead>Közösségi adószám & VIES</TableHead>
                  <TableHead className="text-right">Nettó összeg</TableHead>
                  <TableHead className="text-center w-36">Besorolás</TableHead>
                  <TableHead className="text-right w-24">65-ös sor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      Nem található közösségi (EU) számla a kiválasztott szűrésben.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const isOut = item.invoice_direction === 'OUTBOUND';
                    const targetRow =
                      item.category === 'goods_out'
                        ? '02'
                        : item.category === 'goods_in'
                        ? '11-16'
                        : item.category === 'services_out'
                        ? '91-92'
                        : '18';

                    return (
                      <TableRow key={item.id} className="hover:bg-muted/20">
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] px-1.5 py-0 font-medium flex items-center gap-1 w-max',
                              isOut
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400'
                                : 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400'
                            )}
                          >
                            {isOut ? (
                              <>
                                <ArrowUpRight className="w-2.5 h-2.5" />
                                Kimenő
                              </>
                            ) : (
                              <>
                                <ArrowDownLeft className="w-2.5 h-2.5" />
                                Bejövő
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono font-medium">
                          {item.invoice_number}
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            {item.invoice_delivery_date}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">{item.partner_name}</div>
                          {item.country_code && (
                            <span className="text-[10px] text-muted-foreground font-mono uppercase">
                              [{item.country_code}]
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={cn(
                                'px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-max',
                                item.isValidFormat
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                                  : 'bg-red-500/10 text-red-600 dark:bg-red-950/40 dark:text-red-400'
                              )}
                            >
                              {item.isValidFormat ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <AlertTriangle className="w-3 h-3 text-red-500" />
                              )}
                              {item.partner_tax_number || 'HIÁNYZIK!'}
                            </span>
                            {item.partner_tax_number &&
                              (() => {
                                const status = viesStatuses[item.partner_tax_number];
                                if (status === 'loading') {
                                  return (
                                    <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                                  );
                                }
                                if (status === 'valid') {
                                  return (
                                    <Badge
                                      variant="outline"
                                      className="bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[9px] px-1 py-0 select-none"
                                    >
                                      ✓ VIES Érvényes
                                    </Badge>
                                  );
                                }
                                if (status === 'invalid') {
                                  return (
                                    <Badge
                                      variant="outline"
                                      className="bg-red-500/20 border-red-500/40 text-red-600 dark:text-red-400 text-[9px] px-1 py-0 select-none"
                                    >
                                      ⚠️ VIES Inaktív
                                    </Badge>
                                  );
                                }
                                return null;
                              })()}
                            {item.partner_tax_number && (
                              <button
                                type="button"
                                title="VIES újraellenőrzése ennél a számlánál"
                                onClick={() => handleViesCheck(item.partner_tax_number)}
                                className="text-muted-foreground hover:text-indigo-600 p-0.5 rounded transition-colors"
                              >
                                <RefreshCw className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatThousands(item.invoice_net_amount, { decimals: 2 })}{' '}
                          {item.currency}
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            ({fmtEft(item.amountEft)})
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {isOut ? (
                            <div className="inline-flex bg-muted/60 border border-border/80 rounded-md p-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEuTypeOverrides((prev) => ({
                                    ...prev,
                                    [item.id]: 'goods_out',
                                  }));
                                }}
                                className={cn(
                                  'px-2 py-0.5 text-[10px] font-bold rounded transition-all',
                                  item.category === 'goods_out'
                                    ? 'bg-background shadow-sm text-foreground font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                Termék (02)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEuTypeOverrides((prev) => ({
                                    ...prev,
                                    [item.id]: 'services_out',
                                  }));
                                }}
                                className={cn(
                                  'px-2 py-0.5 text-[10px] font-bold rounded transition-all',
                                  item.category === 'services_out'
                                    ? 'bg-background shadow-sm text-foreground font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                Szolg. (91-92)
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex bg-muted/60 border border-border/80 rounded-md p-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEuTypeOverrides((prev) => ({
                                    ...prev,
                                    [item.id]: 'goods_in',
                                  }));
                                }}
                                className={cn(
                                  'px-2 py-0.5 text-[10px] font-bold rounded transition-all',
                                  item.category === 'goods_in'
                                    ? 'bg-background shadow-sm text-foreground font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                Termék (11-16)
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEuTypeOverrides((prev) => ({
                                    ...prev,
                                    [item.id]: 'services_in',
                                  }));
                                }}
                                className={cn(
                                  'px-2 py-0.5 text-[10px] font-bold rounded transition-all',
                                  item.category === 'services_in'
                                    ? 'bg-background shadow-sm text-foreground font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                                )}
                              >
                                Szolg. (18)
                              </button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {targetRow}. sor
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}

