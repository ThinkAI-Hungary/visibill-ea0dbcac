import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { formatCurrency } from '@/lib/utils';
import { requestAssetDisposal } from '@/lib/fixed-assets/assetDisposalPostingService';
import { reportError } from '@/lib/errorReporter';
import { DevelopmentReserveAlienationAlert } from './DevelopmentReserveAlienationAlert';
import {
  DISPOSAL_REASON_LABELS,
  type DisposalCommittee,
  type DisposalDetails,
  type DisposalReasonType,
  type DisposalWasteInfo,
  type FixedAsset,
} from '@/types/fixed-assets';

interface DisposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset;
}

const REASON_TYPES: DisposalReasonType[] = ['scrapping', 'sale', 'inventory_shortage', 'donation'];

const todayIso = () => new Date().toISOString().split('T')[0];

/**
 * Kivezetés kezdeményezése (TENY M1.4, D-4): a kérelem `Jóváhagyásra vár` állapotba teszi az eszközt;
 * a főkönyvi könyvelés kizárólag a jóváhagyáskor történik (DisposalApprovalDialog).
 * A szülő feltételesen rendereli, így minden megnyitáskor tiszta űrlappal indul.
 */
export function DisposalDialog({ open, onOpenChange, asset }: DisposalDialogProps) {
  const { t } = useTranslation(['hr', 'common']);
  const tt = (key: string, defaultValue: string, options?: Record<string, unknown>) =>
    t(`hr:fixed_assets.disposal_request.${key}`, { defaultValue, ...options });
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  const [reasonType, setReasonType] = useState<DisposalReasonType>('scrapping');
  const [disposalDate, setDisposalDate] = useState(todayIso);
  const [reason, setReason] = useState('');

  // Selejtezés
  const [chair, setChair] = useState('');
  const [membersText, setMembersText] = useState('');
  const [hazardous, setHazardous] = useState(false);
  const [wasteHandler, setWasteHandler] = useState('');
  const [wasteCode, setWasteCode] = useState('');
  const [wasteHandoverDate, setWasteHandoverDate] = useState('');

  // Értékesítés
  const [buyerName, setBuyerName] = useState('');
  const [saleValue, setSaleValue] = useState('');
  const [bookSaleRevenue, setBookSaleRevenue] = useState(true);
  const [saleCounter, setSaleCounter] = useState<'customer' | 'bank'>('customer');

  // Leltárhiány
  const [employeeName, setEmployeeName] = useState('');
  const [compensation, setCompensation] = useState('');

  // Térítés nélküli átadás
  const [recipientName, setRecipientName] = useState('');

  const validationError = (() => {
    if (!disposalDate) return tt('err_date', 'A kivezetés dátuma kötelező.');
    if (asset.activation_date && disposalDate < asset.activation_date) {
      return tt('err_date_before_activation', 'A kivezetés dátuma nem lehet korábbi az aktiválásnál.');
    }
    if (reasonType === 'scrapping' && !chair.trim()) return tt('err_chair', 'A selejtezési bizottság elnöke kötelező.');
    if ((reasonType === 'scrapping' || reasonType === 'inventory_shortage') && !reason.trim()) {
      return tt('err_reason', 'Az indoklás kötelező ennél a jogcímnél.');
    }
    if (reasonType === 'sale' && !(parseFloat(saleValue) > 0)) return tt('err_sale_value', 'Értékesítésnél a nettó eladási ár kötelező.');
    if (reasonType === 'donation' && !recipientName.trim()) return tt('err_recipient', 'Az átvevő megnevezése kötelező.');
    return null;
  })();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompany) throw new Error('Nincs kiválasztott cég');

      const committee: DisposalCommittee | null =
        reasonType === 'scrapping'
          ? { chair: chair.trim(), members: membersText.split('\n').map((m) => m.trim()).filter(Boolean) }
          : null;
      const waste: DisposalWasteInfo | null =
        reasonType === 'scrapping'
          ? {
              hazardous,
              handler: wasteHandler.trim() || undefined,
              waste_code: wasteCode.trim() || undefined,
              handover_date: wasteHandoverDate || undefined,
            }
          : null;

      const details: DisposalDetails = {};
      if (reasonType === 'scrapping') details.technical_reason = reason.trim() || undefined;
      if (reasonType === 'sale') {
        details.sale_value = parseFloat(saleValue) || 0;
        details.buyer_name = buyerName.trim() || undefined;
        details.book_sale_revenue = bookSaleRevenue;
        details.sale_counter = saleCounter;
      }
      if (reasonType === 'inventory_shortage') {
        details.liable_employee_name = employeeName.trim() || undefined;
        details.compensation_amount = parseFloat(compensation) || 0;
      }
      if (reasonType === 'donation') details.recipient_name = recipientName.trim();

      await requestAssetDisposal({
        companyId: selectedCompany.id,
        assetId: asset.id,
        reasonType,
        disposalDate,
        reason,
        committee,
        wasteInfo: waste,
        details,
      });
    },
    onSuccess: () => {
      if (selectedCompany) queryClient.invalidateQueries({ queryKey: ['fixedAssets', selectedCompany.id] });
      queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail', asset.id] });
      queryClient.invalidateQueries({ queryKey: ['project-fixed-assets'] });
      toast({
        title: tt('toast_success_title', 'Kivezetés kezdeményezve'),
        description: tt('toast_success_desc', '{{name}} jóváhagyásra vár — a könyvelés a jóváhagyás után történik.', { name: asset.name }),
      });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      reportError({ type: 'db_query', component: 'DisposalDialog', action: 'requestAssetDisposal', message: 'Disposal request failed', error });
      toast({
        title: tt('toast_error_title', 'Hiba'),
        description: error instanceof Error ? error.message : tt('toast_error_desc', 'Nem sikerült a kivezetés kezdeményezése.'),
        variant: 'destructive',
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" id="disposal-request-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            {tt('title', 'Kivezetés kezdeményezése')}
          </DialogTitle>
          <DialogDescription>
            {tt('description', '{{name}} ({{inv}}) kivezetése — bruttó érték: {{value}}', {
              name: asset.name,
              inv: asset.inventory_number,
              value: formatCurrency(asset.acquisition_value, asset.currency),
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-muted-foreground">
              {tt(
                'approval_notice',
                'A kivezetés „Jóváhagyásra vár” állapotba kerül. Főkönyvi könyvelés és a státuszváltás csak a könyvelői / vezetői jóváhagyás után történik.',
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="disposal-reason-type">{tt('type_label', 'Kivezetés jogcíme *')}</Label>
            <Select value={reasonType} onValueChange={(v) => setReasonType(v as DisposalReasonType)}>
              <SelectTrigger id="disposal-reason-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASON_TYPES.map((rt) => (
                  <SelectItem key={rt} value={rt}>
                    {DISPOSAL_REASON_LABELS[rt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="disposal-date">{tt('date_label', 'Kivezetés dátuma *')}</Label>
            <Input
              id="disposal-date"
              type="date"
              value={disposalDate}
              min={asset.activation_date || undefined}
              onChange={(e) => setDisposalDate(e.target.value)}
            />
          </div>

          {reasonType === 'scrapping' && (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">{tt('committee_title', 'Selejtezési bizottság')}</p>
              <div className="space-y-2">
                <Label htmlFor="disposal-chair">{tt('chair_label', 'Elnök *')}</Label>
                <Input id="disposal-chair" value={chair} onChange={(e) => setChair(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="disposal-members">{tt('members_label', 'Tagok (soronként egy név)')}</Label>
                <Textarea id="disposal-members" rows={3} value={membersText} onChange={(e) => setMembersText(e.target.value)} />
              </div>
              <p className="text-sm font-medium pt-1">{tt('waste_title', 'Hulladékkezelés')}</p>
              <div className="flex items-center gap-2">
                <Checkbox id="disposal-hazardous" checked={hazardous} onCheckedChange={(c) => setHazardous(c === true)} />
                <Label htmlFor="disposal-hazardous" className="cursor-pointer">
                  {tt('hazardous_label', 'Veszélyes hulladék')}
                </Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="disposal-waste-handler">{tt('waste_handler_label', 'Átvevő hulladékkezelő')}</Label>
                  <Input id="disposal-waste-handler" value={wasteHandler} onChange={(e) => setWasteHandler(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disposal-waste-code">{tt('waste_code_label', 'Hulladékkód (EWC)')}</Label>
                  <Input id="disposal-waste-code" value={wasteCode} onChange={(e) => setWasteCode(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="disposal-waste-date">{tt('waste_handover_label', 'Átadás dátuma')}</Label>
                <Input id="disposal-waste-date" type="date" value={wasteHandoverDate} onChange={(e) => setWasteHandoverDate(e.target.value)} />
              </div>
            </div>
          )}

          {reasonType === 'sale' && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label htmlFor="disposal-buyer">{tt('buyer_label', 'Vevő megnevezése')}</Label>
                <Input id="disposal-buyer" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="disposal-sale-value">{tt('sale_value_label', 'Nettó eladási ár ({{currency}}) *', { currency: asset.currency })}</Label>
                <Input
                  id="disposal-sale-value"
                  type="number"
                  min="0"
                  value={saleValue}
                  onChange={(e) => setSaleValue(e.target.value)}
                />
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="disposal-book-revenue"
                  checked={bookSaleRevenue}
                  onCheckedChange={(c) => setBookSaleRevenue(c === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="disposal-book-revenue" className="cursor-pointer leading-snug">
                  {tt(
                    'book_revenue_label',
                    'Az eladási bevételt (T 311/384 → K 961) a kivezetési tétel könyvelje. Kapcsold ki, ha a kimenő számla külön könyvelve van.',
                  )}
                </Label>
              </div>
              {bookSaleRevenue && (
                <div className="space-y-2">
                  <Label htmlFor="disposal-sale-counter">{tt('sale_counter_label', 'Ellenszámla')}</Label>
                  <Select value={saleCounter} onValueChange={(v) => setSaleCounter(v as 'customer' | 'bank')}>
                    <SelectTrigger id="disposal-sale-counter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">{tt('counter_customer', '311 — Vevők')}</SelectItem>
                      <SelectItem value="bank">{tt('counter_bank', '384 — Bankszámla')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {reasonType === 'inventory_shortage' && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label htmlFor="disposal-employee">{tt('employee_label', 'Felelős dolgozó')}</Label>
                <Input id="disposal-employee" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="disposal-compensation">{tt('compensation_label', 'Követelt kártérítés ({{currency}})', { currency: asset.currency })}</Label>
                <Input
                  id="disposal-compensation"
                  type="number"
                  min="0"
                  value={compensation}
                  onChange={(e) => setCompensation(e.target.value)}
                />
              </div>
            </div>
          )}

          {reasonType === 'donation' && (
            <div className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="disposal-recipient">{tt('recipient_label', 'Átvevő megnevezése *')}</Label>
              <Input id="disposal-recipient" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="disposal-reason">
              {reasonType === 'scrapping' || reasonType === 'inventory_shortage'
                ? tt('reason_label_required', 'Indoklás / műszaki ok *')
                : tt('reason_label', 'Indoklás / megjegyzés')}
            </Label>
            <Textarea
              id="disposal-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tt('reason_placeholder', 'Pl. fizikai elavulás, gazdaságtalan javítás, törés…')}
              rows={2}
            />
          </div>

          <DevelopmentReserveAlienationAlert asset={asset} disposalDate={disposalDate} />

          {validationError && (
            <p className="text-sm text-destructive" role="alert" id="disposal-validation-error">
              {validationError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {tt('cancel', 'Mégse')}
          </Button>
          <Button
            id="disposal-request-submit"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !!validationError}
            className="gap-2"
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {mutation.isPending ? tt('submitting', 'Küldés…') : tt('submit', 'Kivezetés kezdeményezése')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
