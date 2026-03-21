import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { createElement } from 'react';

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

    toast.success('Gratulálunk!', {
      id: `file-processed-${uploadId}`,
      description: `A következő fájl sikeresen fel lett dolgozva: ${fileName}`,
      duration: 5000,
      icon: createElement(CheckCircle2, { className: 'h-5 w-5 text-emerald-500' }),
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

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    notifiedUploads.current.clear();

    console.log('[RealtimeSync] Subscribing (no server filter) for company:', companyId);

    const channel = supabase
      .channel(`realtime-sync-${companyId}`)

      // ━━ SALARY table ━━
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'salary' },
        (payload) => {
          if (!isMyCompany(payload)) return;
          console.log('[RealtimeSync] salary', payload.eventType);
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
          console.log('[RealtimeSync] salary_files', payload.eventType);
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
          console.log('[RealtimeSync] invoices', payload.eventType);
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
          console.log('[RealtimeSync] invoice_uploads', payload.eventType);
          invalidate('uploadHistory', 'submittedInvoices', 'filteredSubmittedInvoices');
          // Show notification when processing_status changes to 'completed'
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as any;
            const oldRow = payload.old as any;
            if (row.id && row.processing_status === 'completed' && oldRow?.processing_status !== 'completed') {
              console.log('[RealtimeSync] 🔔 invoice_uploads status → completed:', row.id);
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
          console.log('[RealtimeSync] nav_invoices', payload.eventType);
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
          console.log('[RealtimeSync] transactions', payload.eventType);
          invalidate(
            'transactions', 'salaries', 'submittedInvoices',
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
          console.log('[RealtimeSync] partners', payload.eventType);
          invalidate('partners', 'kintlevo-nav', 'kintlevo-manual');
        }
      )

      // ━━ Upload tables (for upload history) ━━
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transaction_uploads' },
        (payload) => {
          if (!isMyCompany(payload)) return;
          console.log('[RealtimeSync] transaction_uploads', payload.eventType);
          invalidate('uploadHistory', 'transactions');
        }
      )

      .subscribe((status, err) => {
        console.log('[RealtimeSync] Status:', status, err || '');
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
          'navInvoices', 'transactions', 'dashboardData', 'dashboardAnalytics',
          'kintlevo-nav', 'kintlevo-manual', 'uploadHistory',
          'analyticsRaw', 'analyticsVat', 'recentInvoices',
          'partners', 'projects', 'projectsList',
          'pettyCashEntries', 'dashboardPettyCash',
        );
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
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
