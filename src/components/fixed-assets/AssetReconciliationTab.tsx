import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Loader2,
  RefreshCw,
  Scale,
  Search,
  X,
  Zap,
} from 'lucide-react';
import { useCompany } from '@/contexts/CompanyContext';
import { formatCurrency } from '@/lib/utils';
import { formatDateLocale } from '@/lib/locale/formatters';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableEmptyState } from '@/components/ui/table-empty-state';
import { UnifiedPagination } from '@/components/ui/unified-pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  buildAssetReconciliationReport,
  fetchAssetReconciliationRpc,
  repostUnpostedAssets,
  RECONCILIATION_TOLERANCE,
  type AccumIssue,
  type AssetReconciliationReport,
  type GrossIssue,
  type ReconAssetRow,
  type RepostResult,
} from '@/lib/fixed-assets/assetReconciliationService';
import type { FixedAsset } from '@/types/fixed-assets';

interface AssetReconciliationTabProps {
  /** A fül jelenleg látható-e (perzisztens DOM: a lekérdezés az első megnyitáskor indul). */
  active: boolean;
  assets: FixedAsset[];
  /** Van-e írási jogosultság a tárgyi eszköz modulban. */
  writable: boolean;
  onOpenAsset: (assetId: string) => void;
}

type RowFilter = 'issues' | 'all';
type WizardStep = 'closed' | 'confirm' | 'running' | 'done';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const GROSS_ISSUE_LABELS: Record<GrossIssue, string> = {
  ok: 'Rendben',
  unposted: 'Aktiválás nincs könyvelve',
  period_mismatch: 'Időszak-eltérés',
  value_mismatch: 'Érték-eltérés',
};

const ACCUM_ISSUE_LABELS: Record<AccumIssue, string> = {
  ok: 'Rendben',
  unposted_depreciation: 'ÉCS nincs könyvelve',
  under_posted: 'ÉCS alulkönyvelt',
  over_posted: 'ÉCS túlkönyvelt',
};

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge
      variant="outline"
      className={
        ok
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'border-destructive/30 bg-destructive/10 text-destructive'
      }
    >
      {label}
    </Badge>
  );
}

interface KpiCardProps {
  id: string;
  title: string;
  hint: string;
  glLabel: string;
  analyticLabel: string;
  gl: number;
  analytic: number | null;
  difference: number | null;
  ok: boolean | null;
}

function KpiCard({ id, title, hint, glLabel, analyticLabel, gl, analytic, difference, ok }: KpiCardProps) {
  const tone =
    ok === null
      ? 'border-border/60'
      : ok
        ? 'border-emerald-500/30 bg-emerald-500/5'
        : 'border-destructive/30 bg-destructive/5';
  return (
    <Card id={id} className={`${tone} transition-colors duration-150`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-semibold">
          <span>{title}</span>
          {ok === null ? (
            <Badge variant="outline">Tájékoztató</Badge>
          ) : ok ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">{glLabel}</span>
          <span className="font-mono tabular-nums">{formatCurrency(gl, 'HUF')}</span>
        </div>
        {analytic !== null && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">{analyticLabel}</span>
            <span className="font-mono tabular-nums">{formatCurrency(analytic, 'HUF')}</span>
          </div>
        )}
        {difference !== null && (
          <div className="flex justify-between border-t border-border/50 pt-1.5 font-medium">
            <span>Eltérés</span>
            <span
              className={`font-mono tabular-nums ${
                Math.abs(difference) < RECONCILIATION_TOLERANCE ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
              }`}
            >
              {formatCurrency(difference, 'HUF')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function rowHasIssue(row: ReconAssetRow): boolean {
  return row.issue !== 'ok' || row.accum_issue !== 'ok';
}

function LoadingState() {
  return (
    <div className="space-y-4 p-6" id="asset-reconciliation-loading" aria-busy="true">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function AssetReconciliationTab({ active, assets, writable, onOpenAsset }: AssetReconciliationTabProps) {
  const { t } = useTranslation(['hr', 'common']);
  const tt = useCallback(
    (key: string, defaultValue: string) => t(`hr:fixed_assets.reconciliation.${key}`, defaultValue),
    [t],
  );
  const { selectedCompany } = useCompany();
  const companyId = selectedCompany?.id;
  const queryClient = useQueryClient();

  const [asOf, setAsOf] = useState(todayIso);
  const [rowFilter, setRowFilter] = useState<RowFilter>('issues');
  const [hasBeenActive, setHasBeenActive] = useState(active);
  const [wizardStep, setWizardStep] = useState<WizardStep>('closed');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<RepostResult[]>([]);

  // Keresés és pagináció az eszközönkénti táblázathoz
  const [assetsSearch, setAssetsSearch] = useState('');
  const [assetsPage, setAssetsPage] = useState(1);
  const [assetsPageSize, setAssetsPageSize] = useState(50);

  // Keresés és pagináció a jelöletlen főkönyvi sorokhoz (orphans)
  const [orphansSearch, setOrphansSearch] = useState('');
  const [orphansPage, setOrphansPage] = useState(1);
  const [orphansPageSize, setOrphansPageSize] = useState(50);

  // Perzisztens DOM: a lekérdezés az első megnyitáskor indul, utána a fül mountolva marad
  if (active && !hasBeenActive) setHasBeenActive(true);

  const query = useQuery({
    queryKey: ['assetReconciliation', companyId, asOf],
    queryFn: () => fetchAssetReconciliationRpc(companyId as string, asOf),
    enabled: !!companyId && hasBeenActive && /^\d{4}-\d{2}-\d{2}$/.test(asOf),
    placeholderData: (previous) => previous,
    staleTime: 30_000,
  });

  const report: AssetReconciliationReport | null = useMemo(
    () => (query.data ? buildAssetReconciliationReport(query.data, assets, asOf) : null),
    [query.data, assets, asOf],
  );

  const visibleRows = useMemo(() => {
    if (!report) return [];
    const base = rowFilter === 'all' ? report.assets : report.assets.filter(rowHasIssue);
    if (!assetsSearch.trim()) return base;
    const q = assetsSearch.trim().toLowerCase();
    return base.filter(
      (row) =>
        row.inventory_number.toLowerCase().includes(q) ||
        row.name.toLowerCase().includes(q),
    );
  }, [report, rowFilter, assetsSearch]);

  const totalAssetsPages = Math.max(1, Math.ceil(visibleRows.length / assetsPageSize));
  const safeAssetsPage = Math.min(Math.max(1, assetsPage), totalAssetsPages);
  const paginatedAssetRows = useMemo(() => {
    const start = (safeAssetsPage - 1) * assetsPageSize;
    return visibleRows.slice(start, start + assetsPageSize);
  }, [visibleRows, safeAssetsPage, assetsPageSize]);

  const orphanRows = useMemo(() => {
    if (!report?.orphans) return [];
    if (!orphansSearch.trim()) return report.orphans;
    const q = orphansSearch.trim().toLowerCase();
    return report.orphans.filter(
      (o) =>
        (o.document_id && o.document_id.toLowerCase().includes(q)) ||
        (o.gl_number && o.gl_number.toLowerCase().includes(q)) ||
        (o.description && o.description.toLowerCase().includes(q)) ||
        (o.posting_date && o.posting_date.includes(q)),
    );
  }, [report, orphansSearch]);

  const totalOrphansPages = Math.max(1, Math.ceil(orphanRows.length / orphansPageSize));
  const safeOrphansPage = Math.min(Math.max(1, orphansPage), totalOrphansPages);
  const paginatedOrphanRows = useMemo(() => {
    const start = (safeOrphansPage - 1) * orphansPageSize;
    return orphanRows.slice(start, start + orphansPageSize);
  }, [orphanRows, safeOrphansPage, orphansPageSize]);

  const handleFilterChange = useCallback((f: RowFilter) => {
    setRowFilter(f);
    setAssetsPage(1);
  }, []);

  // Táblázat layout-stabilitás (nem ugrál a felület kevés találatnál vagy keresésnél)
  const assetsTableMinHeight = useMemo(
    () => 40 + 48 + assetsPageSize * 52,
    [assetsPageSize],
  );

  const orphansTableMinHeight = useMemo(
    () => 40 + 48 + orphansPageSize * 44,
    [orphansPageSize],
  );

  const unpostedRows = useMemo(
    () => (report ? report.assets.filter((r) => report.repostableAssetIds.includes(r.asset_id)) : []),
    [report],
  );
  const unpostedTotal = unpostedRows.reduce((s, r) => s + r.expected_gross, 0);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['assetReconciliation', companyId] });
  }, [queryClient, companyId]);

  const runRepost = useCallback(async () => {
    if (!companyId || !report || wizardStep === 'running') return;
    setWizardStep('running');
    setProgress({ done: 0, total: report.repostableAssetIds.length });
    try {
      const res = await repostUnpostedAssets(companyId, assets, report.repostableAssetIds, (done, total) =>
        setProgress({ done, total }),
      );
      setResults(res);
      const okCount = res.filter((r) => r.success).length;
      const failCount = res.length - okCount;
      toast({
        variant: failCount > 0 ? 'destructive' : undefined,
        title: failCount > 0 ? 'Részben sikeres pótlás' : 'Hiányzó tételek pótolva',
        description: `${okCount} eszköz aktiválása lekönyvelve${failCount > 0 ? `, ${failCount} sikertelen` : ''}.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['assetReconciliation', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['fixedAssets', companyId] }),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ismeretlen hiba';
      toast({ variant: 'destructive', title: 'A pótlás nem sikerült', description: message });
    } finally {
      setWizardStep('done');
    }
  }, [companyId, report, assets, queryClient, wizardStep]);

  if (!companyId) return null;

  const isFirstLoad = query.isLoading && !query.data;
  const hasData = !!report;
  const isEmpty =
    hasData &&
    report.assets.length === 0 &&
    report.orphans.length === 0 &&
    Math.abs(report.gross.gl) < RECONCILIATION_TOLERANCE &&
    Math.abs(report.accum.gl) < RECONCILIATION_TOLERANCE;

  return (
    <div id="asset-reconciliation-tab" className="space-y-5 p-6">
      {/* Fejléc: dátum + frissítés + pótlás */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Scale className="h-5 w-5 text-primary" />
            {tt('title', 'Rekonciliáció & Főkönyv')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {tt(
              'subtitle',
              'A tárgyi eszköz analitika és a főkönyv 1-es számlaosztályának (11–14, 119/129/139/149, 161) egyezősége.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label htmlFor="asset-recon-as-of" className="text-xs text-muted-foreground">
              {tt('as_of', 'Fordulónap')}
            </label>
            <Input
              id="asset-recon-as-of"
              type="date"
              value={asOf}
              onChange={(e) => e.target.value && setAsOf(e.target.value)}
              className="h-9 w-40"
            />
          </div>
          <Button
            id="asset-recon-refresh"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={refresh}
            disabled={query.isFetching}
          >
            {query.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {tt('refresh', 'Frissítés')}
          </Button>
          <Button
            id="asset-recon-repost"
            size="sm"
            className="gap-2 font-medium"
            onClick={() => {
              setResults([]);
              setWizardStep('confirm');
            }}
            disabled={!writable || !report || report.repostableAssetIds.length === 0 || query.isFetching}
          >
            <Zap className="h-4 w-4" />
            {tt('repost', 'Hiányzó tételek pótlása')}
            {report && report.repostableAssetIds.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {report.repostableAssetIds.length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* 4 állapot: loading / error / empty / data */}
      {isFirstLoad && <LoadingState />}

      {query.isError && !hasData && (
        <Card id="asset-reconciliation-error" className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium">{tt('error_title', 'A rekonciliációt nem sikerült betölteni')}</p>
                <p className="text-sm text-muted-foreground">
                  {query.error instanceof Error ? query.error.message : tt('error_generic', 'Ismeretlen hiba történt.')}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
              {tt('retry', 'Újrapróbálkozás')}
            </Button>
          </CardContent>
        </Card>
      )}

      {query.isError && hasData && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-2 text-sm text-destructive">
          <span>{tt('stale_error', 'A frissítés nem sikerült, a korábban betöltött adatok láthatók.')}</span>
          <Button variant="ghost" size="sm" onClick={() => query.refetch()}>
            {tt('retry', 'Újrapróbálkozás')}
          </Button>
        </div>
      )}

      {isEmpty && (
        <Card id="asset-reconciliation-empty">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="rounded-xl bg-muted/50 p-4">
              <FileSearch className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <p className="font-medium">{tt('empty_title', 'Nincs egyeztethető tétel')}</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {tt(
                'empty_desc',
                'Ehhez a céghez még nincs tárgyi eszköz és nincs eszközszámlákra (1-es osztály) könyvelt tétel a fordulónapig.',
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {hasData && !isEmpty && report && (
        <>
          {/* KPI kártyák */}
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard
              id="asset-recon-kpi-gross"
              title={tt('kpi_gross', 'Bruttó egyezőség')}
              hint={tt('kpi_gross_hint', 'Eszközszámlák (11–14) egyenlege és az aktivált eszközök bekerülési értéke')}
              glLabel="Főkönyv"
              analyticLabel="Analitika"
              gl={report.gross.gl}
              analytic={report.gross.analytic}
              difference={report.gross.difference}
              ok={report.gross.status === 'OK'}
            />
            <KpiCard
              id="asset-recon-kpi-accum"
              title={tt('kpi_accum', 'ÉCS egyezőség')}
              hint={`${tt('kpi_accum_hint', 'Halmozott ÉCS (119/129/139/149) – számítva eddig:')} ${formatDateLocale(report.depreciationCutoff)}`}
              glLabel="Főkönyv"
              analyticLabel="Analitika"
              gl={report.accum.gl}
              analytic={report.accum.analytic}
              difference={report.accum.difference}
              ok={report.accum.status === 'OK'}
            />
            <KpiCard
              id="asset-recon-kpi-cip"
              title={tt('kpi_cip', 'Beruházás (161)')}
              hint={tt(
                'kpi_cip_hint',
                'Folyamatban lévő beruházás – a nyilvántartás nem vezet beruházási analitikát, ezért tájékoztató adat',
              )}
              glLabel="Főkönyvi egyenleg"
              analyticLabel=""
              gl={report.cip.gl}
              analytic={null}
              difference={null}
              ok={null}
            />
          </div>

          {/* Root-cause összesítő */}
          <Card id="asset-recon-root-causes">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{tt('root_causes', 'Eltérés okai')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {[
                { key: 'unposted', label: 'Le nem könyvelt aktiválás', ...report.rootCauses.unposted_assets },
                { key: 'orphan', label: 'Eszközhöz nem kötött főkönyvi sor', ...report.rootCauses.orphan_gl_lines },
                { key: 'period', label: 'Időszak-eltérés', ...report.rootCauses.period_mismatches },
                { key: 'value', label: 'Bruttó érték-eltérés', ...report.rootCauses.value_mismatches },
                { key: 'dep-unposted', label: 'Le nem könyvelt ÉCS', ...report.rootCauses.unposted_depreciation },
                { key: 'dep-mismatch', label: 'ÉCS eltérés', ...report.rootCauses.accum_mismatches },
              ].map((c) => (
                <div
                  key={c.key}
                  id={`asset-recon-cause-${c.key}`}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                    c.count > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-border/50'
                  }`}
                >
                  <span className="text-muted-foreground">{c.label}</span>
                  <span className="text-right">
                    <span className="font-semibold">{c.count} db</span>
                    {c.count > 0 && (
                      <span className="block font-mono text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(c.amount, 'HUF')}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Eszközönkénti táblázat */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{tt('assets_table', 'Eszközönkénti egyeztetés')}</h3>
                <p className="text-xs text-muted-foreground">
                  {tt('assets_table_desc', 'Az analitika és a főkönyv összevetése eszközönként, a leltári szám alapján.')}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder={tt('search_assets_placeholder', 'Keresés név vagy leltári szám...')}
                    value={assetsSearch}
                    onChange={(e) => {
                      setAssetsSearch(e.target.value);
                      setAssetsPage(1);
                    }}
                    className="pl-8 pr-8 h-8 text-xs bg-background/50 border-border/60"
                  />
                  {assetsSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssetsSearch('');
                        setAssetsPage(1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                      title={tt('clear_search', 'Keresés törlése')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                <div className="flex rounded-lg border border-border/60 bg-muted/30 p-1">
                  {(['issues', 'all'] as const).map((f) => (
                    <button
                      key={f}
                      id={`asset-recon-filter-${f}`}
                      type="button"
                      onClick={() => handleFilterChange(f)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                        rowFilter === f
                          ? 'bg-background text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {f === 'issues' ? tt('filter_issues', 'Csak eltérések') : tt('filter_all', 'Mind')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div
              className="rounded-xl border border-border/60 bg-card overflow-hidden flex flex-col transition-[min-height] duration-200"
              style={{ minHeight: `${assetsTableMinHeight}px` }}
            >
              <div className="overflow-x-auto flex-1">
                <Table id="asset-recon-assets-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Leltári szám</TableHead>
                      <TableHead>Megnevezés</TableHead>
                      <TableHead>Aktiválás</TableHead>
                      <TableHead className="text-right">Bruttó (analitika)</TableHead>
                      <TableHead className="text-right">Bruttó (főkönyv)</TableHead>
                      <TableHead className="text-right">ÉCS (analitika)</TableHead>
                      <TableHead className="text-right">ÉCS (főkönyv)</TableHead>
                      <TableHead>Státusz</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRows.length === 0 ? (
                      <TableEmptyState
                        colSpan={9}
                        icon={assetsSearch.trim() ? Search : CheckCircle2}
                        title={
                          assetsSearch.trim()
                            ? tt('no_search_results_title', 'Nincs keresési találat')
                            : tt('no_issues_title', 'Nincs eltérő eszköz')
                        }
                        description={
                          assetsSearch.trim()
                            ? tt('no_search_results_desc', 'A megadott keresési feltételre nem található eszköz.')
                            : tt('no_issues_desc', 'Minden eszköz bruttó értéke és ÉCS-e egyezik a főkönyvvel.')
                        }
                        onClearFilters={() => {
                          if (assetsSearch.trim()) {
                            setAssetsSearch('');
                            setAssetsPage(1);
                          } else {
                            handleFilterChange('all');
                          }
                        }}
                        clearLabel={
                          assetsSearch.trim()
                            ? tt('clear_search', 'Keresés törlése')
                            : tt('show_all', 'Minden eszköz mutatása')
                        }
                      />
                    ) : (
                      paginatedAssetRows.map((row) => (
                        <TableRow key={row.asset_id} id={`asset-recon-row-${row.asset_id}`}>
                          <TableCell className="font-mono text-xs">{row.inventory_number}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{row.name}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatDateLocale(row.activation_date)}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {formatCurrency(row.expected_gross, 'HUF')}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {formatCurrency(row.gl_gross, 'HUF')}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {formatCurrency(row.expected_accum, 'HUF')}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {formatCurrency(row.gl_accum, 'HUF')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              <StatusBadge ok={row.issue === 'ok'} label={`Bruttó: ${GROSS_ISSUE_LABELS[row.issue]}`} />
                              <StatusBadge
                                ok={row.accum_issue === 'ok'}
                                label={`ÉCS: ${ACCUM_ISSUE_LABELS[row.accum_issue]}`}
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label={`${row.inventory_number} megnyitása`}
                              onClick={() => onOpenAsset(row.asset_id)}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-auto border-t border-border/60 bg-card/60 px-4 py-1.5">
                <UnifiedPagination
                  currentPage={safeAssetsPage}
                  totalPages={totalAssetsPages}
                  totalItems={visibleRows.length}
                  pageSize={assetsPageSize}
                  onPageChange={setAssetsPage}
                  onPageSizeChange={(newSize) => {
                    setAssetsPageSize(newSize);
                    setAssetsPage(1);
                  }}
                  pageSizeOptions={[25, 50, 100]}
                  disableScrollToTop={true}
                />
              </div>
            </div>
          </div>

          {/* Jelöletlen főkönyvi sorok */}
          {report.rootCauses.orphan_gl_lines.count > 0 && (
            <div className="space-y-2" id="asset-recon-orphans">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{tt('orphans', 'Eszközhöz nem kötött főkönyvi sorok')}</h3>
                  <p className="text-xs text-muted-foreground">
                    {tt(
                      'orphans_desc',
                      'A jelölés (eszköz-azonosító a főkönyvi soron) bevezetése előtt, vagy más módon (pl. vegyes naplóban) könyvelt eszközszámla-tételek. Ellenőrizd, hogy melyik eszközhöz tartoznak.',
                    )}
                  </p>
                </div>
                <div className="relative w-full sm:w-64 shrink-0">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    type="text"
                    placeholder={tt('search_orphans_placeholder', 'Keresés bizonylat, leírás, főkönyv...')}
                    value={orphansSearch}
                    onChange={(e) => {
                      setOrphansSearch(e.target.value);
                      setOrphansPage(1);
                    }}
                    className="pl-8 pr-8 h-8 text-xs bg-background/50 border-border/60"
                  />
                  {orphansSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setOrphansSearch('');
                        setOrphansPage(1);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
                      title={tt('clear_search', 'Keresés törlése')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <div
                className="rounded-xl border border-border/60 bg-card overflow-hidden flex flex-col transition-[min-height] duration-200"
                style={{ minHeight: `${orphansTableMinHeight}px` }}
              >
                <div className="overflow-x-auto flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Könyvelés dátuma</TableHead>
                        <TableHead>Bizonylat</TableHead>
                        <TableHead>Főkönyvi szám</TableHead>
                        <TableHead>T/K</TableHead>
                        <TableHead className="text-right">Összeg</TableHead>
                        <TableHead>Leírás</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedOrphanRows.length === 0 ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="h-48 text-center py-8 text-xs text-muted-foreground">
                            <div className="flex flex-col items-center justify-center gap-2">
                              {orphansSearch.trim() && (
                                <div className="rounded-xl bg-muted/50 p-3 mb-1">
                                  <Search className="h-6 w-6 text-muted-foreground opacity-60" />
                                </div>
                              )}
                              <p className="font-medium text-sm text-foreground">
                                {orphansSearch.trim()
                                  ? tt('no_matching_orphans', 'Nincs a keresésnek megfelelő tétel.')
                                  : tt('no_orphans', 'Nincsenek jelöletlen sorok.')}
                              </p>
                              {orphansSearch.trim() && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setOrphansSearch('');
                                    setOrphansPage(1);
                                  }}
                                  className="mt-2 text-xs"
                                >
                                  {tt('clear_search', 'Keresés törlése')}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedOrphanRows.map((o) => (
                          <TableRow key={o.line_id}>
                            <TableCell className="whitespace-nowrap text-xs">{formatDateLocale(o.posting_date)}</TableCell>
                            <TableCell className="font-mono text-xs">{o.document_id || '—'}</TableCell>
                            <TableCell className="font-mono text-xs">{o.gl_number}</TableCell>
                            <TableCell>{o.dc_type}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              {formatCurrency(Number(o.amount), 'HUF')}
                            </TableCell>
                            <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                              {o.description || '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-auto border-t border-border/60 bg-card/60 px-4 py-1.5">
                  <UnifiedPagination
                    currentPage={safeOrphansPage}
                    totalPages={totalOrphansPages}
                    totalItems={orphanRows.length}
                    pageSize={orphansPageSize}
                    onPageChange={setOrphansPage}
                    onPageSizeChange={(newSize) => {
                      setOrphansPageSize(newSize);
                      setOrphansPage(1);
                    }}
                    pageSizeOptions={[25, 50, 100]}
                    disableScrollToTop={true}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Hiányzó tételek pótlása – kötegelt varázsló */}
      <Dialog
        open={wizardStep !== 'closed'}
        onOpenChange={(open) => {
          if (!open && wizardStep !== 'running') setWizardStep('closed');
        }}
      >
        <DialogContent className="max-w-xl" id="asset-recon-repost-dialog">
          <DialogHeader>
            <DialogTitle>{tt('repost', 'Hiányzó tételek pótlása')}</DialogTitle>
            <DialogDescription>
              {wizardStep === 'done'
                ? tt('repost_done_desc', 'A pótlás lefutott. Az eredmény eszközönként:')
                : tt(
                    'repost_desc',
                    'A le nem könyvelt aktiválású eszközök aktiválási tétele (T eszközszámla / K 161) a Vegyes naplóba kerül.',
                  )}
            </DialogDescription>
          </DialogHeader>

          {wizardStep === 'confirm' && (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between rounded-lg border border-border/60 px-3 py-2">
                <span className="text-muted-foreground">Érintett eszközök</span>
                <span className="font-semibold">{unpostedRows.length} db</span>
              </div>
              <div className="flex justify-between rounded-lg border border-border/60 px-3 py-2">
                <span className="text-muted-foreground">Összes bekerülési érték</span>
                <span className="font-mono font-semibold tabular-nums">{formatCurrency(unpostedTotal, 'HUF')}</span>
              </div>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {unpostedRows.slice(0, 50).map((r) => (
                  <li key={r.asset_id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {r.inventory_number} — {r.name}
                    </span>
                    <span className="font-mono tabular-nums">{formatCurrency(r.expected_gross, 'HUF')}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                A feladás a könyvelő jogosultságához kötött; az azonos bizonylatszámú tétel nem könyvelődik duplán.
              </p>
            </div>
          )}

          {wizardStep === 'running' && (
            <div className="space-y-2 py-2" aria-live="polite">
              <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0} />
              <p className="text-center text-sm text-muted-foreground">
                {progress.done} / {progress.total}
              </p>
            </div>
          )}

          {wizardStep === 'done' && (
            <ul className="max-h-60 space-y-1 overflow-y-auto text-sm" id="asset-recon-repost-results">
              {results.map((r) => (
                <li key={r.assetId} className="flex items-start gap-2">
                  {r.success ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <span>
                    <span className="font-mono text-xs">{r.inventoryNumber}</span>
                    {r.message && <span className="block text-xs text-muted-foreground">{r.message}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <DialogFooter>
            {wizardStep === 'confirm' && (
              <>
                <Button variant="outline" onClick={() => setWizardStep('closed')}>
                  Mégse
                </Button>
                <Button id="asset-recon-repost-confirm" onClick={runRepost} className="gap-2">
                  <Zap className="h-4 w-4" />
                  Könyvelés indítása
                </Button>
              </>
            )}
            {wizardStep === 'running' && (
              <Button disabled className="gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Könyvelés folyamatban…
              </Button>
            )}
            {wizardStep === 'done' && <Button onClick={() => setWizardStep('closed')}>Bezárás</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
