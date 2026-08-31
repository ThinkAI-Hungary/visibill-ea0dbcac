import React from 'react';
import { Shield, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { A60CalculationsResult } from '../types';

interface VatA60TableProps {
  a60Calculations: A60CalculationsResult;
  viesStatuses: Record<string, 'valid' | 'invalid' | 'loading' | null>;
  isValidatingVies: boolean;
  handleViesCheck: () => Promise<void>;
  setEuTypeOverrides: React.Dispatch<React.SetStateAction<Record<string, 'product' | 'service'>>>;
}

export function VatA60Table({
  a60Calculations,
  viesStatuses,
  isValidatingVies,
  handleViesCheck,
  setEuTypeOverrides,
}: VatA60TableProps) {
  return (
    <Card className="border border-border/80 shadow-md">
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Shield
              className={cn('w-4 h-4', a60Calculations.isValid ? 'text-emerald-500' : 'text-amber-500')}
            />
            Közösségi Ügyletek (A60) Keresztellenőrzése
          </CardTitle>
          <CardDescription className="text-xs">
            A60-as összesítő nyilatkozat számláinak összevetése a főlap 91-92. és 93-94. soraival
          </CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleViesCheck}
          disabled={isValidatingVies || a60Calculations.itemsList.length === 0}
          className="h-8 text-xs font-semibold gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 border-indigo-500/20 dark:text-indigo-400 shrink-0"
        >
          {isValidatingVies ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Lekérdezés...
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
              Minden közösségi tranzakció helyes, az összesített összegek egyeznek a bevallással és
              minden adószám érvényes.
            </span>
          </div>
        ) : (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 p-3 rounded-lg text-xs space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Eltérés vagy hiányzó közösségi adószám észlelhető!</span>
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

        {/* Goods and Services Crosscheck comparison grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Goods Comparison */}
          <div
            className={cn(
              'p-3 rounded-lg border text-xs space-y-2',
              a60Calculations.goodsMismatch
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-border/60 bg-muted/30'
            )}
          >
            <div className="flex justify-between items-center">
              <span className="font-semibold text-muted-foreground">Közösségi Termékértékesítés</span>
              <Badge
                className={cn(
                  'text-[10px]',
                  a60Calculations.goodsMismatch
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                )}
              >
                {a60Calculations.goodsMismatch ? 'Eltérés!' : 'Egyezik'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-muted-foreground">Számlák alapján:</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {a60Calculations.goodsSum.toLocaleString('hu-HU')} eFt
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Bevallás (91+92. sor):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {a60Calculations.expectedGoods.toLocaleString('hu-HU')} eFt
                </p>
              </div>
            </div>
            {a60Calculations.goodsMismatch && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 pt-1 border-t border-amber-500/10">
                Eltérés:{' '}
                {Math.abs(a60Calculations.goodsSum - a60Calculations.expectedGoods).toLocaleString(
                  'hu-HU'
                )}{' '}
                eFt
              </p>
            )}
          </div>

          {/* Services Comparison */}
          <div
            className={cn(
              'p-3 rounded-lg border text-xs space-y-2',
              a60Calculations.servicesMismatch
                ? 'border-amber-500/20 bg-amber-500/5'
                : 'border-border/60 bg-muted/30'
            )}
          >
            <div className="flex justify-between items-center">
              <span className="font-semibold text-muted-foreground">Közösségi Szolgáltatásnyújtás</span>
              <Badge
                className={cn(
                  'text-[10px]',
                  a60Calculations.servicesMismatch
                    ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                )}
              >
                {a60Calculations.servicesMismatch ? 'Eltérés!' : 'Egyezik'}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-muted-foreground">Számlák alapján:</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {a60Calculations.servicesSum.toLocaleString('hu-HU')} eFt
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Bevallás (93+94. sor):</span>
                <p className="font-bold font-mono text-sm mt-0.5">
                  {a60Calculations.expectedServices.toLocaleString('hu-HU')} eFt
                </p>
              </div>
            </div>
            {a60Calculations.servicesMismatch && (
              <p className="text-[10px] text-amber-600 dark:text-amber-300 pt-1 border-t border-amber-500/10">
                Eltérés:{' '}
                {Math.abs(
                  a60Calculations.servicesSum - a60Calculations.expectedServices
                ).toLocaleString('hu-HU')}{' '}
                eFt
              </p>
            )}
          </div>
        </div>

        {/* Invoices list and toggle actions */}
        <div className="border border-border/60 rounded-lg overflow-hidden">
          <div className="bg-muted/40 p-2 text-xs font-semibold border-b border-border/60 flex justify-between items-center">
            <span>Észlelt közösségi (EU) bizonylatok listája ({a60Calculations.itemsList.length})</span>
            <span className="text-[10px] text-muted-foreground font-normal">
              Kattints a típus gombra a besorolás megváltoztatásához
            </span>
          </div>
          <ScrollArea className="max-h-60 overflow-y-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Számlaszám</TableHead>
                  <TableHead>Partner neve</TableHead>
                  <TableHead>Közösségi adószám</TableHead>
                  <TableHead className="text-right">Nettó összeg</TableHead>
                  <TableHead className="text-right">A60 Típus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a60Calculations.itemsList.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium font-mono">{item.invoice_number}</TableCell>
                    <TableCell>{item.partner_name}</TableCell>
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
                              return <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />;
                            }
                            if (status === 'valid') {
                              return (
                                <Badge
                                  variant="outline"
                                  className="bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[9px] px-1 py-0 select-none"
                                >
                                  ✓ VIES Aktív
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
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {item.invoice_net_amount.toLocaleString('hu-HU')} {item.currency}
                      <span className="block text-[10px] text-muted-foreground">
                        ({item.amountEft.toLocaleString('hu-HU')} eFt)
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex bg-muted/60 border border-border/80 rounded-md p-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEuTypeOverrides((prev) => ({
                              ...prev,
                              [item.id]: 'product',
                            }));
                          }}
                          className={cn(
                            'px-2 py-1 text-[10px] font-bold rounded transition-all',
                            !item.isService
                              ? 'bg-background shadow-sm text-foreground font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Termék
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEuTypeOverrides((prev) => ({
                              ...prev,
                              [item.id]: 'service',
                            }));
                          }}
                          className={cn(
                            'px-2 py-1 text-[10px] font-bold rounded transition-all',
                            item.isService
                              ? 'bg-background shadow-sm text-foreground font-semibold'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          Szolg.
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
