import { useState } from 'react';
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
        title: 'Siker',
        description: disposalType === 'sold'
          ? `Eszköz értékesítve: ${asset.name}`
          : `Eszköz selejtezve: ${asset.name}`,
      });
      onOpenChange(false);
      setReason('');
      setSaleValue('');
    } catch {
      toast({ title: 'Hiba', description: 'Nem sikerült a kivezetés.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Selejtezés / Kivezetés
          </DialogTitle>
          <DialogDescription>
            <strong>{asset.name}</strong> kivezetése a nyilvántartásból.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-warning">Figyelem!</p>
              <p className="text-muted-foreground">
                A kivezetés után az eszköz nem szerkeszthető. A bekerülési érték:&nbsp;
                <strong>{formatCurrency(asset.acquisition_value, asset.currency)}</strong>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Kivezetés típusa *</Label>
            <Select value={disposalType} onValueChange={(v) => setDisposalType(v as 'disposed' | 'sold')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="disposed">Selejtezés (megsemmisítés)</SelectItem>
                <SelectItem value="sold">Értékesítés</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {disposalType === 'sold' && (
            <div className="space-y-2">
              <Label>Értékesítési ár ({asset.currency})</Label>
              <Input
                type="number"
                min="0"
                value={saleValue}
                onChange={e => setSaleValue(e.target.value)}
                placeholder="Eladási ár"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Kivezetés dátuma *</Label>
            <Input type="date" value={disposalDate} onChange={e => setDisposalDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Indoklás / Megjegyzés</Label>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Pl. Meghibásodás, elavulás, értékesítés..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={dispose.isPending}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {dispose.isPending ? 'Kivezetés...' : 'Kivezetés végrehajtása'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
