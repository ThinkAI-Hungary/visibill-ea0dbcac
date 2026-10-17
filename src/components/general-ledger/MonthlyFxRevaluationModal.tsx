import React, { useState, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ArrowRightLeft, TrendingUp, TrendingDown, CheckCircle2, AlertCircle } from 'lucide-react';
import { invalidateGlQueries } from '@/lib/cache';

interface RevalItem {
  gl_account_id: string;
  gl_number: string;
  short_name: string;
  currency: string;
  foreign_balance: number;
  book_balance_huf: number;
  reval_rate: number;
  revalued_huf: number;
  diff_huf: number;
  is_gain: boolean;
}

interface MonthlyFxRevaluationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | undefined;
  activePresetId?: string | null;
}

export function MonthlyFxRevaluationModal({
  open,
  onOpenChange,
  companyId,
  activePresetId,
}: MonthlyFxRevaluationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Alapértelmezett fordulónap: előző hónap utolsó napja
  const defaultRevalDate = useMemo(() => {
    const d = new Date();
    // 0th day of current month is last day of previous month
    const lastDayPrevMonth = new Date(d.getFullYear(), d.getMonth(), 0);
    return lastDayPrevMonth.toISOString().split('T')[0];
  }, []);

  const [revalDate, setRevalDate] = useState<string>(defaultRevalDate);
  const [autoReverse, setAutoReverse] = useState<boolean>(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Átértékelési kalkuláció lekérdezése
  const {
    data: revalItems = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<RevalItem[]>({
    queryKey: ['monthlyFxRevaluation', companyId, revalDate],
    queryFn: async () => {
      if (!companyId || !revalDate) return [];
      const { data, error } = await supabase.rpc('calculate_monthly_fx_revaluation', {
        p_company_id: companyId,
        p_reval_date: revalDate,
      });

      if (error) throw error;
      return (data || []) as unknown as RevalItem[];
    },
    enabled: open && !!companyId && !!revalDate,
  });

  // Alapértelmezetten minden kalkulált tétel be van jelölve
  useEffect(() => {
    if (revalItems && revalItems.length > 0) {
      setSelectedIds(new Set(revalItems.map((item) => item.gl_account_id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [revalItems]);

  const toggleSelectAll = () => {
    if (selectedIds.size === revalItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(revalItems.map((item) => item.gl_account_id)));
    }
  };

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Összesítések
  const selectedItems = useMemo(() => {
    return revalItems.filter((item) => selectedIds.has(item.gl_account_id));
  }, [revalItems, selectedIds]);

  const totals = useMemo(() => {
    let totalGain = 0;
    let totalLoss = 0;
    for (const item of selectedItems) {
      if (item.diff_huf > 0) {
        totalGain += item.diff_huf;
      } else {
        totalLoss += Math.abs(item.diff_huf);
      }
    }
    return {
      totalGain,
      totalLoss,
      net: totalGain - totalLoss,
    };
  }, [selectedItems]);

  // Lekönyvelési mutáció
  const postMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Nincs kiválasztott cég!');
      if (selectedItems.length === 0) throw new Error('Nincs kijelölt tétel!');

      const itemsPayload = selectedItems.map((item) => ({
        gl_account_id: item.gl_account_id,
        diff_huf: item.diff_huf,
        is_gain: item.is_gain,
        currency: item.currency,
        foreign_balance: item.foreign_balance,
        reval_rate: item.reval_rate,
      }));

      const { data, error } = await supabase.rpc('post_monthly_fx_revaluation', {
        p_company_id: companyId,
        p_reval_date: revalDate,
        p_items: itemsPayload as any,
        p_auto_reverse: autoReverse,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (data: any) => {
      toast({
        title: 'Sikeres átértékelés!',
        description: `${data?.items_revalued || selectedItems.length} számla átértékelve (${data?.reval_doc_number || 'VE-DEV'}). ${autoReverse ? 'Másnapi stornó bizonylat elkészült.' : ''}`,
        className: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100',
      });

      if (companyId) {
        await invalidateGlQueries(queryClient, companyId, activePresetId || undefined);
        await queryClient.invalidateQueries({ queryKey: ['glBalances'] });
        await queryClient.invalidateQueries({ queryKey: ['glItems'] });
        await queryClient.invalidateQueries({ queryKey: ['journalHeaders'] });
      }

      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: 'Hiba a könyvelés során',
        description: err.message || 'Nem sikerült az átértékelés lekönyvelése.',
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="shrink-0 pb-2 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Hó végi Devizaátértékelés (8763 / 9763)</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Nyitott devizás eszközök és források nem realizált árfolyamkülönbözetének elszámolása MNB fordulónapi árfolyamon.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Paraméterek sáv */}
        <div className="shrink-0 py-3 px-4 bg-muted/30 rounded-lg border border-border/60 flex flex-wrap items-center justify-between gap-4 mt-3">
          <div className="flex items-center gap-3">
            <Label htmlFor="reval-date" className="text-xs font-semibold text-foreground shrink-0">
              Fordulónap:
            </Label>
            <Input
              id="reval-date"
              type="date"
              value={revalDate}
              onChange={(e) => setRevalDate(e.target.value)}
              className="h-8 text-xs w-36"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="h-8 px-2.5 text-xs gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              Újraszámolás
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="auto-reverse"
              checked={autoReverse}
              onCheckedChange={(checked) => setAutoReverse(!!checked)}
            />
            <Label htmlFor="auto-reverse" className="text-xs font-medium cursor-pointer">
              Automatikus fordított stornó a tárgyhót követő hó 1-jére
            </Label>
          </div>
        </div>

        {/* Tételek táblázata */}
        <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[380px] border rounded-lg mt-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
              <p className="text-xs">Devizás egyenlegek és árfolyamok kalkulálása...</p>
            </div>
          ) : revalItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2 opacity-80" />
              <h4 className="font-semibold text-foreground text-sm">Nincs átértékelendő devizás tétel</h4>
              <p className="text-xs max-w-md mt-1">
                A megadott fordulónapon ({revalDate}) nincs olyan devizás számla (`is_monthly_fx_reval = true`), amelynél a könyv szerinti érték eltérne az MNB árfolyamon átszámított értéktől.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10 text-xs">
                <TableRow>
                  <TableHead className="w-10 px-3">
                    <Checkbox
                      checked={selectedIds.size === revalItems.length && revalItems.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-24">Számla</TableHead>
                  <TableHead>Megnevezés</TableHead>
                  <TableHead className="text-right">Deviza egyenleg</TableHead>
                  <TableHead className="text-right">Könyv szerinti (HUF)</TableHead>
                  <TableHead className="text-right">MNB Árf.</TableHead>
                  <TableHead className="text-right">Átértékelt (HUF)</TableHead>
                  <TableHead className="text-right">Árf. Különbözet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {revalItems.map((item) => {
                  const isChecked = selectedIds.has(item.gl_account_id);
                  return (
                    <TableRow
                      key={item.gl_account_id}
                      className={isChecked ? 'bg-primary/[0.02]' : 'opacity-60'}
                    >
                      <TableCell className="px-3">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleItem(item.gl_account_id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono font-semibold">{item.gl_number}</TableCell>
                      <TableCell className="font-medium truncate max-w-[160px]">{item.short_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {item.foreign_balance.toLocaleString('hu-HU', { minimumFractionDigits: 2 })} {item.currency}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.book_balance_huf.toLocaleString('hu-HU')} Ft
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.reval_rate.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {item.revalued_huf.toLocaleString('hu-HU')} Ft
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {item.diff_huf > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            +{item.diff_huf.toLocaleString('hu-HU')} Ft
                          </span>
                        ) : (
                          <span className="text-rose-600 dark:text-rose-400 flex items-center justify-end gap-1">
                            <TrendingDown className="w-3.5 h-3.5" />
                            {item.diff_huf.toLocaleString('hu-HU')} Ft
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Összesítő sáv */}
        {revalItems.length > 0 && (
          <div className="shrink-0 p-3 bg-muted/40 rounded-lg border border-border/50 flex flex-wrap items-center justify-between gap-4 mt-3 text-xs">
            <div className="flex items-center gap-4">
              <span>
                Kijelölve: <strong>{selectedItems.length}</strong> / {revalItems.length} db
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">
                Nyereség (9763): <strong>+{totals.totalGain.toLocaleString('hu-HU')} Ft</strong>
              </span>
              <span className="text-rose-600 dark:text-rose-400">
                Veszteség (8763): <strong>-{totals.totalLoss.toLocaleString('hu-HU')} Ft</strong>
              </span>
            </div>

            <div className="text-sm font-semibold">
              Nettó hatás:{' '}
              <span className={totals.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {totals.net >= 0 ? '+' : ''}{totals.net.toLocaleString('hu-HU')} Ft
              </span>
            </div>
          </div>
        )}

        <DialogFooter className="shrink-0 pt-3 border-t border-border/40 mt-3 flex items-center justify-between sm:justify-between w-full">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button
            size="sm"
            onClick={() => postMutation.mutate()}
            disabled={postMutation.isPending || selectedItems.length === 0}
            className="gap-1.5"
          >
            {postMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Könyvelés folyamatban...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Átértékelés lekönyvelése ({selectedItems.length} tétel)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
