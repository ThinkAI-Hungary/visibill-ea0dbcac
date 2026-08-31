import React, { useState } from 'react';
import {
  FileText,
  Database,
  Shield,
  BookOpen,
  DollarSign,
  Download,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { generateAnnualReportPreviewUrl } from '@/lib/annualReportPdf';
import { useAnnualReportData } from '../hooks/useAnnualReportData';
import { Step1Alapadatok } from './steps/Step1Alapadatok';
import { Step2Adatimport } from './steps/Step2Adatimport';
import { Step3Validacio } from './steps/Step3Validacio';
import { Step4KiegMelleklet } from './steps/Step4KiegMelleklet';
import { Step5Osztalek } from './steps/Step5Osztalek';
import { Step6Export } from './steps/Step6Export';
import type { AnnualReportStep } from '../types';

const STEPS: AnnualReportStep[] = [
  { id: 1, title: 'Alapadatok', icon: FileText, description: 'Cég és képviselő adatai' },
  { id: 2, title: 'Adatimport', icon: Database, description: 'Mérleg és Eredménykimutatás' },
  { id: 3, title: 'Validáció', icon: Shield, description: 'Összefüggések ellenőrzése' },
  { id: 4, title: 'Kieg. Melléklet', icon: BookOpen, description: 'Szöveges kiegészítés' },
  { id: 5, title: 'Osztalék', icon: DollarSign, description: 'Eredményfelosztás és határozat' },
  { id: 6, title: 'Export', icon: Download, description: 'PDF és zárás' },
];

export function AnnualReportContainer() {
  const { toast } = useToast();
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);

  const {
    selectedCompany,
    selectedYear,
    setSelectedYear,
    currentStep,
    setCurrentStep,
    allReports,
    report,
    isLoadingReport,
    createReport,
    updateReport,
    freezeData,
    validateReport,
    setField,
    getField,
    draftFields,
    setDraftFields,
    notesTemplates,
    activeSectionKey,
    setActiveSectionKey,
    resetCounter,
    setResetCounter,
    livePreviewUrl,
    iframeRef,
    iframeScrollRef,
    salaryMetrics,
    assetMovement,
    equityRows,
    taxLoss,
    setAppliedLossOffset,
    pdfData,
    validationResults,
    isStepCompleted,
  } = useAnnualReportData();

  const currentYearNum = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYearNum - i);
  const completedCount = STEPS.filter((s) => isStepCompleted(s.id)).length;
  const progressPercent = Math.round((completedCount / STEPS.length) * 100);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 animate-in fade-in duration-300">
      {/* Header with year selection & progress summary */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/20 p-5 rounded-2xl border border-border/40 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Éves Beszámoló</h1>
            {report && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-semibold px-2.5 py-0.5 rounded-full',
                  report.status === 'finalized'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                )}
              >
                {report.status === 'finalized' ? (
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Véglegesítve
                  </span>
                ) : (
                  'Vázlat'
                )}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {selectedCompany?.name || 'Válassz céget'} • 6 lépéses beszámoló varázsló
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Year selector dropdown */}
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => {
              setSelectedYear(Number(v));
              setCurrentStep(1);
            }}
          >
            <SelectTrigger className="w-[140px] h-9 text-xs font-bold border-border/60 bg-background shadow-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => {
                const rep = allReports?.find((r) => r.fiscal_year === y);
                return (
                  <SelectItem key={y} value={String(y)} className="text-xs">
                    <span className="font-bold">{y}. év</span>
                    {rep && (
                      <span className="ml-1.5 text-[10px] text-muted-foreground">
                        ({rep.status === 'finalized' ? '✓ lezárt' : 'vázlat'})
                      </span>
                    )}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {/* Quick PDF preview button in header */}
          {report?.frozen_at && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-9"
              onClick={() => {
                try {
                  const url = generateAnnualReportPreviewUrl(pdfData);
                  setHeaderPreviewUrl(url);
                } catch (err) {
                  toast({
                    title: 'Hiba',
                    description: 'Előnézet nem hozható létre.',
                    variant: 'destructive',
                  });
                }
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              Előnézet
            </Button>
          )}
        </div>
      </div>

      {/* Archive / History pill bar */}
      {allReports && allReports.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs text-muted-foreground">
          <span className="font-medium shrink-0">Korábbi évek:</span>
          {allReports.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                setSelectedYear(r.fiscal_year);
                setCurrentStep(1);
              }}
              className={cn(
                'px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors shrink-0 flex items-center gap-1.5',
                r.fiscal_year === selectedYear
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/30 hover:bg-muted/60 border-border/50 text-foreground'
              )}
            >
              <span>{r.fiscal_year}</span>
              {r.status === 'finalized' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isLoadingReport && (
        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
          <p className="text-sm">Beszámoló betöltése...</p>
        </div>
      )}

      {/* Empty State: Create Report */}
      {!isLoadingReport && !report && (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Még nincs beszámoló a {selectedYear}. évhez</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Kattints az alábbi gombra az új beszámoló varázsló elindításához. A folyamat lépésről
                lépésre vezet végig.
              </p>
            </div>
            <Button
              onClick={() => createReport.mutate()}
              disabled={createReport.isPending}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              {selectedYear}. évi beszámoló indítása
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Active Wizard Report View */}
      {!isLoadingReport && report && (
        <div className="space-y-6">
          {/* Step Navigation Pill List with Circular Progress Ring */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isCurrent = currentStep === s.id;
              const isDone = isStepCompleted(s.id);

              return (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(s.id)}
                  className={cn(
                    'flex flex-col items-start p-3 rounded-xl border text-left transition-all relative overflow-hidden',
                    isCurrent
                      ? 'bg-primary/10 border-primary text-primary shadow-sm'
                      : isDone
                      ? 'bg-muted/30 border-border/50 text-foreground hover:bg-muted/50'
                      : 'bg-muted/10 border-border/30 text-muted-foreground hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <Icon className={cn('w-4 h-4', isCurrent ? 'text-primary' : 'text-muted-foreground')} />
                    {isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                  </div>
                  <span className="text-xs font-bold leading-tight">
                    {s.id}. {s.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate w-full mt-0.5">
                    {s.description}
                  </span>
                  {isCurrent && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Step Contents */}
          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-6">
              {currentStep === 1 && (
                <Step1Alapadatok
                  report={report}
                  selectedCompany={selectedCompany}
                  getField={getField}
                  setField={setField}
                />
              )}
              {currentStep === 2 && (
                <Step2Adatimport report={report} freezeData={freezeData} />
              )}
              {currentStep === 3 && (
                <Step3Validacio
                  report={report}
                  validationResults={validationResults}
                  validateReport={validateReport}
                  setCurrentStep={setCurrentStep}
                />
              )}
              {currentStep === 4 && (
                <Step4KiegMelleklet
                  report={report}
                  notesTemplates={notesTemplates}
                  activeSectionKey={activeSectionKey}
                  setActiveSectionKey={setActiveSectionKey}
                  resetCounter={resetCounter}
                  setResetCounter={setResetCounter}
                  updateReport={updateReport}
                  draftFields={draftFields}
                  setDraftFields={setDraftFields}
                  assetMovement={assetMovement}
                  equityRows={equityRows}
                  salaryMetrics={salaryMetrics}
                  livePreviewUrl={livePreviewUrl}
                  iframeRef={iframeRef}
                  iframeScrollRef={iframeScrollRef}
                />
              )}
              {currentStep === 5 && (
                <Step5Osztalek
                  report={report}
                  selectedCompany={selectedCompany}
                  getField={getField}
                  setField={setField}
                  taxLoss={taxLoss}
                  setAppliedLossOffset={setAppliedLossOffset}
                />
              )}
              {currentStep === 6 && (
                <Step6Export
                  report={report}
                  selectedCompany={selectedCompany}
                  notesTemplates={notesTemplates}
                  assetMovement={assetMovement}
                  equityRows={equityRows}
                  salaryMetrics={salaryMetrics}
                  updateReport={updateReport}
                  setCurrentStep={setCurrentStep}
                />
              )}
            </CardContent>
          </Card>

          {/* Stepper Footer Controls */}
          <div className="flex justify-between items-center print:hidden">
            <Button
              variant="outline"
              onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" /> Előző
            </Button>
            <div className="text-xs text-muted-foreground font-mono">
              {currentStep} / {STEPS.length} lépés ({progressPercent}% kész)
            </div>
            <Button
              onClick={() => setCurrentStep((s) => Math.min(6, s + 1))}
              disabled={currentStep === 6}
              className="gap-2"
            >
              Következő <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Header PDF Preview Dialog */}
      <Dialog
        open={!!headerPreviewUrl}
        onOpenChange={(open) => {
          if (!open) {
            if (headerPreviewUrl) URL.revokeObjectURL(headerPreviewUrl);
            setHeaderPreviewUrl(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-border/40 bg-muted/30 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Eye className="w-5 h-5 text-primary" />
              Beszámoló előnézet — {selectedYear}. üzleti év
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {headerPreviewUrl && (
              <iframe
                src={headerPreviewUrl}
                className="w-full h-full border-0"
                title="Éves Beszámoló Előnézet"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
