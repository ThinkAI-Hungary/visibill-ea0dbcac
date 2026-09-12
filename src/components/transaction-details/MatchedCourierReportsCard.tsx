import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Package, FileText, CheckCheck } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { formatDate } from '@/lib/locale/formatters';
import { useTranslation } from 'react-i18next';
import { MatchedCourierReport, ExtraMatchItem } from '@/lib/matching/types';

export interface MatchedCourierReportsCardProps {
  courierReports: MatchedCourierReport[];
  extraMatches?: ExtraMatchItem[];
  matchedInvoiceId?: string | null;
  onLinkCourierInvoices?: (invoiceIds: string[]) => void;
  isSaving?: boolean;
}

export const MatchedCourierReportsCard: React.FC<MatchedCourierReportsCardProps> = ({
  courierReports,
  extraMatches = [],
  matchedInvoiceId,
  onLinkCourierInvoices,
  isSaving = false,
}) => {
  const { t } = useTranslation(['transactions']);

  if (!courierReports || courierReports.length === 0) return null;

  // Separate summary row (if present) from individual parcel reports
  const summaryReport = courierReports.find(
    r => r.row_type === 'total' || !r.package_number || r.recipient_name?.toLowerCase().includes('összesítés')
  );
  const parcelReports = courierReports.filter(r => r !== summaryReport);

  // Set of already matched invoice IDs on this transaction
  const alreadyMatchedInvoiceIds = useMemo(() => {
    const ids = new Set<string>();
    if (matchedInvoiceId) ids.add(matchedInvoiceId);
    extraMatches.forEach(m => {
      if (m.invoice_id) ids.add(m.invoice_id);
    });
    return ids;
  }, [matchedInvoiceId, extraMatches]);

  // Unlinked invoices that can be linked via 1-click batch button
  const unlinkedInvoiceIds = useMemo(() => {
    return Array.from(
      new Set(
        parcelReports
          .map(r => r.matched_nav_invoice_id)
          .filter((id): id is string => Boolean(id) && !alreadyMatchedInvoiceIds.has(id))
      )
    );
  }, [parcelReports, alreadyMatchedInvoiceIds]);

  return (
    <>
      <Separator className="my-1" />
      <Card className="bg-muted/30 border-border/50">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              {t('transactions:dialogs.details.courier.title')}
            </span>
            <Badge variant="outline" className="text-[10px] h-5">
              {t('transactions:dialogs.details.courier.items_count', { count: parcelReports.length || courierReports.length })}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {/* Summary frame display if present */}
          {summaryReport && (
            <div className="flex items-center justify-between text-xs bg-muted/50 rounded-md px-3 py-2 mb-2.5 border border-border/40">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Package className="h-3.5 w-3.5 text-primary/70" />
                <span>{t('transactions:dialogs.details.courier.summary_frame', 'Futár összesítő jóváírás:')}</span>
              </div>
              <span className="font-semibold font-mono text-foreground">
                {formatCurrency(summaryReport.cod_amount || 0, 'HUF')}
              </span>
            </div>
          )}

          {/* 1-click batch link button */}
          {unlinkedInvoiceIds.length > 0 && onLinkCourierInvoices && (
            <Button
              size="sm"
              variant="default"
              className="w-full mb-2.5 gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              onClick={() => onLinkCourierInvoices(unlinkedInvoiceIds)}
              disabled={isSaving}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t('transactions:dialogs.details.courier.link_all_btn', {
                defaultValue: 'Futár tételek összerendelése ({{count}} számla)',
                count: unlinkedInvoiceIds.length,
              })}
            </Button>
          )}

          {/* Parcel list */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {(parcelReports.length > 0 ? parcelReports : courierReports).map(report => (
              <div
                key={report.id}
                className="rounded-md border border-border/50 bg-background/50 p-2.5 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium font-mono flex items-center gap-1">
                    <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                    {report.package_number || t('transactions:dialogs.details.courier.summary_row')}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] h-5',
                      report.match_status === 'full' || report.match_status === 'auto_matched'
                        ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                        : 'border-yellow-500/30 text-yellow-600 bg-yellow-500/10'
                    )}
                  >
                    {report.match_status === 'full' || report.match_status === 'auto_matched'
                      ? t('transactions:dialogs.details.courier.status_matched', 'Párosítva')
                      : t('transactions:dialogs.details.courier.status_suggested', 'Javasolt')}
                    {report.match_confidence != null && (
                      <span className="ml-1 opacity-70">
                        {Math.round(report.match_confidence * 100)}%
                      </span>
                    )}
                  </Badge>
                </div>

                {/* Prominently show matched NAV invoice number if identified */}
                {report.invoice_number && (
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded">
                    <FileText className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Számla: {report.invoice_number}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                  <div>
                    <span>{t('transactions:dialogs.details.courier.type')}: </span>
                    <span className="font-medium text-foreground capitalize">
                      {report.report_type}
                    </span>
                  </div>
                  {report.delivery_date && (
                    <div>
                      <span>{t('transactions:dialogs.details.courier.delivery_date')}: </span>
                      <span className="font-medium text-foreground">
                        {formatDate(report.delivery_date)}
                      </span>
                    </div>
                  )}
                  {report.cod_amount != null && (
                    <div>
                      <span>{t('transactions:dialogs.details.courier.cod_amount')}: </span>
                      <span className="font-medium text-foreground font-mono">
                        {formatCurrency(report.cod_amount, 'HUF')}
                      </span>
                    </div>
                  )}
                  {report.recipient_name && (
                    <div className="col-span-2">
                      <span>{t('transactions:dialogs.details.courier.recipient')}: </span>
                      <span className="font-medium text-foreground">
                        {report.recipient_name}
                      </span>
                    </div>
                  )}
                  {report.reference_number && (
                    <div className="col-span-2 font-mono text-[10px]">
                      <span>Webshop hivatkozás: </span>
                      <span className="text-foreground">{report.reference_number}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
};
