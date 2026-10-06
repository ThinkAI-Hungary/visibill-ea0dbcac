import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Receipt,
  FileCheck,
  AlertCircle,
  CreditCard,
  Banknote,
  Clock,
  Calendar,
  Building2,
  ArrowRight,
  Code2,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import type { OpgTransaction } from '@/types/opg';

interface OpgTransactionDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: OpgTransaction | null;
  onBookToPettyCash?: (txId: string) => Promise<void>;
  isBooking?: boolean;
}

export const OpgTransactionDetailSheet: React.FC<OpgTransactionDetailSheetProps> = ({
  open,
  onOpenChange,
  transaction,
  onBookToPettyCash,
  isBooking = false,
}) => {
  if (!transaction) return null;

  const fmtCurrency = (val: number) => {
    return new Intl.NumberFormat('hu-HU', {
      style: 'currency',
      currency: 'HUF',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'receipt':
        return { label: 'Nyugta', variant: 'default' as const };
      case 'z_report':
        return { label: 'Napi Z-zárás', variant: 'secondary' as const };
      case 'storno':
        return { label: 'Sztornó bizonylat', variant: 'destructive' as const };
      case 'refund':
        return { label: 'Visszáru bizonylat', variant: 'destructive' as const };
      case 'simplified_invoice':
        return { label: 'Egyszerűsített számla', variant: 'outline' as const };
      default:
        return { label: type, variant: 'outline' as const };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs">
            <CheckCircle2 className="h-3 w-3" /> Házipénztárba könyvelve
          </Badge>
        );
      case 'new':
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50 gap-1 text-xs">
            <Clock className="h-3 w-3" /> Függő könyvelés
          </Badge>
        );
      case 'skipped':
        return (
          <Badge variant="secondary" className="text-muted-foreground gap-1 text-xs">
            Átugorva (Nincs készpénz / Összesített mód)
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="gap-1 text-xs">
            <AlertCircle className="h-3 w-3" /> Hiba történt
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const typeInfo = getTypeLabel(transaction.transaction_type);
  const vatEntries = Object.entries(transaction.vat_breakdown || {});

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="h-5 w-5 text-primary" />
            <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
          </div>
          <SheetTitle className="text-xl font-bold tracking-tight">
            {transaction.receipt_number}
          </SheetTitle>
          <SheetDescription className="font-mono text-xs text-muted-foreground">
            Azonosító: {transaction.external_transaction_id}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Fő adatok kártya */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg text-sm border">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Dátum & Idő
              </span>
              <p className="font-medium">
                {transaction.transaction_date} {transaction.transaction_time}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" /> Pénztárgép
              </span>
              <p className="font-medium truncate">
                {transaction.cash_register?.name || 'N/A'}{' '}
                <span className="font-mono text-xs text-muted-foreground">
                  ({transaction.cash_register?.ap_code})
                </span>
              </p>
            </div>

            <div className="space-y-1 col-span-2 pt-2 border-t">
              <span className="text-xs text-muted-foreground">Házipénztári állapot</span>
              <div className="flex items-center justify-between mt-1">
                {getStatusBadge(transaction.processing_status)}
                {transaction.cash_amount > 0 &&
                  transaction.processing_status !== 'processed' &&
                  onBookToPettyCash && (
                    <Button
                      size="sm"
                      onClick={() => onBookToPettyCash(transaction.id)}
                      disabled={isBooking}
                      className="gap-1.5 h-8 text-xs"
                    >
                      {isBooking ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Banknote className="h-3.5 w-3.5" />
                      )}
                      Könyvelés most
                    </Button>
                  )}
              </div>
              {transaction.error_message && (
                <p className="text-xs text-destructive mt-1 bg-destructive/10 p-2 rounded">
                  {transaction.error_message}
                </p>
              )}
            </div>
          </div>

          {/* Fizetési módok részletezése */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              Fizetési módok és végösszeg
            </h4>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-emerald-600" /> Készpénz
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {fmtCurrency(transaction.cash_amount)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-600" /> Bankkártya
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {fmtCurrency(transaction.card_amount)}
                    </TableCell>
                  </TableRow>
                  {transaction.szep_card_amount > 0 && (
                    <TableRow>
                      <TableCell className="font-medium">SZÉP Kártya</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {fmtCurrency(transaction.szep_card_amount)}
                      </TableCell>
                    </TableRow>
                  )}
                  {transaction.voucher_amount > 0 && (
                    <TableRow>
                      <TableCell className="font-medium">Utalvány / Kupon</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {fmtCurrency(transaction.voucher_amount)}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Bruttó végösszeg</TableCell>
                    <TableCell className="text-right font-mono text-base text-primary">
                      {fmtCurrency(transaction.total_gross_amount)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ÁFA bontás táblázat */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" />
              ÁFA gyűjtők és adóalapok
            </h4>

            {vatEntries.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>ÁFA kulcs</TableHead>
                      <TableHead className="text-right">Nettó</TableHead>
                      <TableHead className="text-right">ÁFA tartalom</TableHead>
                      <TableHead className="text-right">Bruttó</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vatEntries.map(([key, val]) => {
                      if (!val || (val.net === 0 && val.gross === 0)) return null;
                      const label =
                        key === 'vat_27'
                          ? '27%'
                          : key === 'vat_18'
                          ? '18%'
                          : key === 'vat_5'
                          ? '5%'
                          : key === 'vat_aam'
                          ? 'AAM (0%)'
                          : key === 'vat_tam'
                          ? 'TAM (0%)'
                          : key;
                      return (
                        <TableRow key={key}>
                          <TableCell className="font-medium">{label}</TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {fmtCurrency(val.net)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {fmtCurrency(val.vat)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">
                            {fmtCurrency(val.gross)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Nincs részletes ÁFA adat.</p>
            )}
          </div>

          {/* Nyers NAV OPG JSON forrás */}
          {transaction.source_payload && (
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Code2 className="h-3.5 w-3.5" /> NAV OPG bizonylati forrásadatok
              </div>
              <pre className="p-3 bg-muted/70 rounded-md font-mono text-[11px] overflow-x-auto text-muted-foreground max-h-40 border">
                {JSON.stringify(transaction.source_payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
