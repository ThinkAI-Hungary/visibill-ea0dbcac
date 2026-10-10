import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FileSpreadsheet,
  Calendar,
  RefreshCw,
  Building2,
  ShieldCheck,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import {
  fetchAuditorGlData,
  fetchSubsequentSettlements,
  checkAuditExportStaleness,
  fetchAuditExportHistory,
} from '@/services/auditorExportService';
import { StalenessWarningBanner } from './StalenessWarningBanner';
import { GlJournalExportCard } from './GlJournalExportCard';
import { AnalyticalPackagesCard } from './AnalyticalPackagesCard';
import { SubsequentSettlementsCard } from './SubsequentSettlementsCard';
import { ExportSnapshotsHistoryCard } from './ExportSnapshotsHistoryCard';

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

export function AuditorExportWorkspace() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Default to previous year for closing/audit, or current year
  const [fiscalYear, setFiscalYear] = useState<number>(() => CURRENT_YEAR - 1);
  const [dateFrom, setDateFrom] = useState<string>(() => `${CURRENT_YEAR - 1}-01-01`);
  const [dateTo, setDateTo] = useState<string>(() => `${CURRENT_YEAR - 1}-12-31`);
  const [includeOpening, setIncludeOpening] = useState<boolean>(true);
  const [includeClosing, setIncludeClosing] = useState<boolean>(false);
  const companyId = selectedCompany?.id;
  const companyName = selectedCompany?.name || 'Kiválasztott Vállalkozás';
  const taxNumber = selectedCompany?.tax_number || '';

  // Update date ranges when fiscal year changes
  const handleYearChange = (newYearStr: string) => {
    const yr = parseInt(newYearStr, 10);
    setFiscalYear(yr);
    setDateFrom(`${yr}-01-01`);
    setDateTo(`${yr}-12-31`);
  };

  // 1. Query GL Journal Data (20 columns)
  const {
    data: glData,
    isLoading: isLoadingGl,
    isRefetching: isRefetchingGl,
    refetch: refetchGl,
  } = useQuery({
    queryKey: ['auditorGlData', companyId, dateFrom, dateTo, includeOpening, includeClosing],
    queryFn: () => fetchAuditorGlData(companyId!, dateFrom, dateTo, includeOpening, includeClosing),
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  // 2. Query ISA 560 Subsequent Cash Settlements Report
  const {
    data: subReport,
    isLoading: isLoadingSub,
    refetch: refetchSub,
  } = useQuery({
    queryKey: ['auditorSubsequentReport', companyId, fiscalYear],
    queryFn: () => fetchSubsequentSettlements(companyId!, fiscalYear),
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });

  // 3. Query Staleness check
  const {
    data: stalenessInfo,
    isLoading: isLoadingStaleness,
    refetch: refetchStaleness,
  } = useQuery({
    queryKey: ['auditorExportStaleness', companyId, fiscalYear],
    queryFn: () => checkAuditExportStaleness(companyId!, fiscalYear),
    enabled: !!companyId,
    staleTime: 1000 * 30, // 30s
  });

  // 4. Query Snapshot History
  const {
    data: exportHistory = [],
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useQuery({
    queryKey: ['auditorExportHistory', companyId, fiscalYear],
    queryFn: () => fetchAuditExportHistory(companyId!, fiscalYear),
    enabled: !!companyId,
  });

  const handleRefreshAll = () => {
    refetchGl();
    refetchSub();
    refetchStaleness();
    refetchHistory();
    toast({
      title: 'Adatok frissítve',
      description: 'A legfrissebb főkönyvi adatok és könyvvizsgálói analitikák betöltve.',
    });
  };

  const handleSnapshotSaved = () => {
    refetchStaleness();
    refetchHistory();
  };

  if (!companyId) {
    return (
      <div className="max-w-7xl mx-auto p-8 text-center bg-muted/20 rounded-2xl border border-border/40">
        <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-base font-bold text-foreground">Válassz ki egy céget</h3>
        <p className="text-sm text-muted-foreground mt-1">
          A könyvvizsgálói export funkció használatához kérlek válassz ki egy céget a felső cégválasztóban.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Workspace Control Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-5 rounded-2xl border border-border/40 bg-muted/20 backdrop-blur-sm shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-black tracking-tight text-foreground">
              Könyvvizsgálói Export és Adatszolgáltatás
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20">
              Modul 19
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            MKVK & ISA kompatibilis exportok Alteryx, IDEA, CaseWare és Excel adatfeldolgozókhoz
          </p>
        </div>

        {/* Global Controls: Year selector, Opening/Closing switches, Refresh */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-background/80 px-3 py-1.5 rounded-xl border border-border/40">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">Üzleti év:</span>
            <Select value={String(fiscalYear)} onValueChange={handleYearChange}>
              <SelectTrigger className="w-[100px] h-8 text-xs font-bold border-0 bg-transparent p-0 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)} className="text-xs font-medium">
                    {y}. év
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl border border-border/40 bg-background/80 text-xs">
            <div className="flex items-center gap-1.5">
              <Switch
                id="workspace-inc-opening"
                checked={includeOpening}
                onCheckedChange={setIncludeOpening}
                className="scale-75"
              />
              <Label htmlFor="workspace-inc-opening" className="text-xs cursor-pointer text-muted-foreground">
                Nyitó
              </Label>
            </div>

            <div className="flex items-center gap-1.5">
              <Switch
                id="workspace-inc-closing"
                checked={includeClosing}
                onCheckedChange={setIncludeClosing}
                className="scale-75"
              />
              <Label htmlFor="workspace-inc-closing" className="text-xs cursor-pointer text-muted-foreground">
                Záró
              </Label>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={isLoadingGl || isRefetchingGl}
            className="text-xs h-9 font-medium"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoadingGl || isRefetchingGl ? 'animate-spin' : ''}`} />
            Frissítés
          </Button>
        </div>
      </div>

      {/* 1. Staleness Warning Banner (ISA 500 integrity) */}
      <StalenessWarningBanner
        stalenessInfo={stalenessInfo}
        isLoading={isLoadingStaleness}
        onRefreshStaleness={refetchStaleness}
        onGenerateNewSnapshot={() => {
          window.scrollTo({ top: 300, behavior: 'smooth' });
        }}
      />

      {/* 2. Primary 20-Column GL Journal Export Card */}
      <GlJournalExportCard
        data={glData}
        isLoading={isLoadingGl}
        companyId={companyId}
        fiscalYear={fiscalYear}
        onSnapshotSaved={handleSnapshotSaved}
      />

      {/* 3. ISA 560 Subsequent Cash Settlements Report */}
      <SubsequentSettlementsCard
        report={subReport}
        isLoading={isLoadingSub}
        companyName={companyName}
        fiscalYear={fiscalYear}
      />

      {/* 4. 15 Analytical Packages Selector & ZIP Bundle */}
      <AnalyticalPackagesCard
        companyName={companyName}
        taxNumber={taxNumber}
        fiscalYear={fiscalYear}
        period={{ from: dateFrom, to: dateTo }}
        glData={glData}
      />

      {/* 5. Snapshot History & Cryptographic SHA-256 Audit Trail */}
      <ExportSnapshotsHistoryCard
        records={exportHistory}
        isLoading={isLoadingHistory}
        onRefreshHistory={refetchHistory}
      />
    </div>
  );
}
