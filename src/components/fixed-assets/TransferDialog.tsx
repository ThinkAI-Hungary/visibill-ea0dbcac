import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('hr');
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
    const noneText = t('fixed_assets.transfer_dialog.toasts.none');

    try {
      await transfer.mutateAsync({
        assetId: asset.id,
        companyId: selectedCompany.id,
        userId: user.id,
        ...(hasLocationChange ? {
          newLocationId: newLocationId === '_none' ? null : newLocationId,
          newLocationName: newLocation ? (newLocation.name || newLocation.address) : noneText,
          oldLocationName: asset.location?.name || asset.location?.address || noneText,
        } : {}),
        ...(hasProjectChange ? {
          newProjectId: newProjectId === '_none' ? null : newProjectId,
          newProjectName: newProject ? newProject.name : noneText,
          oldProjectName: asset.project?.name || noneText,
        } : {}),
        eventDate,
        description: description.trim() || undefined,
      });

      toast({
        title: t('fixed_assets.transfer_dialog.toasts.success_title'),
        description: hasLocationChange && hasProjectChange
          ? t('fixed_assets.transfer_dialog.toasts.success_both')
          : hasProjectChange
          ? t('fixed_assets.transfer_dialog.toasts.success_project', { project: newProject ? newProject.name : noneText })
          : t('fixed_assets.transfer_dialog.toasts.success_location', { location: newLocation ? (newLocation.name || newLocation.address) : noneText }),
      });

      onOpenChange(false);
    } catch {
      toast({ title: t('fixed_assets.transfer_dialog.toasts.error_title'), description: t('fixed_assets.transfer_dialog.toasts.error_desc'), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            {t('fixed_assets.transfer_dialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('fixed_assets.transfer_dialog.description', { name: asset.name })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('fixed_assets.transfer_dialog.location_label')}</Label>
            <Select value={newLocationId} onValueChange={setNewLocationId}>
              <SelectTrigger>
                <SelectValue placeholder={t('fixed_assets.transfer_dialog.location_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{t('fixed_assets.transfer_dialog.no_location')}</SelectItem>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name ? `${l.name} (${l.address})` : l.address}
                    {l.location_type === 'headquarters' ? t('fixed_assets.transfer_dialog.headquarters_suffix') : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <FolderKanban className="h-4 w-4 text-primary" />
              {t('fixed_assets.transfer_dialog.project_label')}
            </Label>
            <Select value={newProjectId} onValueChange={setNewProjectId}>
              <SelectTrigger>
                <SelectValue placeholder={t('fixed_assets.transfer_dialog.project_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{t('fixed_assets.transfer_dialog.no_project')}</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.project_code ? `(${p.project_code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('fixed_assets.transfer_dialog.date_label')}</Label>
            <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>{t('fixed_assets.transfer_dialog.notes_label')}</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('fixed_assets.transfer_dialog.notes_placeholder')}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('fixed_assets.transfer_dialog.cancel')}</Button>
          <Button
            onClick={handleSubmit}
            disabled={!hasChanges || transfer.isPending}
            className="gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            {transfer.isPending ? t('fixed_assets.transfer_dialog.saving') : t('fixed_assets.transfer_dialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
