import React from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import type { MatchedCourierReport } from './types';

interface MatchedCourierReportsSectionProps {
  courierReports: MatchedCourierReport[];
  isInvoiceSettled?: boolean;
}

export function MatchedCourierReportsSection({
  courierReports,
  isInvoiceSettled = false,
}: MatchedCourierReportsSectionProps) {
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
                Futárjelentés tétel
              </span>
              {isInvoiceSettled ? (
                <Badge variant="success" className="gap-1 text-[10px] h-5">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Csomag párosítva · Kiegyenlítve
                </Badge>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    variant="outline"
                    className="gap-1 text-[10px] h-5 border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Csomag párosítva
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-[9px] h-5 border-amber-500/40 text-amber-600 bg-amber-500/10 font-normal"
                  >
                    Banki jóváírásra vár
                  </Badge>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Csomagszám:</span>
                <span className="ml-1 font-mono font-medium">{cr.package_number || '-'}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Utánvét összeg:</span>
                <span className="ml-1 font-mono font-medium">
                  {formatCurrency(cr.cod_amount || 0, 'HUF')}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Kézbesítés:</span>
                <span className="ml-1 font-medium">
                  {cr.delivery_date
                    ? format(new Date(cr.delivery_date), 'yyyy.MM.dd', { locale: hu })
                    : '-'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Címzett:</span>
                <span className="ml-1 font-medium">{cr.recipient_name || '-'}</span>
              </div>
              {cr.reference_number && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Hivatkozási szám:</span>
                  <span className="ml-1 font-mono">{cr.reference_number}</span>
                </div>
              )}
              {!isInvoiceSettled && (
                <div className="col-span-2 mt-1 pt-1.5 border-t border-border/40 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    A csomagtétel a számlához van rendelve. A számla kifizetettségéhez a futárcég banki jóváírása (vagy a fenti <strong>„Kézi fizetés”</strong> gomb) szükséges.
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
