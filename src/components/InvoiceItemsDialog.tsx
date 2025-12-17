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

  // Calculate totals
  const totals = {
    net: items.reduce((sum, item) => sum + (item.net_amount || 0), 0),
    vat: items.reduce((sum, item) => sum + (item.vat_amount || 0), 0),
    gross: items.reduce((sum, item) => sum + (item.gross_amount || 0), 0),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span className="text-muted-foreground text-sm font-normal">Számlatételek</span>
              <p className="font-mono text-xl font-bold tracking-tight">{invoiceNumber}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                <Package className="h-8 w-8 opacity-50" />
              </div>
              <p className="font-medium">Nincsenek elérhető tételek</p>
              <p className="text-sm mt-1 opacity-75">
                A tételek automatikusan lekérésre kerülnek a következő szinkronizáláskor.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="w-12 font-semibold">#</TableHead>
                    <TableHead className="font-semibold">Megnevezés</TableHead>
                    <TableHead className="text-right font-semibold">Mennyiség</TableHead>
                    <TableHead className="text-right font-semibold">Egységár</TableHead>
                    <TableHead className="text-right font-semibold">Nettó</TableHead>
                    <TableHead className="text-center font-semibold">ÁFA</TableHead>
                    <TableHead className="text-right font-semibold">ÁFA összeg</TableHead>
                    <TableHead className="text-right font-semibold">Bruttó</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow 
                      key={item.id}
                      className={index % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'}
                    >
                      <TableCell className="font-mono text-muted-foreground">
                        {item.line_number}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.line_description || '-'}</p>
                          {item.product_code && (
                            <p className="text-xs text-muted-foreground font-mono">
                              {item.product_code}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatQuantity(item.quantity, item.unit_of_measure)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatAmount(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatAmount(item.net_amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          {item.vat_rate || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatAmount(item.vat_amount)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatAmount(item.gross_amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border/50 pt-5 mt-4">
            <div className="flex justify-end">
              <div className="bg-muted/30 rounded-lg p-4 min-w-[320px]">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Összesen nettó:</span>
                    <span className="font-mono font-medium">{formatAmount(totals.net)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Összesen ÁFA:</span>
                    <span className="font-mono font-medium">{formatAmount(totals.vat)}</span>
                  </div>
                  <div className="h-px bg-border/50 my-3" />
                  <div className="flex justify-between items-center">
                    <span className="text-foreground font-medium">Összesen bruttó:</span>
                    <span className="font-mono text-xl font-bold text-primary">
                      {formatAmount(totals.gross)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}