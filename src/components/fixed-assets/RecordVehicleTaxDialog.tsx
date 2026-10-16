import { useState, useMemo } from 'react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Receipt, CheckCircle, AlertTriangle, Loader2, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  recordVehicleTaxPayment,
  getVehicleTaxDueDate,
} from '@/lib/fixed-assets/companyCarTaxService';
import type { CompanyCar } from '@/types/company-car-tax';

interface RecordVehicleTaxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  car: CompanyCar;
  initialYear?: number;
  initialQuarter?: 1 | 2 | 3 | 4;
  onSuccess?: () => void;
}

function getDefaultYear(): number {
  return new Date().getFullYear();
}

function getDefaultTodayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export function RecordVehicleTaxDialog({
  open,
  onOpenChange,
  companyId,
  car,
  initialYear,
  initialQuarter = 1,
  onSuccess,
}: RecordVehicleTaxDialogProps) {
  const effectiveYear = initialYear ?? getDefaultYear();
  const { toast } = useToast();

  const [taxYear, setTaxYear] = useState<number>(effectiveYear);
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(initialQuarter);
  const [paidAmountStr, setPaidAmountStr] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => getDefaultTodayIso());
  const [dueDate, setDueDate] = useState(() => getVehicleTaxDueDate(effectiveYear, initialQuarter));
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ha módosul a negyedév vagy év, frissítjük a törvényi esedékességet
  const handleQuarterChange = (q: 1 | 2 | 3 | 4) => {
    setQuarter(q);
    setDueDate(getVehicleTaxDueDate(taxYear, q));
  };

  const handleYearChange = (y: number) => {
    setTaxYear(y);
    setDueDate(getVehicleTaxDueDate(y, quarter));
  };

  const parsedAmount = parseFloat(paidAmountStr) || 0;
  const isTimely = useMemo(() => {
    return !!paymentDate && !!dueDate && paymentDate <= dueDate;
  }, [paymentDate, dueDate]);

  // Korábbi befizetések lekérdezése az adott időszakra (duplikáció megelőzése)
  const { data: existingPayments = [] } = useQuery({
    queryKey: ['company_car_tax_payments', car.id, taxYear, quarter],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_car_tax_payments')
        .select('id, paid_amount, payment_date')
        .eq('car_id', car.id)
        .eq('tax_year', taxYear)
        .eq('quarter', quarter);
      return data || [];
    },
    enabled: open && !!car.id,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || parsedAmount <= 0) return;

    setIsSubmitting(true);
    try {
      await recordVehicleTaxPayment({
        company_id: companyId,
        car_id: car.id,
        tax_year: taxYear,
        quarter,
        paid_amount: parsedAmount,
        payment_date: paymentDate,
        due_date: dueDate,
        notes: notes.trim() || undefined,
      });

      toast({
        title: 'Gépjárműadó befizetés rögzítve',
        description: isTimely
          ? `${formatCurrency(parsedAmount, 'HUF')} levonásra kerül a ${taxYear}. Q${quarter} cégautóadóból.`
          : `Figyelem: A befizetés késedelmes volt, a törvény szerint nem vonható le a cégautóadóból!`,
        variant: isTimely ? 'default' : 'destructive',
      });

      onSuccess?.();
      onOpenChange(false);
      setPaidAmountStr('');
      setNotes('');
    } catch (err: any) {
      toast({
        title: 'Hiba a mentés során',
        description: err.message || 'Nem sikerült rögzíteni a befizetést.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <DialogTitle>Gépjárműadó (súlyadó) levonás rögzítése</DialogTitle>
          </div>
          <DialogDescription>
            {car.license_plate} {car.make_and_model ? `(${car.make_and_model})` : ''} — NAV befizetés összekapcsolása
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {existingPayments.length > 0 && (
            <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-300 py-2">
              <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-xs font-semibold">Korábbi befizetés létezik erre az időszakra</AlertTitle>
              <AlertDescription className="text-xs">
                Ehhez a járműhöz már rögzítésre került {existingPayments.length} db befizetés ({existingPayments.reduce((s, p) => s + (Number(p.paid_amount) || 0), 0).toLocaleString('hu-HU')} Ft értékben). Részletfizetés esetén az összeg hozzáadódik a korábbiakhoz.
              </AlertDescription>
            </Alert>
          )}

          {/* Adóév és Negyedév */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Adóév</Label>
              <Select value={String(taxYear)} onValueChange={v => handleYearChange(parseInt(v, 10))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Negyedév</Label>
              <Select value={String(quarter)} onValueChange={v => handleQuarterChange(parseInt(v, 10) as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">I. negyedév (Q1)</SelectItem>
                  <SelectItem value="2">II. negyedév (Q2)</SelectItem>
                  <SelectItem value="3">III. negyedév (Q3)</SelectItem>
                  <SelectItem value="4">IV. negyedév (Q4)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Összeg */}
          <div className="space-y-1.5">
            <Label htmlFor="amount" className="text-xs">Megfizetett gépjárműadó összege (Ft) *</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              step="1"
              placeholder="0"
              value={paidAmountStr}
              onChange={e => setPaidAmountStr(e.target.value)}
              required
            />
          </div>

          {/* Dátumok */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="paymentDate" className="text-xs">Befizetés dátuma *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={e => setPaymentDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dueDate" className="text-xs">Törvényi esedékesség</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Levonhatósági státusz jelzés */}
          {paymentDate && dueDate && (
            isTimely ? (
              <Alert className="py-2.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
                <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <AlertTitle className="text-xs font-semibold">Időben megfizetett adó</AlertTitle>
                <AlertDescription className="text-xs">
                  A gépjárműadó a törvényi esedékesség előtt/napján teljesült, így a cégautóadóból <strong>levonható</strong>.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive" className="py-2.5">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-xs font-semibold">Késedelmes befizetés</AlertTitle>
                <AlertDescription className="text-xs">
                  A törvény (Gjt. 17/D. §) értelmében a késedelmesen megfizetett gépjárműadó nem vonható le a cégautóadóból!
                </AlertDescription>
              </Alert>
            )
          )}

          {/* Megjegyzés */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">Megjegyzés / Bizonylatszám</Label>
            <Textarea
              id="notes"
              rows={2}
              placeholder="Pl. NAV Gépjárműadó számla (10032000-01076167) banki kivonat..."
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
            <Button type="submit" disabled={isSubmitting || parsedAmount <= 0}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Befizetés rögzítése
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
