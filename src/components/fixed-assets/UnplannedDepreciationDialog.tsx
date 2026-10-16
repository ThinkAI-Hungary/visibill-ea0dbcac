import { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TrendingDown, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { formatCurrency } from '@/lib/utils';
import { calculateDepreciation } from '@/hooks/useDepreciation';
import {
  getNextUnplannedDepreciationDocId,
  validateUnplannedDepreciation,
  postUnplannedDepreciationToLedger,
  type UnplannedDepreciationType,
} from '@/lib/fixed-assets/unplannedDepreciationService';
import type { FixedAsset, AssetEvent } from '@/types/fixed-assets';

interface UnplannedDepreciationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset;
  events?: AssetEvent[];
  onSuccess?: () => void;
}

export function UnplannedDepreciationDialog({
  open,
  onOpenChange,
  asset,
  events = [],
  onSuccess,
}: UnplannedDepreciationDialogProps) {
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const [eventType, setEventType] = useState<UnplannedDepreciationType>('unplanned_depreciation');
  const [amountStr, setAmountStr] = useState('');
  const [postingDate, setPostingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [documentId, setDocumentId] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [docIdLoading, setDocIdLoading] = useState(false);

  // Számviteli könyv szerinti érték kiszámítása
  const depCalculation = useMemo(() => {
    return calculateDepreciation({
      acquisitionValue: asset.acquisition_value,
      residualValue: asset.residual_value,
      activationDate: new Date(asset.activation_date),
      usefulLifeMonths: asset.useful_life_months,
      taoRatePercent: asset.tao_rate_override ?? 20,
      depreciationMethod: asset.depreciation_method,
      depreciationSchedule: asset.depreciation_schedule,
      taxDepreciationBase: asset.tax_depreciation_base,
      openingAccumulatedDepreciation: asset.opening_accumulated_depreciation,
      lastDepreciationDate: asset.last_depreciation_date,
    });
  }, [asset]);

  const currentBookValue = depCalculation.accounting.bookValue;
  const residualValue = asset.residual_value || 0;
  const maxWriteDown = Math.max(0, currentBookValue - residualValue);

  // Eddig elszámolt terven felüli ÉCS egyenlege az eseményekből
  const netPreviouslyRecognized = useMemo(() => {
    let recognized = 0;
    for (const ev of events) {
      if (ev.event_type === 'unplanned_depreciation') {
        recognized += Number(ev.new_values?.amount || 0);
      } else if (ev.event_type === 'unplanned_depreciation_reversal') {
        recognized -= Number(ev.new_values?.amount || 0);
      }
    }
    return Math.max(0, recognized);
  }, [events]);

  // Következő bizonylatszám automatikus betöltése a megnyitáskor
  useEffect(() => {
    let active = true;
    if (open && selectedCompany?.id) {
      const year = new Date().getFullYear();
      getNextUnplannedDepreciationDocId(selectedCompany.id, year)
        .then(docId => {
          if (active) {
            setDocumentId(docId);
            setDocIdLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setDocIdLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [open, selectedCompany?.id]);

  const parsedAmount = parseFloat(amountStr) || 0;

  const validation = useMemo(() => {
    return validateUnplannedDepreciation({
      eventType,
      amount: parsedAmount,
      currentBookValue,
      residualValue,
      previouslyRecognizedUnplanned: netPreviouslyRecognized,
    });
  }, [eventType, parsedAmount, currentBookValue, residualValue, netPreviouslyRecognized]);

  const handleSubmit = async () => {
    if (!selectedCompany?.id || !validation.valid || parsedAmount <= 0) return;

    if (!documentId.trim()) {
      toast({ title: 'Hiányzó adat', description: 'Kérjük adjon meg bizonylatszámot!', variant: 'destructive' });
      return;
    }

    if (!reason.trim()) {
      toast({ title: 'Hiányzó indoklás', description: 'Az indoklás és szakmai leírás megadása kötelező!', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await postUnplannedDepreciationToLedger({
        companyId: selectedCompany.id,
        assetId: asset.id,
        eventType,
        amount: parsedAmount,
        postingDate,
        documentId: documentId.trim(),
        reason: reason.trim(),
        currency: asset.currency || 'HUF',
      });

      if (!res.success) {
        toast({
          title: 'Hiba a feladás során',
          description: res.error || 'Nem sikerült a könyvelés végrehajtása.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Sikeres könyvelés!',
        description: res.message || `${documentId} bizonylat sikeresen lekönyvelve a Vegyes naplóba.`,
      });

      queryClient.invalidateQueries({ queryKey: ['fixed_assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset_events'] });
      queryClient.invalidateQueries({ queryKey: ['accounty_journal_entries'] });

      onSuccess?.();
      onOpenChange(false);
      setAmountStr('');
      setReason('');
    } catch (err: any) {
      toast({
        title: 'Váratlan hiba',
        description: err.message || 'Hiba történt a művelet közben.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {eventType === 'unplanned_depreciation' ? (
              <TrendingDown className="h-5 w-5 text-destructive" />
            ) : (
              <TrendingUp className="h-5 w-5 text-success" />
            )}
            <DialogTitle>Terven felüli Értékcsökkenés / Visszaírás</DialogTitle>
          </div>
          <DialogDescription>
            {asset.name} ({asset.inventory_number}) — Főkönyvi vegyes feladás és analitika
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Művelet jellege */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Művelet jogcíme és könyvelése</Label>
            <RadioGroup
              value={eventType}
              onValueChange={v => setEventType(v as UnplannedDepreciationType)}
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            >
              <div
                className={`flex items-start gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                  eventType === 'unplanned_depreciation'
                    ? 'border-destructive bg-destructive/5'
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setEventType('unplanned_depreciation')}
              >
                <RadioGroupItem value="unplanned_depreciation" id="unplanned_dep" className="mt-0.5" />
                <div className="text-xs">
                  <Label htmlFor="unplanned_dep" className="font-medium cursor-pointer text-destructive">
                    Elszámolás (866)
                  </Label>
                  <p className="text-muted-foreground mt-0.5">T 866 — K 1x9 (Ráfordítás)</p>
                </div>
              </div>

              <div
                className={`flex items-start gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                  eventType === 'unplanned_depreciation_reversal'
                    ? 'border-success bg-success/5'
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => setEventType('unplanned_depreciation_reversal')}
              >
                <RadioGroupItem value="unplanned_depreciation_reversal" id="unplanned_rev" className="mt-0.5" />
                <div className="text-xs">
                  <Label htmlFor="unplanned_rev" className="font-medium cursor-pointer text-success">
                    Visszaírás (966)
                  </Label>
                  <p className="text-muted-foreground mt-0.5">T 1x9 — K 966 (Egyéb bevétel)</p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Eszköz aktuális pénzügyi státusza */}
          <div className="bg-muted/50 rounded-lg p-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Könyv szerinti érték:</span>
              <p className="font-semibold text-foreground text-sm">
                {formatCurrency(currentBookValue, asset.currency)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Maradványérték:</span>
              <p className="font-semibold text-foreground text-sm">
                {formatCurrency(residualValue, asset.currency)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Max. leírható összeg:</span>
              <p className="font-semibold text-destructive">
                {formatCurrency(maxWriteDown, asset.currency)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Korábbi nettó TF-ÉCS:</span>
              <p className="font-semibold text-info">
                {formatCurrency(netPreviouslyRecognized, asset.currency)}
              </p>
            </div>
          </div>

          {/* Dátum és Bizonylatszám */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="postingDate" className="text-xs">Könyvelés dátuma</Label>
              <Input
                id="postingDate"
                type="date"
                value={postingDate}
                onChange={e => setPostingDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="docId" className="text-xs">Bizonylatszám</Label>
                {docIdLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>
              <Input
                id="docId"
                placeholder="TF-ÉCS-2026-0001"
                value={documentId}
                onChange={e => setDocumentId(e.target.value)}
              />
            </div>
          </div>

          {/* Összeg mező */}
          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-xs">
              {eventType === 'unplanned_depreciation'
                ? 'Elszámolandó terven felüli ÉCS összege (Ft)'
                : 'Visszaírandó terven felüli ÉCS összege (Ft)'}
            </Label>
            <Input
              id="amount"
              type="number"
              min="1"
              step="1"
              placeholder="0"
              value={amountStr}
              onChange={e => setAmountStr(e.target.value)}
              className={!validation.valid && parsedAmount > 0 ? 'border-destructive focus-visible:ring-destructive' : ''}
            />
            {parsedAmount > 0 && (
              <p className="text-xs text-muted-foreground">
                Kerekített összeg: <strong className="text-foreground">{formatCurrency(parsedAmount, asset.currency)}</strong>
              </p>
            )}
          </div>

          {/* Validációs figyelmeztetés */}
          {!validation.valid && parsedAmount > 0 && (
            <Alert variant="destructive" className="py-2 text-xs">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-xs font-semibold">Érvénytelen összeg</AlertTitle>
              <AlertDescription>{validation.error}</AlertDescription>
            </Alert>
          )}

          {/* Indoklás / szakvélemény */}
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs">Indoklás és szakértői hivatkozás *</Label>
            <Textarea
              id="reason"
              rows={2}
              placeholder="Pl. Sérülés miatti fizikai értékvesztés kárfelvételi jegyzőkönyv (KF-2026/04) alapján..."
              value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Mégse
          </Button>
          <Button
            type="button"
            variant={eventType === 'unplanned_depreciation' ? 'destructive' : 'default'}
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !validation.valid ||
              parsedAmount <= 0 ||
              !documentId.trim() ||
              !reason.trim()
            }
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {eventType === 'unplanned_depreciation'
              ? 'Terven felüli ÉCS könyvelése (866)'
              : 'ÉCS visszaírás könyvelése (966)'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
