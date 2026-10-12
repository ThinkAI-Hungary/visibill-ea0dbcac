import React, { useState } from 'react';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useAccountingAnomalies } from '@/hooks/useTechnicalAccounting';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { formatCurrencyLocale, formatNumberLocale } from '@/lib/locale/formatters';
import {
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Users,
  Coins,
  Percent,
  RefreshCw,
  Sparkles
} from 'lucide-react';

interface AiAuditGuardTabProps {
  companyId?: string;
}

export const AiAuditGuardTab: React.FC<AiAuditGuardTabProps> = ({ companyId: propCompanyId }) => {
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const companyId = propCompanyId || selectedCompany?.id;

  const startDateStr = dateFromFormatted || undefined;
  const endDateStr = dateToFormatted || undefined;

  const { data: anomalyData, isLoading, refetch, isRefetching } = useAccountingAnomalies(
    companyId,
    startDateStr,
    endDateStr
  );

  const missingPartners = anomalyData?.missing_partners || [];
  const invertedBalances = anomalyData?.inverted_balances || [];
  const vatInconsistencies = anomalyData?.vat_inconsistencies || [];

  const totalCount = anomalyData?.total_anomalies_count || 0;

  return (
    <div className="space-y-6">
      {/* Fejléc */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                AI Technikai Kontroll & Anomália Vadász
              </CardTitle>
              <CardDescription>
                Folyamatos audit-ellenőrzés: partnerhiány, negatív pénztár/bank, inverz egyenlegek és ÁFA törvénysértések kiszűrése.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              <span>Újraellenőrzés</span>
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* KPI Kártyák */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className={`p-4 border-l-4 ${totalCount === 0 ? 'border-l-emerald-500 bg-emerald-500/5' : 'border-l-amber-500 bg-amber-500/5'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Összes Anomália</span>
            {totalCount === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            )}
          </div>
          <div className="text-2xl font-bold mt-1">
            {formatNumberLocale(totalCount)} db
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {totalCount === 0 ? 'Minden számviteli kontroll tiszta' : 'Azonnali felülvizsgálatot igényel'}
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-red-500 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Inverz Számlaegyenleg</span>
            <Coins className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-red-600 dark:text-red-400">
            {formatNumberLocale(invertedBalances.length)} db
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Negatív kassza / bank / szállító</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Partner Nélküli Tételek</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
            {formatNumberLocale(missingPartners.length)} db
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">31, 45, 35, 453, 52 számlákon</div>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500 bg-card">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">ÁFA Inkonzisztencia</span>
            <Percent className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
            {formatNumberLocale(vatInconsistencies.length)} db
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">Levonási tilalmak megsértése</div>
        </Card>
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <LoadingSpinner message="Könyvelési anomáliák szkennelése és ellenőrzése..." />
        </div>
      ) : totalCount === 0 ? (
        <Card className="py-16 text-center border-emerald-500/30 bg-emerald-500/5">
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
          <h3 className="text-lg font-bold text-foreground">Kiváló! Nincs detektált könyvelési anomália.</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            A pénztár és a bankegyenlegek pozitívak, nincsenek partner nélküli vevői/szállítói tételek, és az ÁFA-kódok konzisztensek a főkönyvvel.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 1. Inverz Számlaegyenlegek */}
          {invertedBalances.length > 0 && (
            <Card className="border-red-500/40">
              <CardHeader className="pb-3 bg-red-500/5">
                <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
                  <ShieldAlert className="h-5 w-5" />
                  Kritikus Inverz Számlaegyenlegek ({invertedBalances.length} db)
                </CardTitle>
                <CardDescription>
                  Súlyos számviteli kockázatot jelentő negatív készpénz vagy bankegyenlegek, illetve szállítói tartozik állás.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Főkönyvi Szám</TableHead>
                      <TableHead>Számla Neve</TableHead>
                      <TableHead className="text-right">Fennálló Egyenleg</TableHead>
                      <TableHead>Audit Értékelés / Kockázat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invertedBalances.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono font-bold">{item.gl_number}</TableCell>
                        <TableCell className="font-medium text-xs">{item.gl_name}</TableCell>
                        <TableCell className="text-right font-mono font-bold text-xs text-red-600 dark:text-red-400">
                          {formatCurrencyLocale(item.balance || 0, 'HUF')}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* 2. Partner Nélküli Tételek */}
          {missingPartners.length > 0 && (
            <Card className="border-blue-500/30">
              <CardHeader className="pb-3 bg-blue-500/5">
                <CardTitle className="text-base flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <Users className="h-5 w-5" />
                  Partner Nélküli Tételek ({missingPartners.length} db)
                </CardTitle>
                <CardDescription>
                  Vevői, szállítói, előleg vagy külső szolgáltatási számlák, ahol hiányzik a partner azonosító.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dátum</TableHead>
                      <TableHead>Bizonylatszám</TableHead>
                      <TableHead>Főkönyvi Szám</TableHead>
                      <TableHead>Megnevezés / Leírás</TableHead>
                      <TableHead className="text-right">Összeg</TableHead>
                      <TableHead>Hibaüzenet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {missingPartners.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-mono">{item.posting_date}</TableCell>
                        <TableCell className="text-xs font-mono font-semibold">{item.document_id}</TableCell>
                        <TableCell className="text-xs font-mono">{item.gl_number}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                          {item.description || item.gl_name}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {formatCurrencyLocale(item.amount || 0, 'HUF')}
                        </TableCell>
                        <TableCell className="text-xs text-amber-600 dark:text-amber-400">
                          {item.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* 3. ÁFA Inkonzisztenciák */}
          {vatInconsistencies.length > 0 && (
            <Card className="border-purple-500/30">
              <CardHeader className="pb-3 bg-purple-500/5">
                <CardTitle className="text-base flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <Percent className="h-5 w-5" />
                  ÁFA-kód és Főkönyvi Számla Inkonzisztencia ({vatInconsistencies.length} db)
                </CardTitle>
                <CardDescription>
                  Levonási tilalmak megsértése (pl. reprezentáció vagy tiltott üzemanyag levonható ÁFA-kulccsal).
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bizonylat</TableHead>
                      <TableHead>Főkönyvi Szám</TableHead>
                      <TableHead>Számla Neve</TableHead>
                      <TableHead>Megadott ÁFA Kulcs</TableHead>
                      <TableHead className="text-right">Összeg</TableHead>
                      <TableHead>Kockázat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vatInconsistencies.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-mono font-semibold">{item.document_id}</TableCell>
                        <TableCell className="text-xs font-mono">{item.gl_number}</TableCell>
                        <TableCell className="text-xs">{item.gl_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="border-purple-500 text-purple-600 font-mono text-xs">
                            {item.vat_code}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold">
                          {formatCurrencyLocale(item.amount || 0, 'HUF')}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
