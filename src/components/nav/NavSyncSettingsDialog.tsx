import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Settings,
  HelpCircle,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface NavSyncSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

interface SyncLog {
  id: string;
  sync_type: string;
  invoice_direction: string | null;
  started_at: string;
  completed_at: string | null;
  invoices_fetched: number;
  status: string;
  error_message: string | null;
  duration_ms: number | null;
}

export default function NavSyncSettingsDialog({
  open,
  onOpenChange,
  companyId,
}: NavSyncSettingsDialogProps) {
  const { toast } = useToast();
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [syncFrequency, setSyncFrequency] = useState<'daily' | 'weekly'>('daily');
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load current settings and logs when dialog opens
  useEffect(() => {
    if (open && companyId) {
      loadSettingsAndLogs();
    }
  }, [open, companyId]);

  const loadSettingsAndLogs = async () => {
    setLoading(true);
    try {
      // 1. Fetch credentials settings
      const { data: creds, error: credsError } = await supabase
        .from('user_nav_credentials')
        .select('auto_sync_enabled, sync_frequency')
        .eq('company_id', companyId)
        .maybeSingle();

      if (credsError) throw credsError;

      if (creds) {
        setAutoSyncEnabled(creds.auto_sync_enabled ?? true);
        setSyncFrequency((creds.sync_frequency as 'daily' | 'weekly') ?? 'daily');
      }

      // 2. Fetch sync logs
      const { data: syncLogs, error: logsError } = await supabase
        .from('nav_sync_logs')
        .select('*')
        .eq('company_id', companyId)
        .order('started_at', { ascending: false })
        .limit(10);

      if (logsError) throw logsError;
      setLogs(syncLogs || []);
    } catch (err: any) {
      console.error('Error loading NAV sync settings/logs:', err);
      toast({
        title: 'Hiba történt',
        description: err.message || 'Nem sikerült betölteni a beállításokat.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_nav_credentials')
        .update({
          auto_sync_enabled: autoSyncEnabled,
          sync_frequency: syncFrequency,
        })
        .eq('company_id', companyId);

      if (error) throw error;

      toast({
        title: 'Beállítások mentve',
        description: 'A NAV automatikus szinkronizációs beállítások sikeresen frissítve.',
      });
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error saving NAV sync settings:', err);
      toast({
        title: 'Mentési hiba',
        description: err.message || 'Nem sikerült menteni a beállításokat.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 gap-1 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Sikeres
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1 font-medium">
            <XCircle className="w-3.5 h-3.5" /> Sikertelen
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 gap-1 font-medium">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Folyamatban
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden bg-card border border-border shadow-soft">
        <DialogHeader className="p-6 pb-4 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100 font-bold">
            <Settings className="w-5 h-5 text-indigo-600" />
            NAV Szinkronizációs Beállítások & Napló
          </DialogTitle>
          <DialogDescription className="text-slate-500">
            Háttérben történő automatikus számlaszinkronizáció beállítása és előzményei.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <RefreshCw className="w-8 h-8 mb-3 animate-spin text-indigo-500" />
            <p className="text-sm">Betöltés...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Settings Card */}
            <div className="space-y-4 bg-slate-50 dark:bg-slate-800/30 border border-border rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-600" />
                Automatizációs szabályok
              </h3>

              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-sync" className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    Automatikus szinkronizáció
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-slate-500 cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Engedélyezi a NAV számlák háttérben történő automatikus lekérését.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <p className="text-xs text-slate-500">Kapcsolja be az adatok napi vagy heti rendszerességű frissítéséhez.</p>
                </div>
                <Switch
                  id="auto-sync"
                  checked={autoSyncEnabled}
                  onCheckedChange={setAutoSyncEnabled}
                />
              </div>

              {autoSyncEnabled && (
                <div className="flex items-center justify-between py-2 animate-in fade-in duration-300">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      Szinkronizálás gyakorisága
                    </Label>
                    <p className="text-xs text-slate-500">Milyen gyakran fusson le az automatikus lekérés.</p>
                  </div>
                  <Select
                    value={syncFrequency}
                    onValueChange={(val: 'daily' | 'weekly') => setSyncFrequency(val)}
                  >
                    <SelectTrigger className="w-[180px] bg-card border-border">
                      <SelectValue placeholder="Válasszon gyakoriságot" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Naponta</SelectItem>
                      <SelectItem value="weekly">Hetente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Logs Timeline */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                Legutóbbi futások naplója (max. 10)
              </h3>

              <div className="border border-border rounded-xl overflow-hidden bg-card max-h-[250px] overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs">Nincs rögzített szinkronizációs bejegyzés</p>
                  </div>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-border text-slate-500 font-medium">
                      <tr>
                        <th className="px-4 py-2">Időpont</th>
                        <th className="px-4 py-2">Irány</th>
                        <th className="px-4 py-2">Állapot</th>
                        <th className="px-4 py-2 text-right">Számlák</th>
                        <th className="px-4 py-2 text-right">Futásidő</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">
                            {new Date(log.started_at).toLocaleString('hu-HU', {
                              month: 'numeric',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-4 py-2.5 text-slate-900 dark:text-slate-100 font-semibold">
                            {log.invoice_direction === 'INBOUND' ? 'Bejövő' : log.invoice_direction === 'OUTBOUND' ? 'Kimenő' : 'Mindkettő'}
                          </td>
                          <td className="px-4 py-2.5">
                            {log.error_message ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="cursor-pointer">{getStatusBadge(log.status)}</div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[280px] bg-red-600 text-white p-2 text-[11px] rounded shadow-lg border border-red-700">
                                    {log.error_message}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              getStatusBadge(log.status)
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-800 dark:text-slate-200">
                            {log.invoices_fetched} db
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-500">
                            {log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)} mp` : '–'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="bg-card border-border text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Mégse
              </Button>
              <Button
                onClick={handleSaveSettings}
                disabled={saving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 shadow-sm shadow-indigo-600/10 font-semibold"
              >
                {saving ? 'Mentés...' : 'Beállítások mentése'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
