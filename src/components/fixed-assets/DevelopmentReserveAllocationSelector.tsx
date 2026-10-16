import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';
import type { DevelopmentReserve } from '@/types/fixed-assets';
import { calculateFifoReserveAllocation } from '@/lib/fixed-assets/developmentReserveAllocationService';
import { formatCurrency } from '@/lib/utils';

export interface AllocationItem {
  reserveId: string;
  amount: number;
}

interface DevelopmentReserveAllocationSelectorProps {
  acquisitionValue: number;
  reserves: DevelopmentReserve[];
  allocations: AllocationItem[];
  onChange: (allocations: AllocationItem[]) => void;
  currency?: string;
}

export function DevelopmentReserveAllocationSelector({
  acquisitionValue,
  reserves,
  allocations,
  onChange,
  currency = 'HUF',
}: DevelopmentReserveAllocationSelectorProps) {
  const { t } = useTranslation(['hr', 'common']);
  const [fifoTargetAmount, setFifoTargetAmount] = useState<number | ''>(acquisitionValue || '');

  // Csak az aktív keretek
  const [todayStr] = useState(() => new Date().toISOString().split('T')[0]);
  const activeReserves = useMemo(() => {
    return reserves
      .filter(r => (r.remaining_amount || 0) > 0 && r.expiration_date >= todayStr)
      .sort((a, b) => a.creation_year - b.creation_year);
  }, [reserves, todayStr]);

  const totalAllocated = useMemo(() => {
    return allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  }, [allocations]);

  const remainingTaxBase = Math.max(0, (acquisitionValue || 0) - totalAllocated);

  const handleApplyFifo = () => {
    const target = Number(fifoTargetAmount) || acquisitionValue || 0;
    if (target <= 0) return;

    const result = calculateFifoReserveAllocation(reserves, target);
    const newAllocations = result.allocations.map(a => ({
      reserveId: a.reserveId,
      amount: a.allocatedAmount,
    }));

    onChange(newAllocations);
  };

  const handleAmountChange = (reserveId: string, value: string) => {
    const num = value === '' ? 0 : Math.max(0, Number(value));
    const existing = allocations.find(a => a.reserveId === reserveId);

    let next: AllocationItem[];
    if (existing) {
      next = allocations.map(a => a.reserveId === reserveId ? { ...a, amount: num } : a);
    } else {
      next = [...allocations, { reserveId, amount: num }];
    }

    onChange(next.filter(a => a.amount > 0));
  };

  const handleSetMax = (reserve: DevelopmentReserve) => {
    const reserveAvailable = Number(reserve.remaining_amount) || 0;
    const currentAllocatedWithoutThis = allocations
      .filter(a => a.reserveId !== reserve.id)
      .reduce((sum, a) => sum + a.amount, 0);

    const maxCanTake = Math.max(0, acquisitionValue - currentAllocatedWithoutThis);
    const take = Math.min(reserveAvailable, maxCanTake);

    handleAmountChange(reserve.id, take.toString());
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-3.5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
      {/* FIFO intelligens generáló sáv */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-amber-500/20">
        <div>
          <div className="flex items-center gap-1.5 font-semibold text-foreground text-xs uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" />
            <span>{t('hr:fixed_assets.dev_reserve.fifo_title', 'Több évi keret együttes felhasználása (FIFO)')}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t('hr:fixed_assets.dev_reserve.fifo_desc', 'A rendszer automatikusan a legrégebben képzett szabad keretekből von le.')}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Input
            type="number"
            min="1"
            max={acquisitionValue}
            value={fifoTargetAmount}
            onChange={e => setFifoTargetAmount(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={acquisitionValue.toString()}
            className="h-8 w-28 text-xs font-mono bg-background"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleApplyFifo}
            className="h-8 text-xs gap-1 font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 border border-amber-500/30"
          >
            <Sparkles className="h-3 w-3" />
            <span>{t('hr:fixed_assets.dev_reserve.fifo_btn', 'FIFO Javaslat')}</span>
          </Button>
          {allocations.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClearAll}
              className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              {t('common:actions.clear', 'Törlés')}
            </Button>
          )}
        </div>
      </div>

      {/* Keretek táblázata */}
      <div className="space-y-2">
        {activeReserves.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2 text-center">
            {t('hr:fixed_assets.dev_reserve.no_active_reserves', 'Nincs aktív, szabad fejlesztési tartalék keret a cégben.')}
          </p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {activeReserves.map(r => {
              const currentAlloc = allocations.find(a => a.reserveId === r.id)?.amount || '';
              const available = Number(r.remaining_amount) || 0;
              const isOverAllocated = Number(currentAlloc) > available;

              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 p-2 rounded bg-background/80 border border-border/50 text-xs"
                >
                  <div className="min-w-0 flex-1 flex items-center gap-2">
                    <span className="font-bold font-mono px-1.5 py-0.5 rounded bg-muted text-foreground shrink-0">
                      {r.creation_year}. év
                    </span>
                    <div className="truncate">
                      <span className="text-muted-foreground">Szabad: </span>
                      <span className="font-semibold font-mono text-foreground">
                        {formatCurrency(available, currency)}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-2 hidden sm:inline">
                        (Lejár: {r.expiration_date})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetMax(r)}
                      className="h-7 px-1.5 text-[10px] font-mono"
                      title="Szabad keret vagy hiányzó összeg beírása"
                    >
                      Max
                    </Button>
                    <Input
                      type="number"
                      min="0"
                      max={available}
                      value={currentAlloc}
                      onChange={e => handleAmountChange(r.id, e.target.value)}
                      placeholder="0"
                      className={`h-7 w-28 text-xs font-mono text-right ${isOverAllocated ? 'border-destructive text-destructive' : ''}`}
                    />
                    <span className="text-[11px] text-muted-foreground font-mono w-7">{currency}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Összesítő sáv */}
      <div className="pt-2 border-t border-amber-500/20 space-y-1 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">{t('hr:fixed_assets.dev_reserve.total_deduction', 'Összes tartalék levonás:')}</span>
          <span className="font-bold font-mono text-amber-700 dark:text-amber-400">
            -{formatCurrency(totalAllocated, currency)}
          </span>
        </div>
        <div className="flex justify-between items-center font-semibold">
          <span className="text-foreground">{t('hr:fixed_assets.dev_reserve.remaining_tax_base', 'Maradvány TAO ÉCS alap:')}</span>
          <span className="font-bold font-mono text-primary">
            {formatCurrency(remainingTaxBase, currency)}
          </span>
        </div>
        {totalAllocated >= acquisitionValue && acquisitionValue > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 mt-1">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>{t('hr:fixed_assets.dev_reserve.fully_funded_note', '100% lefedve fejlesztési tartalékkal: a Tao. tv. 7. § (15) szerint Tao ÉCS nem számolható el.')}</span>
          </div>
        )}
        {totalAllocated > acquisitionValue && (
          <div className="flex items-center gap-1.5 text-[11px] text-destructive mt-1">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{t('hr:fixed_assets.dev_reserve.exceeds_acquisition', 'A felhasznált tartalék meghaladja a bekerülési értéket!')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
