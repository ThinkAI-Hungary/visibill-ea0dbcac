import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";

export interface PartnerInvoice {
  id: string;
  source: "nav" | "uploaded";
  invoice_number: string | null;
  invoice_direction: string | null;
  invoice_gross_amount: number | null;
  invoice_net_amount?: number | null;
  invoice_issue_date: string | null;
  payment_date?: string | null;
  currency: string | null;
  /** For uploaded: elado_nev / vevo_nev; for nav: supplier_name / customer_name */
  counterparty_name?: string | null;
  payment_method?: string | null;
}

interface PartnerInvoiceDetailDialogProps {
  invoice: PartnerInvoice | null;
  open: boolean;
  onClose: () => void;
}

interface InvoiceLineItem {
  id: string;
  line_number: number | null;
  line_description: string | null;
  quantity: number | null;
  unit_of_measure: string | null;
  unit_price: number | null;
  net_amount: number | null;
  vat_rate: string | null;
  vat_amount: number | null;
  gross_amount: number | null;
  product_code?: string | null;
  gl_classifications?: Record<string, { gl_number?: string; [key: string]: any }> | null;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "–";
  return new Date(dateStr).toLocaleDateString("hu-HU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatNum(val: number | null | undefined, currency = "HUF"): string {
  if (val === null || val === undefined) return "–";
  return formatCurrency(val, currency);
}

export function PartnerInvoiceDetailDialog({
  invoice,
  open,
  onClose,
}: PartnerInvoiceDetailDialogProps) {
  const isNav = invoice?.source === "nav";
  const currency = invoice?.currency || "HUF";
  const isOutbound = invoice?.invoice_direction === "OUTBOUND";

  const { data: items, isLoading: isLoadingItems } = useQuery<InvoiceLineItem[]>({
    queryKey: ["partner-invoice-items", invoice?.source, invoice?.id],
    queryFn: async () => {
      if (!invoice) return [];

      if (isNav) {
        const { data, error } = await supabase
          .from("nav_invoice_items")
          .select(
            "id, line_number, line_description, quantity, unit_of_measure, unit_price, net_amount, vat_rate, vat_amount, gross_amount, product_code, gl_classifications"
          )
          .eq("nav_invoice_id", invoice.id)
          .order("line_number", { ascending: true });
        if (error) throw error;
        return (data as InvoiceLineItem[]) || [];
      } else {
        const { data, error } = await supabase
          .from("invoice_items")
          .select(
            "id, line_number, line_description, quantity, unit_of_measure, unit_price, net_amount, vat_rate, vat_amount, gross_amount, product_code, gl_classifications"
          )
          .eq("invoice_id", invoice.id)
          .order("line_number", { ascending: true });
        if (error) throw error;
        return (data as InvoiceLineItem[]) || [];
      }
    },
    enabled: open && !!invoice?.id,
    staleTime: 60_000,
  });

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden bg-card/95 backdrop-blur-md border-border/50">
        <DialogHeader className="border-b border-border/40 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-4 pr-6">
            <div className="min-w-0">
              <DialogTitle className="font-mono text-base font-bold truncate">
                {invoice.invoice_number || "–"}
              </DialogTitle>
              {invoice.counterparty_name && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {invoice.counterparty_name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-semibold",
                  isOutbound
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                    : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                )}
              >
                {isOutbound ? "Kimenő" : "Bejövő"}
              </Badge>
              <Badge
                variant="outline"
                className="text-[10px] font-semibold bg-muted/50 text-muted-foreground"
              >
                {isNav ? "NAV" : "Beküldött"}
              </Badge>
            </div>
          </div>

          {/* Summary grid */}
          <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Kiállítás dátuma
              </p>
              <p className="font-medium mt-0.5">{formatDate(invoice.invoice_issue_date)}</p>
            </div>
            {invoice.payment_date && (
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  Fizetési határidő
                </p>
                <p className="font-medium mt-0.5">{formatDate(invoice.payment_date)}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Bruttó összeg
              </p>
              <p className="font-mono font-bold mt-0.5 text-sm">
                {formatNum(invoice.invoice_gross_amount, currency)}
              </p>
            </div>
            {invoice.payment_method && (
              <div>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  Fizetési mód
                </p>
                <p className="font-medium mt-0.5">{invoice.payment_method}</p>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Items */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 py-3 sticky top-0 bg-card/95 backdrop-blur-sm border-b border-border/40">
            Tételek
          </h4>

          {isLoadingItems ? (
            <div className="flex items-center justify-center h-24">
              <LoadingSpinner className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : !items || items.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground">
              Nincsenek tételek ehhez a számlához
            </div>
          ) : (
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider w-[32%]">
                    Megnevezés
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-right w-[9%]">
                    Menny.
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-right w-[7%]">
                    Egys.
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-right w-[13%]">
                    Nettó
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-right w-[7%]">
                    ÁFA
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-right w-[13%]">
                    Bruttó
                  </TableHead>
                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-center w-[13%]">
                    Főkönyvi
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={item.id || idx} className="border-border/30">
                    <TableCell className="py-2 font-medium leading-snug">
                      {item.line_description || "–"}
                      {item.product_code && (
                        <span className="block text-[10px] text-muted-foreground font-mono">
                          {item.product_code}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right py-2 tabular-nums">
                      {item.quantity !== null ? item.quantity : "–"}
                    </TableCell>
                    <TableCell className="text-right py-2 text-muted-foreground">
                      {item.unit_of_measure || "–"}
                    </TableCell>
                    <TableCell className="text-right py-2 tabular-nums font-mono">
                      {formatNum(item.net_amount, currency)}
                    </TableCell>
                    <TableCell className="text-right py-2 text-muted-foreground">
                      {item.vat_rate || "–"}
                    </TableCell>
                    <TableCell className="text-right py-2 tabular-nums font-mono font-semibold">
                      {formatNum(item.gross_amount, currency)}
                    </TableCell>
                    <TableCell className="text-center py-2">
                      {(() => {
                        const glClass = item.gl_classifications && Object.keys(item.gl_classifications).length > 0
                          ? Object.values(item.gl_classifications)[0]
                          : null;
                        return glClass?.gl_number ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                            {glClass.gl_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">–</span>
                        );
                      })()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
