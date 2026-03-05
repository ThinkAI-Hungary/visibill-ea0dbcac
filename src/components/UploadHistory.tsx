import { useEffect, useState } from 'react';
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
  upload_status: string;
  processing_status: string;
  created_at: string;
  error_message: string | null;
}

interface UploadHistoryProps {
  activeTab: string;
}

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Feldolgozás alatt', variant: 'secondary' },
  processing: { label: 'Feldolgozás...', variant: 'secondary' },
  completed: { label: 'Kész', variant: 'default' },
  done: { label: 'Kész', variant: 'default' },
  failed: { label: 'Hiba', variant: 'destructive' },
  error: { label: 'Hiba', variant: 'destructive' },
  uploaded: { label: 'Feltöltve', variant: 'outline' },
};

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function UploadHistory({ activeTab }: UploadHistoryProps) {
  const [records, setRecords] = useState<UploadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { selectedCompany } = useCompany();

  const tableName = activeTab === 'invoices' ? 'invoice_uploads' : 'transaction_uploads';
  const icon = activeTab === 'invoices' ? <FileText className="h-5 w-5" /> : <Landmark className="h-5 w-5" />;
  const title = activeTab === 'invoices' ? 'Számla feltöltések' : 'Tranzakció feltöltések';

  useEffect(() => {
    if (!user) return;

    const fetchRecords = async () => {
      setLoading(true);
      let query = supabase
        .from(tableName)
        .select('id, file_name, file_size, file_type, upload_status, processing_status, created_at, error_message')
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
        setRecords((data as UploadRecord[]) || []);
      }
      setLoading(false);
    };

    fetchRecords();
  }, [user, selectedCompany?.id, tableName]);

  // Only show for invoices and transactions tabs
  if (activeTab !== 'invoices' && activeTab !== 'transactions') {
    return null;
  }

  return (
    <Card className="mt-6">
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
                  const status = statusMap[record.processing_status] || statusMap[record.upload_status] || { label: record.processing_status, variant: 'outline' as const };
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
                        {record.error_message && (
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
      </CardContent>
    </Card>
  );
}
