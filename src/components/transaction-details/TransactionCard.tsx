import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, HelpCircle, Ban, UploadCloud, Undo2, Landmark, ExternalLink, Download, Loader2 } from 'lucide-react';
import { formatCurrency, cn, fixCharacterEncoding, extractStoragePath } from '@/lib/utils';
import { formatDate } from '@/lib/locale/formatters';
import { useTranslation } from 'react-i18next';
import { computeMatchStatus } from '@/hooks/useComputedStatus';
import { TransactionItem } from '@/lib/matching/types';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface TransactionCardProps {
  transaction: TransactionItem;
  isSaving: boolean;
  onRevertStatus: () => void;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  isSaving,
  onRevertStatus,
}) => {
  const { t } = useTranslation(['transactions', 'common']);
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const matchStatus = computeMatchStatus(transaction);

  // Fetch attached bank statement upload details
  const { data: uploadInfo } = useQuery({
    queryKey: ['transaction-upload-file', transaction?.id],
    queryFn: async () => {
      if (!transaction?.id) return null;
      const { data, error } = await supabase
        .from('transactions')
        .select('upload_id, upload:transaction_uploads(id, file_name, file_url)')
        .eq('id', transaction.id)
        .maybeSingle();
      if (error || !data) return null;
      return (data as any)?.upload as { id: string; file_name: string; file_url: string } | null;
    },
    enabled: !!transaction?.id,
    staleTime: 5 * 60 * 1000,
  });

  const handleDownloadUpload = useCallback(async (fileUrl: string, fileName: string) => {
    setDownloading(true);
    try {
      const storagePath = extractStoragePath(fileUrl, 'transactions');
      if (storagePath) {
        const { data, error } = await supabase.storage.from('transactions').download(storagePath);
        if (!error && data) {
          const url = URL.createObjectURL(data);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast({ title: 'Sikeres letöltés', description: `${fileName} letöltve.` });
          return;
        }
      }
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast({ title: 'Sikeres letöltés', description: `${fileName} letöltve.` });
    } catch (e: any) {
      toast({
        title: 'Hiba a letöltés során',
        description: e?.message || 'Nem sikerült letölteni a kivonatot.',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  }, [toast]);

  return (
    <>
      <Card className="bg-muted/30 border-border/50">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium flex items-center justify-between">
            <span>{t('transactions:dialogs.details.card.title')}</span>
            {matchStatus === 'matched' && (
              <Badge variant="success" className="gap-1 text-[10px] h-5">
                <CheckCircle2 className="h-2.5 w-2.5" />
                {t('transactions:dialogs.details.card.status_matched')}
              </Badge>
            )}
            {matchStatus === 'suggested' && (
              <Badge className="gap-1 text-[10px] h-5 bg-yellow-500/15 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/15">
                <AlertTriangle className="h-2.5 w-2.5" />
                {t('transactions:dialogs.details.card.status_suggested')}
              </Badge>
            )}
            {matchStatus === 'unmatched' && (
              <Badge variant="destructive" className="gap-1 text-[10px] h-5">
                <HelpCircle className="h-2.5 w-2.5" />
                {t('transactions:dialogs.details.card.status_unmatched')}
              </Badge>
            )}
            {matchStatus === 'no_invoice' && (
              <Badge className="gap-1 text-[10px] h-5 bg-purple-500/15 text-purple-600 border-purple-500/30 hover:bg-purple-500/15">
                <Ban className="h-2.5 w-2.5" />
                {t('transactions:dialogs.details.card.status_no_invoice')}
              </Badge>
            )}
            {matchStatus === 'invoice_missing' && (
              <Badge className="gap-1 text-[10px] h-5 bg-sky-500/15 text-sky-600 border-sky-500/30 hover:bg-sky-500/15">
                <UploadCloud className="h-2.5 w-2.5" />
                {t('transactions:dialogs.details.card.status_invoice_missing')}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">{t('transactions:dialogs.details.card.date')}</span>
              <span className="ml-1 font-medium">
                {formatDate(transaction.transaction_date)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">{t('transactions:dialogs.details.card.amount')}</span>
              <span
                className={cn(
                  'ml-1 font-medium font-mono',
                  transaction.amount >= 0 ? 'text-success' : 'text-destructive'
                )}
              >
                {formatCurrency(transaction.amount, transaction.currency || 'HUF')}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-muted-foreground">{t('transactions:dialogs.details.card.description')}</span>
              <span className="ml-1">{fixCharacterEncoding(transaction.description) || '-'}</span>
            </div>
            {transaction.reason && (
              <div className="col-span-2">
                <span className="text-muted-foreground">{t('transactions:dialogs.details.card.ai_reason')}</span>
                <p className="mt-1 text-[10px] bg-background/50 p-1.5 rounded border border-border/30 max-h-[80px] overflow-y-auto">
                  {transaction.reason}
                </p>
              </div>
            )}

            {uploadInfo?.file_url && (
              <div className="col-span-2 pt-2 border-t border-border/40">
                <span className="text-muted-foreground block text-[11px] mb-1.5">Csatolt eredeti bankkivonat</span>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-background/80 border border-border/60 text-xs">
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <Landmark className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <span className="font-medium text-foreground truncate text-xs" title={uploadInfo.file_name}>
                      {uploadInfo.file_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px] gap-1 hover:bg-primary/10"
                      onClick={() => window.open(uploadInfo.file_url, '_blank')}
                      title="Megnyitás új lapon"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Megnyitás
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={downloading}
                      className="h-7 px-2 text-[11px] gap-1"
                      onClick={() => handleDownloadUpload(uploadInfo.file_url, uploadInfo.file_name)}
                      title="Kivonat letöltése"
                    >
                      {downloading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      Letöltés
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Undo status button for no_invoice / invoice_missing */}
      {(matchStatus === 'no_invoice' || matchStatus === 'invoice_missing') && (
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] text-muted-foreground">
            {matchStatus === 'no_invoice'
              ? t('transactions:dialogs.details.card.marked_no_invoice')
              : t('transactions:dialogs.details.card.marked_invoice_missing')}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={isSaving}
            onClick={onRevertStatus}
            className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
          >
            <Undo2 className="h-3 w-3" />
            {t('transactions:dialogs.details.card.undo')}
          </Button>
        </div>
      )}
    </>
  );
};
