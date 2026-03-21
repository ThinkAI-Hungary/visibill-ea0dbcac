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

  /** Check if the event belongs to the current company.
   *  If company_id is missing from payload (e.g. DELETE event), accept it —
   *  RLS already ensures only authorized events reach the client.
   */
  const isMyCompany = useCallback((payload: any): boolean => {
    const row = payload.new || payload.old;
    if (!row?.company_id) return true; // Accept if company_id not in payload
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
      duration: 8000,
      icon: createElement(CheckCircle2, { className: 'h-5 w-5 text-emerald-500' }),
    });
  }, []);

  // ── Debounced cache invalidation (500ms) ──
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const invalidate = useCallback((...keys: string[]) => {
    const cacheKey = keys.sort().join(',');
    // Clear existing timer for this key set
    const existing = debounceTimers.current.get(cacheKey);
    if (existing) clearTimeout(existing);
    // Set new timer — fires once after 500ms of no new events
    debounceTimers.current.set(cacheKey, setTimeout(() => {
      keys.forEach(key => {
        queryClientRef.current.invalidateQueries({ queryKey: [key] });
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
          invalidate('salaries', 'salary_files');
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
          invalidate('salary_files', 'salaries');
        }
      )

      // ━━ INVOICES table ━━
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        (payload) => {
          if (!isMyCompany(payload)) return;
          console.log('[RealtimeSync] invoices', payload.eventType);
          invalidate('invoices', 'invoice_uploads_with_invoices', 'nav_invoices');
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
          invalidate('invoice_uploads_with_invoices', 'invoices');
        }
      )

      // ━━ TRANSACTIONS table ━━
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        (payload) => {
          if (!isMyCompany(payload)) return;
          console.log('[RealtimeSync] transactions', payload.eventType);
          invalidate('transactions');
          if (payload.eventType === 'INSERT') {
            const row = payload.new as any;
            if (row.upload_id) {
              showNotification(row.upload_id, 'transaction_uploads');
            }
          }
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
        invalidate('salaries', 'salary_files', 'invoices', 'invoice_uploads_with_invoices', 'nav_invoices', 'transactions');
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      // Clean up debounce timers
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
