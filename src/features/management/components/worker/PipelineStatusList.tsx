import React from 'react';
import { Activity } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MiniSparkline, formatDuration } from '../llm/LLMCostPanel';

interface PipelineData {
  pipeline: string;
  project?: string;
  jobs_24h: number;
  avg_duration_ms: number;
  total_cost_usd: number;
  error_count_24h: number;
  daily_counts?: number[];
}

interface PipelineStatusListProps {
  pipelines: PipelineData[];
  periodLabel: string;
}

export function PipelineStatusList({ pipelines, periodLabel }: PipelineStatusListProps) {
  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Pipeline teljesítmény ({periodLabel})
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30 text-muted-foreground">
              <th className="text-left px-4 py-1.5 font-medium">Pipeline</th>
              <th className="text-right px-3 py-1.5 font-medium">Kész</th>
              <th className="text-right px-3 py-1.5 font-medium">Avg idő</th>
              <th className="text-right px-3 py-1.5 font-medium">LLM $</th>
              <th className="text-right px-3 py-1.5 font-medium">Hibák</th>
              <th className="text-center px-3 py-1.5 font-medium">7 nap</th>
            </tr>
          </thead>
          <tbody>
            {pipelines.map((p) => (
              <tr key={p.pipeline} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2 font-medium">{p.pipeline}</td>
                <td className="text-right px-3 py-2 font-mono">{p.jobs_24h}</td>
                <td className="text-right px-3 py-2 font-mono text-muted-foreground">{formatDuration(p.avg_duration_ms)}</td>
                <td className="text-right px-3 py-2 font-mono text-purple-500">${p.total_cost_usd}</td>
                <td className="text-right px-3 py-2">
                  {p.error_count_24h > 0 ? (
                    <span className="text-red-500 font-mono">{p.error_count_24h}</span>
                  ) : (
                    <span className="text-muted-foreground/40">0</span>
                  )}
                </td>
                <td className="text-center px-3 py-2">
                  <MiniSparkline data={p.daily_counts || []} />
                </td>
              </tr>
            ))}
            {pipelines.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-4 text-muted-foreground">
                  Nincs pipeline adat az utolsó 24 órában
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
