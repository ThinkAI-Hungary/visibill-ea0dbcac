import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/lib/locale/formatters';
import { CalendarIcon, CreditCard, Banknote, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatCurrency } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface ManualPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceAmount: number;
  invoiceCurrency: string;
  onSuccess?: () => void;
}

export function ManualPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceAmount,
  invoiceCurrency,
  onSuccess
}: ManualPaymentDialogProps) {
  const { t } = useTranslation(['invoices', 'common']);
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [paymentType, setPaymentType] = useState<string>('private_card');
  const [note, setNote] = useState<string>('');

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const { error } = await supabase.rpc('record_manual_invoice_payment', {
        p_invoice_id: invoiceId,
        p_payment_date: format(date, 'yyyy-MM-dd'),
        p_payment_type: paymentType,
        p_note: note.trim() || null
      });

      if (error) throw error;

      toast({
        title: t('invoices:dialogs.manual_payment.toast_success'),
        description: t('invoices:dialogs.manual_payment.toast_success_desc'),
        variant: 'success',
      });

      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error recording manual payment:', err);
      toast({
        title: t('common:status.error', 'Hiba történt'),
        description: err.message || t('common:errors.unexpected', 'Nem sikerült rögzíteni a kifizetést.'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {t('invoices:dialogs.manual_payment.title')}
          </DialogTitle>
          <DialogDescription>
            {t('invoices:dialogs.manual_payment.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="bg-muted/50 p-3 rounded-lg border border-border/50 flex justify-between items-center">
            <span className="text-sm text-muted-foreground font-medium">{t('invoices:dialogs.manual_payment.amount_to_pay')}</span>
            <span className="text-lg font-bold font-mono">
              {formatCurrency(invoiceAmount, invoiceCurrency)}
            </span>
          </div>

          <div className="grid gap-4">
            {/* Dátum választó */}
            <div className="grid gap-2">
              <Label htmlFor="date">{t('invoices:dialogs.manual_payment.payment_date')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "yyyy. MMMM d.", { locale: getDateFnsLocale() }) : <span>{t('invoices:dialogs.manual_payment.select_date')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Típus választó */}
            <div className="grid gap-2">
              <Label htmlFor="type">{t('invoices:dialogs.manual_payment.payment_method')}</Label>
              <Select value={paymentType} onValueChange={setPaymentType}>
                <SelectTrigger id="type">
                  <SelectValue placeholder={t('invoices:dialogs.manual_payment.select_method')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private_card">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      <span>{t('invoices:dialogs.manual_payment.methods.private_card')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="cash">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4" />
                      <span>{t('invoices:dialogs.manual_payment.methods.cash')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="other">
                    <span>{t('invoices:dialogs.manual_payment.methods.other')}</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Megjegyzés */}
            <div className="grid gap-2">
              <Label htmlFor="note">{t('invoices:dialogs.manual_payment.note')}</Label>
              <div className="relative">
                <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  id="note"
                  placeholder={t('invoices:dialogs.manual_payment.note_placeholder')}
                  className="pl-9 min-h-[80px]"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {t('invoices:dialogs.manual_payment.confirm_button')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
