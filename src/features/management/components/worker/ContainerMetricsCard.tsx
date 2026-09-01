import React from 'react';
import { Server } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatUptime, formatDuration } from '../llm/LLMCostPanel';

interface ContainerMetricsCardProps {
  containerData: {
    container_name: string;
    is_healthy: boolean;
    version?: string;
    uptime_seconds: number;
    host_ip?: string;
    jobs_24h: number;
    avg_duration_ms: number;
    total_cost_24h: number;
    cpu_usage?: number;
    ram_usage?: number;
  };
}

export function ContainerMetricsCard({ containerData }: ContainerMetricsCardProps) {
  if (!containerData) return null;

  return (
    <Card className="p-3 bg-card/60 border-border/40">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${containerData.is_healthy ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
          <Server className={`h-5 w-5 ${containerData.is_healthy ? 'text-emerald-500' : 'text-red-500'}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{containerData.container_name}</span>
            <Badge variant={containerData.is_healthy ? 'secondary' : 'destructive'} className="text-[10px] px-1.5 py-0">
              {containerData.is_healthy ? 'Healthy' : 'Unhealthy'}
            </Badge>
            {containerData.version && (
              <span className="text-[10px] text-muted-foreground font-mono">{containerData.version}</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground">
            <span>Uptime: {formatUptime(containerData.uptime_seconds)}</span>
            {containerData.host_ip && <span>IP: {containerData.host_ip}</span>}
            <span>Jobs (24h): {containerData.jobs_24h}</span>
            <span>Avg: {formatDuration(containerData.avg_duration_ms)}</span>
            <span>LLM: ${containerData.total_cost_24h}</span>
          </div>
          {containerData.cpu_usage !== undefined && containerData.ram_usage !== undefined && (
            <div className="mt-3 grid grid-cols-2 gap-4 border-t border-border/10 pt-3">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground font-medium">CPU terheltség</span>
                  <span className="font-semibold text-foreground font-mono">{containerData.cpu_usage.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      containerData.cpu_usage > 85 ? 'bg-red-500' : containerData.cpu_usage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, containerData.cpu_usage))}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground font-medium">RAM használat</span>
                  <span className="font-semibold text-foreground font-mono">{containerData.ram_usage.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      containerData.ram_usage > 85 ? 'bg-red-500' : containerData.ram_usage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, containerData.ram_usage))}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
