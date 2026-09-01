import React from 'react';
import {
  Server, DollarSign, ClipboardList, CheckCircle2, Loader, AlertTriangle, CircleDot, ChevronDown
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FilePreviewModal } from '@/components/ui/FilePreviewModal';
import { Skeleton } from '../common/ManagementSkeleton';
import { LLMCostPanel } from '../llm/LLMCostPanel';
import { useWorkerTelemetry, WORKER_PERIOD_LABELS } from '../../hooks/useWorkerTelemetry';
import { ContainerMetricsCard } from './ContainerMetricsCard';
import { QueueMonitorGrid } from './QueueMonitorGrid';
import { PipelineStatusList } from './PipelineStatusList';
import { TaskErrorRetryTable, PIPELINE_OPTIONS } from './TaskErrorRetryTable';

export function WorkerPanel() {
  const telemetry = useWorkerTelemetry();

  const {
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
    active_processing,
    summary,
    activeContainer,
    containerData,
    filteredJobs,
    errorJobs,
    filteredErrorJobs,
    errorTotalPages,
    paginatedErrorJobs,
    filteredCompletedJobs,
    completedTotalPages,
    paginatedCompletedJobs,
    filteredPipelines,
    filteredQueues,
  } = telemetry;

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

  const kpis = [
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
      label: `Feldolgozva (${WORKER_PERIOD_LABELS[workerPeriod] || workerPeriod})`,
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
      label: `Worker hibák (${WORKER_PERIOD_LABELS[workerPeriod] || workerPeriod})`,
      value: summary.total_errors_24h || 0,
      icon: AlertTriangle,
      color: (summary.total_errors_24h || 0) > 0 ? 'text-red-500' : 'text-muted-foreground',
      sub: 'hiba',
    },
  ];

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
              {['all', '24h', '7d', '30d', '90d'].map((p) => (
                <button
                  key={p}
                  onClick={() => updateParams({ wrk_period: p })}
                  className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                    workerPeriod === p ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {WORKER_PERIOD_LABELS[p] || p}
                </button>
              ))}
            </div>
          </div>

          {/* ── KPI Summary Row ── */}
          <div className="grid grid-cols-5 gap-3">
            {kpis.map((kpi) => {
              const isQueueKpi = kpi.label === 'Queue várakozó';
              const isProcessingKpi = kpi.label === 'Feldolgozás alatt';
              const isErrorKpi = kpi.label.startsWith('Worker hibák');
              const isCompletedKpi = kpi.label.startsWith('Feldolgozva');
              const isQueueClickable = isQueueKpi && (summary.total_queue_pending || 0) > 0;
              const isProcessingClickable = isProcessingKpi;
              const isErrorClickable = isErrorKpi && (summary.total_errors_24h || 0) > 0;
              const isCompletedClickable = isCompletedKpi && (summary.total_jobs_24h || 0) > 0;
              const isClickable = isQueueClickable || isProcessingClickable || isErrorClickable || isCompletedClickable;
              const isActive =
                (showAllQueues && isQueueKpi) ||
                (showProcessing && isProcessingKpi) ||
                (showWorkerErrors && isErrorKpi) ||
                (showCompleted && isCompletedKpi);

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
                    <kpi.icon
                      className={`h-4 w-4 ${kpi.color} ${
                        isProcessingKpi && (summary.total_processing || 0) > 0 ? 'animate-spin' : ''
                      }`}
                    />
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
                      onClick={() => {
                        setSelectedContainer(c.container_name);
                        setSelectedSection('containers');
                      }}
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
                          <span
                            className={`${
                              c.cpu_usage > 85
                                ? 'text-red-400 font-semibold'
                                : c.cpu_usage > 50
                                ? 'text-amber-400'
                                : 'text-muted-foreground/80'
                            }`}
                          >
                            {c.cpu_usage.toFixed(0)}%
                          </span>
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
                    const isExpanded = showAllQueues ? hasItems && !isDismissed : selectedQueue === q.queue_name;
                    return (
                      <button
                        key={q.queue_name}
                        onClick={() => {
                          if (!hasItems) return;
                          if (showAllQueues) {
                            if (isDismissed) {
                              setDismissedQueues((prev) => {
                                const next = new Set(prev);
                                next.delete(queueKey);
                                return next;
                              });
                            } else {
                              setDismissedQueues((prev) => new Set([...prev, queueKey]));
                            }
                          } else {
                            setSelectedQueue(selectedQueue === q.queue_name ? null : q.queue_name);
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
                        <span
                          className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                            hasItems ? 'bg-amber-500' : 'bg-emerald-500/50'
                          }`}
                        />
                        <span className="truncate flex-1 text-left">
                          {q.queue_name.replace(/_jobs$/, '').replace(/^(PROD|VSWEB|THINKERMAN):/, '')}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-[10px] px-1.5 py-0 min-w-[24px] text-center justify-center ${
                            hasItems ? 'bg-amber-500/15 text-amber-400' : ''
                          }`}
                        >
                          {q.queue_length}
                        </Badge>
                        <ChevronDown
                          className={`h-3 w-3 flex-shrink-0 transition-transform duration-200 ${
                            !hasItems ? 'invisible' : isExpanded ? 'rotate-180 text-amber-400' : 'text-muted-foreground/40'
                          }`}
                        />
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
                <ContainerMetricsCard containerData={containerData} />
              )}

              {/* Views: Errors / Completed / Processing / Queues / Pipelines + Recent Jobs */}
              {showWorkerErrors || showCompleted || showProcessing ? (
                <TaskErrorRetryTable
                  showWorkerErrors={showWorkerErrors}
                  showCompleted={showCompleted}
                  showProcessing={showProcessing}
                  errorJobs={errorJobs}
                  filteredErrorJobs={filteredErrorJobs}
                  paginatedErrorJobs={paginatedErrorJobs}
                  errorPage={errorPage}
                  errorTotalPages={errorTotalPages}
                  workerErrorSearch={workerErrorSearch}
                  setWorkerErrorSearch={setWorkerErrorSearch}
                  selectedErrorIds={selectedErrorIds}
                  setSelectedErrorIds={setSelectedErrorIds}
                  expandedErrorRowId={expandedErrorRowId}
                  setExpandedErrorRowId={setExpandedErrorRowId}
                  filteredCompletedJobs={filteredCompletedJobs}
                  paginatedCompletedJobs={paginatedCompletedJobs}
                  completedPage={completedPage}
                  completedTotalPages={completedTotalPages}
                  completedSearch={completedSearch}
                  setCompletedSearch={setCompletedSearch}
                  active_processing={active_processing}
                  filteredJobs={filteredJobs}
                  onOpenPreview={openPreview}
                  onOpenRetryModal={openRetryModal}
                  onCloseErrors={() => {
                    updateParams({ wrk_show_errors: null, wrk_err_page: null });
                    setWorkerErrorSearch('');
                    setSelectedErrorIds(new Set());
                  }}
                  onCloseCompleted={() => {
                    updateParams({ wrk_show_completed: null, wrk_ok_page: null });
                    setCompletedSearch('');
                  }}
                  onCloseProcessing={() => updateParams({ wrk_show_processing: null })}
                  onUpdateParams={updateParams}
                  retryModalOpen={retryModalOpen}
                  setRetryModalOpen={setRetryModalOpen}
                  retryTargets={retryTargets}
                  retryPipeline={retryPipeline}
                  setRetryPipeline={setRetryPipeline}
                  retrying={retrying}
                  retryPhase={retryPhase}
                  onRetryConfirm={() => handleRetryConfirm(PIPELINE_OPTIONS)}
                />
              ) : showAllQueues ? (
                <QueueMonitorGrid
                  queues={queues}
                  selectedQueue={selectedQueue}
                  showAllQueues={showAllQueues}
                  dismissedQueues={dismissedQueues}
                  onCloseAll={() => updateParams({ wrk_show_queues: null })}
                  onCloseSelected={() => setSelectedQueue(null)}
                  onDismissQueue={(queueKey) => setDismissedQueues((prev) => new Set([...prev, queueKey]))}
                />
              ) : (
                <>
                  <PipelineStatusList
                    pipelines={filteredPipelines}
                    periodLabel={WORKER_PERIOD_LABELS[workerPeriod] || workerPeriod}
                  />

                  <QueueMonitorGrid
                    queues={filteredQueues}
                    selectedQueue={selectedQueue}
                    showAllQueues={false}
                    dismissedQueues={dismissedQueues}
                    onCloseAll={() => updateParams({ wrk_show_queues: null })}
                    onCloseSelected={() => setSelectedQueue(null)}
                  />

                  <TaskErrorRetryTable
                    showWorkerErrors={false}
                    showCompleted={false}
                    showProcessing={false}
                    errorJobs={errorJobs}
                    filteredErrorJobs={filteredErrorJobs}
                    paginatedErrorJobs={paginatedErrorJobs}
                    errorPage={errorPage}
                    errorTotalPages={errorTotalPages}
                    workerErrorSearch={workerErrorSearch}
                    setWorkerErrorSearch={setWorkerErrorSearch}
                    selectedErrorIds={selectedErrorIds}
                    setSelectedErrorIds={setSelectedErrorIds}
                    expandedErrorRowId={expandedErrorRowId}
                    setExpandedErrorRowId={setExpandedErrorRowId}
                    filteredCompletedJobs={filteredCompletedJobs}
                    paginatedCompletedJobs={paginatedCompletedJobs}
                    completedPage={completedPage}
                    completedTotalPages={completedTotalPages}
                    completedSearch={completedSearch}
                    setCompletedSearch={setCompletedSearch}
                    active_processing={active_processing}
                    filteredJobs={filteredJobs}
                    onOpenPreview={openPreview}
                    onOpenRetryModal={openRetryModal}
                    onCloseErrors={() => {}}
                    onCloseCompleted={() => {}}
                    onCloseProcessing={() => {}}
                    onUpdateParams={updateParams}
                    retryModalOpen={retryModalOpen}
                    setRetryModalOpen={setRetryModalOpen}
                    retryTargets={retryTargets}
                    retryPipeline={retryPipeline}
                    setRetryPipeline={setRetryPipeline}
                    retrying={retrying}
                    retryPhase={retryPhase}
                    onRetryConfirm={() => handleRetryConfirm(PIPELINE_OPTIONS)}
                  />
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* File Preview */}
      <FilePreviewModal previewFile={previewFile} onClose={closePreview} />
    </div>
  );
}
