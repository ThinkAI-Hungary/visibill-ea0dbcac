import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrency } from '@/lib/utils';
import { Package } from 'lucide-react';

interface InvoiceLineItem {
  id: string;
  line_number: number;
  line_description: string | null;
  quantity: number | null;
  unit_of_measure: string | null;
  unit_price: number | null;
  net_amount: number | null;
  vat_rate: string | null;
  vat_amount: number | null;
  gross_amount: number | null;
  product_code: string | null;
}

interface InvoiceItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceNumber: string;
  currency: string;
}

export function InvoiceItemsDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  currency,
}: InvoiceItemsDialogProps) {
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open && invoiceId) {
      fetchInvoiceItems();
    }
  }, [open, invoiceId]);

  const fetchInvoiceItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('nav_invoice_items')
        .select('*')
        .eq('nav_invoice_id', invoiceId)
        .order('line_number', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching invoice items:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return '-';
    return formatCurrency(amount, currency);
  };

  const formatQuantity = (qty: number | null, unit: string | null) => {
    if (qty === null || qty === undefined) return '-';
    const formatted = qty.toLocaleString('hu-HU', { maximumFractionDigits: 2 });
    return unit ? `${formatted} ${unit}` : formatted;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Számlatételek
          </DialogTitle>
          <DialogDescription>
            Számla: {invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nincsenek elérhető tételek ehhez a számlához.</p>
              <p className="text-sm mt-2">
                A tételek automatikusan lekérésre kerülnek a következő szinkronizáláskor.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Megnevezés</TableHead>
                  <TableHead className="text-right">Mennyiség</TableHead>
                  <TableHead className="text-right">Egységár</TableHead>
                  <TableHead className="text-right">Nettó</TableHead>
                  <TableHead className="text-center">ÁFA</TableHead>
                  <TableHead className="text-right">ÁFA összeg</TableHead>
                  <TableHead className="text-right">Bruttó</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.line_number}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.line_description || '-'}</p>
                        {item.product_code && (
                          <p className="text-xs text-muted-foreground">
                            Kód: {item.product_code}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatQuantity(item.quantity, item.unit_of_measure)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(item.unit_price)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(item.net_amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.vat_rate || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAmount(item.vat_amount)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatAmount(item.gross_amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t pt-4 mt-4">
            <div className="flex justify-end gap-8 text-sm">
              <div>
                <span className="text-muted-foreground">Összesen nettó:</span>{' '}
                <span className="font-medium">
                  {formatAmount(items.reduce((sum, item) => sum + (item.net_amount || 0), 0))}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Összesen ÁFA:</span>{' '}
                <span className="font-medium">
                  {formatAmount(items.reduce((sum, item) => sum + (item.vat_amount || 0), 0))}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Összesen bruttó:</span>{' '}
                <span className="font-semibold">
                  {formatAmount(items.reduce((sum, item) => sum + (item.gross_amount || 0), 0))}
                </span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
