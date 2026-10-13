import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  FileSpreadsheet,
  Coins,
  ShieldCheck,
  Calendar,
  Sparkles,
  Loader2,
  TrendingDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDateLocale } from '@/lib/locale/formatters';
import {
  useAssetComponents,
} from '@/hooks/useAssetComponents';
import { useGrantProjects } from '@/hooks/useGrantProjects';
import {
  calculateAssetComponentsDepreciation,
} from '@/lib/fixed-assets/assetComponentCalculator';
import type {
  FixedAsset,
  FixedAssetComponent,
  ComponentType,
} from '@/types/fixed-assets';
import { COMPONENT_TYPE_LABELS } from '@/types/fixed-assets';

interface AssetComponentsViewProps {
  asset: FixedAsset;
}

export const AssetComponentsView: React.FC<AssetComponentsViewProps> = ({ asset }) => {
  const {
    components,
    isLoading,
    error,
    refetch,
    createComponent,
    updateComponent,
    deleteComponent,
    isCreating,
    isUpdating,
    isDeleting,
  } = useAssetComponents(asset.id);

  const { projects: grantProjects } = useGrantProjects(asset.company_id);

  // Form modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<FixedAssetComponent | null>(null);

  // Delete modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [componentType, setComponentType] = useState<ComponentType>('initial');
  const [activationDate, setActivationDate] = useState(asset.activation_date || '');
  const [grossValue, setGrossValue] = useState<number>(0);
  const [grantProjectId, setGrantProjectId] = useState<string>('none');
  const [grantFundingAmount, setGrantFundingAmount] = useState<number>(0);
  const [ownFundingAmount, setOwnFundingAmount] = useState<number>(0);
  const [usefulLifeMonths, setUsefulLifeMonths] = useState<string>('');
  const [notes, setNotes] = useState('');

  // Számítási eredmény és életciklus guard
  const calcResult = calculateAssetComponentsDepreciation(asset, components);
  const isAssetActive = asset.status === 'active';

  const handleOpenAdd = () => {
    if (!isAssetActive) return;
    setEditingComponent(null);
    setName('');
    setComponentType(components.length === 0 ? 'initial' : 'addition');
    setActivationDate(asset.activation_date || new Date().toISOString().slice(0, 10));
    setGrossValue(components.length === 0 ? Number(asset.acquisition_value) || 0 : 0);
    setGrantProjectId(asset.grant_project_id || 'none');
    const defaultGrant = asset.grant_project?.intensity_rate
      ? Math.round((Number(asset.acquisition_value) * asset.grant_project.intensity_rate) / 100)
      : 0;
    setGrantFundingAmount(components.length === 0 ? defaultGrant : 0);
    setOwnFundingAmount(components.length === 0 ? (Number(asset.acquisition_value) || 0) - defaultGrant : 0);
    setUsefulLifeMonths(asset.useful_life_months ? String(asset.useful_life_months) : '60');
    setNotes('');
    setModalOpen(true);
  };

  const handleOpenEdit = (comp: FixedAssetComponent) => {
    setEditingComponent(comp);
    setName(comp.name);
    setComponentType(comp.component_type);
    setActivationDate(comp.activation_date);
    setGrossValue(Number(comp.gross_value) || 0);
    setGrantProjectId(comp.grant_project_id || 'none');
    setGrantFundingAmount(Number(comp.grant_funding_amount) || 0);
    setOwnFundingAmount(Number(comp.own_funding_amount) || 0);
    setUsefulLifeMonths(comp.useful_life_months ? String(comp.useful_life_months) : '');
    setNotes(comp.notes || '');
    setModalOpen(true);
  };

  const handleGrossChange = (val: number) => {
    setGrossValue(val);
    if (grantProjectId !== 'none') {
      const proj = grantProjects.find(p => p.id === grantProjectId);
      if (proj && proj.intensity_rate > 0) {
        const grant = Math.round((val * proj.intensity_rate) / 100);
        setGrantFundingAmount(grant);
        setOwnFundingAmount(Math.max(0, val - grant));
        return;
      }
    }
    setOwnFundingAmount(Math.max(0, val - grantFundingAmount));
  };

  const handleGrantProjectChange = (projId: string) => {
    setGrantProjectId(projId);
    if (projId !== 'none') {
      const proj = grantProjects.find(p => p.id === projId);
      if (proj && proj.intensity_rate > 0 && grossValue > 0) {
        const grant = Math.round((grossValue * proj.intensity_rate) / 100);
        setGrantFundingAmount(grant);
        setOwnFundingAmount(Math.max(0, grossValue - grant));
      }
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || grossValue <= 0 || !activationDate) return;

    const ratio = grossValue > 0 && grantFundingAmount > 0
      ? Math.round((grantFundingAmount / grossValue) * 10000) / 100
      : 0;

    const selectedGrantId = grantProjectId !== 'none' ? grantProjectId : null;
    const lifeMonths = usefulLifeMonths ? parseInt(usefulLifeMonths, 10) : null;
    const rate = lifeMonths && lifeMonths > 0 ? Math.round((100 / (lifeMonths / 12)) * 100) / 100 : null;

    if (editingComponent) {
      await updateComponent({
        id: editingComponent.id,
        updates: {
          name: name.trim(),
          component_type: componentType,
          activation_date: activationDate,
          gross_value: grossValue,
          grant_project_id: selectedGrantId,
          grant_funding_amount: grantFundingAmount,
          own_funding_amount: ownFundingAmount,
          grant_ratio_percent: ratio,
          useful_life_months: lifeMonths,
          depreciation_rate: rate,
          notes: notes.trim() || null,
        },
      });
    } else {
      await createComponent({
        company_id: asset.company_id,
        fixed_asset_id: asset.id,
        name: name.trim(),
        component_type: componentType,
        activation_date: activationDate,
        gross_value: grossValue,
        grant_project_id: selectedGrantId,
        grant_funding_amount: grantFundingAmount,
        own_funding_amount: ownFundingAmount,
        grant_ratio_percent: ratio,
        useful_life_months: lifeMonths,
        depreciation_rate: rate,
        notes: notes.trim() || null,
      });
    }

    setModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    await deleteComponent(deletingId);
    setDeletingId(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 py-4">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-medium">Hiba történt a komponensek betöltésekor.</span>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Újrapróbálás
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2">
      {/* Fejléc és összegző sáv */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/40 p-4 rounded-xl border">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <h4 className="font-semibold text-base">Komponens-elvű Eszközkarton</h4>
            {calcResult.hasComponents ? (
              <Badge variant="secondary" className="text-xs">
                {components.length} forráskomponens
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Egységes főkarton
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Többforrásos finanszírozás (pályázat + saját erő) és utólagos ráaktiválások nyilvántartása.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            id="add-asset-component-btn"
            size="sm"
            onClick={handleOpenAdd}
            disabled={!isAssetActive}
            title={!isAssetActive ? 'Kivezetett vagy inaktív eszközhöz nem adható új komponens' : undefined}
            className="gap-1.5 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Új komponens hozzáadása
          </Button>
        </div>
      </div>

      {/* Inaktív eszköz zárolási figyelmeztetés */}
      {!isAssetActive && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-900 dark:text-amber-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>
            Ez a tárgyi eszköz nem aktív ({asset.status === 'disposed' ? 'kivezetett' : asset.status === 'sold' ? 'értékesített' : asset.status === 'missing' ? 'leltárhiány' : asset.status}) állapotban van.
            A hozzá tartozó komponensek zárolva vannak: új komponens nem adható hozzá, és a meglévők nem módosíthatók.
          </span>
        </div>
      )}

      {/* Finanszírozási Arány és KPI kártyák */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 bg-card rounded-lg border shadow-sm">
          <span className="text-xs text-muted-foreground font-medium block">Összesített Bekerülés</span>
          <p className="text-lg font-bold mt-1 text-foreground">
            {formatCurrency(calcResult.totalGrossValue, asset.currency)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            {calcResult.hasComponents ? 'Komponensek összege' : 'Főkarton bruttó'}
          </span>
        </div>

        <div className="p-3.5 bg-card rounded-lg border border-primary/20 shadow-sm">
          <span className="text-xs text-primary font-medium flex items-center gap-1">
            <Coins className="h-3.5 w-3.5" />
            Támogatási Forrás ({calcResult.effectiveGrantRatio}%)
          </span>
          <p className="text-lg font-bold mt-1 text-primary">
            {formatCurrency(calcResult.totalGrantFunding, asset.currency)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            Könyv szerinti nettó: {formatCurrency(calcResult.grantNetBookValue, asset.currency)}
          </span>
        </div>

        <div className="p-3.5 bg-card rounded-lg border shadow-sm">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Saját Forrás ({Math.round((100 - calcResult.effectiveGrantRatio) * 100) / 100}%)
          </span>
          <p className="text-lg font-bold mt-1 text-foreground">
            {formatCurrency(calcResult.totalOwnFunding, asset.currency)}
          </p>
          <span className="text-[11px] text-muted-foreground">
            Könyv szerinti nettó: {formatCurrency(calcResult.ownNetBookValue, asset.currency)}
          </span>
        </div>

        <div className="p-3.5 bg-card rounded-lg border border-amber-500/20 bg-amber-500/5 shadow-sm">
          <span className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
            <TrendingDown className="h-3.5 w-3.5" />
            Havi Támogatási ÉCS (PIE alap)
          </span>
          <p className="text-lg font-bold mt-1 text-amber-700 dark:text-amber-400">
            {formatCurrency(calcResult.monthlyGrantDepreciation, asset.currency)} / hó
          </p>
          <span className="text-[11px] text-muted-foreground">
            Teljes havi ÉCS: {formatCurrency(calcResult.monthlyDepreciation, asset.currency)}
          </span>
        </div>
      </div>

      {/* Finanszírozási forrásarány sáv */}
      {calcResult.totalGrossValue > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-primary flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
              Támogatás: {calcResult.effectiveGrantRatio}% ({formatCurrency(calcResult.totalGrantFunding, asset.currency)})
            </span>
            <span className="text-muted-foreground flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 inline-block" />
              Saját erő: {Math.round((100 - calcResult.effectiveGrantRatio) * 100) / 100}% ({formatCurrency(calcResult.totalOwnFunding, asset.currency)})
            </span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex shadow-inner">
            <div
              className="bg-primary transition-all duration-300 h-full"
              style={{ width: `${Math.min(100, Math.max(0, calcResult.effectiveGrantRatio))}%` }}
              title={`Támogatás: ${calcResult.effectiveGrantRatio}%`}
            />
            <div
              className="bg-muted-foreground/30 transition-all duration-300 h-full flex-1"
              title={`Saját erő: ${100 - calcResult.effectiveGrantRatio}%`}
            />
          </div>
        </div>
      )}

      {/* Komponensek táblázat vagy üres állapot */}
      {!calcResult.hasComponents ? (
        <div className="p-8 text-center rounded-xl border border-dashed bg-card/50 space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <h5 className="font-semibold text-base">Egyetlen forrásként nyilvántartott eszköz</h5>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
              Ehhez az eszközhöz még nincsenek külön komponensek rögzítve. Ha a beszerzés több forrásból történt
              (pl. pályázat + önerő), vagy utólagos ráaktiválás / alkatrész-csere történt, rögzítsd komponensként!
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenAdd}
            disabled={!isAssetActive}
            className="gap-1.5 mt-2"
          >
            <Plus className="h-4 w-4" />
            Első komponens rögzítése
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b text-xs text-muted-foreground font-medium">
                <tr>
                  <th className="py-2.5 px-3 text-left">Komponens Megnevezése</th>
                  <th className="py-2.5 px-3 text-left">Típus</th>
                  <th className="py-2.5 px-3 text-left">Aktiválás</th>
                  <th className="py-2.5 px-3 text-right">Bruttó érték</th>
                  <th className="py-2.5 px-3 text-left">Pályázati Projekt</th>
                  <th className="py-2.5 px-3 text-right">Támogatás (Ft / %)</th>
                  <th className="py-2.5 px-3 text-right">Saját erő</th>
                  <th className="py-2.5 px-3 text-right">Havi ÉCS</th>
                  <th className="py-2.5 px-3 text-center">Műveletek</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {calcResult.componentsBreakdown.map(comp => (
                  <tr key={comp.componentId} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-3 font-medium">
                      <div className="flex items-center gap-2">
                        <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span>{comp.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="outline" className="text-[11px] font-normal">
                        {COMPONENT_TYPE_LABELS[comp.componentType as ComponentType] || comp.componentType}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                      {formatDateLocale(comp.activationDate)}
                    </td>
                    <td className="py-3 px-3 text-right font-semibold tabular-nums">
                      {formatCurrency(comp.grossValue, asset.currency)}
                    </td>
                    <td className="py-3 px-3">
                      {comp.grantRatioPercent > 0 ? (
                        <Badge variant="secondary" className="text-[11px] bg-primary/10 text-primary border-primary/20">
                          {grantProjects.find(p => p.intensity_rate === comp.grantRatioPercent)?.code || 'Támogatott'}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      {comp.grantFundingAmount > 0 ? (
                        <div>
                          <span className="font-semibold text-primary">
                            {formatCurrency(comp.grantFundingAmount, asset.currency)}
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({comp.grantRatioPercent}%)
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">0 Ft</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">
                      {formatCurrency(comp.ownFundingAmount, asset.currency)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums">
                      <div className="font-medium">
                        {formatCurrency(comp.monthlyDepreciation, asset.currency)}
                      </div>
                      {comp.monthlyGrantDepreciation > 0 && (
                        <div className="text-[11px] text-amber-600 dark:text-amber-400">
                          PIE: {formatCurrency(comp.monthlyGrantDepreciation, asset.currency)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {isAssetActive ? (
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              const original = components.find(c => c.id === comp.componentId);
                              if (original) handleOpenEdit(original);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeletingId(comp.componentId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                          Zárolva
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Komponens létrehozó / szerkesztő Dialógus */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingComponent ? 'Komponens Szerkesztése' : 'Új Komponens / Ráaktiválás Hozzáadása'}
              </DialogTitle>
              <DialogDescription>
                Rögzítsd a tárgyi eszköz alkatrészét, finanszírozási forrását vagy utólagos beruházását.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4 text-sm">
              <div className="space-y-1.5">
                <Label htmlFor="comp-name">Komponens Megnevezése *</Label>
                <Input
                  id="comp-name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="pl. Alapgép, Főorsó, Utólagos CNC vezérlő"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Komponens Típusa</Label>
                  <Select
                    value={componentType}
                    onValueChange={(val: ComponentType) => setComponentType(val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="initial">Alapbeszerzés / Eredeti</SelectItem>
                      <SelectItem value="addition">Utólagos kiegészítés</SelectItem>
                      <SelectItem value="upgrade">Korszerűsítés / Ráaktiválás</SelectItem>
                      <SelectItem value="replacement">Fődarab-csere</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="comp-act-date">Aktiválás / Üzembehelyezés Dátuma *</Label>
                  <Input
                    id="comp-act-date"
                    type="date"
                    value={activationDate}
                    onChange={e => setActivationDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="comp-gross">Bruttó Bekerülési Érték (Ft) *</Label>
                  <Input
                    id="comp-gross"
                    type="number"
                    min={0}
                    value={grossValue || ''}
                    onChange={e => handleGrossChange(parseFloat(e.target.value) || 0)}
                    placeholder="pl. 5000000"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="comp-life">Hasznos élettartam (hónap)</Label>
                  <Input
                    id="comp-life"
                    type="number"
                    min={1}
                    value={usefulLifeMonths}
                    onChange={e => setUsefulLifeMonths(e.target.value)}
                    placeholder={asset.useful_life_months ? `Alapértelmezett: ${asset.useful_life_months}` : '60'}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Kapcsolódó Pályázati Projekt</Label>
                <Select
                  value={grantProjectId}
                  onValueChange={handleGrantProjectChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Válassz pályázatot (ha támogatott)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nincs pályázathoz rendelve (100% saját erő)</SelectItem>
                    {grantProjects.map(proj => (
                      <SelectItem key={proj.id} value={proj.id}>
                        {proj.code} — {proj.name} ({proj.intensity_rate}% támogatás)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg border">
                <div className="space-y-1.5">
                  <Label htmlFor="comp-grant-amount">Támogatási Összeg (Ft)</Label>
                  <Input
                    id="comp-grant-amount"
                    type="number"
                    min={0}
                    max={grossValue}
                    value={grantFundingAmount || ''}
                    onChange={e => {
                      const g = parseFloat(e.target.value) || 0;
                      setGrantFundingAmount(g);
                      setOwnFundingAmount(Math.max(0, grossValue - g));
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="comp-own-amount">Saját Erő (Ft)</Label>
                  <Input
                    id="comp-own-amount"
                    type="number"
                    min={0}
                    value={ownFundingAmount || ''}
                    onChange={e => {
                      const o = parseFloat(e.target.value) || 0;
                      setOwnFundingAmount(o);
                      setGrantFundingAmount(Math.max(0, grossValue - o));
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="comp-notes">Megjegyzések, Műszaki Leírás</Label>
                <Input
                  id="comp-notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="pl. Szériaszám, gépkönyvi azonosító"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={isCreating || isUpdating}
              >
                Mégse
              </Button>
              <Button
                id="save-asset-component-btn"
                type="submit"
                disabled={isCreating || isUpdating || !name.trim() || grossValue <= 0}
                className="gap-2"
              >
                {(isCreating || isUpdating) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingComponent ? 'Módosítás mentése' : 'Komponens rögzítése'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Törlés Megerősítő Dialógus */}
      <AlertDialog open={!!deletingId} onOpenChange={open => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Biztosan törölni szeretnéd ezt a komponenst?</AlertDialogTitle>
            <AlertDialogDescription>
              A komponens törlésével a hozzá tartozó finanszírozási arányok és amortizációs bontás is megszűnik.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Mégse</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Törlés
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
