import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Printer,
  ShieldAlert,
  Calendar,
  Users,
  Banknote,
  Percent,
  RefreshCw,
  Info,
} from 'lucide-react';
import { useCashPartnerMonthlyLimits } from '@/hooks/usePettyCashUpgrade';
import { useCompany } from '@/contexts/CompanyContext';
import { fmtBalance } from './types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Nav40PreviewDialog } from './Nav40PreviewDialog';

interface CashPartnerLimitsTabProps {
  companyId: string;
}

export default function CashPartnerLimitsTab({ companyId }: CashPartnerLimitsTabProps) {
  const { t } = useTranslation(['pettyCash', 'common']);
  const { selectedCompany } = useCompany();
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [showNav40Dialog, setShowNav40Dialog] = useState(false);

  const {
    data: limitData,
    isLoading,
    refetch,
    isRefetching,
  } = useCashPartnerMonthlyLimits(companyId, selectedYear, selectedMonth);

  const monthNames = [
    'Január', 'Február', 'Március', 'Április', 'Május', 'Június',
    'Július', 'Augusztus', 'Szeptember', 'Október', 'November', 'December'
  ];

  const handleExportCsv = () => {
    if (!limitData || !limitData.partners || limitData.partners.length === 0) {
      toast({
        title: 'Nincs exportálható adat',
        description: 'A kiválasztott hónapban nem történt készpénzes forgalom.',
        variant: 'destructive',
      });
      return;
    }

    const headers = ['Partner Neve', 'Adószám', 'Havi Kp. Összeg (Ft)', 'Törvényi Limit (Ft)', 'Túllépés (Ft)', '20% Bírságkockázat (Ft)', 'Státusz'];
    const rows = limitData.partners.map(p => [
      `"${p.partner_name || 'Ismeretlen'}"`,
      `"${p.tax_number || ''}"`,
      p.total_amount_huf,
      p.monthly_threshold_huf,
      p.excess_amount_huf,
      p.penalty_risk_huf,
      `"${p.status}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `NAV40_partner_cash_limits_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'CSV Export letöltve',
      description: 'A NAV 40 bejelentéshez szükséges partneri adatok exportálása sikeres.',
    });
  };

  const violatingCount = limitData?.violating_partner_count || 0;
  const warningCount = limitData?.partners?.filter(p => p.status === 'warning').length || 0;

  return (
    <div className="space-y-6">
      {/* Header card with regulation reference */}
      <Card className="border border-border/80 shadow-sm bg-gradient-to-br from-card via-card to-muted/20">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-lg font-bold">
                  {t('pettyCash:partner_limits.title', 'Art. 114. § Partneri 1,5M Ft Készpénzlimit & NAV 40 Monitor')}
                </CardTitle>
              </div>
              <CardDescription className="text-xs mt-1">
                Az adózás rendjéről szóló 2017. évi CL. törvény (Art.) 114. § szerinti havi 1,5 millió forintos készpénzfizetési korlát és 20%-os mulasztási bírság kockázat elemzése
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={String(selectedYear)}
                onValueChange={(val) => setSelectedYear(Number(val))}
              >
                <SelectTrigger className="w-24 h-8 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={String(selectedMonth)}
                onValueChange={(val) => setSelectedMonth(Number(val))}
              >
                <SelectTrigger className="w-32 h-8 text-xs font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((name, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => refetch()}
                disabled={isLoading || isRefetching}
              >
                <RefreshCw className={cn("h-3.5 w-3.5", (isLoading || isRefetching) && "animate-spin")} />
                {t('common:refresh', 'Frissítés')}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleExportCsv}
                disabled={!limitData || !limitData.partners || limitData.partners.length === 0}
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                NAV 40 Export (CSV)
              </Button>

              <Button
                variant="default"
                size="sm"
                className="h-8 gap-1.5 text-xs shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                onClick={() => setShowNav40Dialog(true)}
                disabled={!limitData || !limitData.partners || limitData.partners.length === 0}
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                NAV 40 Adatlap Előkészítés
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Critical alert banner if limit exceeded */}
          {violatingCount > 0 ? (
            <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 text-destructive flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-destructive/20 text-destructive">
                  <AlertOctagon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-sm font-bold flex items-center gap-2">
                    <span>Figyelem: {violatingCount} partner esetében meghaladta a havi 1,5M Ft törvényi limitet!</span>
                    <Badge variant="destructive" className="text-[10px] uppercase font-bold animate-pulse">
                      NAV 40 Bejelentési Kötelezettség
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Az Art. 114. § (3) bekezdése alapján a 1,5 millió forintot meghaladó kifizetést a készpénzfizetés napjától számított 15 napon belül kötelező bejelenteni az állami adóhatósághoz a '40' számú nyomtatványon.
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 flex sm:flex-col items-end gap-2">
                <div>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase">
                    20%-os Mulasztási Bírság Kockázat
                  </div>
                  <div className="text-lg font-bold font-mono text-destructive">
                    {fmtBalance(limitData?.total_penalty_risk_huf || 0, 'HUF')}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs font-semibold shadow-sm"
                  onClick={() => setShowNav40Dialog(true)}
                >
                  <ShieldAlert className="w-3.5 h-3.5 mr-1" />
                  NAV 40 Bejelentés Megnyitása
                </Button>
              </div>
            </div>
          ) : warningCount > 0 ? (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="text-xs">
                <strong>Veszélyzóna figyelmeztetés:</strong> {warningCount} partner készpénzes forgalma meghaladta az 1 000 000 Ft-ot a hónapban, megközelítve a jogszabályi plafont.
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="text-xs">
                <strong>Szabályos készpénzforgalom:</strong> A vizsgált időszakban egyetlen partner sem közelítette vagy haladta meg a havi 1,5M Ft Art. készpénzkorlátot.
              </div>
            </div>
          )}

          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-lg border border-border/70 bg-card/60 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <Users className="h-3.5 w-3.5" />
                <span>Érintett Partnerek</span>
              </div>
              <div className="text-lg font-bold font-mono text-foreground">
                {limitData?.partners?.length || 0} partner
              </div>
              <div className="text-[10px] text-muted-foreground">
                Készpénzmozgással érintett partnerek a hónapban
              </div>
            </div>

            <div className="p-3.5 rounded-lg border border-border/70 bg-card/60 space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <Banknote className="h-3.5 w-3.5" />
                <span>Havi Készpénzforgalom</span>
              </div>
              <div className="text-lg font-bold font-mono text-foreground">
                {fmtBalance(
                  (limitData?.partners || []).reduce((acc, p) => acc + (p.total_amount_huf || 0), 0),
                  'HUF'
                )}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Bevétel és kiadás partneri készpénzösszesítője
              </div>
            </div>

            <div className={cn(
              "p-3.5 rounded-lg border space-y-1",
              violatingCount > 0 ? "border-destructive/40 bg-destructive/5" : "border-border/70 bg-card/60"
            )}>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <AlertOctagon className="h-3.5 w-3.5 text-destructive" />
                <span>Túllépő Partnerek</span>
              </div>
              <div className={cn("text-lg font-bold font-mono", violatingCount > 0 ? "text-destructive" : "text-foreground")}>
                {violatingCount} db
              </div>
              <div className="text-[10px] text-muted-foreground">
                &gt; 1 500 000 Ft havi készpénzes limit
              </div>
            </div>

            <div className={cn(
              "p-3.5 rounded-lg border space-y-1",
              (limitData?.total_penalty_risk_huf || 0) > 0 ? "border-destructive/40 bg-destructive/10" : "border-border/70 bg-card/60"
            )}>
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                <Percent className="h-3.5 w-3.5 text-destructive" />
                <span>NAV Bírságkockázat (20%)</span>
              </div>
              <div className={cn("text-lg font-bold font-mono", (limitData?.total_penalty_risk_huf || 0) > 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
                {fmtBalance(limitData?.total_penalty_risk_huf || 0, 'HUF')}
              </div>
              <div className="text-[10px] text-muted-foreground">
                Art. 114. § szerinti szankció (túllépés 20%-a)
              </div>
            </div>
          </div>

          {/* Partner limits table */}
          <div className="space-y-2 pt-2">
            <div className="flex justify-between items-center">
              <div className="text-xs font-bold text-foreground uppercase tracking-wide">
                Partnerek Készpénzforgalma ({selectedYear}. {monthNames[selectedMonth - 1]})
              </div>
              <div className="text-[11px] text-muted-foreground">
                Törvényi havi limit partnerenként: <strong>1 500 000 Ft</strong>
              </div>
            </div>

            <div className="border border-border/70 rounded-lg overflow-hidden bg-card">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="text-[11px]">
                    <TableHead>Partner Neve</TableHead>
                    <TableHead>Adószám</TableHead>
                    <TableHead className="text-right">Havi Kp. Összeg</TableHead>
                    <TableHead className="w-40">Limit Kihasználtság</TableHead>
                    <TableHead className="text-right">Túllépés Mértéke</TableHead>
                    <TableHead className="text-right">20% Bírságkockázat</TableHead>
                    <TableHead className="text-center">Státusz & Teendő</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {(!limitData?.partners || limitData.partners.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Ebben a hónapban nem található rögzített készpénzforgalom.
                      </TableCell>
                    </TableRow>
                  ) : (
                    limitData.partners.map((p, idx) => {
                      const pct = Math.min((p.total_amount_huf / p.monthly_threshold_huf) * 100, 100);
                      const isExceeded = Boolean(p.is_exceeded || p.status === 'exceeded' || p.status === 'violating');
                      const isWarning = Boolean(!isExceeded && (p.status === 'warning' || p.total_amount_huf >= p.monthly_threshold_huf * 0.8));

                      return (
                        <TableRow key={idx} className={cn("hover:bg-muted/30", isExceeded && "bg-destructive/5")}>
                          <TableCell className="font-semibold text-foreground">
                            {p.partner_name || 'Ismeretlen Partner'}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground">
                            {p.tax_number || '—'}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground">
                            {fmtBalance(p.total_amount_huf, 'HUF')}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                                <span>{Math.round(pct)}%</span>
                                <span>1,5M Ft</span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-300",
                                    isExceeded ? "bg-destructive" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                                  )}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono font-medium",
                            isExceeded ? "text-destructive font-bold" : "text-muted-foreground"
                          )}>
                            {p.excess_amount_huf > 0 ? fmtBalance(p.excess_amount_huf, 'HUF') : '0 Ft'}
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono font-bold",
                            p.penalty_risk_huf > 0 ? "text-destructive" : "text-muted-foreground"
                          )}>
                            {p.penalty_risk_huf > 0 ? fmtBalance(p.penalty_risk_huf, 'HUF') : '0 Ft'}
                          </TableCell>
                          <TableCell className="text-center">
                            {isExceeded ? (
                              <Badge variant="destructive" className="text-[10px] font-bold">
                                NAV 40 Kötelező
                              </Badge>
                            ) : isWarning ? (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px]">
                                Figyelem (&gt;1M)
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px]">
                                Szabályos
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Legal notes */}
          <div className="p-3 bg-muted/40 rounded-lg border border-border/50 text-[11px] text-muted-foreground space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              <Info className="h-3.5 w-3.5 text-primary" />
              <span>Jogszabályi Tudnivalók (Art. 114. § és 228. §):</span>
            </div>
            <p>
              1. Pénzforgalmi számla nyitására kötelezett adózók között a készpénzben teljesíthető kifizetés összege egy naptári hónapban legfeljebb <strong>1,5 millió forint</strong> lehet ügyletenként vagy azonos felek közötti szerződésenként.
            </p>
            <p>
              2. Ha a kifizetés meghaladja a másfél millió forintot, a kifizető és a jogosult is köteles azt a kifizetés napjától számított <strong>15 napon belül a NAV '40' számú nyomtatványán bejelenteni</strong>.
            </p>
            <p>
              3. A bejelentés elmulasztása vagy a készpénzfizetési korlát megsértése esetén a hatóság a másfél millió forintot meghaladó összeg után <strong>20%-os mulasztási bírságot szab ki</strong> a kifizetőre és a befogadóra egyaránt.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* NAV 40 Preview & Preparation Dialog */}
      <Nav40PreviewDialog
        open={showNav40Dialog}
        onOpenChange={setShowNav40Dialog}
        year={selectedYear}
        month={selectedMonth}
        companyName={selectedCompany?.name || 'Vállalkozás'}
        companyTaxNumber={selectedCompany?.tax_number || undefined}
        partners={(limitData?.partners as any) || []}
      />
    </div>
  );
}
