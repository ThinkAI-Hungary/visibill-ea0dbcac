import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePreviewModal, useFilePreview } from '@/components/ui/FilePreviewModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '../common/ManagementSkeleton';
import { LLMCostPanel, formatUptime, formatDuration, MiniSparkline } from '../llm/LLMCostPanel';
import { fetchManagementData, postManagementData } from '../../api/managementApi';
import { reportError } from '@/lib/errorReporter';
import { useToast } from '@/hooks/use-toast';
import {
  Server, DollarSign, ClipboardList, CheckCircle2, Loader, AlertTriangle,
  CircleDot, ChevronDown, ChevronLeft, ChevronRight, Search, X,
  FileText, Activity, Inbox, Mail, RefreshCw, Upload, Receipt, Wallet,
  Landmark, BarChart3, Truck, Clock, Loader2, RotateCcw
} from 'lucide-react';

export function WorkerPanel() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Driving state from URL search params
  const workerTab = (searchParams.get('wrk_tab') as 'overview' | 'llm-costs') || 'overview';
  const workerPeriod = searchParams.get('wrk_period') || '24h';
  const errorPage = Number(searchParams.get('wrk_err_page')) || 1;

  // Helper to update parameters atomically
  const updateParams = useCallback((updates: Record<string, string | number | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val !== null && val !== '') {
        next.set(key, String(val));
      } else {
        next.delete(key);
      }
    });
    setSearchParams(next);
  }, [searchParams, setSearchParams]);

  const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<'containers' | 'queues'>('containers');
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const showAllQueues = searchParams.get('wrk_show_queues') === 'true';
  const [dismissedQueues, setDismissedQueues] = useState<Set<string>>(new Set());
  const showProcessing = searchParams.get('wrk_show_processing') === 'true';
  const showWorkerErrors = searchParams.get('wrk_show_errors') === 'true';
  const showCompleted = searchParams.get('wrk_show_completed') === 'true';
  const [expandedErrorRowId, setExpandedErrorRowId] = useState<string | null>(null);
  const [workerErrorSearch, setWorkerErrorSearch] = useState('');
  const [completedSearch, setCompletedSearch] = useState('');
  const [selectedErrorIds, setSelectedErrorIds] = useState<Set<string>>(new Set());
  const ERROR_PAGE_SIZE = 10;
  const COMPLETED_PAGE_SIZE = 15;

  const { previewFile, openPreview, closePreview } = useFilePreview();
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [retryTargets, setRetryTargets] = useState<Array<{ source: string; id: string; project?: string }>>([]);
  const [retryPipeline, setRetryPipeline] = useState('same');
  const [retrying, setRetrying] = useState(false);
  const [retryPhase, setRetryPhase] = useState<'idle' | 'sending' | 'refreshing'>('idle');

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const RETRYABLE_SOURCES = new Set(['invoice_uploads', 'transaction_uploads', 'gl_upload_notifications', 'report_uploads']);

  const PIPELINE_OPTIONS: Array<{ value: string; label: string; icon: React.ReactNode; queue?: string; category?: string | null }> = [
    { value: 'same', label: 'Eredeti pipeline (változatlan)', icon: <RotateCcw className="h-4 w-4 text-muted-foreground" /> },
    { value: 'invoice', label: 'Számla feldolgozás', icon: <Receipt className="h-4 w-4 text-emerald-500" />, queue: 'invoice_jobs', category: 'invoice' },
    { value: 'payroll', label: 'Bérjegyzék feldolgozás', icon: <Wallet className="h-4 w-4 text-amber-500" />, queue: 'invoice_jobs', category: 'payroll' },
    { value: 'transaction', label: 'Tranzakció feldolgozás', icon: <Landmark className="h-4 w-4 text-blue-500" />, queue: 'transaction_jobs', category: null },
    { value: 'gl', label: 'Főkönyvi besorolás', icon: <BarChart3 className="h-4 w-4 text-purple-500" />, queue: 'gl_classification_jobs', category: null },
    { value: 'report', label: 'Futár riport feldolgozás', icon: <Truck className="h-4 w-4 text-orange-500" />, queue: 'report_jobs', category: null },
  ];

  const openRetryModal = (ids: Array<{ source: string; id: string; project?: string }>) => {
    const retryable = ids.filter(i => RETRYABLE_SOURCES.has(i.source));
    if (retryable.length === 0) {
      toast({ title: 'Nem támogatott', description: 'A kijelölt fájl nem támogatja az újraküldést.', variant: 'destructive' });
      return;
    }
    setRetryTargets(retryable);
    setRetryPipeline('same');
    setRetryModalOpen(true);
  };

  const handleRetryConfirm = async () => {
    if (retryTargets.length === 0) return;
    const targetCount = retryTargets.length;
    setRetrying(true);
    setRetryPhase('sending');
    let apiResult: { retried?: number; error?: string | null } | null = null;
    let apiError = false;
    try {
      const pipelineOverride = retryPipeline !== 'same'
        ? PIPELINE_OPTIONS.find(p => p.value === retryPipeline)
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
  };

  const workerPeriodLabel: Record<string, string> = { 'all': 'Összesen', '24h': '24 óra', '7d': '7 nap', '30d': '30 nap', '90d': '90 nap' };

  // Near-realtime 5s polling for operator dashboard responsiveness
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

  const completedPage = Math.max(1, Number(searchParams.get('wrk_ok_page') || 1));
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

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-60 rounded-lg" />
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-border/40">
              <CardContent className="p-3.5 space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-2 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-[240px_1fr] gap-4">
          <Card className="border-border/40">
            <CardContent className="p-3 space-y-2">
              <Skeleton className="h-4 w-24 mb-3" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </CardContent>
          </Card>
          <div className="space-y-4">
            <Card className="border-border/40">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-5 w-32" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const filteredPipelines = activeProject
    ? pipelines.filter((p: any) => p.project === activeProject)
    : pipelines;
  const filteredQueues = (activeProject
    ? queues.filter((q: any) => q.project === activeProject)
    : queues
  ).sort((a: any, b: any) => a.queue_name.localeCompare(b.queue_name));

  return (
    <div className="space-y-4">
      {/* ── Worker Sub-Tabs ── */}
      <div className="flex items-center gap-1 bg-muted/30 p-0.5 rounded-lg w-fit">
        <button
          onClick={() => updateParams({ wrk_tab: 'overview' })}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            workerTab === 'overview' ? 'bg-emerald-500/12 text-emerald-500' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Server className="h-3.5 w-3.5" />
          Áttekintés
        </button>
        <button
          onClick={() => updateParams({ wrk_tab: 'llm-costs' })}
          className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
            workerTab === 'llm-costs' ? 'bg-purple-500/12 text-purple-400' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <DollarSign className="h-3.5 w-3.5" />
          LLM Költség
        </button>
      </div>

      {workerTab === 'llm-costs' ? (
        <LLMCostPanel />
      ) : (
        <>
          {/* ── Period Selector ── */}
          <div className="flex justify-end">
            <div className="flex gap-0.5 bg-muted/30 p-0.5 rounded-md">
              {['all', '24h', '7d', '30d', '90d'].map(p => (
                <button
                  key={p}
                  onClick={() => updateParams({ wrk_period: p })}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                    workerPeriod === p ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {workerPeriodLabel[p] || p}
                </button>
              ))}
            </div>
          </div>

          {/* ── KPI Summary Row ── */}
          <div className="grid grid-cols-5 gap-3">
            {[
              {
                label: 'Konténerek',
                value: `${summary.healthy_containers || 0}/${summary.total_containers || 0}`,
                icon: Server,
                color: summary.healthy_containers === summary.total_containers ? 'text-emerald-500' : 'text-amber-500',
                sub: 'healthy',
              },
              {
                label: 'Queue várakozó',
                value: summary.total_queue_pending || 0,
                icon: ClipboardList,
                color: (summary.total_queue_pending || 0) > 20 ? 'text-amber-500' : 'text-blue-500',
                sub: 'üzenet',
              },
              {
                label: `Feldolgozva (${workerPeriodLabel[workerPeriod]})`,
                value: summary.total_jobs_24h || 0,
                icon: CheckCircle2,
                color: 'text-emerald-500',
                sub: 'job',
              },
              {
                label: 'Feldolgozás alatt',
                value: summary.total_processing || 0,
                icon: Loader,
                color: (summary.total_processing || 0) > 0 ? 'text-cyan-500' : 'text-muted-foreground',
                sub: 'aktív',
              },
              {
                label: `Worker hibák (${workerPeriodLabel[workerPeriod]})`,
                value: summary.total_errors_24h || 0,
                icon: AlertTriangle,
                color: (summary.total_errors_24h || 0) > 0 ? 'text-red-500' : 'text-muted-foreground',
                sub: 'hiba',
              },
            ].map((kpi) => {
              const isQueueKpi = kpi.label === 'Queue várakozó';
              const isProcessingKpi = kpi.label === 'Feldolgozás alatt';
              const isErrorKpi = kpi.label.startsWith('Worker hibák');
              const isCompletedKpi = kpi.label.startsWith('Feldolgozva');
              const isQueueClickable = isQueueKpi && (summary.total_queue_pending || 0) > 0;
              const isProcessingClickable = isProcessingKpi;
              const isErrorClickable = isErrorKpi && (summary.total_errors_24h || 0) > 0;
              const isCompletedClickable = isCompletedKpi && (summary.total_jobs_24h || 0) > 0;
              const isClickable = isQueueClickable || isProcessingClickable || isErrorClickable || isCompletedClickable;
              const isActive = (showAllQueues && isQueueKpi) || (showProcessing && isProcessingKpi) || (showWorkerErrors && isErrorKpi) || (showCompleted && isCompletedKpi);
              const activeColor = isQueueKpi 
                ? 'border-amber-500/50 bg-amber-500/5' 
                : isProcessingKpi 
                  ? 'border-cyan-500/50 bg-cyan-500/5' 
                  : isCompletedKpi
                    ? 'border-emerald-500/50 bg-emerald-500/5'
                    : 'border-red-500/50 bg-red-500/5';
              const hoverColor = isQueueKpi 
                ? 'hover:border-amber-500/50 hover:bg-amber-500/5' 
                : isProcessingKpi 
                  ? 'hover:border-cyan-500/50 hover:bg-cyan-500/5' 
                  : isCompletedKpi
                    ? 'hover:border-emerald-500/50 hover:bg-emerald-500/5'
                    : 'hover:border-red-500/50 hover:bg-red-500/5';
              return (
                <Card
                  key={kpi.label}
                  className={`p-3 bg-card/80 border-border/50 transition-colors ${
                    isClickable ? `cursor-pointer ${hoverColor}` : 'hover:border-border'
                  } ${isActive ? activeColor : ''}`}
                  onClick={() => {
                    if (isQueueClickable) {
                      updateParams({
                        wrk_show_queues: showAllQueues ? null : 'true',
                        wrk_show_processing: null,
                        wrk_show_errors: null,
                        wrk_show_completed: null,
                        wrk_err_page: null,
                        wrk_ok_page: null,
                      });
                      setSelectedQueue(null);
                      setDismissedQueues(new Set());
                    } else if (isCompletedClickable) {
                      updateParams({
                        wrk_show_completed: showCompleted ? null : 'true',
                        wrk_show_queues: null,
                        wrk_show_processing: null,
                        wrk_show_errors: null,
                        wrk_err_page: null,
                        wrk_ok_page: null,
                      });
                      setSelectedQueue(null);
                      setCompletedSearch('');
                    } else if (isProcessingClickable) {
                      updateParams({
                        wrk_show_processing: showProcessing ? null : 'true',
                        wrk_show_queues: null,
                        wrk_show_errors: null,
                        wrk_show_completed: null,
                        wrk_err_page: null,
                        wrk_ok_page: null,
                      });
                      setSelectedQueue(null);
                    } else if (isErrorClickable) {
                      updateParams({
                        wrk_show_errors: showWorkerErrors ? null : 'true',
                        wrk_show_queues: null,
                        wrk_show_processing: null,
                        wrk_show_completed: null,
                        wrk_err_page: null,
                        wrk_ok_page: null,
                      });
                      setSelectedQueue(null);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <kpi.icon className={`h-4 w-4 ${kpi.color} ${isProcessingKpi && (summary.total_processing || 0) > 0 ? 'animate-spin' : ''}`} />
                    <span className="text-xs text-muted-foreground font-medium">{kpi.label}</span>
                  </div>
                  <div className="text-lg font-bold">{kpi.value}</div>
                </Card>
              );
            })}
          </div>

          {/* ── Split Panel: Left Nav + Right Content ── */}
          <div className="grid grid-cols-[220px_1fr] gap-4">
            {/* Left sidebar */}
            <div className="space-y-3">
              {/* Containers section */}
              <div>
                <button
                  onClick={() => setSelectedSection('containers')}
                  className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded w-full text-left transition-colors ${
                    selectedSection === 'containers' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Server className="h-3 w-3" />
                  Konténerek
                </button>
                <div className="mt-1 space-y-0.5">
                  {containers.map((c: any) => (
                    <button
                      key={c.container_name}
                      onClick={() => { setSelectedContainer(c.container_name); setSelectedSection('containers'); }}
                      className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs transition-colors ${
                        activeContainer === c.container_name && selectedSection === 'containers'
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      <CircleDot className={`h-2.5 w-2.5 ${c.is_healthy ? 'text-emerald-500' : 'text-red-500'}`} />
                      <span className="truncate flex-1 text-left">{c.container_name}</span>
                      <div className="flex items-center gap-1.5 ml-auto text-[10px] opacity-60 font-mono">
                        {c.is_healthy && c.cpu_usage !== undefined && c.cpu_usage > 0 && (
                          <span className={`${c.cpu_usage > 80 ? 'text-red-400 font-semibold' : c.cpu_usage > 50 ? 'text-amber-400' : 'text-muted-foreground/80'}`}>{c.cpu_usage.toFixed(0)}%</span>
                        )}
                        <span>({c.jobs_24h})</span>
                      </div>
                    </button>
                  ))}
                  {containers.length === 0 && (
                    <p className="text-xs text-muted-foreground/60 px-3 py-1">Nincs heartbeat adat</p>
                  )}
                </div>
              </div>

              {/* Queues section */}
              <div>
                <button
                  onClick={() => setSelectedSection('queues')}
                  className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded w-full text-left transition-colors ${
                    selectedSection === 'queues' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ClipboardList className="h-3 w-3" />
                  Queue-k
                </button>
                <div className="mt-1 space-y-0.5">
                  {filteredQueues.map((q: any) => {
                    const hasItems = q.queue_length > 0;
                    const queueKey = `${q.project}:${q.queue_name}`;
                    const isDismissed = dismissedQueues.has(queueKey);
                    const isExpanded = showAllQueues ? (hasItems && !isDismissed) : selectedQueue === q.queue_name;
                    return (
                      <button
                        key={q.queue_name}
                        onClick={() => {
                          if (!hasItems) return;
                          if (showAllQueues) {
                            if (isDismissed) {
                              setDismissedQueues(prev => { const next = new Set(prev); next.delete(queueKey); return next; });
                            } else {
                              setDismissedQueues(prev => new Set([...prev, queueKey]));
                            }
                          } else {
                            setSelectedQueue(prev => prev === q.queue_name ? null : q.queue_name);
                          }
                        }}
                        className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-xs transition-colors ${
                          isExpanded
                            ? 'bg-amber-500/10 text-amber-400 font-medium'
                            : hasItems
                              ? 'text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer'
                              : 'text-muted-foreground/60 cursor-default'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${hasItems ? 'bg-amber-500' : 'bg-emerald-500/50'}`} />
                        <span className="truncate flex-1 text-left">{q.queue_name.replace(/_jobs$/, '').replace(/^(PROD|VSWEB|THINKERMAN):/, '')}</span>
                        <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 min-w-[24px] text-center justify-center ${hasItems ? 'bg-amber-500/15 text-amber-400' : ''}`}>
                          {q.queue_length}
                        </Badge>
                        <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${
                          !hasItems ? 'invisible' : isExpanded ? 'rotate-180 text-amber-400' : 'text-muted-foreground/40'
                        }`} />
                      </button>
                    );
                  })}
                  {filteredQueues.length === 0 && (
                    <p className="text-xs text-muted-foreground/60 px-3 py-1">Nincs queue adat</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right panel */}
            <div className="space-y-4">
              {/* Container header */}
              {selectedSection === 'containers' && containerData && (
                <Card className="p-3 bg-card/60 border-border/40">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${containerData.is_healthy ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                      <Server className={`h-5 w-5 ${containerData.is_healthy ? 'text-emerald-500' : 'text-red-500'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{containerData.container_name}</span>
                        <Badge variant={containerData.is_healthy ? 'secondary' : 'destructive'} className="text-[10px] px-1.5 py-0">
                          {containerData.is_healthy ? 'Healthy' : 'Unhealthy'}
                        </Badge>
                        {containerData.version && (
                          <span className="text-[10px] text-muted-foreground font-mono">{containerData.version}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground">
                        <span>Uptime: {formatUptime(containerData.uptime_seconds)}</span>
                        {containerData.host_ip && <span>IP: {containerData.host_ip}</span>}
                        <span>Jobs (24h): {containerData.jobs_24h}</span>
                        <span>Avg: {formatDuration(containerData.avg_duration_ms)}</span>
                        <span>LLM: ${containerData.total_cost_24h}</span>
                      </div>
                      {containerData.cpu_usage !== undefined && containerData.ram_usage !== undefined && (
                        <div className="mt-3 grid grid-cols-2 gap-4 border-t border-border/10 pt-3">
                          <div>
                            <div className="flex justify-between text-[11px] mb-1">
                              <span className="text-muted-foreground font-medium">CPU terheltség</span>
                              <span className="font-semibold text-foreground font-mono">{containerData.cpu_usage.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  containerData.cpu_usage > 85 ? 'bg-red-500' : containerData.cpu_usage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, containerData.cpu_usage))}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-[11px] mb-1">
                              <span className="text-muted-foreground font-medium">RAM használat</span>
                              <span className="font-semibold text-foreground font-mono">{containerData.ram_usage.toFixed(0)}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  containerData.ram_usage > 85 ? 'bg-red-500' : containerData.ram_usage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, containerData.ram_usage))}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* ── Worker Errors Panel ── */}
              {showWorkerErrors ? (() => {
                const retryableOnPage = paginatedErrorJobs.filter((j: any) => j.source && j.upload_id && RETRYABLE_SOURCES.has(j.source));
                const allPageSelected = retryableOnPage.length > 0 && retryableOnPage.every((j: any) => selectedErrorIds.has(j.upload_id));
                const somePageSelected = retryableOnPage.some((j: any) => selectedErrorIds.has(j.upload_id));

                const toggleSelectAll = () => {
                  if (allPageSelected) {
                    setSelectedErrorIds(prev => {
                      const next = new Set(prev);
                      retryableOnPage.forEach((j: any) => next.delete(j.upload_id));
                      return next;
                    });
                  } else {
                    setSelectedErrorIds(prev => {
                      const next = new Set(prev);
                      retryableOnPage.forEach((j: any) => next.add(j.upload_id));
                      return next;
                    });
                  }
                };

                const toggleRow = (uploadId: string) => {
                  setSelectedErrorIds(prev => {
                    const next = new Set(prev);
                    if (next.has(uploadId)) next.delete(uploadId);
                    else next.add(uploadId);
                    return next;
                  });
                };

                const handleBulkRetry = () => {
                  const selected = filteredErrorJobs
                    .filter((j: any) => j.upload_id && selectedErrorIds.has(j.upload_id) && j.source && RETRYABLE_SOURCES.has(j.source))
                    .map((j: any) => ({ source: j.source, id: j.upload_id, project: j.project }));
                  if (selected.length === 0) return;
                  openRetryModal(selected);
                };

                return (
                  <Card className="border-red-500/30 bg-red-500/5">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          Hibás feldolgozások (Összes projekt)
                          <Badge className="text-[10px] px-1.5 py-0 bg-red-500/15 text-red-400">
                            {filteredErrorJobs.length} hiba
                          </Badge>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {selectedErrorIds.size > 0 && (
                            <div className="flex items-center gap-1.5 animate-in fade-in-0 slide-in-from-right-2 duration-150">
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {selectedErrorIds.size} kijelölve
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5 border-red-500/40 hover:border-red-500/70 hover:bg-red-500/10 text-red-400 hover:text-red-300"
                                onClick={handleBulkRetry}
                                disabled={retrying}
                              >
                                <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                                Újraküldés ({selectedErrorIds.size})
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setSelectedErrorIds(new Set())}
                              >
                                Törlés
                              </Button>
                            </div>
                          )}
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              value={workerErrorSearch}
                              onChange={e => { setSearchParams(prev => { const n = new URLSearchParams(prev); n.set('wrk_err_page', '1'); return n; }); setWorkerErrorSearch(e.target.value); }}
                              placeholder="Keresés (fájl, cég, hiba)..."
                              className="pl-8 h-7 text-xs w-64 bg-background/50 border-border/30 focus-visible:bg-background"
                            />
                          </div>
                          <button onClick={() => { updateParams({ wrk_show_errors: null, wrk_err_page: null }); setWorkerErrorSearch(''); setSelectedErrorIds(new Set()); }} className="text-muted-foreground hover:text-foreground p-1">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-0 pb-2">
                      {errorJobs.length > 0 ? (
                        <>
                          <table className="w-full text-xs table-fixed">
                            <thead>
                              <tr className="border-b border-border/30 text-muted-foreground">
                                <th className="text-left px-4 py-1.5 font-medium w-[36px]">
                                  <input
                                    type="checkbox"
                                    aria-label="Összes kijelölése ezen az oldalon"
                                    checked={allPageSelected}
                                    ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                                    onChange={toggleSelectAll}
                                    disabled={retryableOnPage.length === 0}
                                    className="h-3.5 w-3.5 rounded accent-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-30"
                                  />
                                </th>
                                <th className="text-left px-3 py-1.5 font-medium w-[110px]">Dátum</th>
                                <th className="text-left px-3 py-1.5 font-medium w-[110px]">Pipeline</th>
                                <th className="text-left px-3 py-1.5 font-medium">Fájl</th>
                                <th className="text-left px-3 py-1.5 font-medium w-[160px]">Cég</th>
                                <th className="text-right px-3 py-1.5 font-medium w-[70px]">Idő</th>
                                <th className="text-right px-3 py-1.5 font-medium w-[80px]">$</th>
                                <th className="text-left px-3 py-1.5 font-medium w-[220px]">Worker</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredErrorJobs.length === 0 ? (
                                <tr>
                                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                                    Nincs találat a keresésre: <span className="font-semibold text-foreground">"{workerErrorSearch}"</span>
                                  </td>
                                </tr>
                              ) : (
                                paginatedErrorJobs.map((j: any) => {
                                  const time = new Date(j.created_at);
                                  const dateStr = `${(time.getMonth() + 1).toString().padStart(2, '0')}.${time.getDate().toString().padStart(2, '0')}`;
                                  const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
                                  const isRetryable = !!(j.source && j.upload_id && RETRYABLE_SOURCES.has(j.source));
                                  const isRowSelected = isRetryable && selectedErrorIds.has(j.upload_id);
                                  return (
                                    <React.Fragment key={j.id}>
                                      <tr 
                                        className={`border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer ${
                                          isRowSelected ? 'bg-primary/5 hover:bg-primary/5' :
                                          expandedErrorRowId === j.id ? 'bg-red-500/5 hover:bg-red-500/5' : ''
                                        }`}
                                        onClick={() => setExpandedErrorRowId(prev => prev === j.id ? null : j.id)}
                                      >
                                        <td className="px-4 py-1.5" onClick={e => e.stopPropagation()}>
                                          {isRetryable ? (
                                            <input
                                              type="checkbox"
                                              aria-label={`${j.file_name} kijelölése`}
                                              checked={isRowSelected}
                                              onChange={() => toggleRow(j.upload_id)}
                                              className="h-3.5 w-3.5 rounded accent-primary cursor-pointer"
                                            />
                                          ) : (
                                            <span className="block h-3.5 w-3.5" />
                                          )}
                                        </td>
                                        <td className="px-3 py-1.5 font-mono text-muted-foreground whitespace-nowrap">{dateStr} - {timeStr}</td>
                                        <td className="px-3 py-1.5">
                                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 w-[75px] justify-center">{j.pipeline}</Badge>
                                        </td>
                                        <td className="px-3 py-1.5 max-w-[200px] truncate" title={j.file_name}>
                                          {j.file_url ? (
                                            <button
                                              className="font-medium hover:underline text-left truncate flex items-center gap-1.5 w-full text-foreground/90"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openPreview({ url: j.file_url, name: j.file_name });
                                              }}
                                            >
                                              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                              <span className="truncate">{j.file_name}</span>
                                            </button>
                                          ) : (
                                            <div className="flex items-center gap-1.5 truncate text-muted-foreground/80">
                                              <FileText className="h-3.5 w-3.5 opacity-50 shrink-0" />
                                              <span className="truncate">{j.file_name}</span>
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-3 py-1.5 text-muted-foreground max-w-[140px] truncate">{j.company_name || '—'}</td>
                                        <td className="text-right px-3 py-1.5 font-mono text-muted-foreground">{formatDuration(j.processing_duration_ms)}</td>
                                        <td className="text-right px-3 py-1.5 font-mono text-purple-500">${j.estimated_cost_usd?.toFixed(4)}</td>
                                        <td className="px-3 py-1.5 text-[10px] text-muted-foreground/60 font-mono flex items-center gap-2">
                                          <div className="truncate flex-1">
                                            {j.project && j.project !== 'PROD' && <span className="text-primary/50 mr-1">[{j.project}]</span>}
                                            {j.worker_id || '—'}
                                          </div>
                                          {j.source && j.upload_id && (
                                            <Button 
                                              variant="ghost" 
                                              size="icon" 
                                              className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
                                              disabled={retrying}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openRetryModal([{ source: j.source, id: j.upload_id, project: j.project }]);
                                              }}
                                            >
                                              <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                                            </Button>
                                          )}
                                        </td>
                                      </tr>
                                      {expandedErrorRowId === j.id && (
                                        <tr className="bg-red-500/5 border-b border-border/20">
                                          <td colSpan={8} className="px-4 py-2.5 text-xs text-red-400/90 font-mono whitespace-pre-wrap break-all leading-relaxed">
                                            <div className="flex flex-col gap-1 pl-4 border-l-2 border-red-500/30">
                                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Részletes hibaüzenet</span>
                                              <span className="text-red-400">{j.error_message || 'Ismeretlen hiba történt a feldolgozás során.'}</span>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })
                              )}
                              {(() => {
                                const renderedCount = filteredErrorJobs.length === 0 ? 1 : paginatedErrorJobs.length;
                                const emptyRowsCount = ERROR_PAGE_SIZE - renderedCount;
                                if (emptyRowsCount <= 0) return null;
                                return Array.from({ length: emptyRowsCount }).map((_, index) => (
                                  <tr key={`placeholder-${index}`} className="border-b border-transparent">
                                    <td colSpan={8} className="px-3 py-1.5 select-none pointer-events-none">&nbsp;</td>
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>

                          <div className="flex items-center justify-between px-4 py-3 border-t border-border/10 min-h-[53px]">
                            {filteredErrorJobs.length > 0 ? (
                              <>
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {((errorPage - 1) * ERROR_PAGE_SIZE) + 1}–{Math.min(errorPage * ERROR_PAGE_SIZE, filteredErrorJobs.length)} / {filteredErrorJobs.length} hiba
                                </span>
                                {errorTotalPages > 1 && (
                                  <div className="flex gap-1">
                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ wrk_err_page: 1 })} disabled={errorPage === 1} aria-label="Első">
                                      <ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" />
                                    </Button>
                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ wrk_err_page: Math.max(1, errorPage - 1) })} disabled={errorPage === 1} aria-label="Előző">
                                      <ChevronLeft className="h-3.5 w-3.5" />
                                    </Button>
                                    {Array.from({ length: Math.min(5, errorTotalPages) }, (_, i) => {
                                      const pNum = Math.max(1, Math.min(errorTotalPages - 4, errorPage - 2)) + i;
                                      return pNum <= errorTotalPages ? (
                                        <Button
                                          key={pNum}
                                          variant={pNum === errorPage ? 'default' : 'outline'}
                                          size="icon"
                                          className="h-7 w-7 text-xs"
                                          onClick={() => updateParams({ wrk_err_page: pNum })}
                                          aria-label={`${pNum}. oldal`}
                                          aria-current={pNum === errorPage ? 'page' : undefined}
                                        >
                                          {pNum}
                                        </Button>
                                      ) : null;
                                    })}
                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ wrk_err_page: Math.min(errorTotalPages, errorPage + 1) })} disabled={errorPage === errorTotalPages} aria-label="Következő">
                                      <ChevronRight className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ wrk_err_page: errorTotalPages })} disabled={errorPage === errorTotalPages} aria-label="Utolsó">
                                      <ChevronRight className="h-3.5 w-3.5" /><ChevronRight className="h-3.5 w-3.5 -ml-2" />
                                    </Button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Nincs találat a keresésre</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 space-y-2">
                          <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mx-auto" />
                          <p className="text-muted-foreground text-sm">Nincs hibás feldolgozás</p>
                          <p className="text-muted-foreground/60 text-xs">Minden feladat sikeresen lefutott</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })() : showCompleted ? (() => {
                return (
                  <Card className="border-emerald-500/30 bg-emerald-500/5">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          Sikeres feldolgozások (Összes projekt)
                          <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/15 text-emerald-400">
                            {filteredCompletedJobs.length} kész
                          </Badge>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              value={completedSearch}
                              onChange={e => { updateParams({ wrk_ok_page: '1' }); setCompletedSearch(e.target.value); }}
                              placeholder="Keresés (fájl, cég, pipeline)..."
                              className="pl-8 h-7 text-xs w-64 bg-background/50 border-border/30 focus-visible:bg-background"
                            />
                          </div>
                          <button onClick={() => { updateParams({ wrk_show_completed: null, wrk_ok_page: null }); setCompletedSearch(''); }} className="text-muted-foreground hover:text-foreground p-1">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-0 pb-2">
                      {filteredCompletedJobs.length > 0 ? (
                        <>
                          <table className="w-full text-xs table-fixed">
                            <thead>
                              <tr className="border-b border-border/30 text-muted-foreground">
                                <th className="text-left px-4 py-1.5 font-medium w-[110px]">Dátum</th>
                                <th className="text-left px-3 py-1.5 font-medium w-[110px]">Pipeline</th>
                                <th className="text-left px-3 py-1.5 font-medium">Fájl</th>
                                <th className="text-left px-3 py-1.5 font-medium w-[160px]">Cég</th>
                                <th className="text-right px-3 py-1.5 font-medium w-[70px]">Idő</th>
                                <th className="text-right px-3 py-1.5 font-medium w-[80px]">$</th>
                                <th className="text-left px-3 py-1.5 font-medium w-[180px]">Worker</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedCompletedJobs.map((j: any) => {
                                const time = new Date(j.created_at);
                                const dateStr = `${(time.getMonth() + 1).toString().padStart(2, '0')}.${time.getDate().toString().padStart(2, '0')}`;
                                const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
                                return (
                                  <tr key={j.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-1.5 font-mono text-muted-foreground whitespace-nowrap">{dateStr} - {timeStr}</td>
                                    <td className="px-3 py-1.5">
                                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 w-[75px] justify-center">{j.pipeline}</Badge>
                                    </td>
                                    <td className="px-3 py-1.5 max-w-[180px] truncate" title={j.file_name}>
                                      {j.file_url ? (
                                        <button
                                          className="font-medium hover:underline text-left truncate flex items-center gap-1.5 w-full text-foreground/90"
                                          onClick={() => openPreview({ url: j.file_url, name: j.file_name })}
                                        >
                                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                          <span className="truncate">{j.file_name}</span>
                                        </button>
                                      ) : (
                                        <div className="flex items-center gap-1.5 truncate text-muted-foreground/80">
                                          <FileText className="h-3.5 w-3.5 opacity-50 shrink-0" />
                                          <span className="truncate">{j.file_name}</span>
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-3 py-1.5 text-muted-foreground max-w-[120px] truncate">{j.company_name || '—'}</td>
                                    <td className="text-right px-3 py-1.5 font-mono text-muted-foreground">{formatDuration(j.processing_duration_ms)}</td>
                                    <td className="text-right px-3 py-1.5 font-mono text-purple-500">${j.estimated_cost_usd?.toFixed(4)}</td>
                                    <td className="px-3 py-1.5 text-[10px] text-muted-foreground/60 font-mono">
                                      <div className="truncate">
                                        {j.project && j.project !== 'PROD' && <span className="text-primary/50 mr-1">[{j.project}]</span>}
                                        {j.worker_id || '—'}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <div className="flex items-center justify-between px-4 pt-2">
                            <span className="text-[11px] text-muted-foreground">
                              {filteredCompletedJobs.length} sikeres feldolgozás
                            </span>
                            {completedTotalPages > 1 && (
                              <div className="flex items-center gap-1">
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ wrk_ok_page: 1 })} disabled={completedPage === 1} aria-label="Első">
                                  <ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ wrk_ok_page: Math.max(1, completedPage - 1) })} disabled={completedPage === 1} aria-label="Előző">
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </Button>
                                {Array.from({ length: completedTotalPages }, (_, i) => i + 1).map(pNum => {
                                  if (completedTotalPages <= 7 || pNum === 1 || pNum === completedTotalPages || Math.abs(pNum - completedPage) <= 1) {
                                    return (
                                      <Button
                                        key={pNum}
                                        variant={pNum === completedPage ? 'default' : 'outline'}
                                        size="icon"
                                        className="h-7 w-7 text-xs"
                                        onClick={() => updateParams({ wrk_ok_page: pNum })}
                                        aria-label={`${pNum}. oldal`}
                                        aria-current={pNum === completedPage ? 'page' : undefined}
                                      >
                                        {pNum}
                                      </Button>
                                    );
                                  }
                                  if (pNum === 2 || pNum === completedTotalPages - 1) {
                                    return <span key={pNum} className="text-xs text-muted-foreground px-1">…</span>;
                                  }
                                  return null;
                                })}
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ wrk_ok_page: Math.min(completedTotalPages, completedPage + 1) })} disabled={completedPage === completedTotalPages} aria-label="Következő">
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateParams({ wrk_ok_page: completedTotalPages })} disabled={completedPage === completedTotalPages} aria-label="Utolsó">
                                  <ChevronRight className="h-3.5 w-3.5" /><ChevronRight className="h-3.5 w-3.5 -ml-2" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 space-y-2">
                          <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                          <p className="text-muted-foreground text-sm">Nincs sikeres feldolgozás ebben az időszakban</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })() : showProcessing ? (
                <Card className="border-cyan-500/30 bg-cyan-500/5">
                  <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Loader className={`h-4 w-4 text-cyan-500 ${active_processing.length > 0 ? 'animate-spin' : ''}`} />
                        Feldolgozás alatt (globális)
                        <Badge className="text-[10px] px-1.5 py-0 bg-cyan-500/15 text-cyan-400">
                          {active_processing.length} aktív
                        </Badge>
                      </CardTitle>
                      <button onClick={() => updateParams({ wrk_show_processing: null })} className="text-muted-foreground hover:text-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="px-0 pb-2 space-y-3">
                    {active_processing.length > 0 ? (() => {
                      const byProject = new Map<string, any[]>();
                      for (const item of active_processing) {
                        const key = item.project || 'unknown';
                        if (!byProject.has(key)) byProject.set(key, []);
                        byProject.get(key)!.push(item);
                      }

                      const formatElapsed = (sec: number) => {
                        if (sec < 60) return `${sec}s`;
                        if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
                        return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
                      };
                      const elapsedColor = (sec: number) => {
                        if (sec < 30) return 'text-emerald-500';
                        if (sec < 120) return 'text-amber-500';
                        return 'text-red-500';
                      };

                      return Array.from(byProject.entries()).map(([project, items]) => (
                        <div key={project}>
                          <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/20 border-y border-border/20">
                            <Activity className="h-3.5 w-3.5 text-cyan-500" />
                            <span className="text-xs font-semibold">{project}</span>
                            <Badge className="text-[10px] px-1.5 py-0 bg-cyan-500/15 text-cyan-400">{items.length}</Badge>
                          </div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border/30 text-muted-foreground">
                                <th className="text-left px-4 py-1.5 font-medium w-12">Pipeline</th>
                                <th className="text-left px-3 py-1.5 font-medium">Fájl</th>
                                <th className="text-left px-3 py-1.5 font-medium">Cég</th>
                                <th className="text-left px-3 py-1.5 font-medium">Típus</th>
                                <th className="text-right px-3 py-1.5 font-medium">Eltelt idő</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item: any) => (
                                <tr key={item.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-1.5">
                                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${
                                      item.pipeline_type === 'invoice' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-400'
                                    }`}>
                                      {item.pipeline_type}
                                    </Badge>
                                  </td>
                                  <td className="px-3 py-1.5 max-w-[200px] truncate font-medium" title={item.file_name}>
                                    <div className="flex items-center gap-1.5">
                                      <FileText className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                                      {item.file_name || '—'}
                                    </div>
                                  </td>
                                  <td className="px-3 py-1.5 text-muted-foreground max-w-[140px] truncate" title={item.company_name}>{item.company_name || '—'}</td>
                                  <td className="px-3 py-1.5">
                                    <span className="text-[9px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{item.document_category}</span>
                                  </td>
                                  <td className={`text-right px-3 py-1.5 font-mono tabular-nums ${elapsedColor(item.elapsed_sec || 0)}`}>
                                    {formatElapsed(item.elapsed_sec || 0)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ));
                    })() : (
                      <div className="text-center py-8 space-y-2">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mx-auto" />
                        <p className="text-muted-foreground text-sm">Jelenleg nincs aktív feldolgozás</p>
                        <p className="text-muted-foreground/60 text-xs">A workerek várakoznak új feladatokra</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : showAllQueues ? (
                (() => {
                  const allPendingQueues = queues.filter((q: any) => q.queue_length > 0 && !dismissedQueues.has(`${q.project}:${q.queue_name}`)).sort((a: any, b: any) => a.queue_name.localeCompare(b.queue_name));

                  if (allPendingQueues.length === 0 && queues.some((q: any) => q.queue_length > 0)) {
                    setTimeout(() => { updateParams({ wrk_show_queues: null }); setDismissedQueues(new Set()); }, 0);
                    return null;
                  }

                  const formatWaitTime = (enqueuedAt: string) => {
                    const diffMs = Date.now() - new Date(enqueuedAt).getTime();
                    const secs = Math.floor(diffMs / 1000);
                    if (secs < 60) return `${secs} mp`;
                    const mins = Math.floor(secs / 60);
                    const remainSecs = secs % 60;
                    if (mins < 60) return `${mins}:${remainSecs.toString().padStart(2, '0')}`;
                    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                  };
                  const waitColor = (enqueuedAt: string) => {
                    const diffMs = Date.now() - new Date(enqueuedAt).getTime();
                    if (diffMs < 2 * 60 * 1000) return 'text-emerald-500';
                    if (diffMs < 5 * 60 * 1000) return 'text-amber-500';
                    return 'text-red-500';
                  };
                  const sourceIcon = (src: string) => {
                    if (src === 'email_alias' || src === 'email') return <Mail className="h-3 w-3" />;
                    if (src === 'retry') return <RefreshCw className="h-3 w-3" />;
                    return <Upload className="h-3 w-3" />;
                  };
                  const sourceLabel = (src: string) => {
                    if (src === 'email_alias' || src === 'email') return 'Email';
                    if (src === 'retry') return 'Retry';
                    return 'Feltöltés';
                  };
                  const sourceBgClass = (src: string) => {
                    if (src === 'email_alias' || src === 'email') return 'bg-purple-500/10 text-purple-400';
                    if (src === 'retry') return 'bg-red-500/10 text-red-400';
                    return 'bg-blue-500/10 text-blue-400';
                  };

                  return (
                    <Card className="border-amber-500/30 bg-amber-500/5">
                      <CardHeader className="pb-2 pt-3 px-4">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Inbox className="h-4 w-4 text-amber-500" />
                            Queue várakozó (globális)
                            <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-400">
                              {allPendingQueues.reduce((s: number, q: any) => s + (q.queue_length || 0), 0)} várakozó
                            </Badge>
                          </CardTitle>
                          <button onClick={() => updateParams({ wrk_show_queues: null })} className="text-muted-foreground hover:text-foreground">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </CardHeader>
                      <CardContent className="px-0 pb-2 space-y-3">
                        {allPendingQueues.length > 0 ? allPendingQueues.map((queueData: any) => {
                          const items = queueData.pending_items || [];
                          const queueDisplayName = queueData.queue_name.replace(/_jobs$/, '').replace(/^(PROD|VSWEB|THINKERMAN):/, '');
                          return (
                            <div key={`${queueData.project}:${queueData.queue_name}`}>
                              <div className="flex items-center gap-2 px-4 py-1.5 bg-muted/20 border-y border-border/20">
                                <ClipboardList className="h-3.5 w-3.5 text-amber-500" />
                                <span className="text-xs font-semibold capitalize">{queueDisplayName}</span>
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0">{queueData.project}</Badge>
                                <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-400">{queueData.queue_length}</Badge>
                                <span className="flex-1" />
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDismissedQueues(prev => new Set([...prev, `${queueData.project}:${queueData.queue_name}`])); }}
                                  className="text-muted-foreground/40 hover:text-foreground transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                              {items.length > 0 ? (
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-border/30 text-muted-foreground">
                                      <th className="text-left px-4 py-1.5 font-medium w-12">#</th>
                                      <th className="text-left px-3 py-1.5 font-medium">Fájl</th>
                                      <th className="text-left px-3 py-1.5 font-medium">Cég</th>
                                      <th className="text-right px-3 py-1.5 font-medium">Várakozás</th>
                                      <th className="text-left px-3 py-1.5 font-medium">Forrás</th>
                                      <th className="text-left px-3 py-1.5 font-medium">Típus</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {items.map((item: any) => (
                                      <tr key={item.msg_id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                                        <td className="px-4 py-1.5 text-muted-foreground font-mono text-[10px]">#{item.msg_id}</td>
                                        <td className="px-3 py-1.5 max-w-[200px] truncate font-medium" title={item.file_name}>
                                          <div className="flex items-center gap-1.5">
                                            <FileText className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                                            {item.file_name || '—'}
                                          </div>
                                        </td>
                                        <td className="px-3 py-1.5 text-muted-foreground max-w-[140px] truncate" title={item.company_name}>{item.company_name || '—'}</td>
                                        <td className={`text-right px-3 py-1.5 font-mono tabular-nums ${waitColor(item.enqueued_at)}`}>{formatWaitTime(item.enqueued_at)}</td>
                                        <td className="px-3 py-1.5">
                                          <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded ${sourceBgClass(item.source)}`}>
                                            {sourceIcon(item.source)}
                                            {sourceLabel(item.source)}
                                          </span>
                                        </td>
                                        <td className="px-3 py-1.5">
                                          <span className="text-[9px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{item.document_category}</span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-center py-3 text-muted-foreground text-xs">Az elemek részletei nem elérhetők</p>
                              )}
                            </div>
                          );
                        }) : (
                          <div className="text-center py-8 space-y-2">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mx-auto" />
                            <p className="text-muted-foreground text-sm">Jelenleg nincs várakozó üzenet</p>
                            <p className="text-muted-foreground/60 text-xs">Minden queue üres</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()
              ) : (
                <>
                  {/* Pipeline Performance Table */}
                  <Card className="border-border/40">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Pipeline teljesítmény ({workerPeriodLabel[workerPeriod]})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-0 pb-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border/30 text-muted-foreground">
                            <th className="text-left px-4 py-1.5 font-medium">Pipeline</th>
                            <th className="text-right px-3 py-1.5 font-medium">Kész</th>
                            <th className="text-right px-3 py-1.5 font-medium">Avg idő</th>
                            <th className="text-right px-3 py-1.5 font-medium">LLM $</th>
                            <th className="text-right px-3 py-1.5 font-medium">Hibák</th>
                            <th className="text-center px-3 py-1.5 font-medium">7 nap</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPipelines.map((p: any) => (
                            <tr key={p.pipeline} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-2 font-medium">{p.pipeline}</td>
                              <td className="text-right px-3 py-2 font-mono">{p.jobs_24h}</td>
                              <td className="text-right px-3 py-2 font-mono text-muted-foreground">{formatDuration(p.avg_duration_ms)}</td>
                              <td className="text-right px-3 py-2 font-mono text-purple-500">${p.total_cost_usd}</td>
                              <td className="text-right px-3 py-2">
                                {p.error_count_24h > 0 ? (
                                  <span className="text-red-500 font-mono">{p.error_count_24h}</span>
                                ) : (
                                  <span className="text-muted-foreground/40">0</span>
                                )}
                              </td>
                              <td className="text-center px-3 py-2">
                                <MiniSparkline data={p.daily_counts || []} />
                              </td>
                            </tr>
                          ))}
                          {filteredPipelines.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Nincs pipeline adat az utolsó 24 órában</td></tr>
                          )}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                  {/* ── Queue Detail Panel (inline above recent jobs) ── */}
                  {(() => {
                    const queuesToShow = showAllQueues
                      ? queues.filter((q: any) => q.queue_length > 0).sort((a: any, b: any) => a.queue_name.localeCompare(b.queue_name))
                      : selectedQueue
                        ? filteredQueues.filter((q: any) => q.queue_name === selectedQueue && q.queue_length > 0)
                        : [];
                    if (queuesToShow.length === 0) return null;

                    const formatWaitTime = (enqueuedAt: string) => {
                      const diffMs = Date.now() - new Date(enqueuedAt).getTime();
                      const secs = Math.floor(diffMs / 1000);
                      if (secs < 60) return `${secs} mp`;
                      const mins = Math.floor(secs / 60);
                      const remainSecs = secs % 60;
                      if (mins < 60) return `${mins}:${remainSecs.toString().padStart(2, '0')}`;
                      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                    };
                    const waitColor = (enqueuedAt: string) => {
                      const diffMs = Date.now() - new Date(enqueuedAt).getTime();
                      if (diffMs < 2 * 60 * 1000) return 'text-emerald-500';
                      if (diffMs < 5 * 60 * 1000) return 'text-amber-500';
                      return 'text-red-500';
                    };
                    const sourceIcon = (src: string) => {
                      if (src === 'email_alias' || src === 'email') return <Mail className="h-3 w-3" />;
                      if (src === 'retry') return <RefreshCw className="h-3 w-3" />;
                      return <Upload className="h-3 w-3" />;
                    };
                    const sourceLabel = (src: string) => {
                      if (src === 'email_alias' || src === 'email') return 'Email';
                      if (src === 'retry') return 'Retry';
                      return 'Feltöltés';
                    };
                    const sourceBgClass = (src: string) => {
                      if (src === 'email_alias' || src === 'email') return 'bg-purple-500/10 text-purple-400';
                      if (src === 'retry') return 'bg-red-500/10 text-red-400';
                      return 'bg-blue-500/10 text-blue-400';
                    };

                    return (
                      <div className="space-y-3">
                        {showAllQueues && (
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-amber-400 flex items-center gap-2">
                              <ClipboardList className="h-4 w-4" />
                              Összes várakozó queue ({queuesToShow.reduce((acc: number, q: any) => acc + q.queue_length, 0)} elem)
                            </span>
                            <button onClick={() => { updateParams({ wrk_show_queues: null }); setSelectedQueue(null); }} className="text-muted-foreground hover:text-foreground">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                        {queuesToShow.map((queueData: any) => {
                          const items = queueData.pending_items || [];
                          const queueDisplayName = queueData.queue_name.replace(/_jobs$/, '').replace(/^(PROD|VSWEB|THINKERMAN):/, '');
                          return (
                            <Card key={queueData.queue_name} className="border-amber-500/30 bg-amber-500/5">
                              <CardHeader className="pb-2 pt-3 px-4">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                                    <ClipboardList className="h-4 w-4 text-amber-500" />
                                    <span className="capitalize">{queueDisplayName}</span>
                                    <Badge className="text-[10px] px-1.5 py-0 bg-amber-500/15 text-amber-400">
                                      {queueData.queue_length} várakozó
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground font-normal">{queueData.project}</span>
                                  </CardTitle>
                                  {!showAllQueues && (
                                    <button onClick={() => setSelectedQueue(null)} className="text-muted-foreground hover:text-foreground">
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </CardHeader>
                              <CardContent className="px-0 pb-2">
                                {items.length > 0 ? (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-border/30 text-muted-foreground">
                                        <th className="text-left px-4 py-1.5 font-medium w-12">#</th>
                                        <th className="text-left px-3 py-1.5 font-medium">Fájl</th>
                                        <th className="text-left px-3 py-1.5 font-medium">Cég</th>
                                        <th className="text-right px-3 py-1.5 font-medium">Várakozás</th>
                                        <th className="text-left px-3 py-1.5 font-medium">Forrás</th>
                                        <th className="text-left px-3 py-1.5 font-medium">Típus</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {items.map((item: any) => (
                                        <tr key={item.msg_id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                                          <td className="px-4 py-1.5 text-muted-foreground font-mono text-[10px]">#{item.msg_id}</td>
                                          <td className="px-3 py-1.5 max-w-[200px] truncate font-medium" title={item.file_name}>
                                            <div className="flex items-center gap-1.5">
                                              <FileText className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                                              {item.file_name || '—'}
                                            </div>
                                          </td>
                                          <td className="px-3 py-1.5 text-muted-foreground max-w-[140px] truncate" title={item.company_name}>{item.company_name || '—'}</td>
                                          <td className={`text-right px-3 py-1.5 font-mono tabular-nums ${waitColor(item.enqueued_at)}`}>{formatWaitTime(item.enqueued_at)}</td>
                                          <td className="px-3 py-1.5">
                                            <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded ${sourceBgClass(item.source)}`}>
                                              {sourceIcon(item.source)}
                                              {sourceLabel(item.source)}
                                            </span>
                                          </td>
                                          <td className="px-3 py-1.5">
                                            <span className="text-[9px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">{item.document_category}</span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <p className="text-center py-4 text-muted-foreground text-xs">Az elemek részletei nem elérhetők</p>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Recent Jobs */}
                  <Card className="border-border/40">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-500" />
                        Utolsó feldolgozások
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-0 pb-2">
                      <table className="w-full text-xs table-fixed">
                        <thead>
                          <tr className="border-b border-border/30 text-muted-foreground">
                            <th className="text-left px-4 py-1.5 font-medium w-[110px]">Dátum</th>
                            <th className="text-left px-3 py-1.5 font-medium w-[110px]">Pipeline</th>
                            <th className="text-left px-3 py-1.5 font-medium">Fájl</th>
                            <th className="text-left px-3 py-1.5 font-medium w-[160px]">Cég</th>
                            <th className="text-center px-3 py-1.5 font-medium w-[70px]">Státusz</th>
                            <th className="text-right px-3 py-1.5 font-medium w-[70px]">Idő</th>
                            <th className="text-right px-3 py-1.5 font-medium w-[80px]">$</th>
                            <th className="text-left px-3 py-1.5 font-medium w-[220px]">Worker</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredJobs.map((j: any) => {
                            const time = new Date(j.created_at);
                            const dateStr = `${(time.getMonth() + 1).toString().padStart(2, '0')}.${time.getDate().toString().padStart(2, '0')}`;
                            const timeStr = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
                            return (
                              <tr key={j.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-1.5 font-mono text-muted-foreground whitespace-nowrap">{dateStr} - {timeStr}</td>
                                <td className="px-3 py-1.5">
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 w-[75px] justify-center">{j.pipeline}</Badge>
                                </td>
                                <td className="px-3 py-1.5 max-w-[180px] truncate" title={j.file_name}>
                                  {j.file_url ? (
                                    <button
                                      className="font-medium hover:underline text-left truncate flex items-center gap-1.5 w-full text-foreground/90"
                                      onClick={() => openPreview({ url: j.file_url, name: j.file_name })}
                                    >
                                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      <span className="truncate">{j.file_name}</span>
                                    </button>
                                  ) : (
                                    <div className="flex items-center gap-1.5 truncate text-muted-foreground/80">
                                      <FileText className="h-3.5 w-3.5 opacity-50 shrink-0" />
                                      <span className="truncate">{j.file_name}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground max-w-[120px] truncate">{j.company_name || '—'}</td>
                                <td className="text-center px-3 py-1.5">
                                  {j.status === 'ERROR' ? (
                                    <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] px-1.5 py-0 font-medium">ERROR</Badge>
                                  ) : j.status === 'REDIRECTED' ? (
                                    <Badge variant="outline" className="bg-info/10 text-info border-info/20 text-[10px] px-1.5 py-0 font-medium">REDIRECT</Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] px-1.5 py-0 font-medium">OK</Badge>
                                  )}
                                </td>
                                <td className="text-right px-3 py-1.5 font-mono text-muted-foreground">{formatDuration(j.processing_duration_ms)}</td>
                                <td className="text-right px-3 py-1.5 font-mono text-purple-500">${j.estimated_cost_usd?.toFixed(4)}</td>
                                <td className="px-3 py-1.5 text-[10px] text-muted-foreground/60 font-mono flex items-center gap-2">
                                  <div className="truncate flex-1">
                                    {j.project && j.project !== 'PROD' && <span className="text-primary/50 mr-1">[{j.project}]</span>}
                                    {j.worker_id || '—'}
                                  </div>
                                  {j.source && j.upload_id && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
                                      disabled={retrying}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openRetryModal([{ source: j.source, id: j.upload_id, project: j.project }]);
                                      }}
                                    >
                                      <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {filteredJobs.length === 0 && (
                            <tr><td colSpan={8} className="text-center py-4 text-muted-foreground">Nincs feldolgozás ennél a konténernél az utolsó időszakban</td></tr>
                          )}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* File Preview */}
      <FilePreviewModal previewFile={previewFile} onClose={closePreview} />

      {/* Retry Pipeline Modal */}
      {retryModalOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in-0">
          <Card className="w-full max-w-md border border-border shadow-2xl bg-card">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" />
                Fájl újraküldése
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {retryTargets.length} elem kerül újra feldolgozásra. Válaszd ki a cél pipeline-t:
              </p>
              <div className="space-y-2">
                {PIPELINE_OPTIONS.map((p) => (
                  <label
                    key={p.value}
                    className={`flex items-center gap-3 p-3 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      retryPipeline === p.value
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <input
                      type="radio"
                      name="retryPipeline"
                      value={p.value}
                      checked={retryPipeline === p.value}
                      onChange={() => setRetryPipeline(p.value)}
                      className="sr-only"
                    />
                    {p.icon}
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setRetryModalOpen(false)} disabled={retrying}>
                  Mégsem
                </Button>
                <Button size="sm" className="gap-1.5" onClick={handleRetryConfirm} disabled={retrying}>
                  {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  {retryPhase === 'refreshing' ? null : retrying ? 'Küldés…' : <>Újraküldés (<span className="tabular-nums inline-block min-w-[2ch] text-center">{retryTargets.length}</span>)</>}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>,
        document.body
      )}
    </div>
  );
}
