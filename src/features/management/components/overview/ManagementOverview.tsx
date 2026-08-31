import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '../common/ManagementStatCard';
import { Skeleton } from '../common/ManagementSkeleton';
import { fetchManagementData } from '../../api/managementApi';
import { OverviewData, FilesData } from '../../api/types';
import { useTickets } from '@/hooks/useTickets';
import { cn } from '@/lib/utils';
import {
  Users, Building2, Coins, Trophy, Server, AlertTriangle,
  TicketCheck, AlertCircle, FolderOpen
} from 'lucide-react';

export function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* 4 Stat Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Card key={idx} className="p-5 flex items-center justify-between border border-border/30 bg-card/50">
            <div className="space-y-2 flex-1">
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
              <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-zinc-200 dark:bg-zinc-800"></div>
          </Card>
        ))}
      </div>

      {/* Bento Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Financial & Costs */}
        <div>
          <Card className="p-5 h-full space-y-4 flex flex-col justify-between">
            <div className="space-y-4 flex-1">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
              <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div>
              <div className="space-y-2 pt-2">
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4"></div>
              </div>
            </div>
          </Card>
        </div>

        {/* Column 2: Worker Status */}
        <div className="flex flex-col space-y-4 h-full">
          <Card className="p-5 space-y-6">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-16"></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-12 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
              <div className="h-12 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
            </div>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4"></div>
                <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
              </div>
              <div className="space-y-1">
                <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4"></div>
                <div className="h-2 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
              </div>
            </div>
            <div className="border-t border-zinc-200 dark:border-zinc-900 pt-4 space-y-3">
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div>
              <div className="h-10 bg-zinc-200/60 dark:bg-zinc-900 rounded"></div>
            </div>
          </Card>

          <Card className="p-5 flex-1 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-12"></div>
            </div>
            <div className="h-20 bg-zinc-100 dark:bg-zinc-900 rounded flex items-end justify-between p-2 gap-4 mt-4">
              <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded flex-1"></div>
              <div className="h-10 bg-zinc-200 dark:bg-zinc-800 rounded flex-1"></div>
              <div className="h-14 bg-zinc-200 dark:bg-zinc-800 rounded flex-1"></div>
              <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded flex-1"></div>
            </div>
          </Card>
        </div>

        {/* Column 3: Tickets & Files */}
        <div className="flex flex-col space-y-3 h-full">
          <Card className="p-3.5 space-y-2">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="h-14 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
              <div className="h-14 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
            </div>
          </Card>

          {/* Applikáció hibák card skeleton */}
          <Card className="p-3.5 space-y-2">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
            <div className="h-14 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
          </Card>

          {/* Recent Files card skeleton */}
          <Card className="p-3.5 space-y-2 flex-1 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3"></div>
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-10"></div>
            </div>
            <div className="space-y-2 flex-1 flex flex-col justify-end mt-2">
              <div className="h-10 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
              <div className="h-10 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
              <div className="h-10 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
              <div className="h-10 bg-zinc-200/60 dark:bg-zinc-900/60 rounded"></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function normalizeStatus(status: string | null, errorMessage?: string | null): 'success' | 'pending' | 'error' | 'redirected' | 'dismissed' {
  if (status === 'redirected') return 'redirected';
  const isCompleted = errorMessage?.toLowerCase() === 'job completed' || errorMessage?.toLowerCase().includes('job completed');
  const isDuplicate = errorMessage?.includes('már létezik a rendszerben');
  if (isDuplicate) return 'dismissed';
  if (errorMessage && !isCompleted) return 'error';
  if (!status) return 'pending';
  switch (status) {
    case 'done': case 'completed': case 'processed': return 'success';
    case 'dismissed': return 'dismissed';
    case 'ignored': return 'dismissed';
    case 'error': case 'failed': case 'webhook_failed': return 'error';
    default: return 'pending';
  }
}

interface ManagementOverviewProps {
  overview: OverviewData | undefined;
  overviewLoading: boolean;
  onOpenCompany: (id: string) => void;
  onOpenWorker: () => void;
  onOpenTickets: () => void;
  onOpenErrors: () => void;
  onOpenFilePreview: (file: { url: string; name: string }) => void;
}

export function ManagementOverview({
  overview,
  overviewLoading,
  onOpenCompany,
  onOpenWorker,
  onOpenTickets,
  onOpenErrors,
  onOpenFilePreview,
}: ManagementOverviewProps) {
  const [bentoLlmPeriod, setBentoLlmPeriod] = useState<'7d' | '30d'>('7d');

  const { data: bentoLlmCostsData, isLoading: bentoLlmCostsLoading } = useQuery({
    queryKey: ['llm-costs-trend', bentoLlmPeriod],
    queryFn: () => fetchManagementData('llm-costs', { period: bentoLlmPeriod }),
    staleTime: 30_000,
  });

  const { data: bentoLlmCostsAllTime } = useQuery({
    queryKey: ['llm-costs-all-time'],
    queryFn: () => fetchManagementData('llm-costs', { period: 'all' }),
    staleTime: 60_000,
  });

  const { data: workerStatusData, isLoading: workerStatusLoading } = useQuery({
    queryKey: ['worker-status', '24h'],
    queryFn: () => fetchManagementData('worker-status', { period: '24h' }),
    refetchInterval: 5_000,
    staleTime: 2_500,
  });

  const { data: ticketsData, isLoading: ticketsLoading } = useTickets('all');
  const ticketsOverview = useMemo(() => {
    if (!ticketsData) return { newUnassigned: 0, resolved: 0 };
    return {
      newUnassigned: ticketsData.filter((t: any) => t.status === 'created' && !t.assigned_to).length,
      resolved: ticketsData.filter((t: any) => t.status === 'resolved').length,
    };
  }, [ticketsData]);

  const latestCriticalError = workerStatusData?.error_jobs?.[0] || null;

  const { data: recentFilesData, isLoading: recentFilesLoading } = useQuery<FilesData>({
    queryKey: ['management-files-latest'],
    queryFn: () => fetchManagementData('files', {
      page: '0',
      pageSize: '10',
      sortBy: 'updated_at',
      sortDir: 'desc',
      search: '',
      companyId: '',
      userId: '',
      fileType: '',
      status: '',
      dateFrom: '',
      dateTo: '',
    }),
    staleTime: 10_000,
  });

  const recentFilesList = useMemo(() => {
    const rawFiles = recentFilesData?.files || [];
    
    const parentIdsToExclude = new Set<string>();
    for (const f of rawFiles) {
      if (f.fallback_from_invoice_upload_id) {
        parentIdsToExclude.add(f.fallback_from_invoice_upload_id);
      }
      if (f.fallback_from_transaction_upload_id) {
        parentIdsToExclude.add(f.fallback_from_transaction_upload_id);
      }
    }

    const filtered = rawFiles.filter((f: any) => !parentIdsToExclude.has(f.id));
    
    const uniqueFiles: any[] = [];
    const seenNames = new Set<string>();
    for (const f of filtered) {
      if (!seenNames.has(f.file_name)) {
        seenNames.add(f.file_name);
        uniqueFiles.push(f);
      }
    }

    return uniqueFiles.slice(0, 4);
  }, [recentFilesData]);

  const isOverviewLoading = overviewLoading || bentoLlmCostsLoading || workerStatusLoading || recentFilesLoading || ticketsLoading;

  if (isOverviewLoading) {
    return <OverviewSkeleton />;
  }

  return (
    <div className="space-y-6 page-animate">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Felhasználók"
          value={overview?.usersCount ?? 0} loading={overviewLoading} />
        <StatCard icon={Building2} label="Regisztrált cégek"
          value={overview?.companiesCount ?? 0} loading={overviewLoading} />
        <StatCard icon={Coins} label="Havi összköltség"
          value={overview ? `$${overview.llmOverview.totalMonthlyCostUsd.toFixed(4)}` : '$0'}
          loading={overviewLoading}
          sub={overview ? `In: ${(overview.llmOverview.totalMonthlyInputTokens / 1000).toFixed(1)}k · Out: ${(overview.llmOverview.totalMonthlyOutputTokens / 1000).toFixed(1)}k token` : undefined} />
        {overviewLoading ? (
          <StatCard icon={Trophy} label="Legdrágább cég" value="..." loading sub="..." />
        ) : overview?.llmOverview.mostExpensiveCompany ? (
          <Card
            className="cursor-pointer hover:bg-accent/30 transition-colors duration-150"
            onClick={() => onOpenCompany(overview.llmOverview.mostExpensiveCompany!.id)}
            role="button" tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter') onOpenCompany(overview.llmOverview.mostExpensiveCompany!.id); }}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-warning/10 border border-warning/20 shrink-0">
                <Trophy className="h-6 w-6 text-warning" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-foreground truncate">{overview.llmOverview.mostExpensiveCompany.name}</p>
                <p className="text-xs text-muted-foreground">Legdrágább cég</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5 tabular-nums">
                  Össz: ${overview.llmOverview.mostExpensiveCompany.totalCostUsd.toFixed(4)} · Havi: ${overview.llmOverview.mostExpensiveCompany.monthlyCostUsd.toFixed(4)}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <StatCard icon={Trophy} label="Legdrágább cég" value="—" sub="Nincs LLM költség" />
        )}
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bento Col 1: LLM Pénzügyi Áttekintés */}
        <Card className="flex flex-col justify-between p-5 space-y-4 h-full">
          {(() => {
            const calculateProportionalTokenCosts = (inputTokens: number, outputTokens: number, totalCost: number) => {
              if (totalCost <= 0) return { inputCost: 0, outputCost: 0 };
              const r = 4.0;
              const inputWeight = inputTokens;
              const outputWeight = outputTokens * r;
              const totalWeight = inputWeight + outputWeight;
              if (totalWeight <= 0) return { inputCost: 0, outputCost: 0 };
              
              const inputCost = totalCost * (inputWeight / totalWeight);
              const outputCost = totalCost * (outputWeight / totalWeight);
              return { inputCost, outputCost };
            };

            const monthlyTokenCosts = calculateProportionalTokenCosts(
              overview?.llmOverview.totalMonthlyInputTokens || 0,
              overview?.llmOverview.totalMonthlyOutputTokens || 0,
              overview?.llmOverview.totalMonthlyCostUsd || 0
            );

            const allTimeTokenCosts = calculateProportionalTokenCosts(
              bentoLlmCostsAllTime?.kpi?.total_input_tokens || 0,
              bentoLlmCostsAllTime?.kpi?.total_output_tokens || 0,
              bentoLlmCostsAllTime?.kpi?.total_cost || 0
            );

            const rawModels = bentoLlmCostsData?.by_model || [];

            return (
              <>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Coins className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                    <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wide">LLM Pénzügyi Áttekintés</span>
                  </div>
                  <div className="space-y-4 mt-2">
                    <div>
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Havi összköltség</h3>
                      <span className="text-3xl font-extrabold text-foreground block mt-0.5 tracking-tight">
                        {overview ? `$${overview.llmOverview.totalMonthlyCostUsd.toFixed(4)}` : '$0.0000'}
                      </span>
                      <div className="mt-2 p-2.5 bg-zinc-100/60 dark:bg-zinc-900/60 rounded-lg border border-zinc-200 dark:border-zinc-800/50 space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Input token:</span>
                          <span className="font-medium text-foreground">
                            {overview ? `${(overview.llmOverview.totalMonthlyInputTokens / 1000).toFixed(1)}k ($${monthlyTokenCosts.inputCost.toFixed(4)})` : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Output token:</span>
                          <span className="font-medium text-foreground">
                            {overview ? `${(overview.llmOverview.totalMonthlyOutputTokens / 1000).toFixed(1)}k ($${monthlyTokenCosts.outputCost.toFixed(4)})` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-200 dark:border-zinc-900/60">
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Összes költség</h3>
                      <span className="text-xl font-extrabold text-teal-600 dark:text-teal-400 block mt-0.5 tracking-tight">
                        {bentoLlmCostsAllTime ? `$${(bentoLlmCostsAllTime.kpi?.total_cost || 0).toFixed(4)}` : '$0.0000'}
                      </span>
                      <div className="mt-2 p-2.5 bg-zinc-100/40 dark:bg-zinc-900/40 rounded-lg border border-zinc-200/60 dark:border-zinc-800/30 space-y-1 text-xs text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Input token:</span>
                          <span className="font-medium text-foreground">
                            {bentoLlmCostsAllTime ? `${(bentoLlmCostsAllTime.kpi.total_input_tokens / 1000).toFixed(1)}k ($${allTimeTokenCosts.inputCost.toFixed(4)})` : '—'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Output token:</span>
                          <span className="font-medium text-foreground">
                            {bentoLlmCostsAllTime ? `${(bentoLlmCostsAllTime.kpi.total_output_tokens / 1000).toFixed(1)}k ($${allTimeTokenCosts.outputCost.toFixed(4)})` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-900 space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground block">Költség Megoszlás (Modellek)</span>
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {(() => {
                      if (rawModels.length === 0) {
                        return <div className="text-center text-muted-foreground/60 text-[10px] py-2">Nincs modell adat</div>;
                      }

                      const aggregated: Record<string, { name: string; cost: number; colorClass: string }> = {};
                      let totalCost = 0;

                      for (const m of rawModels) {
                        const low = (m.model || '').toLowerCase();
                        let normName = m.model || '';
                        let colorClass = 'bg-zinc-500';

                        if (low.includes('deepseek')) {
                          if (low.includes('flash')) {
                            normName = 'deepseek-v4-flash';
                            colorClass = 'bg-teal-500';
                          } else {
                            normName = 'deepseek-chat';
                            colorClass = 'bg-teal-500/80';
                          }
                        } else if (low.includes('gpt-4') || low.includes('openai')) {
                          normName = 'gpt-4o';
                          colorClass = 'bg-amber-500';
                        } else if (low.includes('gemini') || low.includes('google')) {
                          normName = 'gemini-1.5-flash';
                          colorClass = 'bg-purple-500';
                        } else {
                          normName = m.model?.split('/')?.pop() || m.model;
                        }

                        const cost = Number(m.cost) || 0;
                        totalCost += cost;

                        if (!aggregated[normName]) {
                          aggregated[normName] = { name: normName, cost: 0, colorClass };
                        }
                        aggregated[normName].cost += cost;
                      }

                      const modelList = Object.values(aggregated)
                        .sort((a, b) => b.cost - a.cost)
                        .map((item) => ({
                          ...item,
                          pct: totalCost > 0 ? ((item.cost / totalCost) * 100).toFixed(1) : '0.0',
                        }));

                      return modelList.map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-sm ${m.colorClass}`}></span>
                            {m.name}
                          </span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">{m.pct}%</span>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </>
            );
          })()}
        </Card>

        {/* Bento Col 2: Worker Status & Feldolgozási hibák */}
        <div className="flex flex-col space-y-4 h-full">
          <Card className="p-5">
            {(() => {
              const isHealthy = workerStatusData?.containers?.length > 0 
                ? workerStatusData.containers.every((c: any) => c.is_healthy) 
                : true;
              const healthyCount = workerStatusData?.summary?.healthy_containers ?? 0;
              const totalCount = workerStatusData?.summary?.total_containers ?? 0;

              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-teal-400" />
                      <h4 className="text-sm font-semibold">Worker Status</h4>
                    </div>
                    <span className={`text-xs font-bold flex items-center gap-2 ${isHealthy ? 'text-emerald-400' : 'text-red-400'}`}>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                          isHealthy ? 'bg-emerald-400' : 'bg-red-400'
                        }`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                          isHealthy ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                        }`}></span>
                      </span>
                      {healthyCount}/{totalCount} Konténer fut
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-zinc-100/60 dark:bg-zinc-900/60 rounded border border-zinc-200 dark:border-zinc-800/40">
                        <span className="text-[9px] text-muted-foreground block">Státusz</span>
                        <span className={`font-bold mt-0.5 block ${isHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                          {isHealthy ? 'Fut (Egészséges)' : 'Hiba (Unhealthy)'}
                        </span>
                      </div>
                      <div className="p-2.5 bg-zinc-100/60 dark:bg-zinc-900/60 rounded border border-zinc-200 dark:border-zinc-800/40">
                        <span className="text-[9px] text-muted-foreground block">Feldolgozás alatt</span>
                        <span className="font-bold text-teal-600 dark:text-teal-400 mt-0.5 block">
                          {workerStatusData?.queues?.reduce((acc: number, q: any) => acc + (q.visible_messages || 0), 0) ?? 0} elem
                        </span>
                      </div>
                    </div>

                    {/* CPU / RAM bars */}
                    <div className="space-y-2 pt-1">
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>CPU Terheltség</span>
                          <span className="font-mono text-zinc-800 dark:text-zinc-200">
                            {(workerStatusData?.containers?.reduce((acc: number, c: any) => acc + (c.cpu_usage || 0), 0) / (workerStatusData?.containers?.length || 1)).toFixed(0)}%
                          </span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded overflow-hidden">
                          <div
                            className="bg-teal-500 h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(10, (workerStatusData?.containers?.reduce((acc: number, c: any) => acc + (c.cpu_usage || 0), 0) / (workerStatusData?.containers?.length || 1))))}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>RAM Használat</span>
                          <span className="font-mono text-zinc-800 dark:text-zinc-200">
                            {((workerStatusData?.containers?.reduce((acc: number, c: any) => acc + (c.ram_usage || 0), 0) / (workerStatusData?.containers?.length || 1)) * 0.04).toFixed(1)} GB / 4.0 GB
                          </span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded overflow-hidden">
                          <div
                            className="bg-teal-500 h-full transition-all duration-300"
                            style={{ width: `${Math.min(100, Math.max(10, (workerStatusData?.containers?.reduce((acc: number, c: any) => acc + (c.ram_usage || 0), 0) / (workerStatusData?.containers?.length || 1))))}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>

                    {/* Processing Errors */}
                    <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-900 space-y-2">
                      <div className="flex items-center justify-between">
                        <span 
                          onClick={onOpenWorker}
                          className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wider flex items-center gap-1 cursor-pointer hover:text-red-400 dark:hover:text-red-300 transition-colors"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Feldolgozási hibák (24h)
                        </span>
                        <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 dark:text-red-400 text-[9px] font-bold rounded">
                          {workerStatusData?.summary?.total_errors_24h ?? 0} hiba
                        </span>
                      </div>
                      {latestCriticalError ? (
                        <div 
                          onClick={onOpenWorker}
                          className="p-2 bg-red-500/5 hover:bg-red-500/10 dark:hover:bg-red-500/15 rounded border border-red-500/15 dark:border-red-500/10 flex justify-between items-center cursor-pointer transition-colors duration-150"
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block truncate">
                              [{latestCriticalError.pipeline}] {latestCriticalError.error_message || 'Feldolgozási hiba'}
                            </span>
                            <span className="text-[9px] text-zinc-500 dark:text-zinc-400 block truncate mt-0.5">
                              {latestCriticalError.file_name} · {latestCriticalError.company_name || 'Ismeretlen cég'} · {new Date(latestCriticalError.created_at).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <span className="text-[9px] text-red-500 dark:text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded font-bold border border-red-500/20 shrink-0">Kritikus</span>
                        </div>
                      ) : (
                        <div className="p-2 bg-emerald-500/5 rounded border border-emerald-500/10 text-center py-3">
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Nincs aktív feldolgozási hiba</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </Card>

          {/* LLM Costs Chart Panel */}
          {(() => {
            const chartData = (bentoLlmCostsData?.daily_trend || []).length > 0
              ? bentoLlmPeriod === '7d'
                ? (bentoLlmCostsData.daily_trend).slice(-7).map((d: any) => ({
                    key: d.date,
                    cost: d.cost,
                    label: d.date.slice(5),
                  }))
                : (() => {
                    const last28 = (bentoLlmCostsData.daily_trend).slice(-28);
                    const weeks = [];
                    for (let i = 0; i < last28.length; i += 7) {
                      const chunk = last28.slice(i, i + 7);
                      if (chunk.length === 0) continue;
                      const costSum = chunk.reduce((sum: number, day: any) => sum + (day.cost || 0), 0);
                      const start = chunk[0].date.slice(5);
                      const end = chunk[chunk.length - 1].date.slice(5);
                      weeks.push({
                        key: `week_${i}`,
                        cost: costSum,
                        label: `${start}–${end}`,
                      });
                    }
                    return weeks;
                  })()
              : [];

            const maxBentoCost = chartData.length > 0 ? Math.max(...chartData.map((x: any) => x.cost), 0.001) : 0.001;

            return (
              <Card className="p-5 flex-1 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold">
                    {bentoLlmPeriod === '7d' ? 'LLM Napi Költségek (7 nap)' : 'LLM Heti Költségek (4 hét)'}
                  </span>
                  <div className="flex gap-1.5 text-[9px] bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded border border-zinc-200 dark:border-zinc-800">
                    <span 
                      onClick={() => setBentoLlmPeriod('7d')}
                      className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                        bentoLlmPeriod === '7d' ? 'bg-white dark:bg-zinc-800 text-teal-600 dark:text-teal-400 font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Napi
                    </span>
                    <span 
                      onClick={() => setBentoLlmPeriod('30d')}
                      className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                        bentoLlmPeriod === '30d' ? 'bg-white dark:bg-zinc-800 text-teal-600 dark:text-teal-400 font-bold shadow-sm' : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Heti
                    </span>
                  </div>
                </div>
                <div className="h-20 w-full flex items-end justify-between gap-4 pt-5 px-2">
                  {chartData.length > 0 ? (
                    chartData.map((d: any, i: number, arr: any[]) => (
                      <div
                        key={d.key}
                        className="flex-1 rounded-t-sm min-h-[2px] relative group cursor-default"
                        style={{
                          height: `${Math.max((d.cost / maxBentoCost) * 100, 4)}%`,
                          background: i === arr.length - 1
                            ? 'linear-gradient(180deg, #14b8a6, #14b8a650)'
                            : 'linear-gradient(180deg, #6366f1, #6366f150)',
                        }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 font-mono text-[8.5px] text-muted-foreground text-center whitespace-nowrap">
                          <span className="font-bold text-foreground">${d.cost.toFixed(4)}</span>
                          <span className="block text-[7px] text-muted-foreground/50 mt-0.5">{d.label}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-muted-foreground text-xs py-6 w-full">Nincs elérhető trend adat</div>
                  )}
                </div>
              </Card>
            );
          })()}
        </div>

        {/* Bento Col 3: Tickets & Files */}
        <div className="flex flex-col space-y-3 h-full">
          {/* Tickets card */}
          <Card className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span 
                onClick={onOpenTickets}
                className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:text-teal-500 dark:hover:text-teal-300 transition-colors"
              >
                <TicketCheck className="h-3.5 w-3.5" />
                Hibajegyek
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div 
                onClick={onOpenTickets}
                className="py-1.5 px-3 bg-zinc-100/60 dark:bg-zinc-900/60 rounded border border-zinc-200 dark:border-zinc-800/40 text-center cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors"
              >
                <span className="text-[9px] text-zinc-500 block mb-1">Új (felelős nélkül)</span>
                <span className="text-xl font-black text-teal-600 dark:text-teal-400">{ticketsOverview.newUnassigned}</span>
              </div>
              <div 
                onClick={onOpenTickets}
                className="py-1.5 px-3 bg-zinc-100/60 dark:bg-zinc-900/60 rounded border border-zinc-200 dark:border-zinc-800/40 text-center cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors"
              >
                <span className="text-[9px] text-zinc-500 block mb-1">Megoldott</span>
                <span className="text-xl font-bold text-zinc-700 dark:text-zinc-300">{ticketsOverview.resolved}</span>
              </div>
            </div>
          </Card>

          {/* Applikáció hibák card */}
          <Card className="p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span 
                onClick={onOpenErrors}
                className="text-xs font-bold text-red-500 dark:text-red-400 uppercase tracking-wider flex items-center gap-1.5 cursor-pointer hover:text-red-600 dark:hover:text-red-300 transition-colors"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Applikáció hibák
              </span>
            </div>
            <div className="space-y-2">
              <div 
                onClick={onOpenErrors}
                className="py-1.5 px-2.5 bg-zinc-100/60 dark:bg-zinc-900/60 rounded border border-zinc-200 dark:border-zinc-800/40 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors flex items-center justify-between"
              >
                <div>
                  <span className="text-[9px] text-zinc-500 block mb-0.5 font-bold">Rendszer & feltöltési naplók</span>
                  <span className="text-[10px] text-muted-foreground block">Kattints a részletes hibanaplóhoz</span>
                </div>
                <span className={`text-xl font-black px-2 py-0.5 rounded flex items-center justify-center min-w-[36px] ${
                  (overview?.totalErrors ?? 0) > 0 
                    ? 'text-red-500 dark:text-red-400 bg-red-500/10 animate-pulse border border-red-500/20' 
                    : 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                }`}>
                  {overview?.totalErrors ?? 0}
                </span>
              </div>

              {overview && (overview.mostErrorCompany || overview.mostErrorUser) && (
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  {overview.mostErrorCompany ? (
                    <div className="p-1.5 bg-zinc-100/40 dark:bg-zinc-900/40 rounded border border-zinc-200/60 dark:border-zinc-800/20">
                      <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wide">Legtöbb hiba (Cég)</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 block truncate mt-0.5" title={overview.mostErrorCompany.name}>
                        {overview.mostErrorCompany.name}
                      </span>
                      <span className="text-[9px] text-red-500 dark:text-red-400 font-bold block mt-0.5">
                        {overview.mostErrorCompany.errorCount} hiba
                      </span>
                    </div>
                  ) : (
                    <div className="p-1.5 bg-zinc-100/20 dark:bg-zinc-900/20 rounded border border-dashed border-zinc-200 dark:border-zinc-800/30 flex items-center justify-center text-zinc-500 text-[8px] uppercase">
                      Nincs cég hiba
                    </div>
                  )}

                  {overview.mostErrorUser ? (
                    <div className="p-1.5 bg-zinc-100/40 dark:bg-zinc-900/40 rounded border border-zinc-200/60 dark:border-zinc-800/20">
                      <span className="text-[8px] text-zinc-500 block uppercase font-bold tracking-wide">Legtöbb hiba (Felh.)</span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200 block truncate mt-0.5" title={`${overview.mostErrorUser.name} (${overview.mostErrorUser.email})`}>
                        {overview.mostErrorUser.name}
                      </span>
                      <span className="text-[9px] text-red-500 dark:text-red-400 font-bold block mt-0.5">
                        {overview.mostErrorUser.errorCount} hiba
                      </span>
                    </div>
                  ) : (
                    <div className="p-1.5 bg-zinc-100/20 dark:bg-zinc-900/20 rounded border border-dashed border-zinc-200 dark:border-zinc-800/30 flex items-center justify-center text-zinc-500 text-[8px] uppercase">
                      Nincs felhasználó hiba
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Recent Files card */}
          <Card className="p-3.5 space-y-2 flex-1 flex flex-col">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" />
                Utolsó fájlok
              </span>
              <span className="text-[10px] text-muted-foreground">Frissítve</span>
            </div>
            <div className="space-y-1 text-xs flex-1 flex flex-col justify-start">
              {recentFilesList.length > 0 ? (
                recentFilesList.map((f: any) => (
                  <button
                    key={f.id}
                    disabled={!f.file_url}
                    onClick={() => {
                      if (f.file_url) {
                        onOpenFilePreview({ url: f.file_url, name: f.file_name });
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between py-1.5 px-2 bg-zinc-100/50 dark:bg-zinc-900/50 rounded transition-colors text-left",
                      f.file_url ? "hover:bg-zinc-200/85 dark:hover:bg-zinc-900/85 cursor-pointer" : "cursor-default"
                    )}
                  >
                    <span
                      className={cn(
                        "flex-1 mr-2 truncate text-xs transition-colors",
                        f.file_url
                          ? "text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium"
                          : "text-zinc-700 dark:text-zinc-300"
                      )}
                      title={f.file_name}
                    >
                      {f.file_name}
                    </span>
                    <span className={cn(
                      "text-[9px] font-bold shrink-0",
                      (() => {
                        const cat = normalizeStatus(f.processing_status, f.error_message);
                        if (cat === "success") return "text-emerald-600 dark:text-emerald-400";
                        if (cat === "error") return "text-red-500 dark:text-red-400";
                        if (cat === "redirected") return "text-blue-500 dark:text-blue-400";
                        if (cat === "dismissed") return "text-zinc-500 dark:text-zinc-400";
                        return "text-teal-600 dark:text-teal-400 animate-pulse";
                      })()
                    )}>
                      {(() => {
                        const cat = normalizeStatus(f.processing_status, f.error_message);
                        if (cat === "success") return "Kész";
                        if (cat === "error") return "Hiba";
                        if (cat === "redirected") return "Átirányítva";
                        if (cat === "dismissed") return "Mellőzve";
                        return "Feldolgozás";
                      })()}
                    </span>
                  </button>
                ))
              ) : (
                <div className="text-center text-muted-foreground text-xs py-4">Nincs nemrég feltöltött fájl</div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
