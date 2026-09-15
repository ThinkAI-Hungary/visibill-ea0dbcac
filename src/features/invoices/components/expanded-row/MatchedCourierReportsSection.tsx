import React from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { formatDate } from '@/lib/locale/formatters';
import { useTranslation } from 'react-i18next';
import type { MatchedCourierReport } from './types';

interface MatchedCourierReportsSectionProps {
  courierReports: MatchedCourierReport[];
  isInvoiceSettled?: boolean;
}

export function MatchedCourierReportsSection({
  courierReports,
  isInvoiceSettled = false,
}: MatchedCourierReportsSectionProps) {
  const { t } = useTranslation(['invoices']);

  if (!courierReports || courierReports.length === 0) return null;

  return (
    <>
      {courierReports.map((cr) => (
        <Card key={cr.id} className="bg-muted/30 border-border/50 expand-stagger-4">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-medium flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className="uppercase text-[9px] px-1.5 h-4.5 bg-primary/5 text-primary border-primary/20"
                >
                  {cr.report_type}
                </Badge>
                {t('invoices:expanded_courier.title', 'Futárjelentés tétel')}
              </span>
              {isInvoiceSettled ? (
                <Badge variant="success" className="gap-1 text-[10px] h-5">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {t('invoices:expanded_courier.settled_badge', 'Csomag párosítva · Kiegyenlítve')}
                </Badge>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    variant="outline"
                    className="gap-1 text-[10px] h-5 border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {t('invoices:expanded_courier.matched_badge', 'Csomag párosítva')}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[9px] h-5 border-amber-500/40 text-amber-600 bg-amber-500/10 font-normal"
                  >
                    {t('invoices:expanded_courier.waiting_payout_badge', 'Banki jóváírásra vár')}
                  </Badge>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">{t('invoices:expanded_courier.package_number', 'Csomagszám:')}</span>
                <span className="ml-1 font-mono font-medium">{cr.package_number || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('invoices:expanded_courier.cod_amount', 'Utánvét összeg:')}</span>
                <span className="ml-1 font-mono font-medium">
                  {formatCurrency(cr.cod_amount || 0)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('invoices:expanded_courier.delivery', 'Kézbesítés:')}</span>
                <span className="ml-1 font-medium">
                  {cr.delivery_date ? formatDate(cr.delivery_date) : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('invoices:expanded_courier.recipient', 'Címzett:')}</span>
                <span className="ml-1 font-medium">{cr.recipient_name || '-'}</span>
              </div>
              {cr.reference_number && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">{t('invoices:expanded_courier.reference_number', 'Hivatkozási szám:')}</span>
                  <span className="ml-1 font-mono">{cr.reference_number}</span>
                </div>
              )}
              {!isInvoiceSettled && (
                <div className="col-span-2 mt-1 pt-1.5 border-t border-border/40 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    {t('invoices:expanded_courier.info_hint', 'A csomagtétel a számlához van rendelve. A számla kifizetettségéhez a futárcég banki jóváírása (vagy a fenti „Kézi fizetés” gomb) szükséges.')}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}
