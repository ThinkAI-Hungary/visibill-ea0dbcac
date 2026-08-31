import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '../common/ManagementSkeleton';
import { fetchManagementData } from '../../api/managementApi';
import { DollarSign, CheckCircle2, TrendingUp, Zap, PieChart, Server, Trophy, BarChart3, Cpu } from 'lucide-react';

export function MiniSparkline({ data, color = 'hsl(var(--primary))' }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const w = 100;
  const h = 20;
  const gap = 2;
  const barW = Math.max(2, (w - (data.length - 1) * gap) / data.length);
  return (
    <svg width={w} height={h} className="inline-block align-middle">
      {data.map((v, i) => {
        const barH = Math.max(1, (v / max) * h);
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={h - barH}
            width={barW}
            height={barH}
            rx={1}
            fill={color}
            opacity={0.35 + (i / data.length) * 0.6}
          />
        );
      })}
    </svg>
  );
}

export function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return `${Math.floor(sec / 86400)}d ${Math.floor((sec % 86400) / 3600)}h`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export const PIE_COLORS = ['#a78bfa', '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#6b7280'];
export const PROJECT_COLORS: Record<string, string> = { PROD: '#10b981', VSWEB: '#3b82f6', THINKERMAN: '#f59e0b' };

export function CSSPieChart({ data, centerLabel, centerSub, size = 140 }: {
  data: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerSub: string;
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="flex items-center justify-center text-muted-foreground text-xs" style={{ width: size, height: size }}>Nincs adat</div>;
  let cumPct = 0;
  const stops = data.map(d => {
    const start = cumPct;
    cumPct += (d.value / total) * 100;
    return `${d.color} ${start}% ${cumPct}%`;
  }).join(', ');

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <div className="w-full h-full rounded-full" style={{ background: `conic-gradient(${stops})` }} />
      <div className="absolute rounded-full bg-background" style={{ inset: size * 0.2 }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <span className="text-sm font-bold">{centerLabel}</span>
        <span className="text-[9px] text-muted-foreground">{centerSub}</span>
      </div>
    </div>
  );
}

export function LLMCostPanel() {
  const [period, setPeriod] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['llm-costs', period],
    queryFn: () => fetchManagementData('llm-costs', { period }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        {/* Period selector skeleton */}
        <div className="flex justify-end">
          <Skeleton className="h-8 w-64 rounded-md" />
        </div>
        {/* KPI cards skeleton */}
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/40">
              <CardContent className="p-3.5 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-2 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Pie charts + Top companies row skeleton */}
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="border-border/40">
              <CardContent className="p-4 flex flex-col items-center gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-28 w-28 rounded-full" />
                <div className="space-y-1.5 w-full">
                  {Array.from({ length: 3 }).map((_, j) => (
                    <Skeleton key={j} className="h-3 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
          <Card className="border-border/40">
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-4 w-32" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        {/* Daily trend skeleton */}
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-36" />
            <div className="flex items-end gap-1 h-24">
              {Array.from({ length: 14 }).map((_, i) => (
                <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${20 + Math.random() * 60}%` }} />
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Model table skeleton */}
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-4 w-40" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-md" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { kpi = {}, by_pipeline = [], by_project = [], top_companies = [], daily_trend = [], by_model = [] } = data;
  const maxDailyCost = Math.max(...daily_trend.map((d: any) => d.cost), 0.001);

  const periodLabel: Record<string, string> = { 'all': 'Összesen', '24h': '24 óra', '7d': '7 nap', '30d': '30 nap', '90d': '90 nap' };

  const formatTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  };

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex justify-end">
        <div className="flex gap-0.5 bg-muted/30 p-0.5 rounded-md">
          {['all', '24h', '7d', '30d', '90d'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                period === p ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {periodLabel[p] || p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Összes LLM költség', value: `$${kpi.total_cost?.toFixed(2) || '0'}`, icon: DollarSign, color: 'text-purple-400', sub: '3 projekt összesen' },
          { label: 'Feldolgozott jobok', value: String(kpi.total_jobs || 0), icon: CheckCircle2, color: 'text-emerald-500', sub: 'összes pipeline' },
          { label: 'Átlag költség/job', value: `$${kpi.avg_cost_per_job?.toFixed(4) || '0'}`, icon: TrendingUp, color: 'text-blue-400', sub: 'összes pipeline átlag' },
          { label: 'Összes token', value: formatTokens(kpi.total_tokens || 0), icon: Zap, color: 'text-amber-400', sub: 'input + output' },
        ].map((kpiItem, i) => (
          <Card key={i} className="border-border/40">
            <CardContent className="p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
                <kpiItem.icon className={`h-3.5 w-3.5 ${kpiItem.color}`} />
                {kpiItem.label}
              </div>
              <div className={`text-xl font-bold tracking-tight ${kpiItem.color}`}>{kpiItem.value}</div>
              <div className="text-[10px] text-muted-foreground/60 mt-0.5">{kpiItem.sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pie Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cost by Pipeline */}
        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-purple-400" />
              Költség pipeline szerint
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-6">
              <CSSPieChart
                data={by_pipeline.map((p: any, i: number) => ({ label: p.pipeline, value: p.cost, color: PIE_COLORS[i % PIE_COLORS.length] }))}
                centerLabel={`$${kpi.total_cost?.toFixed(2) || '0'}`}
                centerSub={periodLabel[period] || '7 nap'}
              />
              <div className="flex flex-col gap-1.5 flex-1">
                {by_pipeline.map((p: any, i: number) => (
                  <div key={p.pipeline} className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-muted-foreground flex-1 truncate">{p.pipeline}</span>
                    <span className="font-semibold tabular-nums">${p.cost}</span>
                    <span className="text-muted-foreground/50 text-[10px] w-8 text-right">{p.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cost by Project */}
        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-emerald-500" />
              Költség projekt szerint
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-center gap-6">
              <CSSPieChart
                data={by_project.map((p: any) => ({ label: p.project, value: p.cost, color: PROJECT_COLORS[p.project] || '#6b7280' }))}
                centerLabel="3 projekt"
                centerSub={periodLabel[period] || '7 nap'}
              />
              <div className="flex flex-col gap-1.5 flex-1">
                {by_project.map((p: any) => (
                  <div key={p.project} className="flex items-center gap-2 text-[11px]">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: PROJECT_COLORS[p.project] || '#6b7280' }} />
                    <span className="text-muted-foreground flex-1">{p.project}</span>
                    <span className="font-semibold tabular-nums">${p.cost}</span>
                    <span className="text-muted-foreground/50 text-[10px] w-8 text-right">{p.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Companies + Daily Trend */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top 3 Companies */}
        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              Top 3 legdrágább cég
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {top_companies.map((c: any, i: number) => {
              const maxCost = top_companies[0]?.cost || 1;
              const rankColors = ['bg-amber-500/15 text-amber-500', 'bg-slate-400/15 text-slate-400', 'bg-orange-700/15 text-orange-600'];
              return (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/20 last:border-0">
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${rankColors[i] || rankColors[2]}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground/60">{c.jobs} job · {c.project}</div>
                    <div className="mt-1.5 h-0.5 bg-muted/30 rounded-full">
                      <div className="h-full rounded-full bg-gradient-to-r from-purple-400 to-purple-600" style={{ width: `${(c.cost / maxCost) * 100}%` }} />
                    </div>
                  </div>
                  <div className="text-sm font-bold text-purple-400 tabular-nums">${c.cost}</div>
                </div>
              );
            })}
            {top_companies.length === 0 && (
              <p className="text-xs text-muted-foreground/60 py-4 text-center">Nincs adat</p>
            )}
          </CardContent>
        </Card>

        {/* Daily Cost Trend */}
        <Card className="border-border/40">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-400" />
              Napi költség trend
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex items-end gap-[2px] h-20">
              {daily_trend.slice(-14).map((d: any, i: number, arr: any[]) => (
                <div
                  key={d.date}
                  className="flex-1 rounded-t-sm min-h-[2px] relative group cursor-default"
                  style={{
                    height: `${Math.max((d.cost / maxDailyCost) * 100, 2)}%`,
                    background: i === arr.length - 1
                      ? 'linear-gradient(180deg, #10b981, #10b98150)'
                      : 'linear-gradient(180deg, #a78bfa, #7c3aed50)',
                  }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-popover border border-border px-1.5 py-0.5 rounded text-[9px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none">
                    ${d.cost} · {d.date.slice(5)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-[2px] mt-1">
              {daily_trend.slice(-14).map((d: any, i: number, arr: any[]) => (
                <div key={d.date} className="flex-1 text-center text-[8px] text-muted-foreground/40">
                  {i === 0 || i === arr.length - 1 || i === Math.floor(arr.length / 2) ? d.date.slice(5) : ''}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Usage Table */}
      <Card className="border-border/40">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-[13px] font-semibold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-purple-400" />
            Modell használat
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left px-4 py-1.5 font-medium text-muted-foreground">Modell</th>
                <th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Pipeline</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Jobok</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Átlag token</th>
                <th className="text-right px-3 py-1.5 font-medium text-muted-foreground">Költség</th>
                <th className="text-right px-4 py-1.5 font-medium text-muted-foreground">Arány</th>
              </tr>
            </thead>
            <tbody>
              {by_model.map((m: any, i: number) => (
                <tr key={i} className="border-b border-border/10 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2 font-medium text-purple-400">{m.model?.split('/')?.pop() || m.model}</td>
                  <td className="px-3 py-2">{m.pipeline}</td>
                  <td className="text-right px-3 py-2 font-mono tabular-nums">{m.jobs.toLocaleString()}</td>
                  <td className="text-right px-3 py-2 font-mono tabular-nums text-muted-foreground">{m.avg_tokens.toLocaleString()}</td>
                  <td className="text-right px-3 py-2 font-mono tabular-nums text-purple-400 font-semibold">${m.cost}</td>
                  <td className="text-right px-4 py-2 text-muted-foreground/60">{m.pct}%</td>
                </tr>
              ))}
              {by_model.length === 0 && (
                <tr><td colSpan={6} className="text-center py-4 text-muted-foreground/60">Nincs modell adat</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
