import React from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, CheckCircle2, Clock, Loader, Loader2, RefreshCw,
  Search, X, FileText, ChevronLeft, ChevronRight, Activity,
  Receipt, Wallet, Landmark, BarChart3, Truck, RotateCcw
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDuration } from '../llm/LLMCostPanel';
import { ERROR_PAGE_SIZE, RETRYABLE_SOURCES } from '../../hooks/useWorkerTelemetry';

export const PIPELINE_OPTIONS: Array<{ value: string; label: string; icon: React.ReactNode; queue?: string; category?: string | null }> = [
  { value: 'same', label: 'Eredeti pipeline (változatlan)', icon: <RotateCcw className="h-4 w-4 text-muted-foreground" /> },
  { value: 'invoice', label: 'Számla feldolgozás', icon: <Receipt className="h-4 w-4 text-emerald-500" />, queue: 'invoice_jobs', category: 'invoice' },
  { value: 'payroll', label: 'Bérjegyzék feldolgozás', icon: <Wallet className="h-4 w-4 text-amber-500" />, queue: 'invoice_jobs', category: 'payroll' },
  { value: 'transaction', label: 'Tranzakció feldolgozás', icon: <Landmark className="h-4 w-4 text-blue-500" />, queue: 'transaction_jobs', category: null },
  { value: 'gl', label: 'Főkönyvi besorolás', icon: <BarChart3 className="h-4 w-4 text-purple-500" />, queue: 'gl_classification_jobs', category: null },
  { value: 'report', label: 'Futár riport feldolgozás', icon: <Truck className="h-4 w-4 text-orange-500" />, queue: 'report_jobs', category: null },
];

export interface TaskErrorRetryTableProps {
  showWorkerErrors: boolean;
  showCompleted: boolean;
  showProcessing: boolean;
  // Errors state & callbacks
  errorJobs: any[];
  filteredErrorJobs: any[];
  paginatedErrorJobs: any[];
  errorPage: number;
  errorTotalPages: number;
  workerErrorSearch: string;
  setWorkerErrorSearch: (val: string) => void;
  selectedErrorIds: Set<string>;
  setSelectedErrorIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedErrorRowId: string | null;
  setExpandedErrorRowId: (val: string | null) => void;
  // Completed state & callbacks
  filteredCompletedJobs: any[];
  paginatedCompletedJobs: any[];
  completedPage: number;
  completedTotalPages: number;
  completedSearch: string;
  setCompletedSearch: (val: string) => void;
  // Processing state
  active_processing: any[];
  // Recent jobs
  filteredJobs: any[];
  // Shared actions
  onOpenPreview: (file: { url: string; name: string }) => void;
  onOpenRetryModal: (ids: Array<{ source: string; id: string; project?: string }>) => void;
  onCloseErrors: () => void;
  onCloseCompleted: () => void;
  onCloseProcessing: () => void;
  onUpdateParams: (updates: Record<string, string | number | null>) => void;
  // Retry modal state & actions
  retryModalOpen: boolean;
  setRetryModalOpen: (val: boolean) => void;
  retryTargets: Array<{ source: string; id: string; project?: string }>;
  retryPipeline: string;
  setRetryPipeline: (val: string) => void;
  retrying: boolean;
  retryPhase: 'idle' | 'sending' | 'refreshing';
  onRetryConfirm: () => void;
}

export function TaskErrorRetryTable(props: TaskErrorRetryTableProps) {
  const {
    showWorkerErrors,
    showCompleted,
    showProcessing,
    errorJobs,
    filteredErrorJobs,
    paginatedErrorJobs,
    errorPage,
    errorTotalPages,
    workerErrorSearch,
    setWorkerErrorSearch,
    selectedErrorIds,
    setSelectedErrorIds,
    expandedErrorRowId,
    setExpandedErrorRowId,
    filteredCompletedJobs,
    paginatedCompletedJobs,
    completedPage,
    completedTotalPages,
    completedSearch,
    setCompletedSearch,
    active_processing,
    filteredJobs,
    onOpenPreview,
    onOpenRetryModal,
    onCloseErrors,
    onCloseCompleted,
    onCloseProcessing,
    onUpdateParams,
    retryModalOpen,
    setRetryModalOpen,
    retryTargets,
    retryPipeline,
    setRetryPipeline,
    retrying,
    retryPhase,
    onRetryConfirm,
  } = props;

  // 1. Worker Errors View
  if (showWorkerErrors) {
    const retryableOnPage = paginatedErrorJobs.filter((j: any) => j.source && j.upload_id && RETRYABLE_SOURCES.has(j.source));
    const allPageSelected = retryableOnPage.length > 0 && retryableOnPage.every((j: any) => selectedErrorIds.has(j.upload_id));
    const somePageSelected = retryableOnPage.some((j: any) => selectedErrorIds.has(j.upload_id));

    const toggleSelectAll = () => {
      if (allPageSelected) {
        setSelectedErrorIds((prev) => {
          const next = new Set(prev);
          retryableOnPage.forEach((j: any) => next.delete(j.upload_id));
          return next;
        });
      } else {
        setSelectedErrorIds((prev) => {
          const next = new Set(prev);
          retryableOnPage.forEach((j: any) => next.add(j.upload_id));
          return next;
        });
      }
    };

    const toggleRow = (uploadId: string) => {
      setSelectedErrorIds((prev) => {
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
      onOpenRetryModal(selected);
    };

    return (
      <>
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
                    onChange={(e) => {
                      onUpdateParams({ wrk_err_page: '1' });
                      setWorkerErrorSearch(e.target.value);
                    }}
                    placeholder="Keresés (fájl, cég, hiba)..."
                    className="pl-8 h-7 text-xs w-64 bg-background/50 border-border/30 focus-visible:bg-background"
                  />
                </div>
                <button onClick={onCloseErrors} className="text-muted-foreground hover:text-foreground p-1">
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
                          ref={(el) => {
                            if (el) el.indeterminate = somePageSelected && !allPageSelected;
                          }}
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
                              onClick={() => setExpandedErrorRowId(expandedErrorRowId === j.id ? null : j.id)}
                            >
                              <td className="px-4 py-1.5" onClick={(e) => e.stopPropagation()}>
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
                                      onOpenPreview({ url: j.file_url, name: j.file_name });
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
                                      onOpenRetryModal([{ source: j.source, id: j.upload_id, project: j.project }]);
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
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateParams({ wrk_err_page: 1 })} disabled={errorPage === 1} aria-label="Első">
                            <ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateParams({ wrk_err_page: Math.max(1, errorPage - 1) })} disabled={errorPage === 1} aria-label="Előző">
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
                                onClick={() => onUpdateParams({ wrk_err_page: pNum })}
                                aria-label={`${pNum}. oldal`}
                                aria-current={pNum === errorPage ? 'page' : undefined}
                              >
                                {pNum}
                              </Button>
                            ) : null;
                          })}
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateParams({ wrk_err_page: Math.min(errorTotalPages, errorPage + 1) })} disabled={errorPage === errorTotalPages} aria-label="Következő">
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateParams({ wrk_err_page: errorTotalPages })} disabled={errorPage === errorTotalPages} aria-label="Utolsó">
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
        {renderRetryModal()}
      </>
    );
  }

  // 2. Completed Tasks View
  if (showCompleted) {
    return (
      <>
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
                    onChange={(e) => {
                      onUpdateParams({ wrk_ok_page: '1' });
                      setCompletedSearch(e.target.value);
                    }}
                    placeholder="Keresés (fájl, cég, pipeline)..."
                    className="pl-8 h-7 text-xs w-64 bg-background/50 border-border/30 focus-visible:bg-background"
                  />
                </div>
                <button onClick={onCloseCompleted} className="text-muted-foreground hover:text-foreground p-1">
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
                                onClick={() => onOpenPreview({ url: j.file_url, name: j.file_name })}
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
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateParams({ wrk_ok_page: 1 })} disabled={completedPage === 1} aria-label="Első">
                        <ChevronLeft className="h-3.5 w-3.5" /><ChevronLeft className="h-3.5 w-3.5 -ml-2" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateParams({ wrk_ok_page: Math.max(1, completedPage - 1) })} disabled={completedPage === 1} aria-label="Előző">
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      {Array.from({ length: completedTotalPages }, (_, i) => i + 1).map((pNum) => {
                        if (completedTotalPages <= 7 || pNum === 1 || pNum === completedTotalPages || Math.abs(pNum - completedPage) <= 1) {
                          return (
                            <Button
                              key={pNum}
                              variant={pNum === completedPage ? 'default' : 'outline'}
                              size="icon"
                              className="h-7 w-7 text-xs"
                              onClick={() => onUpdateParams({ wrk_ok_page: pNum })}
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
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateParams({ wrk_ok_page: Math.min(completedTotalPages, completedPage + 1) })} disabled={completedPage === completedTotalPages} aria-label="Következő">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => onUpdateParams({ wrk_ok_page: completedTotalPages })} disabled={completedPage === completedTotalPages} aria-label="Utolsó">
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
        {renderRetryModal()}
      </>
    );
  }

  // 3. Processing View
  if (showProcessing) {
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

    return (
      <>
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
              <button onClick={onCloseProcessing} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2 space-y-3">
            {active_processing.length > 0 ? (
              Array.from(byProject.entries()).map(([project, items]) => (
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
              ))
            ) : (
              <div className="text-center py-8 space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mx-auto" />
                <p className="text-muted-foreground text-sm">Jelenleg nincs aktív feldolgozás</p>
                <p className="text-muted-foreground/60 text-xs">A workerek várakoznak új feladatokra</p>
              </div>
            )}
          </CardContent>
        </Card>
        {renderRetryModal()}
      </>
    );
  }

  // 4. Default Recent Tasks View
  return (
    <>
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
                          onClick={() => onOpenPreview({ url: j.file_url, name: j.file_name })}
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
                      ) : j.status === 'SUPERSEDED' ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px] px-1.5 py-0 font-medium" title="Környezeti hiba vagy fallback miatt eldobva/felváltva">SUPERSEDED</Badge>
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
                      {j.source && j.upload_id && j.status !== 'SUPERSEDED' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 text-muted-foreground hover:text-foreground shrink-0"
                          disabled={retrying}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenRetryModal([{ source: j.source, id: j.upload_id, project: j.project }]);
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
      {renderRetryModal()}
    </>
  );

  function renderRetryModal() {
    if (!retryModalOpen) return null;
    return createPortal(
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
              <Button size="sm" className="gap-1.5" onClick={onRetryConfirm} disabled={retrying}>
                {retrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {retryPhase === 'refreshing' ? null : retrying ? 'Küldés…' : <>Újraküldés (<span className="tabular-nums inline-block min-w-[2ch] text-center">{retryTargets.length}</span>)</>}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>,
      document.body
    );
  }
}
