import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { createElement } from 'react';

/**
 * Listens on Supabase Realtime for INSERT events on data tables.
 * When rows are inserted from a new file upload, shows a success toast.
 * Uses a Set to debounce so each upload ID only triggers one notification per session.
 */
export function LiveNotificationProvider() {
  const { selectedCompany } = useCompany();
  const queryClient = useQueryClient();
  const companyId = selectedCompany?.id;
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Track already-notified upload IDs to prevent duplicate toasts
  const notifiedUploads = useRef<Set<string>>(new Set());

  const showNotification = useCallback(async (
    uploadId: string,
    parentTable: 'salary_files' | 'invoice_uploads' | 'transaction_uploads',
    invalidateKeys: string[]
  ) => {
    // Anti-spam: skip if already notified for this upload
    if (notifiedUploads.current.has(uploadId)) return;
    notifiedUploads.current.add(uploadId);

    try {
      // Look up the file name from the parent upload table
      const { data } = await supabase
        .from(parentTable)
        .select('file_name')
        .eq('id', uploadId)
        .single();

      const fileName = data?.file_name || 'Ismeretlen fájl';

      toast.success('Gratulálunk!', {
        description: `A következő fájl sikeresen fel lett dolgozva: ${fileName}`,
        duration: 7000,
        icon: createElement(CheckCircle2, { className: 'h-5 w-5 text-emerald-500' }),
      });
    } catch (err) {
      console.error('[LiveNotifications] File lookup failed:', err);
      toast.success('Gratulálunk!', {
        description: 'Egy fájl sikeresen fel lett dolgozva!',
        duration: 7000,
        icon: createElement(CheckCircle2, { className: 'h-5 w-5 text-emerald-500' }),
      });
    }

    // Invalidate relevant caches
    invalidateKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: [key, companyId] });
    });
  }, [queryClient, companyId]);

  useEffect(() => {
    if (!companyId) return;

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Reset notified set when company changes
    notifiedUploads.current.clear();

    const channel = supabase
      .channel(`live-notifications-${companyId}`)

      // salary table: INSERT with salary_file_id
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'salary',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row.salary_file_id) {
            showNotification(row.salary_file_id, 'salary_files', [
              'salary_files', 'salaries',
            ]);
          }
        }
      )

      // invoices table: INSERT with invoice_uploads_id
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'invoices',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row.invoice_uploads_id) {
            showNotification(row.invoice_uploads_id, 'invoice_uploads', [
              'invoices', 'invoice_uploads_with_invoices',
            ]);
          }
        }
      )

      // transactions table: INSERT with upload_id
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = payload.new as any;
          if (row.upload_id) {
            showNotification(row.upload_id, 'transaction_uploads', [
              'transactions',
            ]);
          }
        }
      )

      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [companyId, showNotification]);

  return null; // Renderless component
}
