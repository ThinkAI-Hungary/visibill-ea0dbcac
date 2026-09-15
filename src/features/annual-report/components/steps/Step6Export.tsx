import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Download,
  Scale,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronRight,
  FileText,
  Eye,
  Upload,
  ExternalLink,
  Database,
  Lock,
  Unlock,
  RefreshCw,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatNumberLocale, formatDateLocale } from '@/lib/locale/formatters';
import { generateAnnualReportPdf, generateAnnualReportPreviewUrl } from '@/lib/annualReportPdf';
import { downloadAnnualReportXml } from '@/lib/annualReportXml';
import { downloadEBeszamoloCsv, E_BESZAMOLO_PORTAL_URL } from '@/lib/annualReportCsv';
import type {
  AnnualReport,
  ValidationResult,
  NotesTemplateItem,
  AssetMovementSummary,
  EquityRowItem,
  SalaryMetrics,
} from '../../types';

interface Step6ExportProps {
  report: AnnualReport;
  selectedCompany: any;
  notesTemplates: NotesTemplateItem[] | undefined;
  assetMovement: AssetMovementSummary | null;
  equityRows: EquityRowItem[];
  salaryMetrics: SalaryMetrics | null;
  updateReport: {
    mutate: (updates: Partial<AnnualReport>) => void;
  };
  setCurrentStep: (step: number) => void;
}

export function Step6Export({
  report,
  selectedCompany,
  notesTemplates,
  assetMovement,
  equityRows,
  salaryMetrics,
  updateReport,
  setCurrentStep,
}: Step6ExportProps) {
  const { t } = useTranslation('accounting');
  const { toast } = useToast();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const validationResults: ValidationResult[] = (report.validation_results as any[]) || [];
  const validationErrors = validationResults.filter((v) => v.severity === 'error' && !v.passed);
  const validationWarnings = validationResults.filter((v) => v.severity === 'warning' && !v.passed);
  const notesSections = (report.notes_sections as any[]) || [];
  const hasBasicData = !!(report.representative_name && report.report_date);
  const hasFrozenData = !!report.frozen_at;
  const hasValidation = !!report.validated_at;
  const validationPassed = hasValidation && validationErrors.length === 0;
  const hasNotes = notesSections.length > 0 || (notesTemplates && notesTemplates.length > 0);
  const hasDividend =
    report.net_income <= 0 || (report.dividend_amount >= 0 && report.retained_earnings >= 0);
  const allReady = hasBasicData && hasFrozenData && validationPassed && hasNotes && hasDividend;

  const checks = [
    {
      label: t('annual_report.step6.checks.basic_data'),
      sublabel: `${report.representative_name || '—'} • ${report.report_date || '—'}`,
      ok: hasBasicData,
      step: 1,
    },
    {
      label: t('annual_report.step6.checks.frozen_data'),
      sublabel: report.frozen_at
        ? t('annual_report.step6.checks.frozen_sublabel', {
            time: formatDateLocale(report.frozen_at, 'yyyy.MM.dd. HH:mm'),
          })
        : t('annual_report.step6.checks.not_frozen'),
      ok: hasFrozenData,
      step: 2,
    },
    {
      label: t('annual_report.step6.checks.validation'),
      sublabel: validationPassed
        ? t('annual_report.step6.checks.validation_all_ok', { count: validationResults.length })
        : validationErrors.length > 0
        ? t('annual_report.step6.checks.validation_issues', {
            errors: validationErrors.length,
            warnings: validationWarnings.length,
          })
        : t('annual_report.step6.checks.not_validated'),
      ok: validationPassed,
      warn: hasValidation && !validationPassed,
      step: 3,
    },
    {
      label: t('annual_report.step6.checks.notes'),
      sublabel: t('annual_report.step6.checks.notes_sublabel', {
        customCount: notesSections.length,
        templateCount: notesTemplates?.length || 0,
      }),
      ok: hasNotes,
      step: 4,
    },
    {
      label: t('annual_report.step6.checks.dividend'),
      sublabel:
        report.net_income > 0
          ? t('annual_report.step6.checks.dividend_sublabel', {
              dividend: formatNumberLocale(report.dividend_amount || 0),
              retained: formatNumberLocale(report.retained_earnings || 0),
            })
          : t('annual_report.step6.checks.dividend_not_needed'),
      ok: hasDividend,
      step: 5,
    },
  ];

  const buildPdfPayload = () => ({
    companyName: selectedCompany?.name || '',
    companyAddress: selectedCompany?.address || '',
    companyTaxNumber: selectedCompany?.tax_number || '',
    fiscalYear: report.fiscal_year,
    representativeName: report.representative_name || '',
    representativeRole: report.representative_role || 'ügyvezető',
    reportDate: report.report_date || new Date().toISOString().slice(0, 10),
    frozenBsData: report.frozen_bs_data || [],
    frozenPnlData: report.frozen_pnl_data || [],
    notesSections: (report.notes_sections as any[]) || [],
    notesTemplates: notesTemplates || [],
    netIncome: report.net_income || 0,
    dividendAmount: report.dividend_amount || 0,
    retainedEarnings: report.retained_earnings || 0,
    dividendResolutionDate: report.dividend_resolution_date || '',
    assetMovement: assetMovement || undefined,
    salaryMetrics: salaryMetrics || undefined,
    equityRows: equityRows || undefined,
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <Download className="w-5 h-5 text-primary" />
        {t('annual_report.step6.header')}
      </h2>
      <p className="text-sm text-muted-foreground -mt-3">
        {t('annual_report.step6.subtitle')}
      </p>

      {/* Wax Seal lock banner */}
      {report.status === 'finalized' && (
        <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border border-emerald-500/20 rounded-2xl relative overflow-hidden select-none animate-in zoom-in duration-300">
          <div className="w-28 h-28 rounded-full bg-red-700 dark:bg-red-800 shadow-2xl flex items-center justify-center border-4 border-red-800 dark:border-red-900 ring-4 ring-red-600/20 relative cursor-pointer transform hover:scale-105 hover:rotate-6 transition-all duration-300">
            <div className="absolute inset-2 rounded-full border border-dashed border-red-500/30" />
            <Scale className="w-12 h-12 text-amber-100 opacity-90 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 via-transparent to-white/20 rounded-full" />
          </div>
          <div className="text-center mt-4">
            <h3 className="font-bold text-base text-foreground tracking-wide flex items-center gap-1.5 justify-center">
              {t('annual_report.step6.seal_title')}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t('annual_report.step6.seal_desc', {
                company: selectedCompany?.name,
                year: report.fiscal_year,
              })}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {t('annual_report.step6.seal_time', {
                time: formatDateLocale(report.updated_at || '', 'yyyy.MM.dd. HH:mm'),
              })}
            </p>
          </div>
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(45deg,rgba(16,185,129,0.03)_25%,transparent_25%,transparent_50%,rgba(16,185,129,0.03)_50%,rgba(16,185,129,0.03)_75%,transparent_75%,transparent)] bg-[size:40px_40px]" />
        </div>
      )}

      {/* Summary Checklist */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" />
            {t('annual_report.step6.checklist_title')}
            {allReady ? (
              <span className="ml-auto text-xs font-semibold bg-emerald-500/10 text-emerald-600 px-3 py-1 rounded-full">
                {t('annual_report.step6.all_ready')}
              </span>
            ) : (
              <span className="ml-auto text-xs font-semibold bg-amber-500/10 text-amber-600 px-3 py-1 rounded-full">
                {t('annual_report.step6.pending_tasks')}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {checks.map((c, i) => (
            <button
              key={i}
              onClick={() => setCurrentStep(c.step)}
              className={cn(
                'w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40',
                i < checks.length - 1 && 'border-b border-border/30'
              )}
            >
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                  c.ok
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : (c as any).warn
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {c.ok ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (c as any).warn ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-muted-foreground truncate">{c.sublabel}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Export & Finalize Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PDF Export Card */}
        <Card
          className={cn(
            'border-border/50 transition-colors',
            report.frozen_at ? 'hover:border-primary/40' : 'opacity-60'
          )}
        >
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 text-primary p-2.5 rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm">{t('annual_report.step6.cards.pdf_title')}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('annual_report.step6.cards.pdf_desc')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                disabled={!report.frozen_at}
                onClick={() => {
                  try {
                    const url = generateAnnualReportPreviewUrl(buildPdfPayload());
                    setPreviewUrl(url);
                  } catch (err) {
                    toast({
                      title: t('common.error'),
                      description: t('annual_report.step6.toasts.pdf_preview_error'),
                      variant: 'destructive',
                    });
                  }
                }}
              >
                <Eye className="w-4 h-4" /> {t('annual_report.step6.cards.preview_btn')}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                disabled={!report.frozen_at}
                onClick={() => {
                  try {
                    generateAnnualReportPdf(buildPdfPayload());
                    toast({
                      title: t('annual_report.step6.toasts.pdf_success_title'),
                      description: t('annual_report.step6.toasts.pdf_success_desc'),
                    });
                  } catch (err) {
                    toast({
                      title: t('common.error'),
                      description: t('annual_report.step6.toasts.pdf_error'),
                      variant: 'destructive',
                    });
                  }
                }}
              >
                <Download className="w-4 h-4" /> {t('annual_report.step6.cards.download_btn')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* e-Beszámoló CSV Export Card */}
        <Card
          className={cn(
            'border-border/50 transition-colors',
            report.frozen_at ? 'hover:border-primary/40' : 'opacity-60'
          )}
        >
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-blue-500/10 text-blue-600 p-2.5 rounded-xl">
                <Upload className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm">{t('annual_report.step6.cards.csv_title')}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('annual_report.step6.cards.csv_desc')}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                disabled={!report.frozen_at}
                onClick={() => {
                  try {
                    downloadEBeszamoloCsv({
                      companyName: selectedCompany?.name || '',
                      companyTaxNumber: selectedCompany?.tax_number || '',
                      fiscalYear: report.fiscal_year,
                      frozenBsData: report.frozen_bs_data || [],
                      frozenPnlData: report.frozen_pnl_data || [],
                      netIncome: report.net_income || 0,
                      dividendAmount: report.dividend_amount || 0,
                      retainedEarnings: report.retained_earnings || 0,
                    });
                    toast({
                      title: t('annual_report.step6.toasts.csv_success_title'),
                      description: t('annual_report.step6.toasts.csv_success_desc'),
                    });
                  } catch (err) {
                    toast({
                      title: t('common.error'),
                      description: t('annual_report.step6.toasts.csv_error'),
                      variant: 'destructive',
                    });
                  }
                }}
              >
                <Download className="w-4 h-4" /> {t('annual_report.step6.cards.download_btn')}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => window.open(E_BESZAMOLO_PORTAL_URL, '_blank')}
              >
                <ExternalLink className="w-4 h-4" /> {t('annual_report.step6.cards.portal_btn')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* OBR XML Export Card */}
        <Card
          className={cn(
            'border-border/50 transition-colors',
            report.frozen_at ? 'hover:border-primary/40' : 'opacity-60'
          )}
        >
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-indigo-500/10 text-indigo-600 p-2.5 rounded-xl">
                <Database className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm">{t('annual_report.step6.cards.xml_title')}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('annual_report.step6.cards.xml_desc')}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2 border-indigo-500/20 hover:bg-indigo-500/5 hover:text-indigo-600"
              disabled={!report.frozen_at}
              onClick={() => {
                try {
                  downloadAnnualReportXml({
                    companyName: selectedCompany?.name || '',
                    companyAddress: selectedCompany?.address || '',
                    companyTaxNumber: selectedCompany?.tax_number || '',
                    fiscalYear: report.fiscal_year,
                    representativeName: report.representative_name || '',
                    representativeRole: report.representative_role || 'ügyvezető',
                    reportDate: report.report_date || new Date().toISOString().slice(0, 10),
                    frozenBsData: report.frozen_bs_data || [],
                    frozenPnlData: report.frozen_pnl_data || [],
                    notesSections: (report.notes_sections as any[]) || [],
                    notesTemplates: notesTemplates || [],
                    netIncome: report.net_income || 0,
                    dividendAmount: report.dividend_amount || 0,
                    retainedEarnings: report.retained_earnings || 0,
                    dividendResolutionDate: report.dividend_resolution_date || '',
                  });
                  toast({
                    title: t('annual_report.step6.toasts.xml_success_title'),
                    description: t('annual_report.step6.toasts.xml_success_desc'),
                  });
                } catch (err) {
                  toast({
                    title: t('common.error'),
                    description: t('annual_report.step6.toasts.xml_error'),
                    variant: 'destructive',
                  });
                }
              }}
            >
              <Download className="w-4 h-4" /> {t('annual_report.step6.cards.xml_download_btn')}
            </Button>
          </CardContent>
        </Card>

        {/* Finalization Card */}
        <Card
          className={cn(
            'border-2 transition-all',
            report.status === 'finalized'
              ? 'border-emerald-500/40 bg-emerald-500/5'
              : 'border-border/50 hover:border-primary/40'
          )}
        >
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'p-2.5 rounded-xl',
                  report.status === 'finalized'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-amber-500/10 text-amber-600'
                )}
              >
                {report.status === 'finalized' ? (
                  <Lock className="w-6 h-6" />
                ) : (
                  <Unlock className="w-6 h-6" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm">
                  {report.status === 'finalized'
                    ? t('annual_report.step6.cards.finalized_title')
                    : t('annual_report.step6.cards.finalize_title')}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {report.status === 'finalized'
                    ? t('annual_report.step6.cards.status_finalized_desc')
                    : !report.frozen_at
                    ? t('annual_report.step6.cards.status_needs_freeze')
                    : !report.validated_at
                    ? t('annual_report.step6.cards.status_needs_validation')
                    : t('annual_report.step6.cards.status_ready_desc')}
                </p>
              </div>
            </div>
            {report.status !== 'finalized' ? (
              <Button
                className="w-full gap-2"
                disabled={!report.frozen_at || !report.validated_at}
                onClick={() => {
                  updateReport.mutate({ status: 'finalized' });
                  toast({
                    title: t('annual_report.step6.toasts.finalized_title'),
                    description: t('annual_report.step6.toasts.finalized_desc'),
                  });
                }}
              >
                <Lock className="w-4 h-4" /> {t('annual_report.step6.cards.finalize_btn')}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => {
                  updateReport.mutate({ status: 'draft' });
                  toast({
                    title: t('annual_report.step6.toasts.unlocked_title'),
                    description: t('annual_report.step6.toasts.unlocked_desc'),
                  });
                }}
              >
                <Unlock className="w-4 h-4" /> {t('annual_report.step6.cards.unlock_btn')}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audit Trail / Változás-napló */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-primary" />
            {t('annual_report.step6.audit_trail.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(() => {
            const events: { date: string; label: string; icon: typeof CheckCircle2; color: string }[] = [];

            if (report.created_at)
              events.push({
                date: report.created_at,
                label: t('annual_report.step6.audit_trail.created'),
                icon: FileText,
                color: 'text-blue-500 bg-blue-500/10',
              });
            if (report.frozen_at)
              events.push({
                date: report.frozen_at,
                label: t('annual_report.step6.audit_trail.frozen'),
                icon: Lock,
                color: 'text-cyan-500 bg-cyan-500/10',
              });
            if (report.validated_at)
              events.push({
                date: report.validated_at,
                label: t('annual_report.step6.audit_trail.validated'),
                icon: Shield,
                color: 'text-amber-500 bg-amber-500/10',
              });
            if (report.status === 'finalized')
              events.push({
                date: report.updated_at,
                label: t('annual_report.step6.audit_trail.finalized'),
                icon: CheckCircle2,
                color: 'text-emerald-500 bg-emerald-500/10',
              });
            if (report.updated_at && report.updated_at !== report.created_at)
              events.push({
                date: report.updated_at,
                label: t('annual_report.step6.audit_trail.modified'),
                icon: RefreshCw,
                color: 'text-muted-foreground bg-muted',
              });

            events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            return events.map((ev, i) => {
              const Icon = ev.icon;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3',
                    i < events.length - 1 && 'border-b border-border/30'
                  )}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                      ev.color
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{ev.label}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {formatDateLocale(ev.date, 'yyyy.MM.dd. HH:mm')}
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </CardContent>
      </Card>

      {/* Footer Info */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 px-4 py-3 rounded-lg border border-border/40">
        <Info className="w-4 h-4 shrink-0" />
        <span>
          {t('annual_report.step6.footer_info')}
        </span>
      </div>

      {/* PDF Live Preview Dialog */}
      <Dialog
        open={!!previewUrl}
        onOpenChange={(open) => {
          if (!open) {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-border/40 bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Eye className="w-5 h-5 text-primary" />
              {t('annual_report.step6.dialog.preview_title', { year: report.fiscal_year })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={t('annual_report.step6.dialog.iframe_title')}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Shield(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </svg>
  );
}
