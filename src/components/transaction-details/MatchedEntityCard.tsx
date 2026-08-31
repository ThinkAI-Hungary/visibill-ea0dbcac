import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  Wallet,
  Eye,
  Check,
  Link2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getPaymentStatusBadge } from '@/hooks/useComputedStatus';
import {
  MatchedInvoice,
  MatchedNavInvoice,
  MatchedSalary,
} from '@/lib/matching/types';

export interface MatchedEntityCardProps {
  matchedInvoice: MatchedInvoice | null;
  matchedNavInvoice: MatchedNavInvoice | null;
  matchedSalary: MatchedSalary | null;
  loading: boolean;
  matchStatus: string;
  isSaving: boolean;
  onOpenInvoiceDetails: (invoiceId: string) => void;
  onNavigateSalaries: () => void;
  onVerify: () => void;
  onShowManualMatch: () => void;
  onShowAddExtraMatch: () => void;
  onUnmatch: () => void;
}

export const MatchedEntityCard: React.FC<MatchedEntityCardProps> = ({
  matchedInvoice,
  matchedNavInvoice,
  matchedSalary,
  loading,
  matchStatus,
  isSaving,
  onOpenInvoiceDetails,
  onNavigateSalaries,
  onVerify,
  onShowManualMatch,
  onShowAddExtraMatch,
  onUnmatch,
}) => {
  return (
    <>
      <Card
        className={cn(
          'bg-muted/30 border-border/50 transition-colors',
          (matchedInvoice || matchedSalary) && 'cursor-pointer hover:border-primary/50'
        )}
        onClick={() => {
          if (matchedInvoice) {
            onOpenInvoiceDetails(matchedInvoice.id);
          } else if (matchedSalary) {
            onNavigateSalaries();
          }
        }}
      >
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              {matchedSalary ? (
                <Wallet className="h-3.5 w-3.5" />
              ) : (
                <FileText className="h-3.5 w-3.5" />
              )}
              {matchedSalary
                ? 'Párosított bértétel'
                : matchedNavInvoice
                ? 'Párosított NAV számla'
                : 'Párosított számla'}
              {matchedNavInvoice && (
                <Badge className="text-[9px] h-4 px-1.5 bg-indigo-500/15 text-indigo-600 border-indigo-500/30">
                  NAV
                </Badge>
              )}
              {matchedInvoice && !matchedNavInvoice && (
                <Badge className="text-[9px] h-4 px-1.5 bg-teal-500/15 text-teal-600 border-teal-500/30">
                  Beküldött
                </Badge>
              )}
            </span>
            {(matchedInvoice || matchedSalary) && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {matchedSalary ? 'Kattints a bérek oldalhoz' : 'Kattints a részletekért'}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : matchedInvoice ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2">
                <span className="text-muted-foreground">Bizonylatsorszám:</span>
                <span className="ml-1 font-mono font-medium">
                  {matchedInvoice.bizonylatsorszam || '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Eladó:</span>
                <span className="ml-1 font-medium">{matchedInvoice.elado_nev || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Vevő:</span>
                <span className="ml-1 font-medium">{matchedInvoice.vevo_nev || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Kiállítás:</span>
                <span className="ml-1">
                  {matchedInvoice.kibocsatas_datuma
                    ? format(new Date(matchedInvoice.kibocsatas_datuma), 'yyyy.MM.dd')
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Bruttó:</span>
                <span className="ml-1 font-mono font-medium">
                  {formatCurrency(
                    matchedInvoice.brutto_vegosszeg || 0,
                    matchedInvoice.penznem || 'HUF'
                  )}
                </span>
              </div>
            </div>
          ) : matchedNavInvoice ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2">
                <span className="text-muted-foreground">Számlaszám:</span>
                <span className="ml-1 font-mono font-medium">
                  {matchedNavInvoice.invoice_number}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Szállító:</span>
                <span className="ml-1 font-medium">
                  {matchedNavInvoice.supplier_name || '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Vevő:</span>
                <span className="ml-1 font-medium">
                  {matchedNavInvoice.customer_name || '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Kiállítás:</span>
                <span className="ml-1">
                  {matchedNavInvoice.invoice_issue_date
                    ? format(new Date(matchedNavInvoice.invoice_issue_date), 'yyyy.MM.dd')
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Bruttó:</span>
                <span className="ml-1 font-mono font-medium">
                  {formatCurrency(
                    matchedNavInvoice.invoice_gross_amount || 0,
                    matchedNavInvoice.currency || 'HUF'
                  )}
                </span>
              </div>
              <div className="col-span-2 flex gap-1">
                {matchedNavInvoice.invoice_direction && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    {matchedNavInvoice.invoice_direction === 'INBOUND' ? 'Bejövő' : 'Kimenő'}
                  </Badge>
                )}
                {!!matchedNavInvoice.transaction_id && (
                  <Badge variant="success" className="text-[10px] h-5">
                    Fizetve
                  </Badge>
                )}
                {matchedNavInvoice.submitted && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    Beküldve
                  </Badge>
                )}
              </div>
            </div>
          ) : matchedSalary ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2">
                <span className="text-muted-foreground">Megnevezés:</span>
                <span className="ml-1 font-medium">{matchedSalary.név}</span>
              </div>
              {matchedSalary.munkavallalo_neve && (
                <div>
                  <span className="text-muted-foreground">Munkavállaló:</span>
                  <span className="ml-1 font-medium">
                    {matchedSalary.munkavallalo_neve}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Típus:</span>
                <span className="ml-1">{matchedSalary.tipus}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Dátum:</span>
                <span className="ml-1">
                  {matchedSalary.dátum
                    ? format(new Date(matchedSalary.dátum), 'yyyy.MM.dd')
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Összeg:</span>
                <span className="ml-1 font-mono font-medium">
                  {formatCurrency(matchedSalary.összeg)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Fizetési mód:</span>
                <span className="ml-1">{matchedSalary.fizetesi_mod}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Státusz:</span>
                {(() => {
                  const badge = getPaymentStatusBadge(matchedSalary.transaction_id);
                  return (
                    <Badge
                      variant="outline"
                      className={cn('ml-1 text-[10px] h-5', badge.className)}
                    >
                      {badge.label}
                    </Badge>
                  );
                })()}
              </div>
              {matchedSalary.megjegyzes && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Megjegyzés:</span>
                  <span className="ml-1">{matchedSalary.megjegyzes}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-1">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-500">Törölt bizonylat</p>
                <p className="text-[10px] text-muted-foreground">
                  A párosított bizonylat már nem létezik az adatbázisban (árva hivatkozás).
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 pt-4 w-full mt-4 border-t border-border/40 bg-background sticky bottom-0">
        {matchStatus === 'suggested' && (
          <Button
            size="sm"
            onClick={onVerify}
            disabled={isSaving}
            className="text-xs h-10 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center justify-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            {isSaving ? 'Mentés...' : 'Elfogadás (Rendben)'}
          </Button>
        )}

        <div className="grid grid-cols-2 gap-2 w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={onShowManualMatch}
            className="text-xs h-10 w-full flex items-center justify-center gap-1"
          >
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            Másik számla
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onShowAddExtraMatch}
            className="text-xs h-10 w-full flex items-center justify-center gap-1"
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            További számla
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onUnmatch}
          disabled={isSaving}
          className="text-xs h-10 w-full text-red-500 hover:text-red-600 border-red-500/30 hover:border-red-500/50 hover:bg-red-500/10 mt-1 flex items-center justify-center"
        >
          Párosítás bontása
        </Button>
      </div>
    </>
  );
};
