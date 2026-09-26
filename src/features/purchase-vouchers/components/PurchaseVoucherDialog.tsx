import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Loader2, Sparkles, FileText, CheckCircle2 } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';
import { NumberInput } from '@/components/ui/number-input';
import { formatCurrency } from '@/lib/utils';
import { PurchaseVoucher, PurchaseVoucherFormData } from '../types';
import { calculateVoucherTotals } from '../utils';

interface PurchaseVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  voucher?: PurchaseVoucher | null;
  onSave: (data: { id?: string; formData: PurchaseVoucherFormData }) => Promise<any>;
  isLoading?: boolean;
}

const DEFAULT_ITEM = {
  item_name: '',
  vtszt_kn_code: '',
  quantity: 1,
  unit_of_measure: 'kg',
  unit_price: 0,
};

export const PurchaseVoucherDialog: React.FC<PurchaseVoucherDialogProps> = ({
  open,
  onOpenChange,
  voucher,
  onSave,
  isLoading = false,
}) => {
  const currentYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().split('T')[0];

  const [voucherNumber, setVoucherNumber] = useState('');
  const [producerName, setProducerName] = useState('');
  const [producerTaxId, setProducerTaxId] = useState('');
  const [producerCardNumber, setProducerCardNumber] = useState('');
  const [producerAddress, setProducerAddress] = useState('');
  const [producerBankAccount, setProducerBankAccount] = useState('');
  const [issueDate, setIssueDate] = useState(todayStr);
  const [fulfillmentDate, setFulfillmentDate] = useState(todayStr);
  const [paymentDueDate, setPaymentDueDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [compensationRate, setCompensationRate] = useState<number>(12);
  const [taxDeducted, setTaxDeducted] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<Array<typeof DEFAULT_ITEM & { id?: string }>>([
    { ...DEFAULT_ITEM },
  ]);

  // Reset or fill form when opening
  useEffect(() => {
    if (open) {
      if (voucher) {
        setVoucherNumber(voucher.voucher_number || '');
        setProducerName(voucher.producer_name || '');
        setProducerTaxId(voucher.producer_tax_id || '');
        setProducerCardNumber(voucher.producer_card_number || '');
        setProducerAddress(voucher.producer_address || '');
        setProducerBankAccount(voucher.producer_bank_account || '');
        setIssueDate(voucher.issue_date || todayStr);
        setFulfillmentDate(voucher.fulfillment_date || todayStr);
        setPaymentDueDate(voucher.payment_due_date || '');
        setPaymentMethod(voucher.payment_method || 'CASH');
        setCompensationRate(Number(voucher.compensation_surcharge_rate) || 12);
        setTaxDeducted(Number(voucher.tax_deducted) || 0);
        setPaymentStatus(voucher.payment_status || 'unpaid');
        setDescription(voucher.description || '');

        if (voucher.items && voucher.items.length > 0) {
          setItems(
            voucher.items.map((i) => ({
              id: i.id,
              item_name: i.item_name || '',
              vtszt_kn_code: i.vtszt_kn_code || '',
              quantity: Number(i.quantity) || 1,
              unit_of_measure: i.unit_of_measure || 'kg',
              unit_price: Number(i.unit_price) || 0,
            }))
          );
        } else {
          setItems([{ ...DEFAULT_ITEM }]);
        }
      } else {
        // New Voucher defaults
        setVoucherNumber(`FJ-${currentYear}/${String(Math.floor(Math.random() * 900) + 100)}`);
        setProducerName('');
        setProducerTaxId('');
        setProducerCardNumber('');
        setProducerAddress('');
        setProducerBankAccount('');
        setIssueDate(todayStr);
        setFulfillmentDate(todayStr);
        setPaymentDueDate('');
        setPaymentMethod('CASH');
        setCompensationRate(12);
        setTaxDeducted(0);
        setPaymentStatus('unpaid');
        setDescription('');
        setItems([{ ...DEFAULT_ITEM }]);
      }
    }
  }, [open, voucher, currentYear, todayStr]);

  // Calculations
  const calculations = useMemo(() => {
    return calculateVoucherTotals(items, compensationRate, Number(taxDeducted) || 0);
  }, [items, compensationRate, taxDeducted]);

  const handleItemChange = (index: number, field: string, val: any) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [...prev, { ...DEFAULT_ITEM }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherNumber.trim() || !producerName.trim()) return;

    const payload: PurchaseVoucherFormData = {
      voucher_number: voucherNumber.trim(),
      producer_name: producerName.trim(),
      producer_tax_id: producerTaxId.trim() || undefined,
      producer_card_number: producerCardNumber.trim() || undefined,
      producer_address: producerAddress.trim() || undefined,
      producer_bank_account: producerBankAccount.trim() || undefined,
      issue_date: issueDate,
      fulfillment_date: fulfillmentDate,
      payment_due_date: paymentDueDate || undefined,
      payment_method: paymentMethod,
      compensation_surcharge_rate: compensationRate,
      tax_deducted: taxDeducted || 0,
      payment_status: paymentStatus,
      description: description.trim() || undefined,
      items: items.filter((i) => i.item_name.trim().length > 0),
    };

    await onSave({ id: voucher?.id, formData: payload });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40 bg-muted/20 shrink-0">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  {voucher ? 'Felvásárlási Jegy Módosítása' : 'Új Felvásárlási Jegy Rögzítése'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Mezőgazdasági őstermelőtől történt felvásárlás szigorú számadású bizonylata
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary bg-primary/5">
              {voucherNumber || 'Új bizonylat'}
            </Badge>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {/* 1. Alapadatok & Bizonylat adatok */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-4 rounded-xl border bg-muted/20">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Bizonylatszám *</Label>
              <Input
                value={voucherNumber}
                onChange={(e) => setVoucherNumber(e.target.value)}
                placeholder="pl. FJ-2026/001"
                required
                className="h-8.5 font-mono text-xs bg-background"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Kiállítás Kelte *</Label>
              <DatePicker
                value={issueDate}
                onChange={(d) => d && setIssueDate(d)}
                className="h-8.5"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Átvétel / Teljesítés Dátuma *</Label>
              <DatePicker
                value={fulfillmentDate}
                onChange={(d) => d && setFulfillmentDate(d)}
                className="h-8.5"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fizetési Mód</Label>
              <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                <SelectTrigger className="h-8.5 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Készpénz (Házipénztár)</SelectItem>
                  <SelectItem value="TRANSFER">Banki átutalás (GIRO/SEPA)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fizetési Határidő</Label>
              <DatePicker
                value={paymentDueDate}
                onChange={(d) => setPaymentDueDate(d || '')}
                placeholder="Azonnal esedékes"
                className="h-8.5"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Fizetési Státusz</Label>
              <Select value={paymentStatus} onValueChange={(v: any) => setPaymentStatus(v)}>
                <SelectTrigger className="h-8.5 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unpaid">Kifizetésre vár</SelectItem>
                  <SelectItem value="paid">Kifizetve</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2. Őstermelő / Eladó adatai */}
          <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
            <h4 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
              <span>Őstermelő / Értékesítő Adatai</span>
              <span className="text-[10px] font-normal text-muted-foreground">(NAV 08-as adatszolgáltatáshoz kötelező adatok)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="md:col-span-2 space-y-1.5">
                <Label className="text-xs font-semibold">Őstermelő Neve *</Label>
                <Input
                  value={producerName}
                  onChange={(e) => setProducerName(e.target.value)}
                  placeholder="pl. Kovács János őstermelő"
                  required
                  className="h-8.5 bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Adóazonosító / Adószám</Label>
                <Input
                  value={producerTaxId}
                  onChange={(e) => setProducerTaxId(e.target.value)}
                  placeholder="8412345678"
                  className="h-8.5 font-mono bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Őstermelői Igazolvány / FELIR</Label>
                <Input
                  value={producerCardNumber}
                  onChange={(e) => setProducerCardNumber(e.target.value)}
                  placeholder="pl. 1234567 / FELIR-01"
                  className="h-8.5 font-mono bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Lakcím / Telephely</Label>
                <Input
                  value={producerAddress}
                  onChange={(e) => setProducerAddress(e.target.value)}
                  placeholder="pl. 6000 Kecskemét, Tanya 12."
                  className="h-8.5 bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Bankszámlaszám</Label>
                <Input
                  value={producerBankAccount}
                  onChange={(e) => setProducerBankAccount(e.target.value)}
                  placeholder="11773000-..."
                  className="h-8.5 font-mono bg-background"
                />
              </div>
            </div>
          </div>

          {/* 3. Kompenzációs felár választó */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <div>
              <span className="font-semibold block text-foreground">Kompenzációs Felár Mértéke</span>
              <span className="text-[11px] text-muted-foreground">
                Növénytermesztési termékekre 12%, állattenyésztési termékekre 7% (Áfa tv. 199. §)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={compensationRate === 12 ? 'default' : 'outline'}
                onClick={() => setCompensationRate(12)}
                className="h-8 text-xs font-semibold"
              >
                12% (Növénytermesztés)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={compensationRate === 7 ? 'default' : 'outline'}
                onClick={() => setCompensationRate(7)}
                className="h-8 text-xs font-semibold"
              >
                7% (Állattenyésztés)
              </Button>
              <Button
                type="button"
                size="sm"
                variant={compensationRate === 0 ? 'default' : 'outline'}
                onClick={() => setCompensationRate(0)}
                className="h-8 text-xs"
              >
                0% (Nincs felár)
              </Button>
            </div>
          </div>

          {/* 4. Tételek táblázata */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Felvásárolt Termények és Tételek</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddItem}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Tétel hozzáadása
              </Button>
            </div>

            <div className="border border-border/60 rounded-xl overflow-hidden bg-card">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-muted/80 border-b border-border/60 text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2 px-3 text-left">Termény / Megnevezés *</th>
                    <th className="py-2 px-3 text-left w-24">VTSZ / KN</th>
                    <th className="py-2 px-3 text-right w-24">Mennyiség</th>
                    <th className="py-2 px-3 text-left w-20">Egység</th>
                    <th className="py-2 px-3 text-right w-28">Egységár (Ft)</th>
                    <th className="py-2 px-3 text-right w-32">Nettó érték</th>
                    <th className="py-2 px-2 text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {items.map((item, idx) => {
                    const rowNet = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                    return (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="py-1.5 px-3">
                          <Input
                            value={item.item_name}
                            onChange={(e) => handleItemChange(idx, 'item_name', e.target.value)}
                            placeholder="pl. Étkezési búza, Alma, Méz"
                            required
                            className="h-8 text-xs bg-background"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <Input
                            value={item.vtszt_kn_code || ''}
                            onChange={(e) => handleItemChange(idx, 'vtszt_kn_code', e.target.value)}
                            placeholder="1001"
                            className="h-8 text-xs font-mono bg-background"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <NumberInput
                            value={item.quantity}
                            onChange={(e) => handleItemChange(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            showStepper={false}
                            min="0"
                            step="any"
                            className="h-8 text-xs text-right font-mono bg-background"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <Input
                            value={item.unit_of_measure}
                            onChange={(e) => handleItemChange(idx, 'unit_of_measure', e.target.value)}
                            placeholder="kg"
                            className="h-8 text-xs bg-background"
                          />
                        </td>
                        <td className="py-1.5 px-3">
                          <NumberInput
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                            showStepper={false}
                            min="0"
                            step="any"
                            className="h-8 text-xs text-right font-mono bg-background"
                          />
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono font-bold text-foreground">
                          {formatCurrency(rowNet)}
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={items.length <= 1}
                            onClick={() => handleRemoveItem(idx)}
                            className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 5. Összesítő sáv (Nettó, Kompenzáció, Levonás, Bruttó) */}
          <div className="p-4 rounded-xl border bg-muted/40 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-sans">Nettó felvásárlás</span>
                <span className="text-sm font-bold text-foreground">{formatCurrency(calculations.net)}</span>
              </div>
              <div className="text-muted-foreground">+</div>
              <div>
                <span className="text-emerald-600 block text-[10px] uppercase font-sans">Komp. felár ({compensationRate}%)</span>
                <span className="text-sm font-bold text-emerald-600">{formatCurrency(calculations.compensation)}</span>
              </div>
              {taxDeducted > 0 && (
                <>
                  <div className="text-muted-foreground">-</div>
                  <div>
                    <span className="text-rose-600 block text-[10px] uppercase font-sans">Levont SZJA</span>
                    <span className="text-sm font-bold text-rose-600">{formatCurrency(taxDeducted)}</span>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-muted-foreground block text-[10px] uppercase font-sans">Kifizetendő összeg</span>
                <span className="text-base font-bold text-primary">{formatCurrency(calculations.gross)}</span>
              </div>
            </div>
          </div>

          {/* 6. Megjegyzés */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Megjegyzés / Egyéb adatok</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="pl. Csatolt mérlegjegy száma, minőségi tanúsítvány"
              className="h-8.5 bg-background"
            />
          </div>
        </form>

        <DialogFooter className="px-6 py-3 border-t border-border/40 bg-muted/30 shrink-0 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Mégse
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={isLoading || !producerName.trim() || !voucherNumber.trim()}
            className="gap-2 font-semibold"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{voucher ? 'Módosítás mentése' : 'Bizonylat kiállítása & Mentés'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
