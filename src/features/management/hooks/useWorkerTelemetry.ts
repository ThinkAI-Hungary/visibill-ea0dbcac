import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFilePreview } from '@/components/ui/FilePreviewModal';
import { fetchManagementData, postManagementData } from '../api/managementApi';
import { reportError } from '@/lib/errorReporter';
import { useToast } from '@/hooks/use-toast';

export const ERROR_PAGE_SIZE = 10;
export const COMPLETED_PAGE_SIZE = 15;

export const RETRYABLE_SOURCES = new Set([
  'invoice_uploads',
  'transaction_uploads',
  'gl_upload_notifications',
  'report_uploads',
]);

export const WORKER_PERIOD_LABELS: Record<string, string> = {
  all: 'Összesen',
  '24h': '24 óra',
  '7d': '7 nap',
  '30d': '30 nap',
  '90d': '90 nap',
};

export function useWorkerTelemetry() {
  const [searchParams, setSearchParams] = useSearchParams();

  const workerTab = (searchParams.get('wrk_tab') as 'overview' | 'llm-costs') || 'overview';
  const workerPeriod = searchParams.get('wrk_period') || '24h';
  const errorPage = Number(searchParams.get('wrk_err_page')) || 1;
  const completedPage = Math.max(1, Number(searchParams.get('wrk_ok_page') || 1));

  const showAllQueues = searchParams.get('wrk_show_queues') === 'true';
  const showProcessing = searchParams.get('wrk_show_processing') === 'true';
  const showWorkerErrors = searchParams.get('wrk_show_errors') === 'true';
  const showCompleted = searchParams.get('wrk_show_completed') === 'true';

  const updateParams = useCallback(
    (updates: Record<string, string | number | null>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, val]) => {
        if (val !== null && val !== '') {
          next.set(key, String(val));
        } else {
          next.delete(key);
        }
      });
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<'containers' | 'queues'>('containers');
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [dismissedQueues, setDismissedQueues] = useState<Set<string>>(new Set());
  const [expandedErrorRowId, setExpandedErrorRowId] = useState<string | null>(null);
  const [workerErrorSearch, setWorkerErrorSearch] = useState('');
  const [completedSearch, setCompletedSearch] = useState('');
  const [selectedErrorIds, setSelectedErrorIds] = useState<Set<string>>(new Set());

  const { previewFile, openPreview, closePreview } = useFilePreview();
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryTargets, setRetryTargets] = useState<Array<{ source: string; id: string; project?: string }>>([]);
  const [retryPipeline, setRetryPipeline] = useState('same');
  const [retrying, setRetrying] = useState(false);
  const [retryPhase, setRetryPhase] = useState<'idle' | 'sending' | 'refreshing'>('idle');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['worker-status', workerPeriod],
    queryFn: () => fetchManagementData('worker-status', { period: workerPeriod }),
    refetchInterval: 5_000,
    staleTime: 2_500,
  });

  const recent_jobs = data?.recent_jobs || [];
  const { containers = [], queues = [], pipelines = [], active_processing = [], summary = {} } = data || {};

  const activeContainer = selectedContainer || containers[0]?.container_name || null;
  const containerData = containers.find((c: any) => c.container_name === activeContainer);
  const activeProject = containerData?.supabase_project || null;

  const groupedRecentJobs = useMemo(() => {
    const grouped: Record<string, any> = {};
    for (const j of recent_jobs) {
      const key = j.upload_id 
        ? `${j.project}_${j.upload_id}` 
        : `${j.project}_${j.worker_id}_${j.pipeline}_${j.file_name}_${j.created_at?.substring(0, 16)}`;
      if (!grouped[key]) {
        grouped[key] = {
          ...j,
          estimated_cost_usd: j.estimated_cost_usd || 0,
          total_tokens: j.total_tokens || 0,
          processing_duration_ms: j.processing_duration_ms || 0,
          status: j.status || 'OK',
        };
      } else {
        grouped[key].estimated_cost_usd += (j.estimated_cost_usd || 0);
        grouped[key].total_tokens += (j.total_tokens || 0);
        grouped[key].processing_duration_ms = Math.max(grouped[key].processing_duration_ms, j.processing_duration_ms || 0);
        if (j.status === 'ERROR') {
          grouped[key].status = 'ERROR';
        } else if (j.status === 'REDIRECTED' && grouped[key].status !== 'ERROR') {
          grouped[key].status = 'REDIRECTED';
        }
      }
    }
    return Object.values(grouped).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [recent_jobs]);

  const filteredJobs = useMemo(() => {
    return activeProject
      ? groupedRecentJobs.filter((j: any) => j.worker_id === activeContainer || j.project === activeProject)
      : groupedRecentJobs;
  }, [groupedRecentJobs, activeProject, activeContainer]);

  const errorJobs = useMemo(() => {
    return data?.error_jobs || [];
  }, [data]);

  const filteredErrorJobs = useMemo(() => {
    if (!workerErrorSearch) return errorJobs;
    const term = workerErrorSearch.toLowerCase().trim();
    return errorJobs.filter((j: any) =>
      (j.file_name || '').toLowerCase().includes(term) ||
      (j.company_name || '').toLowerCase().includes(term) ||
      (j.pipeline || '').toLowerCase().includes(term) ||
      (j.error_message || '').toLowerCase().includes(term)
    );
  }, [errorJobs, workerErrorSearch]);

  const errorTotalPages = Math.max(1, Math.ceil(filteredErrorJobs.length / ERROR_PAGE_SIZE));

  const paginatedErrorJobs = useMemo(() => {
    return filteredErrorJobs.slice((errorPage - 1) * ERROR_PAGE_SIZE, errorPage * ERROR_PAGE_SIZE);
  }, [filteredErrorJobs, errorPage]);

  const completedJobs = useMemo(() => {
    return groupedRecentJobs.filter((j: any) => j.status === 'OK');
  }, [groupedRecentJobs]);

  const filteredCompletedJobs = useMemo(() => {
    if (!completedSearch) return completedJobs;
    const term = completedSearch.toLowerCase().trim();
    return completedJobs.filter((j: any) =>
      (j.file_name || '').toLowerCase().includes(term) ||
      (j.company_name || '').toLowerCase().includes(term) ||
      (j.pipeline || '').toLowerCase().includes(term)
    );
  }, [completedJobs, completedSearch]);

  const completedTotalPages = Math.max(1, Math.ceil(filteredCompletedJobs.length / COMPLETED_PAGE_SIZE));

  const paginatedCompletedJobs = useMemo(() => {
    return filteredCompletedJobs.slice((completedPage - 1) * COMPLETED_PAGE_SIZE, completedPage * COMPLETED_PAGE_SIZE);
  }, [filteredCompletedJobs, completedPage]);

  const prevPeriodRef = React.useRef(workerPeriod);
  useEffect(() => {
    if (prevPeriodRef.current !== workerPeriod) {
      updateParams({ wrk_err_page: null });
      prevPeriodRef.current = workerPeriod;
    }
  }, [workerPeriod, updateParams]);

  const filteredPipelines = useMemo(() => {
    return activeProject
      ? pipelines.filter((p: any) => p.project === activeProject)
      : pipelines;
  }, [pipelines, activeProject]);

  const filteredQueues = useMemo(() => {
    return (activeProject
      ? queues.filter((q: any) => q.project === activeProject)
      : queues
    ).sort((a: any, b: any) => a.queue_name.localeCompare(b.queue_name));
  }, [queues, activeProject]);

  const openRetryModal = useCallback((ids: Array<{ source: string; id: string; project?: string }>) => {
    const retryable = ids.filter(i => RETRYABLE_SOURCES.has(i.source));
    if (retryable.length === 0) {
      toast({ title: 'Nem támogatott', description: 'A kijelölt fájl nem támogatja az újraküldést.', variant: 'destructive' });
      return;
    }
    setRetryTargets(retryable);
    setRetryPipeline('same');
    setRetryModalOpen(true);
  }, [toast]);

  const handleRetryConfirm = useCallback(async (pipelineOverrideOptions?: Array<{ value: string; label: string; queue?: string; category?: string | null }>) => {
    if (retryTargets.length === 0) return;
    const targetCount = retryTargets.length;
    setRetrying(true);
    setRetryPhase('sending');
    let apiResult: { retried?: number; error?: string | null } | null = null;
    let apiError = false;
    try {
      const pipelineOverride = retryPipeline !== 'same' && pipelineOverrideOptions
        ? pipelineOverrideOptions.find(p => p.value === retryPipeline)
        : null;

      const result = await postManagementData('retry-errors', {
        ids: retryTargets,
        ...(pipelineOverride && {
          targetQueue: pipelineOverride.queue,
          targetCategory: pipelineOverride.category,
        }),
      });
      apiResult = result;

      setRetryPhase('refreshing');
      await queryClient.refetchQueries({ queryKey: ['worker-status'], type: 'active' });
    } catch (e) {
      apiError = true;
      reportError({ type: 'db_query', component: 'ManagementDashboard', action: 'error', message: 'Retry errors from worker failed:', error: e });
    } finally {
      setRetrying(false);
      setRetryPhase('idle');
      setRetryModalOpen(false);
      setRetryTargets([]);
      setSelectedErrorIds(new Set());
    }

    if (apiError) {
      toast({ title: 'Újraküldés sikertelen', description: 'Hiba történt az újraküldés során.', variant: 'destructive' });
    } else if (apiResult?.error) {
      reportError({ type: 'api_call', severity: 'warning', component: 'ManagementDashboard', action: 'warning', message: 'Retry partial errors from worker', error: apiResult.error });
      toast({ title: 'Részleges újraküldés', description: `${apiResult.retried || 0} elem újraküldve, néhány hiba történt.`, variant: 'destructive' });
    } else if (apiResult !== null) {
      toast({ title: 'Újraküldés sikeres', description: `${apiResult.retried ?? targetCount} elem újra feldolgozásra küldve.` });
    }
  }, [queryClient, retryPipeline, retryTargets, toast]);

  return {
    workerTab,
    workerPeriod,
    errorPage,
    completedPage,
    showAllQueues,
    showProcessing,
    showWorkerErrors,
    showCompleted,
    updateParams,
    selectedContainer,
    setSelectedContainer,
    selectedSection,
    setSelectedSection,
    selectedQueue,
    setSelectedQueue,
    dismissedQueues,
    setDismissedQueues,
    expandedErrorRowId,
    setExpandedErrorRowId,
    workerErrorSearch,
    setWorkerErrorSearch,
    completedSearch,
    setCompletedSearch,
    selectedErrorIds,
    setSelectedErrorIds,
    previewFile,
    openPreview,
    closePreview,
    retryModalOpen,
    setRetryModalOpen,
    retryTargets,
    retryPipeline,
    setRetryPipeline,
    retrying,
    retryPhase,
    openRetryModal,
    handleRetryConfirm,
    isLoading,
    data,
    containers,
    queues,
    pipelines,
    active_processing,
    summary,
    activeContainer,
    containerData,
    activeProject,
    groupedRecentJobs,
    filteredJobs,
    errorJobs,
    filteredErrorJobs,
    errorTotalPages,
    paginatedErrorJobs,
    completedJobs,
    filteredCompletedJobs,
    completedTotalPages,
    paginatedCompletedJobs,
    filteredPipelines,
    filteredQueues,
  };
}
