import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { CircleCheckBig } from 'lucide-react';

/**
 * Lightweight global hook — polls for PDF export job status changes
 * and shows toast notifications when an export completes or fails.
 *
 * Mounted in AppLayout so it works regardless of which page the user is on.
 * Does NOT handle downloads/banners — that's usePdfExport's job on the InvoicesPage.
 *
 * Only toasts on STATUS TRANSITIONS (processing → completed), never on
 * initial load. This avoids stale toasts without needing localStorage/sessionStorage.
 */
export function usePdfExportNotifications() {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const companyId = selectedCompany?.id;
  const userId = user?.id;

  // Track the previous status to detect transitions
  const prevStatusRef = useRef<string | null>(null);

  const { data: activeJob } = useQuery({
    queryKey: ['pdf-export-notify', companyId, userId],
    queryFn: async () => {
      if (!companyId || !userId) return null;

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from('pdf_export_jobs' as any)
        .select('id, status, total_invoices, error_message')
        .eq('company_id', companyId)
        .eq('user_id', userId)
        .in('status', ['queued', 'processing', 'completed', 'error'])
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      return data?.[0] ?? null;
    },
    enabled: !!companyId && !!userId,
    refetchInterval: (query) => {
      const job = query.state.data as any;
      if (job && (job.status === 'queued' || job.status === 'processing')) {
        return 3000; // Fast poll while job is active
      }
      return 15000; // Slow poll to detect new exports
    },
  });

  useEffect(() => {
    if (!activeJob) {
      prevStatusRef.current = null;
      return;
    }

    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = activeJob.status;

    // First load — record status but don't toast
    if (prevStatus === null) return;

    // No change — skip
    if (prevStatus === activeJob.status) return;

    // ── Transition detected ──

    if (activeJob.status === 'completed') {
      toast({
        title: 'PDF export kész!',
        description: `${activeJob.total_invoices} számla exportálva. Menj a Számlák menübe a letöltéshez.`,
        icon: CircleCheckBig,
      });
    }

    if (activeJob.status === 'error') {
      toast({
        title: 'Export hiba',
        description: activeJob.error_message || 'A feldolgozás közben hiba történt',
        variant: 'destructive',
      });
    }
  }, [activeJob?.id, activeJob?.status, toast]);
}
