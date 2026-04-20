import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useReactivateAsset } from '@/hooks/useFixedAssets';
import { formatCurrency } from '@/lib/utils';
import type { FixedAsset } from '@/types/fixed-assets';

interface ReactivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset;
}

export function ReactivationDialog({ open, onOpenChange, asset }: ReactivationDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const reactivate = useReactivateAsset();

  const [additionalValue, setAdditionalValue] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  const parsedValue = parseFloat(additionalValue) || 0;
  const newTotal = asset.acquisition_value + parsedValue;

  const handleSubmit = async () => {
    if (!user || !selectedCompany || parsedValue <= 0) return;

    try {
      await reactivate.mutateAsync({
        assetId: asset.id,
        companyId: selectedCompany.id,
        userId: user.id,
        additionalValue: parsedValue,
        eventDate,
        description: description.trim() || undefined,
        oldAcquisitionValue: asset.acquisition_value,
      });

      toast({ title: 'Siker', description: `Ráaktiválás: +${formatCurrency(parsedValue, asset.currency)}` });
      onOpenChange(false);
      setAdditionalValue('');
      setDescription('');
    } catch {
      toast({ title: 'Hiba', description: 'Nem sikerült a ráaktiválás.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-warning" />
            Ráaktiválás / Értéknövelés
          </DialogTitle>
          <DialogDescription>
            <strong>{asset.name}</strong> bekerülési értékének növelése.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current value summary */}
          <div className="rounded-lg border border-border/50 p-3 bg-muted/20 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Jelenlegi bekerülési érték:</span>
              <span className="font-mono font-medium">{formatCurrency(asset.acquisition_value, asset.currency)}</span>
            </div>
            {parsedValue > 0 && (
              <>
                <div className="flex justify-between text-warning">
                  <span>Ráaktiválás összege:</span>
                  <span className="font-mono font-medium">+{formatCurrency(parsedValue, asset.currency)}</span>
                </div>
                <div className="h-px bg-border/50 my-1" />
                <div className="flex justify-between font-medium">
                  <span>Új bekerülési érték:</span>
                  <span className="font-mono font-bold text-primary">{formatCurrency(newTotal, asset.currency)}</span>
                </div>
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label>Értéknövelés összege ({asset.currency}) *</Label>
            <Input
              type="number"
              min="1"
              value={additionalValue}
              onChange={e => setAdditionalValue(e.target.value)}
              placeholder="Pl. 50000"
            />
          </div>

          <div className="space-y-2">
            <Label>Ráaktiválás dátuma</Label>
            <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Megjegyzés</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Pl. RAM bővítés, SSD csere..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button
            onClick={handleSubmit}
            disabled={parsedValue <= 0 || reactivate.isPending}
            className="gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            {reactivate.isPending ? 'Ráaktiválás...' : 'Ráaktiválás'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
