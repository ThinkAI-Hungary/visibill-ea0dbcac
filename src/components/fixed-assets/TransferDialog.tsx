import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRightLeft, FolderKanban } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useCompanyLocations } from '@/hooks/useCompanyLocations';
import { useProjectList } from '@/hooks/useProjectList';
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
  const { projects = [] } = useProjectList();
  const transfer = useTransferAsset();

  const [newLocationId, setNewLocationId] = useState(asset.location_id || '_none');
  const [newProjectId, setNewProjectId] = useState(asset.project_id || '_none');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');

  // Reset values when dialog opens or asset changes
  useEffect(() => {
    if (open) {
      setNewLocationId(asset.location_id || '_none');
      setNewProjectId(asset.project_id || '_none');
      setEventDate(new Date().toISOString().split('T')[0]);
      setDescription('');
    }
  }, [open, asset]);

  const currentLocationId = asset.location_id || '_none';
  const currentProjectId = asset.project_id || '_none';
  const hasLocationChange = newLocationId !== currentLocationId;
  const hasProjectChange = newProjectId !== currentProjectId;
  const hasChanges = hasLocationChange || hasProjectChange;

  const handleSubmit = async () => {
    if (!user || !selectedCompany || !hasChanges) return;

    const newLocation = newLocationId !== '_none' ? locations.find(l => l.id === newLocationId) : null;
    const newProject = newProjectId !== '_none' ? projects.find(p => p.id === newProjectId) : null;

    try {
      await transfer.mutateAsync({
        assetId: asset.id,
        companyId: selectedCompany.id,
        userId: user.id,
        ...(hasLocationChange ? {
          newLocationId: newLocationId === '_none' ? null : newLocationId,
          newLocationName: newLocation ? (newLocation.name || newLocation.address) : 'Nincs',
          oldLocationName: asset.location?.name || asset.location?.address || 'Nincs',
        } : {}),
        ...(hasProjectChange ? {
          newProjectId: newProjectId === '_none' ? null : newProjectId,
          newProjectName: newProject ? newProject.name : 'Nincs',
          oldProjectName: asset.project?.name || 'Nincs',
        } : {}),
        eventDate,
        description: description.trim() || undefined,
      });

      toast({
        title: 'Siker',
        description: hasLocationChange && hasProjectChange
          ? 'Telephely és projekt sikeresen módosítva.'
          : hasProjectChange
          ? `Projekt hozzárendelés mentve: ${newProject ? newProject.name : 'Nincs'}`
          : `Eszköz áthelyezve: ${newLocation ? (newLocation.name || newLocation.address) : 'Nincs'}`,
      });

      onOpenChange(false);
    } catch {
      toast({ title: 'Hiba', description: 'Nem sikerült az áthelyezés / módosítás.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Áthelyezés & Projekt hozzárendelés
          </DialogTitle>
          <DialogDescription>
            <strong>{asset.name}</strong> telephelyének vagy projektjének módosítása.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Telephely</Label>
            <Select value={newLocationId} onValueChange={setNewLocationId}>
              <SelectTrigger>
                <SelectValue placeholder="Válassz telephelyet..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nincs telephely kijelölve</SelectItem>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name ? `${l.name} (${l.address})` : l.address}
                    {l.location_type === 'headquarters' ? ' — Székhely' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <FolderKanban className="h-4 w-4 text-primary" />
              Hozzárendelt Projekt
            </Label>
            <Select value={newProjectId} onValueChange={setNewProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Válassz projektet..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nincs projekt hozzárendelve</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.project_code ? `(${p.project_code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Változás dátuma</Label>
            <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Megjegyzés</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Opcionális megjegyzés a naplóhoz..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Mégse</Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || transfer.isPending}
            className="gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            {transfer.isPending ? 'Mentés...' : 'Változtatások mentése'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
