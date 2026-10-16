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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Package2, Sparkles, RefreshCw, Loader2, CheckCircle2, FileText, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { formatCurrency } from '@/lib/utils';
import {
  useTaoTemplates,
  useCreateFixedAsset,
  generateInventoryNumber,
  useAssetGlAccounts,
} from '@/hooks/useFixedAssets';
import { useCompanyLocations } from '@/hooks/useCompanyLocations';
import { useCostCenters } from '@/hooks/accounty/useAccountyCRUD';
import { useProjectList } from '@/hooks/useProjectList';
import { useActivePreset } from '@/hooks/useActivePreset';
import { detectAssetCandidate } from '@/lib/fixed-assets/assetInvoiceCandidateService';

interface CreateAssetFromInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    line_description: string | null;
    net_amount: number | null;
    gross_amount?: number | null;
    unit_price?: number | null;
    quantity?: number | null;
    product_code?: string | null;
    vtsz_teszor?: string | null;
    gl_account_number?: string | null;
  };
  invoice: {
    id: string;
    invoice_number?: string | null;
    supplier_name?: string | null;
    fulfillment_date?: string | null;
    issue_date?: string | null;
    currency?: string | null;
    source?: 'submitted' | 'nav' | null;
    pdf_url?: string | null;
  };
  onSuccess?: (newAsset: any) => void;
}

function getDefaultTodayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export function CreateAssetFromInvoiceDialog({
  open,
  onOpenChange,
  item,
  invoice,
  onSuccess,
}: CreateAssetFromInvoiceDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { selectedCompany } = useCompany();

  const companyId = selectedCompany?.id || '';
  const { locations = [] } = useCompanyLocations(companyId);
  const { data: costCenters = [] } = useCostCenters(companyId);
  const { projects = [] } = useProjectList();
  const { activePresetId } = useActivePreset(companyId);
  const { data: taoTemplates = [] } = useTaoTemplates();
  const { data: glAccounts = [] } = useAssetGlAccounts(companyId, activePresetId);
  const createAsset = useCreateFixedAsset();

  // Intelligens detektálás
  const candidateResult = useMemo(() => {
    return detectAssetCandidate(item);
  }, [item]);

  // Form állapotok
  const [name, setName] = useState(item.line_description || '');
  const [inventoryNumber, setInventoryNumber] = useState('');
  const [generatingInvNumber, setGeneratingInvNumber] = useState(false);
  const [acquisitionValueStr, setAcquisitionValueStr] = useState(
    String(Math.round(item.net_amount ?? (item.unit_price && item.quantity ? item.unit_price * item.quantity : 0)))
  );
  const [residualValueStr, setResidualValueStr] = useState('0');
  const [activationDate, setActivationDate] = useState(
    invoice.fulfillment_date || invoice.issue_date || getDefaultTodayIso()
  );
  const [purchaseDate, setPurchaseDate] = useState(
    invoice.issue_date || invoice.fulfillment_date || getDefaultTodayIso()
  );
  const [usefulLifeMonthsStr, setUsefulLifeMonthsStr] = useState(
    String(candidateResult.suggestedUsefulLifeMonths || 36)
  );
  const [depreciationMethod, setDepreciationMethod] = useState<'linear' | 'immediate'>('linear');
  const [taoRateStr, setTaoRateStr] = useState(String(candidateResult.suggestedTaoRate || 20));
  const [glAccountId, setGlAccountId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [vtszTeszor, setVtszTeszor] = useState(item.vtsz_teszor || item.product_code || '');

  // Leltári szám és főkönyvi számla javaslat betöltése a megnyitáskor
  useEffect(() => {
    if (open && companyId) {
      setGeneratingInvNumber(true);
      generateInventoryNumber(companyId, invoice.invoice_number || null)
        .then(invNum => setInventoryNumber(invNum))
        .catch(() => setInventoryNumber(`TE-${new Date().getFullYear()}-0001`))
        .finally(() => setGeneratingInvNumber(false));

      // Javasolt főkönyvi számla automatikus kiválasztása
      const prefix = candidateResult.suggestedGlAccountPrefix || '13';
      const matchedGl = glAccounts.find((a: any) => a.gl_number.startsWith(prefix));
      if (matchedGl) {
        setGlAccountId(matchedGl.id);
      } else if (glAccounts.length > 0) {
        setGlAccountId(glAccounts[0].id);
      }

      // Ha kisértékű (pl. < 200 000 Ft és azonnali), javasoljuk az azonnali leírást
      const netVal = Number(item.net_amount || 0);
      if (netVal > 0 && netVal < 200000) {
        setDepreciationMethod('immediate');
        setUsefulLifeMonthsStr('1');
        setTaoRateStr('100');
      } else {
        setDepreciationMethod('linear');
      }
    }
  }, [open, companyId, invoice.invoice_number, candidateResult, glAccounts, item.net_amount]);

  const parsedAcqValue = parseFloat(acquisitionValueStr) || 0;
  const parsedResidualValue = parseFloat(residualValueStr) || 0;
  const parsedMonths = parseInt(usefulLifeMonthsStr, 10) || 1;
  const parsedTaoRate = parseFloat(taoRateStr) || 20;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !companyId) return;

    if (!name.trim()) {
      toast({ title: 'Hiányzó megnevezés', description: 'Az eszköz neve kötelező!', variant: 'destructive' });
      return;
    }

    if (!inventoryNumber.trim()) {
      toast({ title: 'Hiányzó leltári szám', description: 'A leltári szám megadása kötelező!', variant: 'destructive' });
      return;
    }

    if (parsedAcqValue <= 0) {
      toast({ title: 'Érvénytelen bekerülési érték', description: 'A bekerülési értéknek 0-nál nagyobbnak kell lennie!', variant: 'destructive' });
      return;
    }

    try {
      const newAsset = await createAsset.mutateAsync({
        companyId,
        userId: user.id,
        inventoryNumber: inventoryNumber.trim(),
        name: name.trim(),
        acquisitionValue: parsedAcqValue,
        residualValue: parsedResidualValue,
        currency: invoice.currency || 'HUF',
        purchaseDate,
        activationDate,
        usefulLifeMonths: parsedMonths,
        depreciationMethod,
        taoTemplateId: null,
        taoRateOverride: parsedTaoRate,
        locationId: locationId && locationId !== 'none' ? locationId : null,
        projectId: projectId && projectId !== 'none' ? projectId : null,
        glAccountId: glAccountId || null,
        vtszTeszor: vtszTeszor.trim() || undefined,
        supplierName: invoice.supplier_name || null,
        sourceInvoiceId: invoice.id,
        sourceInvoiceType: (invoice.source as any) || 'submitted',
        sourceInvoiceNumber: invoice.invoice_number || null,
        activatedByUserId: user.id,
        activatedByName: (user.user_metadata?.full_name || user.email || 'Felhasználó') as string,
      });

      toast({
        title: 'Tárgyi eszköz sikeresen aktiválva!',
        description: `${name} (${inventoryNumber}) felvéve a TÉNY analitikába és összekötve a számlával.`,
      });

      onSuccess?.(newAsset);
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Hiba az aktiválás során',
        description: err.message || 'Nem sikerült létrehozni a tárgyi eszközt.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Package2 className="h-5 w-5 text-primary" />
            <DialogTitle>Számlatétel aktiválása Tárgyi Eszközként (TÉNY)</DialogTitle>
          </div>
          <DialogDescription>
            {invoice.invoice_number ? `Számla: ${invoice.invoice_number}` : 'Számlatétel'} — {invoice.supplier_name || 'Szállító'}
          </DialogDescription>
        </DialogHeader>

        {/* Intelligens észlelési infó panel */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-primary flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Javasolt besorolás: {candidateResult.suggestedCategory}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-primary/10 text-primary uppercase">
              {candidateResult.confidence} megbízhatóság
            </span>
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
            {candidateResult.reasons.map((r, i) => (
              <span key={i} className="flex items-center gap-1">
                • {r}
              </span>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Megnevezés */}
          <div className="space-y-1.5">
            <Label htmlFor="assetName" className="text-xs">Eszköz megnevezése *</Label>
            <Input
              id="assetName"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Pl. Dell Latitude 5540 Laptop"
              required
            />
          </div>

          {/* Leltári szám & Főkönyvi számla */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="invNum" className="text-xs">Leltári szám *</Label>
                {generatingInvNumber && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              <Input
                id="invNum"
                value={inventoryNumber}
                onChange={e => setInventoryNumber(e.target.value)}
                placeholder="Pl. TE-2026-0001"
                className="font-mono font-semibold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Főkönyvi számla (1-es számlaosztály)</Label>
              <Select value={glAccountId} onValueChange={setGlAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Válassz számlát..." />
                </SelectTrigger>
                <SelectContent>
                  {glAccounts
                    .filter((a: any) => a.gl_number.startsWith('1'))
                    .map((a: any) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.gl_number} - {a.short_name || a.description}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Értékek: Bekerülési & Maradványérték */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="acqValue" className="text-xs">Bekerülési érték (Ft) *</Label>
              <Input
                id="acqValue"
                type="number"
                min="1"
                value={acquisitionValueStr}
                onChange={e => setAcquisitionValueStr(e.target.value)}
                required
              />
              <span className="text-[11px] text-muted-foreground">
                Számla tétel nettó értéke: {formatCurrency(parsedAcqValue, invoice.currency || 'HUF')}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resValue" className="text-xs">Maradványérték (Ft)</Label>
              <Input
                id="resValue"
                type="number"
                min="0"
                value={residualValueStr}
                onChange={e => setResidualValueStr(e.target.value)}
              />
            </div>
          </div>

          {/* Dátumok: Beszerzés & Aktiválás */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="purchDate" className="text-xs">Beszerzés dátuma</Label>
              <Input
                id="purchDate"
                type="date"
                value={purchaseDate}
                onChange={e => setPurchaseDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="actDate" className="text-xs">Aktiválás dátuma *</Label>
              <Input
                id="actDate"
                type="date"
                value={activationDate}
                onChange={e => setActivationDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Leírási paraméterek: Módszer, Hasznos élettartam, TAO kulcs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Leírási módszer</Label>
              <Select
                value={depreciationMethod}
                onValueChange={(v: any) => {
                  setDepreciationMethod(v);
                  if (v === 'immediate') {
                    setUsefulLifeMonthsStr('1');
                    setTaoRateStr('100');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">Lineáris</SelectItem>
                  <SelectItem value="immediate">Azonnali (100% kisértékű)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="usefulMonths" className="text-xs">Hasznos élettartam (hó)</Label>
              <Input
                id="usefulMonths"
                type="number"
                min="1"
                max="600"
                value={usefulLifeMonthsStr}
                onChange={e => setUsefulLifeMonthsStr(e.target.value)}
                disabled={depreciationMethod === 'immediate'}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="taoRate" className="text-xs">TAO ÉCS kulcs (%)</Label>
              <Input
                id="taoRate"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={taoRateStr}
                onChange={e => setTaoRateStr(e.target.value)}
              />
            </div>
          </div>

          {/* VTSZ / Költséghely / Helyszín */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="vtsz" className="text-xs">VTSZ / SZJ / TESZOR kód</Label>
              <Input
                id="vtsz"
                placeholder="Pl. 84713000"
                value={vtszTeszor}
                onChange={e => setVtszTeszor(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Telephely / Iroda</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Válassz telephelyet..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nincs megadva</SelectItem>
                  {locations.map(loc => (
                    <SelectItem key={loc.id} value={loc.id}>
                      {loc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createAsset.isPending}
            >
              Mégse
            </Button>
            <Button type="submit" disabled={createAsset.isPending || parsedAcqValue <= 0}>
              {createAsset.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Aktiválás TÉNY-ben
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
