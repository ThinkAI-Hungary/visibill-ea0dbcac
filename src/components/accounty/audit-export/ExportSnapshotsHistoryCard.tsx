import React, { useState } from 'react';
import {
  History,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { AuditExportRecord } from '@/services/auditorExportService';

interface ExportSnapshotsHistoryCardProps {
  records: AuditExportRecord[];
  isLoading: boolean;
  onRefreshHistory: () => void;
}

export function ExportSnapshotsHistoryCard({
  records,
  isLoading,
  onRefreshHistory,
}: ExportSnapshotsHistoryCardProps) {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyHash = (hash: string, id: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedId(id);
    toast({
      title: 'SHA-256 hash másolva',
      description: 'A könyvvizsgálói ellenőrző hash a vágólapra került.',
    });
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  return (
    <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden bg-card/60 backdrop-blur-sm">
      <CardHeader className="bg-muted/10 border-b border-border/40 p-5 md:p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <History className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight">
                Verziótörténet és SHA-256 Integritás Napló
              </CardTitle>
              <CardDescription className="text-sm text-muted-foreground">
                Minden lezárt és auditoroknak átadott exportállomány kriptográfiai lenyomata és audit-állapota
              </CardDescription>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefreshHistory}
            disabled={isLoading}
            className="text-xs h-8"
          >
            Frissítés
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 md:p-6">
        {isLoading ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            Verziótörténet betöltése...
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground space-y-1">
            <p className="text-sm font-medium">Még nem készült lezárt audit pillanatkép ehhez az üzleti évhez.</p>
            <p className="text-xs">
              A fenti 20-oszlopos karton panelen kattints a „Pillanatkép (SHA-256)” gombra az aktuális állapot rögzítéséhez.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/20 rounded-xl border border-border/30 overflow-hidden bg-background/50">
            {records.map((rec) => {
              const formattedDate = new Date(rec.created_at).toLocaleDateString('hu-HU', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={rec.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-foreground">{rec.version_label}</span>
                      <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-4 uppercase">
                        {rec.export_format}
                      </Badge>

                      {rec.is_stale ? (
                        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[10px] font-semibold flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3" />
                          Elavult (Módosítás történt)
                        </Badge>
                      ) : (
                        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Aktuális / Sértetlen
                        </Badge>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span>Rögzítve: <strong>{formattedDate}</strong></span>
                      <span>•</span>
                      <span>Tételek: <strong>{rec.total_lines} db</strong></span>
                      <span>•</span>
                      <span>Forgalom: <strong>{rec.total_debit.toLocaleString('hu-HU')} Ft</strong></span>
                    </div>

                    {/* SHA-256 Hash Display */}
                    <div className="pt-1 flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-muted-foreground">SHA-256:</span>
                      <code className="text-[11px] font-mono bg-muted/60 px-2 py-0.5 rounded text-foreground/80 break-all select-all">
                        {rec.file_hash_sha256}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => handleCopyHash(rec.file_hash_sha256, rec.id)}
                        title="Hash másolása a vágólapra"
                      >
                        {copiedId === rec.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
