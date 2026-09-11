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
import { formatDate } from '@/lib/locale/formatters';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation(['transactions']);

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
                ? t('transactions:dialogs.details.matched_entity.title_salary')
                : matchedNavInvoice
                ? t('transactions:dialogs.details.matched_entity.title_nav')
                : t('transactions:dialogs.details.matched_entity.title_invoice')}
              {matchedNavInvoice && (
                <Badge className="text-[9px] h-4 px-1.5 bg-indigo-500/15 text-indigo-600 border-indigo-500/30">
                  {t('transactions:dialogs.details.matched_entity.badge_nav')}
                </Badge>
              )}
              {matchedInvoice && !matchedNavInvoice && (
                <Badge className="text-[9px] h-4 px-1.5 bg-teal-500/15 text-teal-600 border-teal-500/30">
                  {t('transactions:dialogs.details.matched_entity.badge_submitted')}
                </Badge>
              )}
            </span>
            {(matchedInvoice || matchedSalary) && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {matchedSalary
                  ? t('transactions:dialogs.details.matched_entity.click_salary')
                  : t('transactions:dialogs.details.matched_entity.click_details')}
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
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.invoice_number')}
                </span>
                <span className="ml-1 font-mono font-medium">
                  {matchedInvoice.bizonylatsorszam || '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.seller')}
                </span>
                <span className="ml-1 font-medium">{matchedInvoice.elado_nev || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.buyer')}
                </span>
                <span className="ml-1 font-medium">{matchedInvoice.vevo_nev || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.issue_date')}
                </span>
                <span className="ml-1">
                  {matchedInvoice.kibocsatas_datuma
                    ? formatDate(matchedInvoice.kibocsatas_datuma)
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.gross')}
                </span>
                <span className="ml-1 font-mono font-medium">
                  {formatCurrency(
                    matchedInvoice.brutto_vegosszeg || 0,
                    matchedInvoice.penznem || 'HUF'
                  )}
                </span>
              </div>
              <div className="col-span-2 flex gap-1">
                {matchedInvoice.invoice_direction && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    {matchedInvoice.invoice_direction === 'INBOUND'
                      ? t('transactions:dialogs.details.matched_entity.direction_inbound')
                      : t('transactions:dialogs.details.matched_entity.direction_outbound')}
                  </Badge>
                )}
                {(() => {
                  const badge = getPaymentStatusBadge(
                    matchedInvoice.transaction_id,
                    (matchedInvoice as any).match_status
                  );
                  return (
                    <Badge variant="outline" className={cn('text-[10px] h-5', badge.className)}>
                      {badge.label}
                    </Badge>
                  );
                })()}
              </div>
            </div>
          ) : matchedNavInvoice ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2">
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.nav_invoice_number')}
                </span>
                <span className="ml-1 font-mono font-medium">
                  {matchedNavInvoice.invoice_number}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.supplier')}
                </span>
                <span className="ml-1 font-medium">
                  {matchedNavInvoice.supplier_name || '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.customer')}
                </span>
                <span className="ml-1 font-medium">
                  {matchedNavInvoice.customer_name || '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.issue_date')}
                </span>
                <span className="ml-1">
                  {matchedNavInvoice.invoice_issue_date
                    ? formatDate(matchedNavInvoice.invoice_issue_date)
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.gross')}
                </span>
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
                    {matchedNavInvoice.invoice_direction === 'INBOUND'
                      ? t('transactions:dialogs.details.matched_entity.direction_inbound')
                      : t('transactions:dialogs.details.matched_entity.direction_outbound')}
                  </Badge>
                )}
                {(() => {
                  const badge = getPaymentStatusBadge(
                    matchedNavInvoice.transaction_id,
                    (matchedNavInvoice as any).match_status
                  );
                  return (
                    <Badge variant="outline" className={cn('text-[10px] h-5', badge.className)}>
                      {badge.label}
                    </Badge>
                  );
                })()}
                {matchedNavInvoice.submitted && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    {t('transactions:dialogs.details.matched_entity.badge_nav_submitted')}
                  </Badge>
                )}
              </div>
            </div>
          ) : matchedSalary ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="col-span-2">
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.salary_title')}
                </span>
                <span className="ml-1 font-medium">{matchedSalary.név}</span>
              </div>
              {matchedSalary.munkavallalo_neve && (
                <div>
                  <span className="text-muted-foreground">
                    {t('transactions:dialogs.details.matched_entity.salary_employee')}
                  </span>
                  <span className="ml-1 font-medium">
                    {matchedSalary.munkavallalo_neve}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.salary_type')}
                </span>
                <span className="ml-1">{matchedSalary.tipus}</span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.salary_date')}
                </span>
                <span className="ml-1">
                  {matchedSalary.dátum
                    ? formatDate(matchedSalary.dátum)
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.salary_amount')}
                </span>
                <span className="ml-1 font-mono font-medium">
                  {formatCurrency(matchedSalary.összeg)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.salary_payment_method')}
                </span>
                <span className="ml-1">{matchedSalary.fizetesi_mod}</span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.salary_status')}
                </span>
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
                  <span className="text-muted-foreground">
                    {t('transactions:dialogs.details.matched_entity.salary_notes')}
                  </span>
                  <span className="ml-1">{matchedSalary.megjegyzes}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 py-1">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <div>
                <p className="text-xs font-medium text-amber-500">
                  {t('transactions:dialogs.details.matched_entity.deleted_entity_title')}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {t('transactions:dialogs.details.matched_entity.deleted_entity_desc')}
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
            {isSaving
              ? t('transactions:dialogs.details.matched_entity.saving')
              : t('transactions:dialogs.details.matched_entity.accept_btn')}
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
            {t('transactions:dialogs.details.matched_entity.other_invoice_btn')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onShowAddExtraMatch}
            className="text-xs h-10 w-full flex items-center justify-center gap-1"
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            {t('transactions:dialogs.details.matched_entity.additional_invoice_btn')}
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onUnmatch}
          disabled={isSaving}
          className="text-xs h-10 w-full text-red-500 hover:text-red-600 border-red-500/30 hover:border-red-500/50 hover:bg-red-500/10 mt-1 flex items-center justify-center"
        >
          {t('transactions:dialogs.details.matched_entity.unmatch_btn')}
        </Button>
      </div>
    </>
  );
};
