import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRightLeft, FolderKanban, MapPin, Building2, UserCheck, Briefcase, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useCompanyLocations } from '@/hooks/useCompanyLocations';
import { useCompanySubLocations } from '@/hooks/useCompanySubLocations';
import { useProjectList } from '@/hooks/useProjectList';
import { useTransferAsset, useCompanyEmployees, useCompanyCostCenters } from '@/hooks/useFixedAssets';
import { downloadAssetHandoverProtocolPdf } from '@/lib/fixed-assets/assetHandoverProtocolPdf';
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
  const { data: employees = [] } = useCompanyEmployees(selectedCompany?.id);
  const { data: costCenters = [] } = useCompanyCostCenters(selectedCompany?.id);
  const transfer = useTransferAsset();

  const [newLocationId, setNewLocationId] = useState<string>(asset.location_id || '_none');
  const { subLocations } = useCompanySubLocations(
    selectedCompany?.id,
    newLocationId !== '_none' ? newLocationId : undefined
  );

  const [newSubLocationId, setNewSubLocationId] = useState<string>(asset.sub_location_id || '_none');
  const [newCustodianId, setNewCustodianId] = useState<string>(asset.custodian_id || '_none');
  const [newCostCenterId, setNewCostCenterId] = useState<string>(asset.cost_center_id || '_none');
  const [newProjectId, setNewProjectId] = useState<string>(asset.project_id || '_none');
  const [eventDate, setEventDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState<string>('');

  // Reset values when dialog opens or asset changes
  useEffect(() => {
    if (open) {
      setNewLocationId(asset.location_id || '_none');
      setNewSubLocationId(asset.sub_location_id || '_none');
      setNewCustodianId(asset.custodian_id || '_none');
      setNewCostCenterId(asset.cost_center_id || '_none');
      setNewProjectId(asset.project_id || '_none');
      setEventDate(new Date().toISOString().split('T')[0]);
      setDescription('');
    }
  }, [open, asset]);

  // Ha a fő telephely megváltozik, és az eddig kiválasztott sub_location nem oda tartozik, visszaállítjuk
  const handleLocationChange = (locId: string) => {
    setNewLocationId(locId);
    if (locId === '_none') {
      setNewSubLocationId('_none');
    } else {
      const isCurrentSubValid = subLocations.some(s => s.id === newSubLocationId && s.location_id === locId);
      if (!isCurrentSubValid) {
        setNewSubLocationId('_none');
      }
    }
  };

  const currentLocationId = asset.location_id || '_none';
  const currentSubLocationId = asset.sub_location_id || '_none';
  const currentCustodianId = asset.custodian_id || '_none';
  const currentCostCenterId = asset.cost_center_id || '_none';
  const currentProjectId = asset.project_id || '_none';

  const hasLocationChange = newLocationId !== currentLocationId;
  const hasSubLocationChange = newSubLocationId !== currentSubLocationId;
  const hasCustodianChange = newCustodianId !== currentCustodianId;
  const hasCostCenterChange = newCostCenterId !== currentCostCenterId;
  const hasProjectChange = newProjectId !== currentProjectId;

  const hasChanges =
    hasLocationChange ||
    hasSubLocationChange ||
    hasCustodianChange ||
    hasCostCenterChange ||
    hasProjectChange;

  const getResolvedEntities = () => {
    const loc = newLocationId !== '_none' ? locations.find(l => l.id === newLocationId) : null;
    const sub = newSubLocationId !== '_none' ? subLocations.find(s => s.id === newSubLocationId) : null;
    const cust = newCustodianId !== '_none' ? employees.find(e => e.id === newCustodianId) : null;
    const cc = newCostCenterId !== '_none' ? costCenters.find(c => c.id === newCostCenterId) : null;
    const proj = newProjectId !== '_none' ? projects.find(p => p.id === newProjectId) : null;

    return { loc, sub, cust, cc, proj };
  };

  const handleDownloadProtocol = () => {
    const { loc, sub, cust, cc, proj } = getResolvedEntities();

    downloadAssetHandoverProtocolPdf({
      companyName: selectedCompany?.name || 'VisiBill Cég',
      companyAddress: selectedCompany?.address,
      companyTaxNumber: selectedCompany?.tax_number,
      protocolNumber: `AAT-${asset.inventory_number}-${eventDate}`,
      eventDate,
      assetName: asset.name,
      inventoryNumber: asset.inventory_number,
      description: asset.description || undefined,
      vtszTeszor: asset.vtsz_teszor || undefined,
      activationDate: asset.activation_date,
      acquisitionValue: asset.acquisition_value,
      oldLocationName: asset.location?.name || asset.location?.address,
      newLocationName: loc ? (loc.name || loc.address) : undefined,
      oldSubLocationName: asset.sub_location?.name,
      newSubLocationName: sub?.name,
      oldCustodianName: asset.custodian ? `${asset.custodian.last_name} ${asset.custodian.first_name}` : undefined,
      newCustodianName: cust ? `${cust.last_name} ${cust.first_name}` : undefined,
      newCustodianEmail: cust?.email || undefined,
      oldCostCenterName: asset.cost_center?.name,
      newCostCenterName: cc?.name,
      projectName: proj?.name || asset.project?.name,
      notes: description.trim() || undefined,
    });

    toast({
      title: 'Nyilatkozat letöltve',
      description: 'A kétnyelvű átadás-átvételi és felelősőrzési jegyzőkönyv PDF sikeresen előállítva.',
    });
  };

  const handleSubmit = async () => {
    if (!user || !selectedCompany || !hasChanges) return;

    const { loc, sub, cust, cc, proj } = getResolvedEntities();
    const noneText = t('fixed_assets.transfer_dialog.toasts.none', 'Nincs');

    try {
      await transfer.mutateAsync({
        assetId: asset.id,
        companyId: selectedCompany.id,
        userId: user.id,
        ...(hasLocationChange ? {
          newLocationId: newLocationId === '_none' ? null : newLocationId,
          newLocationName: loc ? (loc.name || loc.address) : noneText,
          oldLocationName: asset.location?.name || asset.location?.address || noneText,
        } : {}),
        ...(hasSubLocationChange ? {
          newSubLocationId: newSubLocationId === '_none' ? null : newSubLocationId,
          newSubLocationName: sub ? sub.name : noneText,
          oldSubLocationName: asset.sub_location?.name || noneText,
        } : {}),
        ...(hasCustodianChange ? {
          newCustodianId: newCustodianId === '_none' ? null : newCustodianId,
          newCustodianName: cust ? `${cust.last_name} ${cust.first_name}` : noneText,
          oldCustodianName: asset.custodian ? `${asset.custodian.last_name} ${asset.custodian.first_name}` : noneText,
        } : {}),
        ...(hasCostCenterChange ? {
          newCostCenterId: newCostCenterId === '_none' ? null : newCostCenterId,
          newCostCenterName: cc ? `${cc.code} - ${cc.name}` : noneText,
          oldCostCenterName: asset.cost_center ? `${asset.cost_center.code} - ${asset.cost_center.name}` : noneText,
        } : {}),
        ...(hasProjectChange ? {
          newProjectId: newProjectId === '_none' ? null : newProjectId,
          newProjectName: proj ? proj.name : noneText,
          oldProjectName: asset.project?.name || noneText,
        } : {}),
        eventDate,
        description: description.trim() || undefined,
      });

      toast({
        title: t('fixed_assets.transfer_dialog.toasts.success_title', 'Áthelyezés sikeres'),
        description: 'Az eszköz helyszíni és felelősségi adatai frissültek a nyilvántartásban.',
      });

      onOpenChange(false);
    } catch {
      toast({
        title: t('fixed_assets.transfer_dialog.toasts.error_title', 'Hiba történt'),
        description: t('fixed_assets.transfer_dialog.toasts.error_desc', 'Nem sikerült az áthelyezés mentése.'),
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent id="asset-transfer-dialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            {t('fixed_assets.transfer_dialog.title', 'Eszköz áthelyezése & Felelősváltás')}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {t('fixed_assets.transfer_dialog.description', { name: asset.name })} ({asset.inventory_number})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2 text-sm">
          {/* Telephely */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              {t('fixed_assets.transfer_dialog.location_label', 'Telephely / Székhely')}
            </Label>
            <Select value={newLocationId} onValueChange={handleLocationChange}>
              <SelectTrigger id="asset-transfer-location-select" className="h-9 text-xs">
                <SelectValue placeholder={t('fixed_assets.transfer_dialog.location_placeholder', 'Válassz telephelyet')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{t('fixed_assets.transfer_dialog.no_location', 'Nincs telephely hozzárendelve')}</SelectItem>
                {locations.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name ? `${l.name} (${l.address})` : l.address}
                    {l.location_type === 'headquarters' ? ' (Székhely)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rész-helyszín / Tárolóhely */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <Building2 className="h-3.5 w-3.5 text-primary" />
              Hierarchikus tárolóhely / Iroda / Raktár
            </Label>
            <Select
              value={newSubLocationId}
              onValueChange={setNewSubLocationId}
              disabled={newLocationId === '_none' && subLocations.length === 0}
            >
              <SelectTrigger id="asset-transfer-sublocation-select" className="h-9 text-xs">
                <SelectValue placeholder="Válassz tárolóhelyet (pl. 2. emelet, 204-es iroda)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nincs pontos tárolóhely megadva</SelectItem>
                {subLocations.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} {s.code ? `(${s.code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Felelős dolgozó */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <UserCheck className="h-3.5 w-3.5 text-primary" />
              Felelős munkavállaló (Custodial Owner)
            </Label>
            <Select value={newCustodianId} onValueChange={setNewCustodianId}>
              <SelectTrigger id="asset-transfer-custodian-select" className="h-9 text-xs">
                <SelectValue placeholder="Válassz felelős dolgozót" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nincs felelős dolgozó hozzárendelve</SelectItem>
                {employees.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.last_name} {e.first_name} {e.email ? `(${e.email})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Költséghely */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <Briefcase className="h-3.5 w-3.5 text-primary" />
              Költséghely / Szervezeti egység
            </Label>
            <Select value={newCostCenterId} onValueChange={setNewCostCenterId}>
              <SelectTrigger id="asset-transfer-cost-center-select" className="h-9 text-xs">
                <SelectValue placeholder="Válassz szervezeti egységet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nincs költséghelyhez rendelve</SelectItem>
                {costCenters.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.code} – {c.name} {c.responsible ? `(${c.responsible})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Projekt */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <FolderKanban className="h-3.5 w-3.5 text-primary" />
              {t('fixed_assets.transfer_dialog.project_label', 'Projekt / Pályázat')}
            </Label>
            <Select value={newProjectId} onValueChange={setNewProjectId}>
              <SelectTrigger id="asset-transfer-project-select" className="h-9 text-xs">
                <SelectValue placeholder={t('fixed_assets.transfer_dialog.project_placeholder', 'Válassz projektet')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">{t('fixed_assets.transfer_dialog.no_project', 'Nincs projekt')}</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.project_code ? `(${p.project_code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Dátum */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('fixed_assets.transfer_dialog.date_label', 'Áthelyezés fordulónapja')}</Label>
            <Input
              id="asset-transfer-date-input"
              type="date"
              className="h-9 text-xs"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
            />
          </div>

          {/* Megjegyzés */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{t('fixed_assets.transfer_dialog.notes_label', 'Áthelyezés oka / Indoklás')}</Label>
            <Textarea
              id="asset-transfer-notes-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder={t('fixed_assets.transfer_dialog.notes_placeholder', 'Pl. új munkavállaló belépése, irodaköltözés, telephelyek közötti átadás...')}
              rows={2}
              className="text-xs resize-none"
            />
          </div>

          {/* Kétnyelvű átadás-átvételi nyilatkozat export gomb */}
          <div className="pt-1">
            <Button
              id="asset-transfer-pdf-btn"
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadProtocol}
              className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/5 text-xs h-8"
            >
              <FileDown className="h-3.5 w-3.5" />
              Kétnyelvű Átadás-Átvételi Nyilatkozat letöltése (PDF)
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t('fixed_assets.transfer_dialog.cancel', 'Mégse')}
          </Button>
          <Button
            id="asset-transfer-submit-btn"
            onClick={handleSubmit}
            disabled={!hasChanges || transfer.isPending}
            size="sm"
            className="gap-2"
          >
            <ArrowRightLeft className="h-4 w-4" />
            {transfer.isPending ? t('fixed_assets.transfer_dialog.saving', 'Mentés...') : t('fixed_assets.transfer_dialog.save', 'Áthelyezés mentése')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
