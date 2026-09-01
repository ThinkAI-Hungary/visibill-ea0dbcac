import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertTriangle, HelpCircle, Ban, UploadCloud, Undo2 } from 'lucide-react';
import { formatCurrency, cn, fixCharacterEncoding } from '@/lib/utils';
import { format } from 'date-fns';
import { computeMatchStatus } from '@/hooks/useComputedStatus';
import { TransactionItem } from '@/lib/matching/types';

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
  const matchStatus = computeMatchStatus(transaction);

  return (
    <>
      <Card className="bg-muted/30 border-border/50">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium flex items-center justify-between">
            <span>Tranzakció</span>
            {matchStatus === 'matched' && (
              <Badge variant="success" className="gap-1 text-[10px] h-5">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Párosított
              </Badge>
            )}
            {matchStatus === 'suggested' && (
              <Badge className="gap-1 text-[10px] h-5 bg-yellow-500/15 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/15">
                <AlertTriangle className="h-2.5 w-2.5" />
                Javasolt
              </Badge>
            )}
            {matchStatus === 'unmatched' && (
              <Badge variant="destructive" className="gap-1 text-[10px] h-5">
                <HelpCircle className="h-2.5 w-2.5" />
                Párosítatlan
              </Badge>
            )}
            {matchStatus === 'no_invoice' && (
              <Badge className="gap-1 text-[10px] h-5 bg-purple-500/15 text-purple-600 border-purple-500/30 hover:bg-purple-500/15">
                <Ban className="h-2.5 w-2.5" />
                Nincs hozzá számla
              </Badge>
            )}
            {matchStatus === 'invoice_missing' && (
              <Badge className="gap-1 text-[10px] h-5 bg-sky-500/15 text-sky-600 border-sky-500/30 hover:bg-sky-500/15">
                <UploadCloud className="h-2.5 w-2.5" />
                Számla nincs feltöltve
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Dátum:</span>
              <span className="ml-1 font-medium">
                {format(new Date(transaction.transaction_date), 'yyyy.MM.dd')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Összeg:</span>
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
              <span className="text-muted-foreground">Leírás:</span>
              <span className="ml-1">{fixCharacterEncoding(transaction.description) || '-'}</span>
            </div>
            {transaction.reason && (
              <div className="col-span-2">
                <span className="text-muted-foreground">AI indoklás:</span>
                <p className="mt-1 text-[10px] bg-background/50 p-1.5 rounded border border-border/30 max-h-[80px] overflow-y-auto">
                  {transaction.reason}
                </p>
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
              ? 'Megjelölve: nincs hozzá számla — könyvelő feladata'
              : 'Megjelölve: számla nincs feltöltve — fel kell tölteni'}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={isSaving}
            onClick={onRevertStatus}
            className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
          >
            <Undo2 className="h-3 w-3" />
            Visszavonás
          </Button>
        </div>
      )}
    </>
  );
};
