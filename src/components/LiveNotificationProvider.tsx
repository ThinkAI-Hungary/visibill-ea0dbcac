import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';
import { Truck, AlertTriangle, FileText, CheckCircle, Bell, ClipboardCheck, Banknote } from 'lucide-react';

/**
 * Module-level registry of upload IDs that this browser session is
 * waiting for. Components call registerPendingUpload(id) immediately
 * after inserting a row into invoice_uploads. The provider polls every
 * 5 s until all IDs reach a terminal status, then stops.
 *
 * Module-level (not React state) so it survives re-renders and is
 * shared across any component that imports this file.
 */
const _pendingSessionUploads = new Set<string>();
export function registerPendingUpload(uploadId: string) {
  _pendingSessionUploads.add(uploadId);
}

/**
 * Module-level set of upload IDs for which a terminal-status toast has
 * already been shown in this browser session. UploadHistory can call
 * isUploadNotified() before showing its own fallback toast to prevent
 * duplicates when session polling and UploadHistory polling both detect
 * the same processing → completed transition.
 */
const _notifiedUploadIds = new Set<string>();
export function isUploadNotified(uploadId: string): boolean {
  return _notifiedUploadIds.has(uploadId);
}

/**
 * Global Realtime listener that:
 * 1. Shows toast notifications when new files are processed (INSERT debounced per upload ID)
 * 2. Silently invalidates TanStack Query caches on any INSERT/UPDATE/DELETE for auto-refresh
 * 3. Session-scoped catch-up polling: polls only known pending upload IDs (registered via
 *    registerPendingUpload) — stops automatically when all resolve.
 * 4. Tab-focus catch-up: when user returns after 2+ min, checks last 15 min of completions.
 *
 * NOTE: We do NOT use server-side filters because Supabase Realtime filters
 * require FULL replica identity for UPDATE/DELETE, and service-role inserts
 * may not pass through RLS-filtered channels. Instead, we listen to all events
 * and do client-side company_id matching.
 */
export function LiveNotificationProvider() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const notifiedUploads = useRef<Set<string>>(new Set());
  const lastCompanyIdRef = useRef<string | undefined>(undefined);
  const companyIdRef = useRef(companyId);
  companyIdRef.current = companyId;
  const queryClientRef = useRef(queryClient);
  const visibilityHandlerRef = useRef<(() => void) | null>(null);
  queryClientRef.current = queryClient;

  /** Check if the event belongs to the current company. */
  const isMyCompany = useCallback((payload: any): boolean => {
    const row = payload.new || payload.old;
    if (!row?.company_id) return true;
    return row.company_id === companyIdRef.current;
  }, []);


  // ── Notification toast (only for first INSERT per upload) ──
  const showNotification = useCallback(async (
    uploadId: string,
    parentTable: 'salary_files' | 'invoice_uploads' | 'transaction_uploads',
  ) => {
    if (notifiedUploads.current.has(uploadId)) return;
    notifiedUploads.current.add(uploadId);


    let fileName = 'Ismeretlen fájl';
    try {
      const { data } = await (supabase as any)
        .from(parentTable)
        .select('file_name')
        .eq('id', uploadId)
        .single();
      if (data?.file_name) fileName = data.file_name;
    } catch (err) {
      reportError({ type: 'db_query', component: 'LiveNotificationProvider', action: 'error', message: '[RealtimeSync] File lookup failed:', error: err });
    }

    toast({
      title: 'Gratulálunk!',
      description: `A következő fájl sikeresen fel lett dolgozva: ${fileName}`,
      variant: 'default',
      duration: 3000,
      icon: Bell,
    });
  }, []);

  // ── Upload status → toast + targeted cache invalidation helper ──
  // Used by session polling and tab-focus catch-up.
  // NOTE: Contains its own dedup guard (`upload_notif_{id}`) so neither session
  // polling nor catch-up can fire duplicate toasts for the same upload regardless
  // of which mechanism fires first.
  const notifyUploadStatus = useCallback((row: { id: string; file_name: string; processing_status: string; metadata?: Record<string, unknown> | null }) => {
    // Unified cross-mechanism dedup: once per upload ID, regardless of which
    // mechanism (Realtime / session poll / catch-up / UploadHistory) fires first.
    const dedupKey = `upload_notif_${row.id}`;
    if (notifiedUploads.current.has(dedupKey)) return;
    notifiedUploads.current.add(dedupKey);
    _notifiedUploadIds.add(row.id); // module-level: accessible to UploadHistory

    const fileName = row.file_name || 'Ismeretlen fájl';
    const qc = queryClientRef.current;
    const cid = companyIdRef.current;
    if (!cid) return;

    if (row.processing_status === 'processed' || row.processing_status === 'completed') {
      toast({ title: 'Számla feldolgozva!', description: `${fileName} sikeresen feldolgozva.`, variant: 'default', duration: 5000, icon: CheckCircle });
      qc.invalidateQueries({ queryKey: ['submittedInvoices', cid] });
      qc.invalidateQueries({ queryKey: ['recentInvoices', cid] });
      qc.invalidateQueries({ queryKey: ['dashboardData', cid] });
      // Refresh the uploaded files modal so status badge updates without page reload
      qc.invalidateQueries({ queryKey: ['uploadHistory'] });
      qc.invalidateQueries({ queryKey: ['uploaded-files'] });
    } else if (row.processing_status === 'cmr_attached') {
      toast({ title: 'Dokumentum párosítva!', description: `${fileName} sikeresen párosítva egy fuvarhoz.`, variant: 'default', duration: 5000, icon: Truck });
      qc.invalidateQueries({ queryKey: ['shipments-matching', cid] });
      qc.invalidateQueries({ queryKey: ['uploadHistory'] });
      qc.invalidateQueries({ queryKey: ['uploaded-files'] });
    } else if (row.processing_status === 'cmr_orphaned') {
      toast({ title: 'Dokumentum rögzítve', description: `${fileName} — vár a megfelelő számlára.`, variant: 'default', duration: 5000, icon: FileText });
      qc.invalidateQueries({ queryKey: ['uploadHistory'] });
      qc.invalidateQueries({ queryKey: ['uploaded-files'] });
    } else if (row.processing_status === 'cmr_escalated') {
      // Manuális leválasztáskor (manual_detach: true) ne jelenjen meg az eszkaláció toast
      if ((row as any).metadata?.manual_detach) return;
      toast({ title: 'Eszkaláció szükséges', description: `${fileName} — eltérés, kézi ellenőrzés szükséges.`, variant: 'destructive', duration: 8000, icon: AlertTriangle });
      qc.invalidateQueries({ queryKey: ['shipments-matching', cid] });
      qc.invalidateQueries({ queryKey: ['uploadHistory'] });
      qc.invalidateQueries({ queryKey: ['uploaded-files'] });
    }
  }, []);

  // ── Debounced cache invalidation (500ms) with companyId scoping ──
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const invalidate = useCallback((...keys: string[]) => {
    const cid = companyIdRef.current;
    if (!cid) return;
    const cacheKey = keys.sort().join(',');
    const existing = debounceTimers.current.get(cacheKey);
    if (existing) clearTimeout(existing);
    debounceTimers.current.set(cacheKey, setTimeout(() => {
      keys.forEach(key => {
        // Prefix match: [key, companyId] matches [key, companyId, dateFrom, dateTo, ...]
        queryClientRef.current.invalidateQueries({ queryKey: [key, cid] });
      });
      debounceTimers.current.delete(cacheKey);
    }, 500));
  }, []);

  useEffect(() => {
    if (!companyId) return;

    let cancelled = false;

    // Ensure the Realtime connection uses the authenticated JWT
    const initChannel = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;

      // Force the realtime connection to use the authenticated token
      supabase.realtime.setAuth(session.access_token);

      // Only clear dedup set when company actually changes
      if (lastCompanyIdRef.current !== companyId) {
        notifiedUploads.current.clear();
        lastCompanyIdRef.current = companyId;
      }

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      const channel = supabase
        .channel(`realtime-sync-${companyId}`)

        // ━━ SALARY table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'salary' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate(
              'salaries', 'salary_files',
              'dashboardData', 'dashboardAnalytics',
              'analyticsRaw', 'analyticsVat',
              'pettyCashEntries', 'uploadHistory',
            );
            if (payload.eventType === 'INSERT') {
              const row = payload.new as any;
              if (row.salary_file_id) {
                showNotification(row.salary_file_id, 'salary_files');
              }
            }
          }
        )

        // ━━ SALARY_FILES table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'salary_files' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate('salary_files', 'salaries', 'uploadHistory');
            // Show notification when salary_files status changes to 'completed' or 'webhook_sent'
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as any;
              const oldRow = payload.old as any;
              if (row.id && row.status === 'completed' && oldRow?.status !== 'completed') {
                showNotification(row.id, 'salary_files');
              }
            }
          }
        )

        // ━━ INVOICES table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'invoices' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate(
              'submittedInvoices', 'linkedInvoices', 'invoiceTransactions',
              'filteredNavInvoices', 'filteredSubmittedInvoices',
              'dashboardData', 'dashboardAnalytics',
              'kintlevo-manual', 'kintlevo-nav',
              'invoiceStatusPayable', 'invoiceStatusMissing',
              'recentInvoices', 'uploadHistory',
              'analyticsRaw', 'analyticsVat',
              'dashboardPettyCash', 'pettyCashEntries',
              'payment-transfers-history', 'due-transfer-invoices',
              'company-invoices',
            );
            if (payload.eventType === 'INSERT') {
              const row = payload.new as any;
              if (row.invoice_uploads_id) {
                showNotification(row.invoice_uploads_id, 'invoice_uploads');
              }
            }
          }
        )

        // ━━ INVOICE_UPLOADS table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'invoice_uploads' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate('uploadHistory', 'submittedInvoices', 'filteredSubmittedInvoices');
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as any;
              const oldRow = payload.old as any;

              // Invoice pipeline: 'completed' / 'processed'
              const doneStatuses = ['completed', 'processed'];
              if (row.id && doneStatuses.includes(row.processing_status) && !doneStatuses.includes(oldRow?.processing_status)) {
                showNotification(row.id, 'invoice_uploads');
              }

              // Transport doc pipeline: 'cmr_attached' → dokumentum párosítva
              if (row.id && row.processing_status === 'cmr_attached' && oldRow?.processing_status !== 'cmr_attached') {
                const attachedKey = `cmr_attached_${row.id}`;
                if (!notifiedUploads.current.has(attachedKey)) {
                  notifiedUploads.current.add(attachedKey);
                  (supabase as any).from('invoice_uploads').select('file_name').eq('id', row.id).single().then(({ data }: { data: { file_name?: string } | null }) => {
                    const fileName = data?.file_name || 'Ismeretlen fájl';
                    toast({
                      title: 'Dokumentum párosítva!',
                      description: `${fileName} sikeresen párosítva lett egy fuvarhoz.`,
                      variant: 'default',
                      duration: 5000,
                      icon: Truck,
                    });
                  });
                }
              }

              // Transport doc pipeline: 'cmr_escalated' → emberi ellenőrzés kell
              if (row.id && row.processing_status === 'cmr_escalated' && oldRow?.processing_status !== 'cmr_escalated') {
                // Manuális leválasztáskor (EscalationListPage setCmrDetachTarget) ne jelenjen meg a toast
                if (row.metadata?.manual_detach === true) {
                  // Skip cmr_escalated toast for manual_detach
                } else {
                  const escalatedKey = `cmr_escalated_${row.id}`;
                  if (!notifiedUploads.current.has(escalatedKey)) {
                    notifiedUploads.current.add(escalatedKey);
                    (supabase as any).from('invoice_uploads').select('file_name').eq('id', row.id).single().then(({ data }: { data: { file_name?: string } | null }) => {
                      const fileName = data?.file_name || 'Ismeretlen fájl';
                      toast({
                        title: 'Dokumentum eszkalálva',
                        description: `${fileName} nem párosítható automatikusan — kézi ellenőrzés szükséges.`,
                        variant: 'destructive',
                        duration: 8000,
                        icon: AlertTriangle,
                      });
                    });
                  }
                }
              }
            }
          }
        )

        // ━━ NAV_INVOICES table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'nav_invoices' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate(
              'navInvoices', 'filteredNavInvoices', 'kintlevo-nav',
              'dashboardData', 'dashboardAnalytics',
              'invoiceStatusPayable', 'invoiceStatusMissing',
              'analyticsRaw', 'analyticsVat',
              'projects', 'projectsList',
              'dashboardPettyCash',
              'payment-transfers-history', 'due-transfer-invoices',
            );
          }
        )

        // ━━ TRANSACTIONS table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transactions' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate(
              'transactions', 'salaries', 'submittedInvoices',
              'filteredNavInvoices', 'filteredSubmittedInvoices',
              'dashboardData', 'dashboardAnalytics',
              'kintlevo-nav', 'kintlevo-manual',
              'invoiceStatusPayable', 'invoiceStatusMissing',
              'invoiceTransactions', 'navInvoices',
              'pettyCashEntries', 'pettyCashSettings',
              'analyticsRaw', 'analyticsVat',
              'projects', 'projectsList',
              'dashboardPettyCash',
              'detected-banks', 'upload-bank-map', 'bank-upload-ids',
              'tx-kpis', 'bank-transactions', 'transactionFilterOptions',
              'payment-transfers-history', 'due-transfer-invoices'
            );
            queryClientRef.current.invalidateQueries({ queryKey: ['glBalances'] });
            queryClientRef.current.invalidateQueries({ queryKey: ['glItems'] });
            if (payload.eventType === 'INSERT') {
              const row = payload.new as any;
              if (row.upload_id) {
                showNotification(row.upload_id, 'transaction_uploads');
              }
            }
          }
        )

        // ━━ PAYMENT_TRANSFERS table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'payment_transfers' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate('payment-transfers-history', 'due-transfer-invoices');
          }
        )

        // ━━ PARTNERS table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'partners' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate('partners', 'partnersFull', 'kintlevo-nav', 'kintlevo-manual');
          }
        )

        // ━━ Upload tables (for upload history) ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transaction_uploads' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate('uploadHistory', 'transactions');
            // Show notification + refresh transactions when processing completes
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as any;
              if (row.id && row.processing_status === 'completed') {
                // Use a dedicated key to avoid conflicts with the transactions INSERT listener
                const completionKey = `completion_${row.id}`;
                if (!notifiedUploads.current.has(completionKey)) {
                  notifiedUploads.current.add(completionKey);
                  // Fetch file name for the toast
                  (supabase as any).from('transaction_uploads').select('file_name').eq('id', row.id).single().then(({ data }: { data: { file_name?: string } | null }) => {
                    const fileName = data?.file_name || 'Ismeretlen fájl';
                    toast({
                      title: 'Tranzakciók feldolgozva!',
                      description: `A következő fájl sikeresen fel lett dolgozva: ${fileName}`,
                      variant: 'default',
                      duration: 5000,
                      icon: Banknote,
                    });
                  });
                }
                // Force immediate invalidation of transactions (no debounce)
                queryClientRef.current.invalidateQueries({ queryKey: ['transactions'] });
              }
            }
          }
        )

        // ━━ CATEGORIES table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'categories' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate(
              'categories', 'filteredNavInvoices', 'filteredSubmittedInvoices',
              'navInvoices', 'submittedInvoices',
            );
          }
        )

        // ━━ PROJECTS table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'projects' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate(
              'projects', 'projectsList',
              'filteredNavInvoices', 'filteredSubmittedInvoices',
              'navInvoices', 'submittedInvoices',
            );
          }
        )

        // ━━ DUNNING_SENDS table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'dunning_sends' },
          (payload) => {
            invalidate('dunning-sends', 'kintlevo-nav');
          }
        )

        // ━━ NAV_INVOICE_ITEMS table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'nav_invoice_items' },
          (payload) => {
            invalidate('invoiceItems', 'filteredNavInvoices', 'analyticsVat');
            // GL queries have presetId (not companyId) in position 2, so invalidate directly
            queryClientRef.current.invalidateQueries({ queryKey: ['glBalances'] });
            queryClientRef.current.invalidateQueries({ queryKey: ['glItems'] });
          }
        )

        // ━━ INVOICE_ITEMS table (submitted/manual invoices) ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'invoice_items' },
          (payload) => {
            invalidate('invoiceItems', 'filteredSubmittedInvoices', 'analyticsVat');
            queryClientRef.current.invalidateQueries({ queryKey: ['glBalances'] });
            queryClientRef.current.invalidateQueries({ queryKey: ['glItems'] });
          }
        )


        // ━━ NAV_SYNC_LOGS table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'nav_sync_logs' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate('syncLogs', 'navInvoices', 'filteredNavInvoices');
          }
        )

        // ━━ REPORT_UPLOADS table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'report_uploads' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate('uploadHistory', 'courier-reports');
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as any;
              const doneStatuses = ['completed', 'processed'];
              if (row.id && doneStatuses.includes(row.processing_status)) {
                const completionKey = `report_${row.id}`;
                if (!notifiedUploads.current.has(completionKey)) {
                  // Verify this is a genuine new completion by checking created_at
                  // If the report was completed more than 30s ago, it's a stale replay — skip
                  const createdAt = row.updated_at || row.created_at;
                  const ageMs = createdAt ? Date.now() - new Date(createdAt).getTime() : Infinity;
                  if (ageMs > 30_000) {
                    notifiedUploads.current.add(completionKey); // Suppress future replays
                    return;
                  }
                  notifiedUploads.current.add(completionKey);
                  (supabase as any).from('report_uploads').select('file_name').eq('id', row.id).single().then(({ data }: { data: { file_name?: string } | null }) => {
                    const fileName = data?.file_name || 'Ismeretlen fájl';
                    toast({
                      title: 'Riport feldolgozva!',
                      description: `A következő riport sikeresen fel lett dolgozva: ${fileName}`,
                      variant: 'default',
                      duration: 5000,
                      icon: ClipboardCheck,
                    });
                  });
                }
              }
            }
          }
        )

        // ━━ COURIER_REPORTS table ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'courier_reports' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate('courier-reports', 'uploadHistory');
            // No per-row toast — the report_uploads completion toast is sufficient
          }
        )

        // ━━ SHIPMENTS table (HRTSPED — fuvar-számla párosítás) ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shipments' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate('shipments-matching', 'shipment-import-batches');
          }
        )

        // ━━ SHIPMENT_MATCHES table (HRTSPED — párosítás eredmény) ━━
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shipment_matches' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate('shipments-matching', 'escalated-matches');
          }
        )

        // ━━ TRANSPORT_DOCUMENTS table (HRTSPED — CMR, nalog, POD) ━━
        // Note: We toast on INSERT here (not on invoice_uploads status) because
        // retroactive rematch / filename-similarity never updates invoice_uploads.processing_status.
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'transport_documents' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            invalidate('shipments-matching', 'uploadHistory');

            if (payload.eventType === 'INSERT') {
              const row = payload.new as any;
              // Only toast for matched/orphaned docs (not unclassified noise)
              if (!row.id || !row.file_name) return;

              const toastKey = `transport_doc_${row.id}`;
              if (notifiedUploads.current.has(toastKey)) return;
              notifiedUploads.current.add(toastKey);

              const docTypeLabel: Record<string, string> = {
                cmr: 'CMR fuvarlevél',
                nalog: 'Megrendelés',
                pod: 'POD',
                other: 'Dokumentum',
              };
              const label = docTypeLabel[row.document_type] || 'Dokumentum';
              const fileName = row.file_name;

              if (row.status === 'matched') {
                toast({
                  title: `${label} párosítva!`,
                  description: `${fileName} sikeresen párosítva lett egy fuvarhoz.`,
                  variant: 'default',
                  duration: 5000,
                  icon: Truck,
                });
              } else if (row.status === 'escalated') {
                toast({
                  title: `${label} eszkalálva`,
                  description: `${fileName} nem párosítható automatikusan — kézi ellenőrzés szükséges.`,
                  variant: 'destructive',
                  duration: 8000,
                  icon: AlertTriangle,
                });
              } else if (row.status === 'orphaned') {
                // Transport doc arrived before the invoice — toast that it's registered
                toast({
                  title: `${label} feldolgozva`,
                  description: `${fileName} rögzítve — vár a megfelelő számlára.`,
                  variant: 'default',
                  duration: 5000,
                  icon: FileText,
                });
              }
            }

            // UPDATE: orphaned → matched (retroactive rematch found the invoice)
            if (payload.eventType === 'UPDATE') {
              const row = payload.new as any;
              const oldRow = payload.old as any;
              if (row.id && row.status === 'matched' && oldRow?.status !== 'matched') {
                const toastKey = `transport_doc_rematch_${row.id}`;
                if (!notifiedUploads.current.has(toastKey)) {
                  notifiedUploads.current.add(toastKey);
                  const docTypeLabel: Record<string, string> = {
                    cmr: 'CMR fuvarlevél', nalog: 'Megrendelés', pod: 'POD', other: 'Dokumentum',
                  };
                  const label = docTypeLabel[row.document_type] || 'Dokumentum';
                  toast({
                    title: `${label} utólag párosítva!`,
                    description: `${row.file_name} párosítva lett egy fuvarhoz.`,
                    variant: 'default',
                    duration: 5000,
                    icon: Truck,
                  });
                }
              }
            }
          }
        )

        // ── PDF Export Jobs: toast when export completes ──
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'pdf_export_jobs' },
          (payload) => {
            if (!isMyCompany(payload)) return;
            const row = payload.new as any;

            // Toast once per completed job (dedup via notifiedUploads set)
            if (row.status === 'completed') {
              const toastKey = `pdf_export_done_${row.id}`;
              if (!notifiedUploads.current.has(toastKey)) {
                notifiedUploads.current.add(toastKey);
                toast({
                  title: 'PDF export kész!',
                  description: `${row.total_invoices || ''} számla exportálva. Navigálj a Számlák oldalra a letöltéshez.`,
                  variant: 'default',
                  duration: 8000,
                  icon: FileText,
                });

                // Also invalidate the pdf-export-job query in case the user is on InvoicesPage
                queryClientRef.current.invalidateQueries({ queryKey: ['pdf-export-job'] });
              }
            }
          }
        )

        .subscribe((status, err) => {
          // Csak a valódi hibákat logoljuk az adatbázisba.
          // A TIMED_OUT természetes jelenség (pl. tab váltáskor), a kliens újrakapcsolódik.
          const isTransient = status === 'TIMED_OUT' || status === 'CLOSED' || status === 'SUBSCRIBED';
          
          if (!isTransient) {
            console.warn('[LiveNotificationProvider]', `[RealtimeSync] Channel: ${status}`, err || '');
          }
        });

      channelRef.current = channel;

      // Reconnect on tab visibility change + conditional cache invalidation
      const hiddenAtRef_local = { current: null as number | null };

      const handleVisibility = () => {
        if (document.visibilityState === 'hidden') {
          hiddenAtRef_local.current = Date.now();
          return;
        }

        // visible — user came back
        if (!channelRef.current) return;

        const awayMs = hiddenAtRef_local.current ? Date.now() - hiddenAtRef_local.current : 0;
        hiddenAtRef_local.current = null;
        const channelState = channelRef.current.state;

        // 1. Reconnect if channel disconnected (unchanged behavior)
        if (channelState !== 'joined' && channelState !== 'joining') {
          channelRef.current.subscribe();
        }

        // 2. Decide on invalidation:
        //    - Channel was disconnected → always invalidate (may have missed events)
        //    - Channel joined BUT away > 2 minutes → invalidate (browser may
        //      have throttled/dropped WS frames)
        //    - Channel joined AND away ≤ 2 minutes → skip (Realtime kept up)
        const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
        const wasDisconnected = channelState !== 'joined' && channelState !== 'joining';

        if (wasDisconnected || awayMs > STALE_THRESHOLD_MS) {
          invalidate(
            'salaries', 'salary_files', 'submittedInvoices', 'linkedInvoices',
            'navInvoices', 'filteredNavInvoices', 'filteredSubmittedInvoices',
            'transactions', 'dashboardData', 'dashboardAnalytics',
            'kintlevo-nav', 'kintlevo-manual', 'uploadHistory',
            'analyticsRaw', 'analyticsVat', 'recentInvoices',
            'partners', 'partnersFull', 'projects', 'projectsList',
            'pettyCashEntries', 'dashboardPettyCash',
            'categories', 'dunning-sends', 'syncLogs',
            'invoiceItems', 'shipments-matching',
          );
          // Also recover any Realtime notifications missed during the away period
          catchUpToastsRef.current?.();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);

      // Store the visibility handler ref for cleanup
      visibilityHandlerRef.current = handleVisibility;
    }; // end initChannel

    initChannel();

    return () => {
      cancelled = true;
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
      }
      debounceTimers.current.forEach(timer => clearTimeout(timer));
      debounceTimers.current.clear();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [companyId, showNotification, invalidate, isMyCompany]);

  // ── AUTO-CATCH-UP & BACKFILL POLLING ──
  // Polls the latest 5 invoice_uploads and transaction_uploads for the active company every 5s.
  // This acts as a 100% reliable fallback for Supabase Realtime when events are filtered out by RLS.
  useEffect(() => {
    if (!companyId) return;

    const lastSeen = new Map<string, string>();
    const TERMINAL = new Set(['processed', 'completed', 'cmr_attached', 'cmr_orphaned', 'cmr_escalated', 'ignored', 'error', 'failed', 'webhook_failed']);

    const poll = async () => {
      try {
        // 1. Poll invoice_uploads
        const { data: invoiceData } = await (supabase as any)
          .from('invoice_uploads')
          .select('id, file_name, processing_status, created_at, metadata')

          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(5);

        for (const row of (invoiceData || []) as any[]) {
          const prevStatus = lastSeen.get(row.id);
          const isNewAndTerminal = prevStatus === undefined &&
            TERMINAL.has(row.processing_status) &&
            (Date.now() - new Date(row.created_at).getTime() < 30000);

          if ((prevStatus !== undefined && prevStatus !== row.processing_status) || isNewAndTerminal) {
            if (TERMINAL.has(row.processing_status)) {
              notifyUploadStatus(row);
            }
          }
          lastSeen.set(row.id, row.processing_status);
        }

        // 2. Poll transaction_uploads
        const { data: txData } = await (supabase as any)
          .from('transaction_uploads')
          .select('id, file_name, processing_status, created_at')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(5);

        for (const row of (txData || []) as any[]) {
          const prevStatus = lastSeen.get(row.id);
          const isNewAndTerminal = prevStatus === undefined &&
            row.processing_status === 'completed' &&
            (Date.now() - new Date(row.created_at).getTime() < 30000);

          if ((prevStatus !== undefined && prevStatus !== row.processing_status) || isNewAndTerminal) {
            if (row.processing_status === 'completed') {
              toast({
                title: 'Tranzakciók feldolgozva!',
                description: `A következő fájl sikeresen fel lett dolgozva: ${row.file_name || 'Ismeretlen fájl'}`,
                variant: 'default',
                duration: 5000,
                icon: Banknote,
              });
              // Invalidate transactions related queries
              queryClientRef.current.invalidateQueries({ queryKey: ['transactions', companyId] });
              queryClientRef.current.invalidateQueries({ queryKey: ['tx-kpis', companyId] });
              queryClientRef.current.invalidateQueries({ queryKey: ['detected-banks', companyId] });
              queryClientRef.current.invalidateQueries({ queryKey: ['upload-bank-map', companyId] });
              queryClientRef.current.invalidateQueries({ queryKey: ['bank-upload-ids', companyId] });
              queryClientRef.current.invalidateQueries({ queryKey: ['bank-transactions', companyId] });
            }
          }
          lastSeen.set(row.id, row.processing_status);
        }
      } catch (err) {
        // Silent fallback
      }
    };

    // Run once immediately on mount/company change
    poll();

    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [companyId, notifyUploadStatus]);

  // ── TAB FOCUS CATCH-UP ──
  // Exported as a standalone ref so the Realtime useEffect can call it from
  // its own handleVisibility closure without creating circular deps.
  const catchUpToastsRef = useRef<(() => Promise<void>) | null>(null);
  catchUpToastsRef.current = useCallback(async () => {
    const cid = companyIdRef.current;
    if (!cid) return;
    const since = new Date(Date.now() - 15 * 60_000).toISOString(); // last 15 min
    try {
      const { data } = await (supabase as any)
        .from('invoice_uploads')
        .select('id, file_name, processing_status')
        .eq('company_id', cid)
        .in('processing_status', ['processed', 'completed', 'cmr_attached', 'cmr_orphaned', 'cmr_escalated'])
        .gte('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(10);

      for (const row of (data || [])) {
        const key = `catchup_${row.processing_status}_${row.id}`;
        if (notifiedUploads.current.has(key)) continue;
        notifiedUploads.current.add(key);
        notifyUploadStatus(row);
      }
    } catch {
      // Silent
    }
  }, [notifyUploadStatus]) as () => Promise<void>;

  return null;
}
