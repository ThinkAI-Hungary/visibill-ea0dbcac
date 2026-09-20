import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Layers,
  Scale,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  Search,
  Pencil,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { formatThousands } from '../types';
import {
  type SteelItemRecord,
  useSteelProductsData,
  isSteelItemComplete,
} from '../hooks/useSteelProductsData';
export type { SteelItemRecord };

interface VatSteelProductsSectionProps {
  selectedCompany: any;
  year: number;
  month: number;
  frequency: 'H' | 'N' | 'E';
}

export function VatSteelProductsSection({
  selectedCompany,
  year,
  month,
  frequency,
}: VatSteelProductsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [directionFilter, setDirectionFilter] = useState<'ALL' | 'INBOUND' | 'OUTBOUND'>('ALL');
  const [completenessFilter, setCompletenessFilter] = useState<'ALL' | 'INCOMPLETE' | 'COMPLETE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const {
    steelItems,
    isLoading,
    periodLabel,
  } = useSteelProductsData(selectedCompany, year, month, frequency);

  // Filtered items
  const filteredItems = useMemo(() => {
    return steelItems.filter(item => {
      if (directionFilter !== 'ALL' && item.direction !== directionFilter) return false;
      const isComplete = isSteelItemComplete(item);
      if (completenessFilter === 'COMPLETE' && !isComplete) return false;
      if (completenessFilter === 'INCOMPLETE' && isComplete) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches =
          item.partnerName.toLowerCase().includes(q) ||
          item.partnerTaxNumber.toLowerCase().includes(q) ||
          item.invoiceNumber.toLowerCase().includes(q) ||
          (item.productCode || '').toLowerCase().includes(q) ||
          item.lineDescription.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [steelItems, directionFilter, completenessFilter, searchQuery]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalCount = 0;
    let totalWeightKg = 0;
    let totalNetAmount = 0;
    let missingVtszCount = 0;
    let missingWeightCount = 0;

    filteredItems.forEach(item => {
      totalCount += 1;
      totalWeightKg += item.netWeightKg || 0;
      totalNetAmount += item.netAmount || 0;
      if (!item.productCode || item.productCode.trim() === '') missingVtszCount += 1;
      if (item.netWeightKg == null || item.netWeightKg <= 0) missingWeightCount += 1;
    });

    const isFullyComplete = totalCount > 0 && missingVtszCount === 0 && missingWeightCount === 0;

    return {
      totalCount,
      totalWeightKg,
      totalWeightTons: Math.round((totalWeightKg / 1000) * 100) / 100,
      totalNetAmount,
      totalNetEft: Math.round(totalNetAmount / 1000),
      missingVtszCount,
      missingWeightCount,
      isFullyComplete,
    };
  }, [filteredItems]);

  // Save VTSZ & Net Weight from popover
  const handleSaveItemDetails = useCallback(
    async (item: SteelItemRecord, newCode: string | null, newWeight: number | null) => {
      const realId = item.id.replace(/^(nav_|sub_)/, '');
      try {
        const { error } = await supabase
          .from(item.sourceTable as any)
          .update({
            product_code: newCode || null,
            net_weight_kg: newWeight != null && !isNaN(newWeight) ? newWeight : null,
          })
          .eq('id', realId);

        if (error) throw error;

        queryClient.invalidateQueries({ queryKey: ['vat_steel_items'] });
        queryClient.invalidateQueries({ queryKey: ['invoiceItems'] });
        queryClient.invalidateQueries({ queryKey: ['vat_return'] });
        toast({
          title: 'Sikeres mentés',
          description: 'A VTSZ szám és a nettó tömeg frissítve.',
        });
      } catch (err: any) {
        toast({
          title: 'Hiba történt a mentés során',
          description: err.message,
          variant: 'destructive',
        });
      }
    },
    [queryClient, toast]
  );

  // CSV Export for 2665-07/08
  const handleExportCsv = useCallback(() => {
    if (filteredItems.length === 0) return;

    const headers = [
      'Irány (Nyilatkozat)',
      'Partner neve',
      'Partner adószáma (8 jegy)',
      'Bizonylatszám',
      'Teljesítés dátuma',
      'VTSZ / KN kód',
      'Tétel megnevezése',
      'Mennyiség',
      'Mértékegység',
      'Adóalap (Ft)',
      'NAV 2665 Nettó tömeg (egész kg)',
      'Pontos tömeg (kg)',
      'Validitás',
    ];

    const rows = filteredItems.map(it => [
      it.direction === 'OUTBOUND' ? 'Értékesítés (2665-07 / 04. sor)' : 'Beszerzés (2665-08 / 66. sor)',
      `"${it.partnerName.replace(/"/g, '""')}"`,
      it.partnerTaxNumber.slice(0, 8),
      `"${it.invoiceNumber}"`,
      it.deliveryDate,
      it.productCode || '',
      `"${it.lineDescription.replace(/"/g, '""')}"`,
      it.quantity ?? '',
      it.unitOfMeasure ?? '',
      Math.round(it.netAmount),
      it.netWeightKg != null ? Math.round(it.netWeightKg) : '',
      it.netWeightKg ?? '',
      it.productCode && it.netWeightKg ? 'KÉSZ' : 'HIÁNYOS',
    ]);

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `NAV_2665_07_08_Acel_Kimutatas_${year}_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'CSV letöltve',
      description: 'A 6/B szerinti vas- és acélipari analitika letöltésre került.',
    });
  }, [filteredItems, year, month, toast]);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header Banner */}
      <Card className="border border-border/80 shadow-sm bg-gradient-to-r from-card via-muted/20 to-card">
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    Áfa tv. 6/B. melléklet — Vas- és acéltermékek fordított adózási kimutatása
                    <Badge variant="outline" className="font-mono text-xs">
                      {periodLabel}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Hivatalos belföldi fordított adózású forgalom kimutatása a <strong>2665-07</strong> (értékesítő) és <strong>2665-08</strong> (beszerző) nyilatkozati lapokhoz kötelező VTSZ számmal és nettó tömeggel (kg).
                  </CardDescription>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={filteredItems.length === 0}
                className="gap-1.5 h-8 text-xs font-medium"
              >
                <Download className="w-3.5 h-3.5" />
                CSV Export (2665-07/08)
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0 pb-4">
          {/* Metrics summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
            <div className="p-3 rounded-lg bg-background border border-border/60 shadow-2xs">
              <span className="text-[11px] text-muted-foreground font-medium block">Érintett tételek</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold font-mono text-foreground">{metrics.totalCount}</span>
                <span className="text-xs text-muted-foreground">db sor</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-background border border-border/60 shadow-2xs">
              <span className="text-[11px] text-muted-foreground font-medium block">Összesített nettó tömeg</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                  {formatThousands(metrics.totalWeightKg)}
                </span>
                <span className="text-xs text-muted-foreground">kg ({metrics.totalWeightTons} t)</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-background border border-border/60 shadow-2xs">
              <span className="text-[11px] text-muted-foreground font-medium block">Összesített adóalap</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xl font-bold font-mono text-primary">
                  {formatThousands(metrics.totalNetEft)}
                </span>
                <span className="text-xs text-muted-foreground">eFt</span>
              </div>
            </div>

            <div className={cn(
              "p-3 rounded-lg border shadow-2xs flex flex-col justify-between",
              metrics.isFullyComplete
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                : metrics.totalCount === 0
                ? "bg-muted/40 border-border/60 text-muted-foreground"
                : "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300"
            )}>
              <span className="text-[11px] font-medium block">NAV 2665 Nyilatkozat státusz</span>
              <div className="flex items-center gap-1.5 mt-1">
                {metrics.isFullyComplete ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="text-xs font-bold">100% Kész & Beküldhető</span>
                  </>
                ) : metrics.totalCount === 0 ? (
                  <span className="text-xs font-medium">Nincs forgalom az időszakban</span>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                    <span className="text-xs font-bold">
                      Hiányos: {metrics.missingVtszCount > 0 ? `${metrics.missingVtszCount} VTSZ` : ''}{metrics.missingVtszCount > 0 && metrics.missingWeightCount > 0 ? ', ' : ''}{metrics.missingWeightCount > 0 ? `${metrics.missingWeightCount} Súly` : ''}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Direction filters */}
          <div className="flex bg-muted/60 border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setDirectionFilter('ALL')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all',
                directionFilter === 'ALL'
                  ? 'bg-background shadow-xs text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Mind ({steelItems.length})
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter('INBOUND')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1',
                directionFilter === 'INBOUND'
                  ? 'bg-background shadow-xs text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
              Beszerzés (66. sor / 2665-08)
            </button>
            <button
              type="button"
              onClick={() => setDirectionFilter('OUTBOUND')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1',
                directionFilter === 'OUTBOUND'
                  ? 'bg-background shadow-xs text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <ArrowUpRight className="w-3 h-3 text-blue-600" />
              Értékesítés (04. sor / 2665-07)
            </button>
          </div>

          {/* Completeness toggle */}
          <div className="flex bg-muted/60 border rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setCompletenessFilter('ALL')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                completenessFilter === 'ALL'
                  ? 'bg-background shadow-xs text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Összes
            </button>
            <button
              type="button"
              onClick={() => setCompletenessFilter('INCOMPLETE')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-all text-amber-700 dark:text-amber-400',
                completenessFilter === 'INCOMPLETE'
                  ? 'bg-background shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Csak hiányos tételek
            </button>
            <button
              type="button"
              onClick={() => setCompletenessFilter('COMPLETE')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-all text-emerald-700 dark:text-emerald-400',
                completenessFilter === 'COMPLETE'
                  ? 'bg-background shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Csak kész
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Keresés (partner, VTSZ, számla)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* Table */}
      <Card className="border border-border/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-sm">Acélipari tételek keresése és betöltése...</span>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-muted/60 flex items-center justify-center">
              <Scale className="w-6 h-6 opacity-40" />
            </div>
            <p className="font-medium text-sm">Nem található 6/B acélipari tétel a megadott szűrési feltételekkel.</p>
            <p className="text-xs opacity-75">
              A listában az Áfa tv. 6/B. melléklete szerinti termékek (VTSZ 72xx, 73xx), a fordított adós acéltermékek (FAD_ACEL_27), illetve a rögzített tömegű tételek jelennek meg.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 text-xs">
                  <TableHead className="w-24">Irány / Lap</TableHead>
                  <TableHead>Partner neve & Adószáma</TableHead>
                  <TableHead className="w-32">Bizonylatszám</TableHead>
                  <TableHead className="w-24">Teljesítés</TableHead>
                  <TableHead className="w-36">VTSZ / KN kód</TableHead>
                  <TableHead>Tétel megnevezése</TableHead>
                  <TableHead className="text-right w-24">Mennyiség</TableHead>
                  <TableHead className="text-right w-28">Nettó összeg</TableHead>
                  <TableHead className="text-right w-28">Nettó tömeg</TableHead>
                  <TableHead className="w-24 text-center">Státusz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map(item => {
                  const isOut = item.direction === 'OUTBOUND';
                  const hasVtsz = Boolean(item.productCode && item.productCode.trim() !== '');
                  const hasWeight = Boolean(item.netWeightKg != null && item.netWeightKg > 0);
                  const isItemComplete = hasVtsz && hasWeight;

                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        'hover:bg-muted/30 transition-colors text-xs',
                        !isItemComplete && 'bg-amber-500/5'
                      )}
                    >
                      {/* Direction badge */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] font-medium border gap-1 whitespace-nowrap',
                            isOut
                              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30'
                              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                          )}
                        >
                          {isOut ? (
                            <>
                              <ArrowUpRight className="w-3 h-3" />
                              04. / 07-lap
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="w-3 h-3" />
                              66. / 08-lap
                            </>
                          )}
                        </Badge>
                      </TableCell>

                      {/* Partner */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-semibold text-foreground truncate max-w-[180px]" title={item.partnerName}>
                            {item.partnerName}
                          </p>
                          <p className="text-[11px] font-mono text-muted-foreground">
                            {item.partnerTaxNumber ? item.partnerTaxNumber.slice(0, 8) : '—'}
                          </p>
                        </div>
                      </TableCell>

                      {/* Invoice number */}
                      <TableCell className="font-mono font-medium text-foreground">
                        {item.invoiceNumber}
                      </TableCell>

                      {/* Delivery Date */}
                      <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                        {item.deliveryDate}
                      </TableCell>

                      {/* VTSZ code with quick edit popover */}
                      <TableCell>
                        <SteelItemDetailPopover
                          item={item}
                          onSave={handleSaveItemDetails}
                        />
                      </TableCell>

                      {/* Description */}
                      <TableCell>
                        <span className="truncate block max-w-[220px]" title={item.lineDescription}>
                          {item.lineDescription}
                        </span>
                      </TableCell>

                      {/* Quantity */}
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.quantity != null
                          ? `${formatThousands(item.quantity)} ${item.unitOfMeasure || ''}`
                          : '—'}
                      </TableCell>

                      {/* Net Amount */}
                      <TableCell className="text-right font-mono font-semibold text-foreground whitespace-nowrap">
                        {formatThousands(Math.round(item.netAmount))} Ft
                      </TableCell>

                      {/* Net weight (kg) */}
                      <TableCell className="text-right font-mono whitespace-nowrap">
                        {hasWeight ? (
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {formatThousands(item.netWeightKg)} kg
                          </span>
                        ) : (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 italic bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                            Hiányzik!
                          </span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        {isItemComplete ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Kész
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400" title="Kattints a VTSZ mezőre a hiányzó adatok pótlásához!">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Hiányos
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Inline Popover for Editing VTSZ & Weight ──
function SteelItemDetailPopover({
  item,
  onSave,
}: {
  item: SteelItemRecord;
  onSave: (item: SteelItemRecord, newCode: string | null, newWeight: number | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [productCode, setProductCode] = useState(item.productCode || '');
  const [weightKg, setWeightKg] = useState(item.netWeightKg != null ? String(item.netWeightKg) : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsedWeight = weightKg.trim() !== '' ? parseFloat(weightKg.replace(',', '.')) : null;
      await onSave(
        item,
        productCode.trim() !== '' ? productCode.trim() : null,
        parsedWeight != null && !isNaN(parsedWeight) ? parsedWeight : null
      );
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const hasVtsz = Boolean(item.productCode && item.productCode.trim() !== '');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'group inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border transition-all cursor-pointer',
            hasVtsz
              ? 'bg-background border-border/70 hover:bg-muted text-foreground'
              : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
          )}
        >
          <span>{hasVtsz ? item.productCode : '+ VTSZ megadás'}</span>
          <Pencil className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3.5 z-[120] shadow-xl border-border bg-popover space-y-3" align="start">
        <div className="flex items-center justify-between border-b pb-2">
          <h4 className="font-semibold text-xs">VTSZ & Súly módosítása</h4>
          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">6/B melléklet</span>
        </div>
        <div className="space-y-2 text-xs">
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">VTSZ / KN kód (pl. 7214 20 00)</Label>
            <Input
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder="7214 20 00"
              className="h-7 text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-medium text-muted-foreground">Nettó tömeg (kg)</Label>
            <Input
              type="number"
              step="any"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              placeholder="1250"
              className="h-7 text-xs font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              A NAV 2665-07/08 nyilatkozat egész kg-ban kéri az adatot (a rendszer exportkor kerekíti).
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-1.5 pt-1 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-7 text-xs"
            disabled={saving}
          >
            Mégse
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="h-7 text-xs gap-1"
            disabled={saving}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            Mentés
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
