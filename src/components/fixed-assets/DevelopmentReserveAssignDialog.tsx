import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Landmark, Trash2 } from 'lucide-react';
import {
  useDevelopmentReserves,
  useAssignDevelopmentReserve,
  useAssetReserveAllocations,
  useSaveAssetReserveAllocations,
} from '@/hooks/useDevelopmentReserves';
import { DevelopmentReserveAllocationSelector, type AllocationItem } from './DevelopmentReserveAllocationSelector';
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
  const { data: reserves = [] } = useDevelopmentReserves(asset.company_id);
  const { data: existingAllocations = [] } = useAssetReserveAllocations(asset.id);
  const saveAllocationsMutation = useSaveAssetReserveAllocations();
  const assignMutation = useAssignDevelopmentReserve();

  const [reserveAllocations, setReserveAllocations] = useState<AllocationItem[]>([]);
  const [postToLedger, setPostToLedger] = useState<boolean>(true);

  // Sync state whenever dialog opens with asset and loaded allocations
  useEffect(() => {
    if (open) {
      if (existingAllocations && existingAllocations.length > 0) {
        setReserveAllocations(
          existingAllocations.map(a => ({
            reserveId: a.reserve_id,
            amount: Number(a.allocated_amount) || 0,
          }))
        );
      } else if (asset.development_reserve_id && Number(asset.development_reserve_amount) > 0) {
        setReserveAllocations([
          {
            reserveId: asset.development_reserve_id,
            amount: Number(asset.development_reserve_amount),
          },
        ]);
      } else {
        setReserveAllocations([]);
      }
      setPostToLedger(true);
    }
  }, [open, asset, existingAllocations]);

  const totalAllocated = reserveAllocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const isPending = saveAllocationsMutation.isPending || assignMutation.isPending;

  const handleClearAll = () => {
    setReserveAllocations([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validAllocations = reserveAllocations.filter(a => Number(a.amount) > 0);
    const totalAmount = validAllocations.reduce((sum, a) => sum + Number(a.amount), 0);
    const isRemoving = totalAmount <= 0;
    const targetReserveId = isRemoving ? null : validAllocations[0]?.reserveId || null;

    if (totalAmount > asset.acquisition_value) {
      toast({
        title: t('hr:fixed_assets.dev_reserve_assign_dialog.toast_invalid_amount_title', 'Érvénytelen összeg'),
        description: t('hr:fixed_assets.dev_reserve_assign_dialog.toast_invalid_amount_desc', {
          defaultValue: `A fejlesztési tartalék összege nem haladhatja meg a bekerülési értéket (${formatCurrency(asset.acquisition_value, asset.currency)}).`,
          maxAmount: formatCurrency(asset.acquisition_value, asset.currency),
        }),
        variant: 'destructive',
      });
      return;
    }

    try {
      // 1. Mentjük a többéves kapcsolótáblát
      await saveAllocationsMutation.mutateAsync({
        companyId: asset.company_id,
        assetId: asset.id,
        allocations: validAllocations,
      });

      // 2. Szinkronizáljuk a vegyes naplót és az aktiválási jegyzőkönyvet
      await assignMutation.mutateAsync({
        assetId: asset.id,
        companyId: asset.company_id,
        userId: user?.id,
        reserveId: targetReserveId,
        reserveAmount: totalAmount,
        postToLedger,
      });

      toast({
        title: isRemoving
          ? t('hr:fixed_assets.dev_reserve_assign_dialog.toast_detached', 'Fejlesztési tartalék leválasztva')
          : t('hr:fixed_assets.dev_reserve_assign_dialog.toast_assigned', 'Fejlesztési tartalék sikeresen beállítva'),
        description: isRemoving
          ? t('hr:fixed_assets.dev_reserve_assign_dialog.toast_detached_desc', 'Az eszközről eltávolítottuk a tartalékot, a könyvelés és a jegyzőkönyv frissült.')
          : t('hr:fixed_assets.dev_reserve_assign_dialog.toast_assigned_desc', {
              defaultValue: `${formatCurrency(totalAmount, asset.currency)} fedezet hozzárendelve, Vegyes napló és jegyzőkönyv frissítve.`,
              amount: formatCurrency(totalAmount, asset.currency),
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
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <Landmark className="h-5 w-5" />
            <DialogTitle>{t('hr:fixed_assets.dev_reserve_assign_dialog.title', 'Fejlesztési Tartalék Hozzárendelése (Többéves / FIFO)')}</DialogTitle>
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
              <span className="font-bold text-foreground font-mono">{formatCurrency(asset.acquisition_value, asset.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('hr:fixed_assets.dev_reserve_assign_dialog.activation_date', 'Aktiválás dátuma:')}</span>
              <span className="font-medium text-foreground">{asset.activation_date}</span>
            </div>
          </div>

          {/* FIFO and multi-year selector */}
          <div className="border border-border/70 rounded-lg p-3 bg-card space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border/40">
              <span className="text-xs font-semibold text-foreground">
                Többéves keretfelosztás (FIFO / Egyedi)
              </span>
              {totalAllocated > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-6 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Tartalék leválasztása (0 Ft)
                </Button>
              )}
            </div>

            <DevelopmentReserveAllocationSelector
              acquisitionValue={asset.acquisition_value}
              reserves={reserves}
              allocations={reserveAllocations}
              onChange={setReserveAllocations}
              currency={asset.currency}
            />
          </div>

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
                {totalAllocated > 0
                  ? t('hr:fixed_assets.dev_reserve_assign_dialog.post_ledger_desc_assign', 'Generálja a T 414 (Lekötött tartalék) - K 413 (Eredménytartalék) tételt a Vegyes naplóba.')
                  : t('hr:fixed_assets.dev_reserve_assign_dialog.post_ledger_desc_remove', 'Eltávolítja az eszközhöz kapcsolódó korábbi FT-FELOLD vegyes napló tételt.')}
              </p>
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('common:actions.cancel', 'Mégse')}
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isPending ? t('common:actions.saving', 'Mentés...') : t('hr:fixed_assets.dev_reserve_assign_dialog.btn_save_changes', 'Módosítás mentése')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
