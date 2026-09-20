import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, invalidateInvoiceQueries } from '@/lib/queryKeys';

export interface AutoCategorizeJob {
  id: string;
  company_id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  total_invoices: number;
  processed_invoices: number;
  categorized_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface UseAutoCategorizeJobOptions {
  companyId?: string;
  writable?: boolean;
  categoriesCount?: number;
}

export function useAutoCategorizeJob({ companyId, writable = true, categoriesCount = 0 }: UseAutoCategorizeJobOptions) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation(['categories', 'common']);
  const queryClient = useQueryClient();

  const [activeJob, setActiveJob] = useState<AutoCategorizeJob | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const activeJobRef = useRef<AutoCategorizeJob | null>(null);
  activeJobRef.current = activeJob;

  // Stale threshold: 10 minutes
  const STALE_JOB_MS = 10 * 60 * 1000;

  // Fetch current active job on company change / mount
  const fetchActiveJob = useCallback(async () => {
    if (!companyId || !user?.id) {
      setActiveJob(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('auto_categorize_jobs' as any)
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['pending', 'processing'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('[useAutoCategorizeJob] Error querying active job:', error);
        return;
      }

      if (data && data.length > 0) {
        const job = data[0] as unknown as AutoCategorizeJob;
        const jobAge = Date.now() - new Date(job.created_at).getTime();
        if (jobAge < STALE_JOB_MS) {
          setActiveJob(job);
        } else {
          // Stale job older than 10 mins: ignore
          setActiveJob(null);
        }
      } else {
        setActiveJob(null);
      }
    } catch (err) {
      console.warn('[useAutoCategorizeJob] Fetch failed:', err);
    }
  }, [companyId, user?.id]);

  useEffect(() => {
    fetchActiveJob();
  }, [fetchActiveJob]);

  // Handle job completion callback
  const handleJobFinished = useCallback((job: AutoCategorizeJob) => {
    if (job.status === 'completed') {
      const total = job.total_invoices || job.processed_invoices || 0;
      const categorized = job.categorized_count || 0;
      const uncategorized = Math.max(0, total - categorized);

      if (categorized > 0 && uncategorized > 0) {
        toast({
          title: t('categories:auto_categorize_partial_title', {
            categorized,
            total,
            defaultValue: `${categorized} / ${total} számla sikeresen besorolva.`,
          }),
          description: t('categories:auto_categorize_partial_desc', {
            uncategorized,
            defaultValue: `A fennmaradó ${uncategorized} számlához nem volt biztos egyezés az elérhető kategóriák között.`,
          }),
        });
      } else if (categorized > 0) {
        toast({
          title: t('categories:auto_categorize_success', {
            count: categorized,
            defaultValue: `${categorized} számla sikeresen besorolva.`,
          }),
        });
      } else {
        toast({
          title: t('categories:auto_categorize_none', 'Minden bejövő számla már rendelkezik kategóriával, vagy nincs egyértelmű egyezés.'),
        });
      }

      if (companyId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.categoriesPageData(companyId),
        });
        invalidateInvoiceQueries(queryClient, companyId);
      }
    } else if (job.status === 'error') {
      toast({
        variant: 'destructive',
        title: t('categories:auto_categorize_error', 'Hiba történt az automatikus kategorizálás során.'),
        description: job.error_message || t('common:error_occurred', 'Váratlan hiba történt.'),
      });
    }

    // Clear after a brief display moment
    setTimeout(() => {
      setActiveJob(null);
      setIsStarting(false);
    }, 600);
  }, [companyId, queryClient, t, toast]);

  // Realtime subscription
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`auto_categorize_jobs_${companyId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auto_categorize_jobs',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const updatedJob = payload.new as AutoCategorizeJob;
          if (!updatedJob) return;

          if (['pending', 'processing'].includes(updatedJob.status)) {
            setActiveJob(updatedJob);
            setIsStarting(false);
          } else if (['completed', 'error'].includes(updatedJob.status)) {
            handleJobFinished(updatedJob);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, handleJobFinished]);

  // Fallback short polling when active
  useEffect(() => {
    if (!activeJob && !isStarting) return;

    const interval = setInterval(() => {
      fetchActiveJob();
    }, 2500);

    return () => clearInterval(interval);
  }, [activeJob, isStarting, fetchActiveJob]);

  // Start categorization
  const startAutoCategorize = async () => {
    if (!companyId || !user?.id || !writable) return;

    if (categoriesCount === 0) {
      toast({
        variant: 'destructive',
        title: t('categories:auto_categorize_error', 'Hiba történt az automatikus kategorizálás során.'),
        description: t('categories:no_categories', 'Még nincsenek kategóriák'),
      });
      return;
    }

    if (activeJob || isStarting) return;

    setIsStarting(true);

    try {
      // 0. Concurrency guard: Check if an active job already exists in the last 5 minutes
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: existingJobs } = await (supabase
        .from('auto_categorize_jobs' as any) as any)
        .select('*')
        .eq('company_id', companyId)
        .in('status', ['pending', 'processing'])
        .gt('created_at', fiveMinsAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingJobs && (existingJobs as any[]).length > 0) {
        const runningJob = (existingJobs as any[])[0] as unknown as AutoCategorizeJob;
        setActiveJob(runningJob);
        setIsStarting(false);
        return;
      }

      // 1. Create a pending job record in DB
      const { data: insertedData, error: jobErr } = await (supabase
        .from('auto_categorize_jobs' as any) as any)
        .insert({
          company_id: companyId,
          user_id: user.id,
          status: 'pending',
          total_invoices: 0,
          processed_invoices: 0,
          categorized_count: 0,
        })
        .select('*')
        .single();

      const newJob = insertedData as unknown as AutoCategorizeJob | null;

      if (jobErr) {
        console.error('[useAutoCategorizeJob] Failed to create job record:', jobErr);
      } else if (newJob) {
        setActiveJob(newJob);
      }

      const jobId = newJob?.id;

      // 2. Invoke the Edge Function
      const { data, error } = await supabase.functions.invoke('auto-categorize-invoices', {
        body: { companyId, jobId },
      });

      if (error) {
        throw error;
      }

      if (data && data.success) {
        if (data.processedCount === 0) {
          toast({
            title: t('categories:auto_categorize_none', 'Minden bejövő számla már rendelkezik kategóriával, vagy nincs egyértelmű egyezés.'),
            description: data.message,
          });
          setActiveJob(null);
          setIsStarting(false);
        }
      }
    } catch (err: any) {
      console.error('[useAutoCategorizeJob] Error running auto-categorize:', err);
      toast({
        variant: 'destructive',
        title: t('categories:auto_categorize_error', 'Hiba történt az automatikus kategorizálás során.'),
        description: err?.message || t('common:error_occurred', 'Váratlan hiba történt.'),
      });
      setActiveJob(null);
      setIsStarting(false);
    }
  };

  const isRunning = isStarting || (activeJob !== null && ['pending', 'processing'].includes(activeJob.status));
  const isGathering = isStarting || activeJob?.status === 'pending';
  const total = activeJob?.total_invoices || 0;
  const processed = activeJob?.processed_invoices || 0;
  const progressPercent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return {
    activeJob,
    isRunning,
    isGathering,
    processedCount: processed,
    totalCount: total,
    progressPercent,
    startAutoCategorize,
  };
}
