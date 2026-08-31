import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

interface ContinuousServiceCardSectionProps {
  isContinuous?: boolean;
  servicePeriodStart?: string | null;
  servicePeriodEnd?: string | null;
  calculatedTi?: string | null;
  tiOverride?: string | null;
  tiCalculationMethod?: string | null;
}

export function ContinuousServiceCardSection({
  isContinuous,
  servicePeriodStart,
  servicePeriodEnd,
  calculatedTi,
  tiOverride,
  tiCalculationMethod,
}: ContinuousServiceCardSectionProps) {
  if (!isContinuous) return null;

  return (
    <Card className="bg-blue-500/[0.06] border-blue-400/40 expand-animate">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-xs font-medium flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-blue-500" />
            Folyamatos szolgáltatás
          </span>
          <Badge className="text-[10px] h-5 bg-blue-500/15 text-blue-600 border-blue-400/40 hover:bg-blue-500/20">
            <RefreshCw className="h-2.5 w-2.5 mr-0.5" />
            Áfa tv. 58.§
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-2">
        {servicePeriodStart && servicePeriodEnd && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Szolg. időszak kezdete:</span>
              <div className="font-mono font-medium">
                {format(new Date(servicePeriodStart), 'yyyy. MM. dd.', { locale: hu })}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Szolg. időszak vége:</span>
              <div className="font-mono font-medium">
                {format(new Date(servicePeriodEnd), 'yyyy. MM. dd.', { locale: hu })}
              </div>
            </div>
          </div>
        )}
        {(calculatedTi || tiOverride) && (
          <div className="border-t border-blue-400/20 pt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Teljesítési időpont (TI):</span>
              <div className="font-mono font-bold text-blue-600 dark:text-blue-400">
                {format(new Date(tiOverride || calculatedTi!), 'yyyy. MM. dd.', { locale: hu })}
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Meghatározás módja:</span>
              <div className="font-medium">
                {tiCalculationMethod === 'manual'
                  ? '✏️ Kézi felülírás'
                  : tiCalculationMethod === 'nav_period_end'
                  ? '📋 NAV szolg. időszak vége'
                  : tiCalculationMethod === 'payment_due'
                  ? '💰 Fizetési határidő'
                  : '📅 Teljesítési dátum'}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
