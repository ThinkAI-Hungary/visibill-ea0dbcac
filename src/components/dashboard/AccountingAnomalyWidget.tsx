/**
 * Accounting Anomaly Widget (Module 22)
 * Vezetői Cockpit / Irányítópult figyelmeztető kártya és tájékoztató modal.
 * Figyelmeztet, ha a főkönyvben egyeztetésre szoruló tételek vannak
 * (pl. hiányzó partner, fordított bank/pénztár egyenleg, ÁFA eltérés).
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Users,
  Coins,
  Percent,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { useAccountingAnomalies } from '@/hooks/useTechnicalAccounting';
import { type AccountingAnomaly } from '@/services/technicalAccountingService';

export const AccountingAnomalyWidget: React.FC = () => {
  const navigate = useNavigate();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data: anomalies, isLoading } = useAccountingAnomalies(
    selectedCompany?.id,
    dateFromFormatted || undefined,
    dateToFormatted || undefined
  );

  const totalCount = anomalies?.total_anomalies_count || 0;

  if (isLoading || totalCount === 0) {
    return null;
  }

  const missingPartners = anomalies?.missing_partners || [];
  const invertedBalances = anomalies?.inverted_balances || [];
  const vatInconsistencies = anomalies?.vat_inconsistencies || [];

  const allAnomalies: AccountingAnomaly[] = [
    ...missingPartners,
    ...invertedBalances,
    ...vatInconsistencies,
  ];

  const handleOpenModule = () => {
    setDetailsOpen(false);
    navigate('/technical-accounting?tab=ai-audit');
  };

  return (
    <>
      <Card className="border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent shadow-sm">
        <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
              <ShieldAlert className="h-5 w-5 animate-pulse" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-sm text-foreground">
                  Főkönyvi Egyeztetést Igénylő Tételek (AI Anomália)
                </h4>
                <Badge variant="outline" className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs font-bold">
                  {totalCount} db tétel
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                A rendszer könyvelési anomáliát detektált az aktuális időszak főkönyvében, amely egyeztetést igényel a könyvelővel.
              </p>

              <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px]">
                {missingPartners.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground bg-background/60 px-2 py-0.5 rounded-md border border-border/40">
                    <Users className="h-3 w-3 text-amber-500" />
                    {missingPartners.length} partner nélküli folyószámla
                  </span>
                )}
                {invertedBalances.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground bg-background/60 px-2 py-0.5 rounded-md border border-border/40">
                    <Coins className="h-3 w-3 text-rose-500" />
                    {invertedBalances.length} fordított pénztár/bank
                  </span>
                )}
                {vatInconsistencies.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground bg-background/60 px-2 py-0.5 rounded-md border border-border/40">
                    <Percent className="h-3 w-3 text-blue-500" />
                    {vatInconsistencies.length} ÁFA eltérés
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDetailsOpen(true)}
              className="text-xs h-8 border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-300"
            >
              Lista megtekintése
            </Button>
            <Button
              size="sm"
              onClick={handleOpenModule}
              className="text-xs h-8 gap-1.5 bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              <span>Audit Modul</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Részletező Dialog a Cockpitből */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Könyvelői Egyeztetést Igénylő Tételek
            </DialogTitle>
            <DialogDescription>
              Az alábbi tételek nem felelnek meg a szigorú számviteli szabályoknak vagy hiányos partner-analitikával rendelkeznek.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="border border-border/60 rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-[100px]">Számla</TableHead>
                    <TableHead>Bizonylat / Dátum</TableHead>
                    <TableHead className="text-right">Összeg</TableHead>
                    <TableHead>Hiba Leírása</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allAnomalies.slice(0, 10).map((a, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs font-semibold">
                        <div>{a.gl_number}</div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[120px]">{a.gl_name}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-mono font-medium">{a.document_id || '—'}</div>
                        <div className="text-[10px] text-muted-foreground">{a.posting_date || '—'}</div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold">
                        {a.amount != null
                          ? new Intl.NumberFormat('hu-HU', {
                              style: 'currency',
                              currency: 'HUF',
                              maximumFractionDigits: 0,
                            }).format(a.amount)
                          : a.balance != null
                          ? new Intl.NumberFormat('hu-HU', {
                              style: 'currency',
                              currency: 'HUF',
                              maximumFractionDigits: 0,
                            }).format(a.balance)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="text-foreground font-medium">{a.message}</div>
                        {a.description && <div className="text-[11px] truncate max-w-[260px]">{a.description}</div>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalCount > 10 && (
              <p className="text-center text-xs text-muted-foreground">
                További {totalCount - 10} tétel látható az Audit Modulban.
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setDetailsOpen(false)}>
                Bezárás
              </Button>
              <Button size="sm" onClick={handleOpenModule} className="gap-1.5">
                <span>Megnyitás az eaisyBooksban</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
