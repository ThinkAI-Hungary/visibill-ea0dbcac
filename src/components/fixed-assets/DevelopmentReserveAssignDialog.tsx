import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Landmark, AlertCircle, CheckCircle2, ShieldAlert, Sparkles, BookOpen } from 'lucide-react';
import { useDevelopmentReserves, useAssignDevelopmentReserve } from '@/hooks/useDevelopmentReserves';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import type { FixedAsset } from '@/types/fixed-assets';

interface DevelopmentReserveAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset;
}

export function DevelopmentReserveAssignDialog({
  open,
  onOpenChange,
  asset,
}: DevelopmentReserveAssignDialogProps) {
  const { t } = useTranslation(['hr', 'common']);
  const { user } = useAuth();
  const { data: reserves = [], isLoading: loadingReserves } = useDevelopmentReserves(asset.company_id);
  const assignMutation = useAssignDevelopmentReserve();

  const currentReserveId = asset.development_reserve_id || 'none';
  const currentAmount = Number(asset.development_reserve_amount) || 0;

  const [selectedReserveId, setSelectedReserveId] = useState<string>(currentReserveId);
  const [reserveAmount, setReserveAmount] = useState<number>(currentAmount);
  const [postToLedger, setPostToLedger] = useState<boolean>(true);

  // Sync state whenever dialog opens with asset
  useEffect(() => {
    if (open) {
      setSelectedReserveId(asset.development_reserve_id || 'none');
      setReserveAmount(Number(asset.development_reserve_amount) || 0);
      setPostToLedger(true);
    }
  }, [open, asset]);

  const selectedReserve = reserves.find(r => r.id === selectedReserveId);

  // Available limit: reserve remaining amount + what this asset currently uses
  const currentlyAllocatedToThisAsset = asset.development_reserve_id === selectedReserveId ? currentAmount : 0;
  const maxAvailableFromReserve = selectedReserve
    ? selectedReserve.remaining_amount + currentlyAllocatedToThisAsset
    : 0;

  const maxAllowableAmount = Math.min(asset.acquisition_value, maxAvailableFromReserve);
  const adjustedTaoBase = Math.max(0, asset.acquisition_value - (selectedReserveId !== 'none' ? reserveAmount : 0));

  const handleReserveChange = (val: string) => {
    setSelectedReserveId(val);
    if (val === 'none') {
      setReserveAmount(0);
    } else {
      const res = reserves.find(r => r.id === val);
      const isSameAsCurrent = asset.development_reserve_id === val;
      const effectiveRemaining = res ? res.remaining_amount + (isSameAsCurrent ? currentAmount : 0) : 0;
      // Default to min(asset acquisition, remaining)
      const defaultAmount = Math.min(asset.acquisition_value, effectiveRemaining);
      setReserveAmount(defaultAmount);
    }
  };

  const handleFullCoverage = () => {
    setReserveAmount(maxAllowableAmount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const isRemoving = selectedReserveId === 'none' || reserveAmount <= 0;
    const targetReserveId = isRemoving ? null : selectedReserveId;
    const targetAmount = isRemoving ? 0 : reserveAmount;

    if (!isRemoving && targetAmount > maxAllowableAmount) {
      toast({
        title: t('hr:fixed_assets.dev_reserve_assign_dialog.toast_invalid_amount_title', 'Érvénytelen összeg'),
        description: t('hr:fixed_assets.dev_reserve_assign_dialog.toast_invalid_amount_desc', {
          defaultValue: `A fejlesztési tartalék összege nem haladhatja meg a rendelkezésre álló keretet (${formatCurrency(maxAllowableAmount, asset.currency)}).`,
          maxAmount: formatCurrency(maxAllowableAmount, asset.currency),
        }),
        variant: 'destructive',
      });
      return;
    }

    try {
      await assignMutation.mutateAsync({
        assetId: asset.id,
        companyId: asset.company_id,
        userId: user?.id,
        reserveId: targetReserveId,
        reserveAmount: targetAmount,
        postToLedger,
      });

      toast({
        title: isRemoving
          ? t('hr:fixed_assets.dev_reserve_assign_dialog.toast_detached', 'Fejlesztési tartalék leválasztva')
          : t('hr:fixed_assets.dev_reserve_assign_dialog.toast_assigned', 'Fejlesztési tartalék sikeresen beállítva'),
        description: isRemoving
          ? t('hr:fixed_assets.dev_reserve_assign_dialog.toast_detached_desc', 'Az eszközről eltávolítottuk a tartalékot, a könyvelés és a jegyzőkönyv frissült.')
          : t('hr:fixed_assets.dev_reserve_assign_dialog.toast_assigned_desc', {
              defaultValue: `${formatCurrency(targetAmount, asset.currency)} fedezet hozzárendelve, Vegyes napló és jegyzőkönyv frissítve.`,
              amount: formatCurrency(targetAmount, asset.currency),
            }),
      });

      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: t('common:status.error', 'Hiba a mentés során'),
        description: err?.message || t('common:status.error', 'Nem sikerült módosítani a fejlesztési tartalékot.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <Landmark className="h-5 w-5" />
            <DialogTitle>{t('hr:fixed_assets.dev_reserve_assign_dialog.title', 'Fejlesztési Tartalék Hozzárendelése')}</DialogTitle>
          </div>
          <DialogDescription>
            {t('hr:fixed_assets.dev_reserve_assign_dialog.desc', {
              defaultValue: `Kapcsolja össze a(z) ${asset.name} (${asset.inventory_number}) eszközt a képzett fejlesztési tartalékkal (Tao. tv. 7. § (15)).`,
              name: asset.name,
              invNumber: asset.inventory_number,
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Asset basic info card */}
          <div className="bg-muted/40 p-3 rounded-lg border text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('hr:fixed_assets.dev_reserve_assign_dialog.acquisition_value', 'Bekerülési (bruttó) érték:')}</span>
              <span className="font-bold text-foreground">{formatCurrency(asset.acquisition_value, asset.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('hr:fixed_assets.dev_reserve_assign_dialog.activation_date', 'Aktiválás dátuma:')}</span>
              <span className="font-medium text-foreground">{asset.activation_date}</span>
            </div>
          </div>

          {/* Reserve Selector */}
          <div className="space-y-1.5">
            <Label htmlFor="reserve-select" className="text-xs font-semibold">
              {t('hr:fixed_assets.dev_reserve_assign_dialog.select_reserve_label', 'Képzett fejlesztési tartalék kiválasztása')}
            </Label>
            <Select value={selectedReserveId} onValueChange={handleReserveChange} disabled={loadingReserves}>
              <SelectTrigger id="reserve-select">
                <SelectValue
                  placeholder={
                    loadingReserves
                      ? t('common:status.loading', 'Betöltés...')
                      : t('hr:fixed_assets.create_dialog.dev_reserve_frame', 'Válasszon fejlesztési tartalékot...')
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <span className="text-muted-foreground italic">
                    {t('hr:fixed_assets.dev_reserve_assign_dialog.no_reserve_option', 'Nincs fejlesztési tartalék hozzárendelés')}
                  </span>
                </SelectItem>
                {reserves.map(r => {
                  const isCurrent = asset.development_reserve_id === r.id;
                  const avail = r.remaining_amount + (isCurrent ? currentAmount : 0);
                  return (
                    <SelectItem key={r.id} value={r.id} disabled={avail <= 0 && !isCurrent}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {t('hr:fixed_assets.dev_reserve_assign_dialog.reserve_option', {
                            defaultValue: `${r.creation_year}. évi keret (Szabad: ${formatCurrency(avail, asset.currency)})`,
                            year: r.creation_year,
                            amount: formatCurrency(avail, asset.currency),
                          })}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">
                            {t('hr:fixed_assets.dev_reserve_assign_dialog.currently_linked', 'Jelenleg kapcsolt')}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {reserves.length === 0 && !loadingReserves && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 text-amber-600 mt-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {t('hr:fixed_assets.dev_reserve_assign_dialog.no_reserves_hint', 'A cégnél még nincs rögzített fejlesztési tartalék keret. A Fejlesztési Tartalékok fülön hozhat létre újat.')}
              </p>
            )}
          </div>

          {/* Amount input if reserve selected */}
          {selectedReserveId !== 'none' && (
            <div className="space-y-3 p-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg border border-amber-200/60 dark:border-amber-800/60">
              <div className="flex items-center justify-between">
                <Label htmlFor="reserve-amount" className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  {t('hr:fixed_assets.dev_reserve_assign_dialog.amount_label', 'Felhasznált fejlesztési tartalék (Ft)')}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleFullCoverage}
                  className="h-6 text-[11px] text-amber-700 hover:text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {t('hr:fixed_assets.dev_reserve_assign_dialog.max_button', {
                    defaultValue: `Max (${formatCurrency(maxAllowableAmount, asset.currency)})`,
                    amount: formatCurrency(maxAllowableAmount, asset.currency),
                  })}
                </Button>
              </div>

              <Input
                id="reserve-amount"
                type="number"
                min="0"
                max={maxAllowableAmount}
                step="1"
                value={reserveAmount || ''}
                onChange={e => setReserveAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="font-mono text-right"
              />

              {/* Tax effect calculation preview */}
              <div className="rounded border bg-background/80 p-2.5 text-xs space-y-1.5">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>{t('hr:fixed_assets.dev_reserve_assign_dialog.calc_acq_base', 'Számviteli ÉCS alap:')}</span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(asset.acquisition_value - asset.residual_value, asset.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-amber-700 dark:text-amber-400">
                  <span>{t('hr:fixed_assets.dev_reserve_assign_dialog.calc_reserve_deduction', 'Tartalék levonás:')}</span>
                  <span className="font-semibold">
                    -{formatCurrency(reserveAmount, asset.currency)}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t pt-1 font-bold">
                  <span className="text-foreground">{t('hr:fixed_assets.dev_reserve_assign_dialog.calc_modified_tax_base', 'Módosított Tao ÉCS alap:')}</span>
                  <span className={adjustedTaoBase === 0 ? 'text-amber-600' : 'text-primary'}>
                    {formatCurrency(adjustedTaoBase, asset.currency)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground pt-1 flex items-start gap-1">
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" />
                  <span>
                    <strong>Tao. tv. 7. § (15):</strong>{' '}
                    {t('hr:fixed_assets.dev_reserve_assign_dialog.tax_rule_explanation', {
                      defaultValue: `A fejlesztési tartalékból fedezett részre (${formatCurrency(reserveAmount, asset.currency)}) nem számolható el adótörvény szerinti értékcsökkenés.`,
                      amount: formatCurrency(reserveAmount, asset.currency),
                    })}
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Ledger Posting Checkbox */}
          <div className="flex items-start space-x-2 pt-1">
            <Checkbox
              id="post-ledger"
              checked={postToLedger}
              onCheckedChange={checked => setPostToLedger(!!checked)}
            />
            <div className="grid gap-1 leading-none">
              <label
                htmlFor="post-ledger"
                className="text-xs font-medium leading-tight peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                {t('hr:fixed_assets.dev_reserve_assign_dialog.post_ledger_label', 'Automatikus Vegyes napló könyvelés szinkronizálása')}
              </label>
              <p className="text-[11px] text-muted-foreground">
                {selectedReserveId !== 'none' && reserveAmount > 0
                  ? t('hr:fixed_assets.dev_reserve_assign_dialog.post_ledger_desc_assign', 'Generálja a T 414 (Lekötött tartalék) - K 413 (Eredménytartalék) tételt a Vegyes naplóba.')
                  : t('hr:fixed_assets.dev_reserve_assign_dialog.post_ledger_desc_remove', 'Eltávolítja az eszközhöz kapcsolódó korábbi FT-FELOLD vegyes napló tételt.')}
              </p>
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common:actions.cancel', 'Mégse')}
            </Button>
            <Button
              type="submit"
              disabled={assignMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {assignMutation.isPending ? t('common:actions.saving', 'Mentés...') : t('hr:fixed_assets.dev_reserve_assign_dialog.btn_save_changes', 'Módosítás mentése')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
