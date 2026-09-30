import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, 
  ShieldCheck, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  Coins, 
  FileCheck2, 
  Hash, 
  Loader2 
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { printCashReport } from './print/printCashReport';
import { printCashReceipt } from './print/printCashReceipt';
import { numberToWordsHu } from '@/lib/documents/templates/cashReceiptTemplate';
import { cn } from '@/lib/utils';
import { useCashReportDetails } from '@/hooks/useCashReports';
import { fmtBalance, fmtAmount } from './types';

interface CashReportDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string | null;
  registerName: string;
  onPrint?: () => void;
}

export function CashReportDetailDialog({
  open,
  onOpenChange,
  reportId,
  registerName,
  onPrint,
}: CashReportDetailDialogProps) {
  const { selectedCompany } = useCompany();
  const { data, isLoading } = useCashReportDetails(reportId || undefined);

  if (!reportId) return null;

  const report = data?.report;
  const entries = data?.entries || [];
  const sheet = data?.denominationSheet;
  const protocol = data?.protocol;

  const handlePrintReport = () => {
    if (!report) return;
    printCashReport({
      report,
      registerName,
      companyName: selectedCompany?.name || 'Vállalkozás',
      companyTaxNumber: (selectedCompany as any)?.adoszam,
      companyAddress: (selectedCompany as any)?.szekhely,
      entries,
      denominationSheet: sheet,
      protocol,
    });
  };

  const handlePrintVoucher = (entry: any) => {
    const isIncome = Number(entry.amount) > 0;
    const absAmt = Math.abs(Number(entry.amount));
    printCashReceipt({
      receipt: {
        id: entry.id,
        company_id: entry.company_id,
        cash_register_id: entry.register_id,
        cash_entry_id: entry.id,
        receipt_type: isIncome ? 'in' : 'out',
        seq_no: entry.line_no || 1,
        receipt_number: `${isIncome ? 'BPB' : 'KPB'}-${entry.entry_date?.slice(0, 4) || '2026'}-${String(entry.line_no || 1).padStart(5, '0')}`,
        issued_at: entry.entry_date,
        partner_id: entry.partner_id,
        payer_or_payee_name: entry.partner?.name || (isIncome ? 'Készpénzes vásárló' : 'Készpénzes partner'),
        payer_or_payee_address: undefined,
        amount: absAmt,
        currency: entry.currency || report?.currency || 'HUF',
        amount_in_words: numberToWordsHu(absAmt),
        legal_title: entry.legal_title || (isIncome ? 'Készpénzes értékesítés' : 'Készpénzes kifizetés'),
        description: entry.description,
        is_cancelled: entry.status === 'cancelled',
        cancellation_reason: entry.cancelled_reason,
        cancelled_at: entry.cancelled_at,
        cancelled_by: entry.cancelled_by,
        created_by: entry.created_by,
        created_at: entry.created_at,
      },
      companyName: selectedCompany?.name || 'Vállalkozás',
      companyTaxNumber: (selectedCompany as any)?.adoszam,
      companyAddress: (selectedCompany as any)?.szekhely,
      registerName,
    });
  };
  const currency = report?.currency || 'HUF';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-5xl max-h-[92vh] flex flex-col p-4 sm:p-6 gap-4">
        <DialogHeader className="pb-2 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <span>Pénztárjelentés Részletei: {report?.report_number || 'Piszkozat'}</span>
                {report?.status === 'closed' && (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-xs">
                    <ShieldCheck className="w-3 h-3 mr-1" /> Lezárt (Hiteles)
                  </Badge>
                )}
                {report?.status === 'posted' && (
                  <Badge variant="outline" className="border-violet-500/40 text-violet-600 bg-violet-500/10 text-xs">
                    Könyvelve (381)
                  </Badge>
                )}
                {report?.status === 'reopened' && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/10 text-xs">
                    Újranyitott (v{report.version})
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {registerName} • Időszak: {report?.period_start} – {report?.period_end}
              </DialogDescription>
            </div>

            {report?.content_hash && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/60 rounded-md border text-[11px] font-mono text-muted-foreground" title={report.content_hash}>
                <Hash className="w-3.5 h-3.5 text-primary" />
                <span>SHA-256: {report.content_hash.slice(0, 10)}...{report.content_hash.slice(-6)}</span>
              </div>
            )}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground text-xs">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>Pénztárjelentés adatainak betöltése...</span>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {/* KPI Összefoglaló Kártyák */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Card className="shadow-none border-border/70 bg-card">
                <CardContent className="p-2.5">
                  <span className="text-[11px] text-muted-foreground block">Nyitó egyenleg:</span>
                  <span className="font-mono font-bold text-sm">{fmtBalance(report?.opening_balance || 0, currency)}</span>
                </CardContent>
              </Card>

              <Card className="shadow-none border-border/70 bg-card">
                <CardContent className="p-2.5">
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-medium">Összes bevétel (+):</span>
                  <span className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">+{fmtBalance(report?.total_in || 0, currency)}</span>
                </CardContent>
              </Card>

              <Card className="shadow-none border-border/70 bg-card">
                <CardContent className="p-2.5">
                  <span className="text-[11px] text-destructive block font-medium">Összes kiadás (-):</span>
                  <span className="font-mono font-bold text-sm text-destructive">-{fmtBalance(report?.total_out || 0, currency)}</span>
                </CardContent>
              </Card>

              <Card className="shadow-none border-primary/30 bg-primary/5">
                <CardContent className="p-2.5">
                  <span className="text-[11px] text-muted-foreground block font-medium">Záró készpénzállomány:</span>
                  <span className="font-mono font-bold text-sm text-primary">
                    {fmtBalance(report?.closing_balance_actual ?? report?.closing_balance_book ?? 0, currency)}
                  </span>
                </CardContent>
              </Card>
            </div>

            {/* Belső Tabok: Tételek | Címletjegyzék | Jegyzőkönyv */}
            <Tabs defaultValue="entries" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="h-8 text-xs w-fit">
                <TabsTrigger value="entries" className="text-xs gap-1.5 h-7">
                  <FileText className="w-3.5 h-3.5" /> Tételek ({entries.length} db)
                </TabsTrigger>
                <TabsTrigger value="denominations" className="text-xs gap-1.5 h-7">
                  <Coins className="w-3.5 h-3.5" /> Címletjegyzék
                </TabsTrigger>
                <TabsTrigger value="protocol" className="text-xs gap-1.5 h-7">
                  <FileCheck2 className="w-3.5 h-3.5" /> Zárási jegyzőkönyv
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Tételek táblázata */}
              <TabsContent value="entries" className="flex-1 overflow-auto border rounded-xl mt-2 bg-card">
                <Table className="text-xs">
                  <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b">
                    <TableRow>
                      <TableHead className="w-14 text-center">Sor</TableHead>
                      <TableHead className="w-24">Dátum</TableHead>
                      <TableHead className="w-20">Irány</TableHead>
                      <TableHead className="w-40">Jogcím</TableHead>
                      <TableHead>Partner / Leírás</TableHead>
                      <TableHead className="w-28 text-center">Ellenszámla</TableHead>
                      <TableHead className="w-28 text-right">Összeg</TableHead>
                      <TableHead className="w-16 text-center">Bizonylat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                          Nincsenek tételek ebben az időszakban.
                        </TableCell>
                      </TableRow>
                    ) : (
                      entries.map((entry, idx) => {
                        const isIncome = Number(entry.amount) > 0;
                        const isCancelled = entry.status === 'cancelled';
                        return (
                          <TableRow key={entry.id} className={cn("hover:bg-muted/30", isCancelled && "opacity-50 line-through bg-muted/20")}>
                            <TableCell className="text-center font-mono text-muted-foreground">
                              {entry.line_no || idx + 1}
                            </TableCell>
                            <TableCell className="font-mono text-muted-foreground">{entry.entry_date}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn(
                                "text-[10px] px-1.5 py-0 h-4 font-semibold",
                                isIncome ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10" : "border-destructive/30 text-destructive bg-destructive/10"
                              )}>
                                {isIncome ? 'Bevétel' : 'Kiadás'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium text-foreground">{entry.legal_title || 'Általános tétel'}</TableCell>
                            <TableCell className="truncate max-w-[280px]" title={entry.description || ''}>
                              <div className="font-medium">{entry.partner?.name || '—'}</div>
                              {entry.description && <div className="text-[11px] text-muted-foreground truncate">{entry.description}</div>}
                            </TableCell>
                            <TableCell className="text-center font-mono text-muted-foreground">
                              {entry.gl_contra_account || '—'}
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-mono tabular-nums font-semibold",
                              isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                            )}>
                              {fmtAmount(entry.amount, entry.currency || currency)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                title={isIncome ? 'Bevételi pénztárbizonylat (BPB) nyomtatása' : 'Kiadási pénztárbizonylat (KPB) nyomtatása'}
                                onClick={() => handlePrintVoucher(entry)}
                              >
                                <Printer className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Tab 2: Címletjegyzék */}
              <TabsContent value="denominations" className="flex-1 overflow-auto border rounded-xl mt-2 p-3 bg-card">
                {!sheet || !sheet.rows || sheet.rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs">
                    <Coins className="w-8 h-8 opacity-40 mb-2" />
                    <span>Ehhez a jelentéshez még nincs rögzített címletjegyzék.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-semibold text-xs">Rögzített címletjegyzék (v{sheet.version})</span>
                      <span className="font-mono text-xs font-bold text-primary">
                        Összesen: {fmtBalance(sheet.total_amount, currency)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {sheet.rows.filter(r => r.count > 0).map(r => (
                        <div key={r.denomination} className="p-2 bg-muted/40 rounded-lg border flex items-center justify-between text-xs">
                          <span className="font-mono font-medium">{fmtBalance(r.denomination, currency)}:</span>
                          <span className="font-mono tabular-nums text-foreground font-semibold">{r.count} db ({fmtBalance(r.subtotal, currency)})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Tab 3: Zárási jegyzőkönyv */}
              <TabsContent value="protocol" className="flex-1 overflow-auto border rounded-xl mt-2 p-3 bg-card space-y-3">
                {!protocol ? (
                  <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-xs">
                    <FileCheck2 className="w-8 h-8 opacity-40 mb-2" />
                    <span>Nincs lezárt jegyzőkönyv csatolva.</span>
                  </div>
                ) : (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 bg-muted/30 rounded-lg border">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Könyv szerinti záró:</span>
                        <span className="font-mono font-semibold">{fmtBalance(protocol.book_balance, currency)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Tényleges záró:</span>
                        <span className="font-mono font-bold text-foreground">{fmtBalance(protocol.actual_balance, currency)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Eltérés:</span>
                        <span className={cn(
                          "font-mono font-bold",
                          protocol.difference === 0 ? "text-emerald-600" : "text-destructive"
                        )}>
                          {protocol.difference === 0 ? '0 Ft (Egyezik)' : `${protocol.difference > 0 ? '+' : ''}${fmtBalance(protocol.difference, currency)}`}
                        </span>
                      </div>
                    </div>

                    {protocol.difference_reason && (
                      <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                        <span className="font-semibold text-foreground block">Eltérés indoklása:</span>
                        <p className="text-muted-foreground">{protocol.difference_reason}</p>
                      </div>
                    )}

                    {protocol.action && (
                      <div className="p-3 rounded-lg border bg-muted/20 space-y-1">
                        <span className="font-semibold text-foreground block">Elrendelt intézkedés:</span>
                        <p className="text-muted-foreground">
                          {protocol.action === 'booked_as_shortage' ? 'Hiányként lekönyvelve (3681 ellenszámla)' :
                           protocol.action === 'booked_as_surplus' ? 'Többletként lekönyvelve (4791 ellenszámla)' :
                           protocol.action === 'cashier_repays' ? 'Pénztáros által megtérítve' : protocol.action}
                        </p>
                      </div>
                    )}

                    {report?.notes && (
                      <div className="p-3 rounded-lg border bg-muted/10 space-y-1">
                        <span className="font-semibold text-foreground block">Jelentés megjegyzései:</span>
                        <p className="text-muted-foreground whitespace-pre-line">{report.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <DialogFooter className="pt-2 border-t border-border/60 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Bezárás
          </Button>

          <Button size="sm" onClick={handlePrintReport} className="text-xs gap-1.5 bg-primary font-medium">
            <Printer className="w-3.5 h-3.5" />
            Pénztárjelentés nyomtatása / PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
