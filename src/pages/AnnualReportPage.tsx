import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompany } from '@/contexts/CompanyContext';
import { useActivePreset } from '@/hooks/useActivePreset';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Loader2, CheckCircle2, AlertTriangle, XCircle, Info,
  ChevronRight, ChevronLeft, FileText, Download, RefreshCw,
  ClipboardCheck, BookOpen, DollarSign, Upload, Shield, Database,
  Lock, Unlock
} from 'lucide-react';
import { generateAnnualReportPdf } from '@/lib/annualReportPdf';
import { useFixedAssets } from '@/hooks/useFixedAssets';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════
interface AnnualReport {
  id: string;
  company_id: string;
  preset_id: string;
  fiscal_year: number;
  status: string;
  representative_name: string | null;
  representative_role: string | null;
  report_date: string | null;
  frozen_bs_data: any[] | null;
  frozen_pnl_data: any[] | null;
  frozen_at: string | null;
  validation_results: any[];
  validated_at: string | null;
  notes_sections: any[];
  net_income: number;
  dividend_amount: number;
  retained_earnings: number;
  dividend_resolution_date: string | null;
  dividend_resolution_number: string | null;
  created_at: string;
  updated_at: string;
}

interface ValidationResult {
  rule_id: string;
  rule_name: string;
  passed: boolean;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

// ═══════════════════════════════════════════
// Step definitions
// ═══════════════════════════════════════════
const STEPS = [
  { id: 1, title: 'Alapadatok', icon: FileText, description: 'Év, cégadatok, képviselő' },
  { id: 2, title: 'Adatimport', icon: Database, description: 'Mérleg & P&L befagyasztás' },
  { id: 3, title: 'Validáció', icon: Shield, description: 'Törvényi ellenőrzések' },
  { id: 4, title: 'Kieg. Melléklet', icon: BookOpen, description: 'Szöveges sablonok' },
  { id: 5, title: 'Osztalék', icon: DollarSign, description: 'Eredményfelosztás' },
  { id: 6, title: 'Export', icon: Download, description: 'XML + PDF letöltés' },
];

// ═══════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════
export default function AnnualReportPage() {
  const { selectedCompany } = useCompany();
  const { activePresetId } = useActivePreset(selectedCompany?.id);
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear - 1);
  const [currentStep, setCurrentStep] = useState(1);

  // ── Fetch or create report ──
  const { data: report, isLoading: isLoadingReport } = useQuery({
    queryKey: ['annual_report', selectedCompany?.id, activePresetId, selectedYear],
    queryFn: async () => {
      if (!selectedCompany?.id || !activePresetId) return null;

      const { data, error } = await supabase
        .from('annual_reports')
        .select('*')
        .eq('company_id', selectedCompany.id)
        .eq('preset_id', activePresetId)
        .eq('fiscal_year', selectedYear)
        .maybeSingle();

      if (error) throw error;
      return data as AnnualReport | null;
    },
    enabled: !!selectedCompany?.id && !!activePresetId
  });

  // ── Create report mutation ──
  const createReport = useMutation({
    mutationFn: async () => {
      if (!selectedCompany?.id || !activePresetId) throw new Error('Missing data');
      const { data, error } = await supabase
        .from('annual_reports')
        .insert({
          company_id: selectedCompany.id,
          preset_id: activePresetId,
          fiscal_year: selectedYear,
          created_by: session?.user?.id,
          representative_name: selectedCompany?.name || '',
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annual_report'] });
      toast({ title: 'Beszámoló létrehozva', description: `${selectedYear}. évi beszámoló elkezdve.` });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    }
  });

  // ── Update report mutation ──
  const updateReport = useMutation({
    mutationFn: async (updates: Partial<AnnualReport>) => {
      if (!report?.id) throw new Error('No report');
      const { error } = await supabase
        .from('annual_reports')
        .update(updates as any)
        .eq('id', report.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['annual_report'] })
  });

  // ── Freeze data mutation ──
  const freezeData = useMutation({
    mutationFn: async () => {
      if (!report?.id || !selectedCompany?.id || !activePresetId) throw new Error('Missing');
      const { data, error } = await supabase.rpc('freeze_annual_data', {
        p_report_id: report.id,
        p_company_id: selectedCompany.id,
        p_preset_id: activePresetId,
        p_fiscal_year: selectedYear
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['annual_report'] });
      toast({
        title: 'Adatok befagyasztva',
        description: `Mérleg: ${data?.bs_row_count || 0} sor, P&L: ${data?.pnl_row_count || 0} sor`,
      });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    }
  });

  // ── Validate mutation ──
  const validateReport = useMutation({
    mutationFn: async () => {
      if (!report?.id) throw new Error('No report');
      const { data, error } = await supabase.rpc('validate_annual_report', {
        p_report_id: report.id
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['annual_report'] });
      const passed = data?.all_passed;
      toast({
        title: passed ? '✓ Minden ellenőrzés sikeres!' : '✗ Hibák találhatók',
        description: passed ? 'A beszámoló megfelel a követelményeknek.' : 'Javítsd a jelzett hibákat.',
        variant: passed ? 'default' : 'destructive',
      });
    },
    onError: (err: any) => {
      toast({ title: 'Hiba', description: err.message, variant: 'destructive' });
    }
  });

  // ── Notes templates ──
  const { data: notesTemplates } = useQuery({
    queryKey: ['notes_templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('annual_report_notes_templates')
        .select('*')
        .order('order_num');
      if (error) throw error;
      return data;
    }
  });

  // ── Fixed Assets (TENY) for dynamic table ──
  const { data: fixedAssets } = useQuery({
    queryKey: ['fixedAssets', selectedCompany?.id],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('fixed_assets')
        .select('id, name, acquisition_value, residual_value, status, activation_date, disposal_date, useful_life_months, currency')
        .eq('company_id', selectedCompany.id);
      if (error) return [];
      return data || [];
    },
    enabled: !!selectedCompany?.id
  });

  // ── Salary data for headcount/cost table ──
  const { data: salaryData } = useQuery({
    queryKey: ['salary_annual', selectedCompany?.id, selectedYear],
    queryFn: async () => {
      if (!selectedCompany?.id) return [];
      const { data, error } = await supabase
        .from('salary')
        .select('id, név, összeg, tipus, munkavallalo_neve, dátum')
        .eq('company_id', selectedCompany.id)
        .gte('dátum', `${selectedYear}-01-01`)
        .lte('dátum', `${selectedYear}-12-31`);
      if (error) return [];
      return data || [];
    },
    enabled: !!selectedCompany?.id
  });

  // ── Computed: salary metrics for the fiscal year ──
  const salaryMetrics = useMemo(() => {
    if (!salaryData || salaryData.length === 0) return null;
    const employees = new Set(salaryData.filter((s: any) => s.munkavallalo_neve).map((s: any) => s.munkavallalo_neve));
    const totalWages = salaryData.filter((s: any) => s.tipus === 'bér').reduce((a: number, s: any) => a + Number(s.összeg || 0), 0);
    const totalContrib = salaryData.filter((s: any) => s.tipus === 'járulék').reduce((a: number, s: any) => a + Number(s.összeg || 0), 0);
    return { headcount: employees.size, totalWages, totalContrib, total: totalWages + totalContrib };
  }, [salaryData]);

  // ── Computed: fixed asset movement table ──
  const assetMovement = useMemo(() => {
    if (!fixedAssets || fixedAssets.length === 0) return null;
    const active = fixedAssets.filter((a: any) => a.status === 'active');
    const disposed = fixedAssets.filter((a: any) => a.status === 'disposed' || a.status === 'sold');
    const totalAcquisition = fixedAssets.reduce((a: number, f: any) => a + Number(f.acquisition_value || 0), 0);
    const activeAcquisition = active.reduce((a: number, f: any) => a + Number(f.acquisition_value || 0), 0);
    return { total: fixedAssets.length, active: active.length, disposed: disposed.length, totalAcquisition, activeAcquisition };
  }, [fixedAssets]);

  // ── Computed: equity rows from frozen BS ──
  const equityRows = useMemo(() => {
    if (!report?.frozen_bs_data) return [];
    return (report.frozen_bs_data as any[]).filter((r: any) =>
      r.section === 'liabilities' && (r.row_code || '').startsWith('D') && r.type !== 'total'
    );
  }, [report?.frozen_bs_data]);

  // ── Loading state ──
  if (isLoadingReport) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Beszámoló betöltése...</span>
      </div>
    );
  }

  // ── No report yet → show create ──
  if (!report) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="border-border/60 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-primary/10 text-primary p-4 rounded-2xl w-fit mb-4">
              <ClipboardCheck className="w-10 h-10" />
            </div>
            <CardTitle className="text-2xl">Éves Beszámoló Varázsló</CardTitle>
            <p className="text-muted-foreground mt-2">
              Készítsd el a {selectedYear}. évi beszámolót lépésről lépésre.
            </p>
          </CardHeader>
          <CardContent className="pt-4 space-y-6">
            <div className="flex items-center gap-4 justify-center">
              <Label className="font-medium">Üzleti év:</Label>
              <div className="flex items-center gap-2">
                {[currentYear - 2, currentYear - 1, currentYear].map(y => (
                  <Button
                    key={y}
                    variant={selectedYear === y ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedYear(y)}
                  >
                    {y}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              className="w-full h-12 text-base"
              onClick={() => createReport.mutate()}
              disabled={createReport.isPending}
            >
              {createReport.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <FileText className="w-5 h-5 mr-2" />}
              Beszámoló indítása — {selectedYear}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Wizard view ──
  const validationResults: ValidationResult[] = (report.validation_results as any[]) || [];

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="bg-muted/30 p-4 rounded-xl border border-border/50 print:hidden">
        <div className="flex items-center justify-between gap-2 overflow-x-auto">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = currentStep === step.id;
            const isDone = currentStep > step.id;

            return (
              <React.Fragment key={step.id}>
                <button
                  onClick={() => setCurrentStep(step.id)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all min-w-fit",
                    isActive ? "bg-primary text-primary-foreground shadow-lg scale-105" :
                    isDone ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" :
                    "bg-muted/50 text-muted-foreground hover:bg-muted"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    isActive ? "bg-primary-foreground/20" : isDone ? "bg-emerald-500/20" : "bg-muted"
                  )}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                  </div>
                  <div className="text-left hidden lg:block">
                    <div className="text-xs font-bold">{step.id}. {step.title}</div>
                    <div className="text-[10px] opacity-70">{step.description}</div>
                  </div>
                </button>
                {idx < STEPS.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0 hidden md:block" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <Card className="border-border/60 shadow-md">
        <CardContent className="p-6">
          {/* STEP 1: Basic Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                1. Alapadatok
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Üzleti év</Label>
                  <Input value={report.fiscal_year} disabled className="mt-1.5" />
                </div>
                <div>
                  <Label>Beszámoló státusza</Label>
                  <Input value={report.status === 'draft' ? 'Vázlat' : report.status} disabled className="mt-1.5" />
                </div>
                <div>
                  <Label>Képviselő neve *</Label>
                  <Input
                    value={report.representative_name || ''}
                    onChange={(e) => updateReport.mutate({ representative_name: e.target.value } as any)}
                    placeholder="pl. Kiss János"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Beosztás</Label>
                  <Input
                    value={report.representative_role || 'ügyvezető'}
                    onChange={(e) => updateReport.mutate({ representative_role: e.target.value } as any)}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Data Import */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                2. Mérleg & Eredménykimutatás Import
              </h2>
              <p className="text-muted-foreground">
                A rendszer befagyasztja a {report.fiscal_year}. december 31-i záró állapotot.
              </p>

              {report.frozen_at ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" />
                  <div>
                    <p className="font-bold text-emerald-700 dark:text-emerald-400">Adatok befagyasztva</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Időpont: {new Date(report.frozen_at).toLocaleString('hu-HU')}<br />
                      Mérleg sorok: {report.frozen_bs_data?.length || 0}<br />
                      P&L sorok: {report.frozen_pnl_data?.length || 0}
                    </p>
                    <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={() => freezeData.mutate()} disabled={freezeData.isPending}>
                      <RefreshCw className={cn("w-4 h-4", freezeData.isPending && "animate-spin")} />
                      Újra befagyasztás
                    </Button>
                  </div>
                </div>
              ) : (
                <Button className="h-12 gap-2 text-base" onClick={() => freezeData.mutate()} disabled={freezeData.isPending}>
                  {freezeData.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Database className="w-5 h-5" />}
                  Adatok befagyasztása ({report.fiscal_year}.12.31)
                </Button>
              )}
            </div>
          )}

          {/* STEP 3: Validation */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                3. Validáció — Az „Őrszem"
              </h2>

              <Button
                onClick={() => validateReport.mutate()}
                disabled={validateReport.isPending || !report.frozen_at}
                className="gap-2"
              >
                {validateReport.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                Ellenőrzések futtatása
              </Button>

              {!report.frozen_at && (
                <p className="text-amber-600 text-sm">⚠️ Először fagyaszd be az adatokat a 2. lépésben!</p>
              )}

              {validationResults.length > 0 && (
                <div className="space-y-3">
                  {validationResults.map((r: ValidationResult) => (
                    <div key={r.rule_id} className={cn(
                      "flex items-start gap-3 p-4 rounded-xl border",
                      r.passed ? "bg-emerald-500/5 border-emerald-500/20" :
                      r.severity === 'error' ? "bg-red-500/5 border-red-500/20" :
                      "bg-amber-500/5 border-amber-500/20"
                    )}>
                      {r.passed ? <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5" /> :
                       r.severity === 'error' ? <XCircle className="w-5 h-5 text-red-500 mt-0.5" /> :
                       <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />}
                      <div>
                        <p className="font-bold text-sm">{r.rule_id}: {r.rule_name}</p>
                        <p className="text-sm text-muted-foreground">{r.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Supplementary Notes */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                4. Kiegészítő Melléklet
              </h2>
              <p className="text-muted-foreground text-sm">
                Jogszabályi szöveges sablonok. Módosítsd a szöveget, ha szükséges.
              </p>

              {notesTemplates?.map((tmpl: any) => {
                const saved = (report.notes_sections as any[])?.find((s: any) => s.section_key === tmpl.section_key);
                const text = saved?.text || tmpl.default_text;
                const isAssetSection = tmpl.section_key === 'asset_movement';
                const isEquitySection = tmpl.section_key === 'equity_changes';
                const isSalarySection = tmpl.section_key === 'employee_info';

                return (
                  <div key={tmpl.section_key} className="border border-border/50 rounded-xl overflow-hidden">
                    <div className="bg-muted/30 px-4 py-3 border-b border-border/50 flex items-center justify-between">
                      <span className="font-bold text-sm">{tmpl.section_title}</span>
                      <div className="flex items-center gap-2">
                        {(isAssetSection || isEquitySection || isSalarySection) && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium">Auto-fill</span>
                        )}
                        {tmpl.is_required && <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">Kötelező</span>}
                      </div>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Dynamic table: TENY */}
                      {isAssetSection && assetMovement && (
                        <div className="bg-muted/20 rounded-lg border border-border/30 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead><tr className="bg-muted/50 text-xs">
                              <th className="p-2 text-left">Mutató</th>
                              <th className="p-2 text-right">Érték</th>
                            </tr></thead>
                            <tbody className="divide-y divide-border/20">
                              <tr><td className="p-2">Összes eszköz (db)</td><td className="p-2 text-right tabular-nums">{assetMovement.total}</td></tr>
                              <tr><td className="p-2">Aktív eszközök</td><td className="p-2 text-right tabular-nums">{assetMovement.active}</td></tr>
                              <tr><td className="p-2">Kivezetett eszközök</td><td className="p-2 text-right tabular-nums">{assetMovement.disposed}</td></tr>
                              <tr className="font-medium"><td className="p-2">Bruttó érték összesen</td><td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(assetMovement.totalAcquisition)} Ft</td></tr>
                              <tr><td className="p-2">Aktív eszközök bruttó értéke</td><td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(assetMovement.activeAcquisition)} Ft</td></tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Dynamic table: Equity */}
                      {isEquitySection && equityRows.length > 0 && (
                        <div className="bg-muted/20 rounded-lg border border-border/30 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead><tr className="bg-muted/50 text-xs">
                              <th className="p-2 text-left">Sor</th>
                              <th className="p-2 text-left">Megnevezés</th>
                              <th className="p-2 text-right">Előző év</th>
                              <th className="p-2 text-right">Tárgyév</th>
                            </tr></thead>
                            <tbody className="divide-y divide-border/20">
                              {equityRows.map((r: any) => (
                                <tr key={r.bs_structure_id}>
                                  <td className="p-2 font-mono text-xs">{r.row_code}</td>
                                  <td className="p-2">{r.name}</td>
                                  <td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(Math.round((Number(r.prior_year_balance) || 0) / 1000))} E</td>
                                  <td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(Math.round((Number(r.current_balance) || 0) / 1000))} E</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Dynamic table: Salary */}
                      {isSalarySection && salaryMetrics && (
                        <div className="bg-muted/20 rounded-lg border border-border/30 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead><tr className="bg-muted/50 text-xs">
                              <th className="p-2 text-left">Mutató</th>
                              <th className="p-2 text-right">Érték</th>
                            </tr></thead>
                            <tbody className="divide-y divide-border/20">
                              <tr><td className="p-2">Átlagos létszám</td><td className="p-2 text-right tabular-nums">{salaryMetrics.headcount} fő</td></tr>
                              <tr><td className="p-2">Bérköltség</td><td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(salaryMetrics.totalWages)} Ft</td></tr>
                              <tr><td className="p-2">Bérjárulékok</td><td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(salaryMetrics.totalContrib)} Ft</td></tr>
                              <tr className="font-medium"><td className="p-2">Összes személyi jellegű ráfordítás</td><td className="p-2 text-right tabular-nums">{new Intl.NumberFormat('hu-HU').format(salaryMetrics.total)} Ft</td></tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      <Textarea
                        value={text}
                        rows={6}
                        className="text-sm"
                        onChange={(e) => {
                          const sections = [...((report.notes_sections as any[]) || [])];
                          const idx = sections.findIndex((s: any) => s.section_key === tmpl.section_key);
                          const entry = { section_key: tmpl.section_key, text: e.target.value };
                          if (idx >= 0) sections[idx] = entry; else sections.push(entry);
                          updateReport.mutate({ notes_sections: sections } as any);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* STEP 5: Dividend */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                5. Osztalék és Eredményfelosztás
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Adózott eredmény (Ft)</Label>
                  <Input
                    type="number"
                    value={report.net_income || 0}
                    onChange={(e) => {
                      const ni = Number(e.target.value);
                      updateReport.mutate({
                        net_income: ni,
                        retained_earnings: ni - (report.dividend_amount || 0),
                      } as any);
                    }}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Osztalék (Ft)</Label>
                  <Input
                    type="number"
                    value={report.dividend_amount || 0}
                    onChange={(e) => {
                      const div = Number(e.target.value);
                      updateReport.mutate({
                        dividend_amount: div,
                        retained_earnings: (report.net_income || 0) - div,
                      } as any);
                    }}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Eredménytartalékba (Ft)</Label>
                  <Input value={report.retained_earnings || 0} disabled className="mt-1.5" />
                </div>
                <div>
                  <Label>Határozat dátuma</Label>
                  <Input
                    type="date"
                    value={report.dividend_resolution_date || ''}
                    onChange={(e) => updateReport.mutate({ dividend_resolution_date: e.target.value } as any)}
                    className="mt-1.5"
                  />
                </div>
              </div>

              {/* Auto-generated resolution text */}
              {(report.net_income || 0) > 0 && (
                <div className="bg-muted/30 border border-border/50 rounded-xl p-4">
                  <p className="text-xs font-bold text-muted-foreground mb-2">Automatikus határozat szövege:</p>
                  <p className="text-sm italic">
                    „A(z) {selectedCompany?.name || '...'} taggyűlése {report.dividend_resolution_date || '...'}-án megtartott
                    ülésén a {report.fiscal_year}. üzleti év {new Intl.NumberFormat('hu-HU').format(report.net_income || 0)} Ft
                    adózott eredményéből {new Intl.NumberFormat('hu-HU').format(report.dividend_amount || 0)} Ft osztalék
                    kifizetéséről döntött. A fennmaradó {new Intl.NumberFormat('hu-HU').format(report.retained_earnings || 0)} Ft
                    az eredménytartalékba kerül."
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 6: Export */}
          {currentStep === 6 && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                6. Export és Beküldés
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PDF Export Card */}
                <Card className="border-border/50 hover:border-primary/40 transition-colors">
                  <CardContent className="p-6 text-center space-y-3">
                    <div className="mx-auto bg-primary/10 text-primary p-4 rounded-2xl w-fit">
                      <FileText className="w-8 h-8" />
                    </div>
                    <h3 className="font-bold">Vezetői PDF</h3>
                    <p className="text-xs text-muted-foreground">Nyomtatható, aláírható PDF</p>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      disabled={!report.frozen_at}
                      onClick={() => {
                        try {
                          generateAnnualReportPdf({
                            companyName: selectedCompany?.name || '',
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
                          toast({ title: 'PDF generálva', description: 'A letöltés megkezdődött.' });
                        } catch (err) {
                          toast({ title: 'Hiba', description: 'Nem sikerült a PDF generálás.', variant: 'destructive' });
                        }
                      }}
                    >
                      <Download className="w-4 h-4" /> Letöltés PDF
                    </Button>
                  </CardContent>
                </Card>

                {/* Finalization Card */}
                <Card className="border-border/50 hover:border-primary/40 transition-colors">
                  <CardContent className="p-6 text-center space-y-3">
                    <div className={cn(
                      "mx-auto p-4 rounded-2xl w-fit",
                      report.status === 'finalized' ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    )}>
                      {report.status === 'finalized' ? <Lock className="w-8 h-8" /> : <Unlock className="w-8 h-8" />}
                    </div>
                    <h3 className="font-bold">
                      {report.status === 'finalized' ? 'Véglegesítve ✓' : 'Véglegesítés'}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {report.status === 'finalized'
                        ? 'A beszámoló véglegesítve van. Módosításhoz oldd fel.'
                        : 'Zárd le a beszámolót — ezután nem módosítható.'}
                    </p>
                    {report.status !== 'finalized' ? (
                      <Button
                        className="w-full gap-2"
                        disabled={!report.frozen_at || !report.validated_at}
                        onClick={() => {
                          updateReport.mutate({ status: 'finalized' } as any);
                          toast({ title: 'Beszámoló véglegesítve', description: 'A beszámoló zárolva lett.' });
                        }}
                      >
                        <Lock className="w-4 h-4" /> Véglegesítés
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => {
                          updateReport.mutate({ status: 'draft' } as any);
                          toast({ title: 'Zárolás feloldva', description: 'A beszámoló újra szerkeszthető.' });
                        }}
                      >
                        <Unlock className="w-4 h-4" /> Zárolás feloldása
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between print:hidden">
        <Button variant="outline" onClick={() => setCurrentStep(s => Math.max(1, s - 1))} disabled={currentStep === 1} className="gap-2">
          <ChevronLeft className="w-4 h-4" /> Előző
        </Button>
        <Button onClick={() => setCurrentStep(s => Math.min(6, s + 1))} disabled={currentStep === 6} className="gap-2">
          Következő <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
