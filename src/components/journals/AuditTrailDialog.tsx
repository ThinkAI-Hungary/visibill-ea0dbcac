import React from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, History, User, ArrowRight } from 'lucide-react';
import { getActiveLocale } from '@/lib/locale/formatters';

interface AuditTrailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
}

export default function AuditTrailDialog({ open, onOpenChange, entryId }: AuditTrailDialogProps) {
  const { t } = useTranslation(['accounting', 'common']);

  // Query logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['acc-journal-audit', entryId],
    queryFn: async () => {
      if (!entryId) return [];
      const { data, error } = await supabase
        .from('acc_journal_audit_logs')
        .select('*')
        .eq('entity_id', entryId)
        .order('timestamp', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId && open,
  });

  const formatValue = (field: string, val: any) => {
    if (val === null || val === undefined) return '—';
    if (field === 'status') {
      return t(`accounting:dialogs.audit_trail.statuses.${val}` as any, { defaultValue: val });
    }
    return String(val);
  };

  const getFieldLabel = (field: string) => {
    return t(`accounting:dialogs.audit_trail.fields.${field}` as any, { defaultValue: field });
  };

  const activeLocaleCode = getActiveLocale() === 'hr' ? 'hr-HR' : 'hu-HU';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" /> {t('accounting:dialogs.audit_trail.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              {t('accounting:dialogs.audit_trail.no_logs')}
            </div>
          ) : (
            <div className="relative border-l border-border ml-3.5 space-y-6">
              {logs.map((log: any) => {
                const dateStr = new Date(log.timestamp).toLocaleString(activeLocaleCode, {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
                });

                return (
                  <div key={log.id} className="relative pl-6">
                    {/* Circle dot on line */}
                    <div className="absolute -left-[7.5px] top-1.5 w-3.5 h-3.5 rounded-full border bg-background border-primary flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>

                    <div className="space-y-1.5 text-xs">
                      {/* Timestamp & User */}
                      <div className="flex items-center justify-between text-muted-foreground text-[10px]">
                        <span className="font-mono">{dateStr}</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.user_id ? t('accounting:dialogs.audit_trail.accountant') : t('accounting:dialogs.audit_trail.system')}
                        </span>
                      </div>

                      {/* Event description */}
                      <div className="font-medium text-foreground text-sm">
                        {log.event === 'INSERT' && (
                          <span className="text-emerald-600">
                            {t('accounting:dialogs.audit_trail.event_created', { status: formatValue('status', log.new_status) })}
                          </span>
                        )}
                        {log.event === 'DELETE' && (
                          <span className="text-destructive font-semibold">
                            {t('accounting:dialogs.audit_trail.event_deleted')}
                          </span>
                        )}
                        {log.event === 'UPDATE' && (
                          <span>{t('accounting:dialogs.audit_trail.event_updated')}</span>
                        )}
                      </div>

                      {/* Diffs */}
                      {log.changes && Object.keys(log.changes).length > 0 && (
                        <div className="bg-muted/40 p-2.5 rounded-lg border space-y-1 mt-1 text-[11px]">
                          {Object.entries(log.changes).map(([field, delta]: [string, any]) => (
                            <div key={field} className="flex flex-col gap-0.5 border-b border-border/10 pb-1 last:border-0 last:pb-0">
                              <span className="font-semibold text-muted-foreground">{getFieldLabel(field)}:</span>
                              <div className="flex items-center gap-1.5 font-medium text-foreground">
                                <span className="line-through text-muted-foreground">{formatValue(field, delta.old)}</span>
                                <ArrowRight className="w-3 h-3 text-muted-foreground" />
                                <span>{formatValue(field, delta.new)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
            {t('accounting:dialogs.audit_trail.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
