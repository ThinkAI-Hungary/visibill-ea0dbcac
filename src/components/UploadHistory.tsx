import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { History, FileText, Landmark, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';

interface UploadRecord {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_url: string;
  user_id: string;
  upload_status: string;
  processing_status: string;
  created_at: string;
  error_message: string | null;
}

interface UploadHistoryProps {
  activeTab: string;
  refreshKey?: number;
}

const errorStatuses = new Set(['webhook_failed', 'failed', 'error']);

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getStatus(record: UploadRecord, processedUrls: Set<string>): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  // Error states first
  if (errorStatuses.has(record.processing_status)) {
    return { label: 'A feltöltés sikertelen', variant: 'destructive' };
  }
  // Check if invoice exists with feldolgozva set
  if (processedUrls.has(record.file_url)) {
    return { label: 'Feldolgozva', variant: 'default' };
  }
  // Everything else is "Feltöltve"
  return { label: 'Feltöltve', variant: 'secondary' };
}

export default function UploadHistory({ activeTab, refreshKey }: UploadHistoryProps) {
  const [records, setRecords] = useState<UploadRecord[]>([]);
  const [processedUrls, setProcessedUrls] = useState<Set<string>>(new Set());
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { selectedCompany } = useCompany();

  const tableName = activeTab === 'invoices' ? 'invoice_uploads' : 'transaction_uploads';
  const icon = activeTab === 'invoices' ? <FileText className="h-5 w-5" /> : <Landmark className="h-5 w-5" />;
  const title = activeTab === 'invoices' ? 'Számla feltöltések' : 'Tranzakció feltöltések';

  const fetchRecords = useCallback(async () => {
    if (!user) return;
    
    let query = supabase
      .from(tableName)
      .select('id, file_name, file_size, file_type, file_url, user_id, upload_status, processing_status, created_at, error_message')
      .order('created_at', { ascending: false })
      .limit(20);

    if (selectedCompany?.id) {
      query = query.eq('company_id', selectedCompany.id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Upload history fetch error:', error);
      setRecords([]);
    } else {
      const uploadRecords = (data as UploadRecord[]) || [];
      setRecords(uploadRecords);

      // Fetch user names for uploaders
      const uniqueUserIds = [...new Set(uploadRecords.map(r => r.user_id).filter(Boolean))];
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', uniqueUserIds);
        
        const nameMap: Record<string, string> = {};
        (profiles || []).forEach(p => {
          nameMap[p.user_id] = p.name || 'Ismeretlen';
        });
        setUserNames(nameMap);
      }

      // For invoice uploads, check which ones have been processed
      if (activeTab === 'invoices' && uploadRecords.length > 0 && selectedCompany?.id) {
        const fileUrls = uploadRecords.map(r => r.file_url).filter(Boolean);
        if (fileUrls.length > 0) {
          const { data: invoices } = await supabase
            .from('invoices')
            .select('image_url')
            .eq('company_id', selectedCompany.id)
            .in('image_url', fileUrls);

          const urls = new Set((invoices || []).map(i => i.image_url).filter(Boolean) as string[]);
          setProcessedUrls(urls);
        }
      }
    }
    setLoading(false);
  }, [user, selectedCompany?.id, tableName, activeTab]);

  // Initial fetch + refetch on refreshKey change
  useEffect(() => {
    setLoading(true);
    fetchRecords();
  }, [fetchRecords, refreshKey]);

  // Realtime subscription for live updates on uploads
  useEffect(() => {
    if (!user || !selectedCompany?.id) return;
    if (activeTab !== 'invoices' && activeTab !== 'transactions') return;

    const channel = supabase
      .channel(`upload-history-${tableName}-${selectedCompany.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `company_id=eq.${selectedCompany.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRecord = payload.new as UploadRecord;
            setRecords(prev => {
              if (prev.some(r => r.id === newRecord.id)) return prev;
              return [newRecord, ...prev].slice(0, 20);
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as UploadRecord;
            setRecords(prev =>
              prev.map(r => (r.id === updated.id ? updated : r))
            );
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setRecords(prev => prev.filter(r => r.id !== deleted.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedCompany?.id, tableName, activeTab]);

  // Realtime subscription for invoices table to detect when feldolgozva changes
  useEffect(() => {
    if (!user || !selectedCompany?.id || activeTab !== 'invoices') return;

    const channel = supabase
      .channel(`invoice-processed-${selectedCompany.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'invoices',
          filter: `company_id=eq.${selectedCompany.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const invoice = payload.new as { image_url?: string };
          if (invoice.image_url) {
              setProcessedUrls(prev => {
                if (prev.has(invoice.image_url!)) return prev;
                const next = new Set(prev);
                next.add(invoice.image_url!);
                return next;
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedCompany?.id, activeTab]);

  // Only show for invoices and transactions tabs
  if (activeTab !== 'invoices' && activeTab !== 'transactions') {
    return null;
  }

  return (
    <Card className="mt-6 max-w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5" />
          {title} előzmények
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            {icon}
            <p className="mt-2 text-sm">Még nincs feltöltési előzmény</p>
          </div>
        ) : (
          <div className="relative w-full overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fájlnév</TableHead>
                  <TableHead>Méret</TableHead>
                  <TableHead>Státusz</TableHead>
                  <TableHead>Dátum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const status = getStatus(record, processedUrls);
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate" title={record.file_name}>
                        {record.file_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatFileSize(record.file_size || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className="text-xs">
                          {status.label}
                        </Badge>
                        {record.error_message && errorStatuses.has(record.processing_status) && (
                          <p className="text-xs text-destructive mt-1 max-w-[150px] truncate" title={record.error_message}>
                            {record.error_message}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(record.created_at), 'yyyy.MM.dd HH:mm', { locale: hu })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {records.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2 font-medium">Jelmagyarázat:</p>
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs">Feltöltve</Badge>
                <span className="text-xs text-muted-foreground">— A fájl feltöltésre került, feldolgozás folyamatban</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="default" className="text-xs">Feldolgozva</Badge>
                <span className="text-xs text-muted-foreground">— A számla sikeresen feldolgozva és rögzítve</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="destructive" className="text-xs">A feltöltés sikertelen</Badge>
                <span className="text-xs text-muted-foreground">— Hiba történt a feldolgozás során</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
