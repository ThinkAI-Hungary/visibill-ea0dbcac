import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Car, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  createCompanyCar,
  updateCompanyCar,
  calculateMonthlyCompanyCarTaxRate,
} from '@/lib/fixed-assets/companyCarTaxService';
import type { FixedAsset } from '@/types/fixed-assets';
import {
  type CompanyCar,
  type CarOwnershipType,
  type CarEnvironmentalCategory,
  CAR_OWNERSHIP_LABELS,
  ENVIRONMENTAL_CATEGORY_LABELS,
} from '@/types/company-car-tax';

interface CreateCompanyCarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  assets?: FixedAsset[];
  editingCar?: CompanyCar | null;
  onSuccess?: () => void;
}

export function CreateCompanyCarDialog({
  open,
  onOpenChange,
  companyId,
  assets = [],
  editingCar = null,
  onSuccess,
}: CreateCompanyCarDialogProps) {
  const { toast } = useToast();

  const [licensePlate, setLicensePlate] = useState('');
  const [ownershipType, setOwnershipType] = useState<CarOwnershipType>('OWNED');
  const [fixedAssetId, setFixedAssetId] = useState<string>('none');
  const [makeAndModel, setMakeAndModel] = useState('');
  const [enginePowerKwStr, setEnginePowerKwStr] = useState('85');
  const [environmentalCategory, setEnvironmentalCategory] = useState<CarEnvironmentalCategory>('EURO_5_6');
  const [taxLiabilityFrom, setTaxLiabilityFrom] = useState(() => new Date().toISOString().split('T')[0]);
  const [taxLiabilityTo, setTaxLiabilityTo] = useState('');
  const [isTaxExempt, setIsTaxExempt] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form inicializálás szerkesztés vagy új autó esetén
  useEffect(() => {
    if (editingCar) {
      setLicensePlate(editingCar.license_plate);
      setOwnershipType(editingCar.ownership_type);
      setFixedAssetId(editingCar.fixed_asset_id || 'none');
      setMakeAndModel(editingCar.make_and_model || '');
      setEnginePowerKwStr(String(editingCar.engine_power_kw));
      setEnvironmentalCategory(editingCar.environmental_category);
      setTaxLiabilityFrom(editingCar.tax_liability_from);
      setTaxLiabilityTo(editingCar.tax_liability_to || '');
      setIsTaxExempt(editingCar.is_tax_exempt);
      setNotes(editingCar.notes || '');
    } else {
      setLicensePlate('');
      setOwnershipType('OWNED');
      setFixedAssetId('none');
      setMakeAndModel('');
      setEnginePowerKwStr('85');
      setEnvironmentalCategory('EURO_5_6');
      setTaxLiabilityFrom(new Date().toISOString().split('T')[0]);
      setTaxLiabilityTo('');
      setIsTaxExempt(false);
      setNotes('');
    }
  }, [editingCar, open]);

  // Ha TENY eszközt választ, automatikusan javasoljuk az adatokat
  const handleSelectFixedAsset = (assetId: string) => {
    setFixedAssetId(assetId);
    if (assetId && assetId !== 'none') {
      const selected = assets.find(a => a.id === assetId);
      if (selected) {
        if (!makeAndModel) {
          setMakeAndModel(selected.name);
        }
        if (selected.activation_date && (!editingCar || !taxLiabilityFrom)) {
          setTaxLiabilityFrom(selected.activation_date);
        }
        if (selected.disposal_date) {
          setTaxLiabilityTo(selected.disposal_date);
        }
      }
    }
  };

  const parsedKw = parseInt(enginePowerKwStr, 10) || 0;
  const estimatedHp = Math.round(parsedKw * 1.36);

  // Valós idejű törvényi havi cégautóadó tétel
  const calculatedMonthlyTax = useMemo(() => {
    return calculateMonthlyCompanyCarTaxRate(parsedKw, environmentalCategory, isTaxExempt);
  }, [parsedKw, environmentalCategory, isTaxExempt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    const cleanPlate = licensePlate.trim().toUpperCase();
    if (!cleanPlate) {
      toast({ title: 'Hiányzó rendszám', description: 'Kérjük adja meg a gépjármű rendszámát!', variant: 'destructive' });
      return;
    }

    if (parsedKw <= 0) {
      toast({ title: 'Érvénytelen teljesítmény', description: 'A motor teljesítményének 0-nál nagyobbnak kell lennie!', variant: 'destructive' });
      return;
    }

    if (!taxLiabilityFrom) {
      toast({ title: 'Hiányzó dátum', description: 'A cégautóadó kötelezettség kezdő dátuma kötelező!', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCar) {
        await updateCompanyCar(editingCar.id, companyId, {
          license_plate: cleanPlate,
          ownership_type: ownershipType,
          fixed_asset_id: fixedAssetId !== 'none' ? fixedAssetId : null,
          make_and_model: makeAndModel.trim() || null,
          engine_power_kw: parsedKw,
          environmental_category: environmentalCategory,
          tax_liability_from: taxLiabilityFrom,
          tax_liability_to: taxLiabilityTo.trim() || null,
          is_tax_exempt: isTaxExempt,
          notes: notes.trim() || null,
        });

        toast({
          title: 'Gépjármű frissítve',
          description: `${cleanPlate} cégautó adatai sikeresen módosítva.`,
        });
      } else {
        await createCompanyCar({
          company_id: companyId,
          license_plate: cleanPlate,
          ownership_type: ownershipType,
          fixed_asset_id: fixedAssetId !== 'none' ? fixedAssetId : null,
          make_and_model: makeAndModel.trim() || null,
          engine_power_kw: parsedKw,
          environmental_category: environmentalCategory,
          tax_liability_from: taxLiabilityFrom,
          tax_liability_to: taxLiabilityTo.trim() || null,
          is_tax_exempt: isTaxExempt,
          notes: notes.trim() || null,
        });

        toast({
          title: 'Céges személygépkocsi rögzítve',
          description: `${cleanPlate} sikeresen felvéve a cégautóadó nyilvántartásba.`,
        });
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Hiba a mentés során',
        description: err.message || 'Nem sikerült elmenteni a gépjárművet.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            <DialogTitle>
              {editingCar ? 'Céges személygépkocsi szerkesztése' : 'Új céges személygépkocsi felvétele'}
            </DialogTitle>
          </div>
          <DialogDescription>
            Cégautóadó (Gjt. 17/A. §) analitikai nyilvántartás és automatikus adószámítás
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Rendszám & Gyártmány */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="licensePlate" className="text-xs">Rendszám *</Label>
              <Input
                id="licensePlate"
                placeholder="Pl. AA-BB-123 vagy ABC-123"
                value={licensePlate}
                onChange={e => setLicensePlate(e.target.value.toUpperCase())}
                className="font-mono uppercase font-bold"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="makeAndModel" className="text-xs">Gyártmány / Modell</Label>
              <Input
                id="makeAndModel"
                placeholder="Pl. Skoda Octavia 2.0 TDI"
                value={makeAndModel}
                onChange={e => setMakeAndModel(e.target.value)}
              />
            </div>
          </div>

          {/* Tulajdonjog & TENY eszköz kapcsolat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Használat / Tulajdonjog jellege *</Label>
              <Select value={ownershipType} onValueChange={v => setOwnershipType(v as CarOwnershipType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CAR_OWNERSHIP_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Kapcsolt TENY tárgyi eszköz (opcionális)</Label>
              <Select value={fixedAssetId} onValueChange={handleSelectFixedAsset}>
                <SelectTrigger>
                  <SelectValue placeholder="Válassz tárgyi eszközt..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nincs kapcsolva tárgyi eszközhöz</SelectItem>
                  {assets.map(asset => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.name} ({asset.inventory_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fixedAssetId !== 'none' && (
                <p className="text-[11px] text-muted-foreground">
                  TENY kivezetéskor a cégautóadó kötelezettség vége automatikusan szinkronizálódik.
                </p>
              )}
            </div>
          </div>

          {/* Teljesítmény & Környezetvédelem */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="enginePowerKw" className="text-xs">Motorteljesítmény (kW) *</Label>
                {parsedKw > 0 && (
                  <span className="text-[11px] text-muted-foreground font-mono">≈ {estimatedHp} LE</span>
                )}
              </div>
              <Input
                id="enginePowerKw"
                type="number"
                min="1"
                max="1000"
                value={enginePowerKwStr}
                onChange={e => setEnginePowerKwStr(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Környezetvédelmi besorolás (V.9) *</Label>
              <Select
                value={environmentalCategory}
                onValueChange={v => setEnvironmentalCategory(v as CarEnvironmentalCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ENVIRONMENTAL_CATEGORY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Adókötelezettség időszaka */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="taxLiabilityFrom" className="text-xs">Kötelezettség kezdete *</Label>
              <Input
                id="taxLiabilityFrom"
                type="date"
                value={taxLiabilityFrom}
                onChange={e => setTaxLiabilityFrom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="taxLiabilityTo" className="text-xs">Kötelezettség vége (opcionális)</Label>
              <Input
                id="taxLiabilityTo"
                type="date"
                value={taxLiabilityTo}
                onChange={e => setTaxLiabilityTo(e.target.value)}
              />
            </div>
          </div>

          {/* Törvényi Adómentesség kapcsoló */}
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/20">
            <div className="space-y-0.5">
              <Label htmlFor="exemptSwitch" className="text-xs font-semibold cursor-pointer">
                Törvényi cégautóadó mentesség
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Pl. megkülönböztető jelzés, halottszállító, kizárólag bérbeadásra tartott stb.
              </p>
            </div>
            <Switch
              id="exemptSwitch"
              checked={isTaxExempt}
              onCheckedChange={setIsTaxExempt}
            />
          </div>

          {/* Kalkulációs összegző kártya */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Hatályos törvényi cégautóadó tétel
              </span>
              <p className="text-[11px] text-muted-foreground">
                {isTaxExempt || environmentalCategory === 'GREEN_ELECTRIC'
                  ? 'Környezetkímélő / Mentes gépjármű (0 Ft)'
                  : `${parsedKw} kW (${estimatedHp} LE) — ${ENVIRONMENTAL_CATEGORY_LABELS[environmentalCategory]}`}
              </p>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-foreground">
                {formatCurrency(calculatedMonthlyTax, 'HUF')}
              </span>
              <span className="text-xs text-muted-foreground block">/ hó</span>
            </div>
          </div>

          {/* Megjegyzések */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">Megjegyzés / Üzembentartási információk</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Pl. Céghasználati megállapodás száma, forgalmi engedély érvényesség..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Mégse
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCar ? 'Gépjármű mentése' : 'Gépjármű felvétele'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
