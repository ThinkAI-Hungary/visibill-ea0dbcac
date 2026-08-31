import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Package } from 'lucide-react';
import { formatCurrency, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { MatchedCourierReport } from '@/lib/matching/types';

export interface MatchedCourierReportsCardProps {
  courierReports: MatchedCourierReport[];
}

export const MatchedCourierReportsCard: React.FC<MatchedCourierReportsCardProps> = ({
  courierReports,
}) => {
  if (!courierReports || courierReports.length === 0) return null;

  return (
    <>
      <Separator className="my-1" />
      <Card className="bg-muted/30 border-border/50">
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-xs font-medium flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Futár riport
            </span>
            <Badge variant="outline" className="text-[10px] h-5">
              {courierReports.length} tétel
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {courierReports.map(report => (
              <div
                key={report.id}
                className="rounded-md border border-border/50 bg-background/50 p-2.5 text-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium font-mono">
                    {report.package_number || 'Összesítő sor'}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] h-5',
                      report.match_status === 'auto_matched'
                        ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                        : 'border-yellow-500/30 text-yellow-600 bg-yellow-500/10'
                    )}
                  >
                    {report.match_status === 'auto_matched' ? 'Párosítva' : 'Javasolt'}
                    {report.match_confidence != null && (
                      <span className="ml-1 opacity-70">
                        {Math.round(report.match_confidence * 100)}%
                      </span>
                    )}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-muted-foreground">
                  <div>
                    <span>Típus: </span>
                    <span className="font-medium text-foreground capitalize">
                      {report.report_type}
                    </span>
                  </div>
                  {report.delivery_date && (
                    <div>
                      <span>Kiszállítás: </span>
                      <span className="font-medium text-foreground">
                        {format(new Date(report.delivery_date), 'yyyy.MM.dd')}
                      </span>
                    </div>
                  )}
                  {report.cod_amount != null && (
                    <div>
                      <span>Utánvét (COD): </span>
                      <span className="font-medium text-foreground font-mono">
                        {formatCurrency(report.cod_amount, 'HUF')}
                      </span>
                    </div>
                  )}
                  {report.recipient_name && (
                    <div className="col-span-2">
                      <span>Címzett: </span>
                      <span className="font-medium text-foreground">
                        {report.recipient_name}
                      </span>
                    </div>
                  )}
                  {report.reference_number && (
                    <div className="col-span-2 font-mono text-[10px]">
                      <span>Ref: </span>
                      <span>{report.reference_number}</span>
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
