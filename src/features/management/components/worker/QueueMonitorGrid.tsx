import React from 'react';
import { ClipboardList, Inbox, Mail, RefreshCw, Upload, FileText, X, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface QueueItem {
  msg_id: string | number;
  file_name?: string;
  company_name?: string;
  enqueued_at: string;
  source: string;
  document_category?: string;
}

interface QueueData {
  queue_name: string;
  project: string;
  queue_length: number;
  pending_items?: QueueItem[];
}

interface QueueMonitorGridProps {
  queues: QueueData[];
  selectedQueue: string | null;
  showAllQueues: boolean;
  dismissedQueues: Set<string>;
  onCloseAll: () => void;
  onCloseSelected: () => void;
  onDismissQueue?: (queueKey: string) => void;
}

export function formatWaitTime(enqueuedAt: string) {
  const diffMs = Date.now() - new Date(enqueuedAt).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs} mp`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return `${mins}:${remainSecs.toString().padStart(2, '0')}`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function waitColor(enqueuedAt: string) {
  const diffMs = Date.now() - new Date(enqueuedAt).getTime();
  if (diffMs < 2 * 60 * 1000) return 'text-emerald-500';
  if (diffMs < 5 * 60 * 1000) return 'text-amber-500';
  return 'text-red-500';
}

export function sourceIcon(src: string) {
  if (src === 'email_alias' || src === 'email') return <Mail className="h-3 w-3" />;
  if (src === 'retry') return <RefreshCw className="h-3 w-3" />;
  return <Upload className="h-3 w-3" />;
}

export function sourceLabel(src: string) {
  if (src === 'email_alias' || src === 'email') return 'Email';
  if (src === 'retry') return 'Retry';
  return 'Feltöltés';
}

export function sourceBgClass(src: string) {
  if (src === 'email_alias' || src === 'email') return 'bg-purple-500/10 text-purple-400';
  if (src === 'retry') return 'bg-red-500/10 text-red-400';
  return 'bg-blue-500/10 text-blue-400';
}

export function QueueMonitorGrid({
  queues,
  selectedQueue,
  showAllQueues,
  dismissedQueues,
  onCloseAll,
  onCloseSelected,
  onDismissQueue,
}: QueueMonitorGridProps) {
  if (showAllQueues) {
    const allPendingQueues = queues
      .filter((q) => q.queue_length > 0 && !dismissedQueues.has(`${q.project}:${q.queue_name}`))
      .sort((a, b) => a.queue_name.localeCompare(b.queue_name));

    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Inbox className="h-4 w-4 text-amber-500" />
              Queue várakozó (globális)
              <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-400">
                {allPendingQueues.reduce((s, q) => s + (q.queue_length || 0), 0)} várakozó
              </Badge>
            </CardTitle>
            <button onClick={onCloseAll} className="text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-2 space-y-3">
          {allPendingQueues.length > 0 ? (
            allPendingQueues.map((queueData) => {
              const items = queueData.pending_items || [];
              const queueDisplayName = queueData.queue_name
                .replace(/_jobs$/, '')
                .replace(/^(PROD|VSWEB|THINKERMAN):/, '');
              const queueKey = `${queueData.project}:${queueData.queue_name}`;

              return (
                <div key={queueKey}>
                  <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/20 border-y border-border/20">
                    <ClipboardList className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-semibold capitalize">{queueDisplayName}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      {queueData.project}
                    </Badge>
                    <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-400">
                      {queueData.queue_length}
                    </Badge>
                    <span className="flex-1" />
                    {onDismissQueue && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDismissQueue(queueKey);
                        }}
                        className="text-muted-foreground/40 hover:text-foreground transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {items.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/30 text-muted-foreground">
                          <th className="text-left px-4 py-1.5 font-medium w-12">#</th>
                          <th className="text-left px-3 py-1.5 font-medium">Fájl</th>
                          <th className="text-left px-3 py-1.5 font-medium">Cég</th>
                          <th className="text-right px-3 py-1.5 font-medium">Várakozás</th>
                          <th className="text-left px-3 py-1.5 font-medium">Forrás</th>
                          <th className="text-left px-3 py-1.5 font-medium">Típus</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.msg_id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-1.5 text-muted-foreground font-mono text-[10px]">#{item.msg_id}</td>
                            <td className="px-3 py-1.5 max-w-[200px] truncate font-medium" title={item.file_name}>
                              <div className="flex items-center gap-1.5">
                                <FileText className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                                {item.file_name || '—'}
                              </div>
                            </td>
                            <td className="px-3 py-1.5 text-muted-foreground max-w-[140px] truncate" title={item.company_name}>
                              {item.company_name || '—'}
                            </td>
                            <td className={`text-right px-3 py-1.5 font-mono tabular-nums ${waitColor(item.enqueued_at)}`}>
                              {formatWaitTime(item.enqueued_at)}
                            </td>
                            <td className="px-3 py-1.5">
                              <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded ${sourceBgClass(item.source)}`}>
                                {sourceIcon(item.source)}
                                {sourceLabel(item.source)}
                              </span>
                            </td>
                            <td className="px-3 py-1.5">
                              <span className="text-[9px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                                {item.document_category}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-center py-3 text-muted-foreground text-xs">Az elemek részletei nem elérhetők</p>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mx-auto" />
              <p className="text-muted-foreground text-sm">Jelenleg nincs várakozó üzenet</p>
              <p className="text-muted-foreground/60 text-xs">Minden queue üres</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Inline view
  const queuesToShow = selectedQueue
    ? queues.filter((q) => q.queue_name === selectedQueue && q.queue_length > 0)
    : [];

  if (queuesToShow.length === 0) return null;

  return (
    <div className="space-y-3">
      {queuesToShow.map((queueData) => {
        const items = queueData.pending_items || [];
        const queueDisplayName = queueData.queue_name
          .replace(/_jobs$/, '')
          .replace(/^(PROD|VSWEB|THINKERMAN):/, '');

        return (
          <Card key={queueData.queue_name} className="border-amber-500/30 bg-amber-500/5">
            <CardHeader className="pb-2 pt-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-amber-500" />
                  <span className="capitalize">{queueDisplayName}</span>
                  <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-400">
                    {queueData.queue_length} várakozó
                  </Badge>
                  <span className="text-[10px] text-muted-foreground font-normal">{queueData.project}</span>
                </CardTitle>
                <button onClick={onCloseSelected} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {items.length > 0 ? (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left px-4 py-1.5 font-medium w-12">#</th>
                      <th className="text-left px-3 py-1.5 font-medium">Fájl</th>
                      <th className="text-left px-3 py-1.5 font-medium">Cég</th>
                      <th className="text-right px-3 py-1.5 font-medium">Várakozás</th>
                      <th className="text-left px-3 py-1.5 font-medium">Forrás</th>
                      <th className="text-left px-3 py-1.5 font-medium">Típus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.msg_id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-1.5 text-muted-foreground font-mono text-[10px]">#{item.msg_id}</td>
                        <td className="px-3 py-1.5 max-w-[200px] truncate font-medium" title={item.file_name}>
                          <div className="flex items-center gap-1.5">
                            <FileText className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                            {item.file_name || '—'}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-muted-foreground max-w-[140px] truncate" title={item.company_name}>
                          {item.company_name || '—'}
                        </td>
                        <td className={`text-right px-3 py-1.5 font-mono tabular-nums ${waitColor(item.enqueued_at)}`}>
                          {formatWaitTime(item.enqueued_at)}
                        </td>
                        <td className="px-3 py-1.5">
                          <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded ${sourceBgClass(item.source)}`}>
                            {sourceIcon(item.source)}
                            {sourceLabel(item.source)}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">
                          <span className="text-[9px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                            {item.document_category}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-center py-4 text-muted-foreground text-xs">Az elemek részletei nem elérhetők</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
