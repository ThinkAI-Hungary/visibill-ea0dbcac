import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

/**
 * Global Realtime listener that:
 * 1. Shows toast notifications when new files are processed (INSERT debounced per upload ID)
 * 2. Silently invalidates TanStack Query caches on any INSERT/UPDATE/DELETE for auto-refresh
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

    console.log('[RealtimeSync] 🔔 New file processed:', parentTable, uploadId);

    let fileName = 'Ismeretlen fájl';
    try {
      const { data } = await supabase
        .from(parentTable)
        .select('file_name')
        .eq('id', uploadId)
        .single();
      if (data?.file_name) fileName = data.file_name;
    } catch (err) {
      console.error('[RealtimeSync] File lookup failed:', err);
    }

    toast({
      title: 'Gratulálunk!',
      description: `A következő fájl sikeresen fel lett dolgozva: ${fileName}`,
      variant: 'default',
      duration: 3000,
    });
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

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      notifiedUploads.current.clear();

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
              console.log('[RealtimeSync] 🔔 salary_files status → completed:', row.id);
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
            'dashboardPettyCash',
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
          // Show notification when processing_status changes to 'completed'
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as any;
            const oldRow = payload.old as any;
            const doneStatuses = ['completed', 'processed'];
            if (row.id && doneStatuses.includes(row.processing_status) && !doneStatuses.includes(oldRow?.processing_status)) {
              console.log('[RealtimeSync] 🔔 invoice_uploads status → done:', row.id);
              showNotification(row.id, 'invoice_uploads');
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
          );
          if (payload.eventType === 'INSERT') {
            const row = payload.new as any;
            if (row.upload_id) {
              showNotification(row.upload_id, 'transaction_uploads');
            }
          }
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
          // Show notification when processing_status changes to 'completed'
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as any;
            const oldRow = payload.old as any;
            if (row.id && row.processing_status === 'completed' && oldRow?.processing_status !== 'completed') {
              console.log('[RealtimeSync] 🔔 transaction_uploads status → completed:', row.id);
              showNotification(row.id, 'transaction_uploads');
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
          console.log('[RealtimeSync] dunning_sends', payload.eventType);
          invalidate('dunning-sends', 'kintlevo-nav');
        }
      )

      // ━━ NAV_INVOICE_ITEMS table ━━
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nav_invoice_items' },
        (payload) => {
          invalidate('invoiceItems', 'filteredNavInvoices', 'analyticsVat');
        }
      )

      // ━━ INVOICE_ITEMS table (submitted/manual invoices) ━━
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoice_items' },
        (payload) => {
          invalidate('invoiceItems', 'filteredSubmittedInvoices', 'analyticsVat');
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

      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[RealtimeSync] ✅ Connected');
        } else {
          console.warn('[RealtimeSync] Channel:', status, err || '');
        }
      });

    channelRef.current = channel;

    // Reconnect on tab visibility change
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && channelRef.current) {
        const state = channelRef.current.state;
        if (state !== 'joined' && state !== 'joining') {
          console.log('[RealtimeSync] Reconnecting on tab focus...');
          channelRef.current.subscribe();
        }
        // Broad invalidation on tab refocus to catch any missed events
        invalidate(
          'salaries', 'salary_files', 'submittedInvoices', 'linkedInvoices',
          'navInvoices', 'filteredNavInvoices', 'filteredSubmittedInvoices',
          'transactions', 'dashboardData', 'dashboardAnalytics',
          'kintlevo-nav', 'kintlevo-manual', 'uploadHistory',
          'analyticsRaw', 'analyticsVat', 'recentInvoices',
          'partners', 'partnersFull', 'projects', 'projectsList',
          'pettyCashEntries', 'dashboardPettyCash',
          'categories', 'dunning-sends', 'syncLogs',
          'invoiceItems',
        );
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

  return null;
}
