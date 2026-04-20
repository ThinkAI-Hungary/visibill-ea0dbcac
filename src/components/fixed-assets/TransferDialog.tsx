import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRightLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useCompanyLocations } from '@/hooks/useCompanyLocations';
import { useTransferAsset } from '@/hooks/useFixedAssets';
import type { FixedAsset } from '@/types/fixed-assets';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset;
}

export function TransferDialog({ open, onOpenChange, asset }: TransferDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { locations } = useCompanyLocations(selectedCompany?.id);
  const transfer = useTransferAsset();

  const [newLocationId, setNewLocationId] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!user || !selectedCompany || !newLocationId) return;

    const newLocation = locations.find(l => l.id === newLocationId);
    if (!newLocation) return;

    try {
      await transfer.mutateAsync({
        assetId: asset.id,
        companyId: selectedCompany.id,
        userId: user.id,
        newLocationId,
        newLocationName: newLocation.name,
        oldLocationName: asset.location?.name || 'Nincs megadva',
        eventDate,
        description: description.trim() || undefined,
      });

      toast({ title: 'Siker', description: `Eszköz áthelyezve: ${newLocation.name}` });
      onOpenChange(false);
      setNewLocationId('');
      setDescription('');
    } catch {
      toast({ title: 'Hiba', description: 'Nem sikerült az áthelyezés.', variant: 'destructive' });
    }
  };

  // Filter out current location
  const availableLocations = locations.filter(l => l.id !== asset.location_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Áthelyezés
          </DialogTitle>
          <DialogDescription>
            <strong>{asset.name}</strong> áthelyezése másik telephelyre.
            {asset.location?.name && (
              <> Jelenlegi hely: <strong>{asset.location.name}</strong></>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Új telephely *</Label>
            <Select value={newLocationId} onValueChange={setNewLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Válassz telephelyet..." />
              </SelectTrigger>
              <SelectContent>
                {availableLocations.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}{l.location_type === 'headquarters' ? ' (Székhely)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableLocations.length === 0 && (
              <p className="text-xs text-muted-foreground">Nincs más telephely. Adj hozzá a Beállítások → Cég menüben.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Áthelyezés dátuma</Label>
            <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Megjegyzés</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Opcionális megjegyzés..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button
            onClick={handleSubmit}
            disabled={!newLocationId || transfer.isPending}
            className="gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            {transfer.isPending ? 'Áthelyezés...' : 'Áthelyezés'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
