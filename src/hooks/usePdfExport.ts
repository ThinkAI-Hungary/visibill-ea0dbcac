import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { reportError } from '@/lib/errorReporter';

// ─── Types ─────────────────────────────────────────────────

export interface PdfExportJob {
  id: string;
  company_id: string;
  user_id: string;
  status: 'queued' | 'processing' | 'completed' | 'error' | 'cancelled' | 'downloaded' | 'expired';
  date_from: string;
  date_to: string;
  invoice_direction: string | null;
  total_invoices: number;
  processed_invoices: number;
  current_invoice_name: string | null;
  result_urls: string[] | null;
  result_sizes: number[] | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface ExportParams {
  dateFrom: string;
  dateTo: string;
  invoiceDirection?: 'INBOUND' | 'OUTBOUND' | null;
}

export interface PdfExportState {
  /** Whether an export is currently running */
  isExporting: boolean;
  /** Whether the EF invoke is in flight (dialog shows spinner) */
  isStarting: boolean;
  /** The current active job (null if none) */
  activeJob: PdfExportJob | null;
  /** Progress percentage 0-100 */
  progress: number;
  /** Whether the export dialog is open */
  dialogOpen: boolean;
  /** Open the time-period selection dialog */
  openDialog: () => void;
  /** Close the dialog */
  closeDialog: () => void;
  /** Start an export with the given parameters */
  startExport: (params: ExportParams) => Promise<void>;
  /** Cancel the current export */
  cancelExport: () => Promise<void>;
  /** Dismiss the completed/error banner */
  dismissBanner: () => void;
  /** Manually retry the download */
  retryDownload: () => Promise<void>;
  /** Whether to show the banner */
  showBanner: boolean;
}

// ─── Hook ──────────────────────────────────────────────────

// Track which jobs we've already auto-downloaded in this browser session
const AUTO_DL_STORAGE_KEY = 'pdf-export-auto-downloaded';

function getAutoDownloadedJobIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(AUTO_DL_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function markJobAutoDownloaded(jobId: string) {
  try {
    const ids = getAutoDownloadedJobIds();
    ids.add(jobId);
    sessionStorage.setItem(AUTO_DL_STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // sessionStorage might be full or disabled
  }
}

export function usePdfExport(): PdfExportState {
  const { selectedCompany } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [completedDownloaded, setCompletedDownloaded] = useState<string | null>(null);
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const companyId = selectedCompany?.id;

  // ── Query: Active job for this company ────────────────────

  const { data: activeJob } = useQuery<PdfExportJob | null>({
    queryKey: ['pdf-export-job', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      // First check for active (running) jobs
      const { data: activeJobs, error } = await supabase
        .from('pdf_export_jobs' as any)
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['queued', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        reportError({ type: 'db_query', component: 'usePdfExport', action: 'error', message: 'Failed to query active jobs', error });
        return null;
      }

      if (activeJobs && activeJobs.length > 0) {
        return activeJobs[0] as unknown as PdfExportJob;
      }

      // Check for completed jobs within 24h that haven't been marked as 'downloaded'
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentJobs } = await supabase
        .from('pdf_export_jobs' as any)
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['completed', 'error'])
        .gte('completed_at', twentyFourHoursAgo)
        .order('completed_at', { ascending: false })
        .limit(1);

      if (recentJobs && recentJobs.length > 0) {
        const job = recentJobs[0] as unknown as PdfExportJob;
        if (job.id !== completedDownloaded) {
          return job;
        }
      }

      return null;
    },
    enabled: !!companyId,
    staleTime: 0, // Always refetch on mount — critical for navigation back
    refetchOnMount: 'always',
    refetchInterval: (query) => {
      const job = query.state.data as PdfExportJob | null | undefined;
      // Poll every 3s while worker is processing
      if (job && (job.status === 'queued' || job.status === 'processing')) {
        return 3000;
      }
      return false;
    },
  });

  // Show banner when there's an active job
  useEffect(() => {
    if (activeJob) {
      setShowBanner(true);
    }
  }, [activeJob?.id, activeJob?.status]);

  // ── Realtime subscription ─────────────────────────────────

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    let activeChannel: ReturnType<typeof supabase.channel> | null = null;

    const initChannel = async () => {
      // Ensure Realtime uses the authenticated JWT (same pattern as LiveNotificationProvider)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      supabase.realtime.setAuth(session.access_token);

      const channel = supabase
        .channel(`pdf-export-${companyId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'pdf_export_jobs',
            filter: `company_id=eq.${companyId}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['pdf-export-job', companyId] });
          }
        )
        .subscribe();

      if (!cancelled) {
        activeChannel = channel;
      } else {
        supabase.removeChannel(channel);
      }
    };

    initChannel();

    return () => {
      cancelled = true;
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [companyId, queryClient]);

  // ── Download helper (reusable for auto + manual retry) ────

  const downloadJobFiles = useCallback(async (resultUrls: string[]) => {
    for (const storagePath of resultUrls) {
      try {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('pdf-exports')
          .createSignedUrl(storagePath, 300);

        if (signedError || !signedData?.signedUrl) {
          console.error('[PDF-EXPORT] Failed to create signed URL:', signedError);
          continue;
        }

        const fileName = storagePath.split('/').pop() || 'export.pdf';
        const response = await fetch(signedData.signedUrl);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      } catch (err) {
        reportError({ type: 'db_query', component: 'usePdfExport', action: 'error', message: 'Download error', error: err });
      }
    }
  }, []);

  // ── Track if user started an export in this component lifecycle ──
  const startedExportInSessionRef = useRef(false);

  // ── Auto-download when completed ──

  useEffect(() => {
    if (!activeJob || activeJob.status !== 'completed' || !activeJob.result_urls?.length) return;

    // Only auto-download if user started the export in this session
    if (!startedExportInSessionRef.current) return;

    // If already auto-downloaded in this browser session, skip
    if (getAutoDownloadedJobIds().has(activeJob.id)) return;

    const autoDownload = async () => {
      await downloadJobFiles(activeJob.result_urls!);
      markJobAutoDownloaded(activeJob.id);

      // Mark as downloaded in DB so hard refresh won't bring it back
      try {
        await supabase
          .from('pdf_export_jobs' as any)
          .update({ status: 'downloaded' })
          .eq('id', activeJob.id);
      } catch {
        // Non-critical
      }

      setCompletedDownloaded(activeJob.id);

      // Auto-dismiss banner after 10 seconds
      autoDismissRef.current = setTimeout(() => {
        setShowBanner(false);
      }, 10000);
    };

    autoDownload();

    return () => {
      if (autoDismissRef.current) {
        clearTimeout(autoDismissRef.current);
      }
    };
  }, [activeJob?.id, activeJob?.status, activeJob?.result_urls, downloadJobFiles]);

  // ── Manual retry download ────────────────────────────────

  const retryDownload = useCallback(async () => {
    if (!activeJob?.result_urls?.length) return;
    await downloadJobFiles(activeJob.result_urls);

    // Mark as downloaded + auto-dismiss after 5s
    try {
      await supabase
        .from('pdf_export_jobs' as any)
        .update({ status: 'downloaded' })
        .eq('id', activeJob.id);
    } catch { /* non-critical */ }

    setCompletedDownloaded(activeJob.id);
    autoDismissRef.current = setTimeout(() => {
      setShowBanner(false);
    }, 5000);
  }, [activeJob, downloadJobFiles]);

  // ── Progress calculation ──────────────────────────────────

  const progress = activeJob
    ? activeJob.total_invoices > 0
      ? Math.round((activeJob.processed_invoices / activeJob.total_invoices) * 100)
      : 0
    : 0;

  const isExporting = activeJob?.status === 'queued' || activeJob?.status === 'processing';

  // ── Actions ───────────────────────────────────────────────

  const [isStarting, setIsStarting] = useState(false);

  const startExport = useCallback(async (params: ExportParams) => {
    if (!companyId || !user) {
      toast({ title: 'Nincs kiválasztott cég', variant: 'destructive' });
      return;
    }

    if (isStarting) return;
    setIsStarting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Single EF call — creates job + enqueues PGMQ message for worker
      const resp = await fetch(`${supabaseUrl}/functions/v1/generate-pdf-export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          companyId,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          invoiceDirection: params.invoiceDirection,
        }),
      });

      const result = await resp.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Close the dialog, show banner, mark session
      setDialogOpen(false);
      setShowBanner(true);
      startedExportInSessionRef.current = true;

      // Invalidate to pick up the new job
      queryClient.invalidateQueries({ queryKey: ['pdf-export-job', companyId] });

      toast({
        title: 'PDF export elindítva',
        description: `${result.totalInvoices} számla feldolgozása folyamatban...`,
      });

    } catch (error: any) {
      toast({
        title: 'Export hiba',
        description: error.message || 'Nem sikerült elindítani az exportot',
        variant: 'destructive',
      });
      reportError({ type: 'db_query', component: 'usePdfExport', action: 'error', message: 'Export start failed', error });
    } finally {
      setIsStarting(false);
    }
  }, [companyId, user, isStarting, toast, queryClient]);

  const cancelExport = useCallback(async () => {
    if (!activeJob) return;

    try {
      await supabase
        .from('pdf_export_jobs' as any)
        .update({ status: 'error', error_message: 'Felhasználó által megszakítva' })
        .eq('id', activeJob.id);

      setShowBanner(false);
      queryClient.invalidateQueries({ queryKey: ['pdf-export-job', companyId] });
      toast({ title: 'PDF export megszakítva' });
    } catch (error) {
      reportError({ type: 'db_query', component: 'usePdfExport', action: 'error', message: 'Cancel failed', error });
    }
  }, [activeJob, companyId, toast, queryClient]);

  const dismissBanner = useCallback(async () => {
    setShowBanner(false);
    if (autoDismissRef.current) {
      clearTimeout(autoDismissRef.current);
    }

    // Mark as downloaded in DB so it won't reappear — storage cleanup happens via 24h cron
    if (activeJob?.status === 'completed') {
      setCompletedDownloaded(activeJob.id);
      try {
        await supabase
          .from('pdf_export_jobs' as any)
          .update({ status: 'downloaded' })
          .eq('id', activeJob.id);
      } catch {
        // Non-critical
      }
    }
  }, [activeJob]);

  return {
    isExporting: !!isExporting,
    isStarting,
    activeJob: activeJob ?? null,
    progress,
    dialogOpen,
    openDialog: () => setDialogOpen(true),
    closeDialog: () => setDialogOpen(false),
    startExport,
    cancelExport,
    dismissBanner,
    retryDownload,
    showBanner,
  };
}
