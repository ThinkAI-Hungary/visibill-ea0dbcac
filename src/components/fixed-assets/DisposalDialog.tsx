import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDisposeAsset } from '@/hooks/useFixedAssets';
import { formatCurrency } from '@/lib/utils';
import type { FixedAsset } from '@/types/fixed-assets';

interface DisposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset;
}

export function DisposalDialog({ open, onOpenChange, asset }: DisposalDialogProps) {
  const { t } = useTranslation('hr');
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const dispose = useDisposeAsset();

  const [disposalType, setDisposalType] = useState<'disposed' | 'sold'>('disposed');
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [saleValue, setSaleValue] = useState('');

  const handleSubmit = async () => {
    if (!user || !selectedCompany) return;

    try {
      await dispose.mutateAsync({
        assetId: asset.id,
        companyId: selectedCompany.id,
        userId: user.id,
        disposalDate,
        status: disposalType,
        reason: reason.trim() || undefined,
        saleValue: disposalType === 'sold' ? (parseFloat(saleValue) || 0) : undefined,
      });

      toast({
        title: t('fixed_assets.disposal_dialog.toasts.success_title'),
        description: disposalType === 'sold'
          ? t('fixed_assets.disposal_dialog.toasts.success_sold', { name: asset.name })
          : t('fixed_assets.disposal_dialog.toasts.success_disposed', { name: asset.name }),
      });
      onOpenChange(false);
      setReason('');
      setSaleValue('');
    } catch {
      toast({ title: t('fixed_assets.disposal_dialog.toasts.error_title'), description: t('fixed_assets.disposal_dialog.toasts.error_desc'), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            {t('fixed_assets.disposal_dialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('fixed_assets.disposal_dialog.description', { name: asset.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-warning">{t('fixed_assets.disposal_dialog.warning_title')}</p>
              <p className="text-muted-foreground">
                {t('fixed_assets.disposal_dialog.warning_desc', {
                  value: formatCurrency(asset.acquisition_value, asset.currency)
                })}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('fixed_assets.disposal_dialog.type_label')}</Label>
            <Select value={disposalType} onValueChange={(v) => setDisposalType(v as 'disposed' | 'sold')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disposed">{t('fixed_assets.disposal_dialog.type_disposed')}</SelectItem>
                <SelectItem value="sold">{t('fixed_assets.disposal_dialog.type_sold')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {disposalType === 'sold' && (
            <div className="space-y-2">
              <Label>{t('fixed_assets.disposal_dialog.sale_value_label', { currency: asset.currency })}</Label>
              <Input
                type="number"
                min="0"
                value={saleValue}
                onChange={e => setSaleValue(e.target.value)}
                placeholder={t('fixed_assets.disposal_dialog.sale_value_placeholder')}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>{t('fixed_assets.disposal_dialog.date_label')}</Label>
            <Input type="date" value={disposalDate} onChange={e => setDisposalDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t('fixed_assets.disposal_dialog.reason_label')}</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t('fixed_assets.disposal_dialog.reason_placeholder')}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('fixed_assets.disposal_dialog.cancel')}</Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={dispose.isPending}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {dispose.isPending ? t('fixed_assets.disposal_dialog.submitting') : t('fixed_assets.disposal_dialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
