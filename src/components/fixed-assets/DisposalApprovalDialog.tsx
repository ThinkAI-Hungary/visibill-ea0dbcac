import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, FileText, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useCompany } from '@/contexts/CompanyContext';
import { formatCurrency } from '@/lib/utils';
import { formatDateLocale } from '@/lib/locale/formatters';
import { reportError } from '@/lib/errorReporter';
import {
  approveAssetDisposal,
  buildDisposalJournal,
  computeExpectedAccumulatedAtDisposal,
  fetchAssetGlPosition,
  rejectAssetDisposal,
  resolveDisposalAccounts,
} from '@/lib/fixed-assets/assetDisposalPostingService';
import { downloadDisposalProtocol } from '@/lib/fixed-assets/assetDisposalProtocolService';
import { DevelopmentReserveAlienationAlert } from './DevelopmentReserveAlienationAlert';
import { TaxCreditAlienationAlert } from './TaxCreditAlienationAlert';
import { DISPOSAL_REASON_LABELS, type FixedAsset } from '@/types/fixed-assets';

interface DisposalApprovalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset: FixedAsset;
  /** A főkönyvi művelethez jogosult-e a felhasználó (kijelölt könyvelő, vagy könyvelő nélküli cégnél a vezetés). */
  canApprove: boolean;
}

/**
 * Kivezetés jóváhagyása (TENY M1.4, D-4): előnézet a könyvelendő tételekről, majd jóváhagyás
 * (atomi főkönyvi könyvelés + eszköz lezárása) vagy elutasítás. Csak `ledger_write` jogosultsággal
 * hajtható végre; a jogosultságot a DB RPC is érvényesíti.
 */
export function DisposalApprovalDialog({ open, onOpenChange, asset, canApprove }: DisposalApprovalDialogProps) {
  const { t } = useTranslation(['hr', 'common']);
  const tt = (key: string, defaultValue: string, options?: Record<string, unknown>) =>
    t(`hr:fixed_assets.disposal_approval.${key}`, { defaultValue, ...options });
  const { toast } = useToast();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [downloading, setDownloading] = useState(false);

  const details = asset.disposal_details;
  const reasonType = asset.disposal_reason_type;
  const disposalDate = details?.requested_disposal_date ?? '';

  const previewQuery = useQuery({
    queryKey: ['assetDisposalPreview', asset.id, asset.updated_at, disposalDate],
    enabled: open && !!companyId && !!reasonType && !!disposalDate,
    staleTime: 0,
    queryFn: async () => {
      const [position, accounts] = await Promise.all([
        fetchAssetGlPosition(asset.id),
        resolveDisposalAccounts(companyId as string, asset.gl_account?.gl_number),
      ]);
      return { position, accounts };
    },
  });

  const journal =
    previewQuery.data && reasonType
      ? buildDisposalJournal({
          reasonType,
          assetName: asset.name,
          position: previewQuery.data.position,
          expectedAccumulated: computeExpectedAccumulatedAtDisposal(asset, disposalDate),
          accounts: previewQuery.data.accounts,
          saleNetAmount: details?.sale_value,
          saleCounter: details?.sale_counter,
          bookSaleRevenue: details?.book_sale_revenue,
          compensationAmount: details?.compensation_amount,
        })
      : null;

  const invalidate = () => {
    if (companyId) queryClient.invalidateQueries({ queryKey: ['fixedAssets', companyId] });
    queryClient.invalidateQueries({ queryKey: ['fixedAssetDetail', asset.id] });
    queryClient.invalidateQueries({ queryKey: ['project-fixed-assets'] });
    queryClient.invalidateQueries({ queryKey: ['assetReconciliation'] });
    queryClient.invalidateQueries({ queryKey: ['journals'] });
    queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
    queryClient.invalidateQueries({ queryKey: ['acc_journal_headers'] });
  };

  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !journal) throw new Error('Nincs könyvelhető tétel');
      return approveAssetDisposal(companyId, asset.id, journal.lines);
    },
    onSuccess: (result) => {
      invalidate();
      toast({
        title: tt('toast_approved_title', 'Kivezetés jóváhagyva'),
        description: result.message ?? tt('toast_approved_desc', 'A kivezetés lekönyvelve ({{doc}}).', { doc: result.document_id }),
      });
      setConfirmOpen(false);
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      reportError({ type: 'db_query', component: 'DisposalApprovalDialog', action: 'approveAssetDisposal', message: 'Disposal approval failed', error });
      setConfirmOpen(false);
      toast({
        title: tt('toast_error_title', 'Hiba'),
        description: error instanceof Error ? error.message : tt('toast_approve_error', 'Nem sikerült a jóváhagyás.'),
        variant: 'destructive',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Nincs kiválasztott cég');
      await rejectAssetDisposal(companyId, asset.id, rejectReason);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: tt('toast_rejected_title', 'Kivezetés elutasítva'), description: asset.name });
      setRejecting(false);
      setRejectReason('');
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      reportError({ type: 'db_query', component: 'DisposalApprovalDialog', action: 'rejectAssetDisposal', message: 'Disposal rejection failed', error });
      toast({
        title: tt('toast_error_title', 'Hiba'),
        description: error instanceof Error ? error.message : tt('toast_reject_error', 'Nem sikerült az elutasítás.'),
        variant: 'destructive',
      });
    },
  });

  const handleDownload = async () => {
    if (!companyId) return;
    setDownloading(true);
    try {
      await downloadDisposalProtocol(asset, companyId, {
        accumulatedDepreciation: journal?.breakdown.accumulatedTotal,
        netBookValue: journal?.breakdown.netBookValue,
      });
    } catch (error) {
      reportError({ type: 'db_query', component: 'DisposalApprovalDialog', action: 'downloadDisposalProtocol', message: 'Protocol PDF failed', error });
      toast({ title: tt('toast_error_title', 'Hiba'), description: tt('toast_pdf_error', 'A jegyzőkönyv PDF generálása nem sikerült.'), variant: 'destructive' });
    } finally {
      setDownloading(false);
    }
  };

  const busy = approveMutation.isPending || rejectMutation.isPending;
  const isFirstLoad = previewQuery.isLoading && !previewQuery.data;
  const canSubmitApprove = canApprove && !!journal && journal.errors.length === 0 && journal.lines.length >= 2 && !busy;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" id="disposal-approval-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {tt('title', 'Kivezetés jóváhagyása')}
            </DialogTitle>
            <DialogDescription>
              {asset.name} ({asset.inventory_number})
              {reasonType ? ` — ${DISPOSAL_REASON_LABELS[reasonType]}` : ''}
              {disposalDate ? ` — ${formatDateLocale(disposalDate)}` : ''}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <DevelopmentReserveAlienationAlert asset={asset} disposalDate={disposalDate} />
            <TaxCreditAlienationAlert asset={asset} disposalDate={disposalDate} />
            {details?.reason && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1">{tt('reason', 'Indoklás')}</p>
                <p>{details.reason}</p>
              </div>
            )}

            {!canApprove && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{tt('no_rights_title', 'Csak megtekintés')}</AlertTitle>
                <AlertDescription>
                  {tt(
                    'no_rights_desc',
                    'A kivezetés jóváhagyása és könyvelése a kijelölt könyvelő (vagy könyvelő nélküli cégnél a cégvezetés) jogosultsága.',
                  )}
                </AlertDescription>
              </Alert>
            )}

            {isFirstLoad && (
              <div className="space-y-2" aria-busy="true">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            )}

            {previewQuery.isError && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>{tt('preview_error_title', 'Az előnézet nem tölthető be')}</AlertTitle>
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span>{tt('preview_error_desc', 'A főkönyvi pozíció lekérdezése sikertelen.')}</span>
                  <Button size="sm" variant="outline" onClick={() => previewQuery.refetch()} className="gap-1">
                    <RefreshCw className="h-3.5 w-3.5" />
                    {tt('retry', 'Újra')}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {journal && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  {[
                    [tt('kpi_gross', 'Bruttó érték'), journal.breakdown.gross],
                    [tt('kpi_accum', 'Halmozott ÉCS'), journal.breakdown.accumulatedTotal],
                    [tt('kpi_topup', 'Ebből pótlás'), journal.breakdown.topUp],
                    [tt('kpi_nbv', 'Nettó érték'), journal.breakdown.netBookValue],
                  ].map(([label, value]) => (
                    <div key={label as string} className="rounded-lg border p-2">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium tabular-nums">{formatCurrency(value as number, 'HUF')}</p>
                    </div>
                  ))}
                </div>

                {journal.errors.map((message) => (
                  <Alert key={message} variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{message}</AlertDescription>
                  </Alert>
                ))}
                {journal.warnings.map((message) => (
                  <Alert key={message}>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{message}</AlertDescription>
                  </Alert>
                ))}

                {journal.lines.length > 0 && (
                  <div className="rounded-lg border overflow-hidden">
                    <Table id="disposal-journal-preview">
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tt('col_account', 'Főkönyvi szám')}</TableHead>
                          <TableHead className="text-right">{tt('col_debit', 'Tartozik')}</TableHead>
                          <TableHead className="text-right">{tt('col_credit', 'Követel')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {journal.lines.map((line, idx) => (
                          <TableRow key={`${line.glAccountId}-${line.dcType}-${idx}`}>
                            <TableCell>
                              <span className="font-mono">{line.glNumber}</span>
                              <span className="block text-xs text-muted-foreground">{line.description}</span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{line.dcType === 'T' ? formatCurrency(line.amount, 'HUF') : ''}</TableCell>
                            <TableCell className="text-right tabular-nums">{line.dcType === 'K' ? formatCurrency(line.amount, 'HUF') : ''}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="font-medium">
                          <TableCell>{tt('total', 'Összesen')}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(journal.totalDebit, 'HUF')}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(journal.totalCredit, 'HUF')}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}

            {rejecting && canApprove && (
              <div className="space-y-2 rounded-lg border border-destructive/30 p-3">
                <Label htmlFor="disposal-reject-reason">{tt('reject_reason_label', 'Elutasítás indoka')}</Label>
                <Textarea
                  id="disposal-reject-reason"
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setRejecting(false)} disabled={busy}>
                    {tt('cancel', 'Mégse')}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    id="disposal-reject-confirm"
                    onClick={() => rejectMutation.mutate()}
                    disabled={busy}
                    className="gap-1"
                  >
                    {rejectMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {tt('reject_confirm', 'Elutasítás megerősítése')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={handleDownload} disabled={downloading} className="gap-2" id="disposal-protocol-download">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {tt('download_pdf', 'Jegyzőkönyv PDF')}
            </Button>
            {canApprove && !rejecting && (
              <Button variant="outline" onClick={() => setRejecting(true)} disabled={busy} className="gap-2 text-destructive" id="disposal-reject">
                <XCircle className="h-4 w-4" />
                {tt('reject', 'Elutasítás')}
              </Button>
            )}
            {canApprove && (
              <Button onClick={() => setConfirmOpen(true)} disabled={!canSubmitApprove} className="gap-2" id="disposal-approve">
                <CheckCircle2 className="h-4 w-4" />
                {tt('approve', 'Jóváhagyás és könyvelés')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={(next) => !approveMutation.isPending && setConfirmOpen(next)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tt('confirm_title', 'Kivezetés könyvelése')}</AlertDialogTitle>
            <AlertDialogDescription>
              {tt(
                'confirm_desc',
                'A jóváhagyással a kivezetési tétel véglegesen lekönyvelődik, az eszköz pedig kikerül az aktív nyilvántartásból. Ez a lépés nem vonható vissza közvetlenül (csak sztornóval).',
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveMutation.isPending}>{tt('cancel', 'Mégse')}</AlertDialogCancel>
            <AlertDialogAction
              id="disposal-approve-confirm"
              disabled={approveMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                approveMutation.mutate();
              }}
            >
              {approveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {tt('confirm_action', 'Jóváhagyás és könyvelés')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
