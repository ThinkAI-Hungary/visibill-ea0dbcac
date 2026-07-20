import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Trash2, Loader2, CheckCircle2, AlertTriangle, Clock, User, Calendar, Hash } from 'lucide-react';

interface AuditImportHistoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditImportHistoryModal({ open, onOpenChange }: AuditImportHistoryModalProps) {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: imports, isLoading } = useQuery({
    queryKey: ['auditImports', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('gl_audit_imports')
        .select('id, file_name, period_start, period_end, processing_status, entry_count, account_count, partner_count, voucher_count, source_program, imported_at, imported_by, error_message, dry_run')
        .eq('company_id', selectedCompany.id)
        .order('imported_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!selectedCompany?.id && open,
    refetchInterval: open ? 5000 : false,
  });

  // Fetch user emails for display
  const { data: users } = useQuery({
    queryKey: ['auditImportUsers', imports?.map(i => i.imported_by).filter(Boolean)],
    queryFn: async () => {
      const userIds = [...new Set(imports?.map(i => i.imported_by).filter(Boolean) || [])];
      if (userIds.length === 0) return {};
      const { data } = await supabase
        .from('profiles')
        .select('id, email, display_name')
        .in('id', userIds);
      const map: Record<string, string> = {};
      data?.forEach(u => { map[u.id] = u.display_name || u.email || u.id; });
      return map;
    },
    enabled: !!imports?.length,
  });

  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const handleDelete = async (importId: string, fileName: string) => {
    if (!confirm(`Biztosan törlöd a(z) "${fileName}" importot?\nEz törli az összes importált könyvelési tételt is.`)) return;
    
    setDeletingId(importId);
    try {
      // Use server-side RPC to delete import + all entries (avoids client timeout)
      const { error } = await supabase.rpc('delete_audit_import', { p_import_id: importId });
      if (error) {
        toast({ title: 'Hiba a törlés során', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Import törölve', description: `${fileName} és az összes tétele törölve.`, className: 'bg-green-50 text-green-900 border-green-200' });
        queryClient.invalidateQueries({ queryKey: ['auditImports'] });
        queryClient.invalidateQueries({ queryKey: ['glBalances'] });
        queryClient.invalidateQueries({ queryKey: ['glItems'] });
      }
    } finally {
      setDeletingId(null);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'processing': return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Kész';
      case 'error': return 'Hiba';
      case 'processing': return 'Feldolgozás...';
      default: return 'Várakozik';
    }
  };

  const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5 text-primary" />
            Főkönyv XML Feltöltések
          </DialogTitle>
          <DialogDescription>
            Az importált audit XML fájlok és feldolgozási státuszuk.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : !imports?.length ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Még nincs feltöltött XML.</p>
              <p className="text-xs mt-1">Használd az "XML Import" gombot a főkönyv oldalon.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {imports.map(imp => (
                <div
                  key={imp.id}
                  className={`border rounded-xl p-4 transition-all ${
                    imp.processing_status === 'completed'
                      ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10'
                      : imp.processing_status === 'error'
                        ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10'
                        : 'border-border bg-card'
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {statusIcon(imp.processing_status)}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <p className="font-medium text-sm truncate max-w-[280px]" title={imp.file_name}>{imp.file_name}</p>
                          {imp.dry_run && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                              Előnézet (Dry Run)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {statusLabel(imp.processing_status)}
                          {imp.source_program && ` • ${imp.source_program}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deletingId === imp.id}
                      className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 shrink-0"
                      onClick={() => handleDelete(imp.id, imp.file_name)}
                    >
                      {deletingId === imp.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>

                  {/* Details grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1.5 mt-3 text-[11px]">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="w-3 h-3 shrink-0" />
                      <span>{fmtDate(imp.imported_at)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="w-3 h-3 shrink-0" />
                      <span className="truncate">{users?.[imp.imported_by] || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Hash className="w-3 h-3 shrink-0" />
                      <span>{imp.entry_count?.toLocaleString() || 0} tétel</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <FileText className="w-3 h-3 shrink-0" />
                      <span>
                        {imp.period_start && imp.period_end
                          ? `${imp.period_start.replace(/-/g, '.')} – ${imp.period_end.replace(/-/g, '.')}`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Error message */}
                  {imp.processing_status === 'error' && imp.error_message && (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-100/50 dark:bg-red-900/20 rounded-lg px-3 py-2">
                      {imp.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
