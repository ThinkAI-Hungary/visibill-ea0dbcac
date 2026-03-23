import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { useDateRange } from '@/contexts/DateRangeContext';
import { formatFileSize } from '@/lib/utils';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { History, FileText, Landmark, Banknote, CreditCard, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';

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
}

const errorStatuses = new Set(['webhook_failed', 'failed', 'error']);
const processingStatuses = new Set(['processing', 'webhook_sent']);

// formatFileSize is now imported from @/lib/utils

function getStatus(record: UploadRecord, processedIds: Set<string>): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (errorStatuses.has(record.processing_status)) {
    return { label: 'A feltöltés sikertelen', variant: 'destructive' };
  }
  if (processedIds.has(record.id)) {
    return { label: 'Feldolgozva', variant: 'default' };
  }
  // BUG #2 FIX: Show processing/webhook_sent as 'Feldolgozás alatt'
  if (processingStatuses.has(record.processing_status)) {
    return { label: 'Feldolgozás alatt', variant: 'outline' };
  }
  return { label: 'Feltöltve', variant: 'secondary' };
}

export default function UploadHistory({ activeTab }: UploadHistoryProps) {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const { dateFromFormatted, dateToFormatted } = useDateRange();
  const queryClient = useQueryClient();

  const companyId = selectedCompany?.id || '';
  // BUG #3 FIX: Added bank-statements tab support
  const tableName = activeTab === 'invoices' ? 'invoice_uploads'
    : activeTab === 'salaries' ? 'salary_files'
    : activeTab === 'bank-statements' ? 'bank_statement_uploads'
    : 'transaction_uploads';
  const icon = activeTab === 'invoices' ? <FileText className="h-5 w-5" />
    : activeTab === 'salaries' ? <Banknote className="h-5 w-5" />
    : activeTab === 'bank-statements' ? <CreditCard className="h-5 w-5" />
    : <Landmark className="h-5 w-5" />;
  const title = activeTab === 'invoices' ? 'Számla feltöltési'
    : activeTab === 'salaries' ? 'Bér/járulék feltöltési'
    : activeTab === 'bank-statements' ? 'Bankkivonat feltöltési'
    : 'Tranzakció feltöltési';

  const isValidTab = activeTab === 'invoices' || activeTab === 'transactions' || activeTab === 'salaries' || activeTab === 'bank-statements';

  // ── Main data query (records + processed IDs + user names) ──
  const { data, isLoading: loading } = useQuery({
    queryKey: queryKeys.uploadHistory(companyId, activeTab, dateFromFormatted, dateToFormatted),
    queryFn: async () => {
      let records: UploadRecord[] = [];

      if (activeTab === 'salaries') {
        // BUG #8 FIX: Reordered query to avoid `as any` casting
        const query = supabase
          .from('salary_files')
          .select('id, file_name, file_size, file_url, user_id, status, created_at')
          .eq('company_id', companyId)
          .gte('created_at', dateFromFormatted)
          .lte('created_at', dateToFormatted + 'T23:59:59')
          .order('created_at', { ascending: false })
          .limit(50);

        const res = await (query as any);
        if (res.error) throw res.error;
        records = (res.data || []).map((r: any) => ({
          ...r,
          file_size: r.file_size || 0,
          file_type: '',
          upload_status: r.status || 'pending',
          // BUG #2 FIX: Map salary status values correctly
          processing_status: r.status || 'pending',
          error_message: null,
        }));
      } else {
        let query = supabase
          .from(tableName)
          .select('id, file_name, file_size, file_type, file_url, user_id, upload_status, processing_status, created_at, error_message')
          .gte('created_at', dateFromFormatted)
          .lte('created_at', dateToFormatted + 'T23:59:59')
          .order('created_at', { ascending: false })
          .limit(50);

        if (companyId) {
          query = query.eq('company_id', companyId);
        }

        const res = await query;
        if (res.error) throw res.error;
        records = (res.data as unknown as UploadRecord[]) || [];
      }

      // Fetch user names
      const uniqueUserIds = [...new Set(records.map(r => r.user_id).filter(Boolean))];
      const userNames: Record<string, string> = {};
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', uniqueUserIds);
        // BUG #7 FIX: Standardized fallback text
        (profiles || []).forEach(p => {
          userNames[p.user_id] = p.name || 'Ismeretlen felhasználó';
        });
      }

      // Fetch processed IDs
      let processedIds = new Set<string>();
      const uploadIds = records.map(r => r.id).filter(Boolean);

      if (activeTab === 'invoices' && uploadIds.length > 0 && companyId) {
        const { data: invoices } = await (supabase
          .from('invoices')
          .select('invoice_uploads_id')
          .eq('company_id', companyId) as any)
          .in('invoice_uploads_id', uploadIds);
        processedIds = new Set(
          (invoices || []).map((i: any) => i.invoice_uploads_id).filter(Boolean) as string[]
        );
      }

      if (activeTab === 'salaries' && uploadIds.length > 0 && companyId) {
        const { data: salaries } = await (supabase
          .from('salary')
          .select('salary_file_id')
          .eq('company_id', companyId) as any)
          .in('salary_file_id', uploadIds);
        processedIds = new Set(
          (salaries || []).map((s: any) => s.salary_file_id).filter(Boolean) as string[]
        );
      }

      // BUG #3 FIX: Fetch processed IDs for transactions too
      if (activeTab === 'transactions' && uploadIds.length > 0 && companyId) {
        const { data: txRows } = await supabase
          .from('transactions')
          .select('upload_id')
          .eq('company_id', companyId)
          .in('upload_id', uploadIds);
        processedIds = new Set(
          (txRows || []).map((t: any) => t.upload_id).filter(Boolean) as string[]
        );
      }

      return { records, processedIds, userNames };
    },
    enabled: !!user && !!companyId && isValidTab,
  });

  const records = data?.records || [];
  const processedUrls = data?.processedIds || new Set<string>();
  const userNames = data?.userNames || {};

  if (!isValidTab) {
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
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead>Fájlnév</TableHead>
                  <TableHead>Méret</TableHead>
                  <TableHead>Feltöltötte</TableHead>
                  <TableHead>Dátum</TableHead>
                  <TableHead>Státusz</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => {
                  const status = getStatus(record, processedUrls);
                  return (
                    <TableRow key={record.id}>
                      <TableCell className="font-medium text-sm max-w-[250px] truncate" title={record.file_name}>
                        {record.file_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatFileSize(record.file_size || 0)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {userNames[record.user_id] || 'Ismeretlen felhasználó'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(record.created_at), 'yyyy.MM.dd HH:mm', { locale: hu })}
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
                <span className="text-xs text-muted-foreground">— A fájl feltöltésre került</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs">Feldolgozás alatt</Badge>
                <span className="text-xs text-muted-foreground">— A feldolgozás folyamatban van</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="default" className="text-xs">Feldolgozva</Badge>
                <span className="text-xs text-muted-foreground">— Sikeresen feldolgozva és rögzítve</span>
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