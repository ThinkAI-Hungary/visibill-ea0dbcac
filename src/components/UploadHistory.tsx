import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCompany } from '@/contexts/CompanyContext';
import { formatFileSize } from '@/lib/utils';

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { History, FileText, Landmark, Banknote, CreditCard, Loader2, Package, ExternalLink, AlertCircle, Coins } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { hu } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { isUploadNotified } from '@/components/LiveNotificationProvider';
import { lazy, Suspense } from 'react';

const CMREscalationDialog = lazy(() => import('@/components/CMREscalationDialog'));

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
  metadata: {
    multi_invoice?: boolean;
    invoice_count_total?: number;
    invoice_count_processed?: number;
    invoice_count_errors?: number;
    invoice_count_ignored?: number;
  } | null;
}

interface UploadHistoryProps {
  activeTab: string;
}

// Feldolgozási hibák — a feltöltés sikerült, de a worker nem tudta feldolgozni
const processingErrorStatuses = new Set(['webhook_failed', 'error']);
// Tényleges feltöltési hiba — a fájl nem jutott el a storage-ba
const uploadErrorStatuses = new Set(['failed']);
const processingStatuses = new Set(['processing', 'webhook_sent']);
const pendingStatuses = new Set(['pending', 'uploaded']);
const activeStatuses = new Set([...processingStatuses, ...pendingStatuses]);
// Invoice/payroll worker uses 'processed', transaction worker uses 'completed'
const doneStatuses = new Set(['completed', 'processed']);
// CMR/document statuses — worker sets these for non-invoice documents
const cmrStatuses = new Set(['cmr_attached', 'cmr_orphaned', 'cmr_escalated']);

// formatFileSize is now imported from @/lib/utils

function getStatus(record: UploadRecord, processedIds: Set<string>): { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; multiProgress?: string } {
  const meta = record.metadata;
  const isMulti = meta?.multi_invoice === true;
  const total = meta?.invoice_count_total || 0;
  const processed = meta?.invoice_count_processed || 0;
  const errors = meta?.invoice_count_errors || 0;

  if (uploadErrorStatuses.has(record.processing_status)) {
    return { label: 'A feltöltés sikertelen', variant: 'destructive' };
  }
  if (processingErrorStatuses.has(record.processing_status)) {
    const multiInfo = isMulti ? `${processed}/${total} feldolgozva, ${errors} hiba` : undefined;
    return { label: 'Feldolgozási hiba', variant: 'destructive', multiProgress: multiInfo };
  }
  // Check processing_status FIRST — worker sets this to 'processing' while
  // actively working on the file (extraction, categorization, matching).
  // Transactions may already be inserted in DB before matching completes,
  // so processedIds check must come AFTER this.
  if (processingStatuses.has(record.processing_status)) {
    const multiInfo = isMulti ? `${processed}/${total} számla` : undefined;
    return { label: 'Feldolgozás alatt', variant: 'outline', multiProgress: multiInfo };
  }
  // Transport document statuses (CMR, nalog, etc.)
  if (cmrStatuses.has(record.processing_status)) {
    if (record.processing_status === 'cmr_attached') {
      return { label: 'Dokumentum párosítva', variant: 'default' };
    }
    if (record.processing_status === 'cmr_escalated') {
      return { label: '⚠️ Eszkaláció', variant: 'outline' };
    }
    return { label: 'Vár a számlára', variant: 'secondary' };
  }
  // Ignored documents — classified as unidentifiable
  if (record.processing_status === 'ignored') {
    return { label: 'Nem beazonosítható', variant: 'secondary' };
  }
  if (record.processing_status === 'dismissed') {
    return { label: 'Elutasítva', variant: 'secondary' };
  }
  if (doneStatuses.has(record.processing_status) || processedIds.has(record.id)) {
    const multiInfo = isMulti ? `${total} számla` : undefined;
    return { label: 'Feldolgozva', variant: 'default', multiProgress: multiInfo };
  }
  return { label: 'Feltöltve', variant: 'secondary' };
}

export default function UploadHistory({ activeTab }: UploadHistoryProps) {
  const { user } = useAuth();
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();

  // File preview modal state
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState(false);

  // CMR Escalation dialog state
  const [escalationUpload, setEscalationUpload] = useState<UploadRecord | null>(null);

  // Track previous processing_status per upload ID to detect transitions
  const prevStatusMap = useRef<Map<string, string>>(new Map());

  const companyId = selectedCompany?.id || '';

  // Upload history always shows the last 90 days regardless of the global date range.
  // The global date range controls accounting views, not upload recency.
  const uploadDateFrom = format(subDays(new Date(), 90), 'yyyy-MM-dd');
  const uploadDateTo = format(new Date(), 'yyyy-MM-dd');
  // BUG #3 FIX: Added bank-statements tab support
  const tableName = activeTab === 'invoices' ? 'invoice_uploads'
    : activeTab === 'vouchers' ? 'invoice_uploads'
    : activeTab === 'salaries' ? 'salary_files'
    : activeTab === 'bank-statements' ? 'bank_statement_uploads'
    : activeTab === 'reports' ? 'report_uploads'
    : 'transaction_uploads';
  const icon = activeTab === 'invoices' ? <FileText className="h-5 w-5" />
    : activeTab === 'vouchers' ? <Coins className="h-5 w-5" />
    : activeTab === 'salaries' ? <Banknote className="h-5 w-5" />
    : activeTab === 'bank-statements' ? <CreditCard className="h-5 w-5" />
    : activeTab === 'reports' ? <Package className="h-5 w-5" />
    : <Landmark className="h-5 w-5" />;
  const title = activeTab === 'invoices' ? 'Számla feltöltési'
    : activeTab === 'vouchers' ? 'Pénztárbizonylat feltöltési'
    : activeTab === 'salaries' ? 'Bér/járulék feltöltési'
    : activeTab === 'bank-statements' ? 'Bankkivonat feltöltési'
    : activeTab === 'reports' ? 'Riport feltöltési'
    : 'Tranzakció feltöltési';

  const isValidTab = activeTab === 'invoices' || activeTab === 'vouchers' || activeTab === 'transactions' || activeTab === 'salaries' || activeTab === 'bank-statements' || activeTab === 'reports';

  // ── Main data query (records + processed IDs + user names) ──
  const { data, isLoading: loading } = useQuery({
    queryKey: queryKeys.uploadHistory(companyId, activeTab, uploadDateFrom, uploadDateTo),
    queryFn: async () => {
      let records: UploadRecord[] = [];

      if (activeTab === 'salaries') {
        // Payroll uploads are stored in invoice_uploads with document_category = 'payroll'
        const query = supabase
          .from('invoice_uploads')
          .select('id, file_name, file_size, file_type, file_url, user_id, upload_status, processing_status, created_at, error_message, metadata')
          .eq('document_category', 'payroll')
          .gte('created_at', uploadDateFrom)
          .lte('created_at', uploadDateTo + 'T23:59:59')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(50);

        const companyQuery = companyId ? query.eq('company_id', companyId) : query;
        const res = await companyQuery;
        if (res.error) throw res.error;
        records = (res.data as unknown as UploadRecord[]) || [];
      } else if (activeTab === 'vouchers') {
        // Cash vouchers are stored in invoice_uploads with document_category = 'penztarbizonylat'
        const query = supabase
          .from('invoice_uploads')
          .select('id, file_name, file_size, file_type, file_url, user_id, upload_status, processing_status, created_at, error_message, metadata')
          .eq('document_category', 'penztarbizonylat')
          .gte('created_at', uploadDateFrom)
          .lte('created_at', uploadDateTo + 'T23:59:59')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(50);

        const companyQuery = companyId ? query.eq('company_id', companyId) : query;
        const res = await companyQuery;
        if (res.error) throw res.error;
        records = (res.data as unknown as UploadRecord[]) || [];
      } else {
        let query: any = (supabase as any)
          .from(tableName)
          .select('id, file_name, file_size, file_type, file_url, user_id, upload_status, processing_status, created_at, error_message, metadata')
          .gte('created_at', uploadDateFrom)
          .lte('created_at', uploadDateTo + 'T23:59:59')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(50);

        if (companyId) {
          query = query.eq('company_id', companyId);
        }

        // Exclude payroll and voucher uploads from invoice history
        if (activeTab === 'invoices') {
          query = query.neq('document_category', 'payroll').neq('document_category', 'penztarbizonylat');
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

      // Reports: check courier_reports for processed upload IDs
      if (activeTab === 'reports' && uploadIds.length > 0 && companyId) {
        const { data: reportRows } = await supabase
          .from('courier_reports')
          .select('upload_id')
          .eq('company_id', companyId)
          .in('upload_id', uploadIds);
        processedIds = new Set(
          (reportRows || []).map((r: any) => r.upload_id).filter(Boolean) as string[]
        );
      }

      return { records, processedIds, userNames };
    },
    enabled: !!user && !!companyId && isValidTab,
    // Auto-refetch every 3s while any record is still being processed,
    // so users see the 'Feldolgozás alatt' → 'Feldolgozva' transition live.
    refetchInterval: (query) => {
      const recs = query.state.data?.records || [];
      const hasActiveJobs = recs.some(
        (r: UploadRecord) => processingStatuses.has(r.processing_status) || pendingStatuses.has(r.processing_status)
      );
      // Also keep polling if the newest record was created in the last 90s
      // (covers CMR/nalog detection which can take 30-60s with Vision OCR fallback)
      const newestCreatedAt = recs[0]?.created_at;
      const recentUpload = newestCreatedAt && (Date.now() - new Date(newestCreatedAt).getTime()) < 90_000;
      return (hasActiveJobs || recentUpload) ? 3000 : false;
    },
  });

  const records = data?.records || [];
  const processedUrls = data?.processedIds || new Set<string>();
  const userNames = data?.userNames || {};

  // ── Detect status transitions: pending/processing → completed ──
  // When polling picks up that a file just finished processing,
  // show a toast and refresh the relevant page cache.
  
  // Clear previous status tracking on tab switch to avoid false transitions
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevStatusMap.current.clear();
      prevTabRef.current = activeTab;
    }
  }, [activeTab]);

  useEffect(() => {
    if (!records.length) return;

    for (const rec of records) {
      const prevStatus = prevStatusMap.current.get(rec.id);
      const curStatus = rec.processing_status;

      // Transition detected: was active (pending/processing) → now completed
      // This acts as a FALLBACK for cases where the Realtime event was missed.
      // CMR/transport document toasts are handled globally by LiveNotificationProvider.
      // Skip if LiveNotificationProvider (session poll or catch-up) already showed a toast.
      if (prevStatus && activeStatuses.has(prevStatus) && doneStatuses.has(curStatus)) {
        if (!isUploadNotified(rec.id)) {
          // Tab-aware toast title
          const toastTitle = activeTab === 'invoices' ? 'Számlák feldolgozva!'
            : activeTab === 'vouchers' ? 'Pénztárbizonylatok feldolgozva!'
            : activeTab === 'salaries' ? 'Bér/járulékok feldolgozva!'
            : activeTab === 'bank-statements' ? 'Bankkivonat feldolgozva!'
            : activeTab === 'reports' ? 'Riport feldolgozva!'
            : 'Tranzakciók feldolgozva!';

          toast({
            title: toastTitle,
            description: rec.metadata?.multi_invoice
              ? `${rec.file_name} — ${rec.metadata.invoice_count_processed || 0} számla sikeresen feldolgozva.`
              : `${rec.file_name} sikeresen fel lett dolgozva.`,
            variant: 'default',
            duration: 5000,
          });
        }

        // Tab-aware cache invalidation
        if (activeTab === 'invoices') {
          queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] });
          queryClient.invalidateQueries({ queryKey: ['filteredSubmittedInvoices'] });
          queryClient.invalidateQueries({ queryKey: ['recentInvoices'] });
        } else if (activeTab === 'vouchers') {
          queryClient.invalidateQueries({ queryKey: ['pettyCashEntries'] });
        } else if (activeTab === 'salaries') {
          queryClient.invalidateQueries({ queryKey: ['salaries'] });
          queryClient.invalidateQueries({ queryKey: ['salary_files'] });
        } else if (activeTab === 'bank-statements') {
          queryClient.invalidateQueries({ queryKey: ['bankStatements'] });
        } else if (activeTab === 'reports') {
          queryClient.invalidateQueries({ queryKey: ['courierReports'] });
        } else {
          queryClient.invalidateQueries({ queryKey: ['transactions'] });
        }
        // Always refresh dashboard + upload history
        queryClient.invalidateQueries({ queryKey: ['dashboardData'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardAnalytics'] });
        queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
      }

      // Update tracked state
      prevStatusMap.current.set(rec.id, curStatus);
    }
  }, [records, queryClient, activeTab]);


  if (!isValidTab) {
    return null;
  }

  return (
    <>
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
                        {record.file_url ? (
                          <button
                            type="button"
                            className="text-primary hover:underline cursor-pointer text-left truncate max-w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewFile({ name: record.file_name, url: record.file_url });
                              setPreviewLoading(true);
                              setPreviewError(false);
                            }}
                          >
                            {record.file_name}
                          </button>
                        ) : (
                          record.file_name
                        )}
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
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant={status.variant}
                              className={`text-xs${record.processing_status === 'cmr_escalated' ? ' cursor-pointer hover:ring-2 hover:ring-orange-400/50' : ''}`}
                              onClick={record.processing_status === 'cmr_escalated' ? (e: React.MouseEvent) => { e.stopPropagation(); setEscalationUpload(record); } : undefined}
                            >
                              {status.label}
                            </Badge>
                            {status.multiProgress && (
                              <span className="text-[11px] text-muted-foreground font-medium">
                                ({status.multiProgress})
                              </span>
                            )}
                          </div>
                          {record.metadata?.multi_invoice && processingStatuses.has(record.processing_status) && (
                            <div className="w-full max-w-[120px] h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{
                                  width: `${Math.min(100, Math.round(((record.metadata.invoice_count_processed || 0) / (record.metadata.invoice_count_total || 1)) * 100))}%`
                                }}
                              />
                            </div>
                          )}
                          {record.error_message && record.error_message.trim().toLowerCase().replace(/\.$/, '') !== 'job completed' && (
                            <p className={`text-xs max-w-[150px] truncate ${(processingErrorStatuses.has(record.processing_status) || uploadErrorStatuses.has(record.processing_status)) ? 'text-destructive' : 'text-muted-foreground'}`} title={record.error_message}>
                              {record.error_message.startsWith('Extraction error') ? 'Extraction hiba' : record.error_message}
                            </p>
                          )}
                        </div>
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
                <Badge variant="destructive" className="text-xs">Feldolgozási hiba</Badge>
                <span className="text-xs text-muted-foreground">— A feltöltés sikerült, de a feldolgozás hibára futott</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs">Nem beazonosítható</Badge>
                <span className="text-xs text-muted-foreground">— A dokumentum nem volt felismerhető számlaként</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs">Elutasítva</Badge>
                <span className="text-xs text-muted-foreground">— A dokumentum manuálisan el lett utasítva</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* File Preview Modal */}
    <Dialog open={!!previewFile} onOpenChange={(open) => { if (!open) setPreviewFile(null); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{previewFile?.name}</DialogTitle>
          <DialogDescription>Feltöltött fájl előnézete</DialogDescription>
        </DialogHeader>
        <div className="mt-4 overflow-auto max-h-[calc(90vh-120px)]">
          {previewFile && (() => {
            const url = previewFile.url;
            const ext = (previewFile.name.split('.').pop() || '').toLowerCase();
            const isPDF = ext === 'pdf';
            const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
            const isCsv = ['csv', 'tsv'].includes(ext);
            const isExcel = ['xls', 'xlsx', 'xlsm'].includes(ext);

            if (previewError) {
              return (
                <div className="text-center py-12 space-y-4">
                  <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                  <p className="text-muted-foreground">Hiba történt a fájl betöltése közben</p>
                  <Button variant="outline" onClick={() => window.open(url, '_blank')}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Megnyitás új ablakban
                  </Button>
                </div>
              );
            }

            return (
              <>
                {previewLoading && !isCsv && !isExcel && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p>Betöltés...</p>
                  </div>
                )}
                {isPDF ? (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank')}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Megnyitás új ablakban
                      </Button>
                    </div>
                    <iframe
                      src={url}
                      className="w-full h-[60vh] border rounded"
                      title={previewFile.name}
                      onLoad={() => setPreviewLoading(false)}
                      onError={() => { setPreviewError(true); setPreviewLoading(false); }}
                    />
                  </div>
                ) : isImage ? (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank')}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Megnyitás új ablakban
                      </Button>
                    </div>
                    <img
                      src={url}
                      alt={previewFile.name}
                      className="w-full h-auto rounded"
                      onLoad={() => setPreviewLoading(false)}
                      onError={() => { setPreviewError(true); setPreviewLoading(false); }}
                    />
                  </div>
                ) : isCsv ? (
                  <CsvPreviewComponent url={url} />
                ) : isExcel ? (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <Button variant="outline" size="sm" onClick={() => window.open(url, '_blank')}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Megnyitás új ablakban
                      </Button>
                    </div>
                    <iframe
                      src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`}
                      className="w-full h-[60vh] border rounded bg-background"
                      title={previewFile.name}
                    />
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-4">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground">Ez a fájltípus nem megjeleníthető előnézetben</p>
                    <Button variant="default" onClick={() => window.open(url, '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Megnyitás új ablakban
                    </Button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </DialogContent>
    </Dialog>

    {/* CMR Escalation Dialog */}
    {escalationUpload && (
      <Suspense fallback={null}>
        <CMREscalationDialog
          upload={escalationUpload}
          open={!!escalationUpload}
          onClose={() => setEscalationUpload(null)}
          onResolved={() => {
            setEscalationUpload(null);
            queryClient.invalidateQueries({ queryKey: ['uploadHistory'] });
            queryClient.invalidateQueries({ queryKey: ['submittedInvoices'] });
          }}
        />
      </Suspense>
    )}
    </>
  );
}

function CsvPreviewComponent({ url }: { url: string }) {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    fetch(url)
      .then(res => res.text())
      .then(text => {
        setContent(text);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [url]);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2 py-12">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-xs">Nem sikerült betölteni a CSV tartalmát.</p>
      </div>
    );
  }

  const lines = content.split('\n').filter(line => line.trim().length > 0).slice(0, 100);
  const rows = lines.map(line => {
    const delimiter = line.includes(';') ? ';' : ',';
    return line.split(delimiter);
  });

  return (
    <div className="w-full h-full overflow-auto p-4 bg-background">
      <div className="border border-border/40 rounded-lg overflow-x-auto">
        <table className="w-full text-[11px] font-mono border-collapse">
          <tbody>
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className={`border-b border-border/20 ${rIdx === 0 ? 'bg-muted/50 font-bold text-foreground' : 'hover:bg-muted/20 text-muted-foreground'}`}>
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-1.5 border-r border-border/25 whitespace-nowrap">
                    {cell.replace(/^"|"$/g, '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lines.length === 100 && (
        <p className="text-[10px] text-muted-foreground mt-2 text-center">Csak az első 100 sor jelenik meg előnézetben.</p>
      )}
    </div>
  );
}